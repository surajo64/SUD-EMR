const RadiologyOrder = require('../models/radiologyOrderModel');
const Visit = require('../models/visitModel');

// @desc    Create new radiology order
// @route   POST /api/radiology
// @access  Private (Doctor or Radiologist for External Investigation)
const createRadiologyOrder = async (req, res) => {
    const { patientId, visitId, chargeId, scanType } = req.body;

    // Check permissions
    if (req.user.role === 'radiologist') {
        const visit = await Visit.findById(visitId);
        if (!visit || visit.type !== 'External Investigation') {
            return res.status(403).json({ message: 'Radiologists can only order for External Investigations.' });
        }
    } else if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Not authorized to order radiology.' });
    }

    const order = await RadiologyOrder.create({
        doctor: req.user._id,
        patient: patientId,
        visit: visitId,
        charge: chargeId,
        scanType,
    });

    res.status(201).json(order);
};

// @desc    Get all radiology orders
// @route   GET /api/radiology
// @access  Private
const getRadiologyOrders = async (req, res) => {
    const orders = await RadiologyOrder.find({})
        .populate('doctor', 'name')
        .populate('patient', 'name mrn')
        .populate('charge', 'status')
        .populate('signedBy', 'name');
    res.json(orders);
};

// @desc    Get radiology orders by visit
// @route   GET /api/radiology/visit/:id
// @access  Private
const getRadiologyOrdersByVisit = async (req, res) => {
    const orders = await RadiologyOrder.find({ visit: req.params.id })
        .populate('doctor', 'name')
        .populate('charge', 'status');
    res.json(orders);
};

// @desc    Update radiology report
// @route   PUT /api/radiology/:id/report
// @access  Private (Radiologist)
const updateRadiologyReport = async (req, res) => {
    const { report, resultImage } = req.body;
    const order = await RadiologyOrder.findById(req.params.id);

    if (order) {
        order.report = report;
        order.resultImage = resultImage;
        order.status = 'completed';
        order.signedBy = req.user._id;
        order.reportDate = new Date();
        const updatedOrder = await order.save();
        await updatedOrder.populate('signedBy', 'name');
        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

module.exports = {
    createRadiologyOrder,
    getRadiologyOrders,
    getRadiologyOrdersByVisit,
    updateRadiologyReport,
};
