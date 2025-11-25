const DrugDisposal = require('../models/drugDisposalModel');
const Inventory = require('../models/inventoryModel');
const Pharmacy = require('../models/pharmacyModel');

// @desc    Get all drug disposals
// @route   GET /api/drug-disposals
// @access  Private
const getDisposals = async (req, res) => {
    try {
        const { pharmacy, reason, type } = req.query;
        const filter = {};

        if (pharmacy) filter.pharmacy = pharmacy;
        if (reason) filter.reason = reason;

        if (type === 'return') {
            filter.reason = { $in: ['return_to_main', 'excess_stock', 'near_expiry'] };
        } else if (type === 'disposal') {
            filter.reason = { $in: ['expired', 'damaged', 'return_to_supplier', 'other'] };
        }

        const disposals = await DrugDisposal.find(filter)
            .populate('drug', 'name batchNumber')
            .populate('pharmacy', 'name')
            .populate('processedBy', 'name')
            .sort({ createdAt: -1 });

        res.json(disposals);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create drug disposal
// @route   POST /api/drug-disposals
// @access  Private
const createDisposal = async (req, res) => {
    try {
        let { drug, quantity, reason, notes } = req.body;
        quantity = Number(quantity);

        // Get user's pharmacy
        const User = require('../models/userModel');
        const currentUser = await User.findById(req.user._id).populate('assignedPharmacy');

        if (!currentUser.assignedPharmacy) {
            return res.status(400).json({ message: 'User not assigned to any pharmacy' });
        }

        // Verify pharmacy is main pharmacy for disposals
        if (!currentUser.assignedPharmacy.isMainPharmacy) {
            return res.status(400).json({ message: 'Drug disposal can only be done from Main Pharmacy' });
        }

        // Find inventory item
        const inventoryItem = await Inventory.findOne({
            _id: drug,
            pharmacy: currentUser.assignedPharmacy._id
        });

        if (!inventoryItem) {
            return res.status(404).json({ message: 'Drug not found in pharmacy' });
        }

        if (inventoryItem.quantity < quantity) {
            return res.status(400).json({ message: `Insufficient stock. Available: ${inventoryItem.quantity}` });
        }

        // Create disposal record
        const disposal = await DrugDisposal.create({
            drug,
            pharmacy: currentUser.assignedPharmacy._id,
            quantity,
            reason,
            processedBy: req.user._id,
            batchNumber: inventoryItem.batchNumber,
            expiryDate: inventoryItem.expiryDate,
            notes
        });

        // Deduct from inventory
        inventoryItem.quantity -= quantity;
        await inventoryItem.save();

        const populatedDisposal = await DrugDisposal.findById(disposal._id)
            .populate('drug', 'name batchNumber')
            .populate('pharmacy', 'name')
            .populate('processedBy', 'name');

        res.status(201).json(populatedDisposal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Return drug to main pharmacy (from branch)
// @route   POST /api/drug-disposal/return
// @access  Private (Branch Pharmacist)
const returnToMainPharmacy = async (req, res) => {
    try {
        let { drug, quantity, reason, notes } = req.body;
        quantity = Number(quantity);

        // Get user's pharmacy
        const User = require('../models/userModel');
        const currentUser = await User.findById(req.user._id).populate('assignedPharmacy');

        if (!currentUser.assignedPharmacy) {
            return res.status(400).json({ message: 'User not assigned to any pharmacy' });
        }

        // Find main pharmacy
        const mainPharmacy = await Pharmacy.findOne({ isMainPharmacy: true });
        if (!mainPharmacy) {
            return res.status(404).json({ message: 'Main pharmacy not found' });
        }

        // Find inventory item in branch pharmacy
        const branchItem = await Inventory.findOne({
            _id: drug,
            pharmacy: currentUser.assignedPharmacy._id
        });

        if (!branchItem) {
            return res.status(404).json({ message: 'Drug not found in your pharmacy' });
        }

        if (branchItem.quantity < quantity) {
            return res.status(400).json({ message: `Insufficient stock. Available: ${branchItem.quantity}` });
        }

        // Create disposal/return record
        const disposal = await DrugDisposal.create({
            drug,
            pharmacy: currentUser.assignedPharmacy._id,
            quantity,
            reason,
            processedBy: req.user._id,
            batchNumber: branchItem.batchNumber,
            expiryDate: branchItem.expiryDate,
            notes
        });

        // Deduct from branch pharmacy
        branchItem.quantity -= quantity;
        await branchItem.save();

        // Add to main pharmacy
        let mainItem = await Inventory.findOne({
            name: branchItem.name,
            pharmacy: mainPharmacy._id,
            batchNumber: branchItem.batchNumber
        });

        if (mainItem) {
            mainItem.quantity += quantity;
            await mainItem.save();
        } else {
            const newItem = new Inventory({
                ...branchItem.toObject(),
                _id: undefined,
                quantity,
                pharmacy: mainPharmacy._id
            });
            await newItem.save();
        }

        const populatedDisposal = await DrugDisposal.findById(disposal._id)
            .populate('drug', 'name batchNumber')
            .populate('pharmacy', 'name')
            .populate('processedBy', 'name');

        res.status(201).json(populatedDisposal);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get disposal statistics
// @route   GET /api/drug-disposals/stats
// @access  Private
const getDisposalStats = async (req, res) => {
    try {
        const { startDate, endDate, pharmacy } = req.query;
        const filter = {};

        if (pharmacy) filter.pharmacy = pharmacy;
        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const stats = await DrugDisposal.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$disposalType',
                    count: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' }
                }
            }
        ]);

        const totalDisposals = await DrugDisposal.countDocuments(filter);

        res.json({
            totalDisposals,
            byType: stats
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDisposals,
    createDisposal,
    returnToMainPharmacy,
    getDisposalStats
};
