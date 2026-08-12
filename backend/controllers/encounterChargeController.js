const EncounterCharge = require('../models/encounterChargeModel');
const Charge = require('../models/chargeModel');
const Patient = require('../models/patientModel');

// @desc    Add charge to encounter
// @route   POST /api/encounter-charges
// @access  Private
const addChargeToEncounter = async (req, res) => {
    try {
        const { encounterId, patientId, chargeId, wardId, quantity, notes } = req.body;

        if (!chargeId && !wardId) {
            return res.status(400).json({ message: 'Please provide either chargeId or wardId' });
        }

        // Get patient details to determine provider
        const patient = await Patient.findById(patientId);
        if (!patient) {
            return res.status(404).json({ message: 'Patient not found' });
        }

        let fee = 0;
        let isCovered = true;
        let isWaived = false;
        let itemName = '';
        let itemType = '';
        let chargeDoc = null;

        if (wardId) {
            const Ward = require('../models/wardModel');
            const ward = await Ward.findById(wardId);
            if (!ward) {
                return res.status(404).json({ message: 'Ward not found' });
            }
            itemName = `Daily Ward Charge - ${ward.name}`;
            itemType = 'Daily Bed Fee';

            // Determine fee based on patient provider using ward rates
            const provider = patient.provider;
            if (provider === 'Retainership' || provider === 'Corporate Retainership' || provider === 'Joud Alkhair Retainership') {
                fee = ward.rates?.Retainership || ward.dailyRate || 0;
            } else if (provider === 'Family Retainership') {
                fee = ward.rates?.Retainership || ward.dailyRate || 0;
            } else if (provider === 'NHIA') {
                fee = ward.rates?.NHIA || ward.dailyRate || 0;
            } else if (provider === 'KSCHMA') {
                fee = ward.rates?.KSCHMA || ward.dailyRate || 0;
            } else {
                fee = ward.rates?.Standard || ward.dailyRate || 0;
            }
        } else {
            // Get charge details
            chargeDoc = await Charge.findById(chargeId);
            if (!chargeDoc) {
                return res.status(404).json({ message: 'Charge not found' });
            }
            itemName = chargeDoc.name;
            itemType = chargeDoc.type;

            // Check if consultation fee is waived for this encounter
            const Visit = require('../models/visitModel');
            const visit = await Visit.findById(encounterId);
            
            if (visit && visit.waiveConsultationFee && chargeDoc.type === 'consultation') {
                fee = 0;
                isWaived = true;
            } else {
                switch (patient.provider) {
                    case 'Retainership':
                    case 'Corporate Retainership':
                        fee = chargeDoc.retainershipFee || 0;
                        break;
                    case 'Joud Alkhair Retainership':
                        fee = chargeDoc.joudAlkhairFee || chargeDoc.retainershipFee || 0;
                        break;
                    case 'Family Retainership':
                        fee = chargeDoc.familyRetainershipFee || 0;
                        break;
                    case 'NHIA':
                        fee = chargeDoc.nhiaFee;
                        break;
                    case 'KSCHMA':
                        fee = chargeDoc.kschmaFee;
                        break;
                    case 'Standard':
                    default:
                        fee = chargeDoc.standardFee;
                        break;
                }

                // Check if fee is 0 (not covered) for insurance/retainership patients
                if (fee === 0 && patient.provider !== 'Standard') {
                    // If it's a drug, we assume it's covered and use the standard fee/base price
                    if (chargeDoc.type === 'drugs') {
                        fee = chargeDoc.standardFee || chargeDoc.basePrice;
                        // isCovered remains true
                    } else {
                        isCovered = false;
                        fee = chargeDoc.standardFee || chargeDoc.basePrice; // Fallback to standard fee
                    }
                }

                // Fallback to basePrice if fee is still 0 (shouldn't happen if standardFee is set)
                if (fee === 0 && chargeDoc.basePrice) {
                    fee = chargeDoc.basePrice;
                }
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
        } else if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership' || patient.provider === 'Family Retainership' || patient.provider === 'Joud Alkhair Retainership') {
            // Retainership: HMO covers 100% of ALL charges
            patientPortion = 0;
            hmoPortion = totalAmount;
        } else if (patient.provider === 'NHIA' || patient.provider === 'KSCHMA') {
            // NHIA/KSCHMA: Patient pays 10% for drugs, HMO covers 90% for drugs
            // HMO covers 100% for other services
            if (chargeDoc && chargeDoc.type === 'drugs') {
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
            charge: chargeId || undefined,
            quantity: quantity || 1,
            unitPrice: fee,
            totalAmount,
            patientPortion,
            hmoPortion,
            status: isWaived ? 'paid' : 'pending',
            addedBy: req.user._id,
            itemName,
            itemType,
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

                if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership' || patient.provider === 'Family Retainership' || patient.provider === 'Joud Alkhair Retainership') {
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

// Helper function to process reversal logic for a single charge
const processChargeReversalAndCleanup = async (charge) => {
    const Receipt = require('../models/receiptModel');
    const Inventory = require('../models/inventoryModel');
    const Claim = require('../models/claimModel');
    const Prescription = require('../models/prescriptionModel');
    const LabOrder = require('../models/labOrderModel');
    const RadiologyOrder = require('../models/radiologyOrderModel');

    let amountRefunded = 0;

    // 1. If paid, process money refund to patient deposit & receipt cleanup
    if (charge.status === 'paid') {
        amountRefunded = charge.patientPortion > 0 ? charge.patientPortion : charge.totalAmount;

        // Refund money to patient deposit balance
        if (amountRefunded > 0) {
            const patient = await Patient.findById(charge.patient);
            if (patient) {
                patient.depositBalance = (patient.depositBalance || 0) + amountRefunded;
                await patient.save();
            }
        }

        // Handle linked Receipt
        const receipt = charge.receipt
            ? await Receipt.findById(charge.receipt)
            : await Receipt.findOne({ charges: charge._id });

        if (receipt) {
            receipt.charges = (receipt.charges || []).filter(cId => cId.toString() !== charge._id.toString());
            receipt.amountPaid = Math.max(0, (receipt.amountPaid || 0) - amountRefunded);

            if (receipt.charges.length === 0 || receipt.amountPaid <= 0) {
                await Receipt.findByIdAndDelete(receipt._id);
            } else {
                await receipt.save();
            }
        }

        // Handle Inventory Return for Pharmacy/Drug items
        const isPharmacyItem =
            charge.itemType?.toLowerCase() === 'pharmacy' ||
            charge.itemType?.toLowerCase() === 'drugs' ||
            charge.itemType?.toLowerCase() === 'drug' ||
            charge.department?.toLowerCase() === 'pharmacy';

        if (isPharmacyItem && charge.quantity > 0) {
            const drugName = charge.itemName || (charge.charge && charge.charge.name);
            if (drugName) {
                const inventoryItem = await Inventory.findOne({
                    name: { $regex: new RegExp(`^${drugName}$`, 'i') },
                    expiryDate: { $gte: new Date() }
                }).sort({ expiryDate: -1 });

                if (inventoryItem) {
                    inventoryItem.quantity += charge.quantity;
                    await inventoryItem.save();
                }
            }
        }

        // Handle HMO Claim cleanup
        if (charge.encounter) {
            const claim = await Claim.findOne({ encounter: charge.encounter });
            if (claim && claim.claimItems && claim.claimItems.length > 0) {
                const hmoPortion = charge.hmoPortion || 0;
                claim.claimItems = claim.claimItems.filter(item => {
                    const matchId = item.charge && item.charge.toString() === (charge.charge?._id || charge.charge)?.toString();
                    const matchDesc = item.description && charge.itemName && item.description.toLowerCase() === charge.itemName.toLowerCase();
                    return !(matchId || matchDesc);
                });
                claim.totalClaimAmount = Math.max(0, (claim.totalClaimAmount || 0) - hmoPortion);
                if (claim.claimItems.length === 0) {
                    await Claim.findByIdAndDelete(claim._id);
                } else {
                    await claim.save();
                }
            }
        }
    }

    // 2. Clean up references in Prescriptions, LabOrders, RadiologyOrders
    await Prescription.deleteMany({ charge: charge._id });
    await LabOrder.deleteMany({ charge: charge._id });
    await RadiologyOrder.deleteMany({ charge: charge._id });

    // 3. Delete the charge document
    await charge.deleteOne();

    return amountRefunded;
};

// @desc    Delete encounter charge (Pending for non-admin, Paid & Pending for Admin)
// @route   DELETE /api/encounter-charges/:id
// @access  Private
const deleteEncounterCharge = async (req, res) => {
    try {
        const charge = await EncounterCharge.findById(req.params.id).populate('charge');

        if (!charge) {
            return res.status(404).json({ message: 'Encounter charge not found' });
        }

        const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';

        if (charge.status !== 'pending' && !isAdmin) {
            return res.status(400).json({ message: 'Cannot delete a processed charge. Admin access required.' });
        }

        const refundedAmount = await processChargeReversalAndCleanup(charge);

        res.json({
            message: charge.status === 'paid'
                ? `Charge reversed, ₦${refundedAmount.toLocaleString()} refunded to patient deposit, and charge removed successfully.`
                : 'Charge removed successfully.',
            refundedAmount
        });
    } catch (error) {
        console.error('Error deleting charge:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reverse and remove all charges for a patient (Admin only)
// @route   POST /api/encounter-charges/patient/:patientId/reverse-all
// @access  Private (Admin)
const reverseAllPatientCharges = async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
        if (!isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin rights required.' });
        }

        const charges = await EncounterCharge.find({ patient: req.params.patientId }).populate('charge');

        if (!charges || charges.length === 0) {
            return res.status(404).json({ message: 'No charges found for this patient' });
        }

        let totalRefunded = 0;
        let chargesCount = charges.length;

        for (const charge of charges) {
            const refunded = await processChargeReversalAndCleanup(charge);
            totalRefunded += refunded;
        }

        res.json({
            message: `Successfully reversed ${chargesCount} charges and refunded ₦${totalRefunded.toLocaleString()} to patient deposit.`,
            totalRefunded,
            chargesCount
        });
    } catch (error) {
        console.error('Error reversing all patient charges:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Reverse and remove selected charges (Admin only)
// @route   POST /api/encounter-charges/reverse-selected
// @access  Private (Admin)
const reverseSelectedCharges = async (req, res) => {
    try {
        const isAdmin = req.user.role === 'admin' || req.user.role === 'super_admin';
        if (!isAdmin) {
            return res.status(403).json({ message: 'Access denied. Admin rights required.' });
        }

        const { chargeIds } = req.body;
        if (!chargeIds || !Array.isArray(chargeIds) || chargeIds.length === 0) {
            return res.status(400).json({ message: 'Please select at least one charge to reverse.' });
        }

        const charges = await EncounterCharge.find({ _id: { $in: chargeIds } }).populate('charge');

        if (!charges || charges.length === 0) {
            return res.status(404).json({ message: 'No matching charges found.' });
        }

        let totalRefunded = 0;
        let chargesCount = charges.length;

        for (const charge of charges) {
            const refunded = await processChargeReversalAndCleanup(charge);
            totalRefunded += refunded;
        }

        res.json({
            message: `Successfully reversed ${chargesCount} selected charge(s) and refunded ₦${totalRefunded.toLocaleString()} to patient deposit.`,
            totalRefunded,
            chargesCount
        });
    } catch (error) {
        console.error('Error reversing selected charges:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Manually trigger daily ward charges (for testing/admin use)
// @route   POST /api/encounter-charges/trigger-daily-charges
// @access  Private (Admin)
const triggerDailyWardCharges = async (req, res) => {
    try {
        const Visit = require('../models/visitModel');
        const { checkAndGenerateBedFeesForVisit } = require('../utils/bedFeeBilling');

        console.log('========================================');
        console.log('Manually triggering daily ward charges at:', new Date().toLocaleString());
        console.log('========================================');

        // Find all currently admitted patients (not discharged, cancelled, or completed)
        const admittedVisits = await Visit.find({
            $or: [
                { type: 'Inpatient' },
                { encounterType: 'Inpatient' }
            ],
            encounterStatus: { $nin: ['discharged', 'cancelled', 'completed'] },
            ward: { $exists: true, $ne: null }
        });

        console.log(`Found ${admittedVisits.length} admitted/in-ward visits`);

        for (const visit of admittedVisits) {
            await checkAndGenerateBedFeesForVisit(visit._id, new Date(), req.user._id);
        }

        console.log('========================================');
        console.log('Manual daily ward charges completed.');
        console.log('========================================');

        res.json({
            success: true,
            message: 'Daily ward charges triggered successfully',
            totalVisits: admittedVisits.length
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
    reverseAllPatientCharges,
    reverseSelectedCharges,
    triggerDailyWardCharges,
};


