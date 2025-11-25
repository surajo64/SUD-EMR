const Patient = require('../models/patientModel');

// @desc    Register new patient
// @route   POST /api/patients
// @access  Private
const registerPatient = async (req, res) => {
    const { name, age, gender, contact, address, medicalHistory, insuranceProvider, policyNumber, emergencyContactName, emergencyContactPhone } = req.body;

    // Generate MRN: PAT-Timestamp-Random
    const mrn = `PAT-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const patient = await Patient.create({
        mrn,
        name,
        age,
        gender,
        contact,
        address,
        medicalHistory,
        insuranceProvider,
        policyNumber,
        emergencyContactName,
        emergencyContactPhone
    });

    res.status(201).json(patient);
};

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private
const getPatients = async (req, res) => {
    const patients = await Patient.find({});
    res.json(patients);
};

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Private
const updatePatient = async (req, res) => {
    const patient = await Patient.findById(req.params.id);

    if (patient) {
        // Update basic info
        patient.name = req.body.name || patient.name;
        patient.age = req.body.age || patient.age;
        patient.gender = req.body.gender || patient.gender;
        patient.contact = req.body.contact || req.body.phoneNumber || patient.contact;
        patient.address = req.body.address || patient.address;
        patient.mrn = req.body.mrn || patient.mrn;

        // Backfill MRN if missing
        if (!patient.mrn) {
            patient.mrn = `PAT-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // Update medical info
        patient.allergies = req.body.allergies || patient.allergies;
        patient.immunizations = req.body.immunizations || patient.immunizations;
        patient.pastSurgeries = req.body.pastSurgeries || patient.pastSurgeries;

        // Update insurance info
        patient.insuranceProvider = req.body.insuranceProvider || patient.insuranceProvider;
        patient.policyNumber = req.body.policyNumber || patient.policyNumber;

        const updatedPatient = await patient.save();
        res.json(updatedPatient);
    } else {
        res.status(404).json({ message: 'Patient not found' });
    }
};

// @desc    Delete patient (Admin only)
// @route   DELETE /api/patients/:id
// @access  Private (Admin)
const deletePatient = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        await patient.deleteOne();
        res.json({ message: 'Patient deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Add deposit to patient account
// @route   POST /api/patients/:id/deposit
// @access  Private
const addDeposit = async (req, res) => {
    try {
        const { amount } = req.body;
        const patient = await Patient.findById(req.params.id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Backfill MRN if missing (to fix legacy data issues)
        if (!patient.mrn) {
            patient.mrn = `PAT-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        }

        patient.depositBalance = (patient.depositBalance || 0) + Number(amount);
        const updatedPatient = await patient.save();

        res.json({
            message: 'Deposit added successfully',
            balance: updatedPatient.depositBalance,
            patient: updatedPatient
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get patient deposit balance
// @route   GET /api/patients/:id/deposit
// @access  Private
const getDepositBalance = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        res.json({
            balance: patient.depositBalance || 0,
            threshold: patient.lowDepositThreshold || 5000
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get recent patients (last 5)
// @route   GET /api/patients/recent
// @access  Private
const getRecentPatients = async (req, res) => {
    try {
        const recentPatients = await Patient.find({})
            .sort({ updatedAt: -1 })
            .limit(5);

        res.json(recentPatients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    registerPatient,
    getPatients,
    updatePatient,
    deletePatient,
    addDeposit,
    getDepositBalance,
    getRecentPatients,
};
