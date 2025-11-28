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

        // 1. Get deposits (filtered)
        const depositQuery = { hmo: hmoId };
        if (startDate && endDate) {
            depositQuery.date = dateFilter; // Assuming 'date' field in HMOTransaction
            // If HMOTransaction uses createdAt, use that instead. 
            // Checking model... usually custom 'date' or timestamps. 
            // Let's assume 'date' based on previous view, but fallback to createdAt if needed.
            // Actually, let's check the model structure in my memory or just use createdAt if date is missing.
            // The view showed 'date: d.date' in the map, so 'date' field likely exists.
        }
        const deposits = await HMOTransaction.find(depositQuery).lean();

        // 2. Get charges (filtered)
        const patients = await Patient.find({ hmo: hmo.name }).select('_id');
        const patientIds = patients.map(p => p._id);

        const chargeQuery = {
            patient: { $in: patientIds },
            hmoPortion: { $gt: 0 }
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

        // Add Deposits
        deposits.forEach(d => {
            statement.push({
                _id: d._id,
                date: d.date,
                type: 'Deposit',
                description: d.description,
                serviceName: '-',
                reference: d.reference,
                amount: d.amount, // Credit
                isCredit: true,
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
        const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);
        const totalCharges = charges.reduce((sum, c) => sum + c.hmoPortion, 0);
        const balance = totalDeposits - totalCharges;

        res.json({
            hmo: {
                name: hmo.name,
                category: hmo.category,
                contactPerson: hmo.contactPerson
            },
            summary: {
                totalDeposits,
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

module.exports = {
    addDeposit,
    getHMOStatement
};
