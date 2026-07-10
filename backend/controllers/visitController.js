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

const formatVisitWithClinicalNotes = (visit) => {
    if (!visit) return null;
    const visitObj = visit.toObject ? visit.toObject() : visit;

    // Check if we have clinical notes (excluding virtual legacy ones)
    let firstDoctor = null;
    if (visitObj.clinicalNotes && visitObj.clinicalNotes.length > 0) {
        const sortedNotes = [...visitObj.clinicalNotes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        const firstNote = sortedNotes[0];
        if (firstNote && firstNote.doctor) {
            firstDoctor = firstNote.doctor;
        }
    }

    if (firstDoctor) {
        visitObj.consultingPhysician = firstDoctor;
    }

    if ((!visitObj.clinicalNotes || visitObj.clinicalNotes.length === 0) &&
        (visitObj.presentingComplaints || visitObj.historyOfPresentingComplaint || visitObj.assessment || visitObj.plan || (visitObj.diagnosis && visitObj.diagnosis.length > 0))) {
        
        const legacyDoctor = visitObj.consultingPhysician || visitObj.doctor;
        visitObj.clinicalNotes = [{
            _id: 'legacy-root',
            doctor: legacyDoctor,
            presentingComplaints: visitObj.presentingComplaints || '',
            historyOfPresentingComplaint: visitObj.historyOfPresentingComplaint || '',
            systemReview: visitObj.systemReview || '',
            pastMedicalSurgicalHistory: visitObj.pastMedicalSurgicalHistory || '',
            socialFamilyHistory: visitObj.socialFamilyHistory || '',
            drugsHistory: visitObj.drugsHistory || '',
            functionalCognitiveStatus: visitObj.functionalCognitiveStatus || '',
            menstruationGynecologicalObstetricsHistory: visitObj.menstruationGynecologicalObstetricsHistory || '',
            pregnancyHistory: visitObj.pregnancyHistory || '',
            immunization: visitObj.immunization || '',
            nutritional: visitObj.nutritional || '',
            developmentalMilestones: visitObj.developmentalMilestones || '',
            generalAppearance: visitObj.generalAppearance || '',
            heent: visitObj.heent || '',
            neck: visitObj.neck || '',
            cvs: visitObj.cvs || '',
            resp: visitObj.resp || '',
            abd: visitObj.abd || '',
            neuro: visitObj.neuro || '',
            msk: visitObj.msk || '',
            skin: visitObj.skin || '',
            assessment: visitObj.assessment || '',
            plan: visitObj.plan || '',
            diagnosis: visitObj.diagnosis || [],
            createdAt: visitObj.updatedAt || visitObj.createdAt,
            updatedAt: visitObj.updatedAt || visitObj.createdAt
        }];
        visitObj.consultingPhysician = legacyDoctor;
    } else if (!visitObj.clinicalNotes || visitObj.clinicalNotes.length === 0) {
        if (!visitObj.consultingPhysician) {
            visitObj.consultingPhysician = null;
        }
    }
    return visitObj;
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

        const Patient = require('../models/patientModel');
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const isRetainership = ['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider);
        let hasValidDeposit = (patient.depositBalance || 0) > 0;

        if (isRetainership) {
            const HMO = require('../models/hmoModel');
            const HMOTransaction = require('../models/hmoTransactionModel');
            const hmo = await HMO.findOne({ name: patient.hmo, category: 'Retainership' });
            if (hmo) {
                const depositCount = await HMOTransaction.countDocuments({
                    hmo: hmo._id,
                    type: 'deposit'
                });
                if (depositCount > 0) {
                    hasValidDeposit = true;
                }
            }
        }

        if (!hasValidDeposit) {
            return res.status(400).json({ message: 'Admission denied: Patient must make a deposit at the cashier before admission.' });
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
    if (type === 'Inpatient') {
        const { checkAndGenerateBedFeesForVisit } = require('../utils/bedFeeBilling');
        await checkAndGenerateBedFeesForVisit(visit._id, new Date(), req.user._id);
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

        let specialityFilter = {};
        if (doctorClinicId) {
            if (doctorClinicName === 'General Physician') {
                specialityFilter = {
                    $or: [
                        { needSpeciality: { $ne: true } },
                        { specialityClinic: doctorClinicId }
                    ]
                };
            } else {
                specialityFilter = {
                    needSpeciality: true,
                    specialityClinic: doctorClinicId
                };
            }
        } else {
            specialityFilter = {
                needSpeciality: { $ne: true }
            };
        }

        const specificDoctorFilter = {
            $or: [
                { needSpecificDoctor: { $ne: true } },
                { specificDoctor: doctorId }
            ]
        };

        query.$and = query.$and || [];
        // Admitted inpatients can be accessed by all doctors of any speciality.
        // Therefore, restrictions ONLY apply if the encounter is NOT Inpatient.
        query.$and.push({
            $or: [
                { type: 'Inpatient' },
                {
                    $and: [specialityFilter, specificDoctorFilter]
                }
            ]
        });
    }

    const visits = await Visit.find(query)
        .populate('patient', 'name mrn age gender contact')
        .populate('doctor', 'name')
        .populate('consultingPhysician', 'name')
        .populate('clinicalNotes.doctor', 'name role')
        .populate('clinic', 'name department')
        .populate('ward', 'name dailyRate')
        .populate('waivedBy', 'name')
        .populate('seenBy', 'name')
        .populate('dischargedBy', 'name role');

    // Fetch unpaid consultation status for each visit
    const visitsWithPaymentStatus = await Promise.all(visits.map(async (visit) => {
        const hasUnpaid = await checkUnpaidConsultation(visit._id);
        const formattedVisit = formatVisitWithClinicalNotes(visit);
        formattedVisit.hasUnpaidConsultation = hasUnpaid;
        return formattedVisit;
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
                visit.dischargedBy = req.user._id;
                if (req.body.dischargeNotes) visit.dischargeNotes = req.body.dischargeNotes;
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
        .populate('clinicalNotes.doctor', 'name role')
        .populate('clinic', 'name department')
        .populate('ward', 'name dailyRate')
        .populate('waivedBy', 'name')
        .populate('seenBy', 'name')
        .populate('dischargedBy', 'name role');

    if (visit) {
        if (req.user && req.user.role === 'doctor') {
            // All doctors can access any admitted/inpatient encounter.
            if (visit.type !== 'Inpatient') {
                const doctorClinicId = req.user.assignedSpecialityClinic?._id || req.user.assignedSpecialityClinic;
                const doctorId = req.user._id;

                if (visit.needSpeciality && visit.specialityClinic && visit.specialityClinic.toString() !== doctorClinicId?.toString()) {
                    return res.status(403).json({ message: 'Access denied: This encounter is restricted to a different speciality clinic.' });
                }

                if (visit.needSpecificDoctor && visit.specificDoctor && visit.specificDoctor.toString() !== doctorId.toString()) {
                    return res.status(403).json({ message: 'Access denied: This encounter is restricted to a specific doctor.' });
                }
            }
        }

        const hasUnpaid = await checkUnpaidConsultation(visit._id);
        const formattedVisit = formatVisitWithClinicalNotes(visit);
        formattedVisit.hasUnpaidConsultation = hasUnpaid;
        res.json(formattedVisit);
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
            .populate('clinicalNotes.doctor', 'name role')
            .populate('clinic', 'name department')
            .populate('ward', 'name')
            .populate('waivedBy', 'name');

        const visitsWithPaymentStatus = await Promise.all(visits.map(async (visit) => {
            const hasUnpaid = await checkUnpaidConsultation(visit._id);
            const formattedVisit = formatVisitWithClinicalNotes(visit);
            formattedVisit.hasUnpaidConsultation = hasUnpaid;
            return formattedVisit;
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

        const isRetainership = ['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider);
        let hasValidDeposit = (patient.depositBalance || 0) > 0;

        if (isRetainership) {
            const HMO = require('../models/hmoModel');
            const HMOTransaction = require('../models/hmoTransactionModel');
            const hmo = await HMO.findOne({ name: patient.hmo, category: 'Retainership' });
            if (hmo) {
                const depositCount = await HMOTransaction.countDocuments({
                    hmo: hmo._id,
                    type: 'deposit'
                });
                if (depositCount > 0) {
                    hasValidDeposit = true;
                }
            }
        }

        if (!hasValidDeposit) {
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
        const { checkAndGenerateBedFeesForVisit } = require('../utils/bedFeeBilling');
        await checkAndGenerateBedFeesForVisit(updatedVisit._id, new Date(), req.user._id);

        res.json(updatedVisit);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Change encounter type (e.g. from External to Outpatient/Inpatient)
// @route   PUT /api/visits/:id/change-type
// @access  Private (Receptionist/Admin)
const changeEncounterType = async (req, res) => {
    const { 
        type, 
        encounterType, 
        clinic, 
        ward, 
        bed, 
        reasonForVisit,
        isANC,
        waiveConsultationFee,
        needSpeciality,
        specialityClinic,
        needSpecificDoctor,
        specificDoctor
    } = req.body;

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

            const Patient = require('../models/patientModel');
            const patient = await Patient.findById(visit.patient);
            if (!patient) {
                return res.status(404).json({ message: 'Patient not found' });
            }

            const isRetainership = ['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider);
            let hasValidDeposit = (patient.depositBalance || 0) > 0;

            if (isRetainership) {
                const HMO = require('../models/hmoModel');
                const HMOTransaction = require('../models/hmoTransactionModel');
                const hmo = await HMO.findOne({ name: patient.hmo, category: 'Retainership' });
                if (hmo) {
                    const depositCount = await HMOTransaction.countDocuments({
                        hmo: hmo._id,
                        type: 'deposit'
                    });
                    if (depositCount > 0) {
                        hasValidDeposit = true;
                    }
                }
            }

            if (!hasValidDeposit) {
                return res.status(400).json({ message: 'Admission denied: Patient must make a deposit at the cashier before admission.' });
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
            let dailyFee = wardDoc.dailyRate;
            if (patient && patient.provider && wardDoc.rates && wardDoc.rates[patient.provider]) {
                dailyFee = wardDoc.rates[patient.provider];
            } else if (wardDoc.rates && wardDoc.rates.Standard) {
                dailyFee = wardDoc.rates.Standard;
            }

            if (dailyFee > 0) {
                const EncounterCharge = require('../models/encounterChargeModel');
                let patientPortion = dailyFee;
                let hmoPortion = 0;
                if (patient && ['Retainership', 'Corporate Retainership', 'Family Retainership', 'NHIA', 'KSCHMA'].includes(patient.provider)) {
                    patientPortion = 0;
                    hmoPortion = dailyFee;
                }

                await EncounterCharge.create({
                    encounter: visit._id,
                    patient: visit.patient,
                    itemType: 'Daily Bed Fee',
                    itemName: `Initial Ward Charge - ${wardDoc.name} (${patient.provider || 'Standard'})`,
                    cost: dailyFee,
                    quantity: 1,
                    totalAmount: dailyFee,
                    patientPortion,
                    hmoPortion,
                    status: 'pending',
                    addedBy: req.user._id
                });
            }
        }

        // 2. Update Basic & Form Fields
        visit.type = type;
        visit.encounterType = encounterType || type;
        if (clinic) visit.clinic = clinic;
        if (reasonForVisit) visit.reasonForVisit = reasonForVisit;

        if (isANC !== undefined) visit.isANC = !!isANC;
        if (waiveConsultationFee !== undefined) {
            visit.waiveConsultationFee = !!waiveConsultationFee;
            if (waiveConsultationFee) {
                visit.waivedBy = req.user._id;
            } else {
                visit.waivedBy = undefined;
            }

            // Automatically update existing consultation charges
            const EncounterCharge = require('../models/encounterChargeModel');
            const Patient = require('../models/patientModel');
            
            const encounterCharges = await EncounterCharge.find({ encounter: visit._id }).populate('charge');
            const patientObj = await Patient.findById(visit.patient);

            for (const ec of encounterCharges) {
                if (ec.charge && ec.charge.type === 'consultation') {
                    if (ec.status === 'paid') continue; // Skip if already paid
                    if (waiveConsultationFee) {
                        ec.unitPrice = 0;
                        ec.totalAmount = 0;
                        ec.patientPortion = 0;
                        ec.hmoPortion = 0;
                        ec.status = 'paid';
                        await ec.save();
                    } else {
                        // Recalculate fee based on patient provider
                        let fee = 0;
                        let isCovered = true;
                        switch (patientObj.provider) {
                            case 'Retainership':
                            case 'Corporate Retainership':
                                fee = ec.charge.retainershipFee;
                                break;
                            case 'Family Retainership':
                                fee = ec.charge.familyRetainershipFee || 0;
                                break;
                            case 'NHIA':
                                fee = ec.charge.nhiaFee;
                                break;
                            case 'KSCHMA':
                                fee = ec.charge.kschmaFee;
                                break;
                            case 'Standard':
                            default:
                                fee = ec.charge.standardFee;
                                break;
                        }

                        if (fee === 0 && patientObj.provider !== 'Standard') {
                            isCovered = false;
                            fee = ec.charge.standardFee || ec.charge.basePrice;
                        }

                        if (fee === 0 && ec.charge.basePrice) {
                            fee = ec.charge.basePrice;
                        }

                        const totalAmount = fee * ec.quantity;
                        let patientPortion = totalAmount;
                        let hmoPortion = 0;

                        if (!isCovered) {
                            patientPortion = totalAmount;
                            hmoPortion = 0;
                        } else if (patientObj.provider === 'Retainership' || patientObj.provider === 'Corporate Retainership' || patientObj.provider === 'Family Retainership') {
                            patientPortion = 0;
                            hmoPortion = totalAmount;
                        } else if (patientObj.provider === 'NHIA' || patientObj.provider === 'KSCHMA') {
                            patientPortion = 0;
                            hmoPortion = totalAmount;
                        }

                        ec.unitPrice = fee;
                        ec.totalAmount = totalAmount;
                        ec.patientPortion = patientPortion;
                        ec.hmoPortion = hmoPortion;
                        ec.status = 'pending';
                        await ec.save();
                    }
                }
            }
        }
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
        } else if (!['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(type)) {
            // Update workflow status dynamically
            if (visit.waiveConsultationFee || visit.isANC) {
                visit.paymentValidated = true;
                if (['registered', 'payment_pending'].includes(visit.encounterStatus)) {
                    visit.encounterStatus = 'in_nursing';
                }
            } else {
                // Check if there are unpaid charges
                const EncounterCharge = require('../models/encounterChargeModel');
                const chargesCount = await EncounterCharge.countDocuments({ encounter: visit._id });
                const unpaidChargesCount = await EncounterCharge.countDocuments({ encounter: visit._id, status: 'pending' });
                
                if (unpaidChargesCount > 0) {
                    visit.paymentValidated = false;
                    if (['registered', 'in_nursing'].includes(visit.encounterStatus)) {
                        visit.encounterStatus = 'payment_pending';
                    }
                } else if (chargesCount > 0) {
                    visit.paymentValidated = true;
                    if (['registered', 'payment_pending'].includes(visit.encounterStatus)) {
                        visit.encounterStatus = 'in_nursing';
                    }
                }
            }
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

// @desc    Save/update consent data or file upload for a specific theatre note
// @route   POST /api/visits/:id/theatre-notes/:noteId/consent
// @access  Private (Doctor/User)
const saveConsentNote = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const { noteId } = req.params;
        const noteIdx = visit.theatreNotes.findIndex(n => n._id.toString() === noteId);
        if (noteIdx === -1) {
            return res.status(404).json({ message: 'Theatre note not found' });
        }

        let consentData = {};
        
        if (req.body.consentData) {
            try {
                consentData = JSON.parse(req.body.consentData);
            } catch (err) {
                return res.status(400).json({ message: 'Invalid consentData format' });
            }
        } else {
            consentData = { ...req.body };
        }

        if (req.file) {
            consentData.uploadedFile = req.file.path.replace(/\\/g, '/');
        }

        consentData.filledAt = new Date();
        consentData.filledBy = req.user.name;

        visit.theatreNotes[noteIdx].consent = consentData;

        await visit.save();
        res.status(200).json(visit.theatreNotes);
    } catch (error) {
        console.error('saveConsentNote error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Save (add or edit) a structured clinical note for a visit
// @route   POST /api/visits/:id/clinical-notes
// @access  Private (Doctor)
const saveClinicalNote = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        // Doctors must pay consultation first
        if (req.user.role === 'doctor') {
            const hasUnpaid = await checkUnpaidConsultation(visit._id);
            if (hasUnpaid) {
                return res.status(402).json({ message: 'Access denied: Patient has unpaid consultation charges. Please direct them to the cashier.' });
            }
        }

        const {
            noteId,
            presentingComplaints, historyOfPresentingComplaint, systemReview,
            pastMedicalSurgicalHistory, socialFamilyHistory, drugsHistory,
            functionalCognitiveStatus, menstruationGynecologicalObstetricsHistory,
            pregnancyHistory, immunization, nutritional, developmentalMilestones,
            generalAppearance, heent, neck, cvs, resp, abd, neuro, msk, skin,
            assessment, plan, diagnosis
        } = req.body;

        const noteData = {
            presentingComplaints, historyOfPresentingComplaint, systemReview,
            pastMedicalSurgicalHistory, socialFamilyHistory, drugsHistory,
            functionalCognitiveStatus, menstruationGynecologicalObstetricsHistory,
            pregnancyHistory, immunization, nutritional, developmentalMilestones,
            generalAppearance, heent, neck, cvs, resp, abd, neuro, msk, skin,
            assessment, plan,
            diagnosis: diagnosis || [],
            updatedAt: new Date()
        };

        if (noteId && noteId !== 'legacy-root') {
            // EDIT: find existing clinical note
            const idx = visit.clinicalNotes.findIndex(n => n._id.toString() === noteId);
            if (idx === -1) return res.status(404).json({ message: 'Clinical note not found' });

            // Only the note's author can edit
            const noteDoctor = visit.clinicalNotes[idx].doctor?.toString();
            if (noteDoctor !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Access denied: Only the doctor who wrote this note can edit it.' });
            }

            Object.assign(visit.clinicalNotes[idx], noteData);
        } else if (noteId === 'legacy-root') {
            // EDIT legacy root note: update root fields (keeps backward compatibility)
            const consultingDoctorId = visit.consultingPhysician?.toString();
            if (consultingDoctorId && consultingDoctorId !== req.user._id.toString()) {
                return res.status(403).json({ message: 'Access denied: Only the doctor who wrote this note can edit it.' });
            }

            Object.assign(visit, noteData);
            if (req.user.role === 'doctor') {
                visit.consultingPhysician = req.user._id;
                visit.seen = true;
                visit.seenBy = req.user._id;
                visit.seenAt = new Date();
            }
        } else {
            // ADD: new clinical note
            const newNote = {
                ...noteData,
                doctor: req.user._id,
                createdAt: new Date()
            };
            visit.clinicalNotes.push(newNote);

            // If this is the first clinical note, also sync to root fields for backward compatibility
            if (visit.clinicalNotes.length === 1) {
                Object.assign(visit, noteData);
                if (req.user.role === 'doctor') {
                    visit.consultingPhysician = req.user._id;
                    visit.seen = true;
                    visit.seenBy = req.user._id;
                    visit.seenAt = new Date();
                }
            }
        }

        if (diagnosis && diagnosis.length > 0 && !noteId) {
            visit.diagnosis = diagnosis;
        } else if (diagnosis && noteId === 'legacy-root') {
            visit.diagnosis = diagnosis;
        }

        await visit.save();

        // Return fully populated visit
        const updatedVisit = await Visit.findById(visit._id)
            .populate('patient', 'name age gender')
            .populate('doctor', 'name')
            .populate('consultingPhysician', 'name')
            .populate('clinicalNotes.doctor', 'name role');

        res.status(201).json(formatVisitWithClinicalNotes(updatedVisit));
    } catch (error) {
        console.error('saveClinicalNote error:', error);
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
    saveConsentNote,
    convertToInpatient,
    changeEncounterType,
    saveClinicalNote
};


