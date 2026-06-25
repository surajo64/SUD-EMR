const Patient = require('../models/patientModel');
const FamilyFile = require('../models/familyFileModel');
const Receipt = require('../models/receiptModel');
const { generateMRN } = require('../utils/mrnGenerator');


// @desc    Register new patient
// @route   POST /api/patients
// @access  Private
const registerPatient = async (req, res) => {
    try {
        const { name, age, dateOfBirth, gender, contact, address, state, lga, medicalHistory, provider, hmo, insuranceNumber, emergencyContactName, emergencyContactPhone, isFamilyMember, familyFileId } = req.body;

        // Validation for Family File
        let linkedFamilyFile = null;
        if (isFamilyMember && familyFileId) {
            linkedFamilyFile = await FamilyFile.findById(familyFileId);
            if (!linkedFamilyFile) {
                return res.status(404).json({ message: 'Family File not found' });
            }

            if (linkedFamilyFile.type === 'Family of 5' && linkedFamilyFile.memberCount >= 5) {
                return res.status(400).json({ message: 'This Family File has reached its limit of 5 members' });
            }
        }

        // Generate MRN using new format: PREFIX-YEAR-0001
        const mrn = await generateMRN();

        const patientData = {
            mrn,
            name,
            age,
            dateOfBirth,
            gender,
            contact,
            address,
            state,
            lga,
            medicalHistory,
            provider,
            hmo,
            insuranceNumber,
            emergencyContactName,
            emergencyContactPhone,
            isFamilyMember: !!isFamilyMember,
            familyFile: familyFileId || undefined,
            registeredBy: req.user._id
        };

        const patient = await Patient.create(patientData);

        // Increment member count if linked to a family file
        if (linkedFamilyFile) {
            linkedFamilyFile.memberCount += 1;
            await linkedFamilyFile.save();
        }

        res.status(201).json(patient);
    } catch (error) {
        console.error('Error in registerPatient:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private
const getPatients = async (req, res) => {
    try {
        const { familyFile } = req.query;
        let filter = {};

        if (familyFile) {
            // If familyFile query is provided, we strictly filter by it
            const mongoose = require('mongoose');
            try {
                filter.familyFile = new mongoose.Types.ObjectId(familyFile);
            } catch (err) {
                // If invalid ID provided, return no patients rather than all
                return res.json([]);
            }
        }

        const patients = await Patient.find(filter).populate('familyFile');
        res.json(patients);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update patient
// @route   PUT /api/patients/:id
// @access  Private
const updatePatient = async (req, res) => {
    const patient = await Patient.findById(req.params.id);

    if (patient) {
        // Update basic info
        patient.name = req.body.name || patient.name;
        patient.age = req.body.age !== undefined ? req.body.age : patient.age;
        patient.dateOfBirth = req.body.dateOfBirth || patient.dateOfBirth;
        patient.gender = req.body.gender || patient.gender;
        patient.contact = req.body.contact || req.body.phoneNumber || patient.contact;
        patient.address = req.body.address || patient.address;
        patient.state = req.body.state || patient.state;
        patient.lga = req.body.lga || patient.lga;
        patient.mrn = req.body.mrn || patient.mrn;

        // Backfill MRN if missing
        if (!patient.mrn) {
            patient.mrn = `PAT${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;
        }

        // Update medical info
        patient.allergies = req.body.allergies || patient.allergies;
        patient.immunizations = req.body.immunizations || patient.immunizations;
        patient.pastSurgeries = req.body.pastSurgeries || patient.pastSurgeries;

        // Update insurance/provider info
        patient.provider = req.body.provider || patient.provider;
        patient.hmo = req.body.hmo || patient.hmo;
        patient.insuranceNumber = req.body.insuranceNumber || patient.insuranceNumber;

        // Handle Family File Update
        const oldFamilyFileId = patient.familyFile ? patient.familyFile.toString() : null;
        const newFamilyFileId = req.body.isFamilyMember ? req.body.familyFileId : null;

        if (oldFamilyFileId !== newFamilyFileId) {
            // Unlink from old family file
            if (oldFamilyFileId) {
                const oldFile = await FamilyFile.findById(oldFamilyFileId);
                if (oldFile) {
                    oldFile.memberCount = Math.max(0, oldFile.memberCount - 1);
                    await oldFile.save();
                }
            }

            // Link to new family file
            if (newFamilyFileId) {
                const newFile = await FamilyFile.findById(newFamilyFileId);
                if (!newFile) {
                    return res.status(404).json({ message: 'New Family File not found' });
                }

                if (newFile.type === 'Family of 5' && newFile.memberCount >= 5) {
                    return res.status(400).json({ message: 'This Family File has reached its limit of 5 members' });
                }

                newFile.memberCount += 1;
                await newFile.save();
                patient.familyFile = newFamilyFileId;
                patient.isFamilyMember = true;
            } else {
                patient.familyFile = undefined;
                patient.isFamilyMember = false;
            }
        } else if (req.body.isFamilyMember !== undefined) {
            // Even if ID hasn't changed, ensure the boolean flag is consistent
            patient.isFamilyMember = !!req.body.isFamilyMember;
            if (!patient.isFamilyMember) {
                // If checkbox was unchecked but ID was somehow same (e.g. null), ensure cleared
                patient.familyFile = undefined;
            }
        }

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
            patient.mrn = `PAT${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;
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

// @desc    Get patient by ID
// @route   GET /api/patients/:id
// @access  Private
const getPatientById = async (req, res) => {
    try {
        const patient = await Patient.findById(req.params.id).populate('familyFile');

        if (patient) {
            res.json(patient);
        } else {
            res.status(404).json({ message: 'Patient not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Refund deposit from patient account
// @route   POST /api/patients/:id/refund
// @access  Private
const refundDeposit = async (req, res) => {
    try {
        const { amount } = req.body;
        const patient = await Patient.findById(req.params.id);

        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        if ((patient.depositBalance || 0) < Number(amount)) {
            return res.status(400).json({ message: 'Insufficient deposit balance' });
        }

        patient.depositBalance = (patient.depositBalance || 0) - Number(amount);
        const updatedPatient = await patient.save();

        // Create a refund receipt to appear in statements
        const receiptNumber = `RFD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        await Receipt.create({
            patient: patient._id,
            amountPaid: -Number(amount), // Negative amount to reflect refund
            paymentMethod: 'refund',
            cashier: req.user._id,
            receiptNumber,
            paymentDate: Date.now()
        });

        res.json({
            message: 'Deposit refunded successfully',
            balance: updatedPatient.depositBalance,
            patient: updatedPatient
        });
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
    refundDeposit,
    getDepositBalance,
    getRecentPatients,
    getPatientById,
};
