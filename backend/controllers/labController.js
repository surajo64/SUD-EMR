const LabOrder = require('../models/labOrderModel');

// @desc    Create new lab order
// @route   POST /api/lab
// @access  Private (Doctor)
const Visit = require('../models/visitModel');

// @desc    Create new lab order
// @route   POST /api/lab
// @access  Private (Doctor or Lab Tech for External)
const createLabOrder = async (req, res) => {
    const { patientId, visitId, chargeId, testName, notes } = req.body;

    // Check permissions
    if (req.user.role === 'lab_technician') {
        const visit = await Visit.findById(visitId);
        if (!visit || visit.type !== 'External Investigation') {
            return res.status(403).json({ message: 'Lab Technicians can only order for External Investigations.' });
        }
    } else if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Not authorized to order labs.' });
    }

    const order = await LabOrder.create({
        doctor: req.user._id, // In this case, the "doctor" field tracks who ordered it
        patient: patientId,
        visit: visitId,
        charge: chargeId,
        testName,
        notes,
    });

    res.status(201).json(order);
};

// @desc    Get all lab orders
// @route   GET /api/lab
// @access  Private
const getLabOrders = async (req, res) => {
    const orders = await LabOrder.find({})
        .populate('doctor', 'name')
        .populate('patient', 'name mrn')
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
    const orders = await LabOrder.find({ visit: req.params.id })
        .populate('doctor', 'name')
        .populate('charge', 'status')
        .populate('signedBy', 'name')
        .populate('lastModifiedBy', 'name')
        .populate('approvedBy', 'name');
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

        if (isFirstSave) {
            // First time signing the result
            order.signedBy = req.user._id;
            order.signedAt = new Date();
        } else {
            // Editing existing result
            order.lastModifiedBy = req.user._id;
            order.lastModifiedAt = new Date();
        }

        const updatedOrder = await order.save();

        // Populate user info before sending response
        await updatedOrder.populate('patient', 'name mrn');
        await updatedOrder.populate('signedBy', 'name');
        await updatedOrder.populate('lastModifiedBy', 'name');
        await updatedOrder.populate('approvedBy', 'name');

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

module.exports = {
    createLabOrder,
    getLabOrders,
    getLabOrdersByVisit,
    updateLabResult,
    approveLabResult,
};
