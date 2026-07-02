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

        // Check if consultation fee is waived for this encounter
        const Visit = require('../models/visitModel');
        const visit = await Visit.findById(encounterId);
        
        let fee = 0;
        let isCovered = true;
        let isWaived = false;

        if (visit && visit.waiveConsultationFee && charge.type === 'consultation') {
            fee = 0;
            isWaived = true;
        } else {
            switch (patient.provider) {
                case 'Retainership':
                case 'Corporate Retainership':
                    fee = charge.retainershipFee;
                    break;
                case 'Family Retainership':
                    fee = charge.familyRetainershipFee || 0;
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

            // Check if fee is 0 (not covered) for insurance/retainership patients
            if (fee === 0 && patient.provider !== 'Standard') {
                // If it's a drug, we assume it's covered and use the standard fee/base price
                if (charge.type === 'drugs') {
                    fee = charge.standardFee || charge.basePrice;
                    // isCovered remains true
                } else {
                    isCovered = false;
                    fee = charge.standardFee || charge.basePrice; // Fallback to standard fee
                }
            }

            // Fallback to basePrice if fee is still 0 (shouldn't happen if standardFee is set)
            if (fee === 0 && charge.basePrice) {
                fee = charge.basePrice;
            }
        }

        const totalAmount = fee * (quantity || 1);

        // Calculate patient vs HMO portions based on provider type
        let patientPortion = totalAmount;
        let hmoPortion = 0;

        if (isWaived) {
            patientPortion = 0;
            hmoPortion = 0;
        } else if (!isCovered) {
            // If not covered (fee was 0), patient pays 100%
            patientPortion = totalAmount;
            hmoPortion = 0;
        } else if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership' || patient.provider === 'Family Retainership') {
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
            status: isWaived ? 'paid' : 'pending',
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
        const { status, startDate, endDate } = req.query;
        const filter = { patient: req.params.patientId };

        if (status) filter.status = status;

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

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
        const { quantity, unitPrice, notes } = req.body;
        const charge = await EncounterCharge.findById(req.params.id).populate('charge');

        if (!charge) {
            return res.status(404).json({ message: 'Encounter charge not found' });
        }

        if (charge.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot update a processed charge' });
        }

        let updatedQty = charge.quantity;
        let updatedPrice = charge.unitPrice !== undefined ? charge.unitPrice : (charge.charge ? charge.charge.basePrice : 0);

        if (quantity !== undefined) {
            updatedQty = quantity;
            charge.quantity = quantity;
        }

        if (unitPrice !== undefined) {
            updatedPrice = unitPrice;
            charge.unitPrice = unitPrice;
        }

        if (quantity !== undefined || unitPrice !== undefined) {
            const totalAmount = updatedPrice * updatedQty;
            charge.totalAmount = totalAmount;

            // Recalculate portions based on patient provider
            const patient = await Patient.findById(charge.patient);
            if (patient) {
                let patientPortion = totalAmount;
                let hmoPortion = 0;

                if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership' || patient.provider === 'Family Retainership') {
                    patientPortion = 0;
                    hmoPortion = totalAmount;
                } else if (patient.provider === 'NHIA' || patient.provider === 'KSCHMA') {
                    if (charge.itemType === 'drugs' || (charge.charge && charge.charge.type === 'drugs')) {
                        patientPortion = totalAmount * 0.1;
                        hmoPortion = totalAmount * 0.9;
                    } else {
                        patientPortion = 0;
                        hmoPortion = totalAmount;
                    }
                }
                charge.patientPortion = patientPortion;
                charge.hmoPortion = hmoPortion;
            }
        }

        if (notes !== undefined) {
            charge.notes = notes;
        }

        const updatedCharge = await charge.save();

        // Sync with related Prescription if one exists
        if (quantity !== undefined) {
            try {
                const Prescription = require('../models/prescriptionModel');
                const prescription = await Prescription.findOne({ charge: charge._id });
                if (prescription && prescription.medicines && prescription.medicines.length > 0) {
                    prescription.medicines[0].quantity = updatedQty;
                    await prescription.save();
                }
            } catch (syncError) {
                console.error('Error syncing prescription quantity:', syncError);
            }
        }

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

        await charge.deleteOne();
        res.json({ message: 'Charge removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manually trigger daily ward charges (for testing/admin use)
// @route   POST /api/encounter-charges/trigger-daily-charges
// @access  Private (Admin)
const triggerDailyWardCharges = async (req, res) => {
    try {
        const Visit = require('../models/visitModel');
        const Ward = require('../models/wardModel');

        console.log('========================================');
        console.log('Manually triggering daily ward charges at:', new Date().toLocaleString());
        console.log('========================================');

        // Find all currently admitted patients (check both 'admitted' and 'in_ward' statuses)
        const admittedVisits = await Visit.find({
            encounterStatus: { $in: ['admitted', 'in_ward'] },
            ward: { $exists: true, $ne: null }
        }).populate('ward').populate('patient', 'name mrn');

        console.log(`Found ${admittedVisits.length} admitted/in-ward visits`);

        const results = {
            totalVisits: admittedVisits.length,
            chargesCreated: 0,
            skipped: 0,
            errors: [],
            details: []
        };

        for (const visit of admittedVisits) {
            try {
                if (visit.ward && visit.ward.dailyRate > 0) {
                    // Check if a charge was already created today
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date();
                    endOfDay.setHours(23, 59, 59, 999);

                    const existingCharge = await EncounterCharge.findOne({
                        encounter: visit._id,
                        itemName: { $regex: /Ward Charge/i },
                        createdAt: { $gte: startOfDay, $lte: endOfDay }
                    });

                    if (!existingCharge) {
                        // Create a charge for the day
                        await EncounterCharge.create({
                            encounter: visit._id,
                            patient: visit.patient._id,
                            itemType: 'Daily Bed Fee',
                            itemName: `Daily Ward Charge - ${visit.ward.name}`,
                            cost: visit.ward.dailyRate,
                            quantity: 1,
                            totalAmount: visit.ward.dailyRate,
                            status: 'pending'
                        });

                        results.chargesCreated++;
                        results.details.push({
                            patient: visit.patient?.name,
                            mrn: visit.patient?.mrn,
                            ward: visit.ward.name,
                            amount: visit.ward.dailyRate,
                            status: 'charged'
                        });

                        console.log(`✓ Charged ${visit.ward.dailyRate} to patient ${visit.patient?.name} (MRN: ${visit.patient?.mrn}) - Ward: ${visit.ward.name}`);
                    } else {
                        results.skipped++;
                        results.details.push({
                            patient: visit.patient?.name,
                            mrn: visit.patient?.mrn,
                            ward: visit.ward.name,
                            status: 'already_charged_today'
                        });

                        console.log(`⊘ Skipping patient ${visit.patient?.name} (MRN: ${visit.patient?.mrn}) - already charged today.`);
                    }
                } else {
                    results.errors.push({
                        visitId: visit._id,
                        patient: visit.patient?.name,
                        error: 'No ward or zero daily rate'
                    });
                    console.log(`⚠ Visit ${visit._id} has no ward or zero daily rate`);
                }
            } catch (error) {
                results.errors.push({
                    visitId: visit._id,
                    patient: visit.patient?.name,
                    error: error.message
                });
                console.error(`❌ Error processing visit ${visit._id}:`, error);
            }
        }

        console.log('========================================');
        console.log('Manual daily ward charges completed.');
        console.log(`Created: ${results.chargesCreated}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);
        console.log('========================================');

        res.json({
            success: true,
            message: 'Daily ward charges triggered successfully',
            ...results
        });
    } catch (error) {
        console.error('❌ Error in manual trigger:', error);
        res.status(500).json({
            success: false,
            message: 'Error triggering daily ward charges',
            error: error.message
        });
    }
};

module.exports = {
    addChargeToEncounter,
    getEncounterCharges,
    getPatientCharges,
    markChargePaid,
    updateEncounterCharge,
    deleteEncounterCharge,
    triggerDailyWardCharges,
};
