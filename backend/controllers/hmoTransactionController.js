const HMOTransaction = require('../models/hmoTransactionModel');
const HMO = require('../models/hmoModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Visit = require('../models/visitModel');
const Patient = require('../models/patientModel');

// @desc    Add a deposit for an HMO
// @route   POST /api/hmo-transactions/deposit
// @access  Private
const addDeposit = async (req, res) => {
    try {
        const { hmoId, amount, description, reference } = req.body;

        const hmo = await HMO.findById(hmoId);
        if (!hmo) {
            return res.status(404).json({ message: 'HMO not found' });
        }

        const transaction = await HMOTransaction.create({
            hmo: hmoId,
            type: 'deposit',
            amount,
            description,
            reference,
            recordedBy: req.user._id
        });

        res.status(201).json(transaction);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get HMO Statement (Deposits & Charges)
// @route   GET /api/hmo-transactions/statement/:hmoId
// @access  Private
const getHMOStatement = async (req, res) => {
    try {
        const { hmoId } = req.params;
        const { startDate, endDate } = req.query;
        const hmo = await HMO.findById(hmoId);

        if (!hmo) {
            return res.status(404).json({ message: 'HMO not found' });
        }

        // Date Filter Construction
        let dateFilter = {};
        if (startDate && endDate) {
            dateFilter = {
                $gte: new Date(startDate),
                $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999))
            };
        }

        // 1. Get HMO Transactions (Deposits, Manual Charges, Refunds)
        const depositQuery = { hmo: hmoId };
        if (startDate && endDate) {
            depositQuery.date = dateFilter;
        }
        const deposits = await HMOTransaction.find(depositQuery).lean();

        // 2. Get charges (filtered)
        const patients = await Patient.find({ hmo: hmo.name }).select('_id');
        const patientIds = patients.map(p => p._id);

        const chargeQuery = {
            patient: { $in: patientIds },
            hmoPortion: { $gt: 0 },
            status: 'paid'
        };

        if (startDate && endDate) {
            chargeQuery.createdAt = dateFilter;
        }

        const charges = await EncounterCharge.find(chargeQuery)
            .populate('patient', 'name mrn')
            .populate('encounter', 'createdAt type')
            .populate('charge', 'name')
            .lean();

        // 3. Merge and Format
        const statement = [];

        // MERGE: Add Deposits AND Manual Charges
        deposits.forEach(d => {
            statement.push({
                _id: d._id,
                date: d.date,
                type: d.type === 'deposit' ? 'Deposit' : 'Charge',
                description: d.description,
                serviceName: '-',
                reference: d.reference,
                amount: d.amount,
                isCredit: d.type === 'deposit',
                patientName: '-'
            });
        });

        // Add Charges
        charges.forEach(c => {
            statement.push({
                _id: c._id,
                date: c.createdAt,
                type: 'Service',
                description: c.itemType || 'Service',
                serviceName: c.itemName || c.charge?.name || 'N/A',
                reference: c.encounter?.type || 'Encounter',
                amount: c.hmoPortion, // Debit
                isCredit: false,
                patientName: c.patient?.name || 'Unknown'
            });
        });

        // Sort by date descending
        statement.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Calculate Summary
        const totalDeposits = deposits
            .filter(d => d.type === 'deposit')
            .reduce((sum, d) => sum + d.amount, 0);

        const manualCharges = deposits
            .filter(d => d.type === 'charge')
            .reduce((sum, d) => sum + d.amount, 0);

        const refunds = deposits
            .filter(d => d.type === 'refund')
            .reduce((sum, d) => sum + d.amount, 0);

        const totalUtilized = charges.reduce((sum, c) => sum + c.hmoPortion, 0);
        const totalCharges = totalUtilized + manualCharges;
        const balance = totalDeposits - (totalCharges + refunds);

        res.json({
            hmo: {
                name: hmo.name,
                category: hmo.category,
                contactPerson: hmo.contactPerson
            },
            summary: {
                totalDeposits,
                totalUtilized,
                manualCharges,
                totalCharges,
                balance
            },
            transactions: statement
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Total Retainership HMO Balance
// @route   GET /api/hmo-transactions/total-retainership-balance
// @access  Private
const getTotalRetainershipBalance = async (req, res) => {
    try {
        // 1. Get all Retainership HMOs
        const retainershipHMOs = await HMO.find({ category: 'Retainership', active: true });
        const hmoIds = retainershipHMOs.map(h => h._id);
        const hmoNames = retainershipHMOs.map(h => h.name);

        // 2. Sum deposits for these HMOs
        const deposits = await HMOTransaction.find({ hmo: { $in: hmoIds }, type: 'deposit' });
        const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

        // 2.5 Sum manual charges for these HMOs
        const manualCharges = await HMOTransaction.find({ hmo: { $in: hmoIds }, type: 'charge' });
        const totalManualCharges = manualCharges.reduce((sum, c) => sum + c.amount, 0);

        // 3. Sum utilized charges for patients belonging to these HMOs
        const patients = await Patient.find({ hmo: { $in: hmoNames } }).select('_id');
        const patientIds = patients.map(p => p._id);

        const charges = await EncounterCharge.find({
            patient: { $in: patientIds },
            hmoPortion: { $gt: 0 },
            status: 'paid'
        });
        const totalCharges = charges.reduce((sum, c) => sum + c.hmoPortion, 0) + totalManualCharges;

        const balance = totalDeposits - totalCharges;

        res.json({
            totalDeposits,
            totalCharges,
            balance
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get deposit status for every active Retainership HMO
// @route   GET /api/hmo-transactions/retainership-deposit-status
// @access  Private
const getRetainershipDepositStatus = async (req, res) => {
    try {
        const retainershipHMOs = await HMO.find({ category: 'Retainership', active: true }).lean();

        // For each HMO, check if at least one deposit transaction exists
        const result = await Promise.all(
            retainershipHMOs.map(async (hmo) => {
                const depositCount = await HMOTransaction.countDocuments({
                    hmo: hmo._id,
                    type: 'deposit'
                });
                return {
                    _id: hmo._id,
                    name: hmo.name,
                    hasDeposit: depositCount > 0
                };
            })
        );

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update an HMO Transaction
// @route   PUT /api/hmo-transactions/:id
// @access  Private (Admin)
const updateHMOTransaction = async (req, res) => {
    try {
        const { amount, description, reference, date } = req.body;
        const transaction = await HMOTransaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        if (amount !== undefined) transaction.amount = amount;
        if (description !== undefined) transaction.description = description;
        if (reference !== undefined) transaction.reference = reference;
        if (date !== undefined) transaction.date = date;

        const updatedTransaction = await transaction.save();
        res.json(updatedTransaction);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete an HMO Transaction
// @route   DELETE /api/hmo-transactions/:id
// @access  Private (Admin)
const deleteHMOTransaction = async (req, res) => {
    try {
        const transaction = await HMOTransaction.findById(req.params.id);

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        await transaction.deleteOne();
        res.json({ message: 'Transaction removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    addDeposit,
    getHMOStatement,
    getTotalRetainershipBalance,
    getRetainershipDepositStatus,
    updateHMOTransaction,
    deleteHMOTransaction
};
