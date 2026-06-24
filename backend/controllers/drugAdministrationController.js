const DrugAdministration = require('../models/drugAdministrationModel');

// @desc    Record a drug administration
// @route   POST /api/drug-administration
// @access  Private (Nurse/Admin)
const recordAdministration = async (req, res) => {
    try {
        const { visitId, patientId, prescriptionId, medicineId, medicineName, dosage, administeredAt, remarks } = req.body;

        if (!visitId || !patientId || !prescriptionId || !medicineId || !administeredAt) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        const record = await DrugAdministration.create({
            visit: visitId,
            patient: patientId,
            nurse: req.user._id,
            prescription: prescriptionId,
            medicineId,
            medicineName,
            dosage,
            administeredAt,
            remarks
        });

        res.status(201).json(record);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get administration history for a visit
// @route   GET /api/drug-administration/visit/:visitId
// @access  Private
const getAdministrationHistory = async (req, res) => {
    try {
        const history = await DrugAdministration.find({ visit: req.params.visitId })
            .populate('nurse', 'name')
            .sort({ administeredAt: 1 });
        res.json(history);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    recordAdministration,
    getAdministrationHistory
};
