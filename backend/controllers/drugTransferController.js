const DrugTransfer = require('../models/drugTransferModel');
const Inventory = require('../models/inventoryModel');
const Pharmacy = require('../models/pharmacyModel');

// @desc    Get all drug transfer requests
// @route   GET /api/drug-transfers
// @access  Private
const getTransfers = async (req, res) => {
    try {
        const { status, pharmacy } = req.query;
        const filter = {};

        if (status) filter.status = status;
        if (pharmacy) {
            filter.$or = [
                { fromPharmacy: pharmacy },
                { toPharmacy: pharmacy }
            ];
        }

        const transfers = await DrugTransfer.find(filter)
            .populate('drug', 'name')
            .populate('fromPharmacy', 'name isMainPharmacy')
            .populate('toPharmacy', 'name isMainPharmacy')
            .populate('requestedBy', 'name')
            .populate('reviewedBy', 'name')
            .populate('completedBy', 'name')
            .sort({ createdAt: -1 });

        res.json(transfers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create drug transfer request
// @route   POST /api/drug-transfers
// @access  Private (Pharmacist)
const createTransferRequest = async (req, res) => {
    try {
        const { drugName, toPharmacyId, requestedQuantity, notes } = req.body;

        // Get user's assigned pharmacy
        const User = require('../models/userModel');
        const user = await User.findById(req.user._id).populate('assignedPharmacy');

        if (!user.assignedPharmacy) {
            return res.status(400).json({ message: 'You are not assigned to any pharmacy' });
        }

        const fromPharmacyId = user.assignedPharmacy._id;

        // Validate pharmacies exist
        const toPharmacy = await Pharmacy.findById(toPharmacyId);
        if (!toPharmacy) {
            return res.status(404).json({ message: 'Destination pharmacy not found' });
        }

        // Ensure request is from branch to main or main to branch
        if (!user.assignedPharmacy.isMainPharmacy && !toPharmacy.isMainPharmacy) {
            return res.status(400).json({ message: 'Transfers must involve the main pharmacy' });
        }

        // Find the drug in the source pharmacy (main pharmacy)
        const mainPharmacy = await Pharmacy.findOne({ isMainPharmacy: true });
        const inventoryItem = await Inventory.findOne({
            name: drugName,
            pharmacy: mainPharmacy._id
        });

        if (!inventoryItem) {
            return res.status(404).json({ message: 'Drug not found in main pharmacy inventory' });
        }

        const transfer = await DrugTransfer.create({
            drug: inventoryItem._id,
            fromPharmacy: mainPharmacy._id,
            toPharmacy: toPharmacyId,
            requestedQuantity,
            requestedBy: req.user._id,
            notes,
            status: 'pending'
        });

        const populatedTransfer = await DrugTransfer.findById(transfer._id)
            .populate('drug', 'name')
            .populate('fromPharmacy', 'name')
            .populate('toPharmacy', 'name')
            .populate('requestedBy', 'name');

        res.status(201).json(populatedTransfer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Approve transfer request (with optional quantity edit)
// @route   PUT /api/drug-transfers/:id/approve
// @access  Private (Admin or Main Pharmacy Pharmacist)
const approveTransfer = async (req, res) => {
    try {
        const { approvedQuantity } = req.body;

        const transfer = await DrugTransfer.findById(req.params.id)
            .populate('drug')
            .populate('fromPharmacy')
            .populate('toPharmacy');

        if (!transfer) {
            return res.status(404).json({ message: 'Transfer request not found' });
        }

        if (transfer.status !== 'pending') {
            return res.status(400).json({ message: 'Transfer request already processed' });
        }

        // Validate user has permission (admin or main pharmacy pharmacist)
        const User = require('../models/userModel');
        const user = await User.findById(req.user._id).populate('assignedPharmacy');

        if (user.role !== 'admin' && (!user.assignedPharmacy || !user.assignedPharmacy.isMainPharmacy)) {
            return res.status(403).json({ message: 'Only admin or main pharmacy staff can approve transfers' });
        }

        const finalQuantity = approvedQuantity || transfer.requestedQuantity;

        // Check stock availability
        const sourceItem = await Inventory.findOne({
            _id: transfer.drug._id,
            pharmacy: transfer.fromPharmacy._id
        });

        if (!sourceItem || sourceItem.quantity < finalQuantity) {
            return res.status(400).json({
                message: `Insufficient stock in ${transfer.fromPharmacy.name}. Available: ${sourceItem?.quantity || 0}`
            });
        }

        // Update transfer status
        transfer.status = 'approved';
        transfer.approvedQuantity = finalQuantity;
        transfer.reviewedBy = req.user._id;
        transfer.reviewedAt = new Date();
        await transfer.save();

        // Deduct from source pharmacy
        sourceItem.quantity -= finalQuantity;
        await sourceItem.save();

        // Add to destination pharmacy
        let destItem = await Inventory.findOne({
            name: transfer.drug.name,
            pharmacy: transfer.toPharmacy._id,
            batchNumber: transfer.drug.batchNumber
        });

        if (destItem) {
            destItem.quantity += finalQuantity;
            await destItem.save();
        } else {
            const newItem = new Inventory({
                ...transfer.drug.toObject(),
                _id: undefined,
                quantity: finalQuantity,
                pharmacy: transfer.toPharmacy._id
            });
            await newItem.save();
        }

        // Mark as completed
        transfer.status = 'completed';
        transfer.completedBy = req.user._id;
        transfer.completedAt = new Date();
        await transfer.save();

        const updatedTransfer = await DrugTransfer.findById(transfer._id)
            .populate('drug', 'name')
            .populate('fromPharmacy', 'name')
            .populate('toPharmacy', 'name')
            .populate('requestedBy', 'name')
            .populate('reviewedBy', 'name')
            .populate('completedBy', 'name');

        res.json(updatedTransfer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reject transfer request
// @route   PUT /api/drug-transfers/:id/reject
// @access  Private (Admin or Main Pharmacy Pharmacist)
const rejectTransfer = async (req, res) => {
    try {
        const { rejectionReason } = req.body;

        const transfer = await DrugTransfer.findById(req.params.id);

        if (!transfer) {
            return res.status(404).json({ message: 'Transfer request not found' });
        }

        if (transfer.status !== 'pending') {
            return res.status(400).json({ message: 'Can only reject pending requests' });
        }

        // Validate user has permission
        const User = require('../models/userModel');
        const user = await User.findById(req.user._id).populate('assignedPharmacy');

        if (user.role !== 'admin' && (!user.assignedPharmacy || !user.assignedPharmacy.isMainPharmacy)) {
            return res.status(403).json({ message: 'Only admin or main pharmacy staff can reject transfers' });
        }

        transfer.status = 'rejected';
        transfer.rejectionReason = rejectionReason || 'No reason provided';
        transfer.reviewedBy = req.user._id;
        transfer.reviewedAt = new Date();
        await transfer.save();

        const updatedTransfer = await DrugTransfer.findById(transfer._id)
            .populate('drug', 'name')
            .populate('fromPharmacy', 'name')
            .populate('toPharmacy', 'name')
            .populate('requestedBy', 'name')
            .populate('reviewedBy', 'name');

        res.json(updatedTransfer);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getTransfers,
    createTransferRequest,
    approveTransfer,
    rejectTransfer
};
