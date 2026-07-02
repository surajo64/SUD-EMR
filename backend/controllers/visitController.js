// models
const Visit = require('../models/visitModel');

// Helper to check for unpaid consultation charges
const checkUnpaidConsultation = async (visitId) => {
    if (!visitId) return false;
    const Visit = require('../models/visitModel');
    const visit = await Visit.findById(visitId);
    if (visit && visit.waiveConsultationFee) return false;

    const EncounterCharge = require('../models/encounterChargeModel');
    const charges = await EncounterCharge.find({ encounter: visitId }).populate('charge');
    return charges.some(c => c.charge && c.charge.type === 'consultation' && c.status === 'pending');
};

// @desc    Create new visit (Check-in)
// @route   POST /api/visits
// @access  Private
const createVisit = async (req, res) => {
    const { patientId, appointmentId, type, clinic, encounterType, reasonForVisit, ward, bed, isANC,
        waiveConsultationFee, needSpeciality, specialityClinic, needSpecificDoctor, specificDoctor } = req.body;

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
        paymentValidated: ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(type) || !!waiveConsultationFee,
        encounterStatus: ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(type) 
            ? 'awaiting_services' 
            : (type === 'Inpatient' ? 'admitted' : (req.body.encounterStatus || (waiveConsultationFee ? 'in_nursing' : 'registered'))),
        status: type === 'Inpatient' ? 'Admitted' : 'In Progress',
        reasonForVisit,
        isANC: !!isANC,
        waiveConsultationFee: !!waiveConsultationFee,
        waivedBy: waiveConsultationFee ? req.user._id : undefined,
        needSpeciality: !!needSpeciality,
        specialityClinic: needSpeciality ? (specialityClinic || undefined) : undefined,
        needSpecificDoctor: !!needSpeciality && !!needSpecificDoctor,
        specificDoctor: (needSpeciality && needSpecificDoctor) ? (specificDoctor || undefined) : undefined
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

    // Filter for doctors based on speciality or doctor restrictions
    if (req.user && req.user.role === 'doctor') {
        const doctorClinicId = req.user.assignedSpecialityClinic?._id || req.user.assignedSpecialityClinic;
        const doctorClinicName = req.user.assignedSpecialityClinic?.name;
        const doctorId = req.user._id;

        query.$and = query.$and || [];

        // Speciality restriction visibility rule:
        if (doctorClinicId) {
            if (doctorClinicName === 'General Physician') {
                // General Physician doctors can see:
                // 1. Unrestricted general visits (needSpeciality !== true)
                // 2. Visits restricted to General Physician speciality clinic
                query.$and.push({
                    $or: [
                        { needSpeciality: { $ne: true } },
                        { specialityClinic: doctorClinicId }
                    ]
                });
            } else {
                // Non-General Physician doctors (e.g. Obgyn, Pediatrics, etc.) can ONLY see:
                // Visits explicitly restricted to their clinic
                query.$and.push({
                    needSpeciality: true,
                    specialityClinic: doctorClinicId
                });
            }
        } else {
            // If the doctor has no assigned clinic, fallback to showing only general visits
            query.$and.push({
                needSpeciality: { $ne: true }
            });
        }

        // Specific Doctor restriction
        query.$and.push({
            $or: [
                { needSpecificDoctor: { $ne: true } },
                { specificDoctor: doctorId }
            ]
        });
    }

    const visits = await Visit.find(query)
        .populate('patient', 'name mrn age gender contact')
        .populate('doctor', 'name')
        .populate('clinic', 'name department')
        .populate('ward', 'name dailyRate')
        .populate('waivedBy', 'name')
        .populate('seenBy', 'name');

    // Fetch unpaid consultation status for each visit
    const visitsWithPaymentStatus = await Promise.all(visits.map(async (visit) => {
        const hasUnpaid = await checkUnpaidConsultation(visit._id);
        const visitObj = visit.toObject();
        visitObj.hasUnpaidConsultation = hasUnpaid;
        return visitObj;
    }));

    res.json(visitsWithPaymentStatus);
};

// @desc    Update visit (Clinical Data & Workflow)
// @route   PUT /api/visits/:id
// @access  Private (Doctor/Nurse/Cashier)
const updateVisit = async (req, res) => {
    const {
        chiefComplaint, historyOfIllness, diagnosis, status, dischargeDate,
        encounterStatus, paymentValidated, receiptNumber, consultingPhysician, nursingNotes, isANC,
        subjective, objective, assessment, plan,
        needSpeciality, specialityClinic, needSpecificDoctor, specificDoctor,
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

    console.log('updateVisit body restrictions:', { needSpeciality, specialityClinic, needSpecificDoctor, specificDoctor });

    const visit = await Visit.findById(req.params.id);

    if (visit) {
        if (req.user.role === 'doctor') {
            const hasUnpaid = await checkUnpaidConsultation(visit._id);
            if (hasUnpaid) {
                return res.status(402).json({ message: 'Access denied: Patient has unpaid consultation charges. Please direct them to the cashier.' });
            }
        }
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
        if (needSpeciality !== undefined) {
            visit.needSpeciality = !!needSpeciality;
            if (needSpeciality) {
                visit.specialityClinic = specialityClinic || undefined;
                visit.needSpecificDoctor = !!needSpecificDoctor;
                if (needSpecificDoctor) {
                    visit.specificDoctor = specificDoctor || undefined;
                } else {
                    visit.specificDoctor = undefined;
                }
            } else {
                visit.specialityClinic = undefined;
                visit.needSpecificDoctor = false;
                visit.specificDoctor = undefined;
            }
        }

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

        if (req.user.role === 'doctor') {
            visit.seen = true;
            visit.seenBy = req.user._id;
            visit.seenAt = new Date();
        }

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
        .populate('ward', 'name dailyRate')
        .populate('waivedBy', 'name')
        .populate('seenBy', 'name');

    if (visit) {
        if (req.user && req.user.role === 'doctor') {
            const doctorClinicId = req.user.assignedSpecialityClinic?._id || req.user.assignedSpecialityClinic;
            const doctorId = req.user._id;

            if (visit.needSpeciality && visit.specialityClinic && visit.specialityClinic.toString() !== doctorClinicId?.toString()) {
                return res.status(403).json({ message: 'Access denied: This encounter is restricted to a different speciality clinic.' });
            }

            if (visit.needSpecificDoctor && visit.specificDoctor && visit.specificDoctor.toString() !== doctorId.toString()) {
                return res.status(403).json({ message: 'Access denied: This encounter is restricted to a specific doctor.' });
            }
        }

        const hasUnpaid = await checkUnpaidConsultation(visit._id);
        const visitObj = visit.toObject();
        visitObj.hasUnpaidConsultation = hasUnpaid;
        res.json(visitObj);
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
            .populate('ward', 'name')
            .populate('waivedBy', 'name');

        const visitsWithPaymentStatus = await Promise.all(visits.map(async (visit) => {
            const hasUnpaid = await checkUnpaidConsultation(visit._id);
            const visitObj = visit.toObject();
            visitObj.hasUnpaidConsultation = hasUnpaid;
            return visitObj;
        }));

        res.json(visitsWithPaymentStatus);
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
            if (req.user.role === 'doctor') {
                const hasUnpaid = await checkUnpaidConsultation(visit._id);
                if (hasUnpaid) {
                    return res.status(402).json({ message: 'Access denied: Patient has unpaid consultation charges. Please direct them to the cashier.' });
                }
            }
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

        const Patient = require('../models/patientModel');
        const patient = await Patient.findById(visit.patient);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        if ((patient.depositBalance || 0) <= 0) {
            return res.status(400).json({ message: 'Admission denied: Patient must make a deposit at the cashier before admission.' });
        }

        if (req.user.role === 'doctor') {
            const hasUnpaid = await checkUnpaidConsultation(visit._id);
            if (hasUnpaid) {
                return res.status(402).json({ message: 'Access denied: Patient has unpaid consultation charges. Please direct them to the cashier.' });
            }
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

        if (req.user.role === 'doctor') {
            const hasUnpaid = await checkUnpaidConsultation(visit._id);
            if (hasUnpaid) {
                return res.status(402).json({ message: 'Access denied: Patient has unpaid consultation charges. Please direct them to the cashier.' });
            }
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

// @desc    Add a Ward Round Note to a visit
// @route   POST /api/visits/:id/ward-round-notes
// @access  Private (Doctor, Nurse)
const addWardRoundNote = async (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) {
        return res.status(400).json({ message: 'Note text is required.' });
    }
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        if (req.user.role === 'doctor') {
            const hasUnpaid = await checkUnpaidConsultation(visit._id);
            if (hasUnpaid) {
                return res.status(402).json({ message: 'Access denied: Patient has unpaid consultation charges.' });
            }
        }

        const note = { text, author: req.user.name, role: req.user.role, createdAt: new Date() };
        visit.wardRoundNotes.push(note);
        await visit.save();
        res.status(201).json(visit.wardRoundNotes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Save a Theatre Operation Note to a visit (upsert by _id or create new)
// @route   POST /api/visits/:id/theatre-notes
// @access  Private (Doctor)
const saveTheatreNote = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const noteData = {
            ...req.body,
            createdBy: req.user.name,
            updatedBy: req.user.name,
            updatedAt: new Date(),
        };

        const noteId = req.body._id;
        if (noteId) {
            // Update existing note
            const idx = visit.theatreNotes.findIndex(n => n._id.toString() === noteId);
            if (idx >= 0) {
                Object.assign(visit.theatreNotes[idx], noteData);
            }
        } else {
            noteData.createdAt = new Date();
            visit.theatreNotes.push(noteData);
        }

        await visit.save();
        res.status(201).json(visit.theatreNotes);
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
    addWardRoundNote,
    saveTheatreNote,
    convertToInpatient,
    changeEncounterType
};


