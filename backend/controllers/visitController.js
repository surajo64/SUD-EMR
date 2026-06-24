// models
const Visit = require('../models/visitModel');

// @desc    Create new visit (Check-in)
// @route   POST /api/visits
// @access  Private
const createVisit = async (req, res) => {
    const { patientId, appointmentId, type, clinic, encounterType, reasonForVisit, ward, bed, isANC } = req.body;

    // Check for existing visit today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existingVisit = await Visit.findOne({
        patient: patientId,
        createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    if (existingVisit) {
        return res.status(400).json({ message: 'An encounter already exists for this patient today.' });
    }

    // Inpatient Logic
    let wardDoc = null;
    if (type === 'Inpatient') {
        if (!ward || !bed) {
            return res.status(400).json({ message: 'Ward and Bed are required for Inpatient encounters.' });
        }

        const Ward = require('../models/wardModel');
        wardDoc = await Ward.findById(ward);

        if (!wardDoc) {
            return res.status(404).json({ message: 'Ward not found' });
        }

        const bedIndex = wardDoc.beds.findIndex(b => b.number === bed);
        if (bedIndex === -1) {
            return res.status(404).json({ message: 'Bed not found in ward' });
        }

        if (wardDoc.beds[bedIndex].isOccupied) {
            return res.status(400).json({ message: 'Selected bed is already occupied' });
        }

        // Occupy Bed
        wardDoc.beds[bedIndex].isOccupied = true;
        wardDoc.beds[bedIndex].occupiedBy = patientId;
        await wardDoc.save();
    }

    const visit = await Visit.create({
        doctor: req.user._id,
        patient: patientId,
        appointment: appointmentId,
        type,
        clinic,
        encounterType: encounterType || type,
        admissionDate: type === 'Inpatient' ? new Date() : undefined,
        ward: type === 'Inpatient' ? ward : undefined,
        bed: type === 'Inpatient' ? bed : undefined,
        paymentValidated: ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(type),
        encounterStatus: ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(type) 
            ? 'awaiting_services' 
            : (type === 'Inpatient' ? 'admitted' : (req.body.encounterStatus || 'registered')),
        status: type === 'Inpatient' ? 'Admitted' : 'In Progress',
        reasonForVisit,
        isANC: !!isANC
    });

    // Apply Initial Ward Charge for Inpatient
    if (type === 'Inpatient' && wardDoc) {
        // Fetch patient to get provider
        const Patient = require('../models/patientModel');
        const patient = await Patient.findById(patientId);

        let dailyFee = wardDoc.dailyRate; // Default fallback

        if (patient && patient.provider && wardDoc.rates && wardDoc.rates[patient.provider]) {
            dailyFee = wardDoc.rates[patient.provider];
        } else if (wardDoc.rates && wardDoc.rates.Standard) {
            dailyFee = wardDoc.rates.Standard;
        }

        if (dailyFee > 0) {
            const EncounterCharge = require('../models/encounterChargeModel');
            await EncounterCharge.create({
                encounter: visit._id,
                patient: patientId,
                itemType: 'Daily Bed Fee',
                itemName: `Initial Ward Charge - ${wardDoc.name} (${patient.provider || 'Standard'})`,
                cost: dailyFee,
                quantity: 1,
                totalAmount: dailyFee,
                status: 'pending',
                addedBy: req.user._id
            });
        }
    }

    res.status(201).json(visit);
};

// @desc    Get all visits
// @route   GET /api/visits
// @access  Private
const getVisits = async (req, res) => {
    const { type, encounterStatus, status, patient, today: isToday } = req.query;
    let query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (patient && patient !== 'undefined') query.patient = patient;
    
    if (isToday === 'true') {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: startOfDay, $lte: endOfDay };
        
        // When asking for today's patients, usually we mean active ones
        // Exclude terminal statuses unless explicitly requested
        if (!encounterStatus) {
            query.encounterStatus = { $nin: ['completed', 'discharged', 'cancelled'] };
        }
    }

    if (encounterStatus) {
        if (encounterStatus.includes(',')) {
            query.encounterStatus = { $in: encounterStatus.split(',') };
        } else {
            query.encounterStatus = encounterStatus;
        }
    }

    if (req.query.excludeStatus) {
        if (req.query.excludeStatus.includes(',')) {
            query.encounterStatus = { ...query.encounterStatus, $nin: req.query.excludeStatus.split(',') };
        } else {
            query.encounterStatus = { ...query.encounterStatus, $ne: req.query.excludeStatus };
        }
    }

    const visits = await Visit.find(query)
        .populate('patient', 'name mrn age gender contact')
        .populate('doctor', 'name')
        .populate('clinic', 'name department')
        .populate('ward', 'name dailyRate');
    res.json(visits);
};

// @desc    Update visit (Clinical Data & Workflow)
// @route   PUT /api/visits/:id
// @access  Private (Doctor/Nurse/Cashier)
const updateVisit = async (req, res) => {
    const {
        chiefComplaint, historyOfIllness, diagnosis, status, dischargeDate,
        encounterStatus, paymentValidated, receiptNumber, consultingPhysician, nursingNotes, isANC,
        subjective, objective, assessment, plan,
        // New structured clinical documentation fields
        presentingComplaints,
        historyOfPresentingComplaint,
        systemReview,
        pastMedicalSurgicalHistory,
        socialFamilyHistory,
        drugsHistory,
        functionalCognitiveStatus,
        menstruationGynecologicalObstetricsHistory,
        pregnancyHistory,
        immunization,
        nutritional,
        developmentalMilestones,
        // Physical Examination fields
        generalAppearance,
        heent,
        neck,
        cvs,
        resp,
        abd,
        neuro,
        msk,
        skin
    } = req.body;

    const visit = await Visit.findById(req.params.id);

    if (visit) {
        // Clinical Data
        if (chiefComplaint) visit.chiefComplaint = chiefComplaint;
        if (historyOfIllness) visit.historyOfIllness = historyOfIllness;
        if (diagnosis) visit.diagnosis = diagnosis;
        if (status) visit.status = status;

        // V5 Workflow Data
        if (encounterStatus) {
            if (encounterStatus === 'discharged' && visit.encounterStatus !== 'discharged') {
                visit.dischargeDate = new Date();
                if (visit.ward && visit.bed) {
                    const Ward = require('../models/wardModel');
                    const wardDoc = await Ward.findById(visit.ward);
                    if (wardDoc) {
                        const bedIndex = wardDoc.beds.findIndex(b => b.number === visit.bed);
                        if (bedIndex !== -1) {
                            wardDoc.beds[bedIndex].isOccupied = false;
                            wardDoc.beds[bedIndex].occupiedBy = null;
                            await wardDoc.save();
                        }
                    }
                }
            }
            visit.encounterStatus = encounterStatus;
        }

        if (paymentValidated !== undefined) visit.paymentValidated = paymentValidated;
        if (receiptNumber) visit.receiptNumber = receiptNumber;
        if (consultingPhysician) visit.consultingPhysician = consultingPhysician;
        if (nursingNotes) visit.nursingNotes = nursingNotes;
        if (isANC !== undefined) visit.isANC = !!isANC;

        // Structured Clinical Documentation Fields
        if (presentingComplaints !== undefined) visit.presentingComplaints = presentingComplaints;
        if (historyOfPresentingComplaint !== undefined) visit.historyOfPresentingComplaint = historyOfPresentingComplaint;
        if (systemReview !== undefined) visit.systemReview = systemReview;
        if (pastMedicalSurgicalHistory !== undefined) visit.pastMedicalSurgicalHistory = pastMedicalSurgicalHistory;
        if (socialFamilyHistory !== undefined) visit.socialFamilyHistory = socialFamilyHistory;
        if (drugsHistory !== undefined) visit.drugsHistory = drugsHistory;
        if (functionalCognitiveStatus !== undefined) visit.functionalCognitiveStatus = functionalCognitiveStatus;
        if (menstruationGynecologicalObstetricsHistory !== undefined) visit.menstruationGynecologicalObstetricsHistory = menstruationGynecologicalObstetricsHistory;
        if (pregnancyHistory !== undefined) visit.pregnancyHistory = pregnancyHistory;
        if (immunization !== undefined) visit.immunization = immunization;
        if (nutritional !== undefined) visit.nutritional = nutritional;
        if (developmentalMilestones !== undefined) visit.developmentalMilestones = developmentalMilestones;

        // Physical Examination fields
        if (generalAppearance !== undefined) visit.generalAppearance = generalAppearance;
        if (heent !== undefined) visit.heent = heent;
        if (neck !== undefined) visit.neck = neck;
        if (cvs !== undefined) visit.cvs = cvs;
        if (resp !== undefined) visit.resp = resp;
        if (abd !== undefined) visit.abd = abd;
        if (neuro !== undefined) visit.neuro = neuro;
        if (msk !== undefined) visit.msk = msk;
        if (skin !== undefined) visit.skin = skin;

        // Legacy SOAP Notes (for backward compatibility)
        if (subjective) visit.subjective = subjective;
        if (objective) visit.objective = objective;
        if (assessment) visit.assessment = assessment;
        if (plan) visit.plan = plan;

        if (status === 'Discharged' && !visit.dischargeDate) {
            visit.dischargeDate = new Date();
        }

        const updatedVisit = await visit.save();
        res.json(updatedVisit);
    } else {
        res.status(404).json({ message: 'Visit not found' });
    }
};

// @desc    Get single visit
// @route   GET /api/visits/:id
// @access  Private
const getVisitById = async (req, res) => {
    const visit = await Visit.findById(req.params.id)
        .populate('patient', 'name age gender')
        .populate('doctor', 'name')
        .populate('consultingPhysician', 'name')
        .populate('clinic', 'name department')
        .populate('ward', 'name dailyRate');

    if (visit) {
        res.json(visit);
    } else {
        res.status(404).json({ message: 'Visit not found' });
    }
};

// @desc    Delete visit/encounter (Admin only)
// @route   DELETE /api/visits/:id
// @access  Private (Admin)
const deleteVisit = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            return res.status(404).json({ message: 'Visit not found' });
        }

        await visit.deleteOne();
        res.json({ message: 'Visit deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get visits by patient ID
// @route   GET /api/visits/patient/:patientId
// @access  Private
const getVisitsByPatient = async (req, res) => {
    try {
        const visits = await Visit.find({ patient: req.params.patientId })
            .sort({ createdAt: -1 })
            .populate('doctor', 'name')
            .populate('consultingPhysician', 'name')
            .populate('clinic', 'name department')
            .populate('ward', 'name');
        res.json(visits);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add a note to a visit
// @route   POST /api/visits/:id/notes
// @access  Private
const addNote = async (req, res) => {
    const { text } = req.body;

    try {
        const visit = await Visit.findById(req.params.id);

        if (visit) {
            const newNote = {
                text,
                author: req.user.name,
                role: req.user.role,
                createdAt: new Date()
            };

            visit.notes.push(newNote);
            await visit.save();
            res.status(201).json(visit.notes);
        } else {
            res.status(404).json({ message: 'Visit not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Convert Outpatient to Inpatient
// @route   PUT /api/visits/:id/convert-to-inpatient
// @access  Private (Nurse/Receptionist/Admin)
const convertToInpatient = async (req, res) => {
    const { ward, bed } = req.body;

    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            return res.status(404).json({ message: 'Visit not found' });
        }

        if (visit.type === 'Inpatient') {
            return res.status(400).json({ message: 'Encounter is already Inpatient' });
        }

        if (!ward || !bed) {
            return res.status(400).json({ message: 'Ward and Bed are required for conversion' });
        }

        const Ward = require('../models/wardModel');
        const wardDoc = await Ward.findById(ward);

        if (!wardDoc) {
            return res.status(404).json({ message: 'Ward not found' });
        }

        const bedIndex = wardDoc.beds.findIndex(b => b.number === bed);
        if (bedIndex === -1) {
            return res.status(404).json({ message: 'Bed not found in ward' });
        }

        if (wardDoc.beds[bedIndex].isOccupied) {
            return res.status(400).json({ message: 'Selected bed is already occupied' });
        }

        // 1. Update Ward/Bed (Occupy Bed)
        wardDoc.beds[bedIndex].isOccupied = true;
        wardDoc.beds[bedIndex].occupiedBy = visit.patient;
        await wardDoc.save();

        // 2. Update Visit
        visit.type = 'Inpatient';
        visit.encounterType = 'Inpatient';
        visit.status = 'Admitted';
        visit.ward = ward;
        visit.bed = bed;
        visit.admissionDate = new Date();
        visit.encounterStatus = 'admitted';

        const updatedVisit = await visit.save();

        // 3. Generate Initial Bed Charge
        const Patient = require('../models/patientModel');
        const patient = await Patient.findById(visit.patient);

        let dailyFee = wardDoc.dailyRate; // Default fallback

        if (patient && patient.provider && wardDoc.rates && wardDoc.rates[patient.provider]) {
            dailyFee = wardDoc.rates[patient.provider];
        } else if (wardDoc.rates && wardDoc.rates.Standard) {
            dailyFee = wardDoc.rates.Standard;
        }

        if (dailyFee > 0) {
            const EncounterCharge = require('../models/encounterChargeModel');
            await EncounterCharge.create({
                encounter: visit._id,
                patient: visit.patient,
                itemType: 'Daily Bed Fee',
                itemName: `Initial Ward Charge - ${wardDoc.name} (${patient.provider || 'Standard'})`,
                cost: dailyFee,
                quantity: 1,
                totalAmount: dailyFee,
                status: 'pending',
                addedBy: req.user._id
            });
        }

        res.json(updatedVisit);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Change encounter type (e.g. from External to Outpatient/Inpatient)
// @route   PUT /api/visits/:id/change-type
// @access  Private (Receptionist/Admin)
const changeEncounterType = async (req, res) => {
    const { type, encounterType, clinic, ward, bed, reasonForVisit } = req.body;

    try {
        const visit = await Visit.findById(req.params.id);

        if (!visit) {
            return res.status(404).json({ message: 'Visit not found' });
        }

        const oldType = visit.type;
        const isCurrentlyExternal = ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(oldType);
        const isNewTypeExternal = ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(type);

        // 1. Handle Ward/Bed if switching TO Inpatient
        if (type === 'Inpatient' && oldType !== 'Inpatient') {
            if (!ward || !bed) {
                return res.status(400).json({ message: 'Ward and Bed are required for Inpatient admission' });
            }

            const Ward = require('../models/wardModel');
            const wardDoc = await Ward.findById(ward);

            if (!wardDoc) {
                return res.status(404).json({ message: 'Ward not found' });
            }

            const bedIndex = wardDoc.beds.findIndex(b => b.number === bed);
            if (bedIndex === -1) {
                return res.status(404).json({ message: 'Bed not found in ward' });
            }

            if (wardDoc.beds[bedIndex].isOccupied) {
                return res.status(400).json({ message: 'Selected bed is already occupied' });
            }

            // Occupy Bed
            wardDoc.beds[bedIndex].isOccupied = true;
            wardDoc.beds[bedIndex].occupiedBy = visit.patient;
            await wardDoc.save();

            visit.ward = ward;
            visit.bed = bed;
            visit.admissionDate = new Date();
            
            // Generate Initial Bed Charge
            const Patient = require('../models/patientModel');
            const patient = await Patient.findById(visit.patient);
            let dailyFee = wardDoc.dailyRate;
            if (patient && patient.provider && wardDoc.rates && wardDoc.rates[patient.provider]) {
                dailyFee = wardDoc.rates[patient.provider];
            } else if (wardDoc.rates && wardDoc.rates.Standard) {
                dailyFee = wardDoc.rates.Standard;
            }

            if (dailyFee > 0) {
                const EncounterCharge = require('../models/encounterChargeModel');
                await EncounterCharge.create({
                    encounter: visit._id,
                    patient: visit.patient,
                    itemType: 'Daily Bed Fee',
                    itemName: `Initial Ward Charge - ${wardDoc.name} (${patient.provider || 'Standard'})`,
                    cost: dailyFee,
                    quantity: 1,
                    totalAmount: dailyFee,
                    status: 'pending',
                    addedBy: req.user._id
                });
            }
        }

        // 2. Update Basic Fields
        visit.type = type;
        visit.encounterType = encounterType || type;
        if (clinic) visit.clinic = clinic;
        if (reasonForVisit) visit.reasonForVisit = reasonForVisit;

        // 3. Update Status Logic
        // If moving from External to Standard, reset payment and transition status
        if (isCurrentlyExternal && !isNewTypeExternal) {
            visit.paymentValidated = false;
            visit.encounterStatus = (type === 'Inpatient') ? 'admitted' : 'payment_pending';
            if (type === 'Inpatient') visit.status = 'Admitted';
        } else if (!isCurrentlyExternal && isNewTypeExternal) {
            visit.paymentValidated = true;
            visit.encounterStatus = 'awaiting_services';
        } else if (type === 'Inpatient' && oldType !== 'Inpatient') {
             visit.encounterStatus = 'admitted';
             visit.status = 'Admitted';
        }

        const updatedVisit = await visit.save();
        res.json(updatedVisit);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createVisit,
    getVisits,
    updateVisit,
    getVisitById,
    deleteVisit,
    getVisitsByPatient,
    addNote,
    convertToInpatient,
    changeEncounterType
};

