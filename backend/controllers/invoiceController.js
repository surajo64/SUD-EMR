const Invoice = require('../models/invoiceModel');
const Patient = require('../models/patientModel');

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
const createInvoice = async (req, res) => {
    const { patientId, visitId, items, paymentMethod, feeType, department, generatedBy } = req.body;

    const totalAmount = items.reduce((acc, item) => acc + Number(item.cost), 0);

    const invoice = await Invoice.create({
        patient: patientId,
        visit: visitId,
        items,
        totalAmount,
        paymentMethod,
        feeType: feeType || 'other',
        department: department || 'General',
        generatedBy: generatedBy || req.user._id
    });

    res.status(201).json(invoice);
};

// @desc    Get all invoices
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res) => {
    const invoices = await Invoice.find({})
        .populate('patient', 'name mrn')
        .sort({ createdAt: -1 });
    res.json(invoices);
};

// @desc    Update invoice status (e.g. mark as paid)
// @route   PUT /api/invoices/:id/pay
// @access  Private
// @desc    Update invoice status (e.g. mark as paid)
// @route   PUT /api/invoices/:id/pay
// @access  Private
const updateInvoiceStatus = async (req, res) => {
    try {
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (req.body.paymentMethod === 'deposit') {
            const patient = await Patient.findById(invoice.patient);
            if (!patient) {
                return res.status(404).json({ message: 'Patient not found' });
            }
            if (patient.depositBalance < invoice.totalAmount) {
                return res.status(400).json({ message: 'Insufficient deposit balance' });
            }
            patient.depositBalance -= invoice.totalAmount;
            await patient.save();
            invoice.paymentMethod = 'deposit';
        }

        invoice.status = 'paid';
        const updatedInvoice = await invoice.save();
        res.json(updatedInvoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reverse invoice (Refund)
// @route   PUT /api/invoices/:id/reverse
// @access  Private (Admin/Manager)
const reverseInvoice = async (req, res) => {
    try {
        const { reason } = req.body;
        const invoice = await Invoice.findById(req.params.id);

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (invoice.isReversed) {
            return res.status(400).json({ message: 'Invoice already reversed' });
        }

        // Refund to deposit if paid by deposit
        if (invoice.status === 'paid' && invoice.paymentMethod === 'deposit') {
            const patient = await Patient.findById(invoice.patient);
            if (patient) {
                patient.depositBalance += invoice.totalAmount;
                await patient.save();
            }
        }

        invoice.status = 'reversed';
        invoice.isReversed = true;
        invoice.reversalReason = reason || 'Administrative Action';
        invoice.reversedAt = Date.now();
        invoice.reversedBy = req.user._id;

        const updatedInvoice = await invoice.save();
        res.json(updatedInvoice);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Bulk pay insurance invoices
// @route   POST /api/invoices/bulk-pay-insurance
// @access  Private
const bulkPayInsurance = async (req, res) => {
    try {
        const { invoiceIds } = req.body; // Array of IDs

        if (!invoiceIds || invoiceIds.length === 0) {
            return res.status(400).json({ message: 'No invoices selected' });
        }

        const result = await Invoice.updateMany(
            { _id: { $in: invoiceIds }, status: 'pending' },
            {
                $set: {
                    status: 'paid',
                    paymentMethod: 'insurance'
                }
            }
        );

        res.json({ message: `Successfully processed ${result.modifiedCount} invoices` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createInvoice,
    getInvoices,
    updateInvoiceStatus,
    reverseInvoice,
    bulkPayInsurance
};
