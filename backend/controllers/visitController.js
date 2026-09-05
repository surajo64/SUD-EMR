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

const isWalkInCustomerOrEncounter = (visit, patient) => {
    const externalTypes = ['External Pharmacy', 'External Lab', 'External Radiology', 'External Investigation'];
    if (visit && externalTypes.includes(visit.type)) return true;

    const p = patient || (visit && visit.patient);
    if (p) {
        if (p.isWalkIn === true) return true;
        if (p.contact === 'Walk-in') return true;
        if (p.mrn && /^WI-|^LAB-|^RAD-/.test(p.mrn)) return true;
    }
    return false;
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

    const Patient = require('../models/patientModel');
    const targetPatient = await Patient.findById(patientId);
    if (!targetPatient) {
        return res.status(404).json({ message: 'Patient not found' });
    }
    if (isWalkInCustomerOrEncounter(null, targetPatient)) {
        return res.status(400).json({ message: 'Cannot create clinical encounters for a walk-in customer.' });
    }

    // Check for existing visit today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const existingVisit = await Visit.findOne({
        patient: patientId,
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        encounterStatus: { $nin: ['completed', 'discharged', 'cancelled'] },
        isActive: { $ne: false }
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

        const isRetainership = ['Retainership', 'Corporate Retainership', 'Family Retainership', 'Joud Alkhair Retainership'].includes(patient.provider);
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
        paymentValidated: ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(type) || !!waiveConsultationFee || type === 'ANC Visit',
        encounterStatus: ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(type) 
            ? 'awaiting_services' 
            : (type === 'Inpatient' ? 'admitted' : (type === 'ANC Visit' ? 'in_nursing' : (req.body.encounterStatus || (waiveConsultationFee ? 'in_nursing' : 'registered')))),
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
        
        query.$or = [
            { createdAt: { $gte: startOfDay, $lte: endOfDay } },
            { isActive: true }
        ];
        
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

    if (req.query.activeOnly === 'true') {
        query.encounterStatus = { $nin: ['completed', 'discharged', 'cancelled'] };
        query.status = { $nin: ['Discharged', 'Completed'] };
        query.isActive = { $ne: false };
        query.dischargeDate = { $exists: false };
    }

    if (req.query.excludeInpatient === 'true') {
        query.type = { $ne: 'Inpatient' };
        query.encounterType = { $ne: 'Inpatient' };
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
        if (req.query.excludeInpatient === 'true') {
            query.$and.push(specialityFilter);
            query.$and.push(specificDoctorFilter);
        } else {
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
    }

    const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
    if (isClinicalRole || (req.query.includeWalkIn !== 'true' && (!type || !type.startsWith('External')))) {
        query.type = { $nin: ['External Pharmacy', 'External Lab', 'External Radiology', 'External Investigation'] };
    }

    let visits = await Visit.find(query)
        .populate('patient', 'name mrn age gender contact isWalkIn provider hmo depositBalance')
        .populate('doctor', 'name')
        .populate('consultingPhysician', 'name')
        .populate('clinicalNotes.doctor', 'name role')
        .populate('orderTasks.doctor', 'name role')
        .populate('orderTasks.completedBy', 'name role')
        .populate('clinic', 'name department')
        .populate('ward', 'name dailyRate')
        .populate('waivedBy', 'name')
        .populate('seenBy', 'name')
        .populate('dischargedBy', 'name role');

    if (isClinicalRole || req.query.includeWalkIn !== 'true') {
        visits = visits.filter(v => !isWalkInCustomerOrEncounter(v, v.patient));
    }

    // Fetch unpaid consultation status for each visit
    // Also overlay Retainership HMO wallet balance onto patient.depositBalance
    const RETAINERSHIP_PROVIDERS = ['Retainership', 'Corporate Retainership', 'Family Retainership', 'Joud Alkhair Retainership'];

    // Collect unique HMO names for Retainership patients so we compute balances once
    const hmoNamesNeeded = [...new Set(
        visits
            .filter(v => v.patient && RETAINERSHIP_PROVIDERS.includes(v.patient.provider) && v.patient.hmo)
            .map(v => v.patient.hmo)
    )];

    const hmoBalances = {};
    if (hmoNamesNeeded.length > 0) {
        const HMO = require('../models/hmoModel');
        const HMOTransaction = require('../models/hmoTransactionModel');
        const EncounterCharge = require('../models/encounterChargeModel');
        const Patient = require('../models/patientModel');

        await Promise.all(hmoNamesNeeded.map(async (hmoName) => {
            const hmo = await HMO.findOne({ name: hmoName });
            if (!hmo) { hmoBalances[hmoName] = 0; return; }
            const transactions = await HMOTransaction.find({ hmo: hmo._id });
            const totalDeposits = transactions.filter(t => t.type === 'deposit').reduce((s, t) => s + t.amount, 0);
            const manualCharges = transactions.filter(t => t.type === 'charge').reduce((s, t) => s + t.amount, 0);
            const refunds = transactions.filter(t => t.type === 'refund').reduce((s, t) => s + t.amount, 0);
            const hmoPatients = await Patient.find({ hmo: hmoName }).select('_id');
            const hmoPatientIds = hmoPatients.map(p => p._id);
            const charges = await EncounterCharge.find({ patient: { $in: hmoPatientIds }, hmoPortion: { $gt: 0 }, status: 'paid' });
            const totalUtilized = charges.reduce((s, c) => s + c.hmoPortion, 0);
            hmoBalances[hmoName] = totalDeposits - (totalUtilized + manualCharges + refunds);
        }));
    }

    const visitsWithPaymentStatus = await Promise.all(visits.map(async (visit) => {
        const hasUnpaid = await checkUnpaidConsultation(visit._id);
        const formattedVisit = formatVisitWithClinicalNotes(visit);
        formattedVisit.hasUnpaidConsultation = hasUnpaid;
        // Overlay Retainership wallet balance onto patient.depositBalance
        if (formattedVisit.patient && RETAINERSHIP_PROVIDERS.includes(formattedVisit.patient.provider) && formattedVisit.patient.hmo) {
            formattedVisit.patient.depositBalance = hmoBalances[formattedVisit.patient.hmo] ?? 0;
        }
        return formattedVisit;
    }));

    res.json(visitsWithPaymentStatus);
};

// @desc    Get today's active visits with outstanding charges in chronological order
// @route   GET /api/visits/todays-outstanding
// @access  Private (Cashier / Admin)
const getTodaysOutstandingVisits = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // Find active encounters created today or active today
        const visits = await Visit.find({
            $or: [
                { createdAt: { $gte: startOfDay, $lte: endOfDay } },
                { status: 'Admitted' },
                { encounterStatus: { $in: ['admitted', 'in_ward'] } }
            ],
            encounterStatus: { $nin: ['completed', 'discharged', 'cancelled'] },
            isActive: { $ne: false }
        })
        .sort({ createdAt: 1 }) // Chronological order (earliest today first)
        .populate('patient', 'name mrn age gender contact provider depositBalance isWalkIn')
        .populate('doctor', 'name')
        .populate('clinic', 'name');

        // Filter out walk-in customers/external encounters
        const filteredVisits = visits.filter(v => v.patient && !isWalkInCustomerOrEncounter(v, v.patient));

        const visitIds = filteredVisits.map(v => v._id);

        // Find pending charges for these visits
        const EncounterCharge = require('../models/encounterChargeModel');
        const pendingCharges = await EncounterCharge.find({
            encounter: { $in: visitIds },
            status: 'pending'
        });

        // Group pending charges by encounter ID
        const chargesByEncounter = {};
        pendingCharges.forEach(charge => {
            const encId = charge.encounter.toString();
            if (!chargesByEncounter[encId]) {
                chargesByEncounter[encId] = [];
            }
            chargesByEncounter[encId].push(charge);
        });

        // Build list of visits with outstanding fees
        const result = [];
        for (const visit of filteredVisits) {
            const charges = chargesByEncounter[visit._id.toString()] || [];
            if (charges.length > 0) {
                const totalPendingAmount = charges.reduce((sum, c) => {
                    if (c.patientPortion > 0) return sum + c.patientPortion;
                    const provider = visit.patient?.provider || 'Standard';
                    const isInsurance = ['Retainership', 'Corporate Retainership', 'Family Retainership', 'Joud Alkhair Retainership', 'NHIA', 'KSCHMA'].includes(provider);
                    if (isInsurance && (provider !== 'NHIA' && provider !== 'KSCHMA')) {
                        return sum + (c.patientPortion || 0);
                    }
                    if ((provider === 'NHIA' || provider === 'KSCHMA') && c.itemType === 'Drug') {
                        return sum + (c.totalAmount * 0.1);
                    }
                    return sum + (c.totalAmount || 0);
                }, 0);

                result.push({
                    visit: formatVisitWithClinicalNotes(visit),
                    pendingCount: charges.length,
                    totalPendingAmount
                });
            }
        }

        res.json(result);
    } catch (error) {
        console.error('Error fetching today\'s outstanding visits:', error);
        res.status(500).json({ message: error.message });
    }
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

    const visit = await Visit.findById(req.params.id).populate('patient');

    if (visit) {
        const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
        if (isClinicalRole && isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(403).json({ message: 'Access denied: Cannot access or modify walk-in customer encounters.' });
        }

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

        // Ensure encounterStatus and status stay in sync for discharge
        let targetEncounterStatus = encounterStatus;
        if (!targetEncounterStatus && (status === 'Discharged' || status === 'discharged')) {
            targetEncounterStatus = 'discharged';
        }

        // V5 Workflow Data
        if (targetEncounterStatus) {
            if (targetEncounterStatus === 'discharged' && visit.encounterStatus !== 'discharged') {
                const Patient = require('../models/patientModel');
                const patientDoc = await Patient.findById(visit.patient);
                if (patientDoc && (patientDoc.depositBalance || 0) < 0) {
                    const formattedNegative = Math.abs(patientDoc.depositBalance).toLocaleString();
                    return res.status(400).json({
                        message: `Cannot discharge patient. Patient has a negative wallet balance of ₦${formattedNegative}. The negative wallet balance must be cleared/paid before discharging.`
                    });
                }

                visit.dischargeDate = new Date();
                visit.dischargedBy = req.user._id;
                if (req.body.dischargeNotes || req.body.dischargeNote) {
                    visit.dischargeNotes = req.body.dischargeNotes || req.body.dischargeNote;
                }
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

            // Determine if the encounter was expired or inactive before this update
            const oneDay = 24 * 60 * 60 * 1000;
            const wasExpired = (Date.now() - new Date(visit.createdAt).getTime()) >= oneDay;
            const inactiveStatuses = ['completed', 'cancelled', 'discharged'];
            const wasInactive = inactiveStatuses.includes(visit.encounterStatus) || visit.isActive === false || wasExpired;

            const activeStatuses = ['registered', 'payment_pending', 'in_nursing', 'with_doctor', 'awaiting_services', 'in_pharmacy', 'in_lab', 'in_radiology', 'in_ward', 'admitted'];
            if (activeStatuses.includes(targetEncounterStatus)) {
                if (wasInactive) {
                    visit.isActive = true;
                }
            } else if (inactiveStatuses.includes(targetEncounterStatus)) {
                visit.isActive = false;
            }

            visit.encounterStatus = targetEncounterStatus;
            if (targetEncounterStatus === 'discharged') {
                visit.status = 'Discharged';
            }
        }

        if (req.body.isActive !== undefined) {
            visit.isActive = req.body.isActive;
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
        .populate('patient', 'name age gender mrn contact isWalkIn provider hmo depositBalance')
        .populate('doctor', 'name')
        .populate('consultingPhysician', 'name')
        .populate('clinicalNotes.doctor', 'name role')
        .populate('orderTasks.doctor', 'name role')
        .populate('orderTasks.completedBy', 'name role')
        .populate('clinic', 'name department')
        .populate('ward', 'name dailyRate')
        .populate('waivedBy', 'name')
        .populate('seenBy', 'name')
        .populate('dischargedBy', 'name role');

    if (visit) {
        const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
        if (isClinicalRole && isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(403).json({ message: 'Access denied: Cannot access walk-in customer encounters.' });
        }

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
        const Patient = require('../models/patientModel');
        const targetPatient = await Patient.findById(req.params.patientId);
        const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
        if (isClinicalRole && isWalkInCustomerOrEncounter(null, targetPatient)) {
            return res.json([]);
        }

        let visits = await Visit.find({ patient: req.params.patientId })
            .sort({ createdAt: -1 })
            .populate('patient', 'name mrn age gender contact isWalkIn provider hmo depositBalance')
            .populate('doctor', 'name')
            .populate('consultingPhysician', 'name')
            .populate('clinicalNotes.doctor', 'name role')
            .populate('clinic', 'name department')
            .populate('ward', 'name')
            .populate('waivedBy', 'name');

        if (isClinicalRole || req.query.includeWalkIn !== 'true') {
            visits = visits.filter(v => !isWalkInCustomerOrEncounter(v, v.patient));
        }

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
        const visit = await Visit.findById(req.params.id).populate('patient');

        if (visit) {
            const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
            if (isClinicalRole && isWalkInCustomerOrEncounter(visit, visit.patient)) {
                return res.status(403).json({ message: 'Access denied: Cannot access or modify walk-in customer encounters.' });
            }

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

            if (['doctor', 'admin'].includes(req.user.role)) {
                visit.seen = true;
                visit.seenBy = req.user._id;
                visit.seenAt = new Date();
            }

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
        const visit = await Visit.findById(req.params.id).populate('patient');

        if (!visit) {
            return res.status(404).json({ message: 'Visit not found' });
        }

        if (isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(400).json({ message: 'Walk-in customer encounters cannot be converted to inpatient.' });
        }

        const Patient = require('../models/patientModel');
        const patient = await Patient.findById(visit.patient);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        const isRetainership = ['Retainership', 'Corporate Retainership', 'Family Retainership', 'Joud Alkhair Retainership'].includes(patient.provider);

        // Retainership patients are always admitted — charges bill to Retainership account (overdraft allowed)
        if (!isRetainership) {
            const hasDeposit = (patient.depositBalance || 0) > 0;
            if (!hasDeposit) {
                return res.status(400).json({ message: 'Admission denied: Patient must make a deposit at the cashier before admission.' });
            }
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
        visit.isActive = true;

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
        const visit = await Visit.findById(req.params.id).populate('patient');

        if (!visit) {
            return res.status(404).json({ message: 'Visit not found' });
        }

        if (isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(400).json({ message: 'Walk-in customer encounters cannot be converted into clinical encounters.' });
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

            const isRetainership = ['Retainership', 'Corporate Retainership', 'Family Retainership', 'Joud Alkhair Retainership'].includes(patient.provider);
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
                if (patient && ['Retainership', 'Corporate Retainership', 'Family Retainership', 'Joud Alkhair Retainership', 'NHIA', 'KSCHMA'].includes(patient.provider)) {
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
                            case 'Joud Alkhair Retainership':
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
                        } else if (patientObj.provider === 'Retainership' || patientObj.provider === 'Corporate Retainership' || patientObj.provider === 'Family Retainership' || patientObj.provider === 'Joud Alkhair Retainership') {
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

        // Update isActive based on modified status in changeEncounterType
        if (visit.isModified('encounterStatus')) {
            const activeStatuses = ['registered', 'payment_pending', 'in_nursing', 'with_doctor', 'awaiting_services', 'in_pharmacy', 'in_lab', 'in_radiology', 'in_ward', 'admitted'];
            const inactiveStatuses = ['completed', 'cancelled', 'discharged'];
            if (activeStatuses.includes(visit.encounterStatus)) {
                visit.isActive = true;
            } else if (inactiveStatuses.includes(visit.encounterStatus)) {
                visit.isActive = false;
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
        const visit = await Visit.findById(req.params.id).populate('patient');
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
        if (isClinicalRole && isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(403).json({ message: 'Access denied: Cannot access or modify walk-in customer encounters.' });
        }

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
        const visit = await Visit.findById(req.params.id).populate('patient');
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
        if (isClinicalRole && isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(403).json({ message: 'Access denied: Cannot access or modify walk-in customer encounters.' });
        }

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

// @desc    Save/update consent data or file upload for a specific theatre note or visit
// @route   POST /api/visits/:id/theatre-notes/:noteId/consent OR /api/visits/:id/consents
// @access  Private (Doctor/User)
const saveConsentNote = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

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

        const { noteId } = req.params;
        if (noteId) {
            // Legacy / nested consent
            const noteIdx = visit.theatreNotes.findIndex(n => n._id.toString() === noteId);
            if (noteIdx !== -1) {
                visit.theatreNotes[noteIdx].consent = consentData;
            }
        } else {
            // Detached consent
            if (!visit.consents) {
                visit.consents = [];
            }
            const consentId = consentData._id;
            if (consentId) {
                const idx = visit.consents.findIndex(c => c._id.toString() === consentId);
                if (idx >= 0) {
                    Object.assign(visit.consents[idx], consentData);
                } else {
                    consentData.createdAt = new Date();
                    visit.consents.push(consentData);
                }
            } else {
                consentData.createdAt = new Date();
                visit.consents.push(consentData);
            }
        }

        await visit.save();
        res.status(200).json({ theatreNotes: visit.theatreNotes, consents: visit.consents || [] });
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
        const visit = await Visit.findById(req.params.id).populate('patient');
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
        if (isClinicalRole && isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(403).json({ message: 'Access denied: Cannot access or modify walk-in customer encounters.' });
        }

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
            assessment, plan, diagnosis,
            // ANC-specific fields
            noteType,
            ancVisitNumber, edd, gestation, gravida, para, lmp,
            fundalHeight, fetalLie, fetalPresentation, fetalPosition,
            fetalHeartRate, engagement, liquor, uterineContractions,
            amnioticFluidIndex, placentalLocation,
            maternalWeight, maternalBP, maternalPulse, maternalTemp, maternalHb,
            urinalysis, malariaProphylaxis, tetanusToxoid, ironFolate,
            hivStatus, syphilisStatus, bloodGroupGenotype,
            ancComplaints, ancRiskFactors, ancCounselling, ancReferral, nextAppointment
        } = req.body;

        const noteData = {
            presentingComplaints, historyOfPresentingComplaint, systemReview,
            pastMedicalSurgicalHistory, socialFamilyHistory, drugsHistory,
            functionalCognitiveStatus, menstruationGynecologicalObstetricsHistory,
            pregnancyHistory, immunization, nutritional, developmentalMilestones,
            generalAppearance, heent, neck, cvs, resp, abd, neuro, msk, skin,
            assessment, plan,
            diagnosis: diagnosis || [],
            // ANC-specific fields
            noteType: noteType || 'standard',
            ancVisitNumber, edd, gestation, gravida, para, lmp,
            fundalHeight, fetalLie, fetalPresentation, fetalPosition,
            fetalHeartRate, engagement, liquor, uterineContractions,
            amnioticFluidIndex, placentalLocation,
            maternalWeight, maternalBP, maternalPulse, maternalTemp, maternalHb,
            urinalysis, malariaProphylaxis, tetanusToxoid, ironFolate,
            hivStatus, syphilisStatus, bloodGroupGenotype,
            ancComplaints, ancRiskFactors, ancCounselling, ancReferral, nextAppointment,
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
            }
        }

        if (diagnosis && diagnosis.length > 0 && !noteId) {
            visit.diagnosis = diagnosis;
        } else if (diagnosis && noteId === 'legacy-root') {
            visit.diagnosis = diagnosis;
        }

        // Mark visit as seen whenever doctor or admin records or updates a clinical/ANC note
        if (['doctor', 'admin'].includes(req.user.role)) {
            visit.seen = true;
            visit.seenBy = req.user._id;
            visit.seenAt = new Date();
            if (!visit.consultingPhysician) {
                visit.consultingPhysician = req.user._id;
            }
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

// @desc    Save/update an anaesthetic machine/medication & equipment checklist
// @route   POST /api/visits/:id/checklists
// @access  Private (Doctor/User)
const saveChecklist = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const checklistData = {
            ...req.body,
            filledAt: new Date(),
            filledBy: req.user.name
        };

        if (!visit.checklists) {
            visit.checklists = [];
        }

        const checklistId = checklistData._id;
        if (checklistId) {
            const idx = visit.checklists.findIndex(c => c._id.toString() === checklistId);
            if (idx >= 0) {
                Object.assign(visit.checklists[idx], checklistData);
            } else {
                checklistData.createdAt = new Date();
                visit.checklists.push(checklistData);
            }
        } else {
            checklistData.createdAt = new Date();
            visit.checklists.push(checklistData);
        }

        await visit.save();
        res.status(200).json({
            theatreNotes: visit.theatreNotes || [],
            consents: visit.consents || [],
            checklists: visit.checklists || [],
            postoperativeHandoverChecklists: visit.postoperativeHandoverChecklists || []
        });
    } catch (error) {
        console.error('saveChecklist error:', error);
        res.status(500).json({ message: error.message });
    }
};

const savePreAnaesthesiaChecklist = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        // Initialize the array if it doesn't exist on older visit documents
        if (!visit.preAnaesthesiaChecklists) {
            visit.preAnaesthesiaChecklists = [];
        }

        const checklistData = {
            ...req.body,
            filledAt: new Date(),
        };

        const checklistId = checklistData._id;
        if (checklistId) {
            const idx = visit.preAnaesthesiaChecklists.findIndex(c => c._id.toString() === checklistId);
            if (idx >= 0) {
                Object.assign(visit.preAnaesthesiaChecklists[idx], checklistData);
            } else {
                checklistData.createdAt = new Date();
                visit.preAnaesthesiaChecklists.push(checklistData);
            }
        } else {
            checklistData.createdAt = new Date();
            visit.preAnaesthesiaChecklists.push(checklistData);
        }

        await visit.save();
        res.status(200).json({
            preAnaesthesiaChecklists: visit.preAnaesthesiaChecklists || [],
            checklists: visit.checklists || [],
            consents: visit.consents || [],
            theatreNotes: visit.theatreNotes || [],
            postoperativeHandoverChecklists: visit.postoperativeHandoverChecklists || []
        });
    } catch (error) {
        console.error('savePreAnaesthesiaChecklist error:', error);
        res.status(500).json({ message: error.message });
    }
};

const savePostoperativeHandoverChecklist = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        // Initialize the array if it doesn't exist on older visit documents
        if (!visit.postoperativeHandoverChecklists) {
            visit.postoperativeHandoverChecklists = [];
        }

        const checklistData = {
            ...req.body,
            filledAt: new Date(),
        };

        const checklistId = checklistData._id;
        if (checklistId) {
            const idx = visit.postoperativeHandoverChecklists.findIndex(c => c._id.toString() === checklistId);
            if (idx >= 0) {
                Object.assign(visit.postoperativeHandoverChecklists[idx], checklistData);
            } else {
                checklistData.createdAt = new Date();
                visit.postoperativeHandoverChecklists.push(checklistData);
            }
        } else {
            checklistData.createdAt = new Date();
            visit.postoperativeHandoverChecklists.push(checklistData);
        }

        await visit.save();
        res.status(200).json({
            preAnaesthesiaChecklists: visit.preAnaesthesiaChecklists || [],
            checklists: visit.checklists || [],
            consents: visit.consents || [],
            theatreNotes: visit.theatreNotes || [],
            postoperativeHandoverChecklists: visit.postoperativeHandoverChecklists || []
        });
    } catch (error) {
        console.error('savePostoperativeHandoverChecklist error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add an order task to a visit (e.g. Admission order, Discharge order, Others)
// @route   POST /api/visits/:id/order-tasks
// @access  Private (Doctor/User)
const saveOrderTask = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id).populate('patient');
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
        if (isClinicalRole && isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(403).json({ message: 'Access denied: Cannot access or modify walk-in customer encounters.' });
        }

        const { orderType, customOrderTask, expectedDischargeDate, instructions } = req.body;
        if (!orderType || !instructions) {
            return res.status(400).json({ message: 'Order type and instructions are required' });
        }
        if (orderType === 'Others' && (!customOrderTask || !customOrderTask.trim())) {
            return res.status(400).json({ message: 'Order task title is required when Others is selected' });
        }

        const isAdmissionOrder = (orderType || '').toLowerCase().includes('admission');
        if (isAdmissionOrder && !expectedDischargeDate) {
            return res.status(400).json({ message: 'Expected date of discharge is required for Admission order' });
        }

        const newTask = {
            orderType,
            customOrderTask: orderType === 'Others' ? customOrderTask.trim() : '',
            expectedDischargeDate: expectedDischargeDate ? new Date(expectedDischargeDate) : undefined,
            instructions: instructions.trim(),
            doctor: req.user._id,
            doctorName: req.user.name,
            status: 'Pending',
            createdAt: new Date()
        };

        if (!visit.orderTasks) {
            visit.orderTasks = [];
        }

        visit.orderTasks.push(newTask);
        await visit.save();

        const updatedVisit = await Visit.findById(visit._id)
            .populate('patient', 'name mrn age gender contact')
            .populate('doctor', 'name')
            .populate('consultingPhysician', 'name')
            .populate('clinicalNotes.doctor', 'name role')
            .populate('orderTasks.doctor', 'name role')
            .populate('orderTasks.completedBy', 'name role');

        res.status(201).json(formatVisitWithClinicalNotes(updatedVisit));
    } catch (error) {
        console.error('saveOrderTask error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order task status (e.g. Mark as Completed by Nurse)
// @route   PUT /api/visits/:id/order-tasks/:taskId/status
// @access  Private (Nurse/Doctor/User)
const updateOrderTaskStatus = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id).populate('patient');
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const isClinicalRole = req.user && ['doctor', 'nurse', 'cashier', 'receptionist'].includes(req.user.role);
        if (isClinicalRole && isWalkInCustomerOrEncounter(visit, visit.patient)) {
            return res.status(403).json({ message: 'Access denied: Cannot access or modify walk-in customer encounters.' });
        }

        const { taskId } = req.params;
        const { status, nurseComment } = req.body;

        if (!visit.orderTasks) {
            return res.status(404).json({ message: 'No order tasks found for this visit' });
        }

        const task = visit.orderTasks.id(taskId) || visit.orderTasks.find(t => t._id.toString() === taskId);
        if (!task) {
            return res.status(404).json({ message: 'Order task not found' });
        }

        task.status = status || 'Completed';
        if (task.status === 'Completed') {
            task.completedBy = req.user._id;
            task.completedByName = req.user.name;
            task.completedAt = new Date();
            if (nurseComment !== undefined) {
                task.nurseComment = nurseComment;
            }

            // If this is a Discharge Order task, automatically discharge the visit if not already discharged
            const isDischargeTask = (task.orderType || '').toLowerCase().includes('discharge');
            if (isDischargeTask && visit.encounterStatus !== 'discharged') {
                visit.encounterStatus = 'discharged';
                visit.status = 'Discharged';
                visit.isActive = false;
                visit.dischargeDate = new Date();
                visit.dischargedBy = req.user._id;

                const noteText = (nurseComment || '').trim() || task.instructions || 'Discharged per doctor order.';
                if (!visit.dischargeNotes) {
                    visit.dischargeNotes = noteText;
                }

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
        } else if (task.status === 'Pending') {
            task.completedBy = null;
            task.completedByName = '';
            task.completedAt = null;
            task.nurseComment = '';
        }

        await visit.save();

        const updatedVisit = await Visit.findById(visit._id)
            .populate('patient', 'name mrn age gender contact')
            .populate('doctor', 'name')
            .populate('consultingPhysician', 'name')
            .populate('clinicalNotes.doctor', 'name role')
            .populate('orderTasks.doctor', 'name role')
            .populate('orderTasks.completedBy', 'name role');

        res.json(formatVisitWithClinicalNotes(updatedVisit));
    } catch (error) {
        console.error('updateOrderTaskStatus error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update an order task content/instructions (Doctor edit)
// @route   PUT /api/visits/:id/order-tasks/:taskId
// @access  Private (Doctor/User)
const updateOrderTask = async (req, res) => {
    try {
        const visit = await Visit.findById(req.params.id);
        if (!visit) return res.status(404).json({ message: 'Visit not found' });

        const { taskId } = req.params;
        const { orderType, customOrderTask, expectedDischargeDate, instructions } = req.body;

        if (!visit.orderTasks) {
            return res.status(404).json({ message: 'No order tasks found for this visit' });
        }

        const task = visit.orderTasks.id(taskId) || visit.orderTasks.find(t => t._id.toString() === taskId);
        if (!task) {
            return res.status(404).json({ message: 'Order task not found' });
        }

        if (orderType) task.orderType = orderType;
        task.customOrderTask = orderType === 'Others' ? (customOrderTask || '').trim() : '';

        const isAdmissionOrder = (orderType || task.orderType || '').toLowerCase().includes('admission');
        if (isAdmissionOrder && expectedDischargeDate) {
            task.expectedDischargeDate = new Date(expectedDischargeDate);
        } else if (!isAdmissionOrder) {
            task.expectedDischargeDate = undefined;
        }

        if (instructions) task.instructions = instructions.trim();

        task.updatedBy = req.user._id;
        task.updatedByName = req.user.name;
        task.updatedAt = new Date();

        await visit.save();

        const updatedVisit = await Visit.findById(visit._id)
            .populate('patient', 'name mrn age gender contact')
            .populate('doctor', 'name')
            .populate('consultingPhysician', 'name')
            .populate('clinicalNotes.doctor', 'name role')
            .populate('orderTasks.doctor', 'name role')
            .populate('orderTasks.completedBy', 'name role');

        res.json(formatVisitWithClinicalNotes(updatedVisit));
    } catch (error) {
        console.error('updateOrderTask error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createVisit,
    getVisits,
    getTodaysOutstandingVisits,
    updateVisit,
    getVisitById,
    deleteVisit,
    getVisitsByPatient,
    addNote,
    addWardRoundNote,
    saveTheatreNote,
    saveConsentNote,
    saveChecklist,
    savePreAnaesthesiaChecklist,
    savePostoperativeHandoverChecklist,
    saveClinicalNote,
    convertToInpatient,
    changeEncounterType,
    saveOrderTask,
    updateOrderTaskStatus,
    updateOrderTask
};
