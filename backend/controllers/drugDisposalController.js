const DrugDisposal = require('../models/drugDisposalModel');
const Inventory = require('../models/inventoryModel');
const Pharmacy = require('../models/pharmacyModel');

// @desc    Get all drug disposals
// @route   GET /api/drug-disposals
// @access  Private
const getDisposals = async (req, res) => {
    try {
        const { disposalType, pharmacy } = req.query;
        const filter = {};

        if (disposalType) filter.disposalType = disposalType;
        if (pharmacy) filter.pharmacy = pharmacy;

        const disposals = await DrugDisposal.find(filter)
            .populate('drug', 'name batchNumber')
            .populate('pharmacy', 'name')
            .populate('disposedBy', 'name')
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
        const {
            drugId,
            pharmacyId,
            quantity,
            disposalType,
            reason,
            supplierReturnDetails,
            notes
        } = req.body;

        // Verify pharmacy is main pharmacy for disposals
        const pharmacy = await Pharmacy.findById(pharmacyId);
        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        if (!pharmacy.isMainPharmacy) {
            return res.status(400).json({ message: 'Drug disposal can only be done from Main Pharmacy' });
        }

        // Find inventory item
        const inventoryItem = await Inventory.findOne({
            _id: drugId,
            pharmacy: pharmacyId
        });

        if (!inventoryItem) {
            return res.status(404).json({ message: 'Drug not found in pharmacy' });
        }

        if (inventoryItem.quantity < quantity) {
            return res.status(400).json({ message: `Insufficient stock. Available: ${inventoryItem.quantity}` });
        }

        // Create disposal record
        const disposal = await DrugDisposal.create({
            drug: drugId,
            pharmacy: pharmacyId,
            quantity,
            disposalType,
            reason,
            disposedBy: req.user._id,
            supplierReturnDetails: disposalType === 'return_to_supplier' ? supplierReturnDetails : undefined,
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
            .populate('disposedBy', 'name');

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
    getDisposalStats
};
