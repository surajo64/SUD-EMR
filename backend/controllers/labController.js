const LabOrder = require('../models/labOrderModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Patient = require('../models/patientModel');
const Visit = require('../models/visitModel');
const Receipt = require('../models/receiptModel');
const Charge = require('../models/chargeModel');

// @desc    Create new lab order
// @route   POST /api/lab
// @access  Private (Doctor or Lab Tech for External)
// @access  Private (Doctor or Lab Tech for External)
const createLabOrder = async (req, res) => {
    const { patientId, visitId, chargeId, testName, notes, clinicalDetails } = req.body;
    console.log('Creating Lab Order - req.body:', { testName, clinicalDetails });

    // Check permissions
    if (req.user.role === 'lab_technician' || req.user.role === 'lab_scientist') {
        const visit = await Visit.findById(visitId);
        if (!visit || (visit.type !== 'External Investigation' && visit.type !== 'External Lab/Radiology')) {
            return res.status(403).json({ message: 'Lab staff can only order for External Investigations.' });
        }
    } else if (req.user.role === 'doctor') {
        // Check for unpaid consultation charges
        const charges = await EncounterCharge.find({ encounter: visitId }).populate('charge');
        const hasUnpaid = charges.some(c => c.charge && c.charge.type === 'consultation' && c.status === 'pending');
        if (hasUnpaid) {
            return res.status(402).json({ message: 'Access denied: Patient has unpaid consultation charges. Please direct them to the cashier.' });
        }
    } else {
        return res.status(403).json({ message: 'Not authorized to order labs.' });
    }

    // Fetch the charge to get its specialization
    let labSpecialization = null;
    if (chargeId) {
        const encounterCharge = await EncounterCharge.findById(chargeId).populate('charge');
        if (encounterCharge && encounterCharge.charge) {
            labSpecialization = encounterCharge.charge.labSpecialization;
        }
    }

    const order = await LabOrder.create({
        doctor: req.user._id, // In this case, the "doctor" field tracks who ordered it
        patient: patientId,
        visit: visitId,
        charge: chargeId,
        testName,
        labSpecialization,
        notes,
        clinicalDetails,
    });

    res.status(201).json(order);
};

// @desc    Get all lab orders
// @route   GET /api/lab
// @access  Private
const getLabOrders = async (req, res) => {
    // Show all lab orders for the dashboard view to provide patient context
    // Approval restrictions are handled separately in the approveLabResult function
    let query = {};

    const orders = await LabOrder.find(query)
        .populate('doctor', 'name')
        .populate('patient', 'name mrn contact age gender')
        .populate('visit', 'type createdAt')
        .populate('charge', 'status')
        .populate('signedBy', 'name')
        .populate('lastModifiedBy', 'name')
        .populate('approvedBy', 'name');
    res.json(orders);
};

// @desc    Get lab orders by visit
// @route   GET /api/lab/visit/:id
// @access  Private
const getLabOrdersByVisit = async (req, res) => {
    let query = { visit: req.params.id };

    // Filter by specialization for lab technicians and scientists
    if (req.user.role === 'lab_technician' || req.user.role === 'lab_scientist') {
        if (req.user.labSpecialization === 'All Lab Test') {
            query = { visit: req.params.id };
        } else {
            query = {
                $and: [
                    { visit: req.params.id },
                    {
                        $or: [
                            { labSpecialization: req.user.labSpecialization },
                            { labSpecialization: { $exists: false } },
                            { labSpecialization: null },
                            { labSpecialization: '' }
                        ]
                    }
                ]
            };
        }
    }

    const orders = await LabOrder.find(query)
        .populate('patient', 'name mrn contact age gender')
        .populate('doctor', 'name')
        .populate('charge', 'status')
        .populate('signedBy', 'name')
        .populate('lastModifiedBy', 'name')
        .populate('approvedBy', 'name')
        .populate('rejectedBy', 'name')
        .populate('visit', 'type createdAt')
        .sort({ createdAt: -1 });
    res.json(orders);
};

// @desc    Update lab result
// @route   PUT /api/lab/:id/result
// @access  Private (Lab Tech)
const updateLabResult = async (req, res) => {
    const { result } = req.body;
    const order = await LabOrder.findById(req.params.id);

    if (order) {
        const isFirstSave = !order.result || order.status === 'pending';

        order.result = result;
        order.status = 'completed';
        // Keep rejection history for auditing

        if (isFirstSave) {
            // First time signing the result
            order.signedBy = req.user._id;
            order.signedAt = new Date();
        } else {
            // Editing existing result
            order.lastModifiedBy = req.user._id;
            order.lastModifiedAt = new Date();
        }

        await order.save();

        // Re-fetch with full population for audit trail
        const updatedOrder = await LabOrder.findById(order._id)
            .populate('patient', 'name mrn')
            .populate('signedBy', 'name')
            .populate('lastModifiedBy', 'name')
            .populate('approvedBy', 'name')
            .populate('rejectedBy', 'name');

        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Approve lab result
// @route   PUT /api/lab/:id/approve
// @access  Private (Lab Scientist)
const approveLabResult = async (req, res) => {
    const order = await LabOrder.findById(req.params.id);

    if (order) {
        if (req.user.role !== 'lab_scientist') {
            return res.status(403).json({ message: 'Only Lab Scientists can approve results.' });
        }

        // Specialization check
        if (req.user.labSpecialization !== 'All Lab Test' &&
            order.labSpecialization &&
            order.labSpecialization !== req.user.labSpecialization) {
            return res.status(403).json({ message: `This test requires ${order.labSpecialization} specialization to approve.` });
        }

        // Mutual approval check: A scientist cannot approve a result they entered themselves
        if (order.signedBy && order.signedBy.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot approve a result you entered yourself. Another Lab Scientist must review it.' });
        }

        order.approvedBy = req.user._id;
        order.approvedAt = new Date();

        const updatedOrder = await order.save();

        await updatedOrder.populate('patient', 'name mrn');
        await updatedOrder.populate('signedBy', 'name');
        await updatedOrder.populate('approvedBy', 'name');

        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Reject lab result
// @route   PUT /api/lab/:id/reject
// @access  Private (Lab Scientist)
const rejectLabResult = async (req, res) => {
    const { reason } = req.body;
    const order = await LabOrder.findById(req.params.id);

    if (order) {
        if (req.user.role !== 'lab_scientist') {
            return res.status(403).json({ message: 'Only Lab Scientists can reject results.' });
        }

        // Specialization check
        if (req.user.labSpecialization !== 'All Lab Test' &&
            order.labSpecialization &&
            order.labSpecialization !== req.user.labSpecialization) {
            return res.status(403).json({ message: `This test requires ${order.labSpecialization} specialization to reject.` });
        }

        // Mutual exclusion check: Cannot reject own result
        if (order.signedBy && order.signedBy.toString() === req.user._id.toString()) {
            return res.status(400).json({ message: 'You cannot reject a result you entered yourself. Another Lab Scientist must review it.' });
        }

        // Formalize rejection: Reset status, record who and when
        order.status = 'rejected';
        order.rejectionReason = reason;
        order.rejectedBy = req.user._id;
        order.rejectedAt = new Date();

        // Keep signedBy but clear approvedBy if any
        order.approvedBy = null;
        order.approvedAt = null;

        await order.save();
        const updatedOrder = await LabOrder.findById(order._id)
            .populate('signedBy', 'name')
            .populate('rejectedBy', 'name');

        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Delete lab order
// @route   DELETE /api/lab/:id
// @access  Private (Doctor or Admin)
const deleteLabOrder = async (req, res) => {
    const order = await LabOrder.findById(req.params.id);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    // Verify permissions: Only Admin or the Doctor who created the order
    if (req.user.role !== 'admin' && order.doctor.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this order.' });
    }

    // Check if there's an associated charge
    if (order.charge) {
        const encounterCharge = await EncounterCharge.findById(order.charge);
        if (encounterCharge) {
            if (encounterCharge.status !== 'pending') {
                return res.status(400).json({ message: 'Cannot delete order because the charge has already been processed (paid or cancelled).' });
            }
            // Delete the encounter charge
            await encounterCharge.deleteOne();
        }
    }

    await order.deleteOne();
    res.json({ message: 'Lab order and associated pending charge deleted.' });
};

// @desc    Process a direct/walk-in POS sale at Laboratory
// @route   POST /api/lab/pos-sale
// @access  Private (Lab Scientist/Technician)
const processDirectSale = async (req, res) => {
    try {
        const { customerName, age, gender, items, discount, tax, paymentMethod } = req.body;
        // items: [{ chargeId, name, price, specialization }]

        if (!customerName || !customerName.trim()) {
            return res.status(400).json({ message: 'Customer name is required.' });
        }

        if (!age || isNaN(age)) {
            return res.status(400).json({ message: 'Age is required and must be a number.' });
        }

        if (!gender) {
            return res.status(400).json({ message: 'Gender is required.' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No items selected.' });
        }

        // ── 1. Create walk-in patient ──────────────────────────────
        const currentYear = new Date().getFullYear();
        const prefix = `LAB-${currentYear}-`;

        // Find the latest patient with similar MRN prefix
        const lastPatient = await Patient.findOne({ mrn: new RegExp(`^${prefix}`) })
            .sort({ mrn: -1 })
            .limit(1);

        let sequence = 1;
        if (lastPatient) {
            const parts = lastPatient.mrn.split('-');
            if (parts.length === 3) {
                const lastSequence = parseInt(parts[2]);
                if (!isNaN(lastSequence)) {
                    sequence = lastSequence + 1;
                }
            }
        }

        const walkInMrn = `${prefix}${sequence.toString().padStart(4, '0')}`;
        const walkInPatient = await Patient.create({
            mrn: walkInMrn,
            name: customerName.trim(),
            age: Number(age),
            gender: gender,
            contact: 'Walk-in',
            provider: 'Standard',
            depositBalance: 0
        });

        // ── 2. Create Visit ──────────────────────────────────────────
        const walkInVisit = await Visit.create({
            patient: walkInPatient._id,
            doctor: req.user._id,
            type: 'External Lab',
            status: 'Discharged',
            encounterStatus: 'completed',
            paymentValidated: true,
            reasonForVisit: 'Direct Lab Purchase (POS)'
        });

        const createdChargeIds = [];
        let subtotal = 0;

        // ── 3. Create Charges & Lab Orders ──────────────────────────
        for (const item of items) {
            const { chargeId, name, price, specialization } = item;
            const totalItemAmount = parseFloat(price);
            subtotal += totalItemAmount;

            const encounterCharge = await EncounterCharge.create({
                encounter: walkInVisit._id,
                patient: walkInPatient._id,
                charge: chargeId,
                quantity: 1,
                unitPrice: price,
                totalAmount: totalItemAmount,
                patientPortion: totalItemAmount,
                hmoPortion: 0,
                status: 'paid',
                addedBy: req.user._id,
                itemType: 'Lab',
                itemName: name,
                department: 'Lab'
            });

            createdChargeIds.push(encounterCharge._id);

            // Create Lab Order
            await LabOrder.create({
                doctor: req.user._id,
                patient: walkInPatient._id,
                visit: walkInVisit._id,
                charge: encounterCharge._id,
                testName: name,
                labSpecialization: specialization || req.user.labSpecialization || 'All Lab Test',
                status: 'pending'
            });
        }

        // ── 4. Apply discount and tax ──────────────────────────────────────────
        const discountAmt = parseFloat(discount) || 0;
        const taxAmt = parseFloat(tax) || 0;
        const totalAmount = subtotal - discountAmt + taxAmt;

        // ── 5. Create Receipt ─────────────────────────────────────────
        const receiptNumber = `POS-LAB-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const receipt = await Receipt.create({
            patient: walkInPatient._id,
            encounter: walkInVisit._id,
            charges: createdChargeIds,
            amountPaid: totalAmount < 0 ? 0 : totalAmount,
            paymentMethod: paymentMethod || 'cash',
            cashier: req.user._id,
            receiptNumber,
            validated: true,
            validatedBy: [{
                user: req.user._id,
                department: 'Lab',
                timestamp: new Date()
            }]
        });

        // ── 6. Link receipt on charges ─────────────────────────────────────────
        await EncounterCharge.updateMany(
            { _id: { $in: createdChargeIds } },
            { receipt: receipt._id }
        );

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate({
                path: 'charges',
                select: 'itemName quantity unitPrice totalAmount'
            });

        res.status(201).json({
            message: 'Sale completed successfully',
            receipt: populatedReceipt,
            receiptNumber,
            totalAmount: totalAmount < 0 ? 0 : totalAmount
        });

    } catch (error) {
        console.error('Lab POS Sale Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createLabOrder,
    getLabOrders,
    getLabOrdersByVisit,
    updateLabResult,
    approveLabResult,
    rejectLabResult,
    deleteLabOrder,
    processDirectSale,
};
