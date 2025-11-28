// models
const Visit = require('../models/visitModel');

// @desc    Create new visit (Check-in)
// @route   POST /api/visits
// @access  Private
const createVisit = async (req, res) => {
    const { patientId, appointmentId, type, clinic, encounterType, reasonForVisit, ward, bed } = req.body;

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
        paymentValidated: type === 'External Investigation',
        encounterStatus: type === 'External Investigation' ? 'awaiting_services' : (type === 'Inpatient' ? 'admitted' : (req.body.encounterStatus || 'registered')),
        reasonForVisit
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
    const visits = await Visit.find({})
        .populate('patient', 'name')
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
        encounterStatus, paymentValidated, receiptNumber, consultingPhysician, nursingNotes,
        subjective, objective, assessment, plan
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

        // SOAP Notes
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

module.exports = {
    createVisit,
    getVisits,
    updateVisit,
    getVisitById,
    deleteVisit,
    getVisitsByPatient,
    addNote
};
