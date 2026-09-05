const EncounterCharge = require('../models/encounterChargeModel');
const Patient = require('../models/patientModel');
const Receipt = require('../models/receiptModel');
const HMO = require('../models/hmoModel');
const HMOTransaction = require('../models/hmoTransactionModel');
const User = require('../models/userModel');

/**
 * Attempts to automatically deduct payment for a bed fee charge from standard patient deposits
 * or HMO retainership deposits.
 * @param {Object} charge Mongoose EncounterCharge document
 * @param {Object} visit Mongoose Visit document with populated patient
 * @param {String} userId Cashier or system user ID
 */
const attemptPaymentForCharge = async (charge, visit, userId) => {
    const patient = visit.patient;
    if (!patient) return;

    const provider = patient.provider || 'Standard';
    const amount = charge.totalAmount;

    // Resolve system user for cashier field if none provided (required by Receipt schema)
    let cashierId = userId;
    if (!cashierId) {
        try {
            const defaultUser = await User.findOne({ role: 'admin' }) 
                || await User.findOne({ role: 'cashier' }) 
                || await User.findOne({});
            if (defaultUser) {
                cashierId = defaultUser._id;
            }
        } catch (e) {
            console.error('[BedFeeBilling] Error finding default user:', e);
        }
    }

    if (!cashierId) {
        console.error('[BedFeeBilling] Cannot auto-pay charge: No user/cashier available.');
        return;
    }

    try {
        if (provider === 'Standard') {
            const currentBalance = patient.depositBalance || 0;

            // Bed fee billing is strictly for admitted patients.
            // Deduct from deposit balance (allows negative balance while admitted)
            patient.depositBalance = currentBalance - amount;
            await patient.save();

            // Create Receipt
            const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
            const receipt = await Receipt.create({
                patient: patient._id,
                encounter: visit._id,
                charges: [charge._id],
                amountPaid: amount,
                paymentMethod: 'deposit',
                cashier: cashierId,
                receiptNumber,
                validated: true,
                paymentDate: charge.createdAt,
                createdAt: charge.createdAt,
                updatedAt: charge.createdAt
            });

            // Update charge status to paid
            charge.status = 'paid';
            charge.receipt = receipt._id;
            await charge.save();

            console.log(`[BedFeeBilling] Auto-paid pending charge ${charge._id} from deposit. New Balance: ${patient.depositBalance}`);
            return true; // success
        } else if (['Retainership', 'Corporate Retainership', 'Family Retainership', 'Joud Alkhair Retainership'].includes(provider)) {
            // Deduct from HMO Retainership balance (overdraft allowed — balance may go negative)
            const hmo = await HMO.findOne({ name: patient.hmo });
            if (hmo) {
                // Create Receipt (always — overdraft allowed)
                const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;
                const receipt = await Receipt.create({
                    patient: patient._id,
                    encounter: visit._id,
                    charges: [charge._id],
                    amountPaid: amount,
                    paymentMethod: 'retainership',
                    hmo: hmo._id,
                    cashier: cashierId,
                    receiptNumber,
                    validated: true,
                    paymentDate: charge.createdAt,
                    createdAt: charge.createdAt,
                    updatedAt: charge.createdAt
                });

                // Update charge status to paid and confirm HMO coverage
                charge.status = 'paid';
                charge.receipt = receipt._id;
                charge.hmoPortion = amount;
                charge.patientPortion = 0;
                await charge.save();

                console.log(`[BedFeeBilling] Auto-paid pending charge ${charge._id} from HMO Retainership (${hmo.name}) — overdraft allowed.`);
                return true; // success
            } else {
                console.log(`[BedFeeBilling] HMO not found for name: ${patient.hmo}`);
                return false;
            }
        }
    } catch (paymentError) {
        console.error(`[BedFeeBilling] Error processing auto-payment for charge ${charge._id}:`, paymentError);
    }
};

/**
 * Creates a bed fee charge and initiates auto-payment deduction.
 * @param {Object} visit Populated visit document (must have populated ward and patient)
 * @param {Boolean} isInitial True if it's the initial admission charge
 * @param {Date} chargeDate Date of the charge (for backdating/past days)
 * @param {String} userId Cashier or system user ID (optional)
 */
const processBedFeeCharge = async (visit, isInitial, chargeDate, userId) => {
    const patient = visit.patient;
    const ward = visit.ward;
    if (!patient || !ward) return null;

    // Resolve daily fee based on provider using ward rates
    const provider = patient.provider || 'Standard';
    let dailyFee = 0;
    if (provider === 'Retainership' || provider === 'Corporate Retainership' || provider === 'Family Retainership' || provider === 'Joud Alkhair Retainership') {
        dailyFee = ward.rates?.Retainership || ward.dailyRate || 0;
    } else if (provider === 'NHIA') {
        dailyFee = ward.rates?.NHIA || ward.dailyRate || 0;
    } else if (provider === 'KSCHMA') {
        dailyFee = ward.rates?.KSCHMA || ward.dailyRate || 0;
    } else {
        dailyFee = ward.rates?.Standard || ward.dailyRate || 0;
    }

    if (dailyFee <= 0) {
        console.log(`[BedFeeBilling] Daily fee is 0 for ward ${ward.name} / provider ${provider}. Skipping.`);
        return null;
    }

    // Determine portions
    let patientPortion = dailyFee;
    let hmoPortion = 0;
    if (['Retainership', 'Corporate Retainership', 'Family Retainership', 'Joud Alkhair Retainership', 'NHIA', 'KSCHMA'].includes(provider)) {
        patientPortion = 0;
        hmoPortion = dailyFee;
    }

    const itemName = isInitial 
        ? `Initial Ward Charge - ${ward.name} (${provider})`
        : `Daily Ward Charge - ${ward.name} (${provider})`;

    // Create the pending encounter charge first
    const charge = await EncounterCharge.create({
        encounter: visit._id,
        patient: patient._id,
        itemType: 'Daily Bed Fee',
        itemName,
        unitPrice: dailyFee,
        quantity: 1,
        totalAmount: dailyFee,
        patientPortion,
        hmoPortion,
        status: 'pending',
        addedBy: userId || undefined,
        createdAt: chargeDate,
        updatedAt: chargeDate
    });

    console.log(`[BedFeeBilling] Created daily bed fee charge ${charge._id} (${itemName}) for patient ${patient.name}`);

    // Try paying immediately
    await attemptPaymentForCharge(charge, visit, userId);

    return charge;
};

/**
 * Checks and generates missing daily bed fees for a specific visit.
 * @param {Object} visitOrId Visit document or its ID
 * @param {Date} currentDate Current evaluation date
 * @param {String} userId Cashier or system user ID (optional)
 */
const checkAndGenerateBedFeesForVisit = async (visitOrId, currentDate = new Date(), userId = null) => {
    try {
        const visitId = visitOrId._id || visitOrId;
        const Visit = require('../models/visitModel');
        
        const visit = await Visit.findById(visitId).populate('ward').populate('patient');
        if (!visit) {
            console.log(`[BedFeeBilling] Visit not found: ${visitId}`);
            return;
        }

        if (!visit.ward) {
            console.log(`[BedFeeBilling] Visit ${visit._id} has no ward assigned.`);
            return;
        }

        if (
            ['discharged', 'completed', 'cancelled'].includes(visit.encounterStatus) ||
            visit.status === 'Discharged' ||
            visit.dischargeDate ||
            visit.isActive === false
        ) {
            console.log(`[BedFeeBilling] Visit ${visit._id} is discharged or inactive. Skipping bed fee billing.`);
            return;
        }

        const admissionDate = visit.admissionDate || visit.createdAt;
        if (!admissionDate) {
            console.log(`[BedFeeBilling] Visit ${visit._id} has no admission/creation date.`);
            return;
        }

        const diffTime = Math.max(0, new Date(currentDate) - new Date(admissionDate));
        const totalDaysExpected = Math.floor(diffTime / (24 * 60 * 60 * 1000)) + 1;

        // Fetch existing daily bed fee charges for this encounter
        const existingCharges = await EncounterCharge.find({
            encounter: visit._id,
            itemType: 'Daily Bed Fee'
        }).sort({ createdAt: 1 });

        console.log(`[BedFeeBilling] Visit ${visit._id} admitted since ${new Date(admissionDate).toISOString()}: Expected ${totalDaysExpected} charges, Found ${existingCharges.length} charges.`);

        // 1. Process/attempt payment on any existing charges that are still pending.
        //    Stop retrying as soon as one payment fails — if balance is insufficient
        //    for one charge, it will be insufficient for all remaining ones too.
        let paymentBlocked = false;
        let blockedCount = 0;
        for (const charge of existingCharges) {
            if (charge.status === 'pending') {
                if (paymentBlocked) {
                    blockedCount++;
                    continue; // skip without spamming logs
                }
                console.log(`[BedFeeBilling] Attempting auto-pay for pending charge ${charge._id} (${charge.itemName}).`);
                const paid = await attemptPaymentForCharge(charge, visit, userId);
                if (paid === false) {
                    paymentBlocked = true; // stop trying further charges for this visit
                }
            }
        }
        if (blockedCount > 0) {
            console.log(`[BedFeeBilling] Skipped ${blockedCount} additional pending charges for patient ${visit.patient?.name || visit._id} (insufficient balance).`);
        }

        // 2. Generate and pay any missing charges for subsequent days
        if (existingCharges.length < totalDaysExpected) {
            for (let i = existingCharges.length; i < totalDaysExpected; i++) {
                const chargeDate = new Date(new Date(admissionDate).getTime() + i * 24 * 60 * 60 * 1000);
                const isInitial = (i === 0);
                await processBedFeeCharge(visit, isInitial, chargeDate, userId);
            }
        }
    } catch (error) {
        console.error(`[BedFeeBilling] Error checking bed fees for visit ${visitOrId._id || visitOrId}:`, error);
    }
};

module.exports = {
    attemptPaymentForCharge,
    processBedFeeCharge,
    checkAndGenerateBedFeesForVisit
};
