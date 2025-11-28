const Bank = require('../models/bankModel');

// @desc    Get all banks
// @route   GET /api/banks
// @access  Private
const getBanks = async (req, res) => {
    try {
        const banks = await Bank.find({}).sort({ isDefault: -1, createdAt: -1 });
        res.json(banks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single bank
// @route   GET /api/banks/:id
// @access  Private
const getBankById = async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.id);
        if (!bank) {
            return res.status(404).json({ message: 'Bank not found' });
        }
        res.json(bank);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get default bank
// @route   GET /api/banks/default
// @access  Private
const getDefaultBank = async (req, res) => {
    try {
        const bank = await Bank.findOne({ isDefault: true, isActive: true });
        if (!bank) {
            return res.status(404).json({ message: 'No default bank set' });
        }
        res.json(bank);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create bank
// @route   POST /api/banks
// @access  Private (Admin)
const createBank = async (req, res) => {
    try {
        const { bankName, accountName, accountNumber, branchName, swiftCode, isDefault } = req.body;

        const bank = await Bank.create({
            bankName,
            accountName,
            accountNumber,
            branchName,
            swiftCode,
            isDefault: isDefault || false
        });

        res.status(201).json(bank);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update bank
// @route   PUT /api/banks/:id
// @access  Private (Admin)
const updateBank = async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.id);
        if (!bank) {
            return res.status(404).json({ message: 'Bank not found' });
        }

        const { bankName, accountName, accountNumber, branchName, swiftCode, isActive, isDefault } = req.body;

        bank.bankName = bankName || bank.bankName;
        bank.accountName = accountName || bank.accountName;
        bank.accountNumber = accountNumber || bank.accountNumber;
        bank.branchName = branchName || bank.branchName;
        bank.swiftCode = swiftCode || bank.swiftCode;
        bank.isActive = isActive !== undefined ? isActive : bank.isActive;
        bank.isDefault = isDefault !== undefined ? isDefault : bank.isDefault;

        await bank.save();
        res.json(bank);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete bank
// @route   DELETE /api/banks/:id
// @access  Private (Admin)
const deleteBank = async (req, res) => {
    try {
        const bank = await Bank.findById(req.params.id);
        if (!bank) {
            return res.status(404).json({ message: 'Bank not found' });
        }

        await bank.deleteOne();
        res.json({ message: 'Bank deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Set default bank
// @route   PUT /api/banks/:id/set-default
// @access  Private (Admin)
const setDefaultBank = async (req, res) => {
    try {
        // Remove default from all banks
        await Bank.updateMany({}, { isDefault: false });

        // Set this bank as default
        const bank = await Bank.findByIdAndUpdate(
            req.params.id,
            { isDefault: true },
            { new: true }
        );

        if (!bank) {
            return res.status(404).json({ message: 'Bank not found' });
        }

        res.json(bank);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getBanks,
    getBankById,
    getDefaultBank,
    createBank,
    updateBank,
    deleteBank,
    setDefaultBank
};
