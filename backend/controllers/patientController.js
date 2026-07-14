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

            // Count actual patients dynamically instead of relying on file.memberCount
            const actualCount = await Patient.countDocuments({ familyFile: familyFileId });
            if (linkedFamilyFile.type === 'Family of 5' && actualCount >= 5) {
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

        // Update member count dynamically if linked to a family file
        if (linkedFamilyFile) {
            const actualCount = await Patient.countDocuments({ familyFile: linkedFamilyFile._id });
            linkedFamilyFile.memberCount = actualCount;
            await linkedFamilyFile.save();
        }

        res.status(201).json(patient);
    } catch (error) {
        console.error('Error in registerPatient:', error);
        res.status(500).json({ message: error.message });
    }
};

const getHMOWalletBalance = async (hmoName) => {
    const HMO = require('../models/hmoModel');
    const HMOTransaction = require('../models/hmoTransactionModel');
    const EncounterCharge = require('../models/encounterChargeModel');
    const Patient = require('../models/patientModel');

    const hmo = await HMO.findOne({ name: hmoName });
    if (!hmo) return 0;

    const transactions = await HMOTransaction.find({ hmo: hmo._id });
    const totalDeposits = transactions
        .filter(t => t.type === 'deposit')
        .reduce((sum, d) => sum + d.amount, 0);

    const manualCharges = transactions
        .filter(t => t.type === 'charge')
        .reduce((sum, c) => sum + c.amount, 0);

    const refunds = transactions
        .filter(t => t.type === 'refund')
        .reduce((sum, r) => sum + r.amount, 0);

    const hmoPatients = await Patient.find({ hmo: hmo.name }).select('_id');
    const hmoPatientIds = hmoPatients.map(p => p._id);

    const charges = await EncounterCharge.find({
        patient: { $in: hmoPatientIds },
        hmoPortion: { $gt: 0 },
        status: 'paid'
    });
    const totalUtilized = charges.reduce((sum, c) => sum + c.hmoPortion, 0);

    return totalDeposits - (totalUtilized + manualCharges + refunds);
};

// @desc    Get all patients
// @route   GET /api/patients
// @access  Private
const getPatients = async (req, res) => {
    try {
        const { familyFile, search, provider, hmo, startDate, endDate } = req.query;
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit) || 5; // Default limit match frontend PATIENTS_PER_PAGE
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

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { mrn: { $regex: search, $options: 'i' } },
                { contact: { $regex: search, $options: 'i' } }
            ];
        }

        if (provider) {
            if (provider === 'Standard') {
                filter.$or = [
                    { provider: 'Standard' },
                    { provider: { $exists: false } },
                    { provider: null }
                ];
            } else {
                filter.provider = provider;
            }
        }

        if (hmo) {
            filter.hmo = hmo;
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) {
                filter.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        // Apply encounter restrictions for doctor searches
        if (req.user && req.user.role === 'doctor') {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date();
            endOfDay.setHours(23, 59, 59, 999);

            const Visit = require('../models/visitModel');
            const doctorClinicId = req.user.assignedSpecialityClinic?._id || req.user.assignedSpecialityClinic;
            const doctorId = req.user._id;

            // Find all patients who are currently active inpatients (so they shouldn't be excluded/restricted)
            const activeInpatients = await Visit.find({
                type: 'Inpatient',
                encounterStatus: { $in: ['admitted', 'in_ward', 'in_nursing', 'with_doctor', 'awaiting_services'] }
            }).select('patient');
            const activeInpatientIds = activeInpatients.map(v => v.patient?.toString()).filter(Boolean);

            // Find any active encounters today that this doctor is NOT permitted to see
            const restrictedVisits = await Visit.find({
                encounterStatus: { $nin: ['completed', 'cancelled', 'discharged'] },
                isActive: { $ne: false },
                $and: [
                    {
                        $or: [
                            { createdAt: { $gte: startOfDay, $lte: endOfDay } },
                            { isActive: true }
                        ]
                    },
                    {
                        $or: [
                            { needSpeciality: true, specialityClinic: { $ne: doctorClinicId } },
                            { needSpecificDoctor: true, specificDoctor: { $ne: doctorId } }
                        ]
                    }
                ]
            }).select('patient');

            const excludedPatientIds = restrictedVisits
                .map(v => v.patient?.toString())
                .filter(id => id && !activeInpatientIds.includes(id));

            if (excludedPatientIds.length > 0) {
                filter._id = { $nin: excludedPatientIds };
            }
        }

        if (page) {
            const skip = (page - 1) * limit;

            // Fetch overall total
            const total = await Patient.countDocuments({});
            // Fetch total count matching current filters
            const filteredCount = await Patient.countDocuments(filter);
            
            // Get stats counts matching current filters
            const maleCount = await Patient.countDocuments({ ...filter, gender: { $regex: /^male$/i } });
            const femaleCount = await Patient.countDocuments({ ...filter, gender: { $regex: /^female$/i } });

            // Fetch actual paginated patient documents
            const patients = await Patient.find(filter)
                .populate('familyFile')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            // Dynamically compute and overlay retainership wallet balance
            const populatedPatients = [];
            const hmoBalances = {};
            
            // Find unique HMO names of patients that need balance calculation
            const hmoNames = [...new Set(patients
                .filter(patient => ['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider) && patient.hmo)
                .map(patient => patient.hmo)
            )];

            // Compute balances in parallel
            await Promise.all(hmoNames.map(async (hmoName) => {
                hmoBalances[hmoName] = await getHMOWalletBalance(hmoName);
            }));

            for (let patient of patients) {
                let walletBalance = patient.depositBalance || 0;
                if (['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider) && patient.hmo) {
                    walletBalance = hmoBalances[patient.hmo] || 0;
                }
                const pObj = patient.toObject();
                pObj.depositBalance = walletBalance;
                populatedPatients.push(pObj);
            }

            res.json({
                patients: populatedPatients,
                total,
                filteredCount,
                maleCount,
                femaleCount,
                page,
                pages: Math.ceil(filteredCount / limit)
            });
        } else {
            // Unpaginated path (for backward compatibility / export)
            let query = Patient.find(filter);
            if (req.query.fields) {
                query = query.select(req.query.fields);
            } else {
                query = query.populate('familyFile');
            }
            const patients = await query.sort({ createdAt: -1 });

            // If we only requested specific fields and didn't request provider/hmo, skip HMO balances calculation
            if (req.query.fields && !req.query.fields.includes('hmo') && !req.query.fields.includes('provider')) {
                return res.json(patients);
            }

            // Dynamically compute and overlay retainership wallet balance
            const populatedPatients = [];
            const hmoBalances = {};
            
            // Find unique HMO names of patients that need balance calculation
            const hmoNames = [...new Set(patients
                .filter(patient => ['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider) && patient.hmo)
                .map(patient => patient.hmo)
            )];

            // Compute balances in parallel
            await Promise.all(hmoNames.map(async (hmoName) => {
                hmoBalances[hmoName] = await getHMOWalletBalance(hmoName);
            }));

            for (let patient of patients) {
                let walletBalance = patient.depositBalance || 0;
                if (['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider) && patient.hmo) {
                    walletBalance = hmoBalances[patient.hmo] || 0;
                }
                const pObj = patient.toObject();
                pObj.depositBalance = walletBalance;
                populatedPatients.push(pObj);
            }

            res.json(populatedPatients);
        }
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
            // Link to new family file
            if (newFamilyFileId) {
                const newFile = await FamilyFile.findById(newFamilyFileId);
                if (!newFile) {
                    return res.status(404).json({ message: 'New Family File not found' });
                }

                // Check actual count dynamically
                const actualCount = await Patient.countDocuments({ familyFile: newFile._id });
                if (newFile.type === 'Family of 5' && actualCount >= 5) {
                    return res.status(400).json({ message: 'This Family File has reached its limit of 5 members' });
                }

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

        // Update counts dynamically to ensure they are correct
        if (oldFamilyFileId && oldFamilyFileId !== newFamilyFileId) {
            const oldFile = await FamilyFile.findById(oldFamilyFileId);
            if (oldFile) {
                oldFile.memberCount = await Patient.countDocuments({ familyFile: oldFile._id });
                await oldFile.save();
            }
        }
        if (newFamilyFileId && oldFamilyFileId !== newFamilyFileId) {
            const newFile = await FamilyFile.findById(newFamilyFileId);
            if (newFile) {
                newFile.memberCount = await Patient.countDocuments({ familyFile: newFile._id });
                await newFile.save();
            }
        }

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

        const familyFileId = patient.familyFile;

        await patient.deleteOne();

        // Recount member count dynamically if linked to a family file
        if (familyFileId) {
            const familyFile = await FamilyFile.findById(familyFileId);
            if (familyFile) {
                familyFile.memberCount = await Patient.countDocuments({ familyFile: familyFile._id });
                await familyFile.save();
            }
        }

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
        const { amount, paymentMethod } = req.body;
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

        // Create a deposit receipt to appear in statements
        const Receipt = require('../models/receiptModel');
        const receiptNumber = `DEP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
        await Receipt.create({
            patient: patient._id,
            amountPaid: Number(amount),
            paymentMethod: paymentMethod || 'cash',
            cashier: req.user._id,
            receiptNumber,
            paymentDate: Date.now()
        });

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
            // Apply encounter restrictions for doctor searches
            if (req.user && req.user.role === 'doctor') {
                const startOfDay = new Date();
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date();
                endOfDay.setHours(23, 59, 59, 999);

                const Visit = require('../models/visitModel');

                // Check if patient is currently an active inpatient
                const isActiveInpatient = await Visit.findOne({
                    patient: patient._id,
                    type: 'Inpatient',
                    encounterStatus: { $in: ['admitted', 'in_ward', 'in_nursing', 'with_doctor', 'awaiting_services'] }
                });

                if (!isActiveInpatient) {
                    const doctorClinicId = req.user.assignedSpecialityClinic?._id || req.user.assignedSpecialityClinic;
                    const doctorId = req.user._id;

                    // Check if patient has any active restricted encounters today that this doctor cannot see
                    const restrictedVisit = await Visit.findOne({
                        patient: patient._id,
                        encounterStatus: { $nin: ['completed', 'cancelled', 'discharged'] },
                        isActive: { $ne: false },
                        $and: [
                            {
                                $or: [
                                    { createdAt: { $gte: startOfDay, $lte: endOfDay } },
                                    { isActive: true }
                                ]
                            },
                            {
                                $or: [
                                    { needSpeciality: true, specialityClinic: { $ne: doctorClinicId } },
                                    { needSpecificDoctor: true, specificDoctor: { $ne: doctorId } }
                                ]
                            }
                        ]
                    });

                    if (restrictedVisit) {
                        return res.status(403).json({ message: 'Access denied: Patient is restricted to a different speciality clinic or doctor today.' });
                    }
                }
            }

            let walletBalance = patient.depositBalance || 0;
            if (['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider) && patient.hmo) {
                walletBalance = await getHMOWalletBalance(patient.hmo);
            }
            const pObj = patient.toObject();
            pObj.depositBalance = walletBalance;
            res.json(pObj);
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
