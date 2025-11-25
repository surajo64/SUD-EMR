const Receipt = require('../models/receiptModel');
const Invoice = require('../models/invoiceModel');
const Patient = require('../models/patientModel');

// @desc    Create receipt (collect payment)
// @route   POST /api/receipts
// @access  Private (cashier)
const createReceipt = async (req, res) => {
    const { invoiceId, paymentMethod } = req.body;

    try {
        const invoice = await Invoice.findById(invoiceId).populate('patient');

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (invoice.status === 'paid') {
            return res.status(400).json({ message: 'Invoice already paid' });
        }

        // Generate unique receipt number: RCP-Timestamp-Random
        const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const receipt = await Receipt.create({
            invoice: invoiceId,
            patient: invoice.patient._id,
            amountPaid: invoice.totalAmount,
            paymentMethod: paymentMethod || invoice.paymentMethod,
            cashier: req.user._id,
            receiptNumber
        });

        // Mark invoice as paid
        invoice.status = 'paid';
        await invoice.save();

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate('invoice');

        res.status(201).json(populatedReceipt);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all receipts
// @route   GET /api/receipts
// @access  Private
const getReceipts = async (req, res) => {
    try {
        const receipts = await Receipt.find({})
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate('invoice')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            })
            .sort({ createdAt: -1 });
        res.json(receipts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get receipt by ID
// @route   GET /api/receipts/:id
// @access  Private
const getReceiptById = async (req, res) => {
    try {
        const receipt = await Receipt.findById(req.params.id)
            .populate('patient')
            .populate('cashier', 'name')
            .populate('invoice')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            });

        if (receipt) {
            res.json(receipt);
        } else {
            res.status(404).json({ message: 'Receipt not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// V5: @desc    Create receipt for encounter charges
// @route   POST /api/receipts/encounter
// @access  Private (cashier)
const createReceiptForCharges = async (req, res) => {
    const { encounterId, chargeIds, paymentMethod } = req.body;

    try {
        const EncounterCharge = require('../models/encounterChargeModel');
        const Visit = require('../models/visitModel');

        // Get all charges
        const charges = await EncounterCharge.find({ _id: { $in: chargeIds } })
            .populate('patient')
            .populate('charge');

        if (charges.length === 0) {
            return res.status(404).json({ message: 'No charges found' });
        }

        // Calculate total
        const totalAmount = charges.reduce((sum, charge) => sum + charge.totalAmount, 0);
        const patientId = charges[0].patient._id;

        // Debug logging
        console.log('=== PAYMENT DEBUG ===');
        console.log('Number of charges:', charges.length);
        console.log('Charge IDs:', chargeIds);
        charges.forEach((charge, index) => {
            console.log(`Charge ${index + 1}:`, {
                id: charge._id,
                name: charge.charge?.name,
                quantity: charge.quantity,
                totalAmount: charge.totalAmount
            });
        });
        console.log('Total Amount to deduct:', totalAmount);
        console.log('====================');

        // Handle Deposit Payment
        if (paymentMethod === 'deposit') {
            const patient = await Patient.findById(patientId);
            if (!patient) {
                return res.status(404).json({ message: 'Patient not found' });
            }
            console.log('Patient deposit before:', patient.depositBalance);
            if ((patient.depositBalance || 0) < totalAmount) {
                return res.status(400).json({
                    message: `Insufficient deposit balance. Balance: ₦${patient.depositBalance || 0}, Required: ₦${totalAmount}`
                });
            }

            // Deduct from deposit
            patient.depositBalance -= totalAmount;
            console.log('Patient deposit after:', patient.depositBalance);
            await patient.save();
        }

        // Generate receipt number
        const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create receipt
        const receipt = await Receipt.create({
            patient: patientId,
            encounter: encounterId,
            charges: chargeIds,
            amountPaid: totalAmount,
            paymentMethod: paymentMethod || 'cash',
            cashier: req.user._id,
            receiptNumber,
            validated: false
        });

        // Mark charges as paid and link receipt
        await EncounterCharge.updateMany(
            { _id: { $in: chargeIds } },
            { status: 'paid', receipt: receipt._id }
        );

        // Update encounter payment status
        await Visit.findByIdAndUpdate(encounterId, {
            paymentValidated: true,
            receiptNumber: receiptNumber,
            encounterStatus: 'in_nursing' // Move to next stage after payment
        });

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate('encounter')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            });

        res.status(201).json(populatedReceipt);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// V5: @desc    Validate receipt (for department access)
// @route   POST /api/receipts/validate
// @access  Private
const validateReceipt = async (req, res) => {
    const { receiptNumber, department } = req.body;

    try {
        const receipt = await Receipt.findOne({ receiptNumber })
            .populate('patient', 'name mrn')
            .populate('encounter')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            });

        if (!receipt) {
            return res.status(404).json({ valid: false, message: 'Receipt not found' });
        }

        // Check if already validated by this department
        const alreadyValidated = receipt.validatedBy?.some(v =>
            v.department === department && v.user.toString() === req.user._id.toString()
        );

        if (!alreadyValidated) {
            // Add validation record
            receipt.validatedBy.push({
                user: req.user._id,
                department,
                timestamp: Date.now()
            });
            receipt.validated = true;
            await receipt.save();
        }

        res.json({
            valid: true,
            receipt,
            message: 'Receipt validated successfully'
        });
    } catch (error) {
        res.status(500).json({ valid: false, message: error.message });
    }
};

// V5: @desc    Get receipt by receipt number
// @route   GET /api/receipts/number/:receiptNumber
// @access  Private
const getReceiptByNumber = async (req, res) => {
    try {
        const receipt = await Receipt.findOne({ receiptNumber: req.params.receiptNumber })
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate('encounter')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            });

        if (receipt) {
            res.json(receipt);
        } else {
            res.status(404).json({ message: 'Receipt not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reverse a receipt (refund payment)
// @route   POST /api/receipts/:id/reverse
// @access  Private (admin/cashier)
const reverseReceipt = async (req, res) => {
    try {
        const receipt = await Receipt.findById(req.params.id)
            .populate({ path: 'charges', populate: { path: 'charge' } })
            .populate('patient', 'name mrn depositBalance')
            .populate('cashier', 'name');

        if (!receipt) {
            return res.status(404).json({ message: 'Receipt not found' });
        }

        // If payment was made via deposit, restore the amount to patient's deposit
        if (receipt.paymentMethod === 'deposit') {
            const patient = await Patient.findById(receipt.patient._id);
            if (patient) {
                patient.depositBalance += receipt.amountPaid;
                await patient.save();
            }
        }

        // Mark the receipt as reversed (you could add a 'status' field to Receipt model)
        // For now, we'll delete it or you can add a status field
        await Receipt.findByIdAndDelete(req.params.id);

        res.json({
            message: 'Payment reversed successfully',
            amountReversed: receipt.amountPaid,
            depositRestored: receipt.paymentMethod === 'deposit'
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    createReceipt,
    getReceipts,
    getReceiptById,
    createReceiptForCharges,
    validateReceipt,
    getReceiptByNumber,
    reverseReceipt,
};
