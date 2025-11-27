const EncounterCharge = require('../models/encounterChargeModel');
const Charge = require('../models/chargeModel');
const Patient = require('../models/patientModel');

// @desc    Add charge to encounter
// @route   POST /api/encounter-charges
// @access  Private
const addChargeToEncounter = async (req, res) => {
    try {
        const { encounterId, patientId, chargeId, quantity, notes } = req.body;

        // Get charge details
        const charge = await Charge.findById(chargeId);
        if (!charge) {
            return res.status(404).json({ message: 'Charge not found' });
        }

        // Get patient details to determine provider
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        // Determine fee based on provider
        let fee = 0;
        switch (patient.provider) {
            case 'Retainership':
                fee = charge.retainershipFee;
                break;
            case 'NHIA':
                fee = charge.nhiaFee;
                break;
            case 'KSCHMA':
                fee = charge.kschmaFee;
                break;
            case 'Standard':
            default:
                fee = charge.standardFee;
                break;
        }

        // Fallback to basePrice if fee is 0
        if (fee === 0 && charge.basePrice) {
            fee = charge.basePrice;
        }

        const totalAmount = fee * (quantity || 1);

        // Calculate patient vs HMO portions based on provider type
        let patientPortion = totalAmount;
        let hmoPortion = 0;

        if (patient.provider === 'Retainership') {
            // Retainership: HMO covers 100% of ALL charges (including drugs)
            patientPortion = 0;
            hmoPortion = totalAmount;
        } else if (patient.provider === 'NHIA' || patient.provider === 'KSCHMA') {
            // NHIA/KSCHMA: Patient pays 10% for drugs, HMO covers 90% for drugs
            // HMO covers 100% for other services
            if (charge.type === 'drugs') {
                patientPortion = totalAmount * 0.1;
                hmoPortion = totalAmount * 0.9;
            } else {
                patientPortion = 0;
                hmoPortion = totalAmount;
            }
        }
        // Standard: Patient pays 100% (default values already set above)

        const encounterCharge = await EncounterCharge.create({
            encounter: encounterId,
            patient: patientId,
            charge: chargeId,
            quantity: quantity || 1,
            unitPrice: fee,
            totalAmount,
            patientPortion,
            hmoPortion,
            addedBy: req.user._id,
            notes
        });

        const populatedCharge = await EncounterCharge.findById(encounterCharge._id)
            .populate('charge')
            .populate('patient', 'name mrn')
            .populate('addedBy', 'name role');

        res.status(201).json(populatedCharge);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get charges for an encounter
// @route   GET /api/encounter-charges/encounter/:encounterId
// @access  Private
const getEncounterCharges = async (req, res) => {
    try {
        const charges = await EncounterCharge.find({ encounter: req.params.encounterId })
            .populate('charge')
            .populate('patient', 'name mrn')
            .populate('addedBy', 'name role')
            .populate('receipt')
            .sort({ createdAt: -1 });

        res.json(charges);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all charges for a patient
// @route   GET /api/encounter-charges/patient/:patientId
// @access  Private
const getPatientCharges = async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { patient: req.params.patientId };

        if (status) filter.status = status;

        const charges = await EncounterCharge.find(filter)
            .populate('charge')
            .populate('encounter')
            .populate('addedBy', 'name role')
            .populate('receipt')
            .sort({ createdAt: -1 });

        res.json(charges);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Mark charge as paid and link receipt
// @route   PUT /api/encounter-charges/:id/pay
// @access  Private (Cashier)
const markChargePaid = async (req, res) => {
    try {
        const { receiptId } = req.body;

        const encounterCharge = await EncounterCharge.findById(req.params.id);

        if (!encounterCharge) {
            return res.status(404).json({ message: 'Encounter charge not found' });
        }

        encounterCharge.status = 'paid';
        encounterCharge.receipt = receiptId;

        const updated = await encounterCharge.save();
        const populated = await EncounterCharge.findById(updated._id)
            .populate('charge')
            .populate('receipt');

        res.json(populated);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update encounter charge
// @route   PUT /api/encounter-charges/:id
// @access  Private
const updateEncounterCharge = async (req, res) => {
    try {
        const { quantity, notes } = req.body;
        const charge = await EncounterCharge.findById(req.params.id).populate('charge');

        if (!charge) {
            return res.status(404).json({ message: 'Encounter charge not found' });
        }

        if (charge.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot update a processed charge' });
        }

        if (quantity) {
            charge.quantity = quantity;
            charge.totalAmount = charge.charge.basePrice * quantity;
        }
        if (notes !== undefined) {
            charge.notes = notes;
        }

        const updatedCharge = await charge.save();
        const populatedCharge = await EncounterCharge.findById(updatedCharge._id)
            .populate('charge')
            .populate('patient', 'name mrn')
            .populate('addedBy', 'name role');

        res.json(populatedCharge);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete encounter charge
// @route   DELETE /api/encounter-charges/:id
// @access  Private
const deleteEncounterCharge = async (req, res) => {
    try {
        const charge = await EncounterCharge.findById(req.params.id);

        if (!charge) {
            return res.status(404).json({ message: 'Encounter charge not found' });
        }

        if (charge.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot delete a processed charge' });
        }

        await charge.remove();
        res.json({ message: 'Charge removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    addChargeToEncounter,
    getEncounterCharges,
    getPatientCharges,
    markChargePaid,
    updateEncounterCharge,
    deleteEncounterCharge,
};
