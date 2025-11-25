const VitalSign = require('../models/vitalSignModel');

// @desc    Record vital signs
// @route   POST /api/vitals
// @access  Private (Nurse)
const createVitalSign = async (req, res) => {
    const { visitId, encounterId, patientId, bloodPressure, temperature, pulseRate, respiratoryRate, weight, height, spo2, notes } = req.body;

    const vital = await VitalSign.create({
        visit: visitId || encounterId,
        patient: patientId,
        nurse: req.user._id,
        bloodPressure,
        temperature,
        pulseRate,
        respiratoryRate,
        weight,
        height,
        spo2,
        notes,
    });

    res.status(201).json(vital);
};

// @desc    Get vitals for a visit
// @route   GET /api/vitals/visit/:id
// @access  Private
const getVitalsByVisit = async (req, res) => {
    const vitals = await VitalSign.find({ visit: req.params.id })
        .populate('nurse', 'name');
    res.json(vitals);
};

// @desc    Update vital signs
// @route   PUT /api/vitals/:id
// @access  Private (Nurse)
const updateVitalSign = async (req, res) => {
    try {
        const { bloodPressure, temperature, pulseRate, respiratoryRate, weight, height, spo2, notes } = req.body;

        const vital = await VitalSign.findById(req.params.id);

        if (!vital) {
            return res.status(404).json({ message: 'Vital sign record not found' });
        }

        // Update fields
        vital.bloodPressure = bloodPressure !== undefined ? bloodPressure : vital.bloodPressure;
        vital.temperature = temperature !== undefined ? temperature : vital.temperature;
        vital.pulseRate = pulseRate !== undefined ? pulseRate : vital.pulseRate;
        vital.respiratoryRate = respiratoryRate !== undefined ? respiratoryRate : vital.respiratoryRate;
        vital.weight = weight !== undefined ? weight : vital.weight;
        vital.height = height !== undefined ? height : vital.height;
        vital.spo2 = spo2 !== undefined ? spo2 : vital.spo2;
        vital.notes = notes !== undefined ? notes : vital.notes;

        const updatedVital = await vital.save();
        res.json(updatedVital);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createVitalSign,
    getVitalsByVisit,
    updateVitalSign,
};
