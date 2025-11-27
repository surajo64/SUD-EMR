const Referral = require('../models/referralModel');

// @desc    Create new referral
// @route   POST /api/referrals
// @access  Private (Doctor)
const createReferral = async (req, res) => {
    try {
        const { patientId, visitId, referredTo, reason, diagnosis, notes, medicalHistory } = req.body;

        if (!patientId || !visitId || !referredTo || !reason || !diagnosis) {
            return res.status(400).json({ message: 'Please provide all required fields' });
        }

        // Verify user is a doctor
        if (req.user.role !== 'doctor') {
            return res.status(403).json({ message: 'Only doctors can create referrals' });
        }

        const referral = await Referral.create({
            patient: patientId,
            visit: visitId,
            doctor: req.user._id,
            referredTo,
            reason,
            diagnosis,
            notes,
            medicalHistory
        });

        const populatedReferral = await Referral.findById(referral._id)
            .populate('patient', 'name age gender mrn')
            .populate('doctor', 'name')
            .populate('visit');

        res.status(201).json(populatedReferral);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error creating referral', error: error.message });
    }
};

// @desc    Get referrals by visit
// @route   GET /api/referrals/visit/:id
// @access  Private
const getReferralsByVisit = async (req, res) => {
    try {
        const referrals = await Referral.find({ visit: req.params.id })
            .populate('patient', 'name age gender mrn')
            .populate('doctor', 'name')
            .populate('visit')
            .sort({ createdAt: -1 });

        res.json(referrals);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching referrals', error: error.message });
    }
};

// @desc    Get single referral
// @route   GET /api/referrals/:id
// @access  Private
const getReferralById = async (req, res) => {
    try {
        const referral = await Referral.findById(req.params.id)
            .populate('patient', 'name age gender mrn dateOfBirth address phone')
            .populate('doctor', 'name')
            .populate('visit');

        if (!referral) {
            return res.status(404).json({ message: 'Referral not found' });
        }

        res.json(referral);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error fetching referral', error: error.message });
    }
};

// @desc    Update referral
// @route   PUT /api/referrals/:id
// @access  Private (Doctor only, creator only)
const updateReferral = async (req, res) => {
    try {
        const { referredTo, reason, diagnosis, notes, medicalHistory } = req.body;

        const referral = await Referral.findById(req.params.id);

        if (!referral) {
            return res.status(404).json({ message: 'Referral not found' });
        }

        // Verify user is the creator
        if (referral.doctor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized to edit this referral' });
        }

        referral.referredTo = referredTo || referral.referredTo;
        referral.reason = reason || referral.reason;
        referral.diagnosis = diagnosis || referral.diagnosis;
        referral.notes = notes || referral.notes;
        referral.medicalHistory = medicalHistory || referral.medicalHistory;

        const updatedReferral = await referral.save();

        const populatedReferral = await Referral.findById(updatedReferral._id)
            .populate('patient', 'name age gender mrn')
            .populate('doctor', 'name')
            .populate('visit');

        res.json(populatedReferral);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error updating referral', error: error.message });
    }
};

module.exports = {
    createReferral,
    getReferralsByVisit,
    getReferralById,
    updateReferral
};
