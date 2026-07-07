const Receipt = require('../models/receiptModel');
const Invoice = require('../models/invoiceModel');
const Patient = require('../models/patientModel');
const FamilyFile = require('../models/familyFileModel');

// @desc    Create receipt (collect payment)
// @route   POST /api/receipts
// @access  Private (cashier)
const createReceipt = async (req, res) => {
    const { invoiceId, paymentMethod } = req.body;

    try {
        const invoice = await Invoice.findById(invoiceId).populate('patient');

        if (!invoice) {
            return res.status(404).json({ message: 'Invoice not found' });
        }

        if (invoice.status === 'paid') {
            return res.status(400).json({ message: 'Invoice already paid' });
        }

        // Handle Deposit Payment
        if (paymentMethod === 'deposit') {
            const patient = await Patient.findById(invoice.patient._id);
            if (!patient) {
                return res.status(404).json({ message: 'Patient not found' });
            }

            const Visit = require('../models/visitModel');
            const visit = await Visit.findById(invoice.visit);
            const isAdmitted = visit && (
                visit.type === 'Inpatient' ||
                visit.encounterType === 'Inpatient' ||
                visit.encounterStatus === 'admitted' ||
                visit.encounterStatus === 'in_ward' ||
                visit.status === 'Admitted'
            );
            const creditLimit = isAdmitted ? 50000 : 0;

            if ((patient.depositBalance || 0) + creditLimit < invoice.totalAmount) {
                const errorMessage = isAdmitted
                    ? `Insufficient funds. Admitted patients have a credit limit of ₦50,000. Balance: ₦${patient.depositBalance || 0}, Required: ₦${invoice.totalAmount}`
                    : `Insufficient deposit balance. Balance: ₦${patient.depositBalance || 0}, Required: ₦${invoice.totalAmount}`;
                return res.status(400).json({ message: errorMessage });
            }

            // Deduct from deposit
            patient.depositBalance -= invoice.totalAmount;
            await patient.save();
        }

        // Generate unique receipt number: RCP-Timestamp-Random
        const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const receipt = await Receipt.create({
            invoice: invoiceId,
            patient: invoice.patient._id,
            amountPaid: invoice.totalAmount,
            paymentMethod: paymentMethod || invoice.paymentMethod,
            cashier: req.user._id,
            receiptNumber
        });

        // Mark invoice as paid
        invoice.status = 'paid';
        await invoice.save();

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate('invoice')
            .populate({ path: 'familyFile', model: 'FamilyFile' });

        res.status(201).json(populatedReceipt);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all receipts
// @route   GET /api/receipts
// @access  Private
const getReceipts = async (req, res) => {
    try {
        const receipts = await Receipt.find({})
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate('invoice')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            })
            .populate({ path: 'familyFile', model: 'FamilyFile' })
            .populate({ path: 'hmo', model: 'HMO' })
            .sort({ createdAt: -1 });
        res.json(receipts);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get receipt by ID
// @route   GET /api/receipts/:id
// @access  Private
const getReceiptById = async (req, res) => {
    try {
        const receipt = await Receipt.findById(req.params.id)
            .populate('patient')
            .populate('cashier', 'name')
            .populate('invoice')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            })
            .populate({ path: 'familyFile', model: 'FamilyFile' })
            .populate({ path: 'hmo', model: 'HMO' });

        if (receipt) {
            res.json(receipt);
        } else {
            res.status(404).json({ message: 'Receipt not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get receipts with claim status (for cashier dashboard)
// @route   GET /api/receipts/with-claim-status
// @access  Private
const getReceiptsWithClaimStatus = async (req, res) => {
    try {
        const Claim = require('../models/claimModel');

        // Get all receipts
        const receipts = await Receipt.find({})
            .populate('patient', 'name mrn provider')
            .populate('cashier', 'name')
            .populate('encounter')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            })
            .populate({ path: 'familyFile', model: 'FamilyFile' })
            .populate({ path: 'hmo', model: 'HMO' })
            .sort({ createdAt: -1 });

        // For each receipt, find associated claim if it exists
        const receiptsWithClaimStatus = await Promise.all(
            receipts.map(async (receipt) => {
                const receiptObj = receipt.toObject();

                // If receipt has an encounter, check for claim
                if (receipt.encounter) {
                    const claim = await Claim.findOne({ encounter: receipt.encounter._id })
                        .select('claimNumber status totalClaimAmount');

                    if (claim) {
                        receiptObj.claim = claim;
                        receiptObj.claimStatus = claim.status;
                    }
                }

                return receiptObj;
            })
        );

        res.json(receiptsWithClaimStatus);
    } catch (error) {
        console.error('Error fetching receipts with claim status:', error);
        res.status(500).json({ message: error.message });
    }
};

// V5: @desc    Create receipt for encounter charges
// @route   POST /api/receipts/encounter
// @access  Private (cashier)
const createReceiptForCharges = async (req, res) => {
    const { encounterId, chargeIds, paymentMethod } = req.body;

    try {
        const EncounterCharge = require('../models/encounterChargeModel');
        const Visit = require('../models/visitModel');

        // Get all charges
        const charges = await EncounterCharge.find({ _id: { $in: chargeIds } })
            .populate('patient')
            .populate('charge');

        if (charges.length === 0) {
            return res.status(404).json({ message: 'No charges found' });
        }

        // Calculate total
        const totalAmount = charges.reduce((sum, charge) => sum + charge.totalAmount, 0);
        const patientId = charges[0].patient._id;

        // Debug logging
        console.log('=== PAYMENT DEBUG ===');
        console.log('Number of charges:', charges.length);
        console.log('Charge IDs:', chargeIds);
        charges.forEach((charge, index) => {
            console.log(`Charge ${index + 1}:`, {
                id: charge._id,
                name: charge.charge?.name,
                quantity: charge.quantity,
                totalAmount: charge.totalAmount
            });
        });
        console.log('Total Amount to deduct:', totalAmount);
        console.log('====================');

        // Handle Deposit Payment
        if (paymentMethod === 'deposit') {
            const patient = await Patient.findById(patientId);
            if (!patient) {
                return res.status(404).json({ message: 'Patient not found' });
            }

            const visit = await Visit.findById(encounterId);
            const isAdmitted = visit && (
                visit.type === 'Inpatient' ||
                visit.encounterType === 'Inpatient' ||
                visit.encounterStatus === 'admitted' ||
                visit.encounterStatus === 'in_ward' ||
                visit.status === 'Admitted'
            );
            const creditLimit = isAdmitted ? 50000 : 0;

            console.log('Payment Check:', { isAdmitted, balance: patient.depositBalance, creditLimit, totalAmount });

            if ((patient.depositBalance || 0) + creditLimit < totalAmount) {
                const errorMessage = isAdmitted
                    ? `Insufficient funds. Admitted patients have a credit limit of ₦50,000. Balance: ₦${patient.depositBalance || 0}, Required: ₦${totalAmount}`
                    : `Insufficient deposit balance. Balance: ₦${patient.depositBalance || 0}, Required: ₦${totalAmount}`;
                return res.status(400).json({ message: errorMessage });
            }

            // Deduct from deposit
            patient.depositBalance -= totalAmount;
            console.log('Patient deposit after:', patient.depositBalance);
            await patient.save();
        }

        // Handle Retainership Payment
        if (paymentMethod === 'retainership') {
            const patient = await Patient.findById(patientId);
            if (!patient) {
                return res.status(404).json({ message: 'Patient not found' });
            }

            if (!['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient.provider)) {
                return res.status(400).json({ message: 'Patient is not a Retainership patient' });
            }

            const HMO = require('../models/hmoModel');
            const HMOTransaction = require('../models/hmoTransactionModel');

            const hmo = await HMO.findOne({ name: patient.hmo });
            if (!hmo) {
                return res.status(404).json({ message: `HMO '${patient.hmo}' not found` });
            }

            // Calculate HMO Balance
            // 1. Total Deposits
            const deposits = await HMOTransaction.find({ hmo: hmo._id });
            const totalDeposits = deposits.reduce((sum, d) => sum + d.amount, 0);

            // 2. Total Utilized (Charges for all patients of this HMO)
            const hmoPatients = await Patient.find({ hmo: hmo.name }).select('_id');
            const hmoPatientIds = hmoPatients.map(p => p._id);

            const existingCharges = await EncounterCharge.find({
                patient: { $in: hmoPatientIds },
                hmoPortion: { $gt: 0 }
            });
            const totalUtilized = existingCharges.reduce((sum, c) => sum + c.hmoPortion, 0);

            const balance = totalDeposits - totalUtilized;

            if (balance < totalAmount) {
                return res.status(400).json({
                    message: `Insufficient HMO Retainership balance. Balance: ₦${balance.toLocaleString()}, Required: ₦${totalAmount.toLocaleString()}`
                });
            }

            // Update charges to reflect HMO payment
            // We set hmoPortion to the total amount and patientPortion to 0
            // This ensures it counts towards 'Total Utilized' in the future
            await EncounterCharge.updateMany(
                { _id: { $in: chargeIds } },
                {
                    hmoPortion: totalAmount, // This might need to be per-charge, but updateMany sets same value. 
                    // Ideally we iterate if charges differ, but usually we pay full.
                    // Wait, updateMany with a static value sets that value for ALL docs.
                    // We need to set hmoPortion = totalAmount (of that specific charge).
                    // Since we can't reference the document's own field in a simple updateMany, 
                    // we should iterate or use a bulkWrite.
                }
            );

            // Correct approach for updating individual charges:
            const bulkOps = charges.map(charge => ({
                updateOne: {
                    filter: { _id: charge._id },
                    update: {
                        $set: {
                            hmoPortion: charge.totalAmount,
                            patientPortion: 0
                        }
                    }
                }
            }));
            await EncounterCharge.bulkWrite(bulkOps);
        }

        // Generate receipt number
        const receiptNumber = `RCP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Calculate amount paid based on payment method
        let amountPaid = totalAmount;
        if (paymentMethod === 'insurance') {
            // For insurance payments, only count the patient portion
            amountPaid = charges.reduce((sum, charge) => sum + (charge.patientPortion || 0), 0);
        }

        // Create receipt
        const receipt = await Receipt.create({
            patient: patientId,
            encounter: encounterId,
            charges: chargeIds,
            amountPaid: amountPaid,
            paymentMethod: paymentMethod || 'cash',
            cashier: req.user._id,
            receiptNumber,
            validated: false
        });

        // Mark charges as paid and link receipt
        await EncounterCharge.updateMany(
            { _id: { $in: chargeIds } },
            { status: 'paid', receipt: receipt._id }
        );

        // Update encounter payment status
        await Visit.findByIdAndUpdate(encounterId, {
            paymentValidated: true,
            receiptNumber: receiptNumber,
            encounterStatus: 'in_nursing' // Move to next stage after payment
        });

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate('encounter')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            })
            .populate({ path: 'familyFile', model: 'FamilyFile' });

        // Auto-generate HMO claim for NHIA/KSCHMA patients
        const patient = await Patient.findById(patientId);
        console.log('=== AUTO CLAIM GENERATION DEBUG ===');
        console.log('Patient provider:', patient?.provider);
        console.log('Patient HMO:', patient?.hmo);

        if (patient && (patient.provider === 'NHIA' || patient.provider === 'KSCHMA')) {
            console.log('Patient is NHIA/KSCHMA, proceeding with claim generation...');
            try {
                const Claim = require('../models/claimModel');
                const HMO = require('../models/hmoModel');

                // Check if claim already exists for this encounter
                const existingClaim = await Claim.findOne({ encounter: encounterId });
                console.log('Existing claim:', existingClaim ? 'Found' : 'Not found');

                if (patient.hmo) {
                    // Find the HMO
                    const hmo = await HMO.findOne({ name: patient.hmo });
                    console.log('HMO found:', hmo ? hmo.name : 'Not found');

                    if (hmo) {
                        const claimItems = [];
                        let totalClaimAmount = 0;

                        console.log('Processing charges:', charges.length);
                        for (const charge of charges) {
                            const chargeName = charge.itemName || charge.charge?.name || 'Service';
                            const chargeType = charge.itemType || charge.charge?.type || 'service';
                            const hmoPortion = charge.hmoPortion || 0;

                            console.log(`Charge: ${chargeName}, HMO Portion: ${hmoPortion}, Patient Portion: ${charge.patientPortion}`);

                            if (hmoPortion > 0) {
                                claimItems.push({
                                    charge: charge.charge?._id || null,
                                    chargeType: chargeType,
                                    description: chargeName,
                                    quantity: charge.quantity || 1,
                                    unitPrice: charge.unitPrice || charge.totalAmount,
                                    totalAmount: charge.totalAmount,
                                    patientPortion: charge.patientPortion || 0,
                                    hmoPortion: hmoPortion
                                });

                                totalClaimAmount += hmoPortion;
                            }
                        }

                        console.log('Total new claim items:', claimItems.length);
                        console.log('Total new claim amount:', totalClaimAmount);

                        // Only process if there's an HMO portion
                        if (totalClaimAmount > 0) {
                            if (existingClaim) {
                                // Update existing claim - add new items and update total
                                existingClaim.claimItems.push(...claimItems);
                                existingClaim.totalClaimAmount += totalClaimAmount;
                                await existingClaim.save();

                                console.log(`✅ Updated existing claim ${existingClaim.claimNumber} with ${claimItems.length} new items, new total: ₦${existingClaim.totalClaimAmount}`);
                            } else {
                                // Create new claim
                                const year = new Date().getFullYear();
                                const claimCount = await Claim.countDocuments();
                                const claimNumber = `CLM-${year}-${String(claimCount + 1).padStart(4, '0')}`;

                                const newClaim = await Claim.create({
                                    claimNumber: claimNumber,
                                    patient: patient._id,
                                    hmo: hmo._id,
                                    encounter: encounterId,
                                    claimItems: claimItems,
                                    totalClaimAmount: totalClaimAmount,
                                    status: 'pending'
                                });

                                console.log(`✅ Auto-generated new claim ${newClaim.claimNumber} for encounter ${encounterId}, amount: ₦${totalClaimAmount}`);
                            }
                        } else {
                            console.log('❌ No HMO portion found in charges, claim not created/updated');
                        }
                    } else {
                        console.log('❌ HMO not found in database');
                    }
                } else {
                    console.log('❌ Patient has no HMO assigned');
                }
            } catch (claimError) {
                // Log error but don't fail the payment
                console.error('❌ Error auto-generating claim:', claimError);
            }
        } else {
            console.log('Patient is not NHIA/KSCHMA, skipping claim generation');
        }
        console.log('=== END AUTO CLAIM GENERATION DEBUG ===');

        res.status(201).json(populatedReceipt);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// V5: @desc    Validate receipt (for department access)
// @route   POST /api/receipts/validate
// @access  Private
const validateReceipt = async (req, res) => {
    const { receiptNumber, department } = req.body;

    try {
        const receipt = await Receipt.findOne({ receiptNumber })
            .populate('patient', 'name mrn')
            .populate('encounter')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            })
            .populate({ path: 'familyFile', model: 'FamilyFile' });

        if (!receipt) {
            return res.status(404).json({ valid: false, message: 'Receipt not found' });
        }

        // Check if already validated by this department
        const alreadyValidated = receipt.validatedBy?.some(v =>
            v.department === department && v.user.toString() === req.user._id.toString()
        );

        if (!alreadyValidated) {
            // Add validation record
            receipt.validatedBy.push({
                user: req.user._id,
                department,
                timestamp: Date.now()
            });
            receipt.validated = true;
            await receipt.save();
        }

        res.json({
            valid: true,
            receipt,
            message: 'Receipt validated successfully'
        });
    } catch (error) {
        res.status(500).json({ valid: false, message: error.message });
    }
};

// V5: @desc    Get receipt by receipt number
// @route   GET /api/receipts/number/:receiptNumber
// @access  Private
const getReceiptByNumber = async (req, res) => {
    try {
        const receipt = await Receipt.findOne({ receiptNumber: req.params.receiptNumber })
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate('encounter')
            .populate({
                path: 'charges',
                populate: { path: 'charge' }
            })
            .populate({ path: 'familyFile', model: 'FamilyFile' })
            .populate({ path: 'hmo', model: 'HMO' });

        if (receipt) {
            res.json(receipt);
        } else {
            res.status(404).json({ message: 'Receipt not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Reverse a receipt (refund payment)
// @route   POST /api/receipts/:id/reverse
// @access  Private (admin/cashier)
const reverseReceipt = async (req, res) => {
    const { chargeIds } = req.body; // Optional array of charge IDs to reverse

    try {
        const receipt = await Receipt.findById(req.params.id)
            .populate({ path: 'charges', populate: { path: 'charge' } })
            .populate('patient', 'name mrn depositBalance')
            .populate({ path: 'hmo', model: 'HMO' })
            .populate('cashier', 'name');

        if (!receipt) {
            return res.status(404).json({ message: 'Receipt not found' });
        }

        const EncounterCharge = require('../models/encounterChargeModel');
        let amountToReverse = 0;
        let chargesToProcess = [];

        if (chargeIds && Array.isArray(chargeIds) && chargeIds.length > 0) {
            // Partial reversal
            chargesToProcess = receipt.charges.filter(c => chargeIds.includes(c._id.toString()));

            if (chargesToProcess.length === 0) {
                return res.status(400).json({ message: 'No matching charges found in this receipt' });
            }

            amountToReverse = chargesToProcess.reduce((sum, c) => sum + c.totalAmount, 0);
        } else {
            // Full reversal (legacy or explicit)
            chargesToProcess = receipt.charges;
            amountToReverse = receipt.amountPaid;
        }

        // 1. Restore patient deposit if applicable
        if (receipt.paymentMethod === 'deposit') {
            const patient = await Patient.findById(receipt.patient._id);
            if (patient) {
                patient.depositBalance += amountToReverse;
                await patient.save();
            }
        }

        // 2. Handle Inventory Return and Partial Quantity Logic
        const { returnDetails } = req.body;
        // Filter out any invalid charges before processing to prevent crashes
        const validChargesToProcess = (chargesToProcess || []).filter(c => c && c._id);
        const processedChargeIds = validChargesToProcess.map(c => c._id.toString());
        let totalRefunded = 0;

        if (returnDetails && Array.isArray(returnDetails) && returnDetails.length > 0) {
            const Inventory = require('../models/inventoryModel');

            for (const detail of returnDetails) {
                const { chargeId, quantity: returnQty } = detail;
                const charge = validChargesToProcess.find(c => c._id.toString() === chargeId);

                // Track pharmacy types flexibly
                const isPharmacyItem = charge && (
                    charge.itemType?.toLowerCase() === 'pharmacy' ||
                    charge.itemType?.toLowerCase() === 'drugs' ||
                    charge.itemType?.toLowerCase() === 'drug' ||
                    charge.charge?.type?.toLowerCase() === 'pharmacy' ||
                    charge.charge?.type?.toLowerCase() === 'drugs' ||
                    charge.charge?.type?.toLowerCase() === 'drug'
                );

                if (isPharmacyItem && returnQty > 0) {
                    const returnQtyNum = Number(returnQty);

                    // a. Restore to Inventory
                    // Fallback to charge.name if itemName is missing (common for internal prescriptions)
                    const drugName = charge.itemName || (charge.charge && charge.charge.name);

                    if (!drugName) {
                        console.warn(`Could not determine drug name for charge ${chargeId}`);
                        continue;
                    }

                    const inventoryItem = await Inventory.findOne({
                        name: { $regex: new RegExp(`^${drugName}$`, 'i') },
                        expiryDate: { $gte: new Date() }
                    }).sort({ expiryDate: -1 });

                    if (inventoryItem) {
                        inventoryItem.quantity += returnQtyNum;
                        await inventoryItem.save();
                    }

                    // b. Handle Partial Quantity vs Full Reversal
                    if (returnQtyNum < charge.quantity) {
                        // PARTIAL quantity reversal
                        const originalQty = charge.quantity;
                        const factor = (originalQty - returnQtyNum) / originalQty;
                        const reverseFactor = returnQtyNum / originalQty;

                        const refundAmountForCharge = (charge.totalAmount || 0) * reverseFactor;
                        totalRefunded += refundAmountForCharge;

                        // Update EncounterCharge
                        charge.quantity -= returnQtyNum;
                        charge.totalAmount -= refundAmountForCharge;
                        charge.patientPortion *= factor;
                        charge.hmoPortion *= factor;
                        await charge.save();

                        // This charge stays on the receipt, remove from "fully reversed" list
                        const index = processedChargeIds.indexOf(charge._id.toString());
                        if (index > -1) {
                            processedChargeIds.splice(index, 1);
                        }
                    } else {
                        // FULL quantity reversal for this charge
                        totalRefunded += (charge.totalAmount || 0);
                    }
                } else if (charge) {
                    // Item selected for full reversal
                    totalRefunded += (charge.totalAmount || 0);
                }
            }
        } else {
            // Standard path: all selected charges are fully reversed
            totalRefunded = amountToReverse;
        }

        // 3. Restore patient deposit if applicable
        if (receipt.paymentMethod === 'deposit') {
            const patient = await Patient.findById(receipt.patient?._id || receipt.patient);
            if (patient) {
                patient.depositBalance += totalRefunded;
                await patient.save();
            }
        }

        // 4. Reset charge statuses to 'pending' for those FULLY reversed
        if (processedChargeIds.length > 0) {
            await EncounterCharge.updateMany(
                { _id: { $in: processedChargeIds } },
                { status: 'pending', $unset: { receipt: "" } }
            );
        }

        // 5. Update or Delete the receipt
        // Filter out any potential nulls or deleted charges
        const remainingChargesOnReceipt = (receipt.charges || []).filter(c =>
            c && c._id && !processedChargeIds.includes(c._id.toString())
        );

        if (remainingChargesOnReceipt.length === 0) {
            // All charges reversed -> Delete receipt
            await Receipt.findByIdAndDelete(req.params.id);
            res.json({
                message: 'Receipt reversed and deleted successfully',
                amountReversed: totalRefunded,
                fullReversal: true
            });
        } else {
            // Partial reversal -> Update receipt
            receipt.amountPaid = Math.max(0, (receipt.amountPaid || 0) - totalRefunded);
            // Ensure we only save IDs back to the charges array
            receipt.charges = remainingChargesOnReceipt.map(c => c._id);
            await receipt.save();

            res.json({
                message: 'Partial reversal successful',
                amountReversed: totalRefunded,
                remainingAmount: receipt.amountPaid,
                fullReversal: false
            });
        }
    } catch (error) {
        console.error('Reversal Error:', error);
        res.status(500).json({ message: error.message });
    }
};


// @desc    Create receipt for family file registration
// @route   POST /api/receipts/family-file
// @access  Private (cashier)
const createFamilyFileReceipt = async (req, res) => {
    const { familyFileId, paymentMethod } = req.body;

    try {
        const familyFile = await FamilyFile.findById(familyFileId).populate('familyCharge');
        if (!familyFile) {
            return res.status(404).json({ message: 'Family File not found' });
        }

        if (familyFile.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'Family registration already paid' });
        }

        // Generate receipt number
        const receiptNumber = `RCP-FAM-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create receipt
        const receipt = await Receipt.create({
            familyFile: familyFileId,
            amountPaid: familyFile.registrationCharge,
            paymentMethod: paymentMethod || 'cash',
            cashier: req.user._id,
            receiptNumber
        });

        // Update family file status
        familyFile.paymentStatus = 'paid';
        familyFile.paidAt = Date.now();
        await familyFile.save();

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate({ path: 'familyFile', model: 'FamilyFile' })
            .populate('cashier', 'name');

        res.status(201).json(populatedReceipt);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Create receipt for HMO/Retainership registration
// @route   POST /api/receipts/hmo-registration
// @access  Private (cashier)
const createHMOReceipt = async (req, res) => {
    const { hmoId, paymentMethod } = req.body;

    try {
        const HMO = require('../models/hmoModel');
        const HMOTransaction = require('../models/hmoTransactionModel');
        const EncounterCharge = require('../models/encounterChargeModel');
        const Patient = require('../models/patientModel');

        const hmo = await HMO.findById(hmoId);
        if (!hmo) {
            return res.status(404).json({ message: 'Retainership entity not found' });
        }

        if (hmo.paymentStatus === 'paid') {
            return res.status(400).json({ message: 'Registration fee already paid' });
        }

        const registrationCharge = hmo.registrationCharge || 0;

        // Handle Deposit Payment
        if (paymentMethod === 'deposit') {
            // Calculate HMO Balance
            // 1. Total Deposits
            const hmoTransactions = await HMOTransaction.find({ hmo: hmo._id });
            const totalDeposits = hmoTransactions
                .filter(t => t.type === 'deposit')
                .reduce((sum, d) => sum + d.amount, 0);

            const manualCharges = hmoTransactions
                .filter(t => t.type === 'charge')
                .reduce((sum, c) => sum + c.amount, 0);

            // 2. Total Utilized (Charges for all patients of this HMO)
            const hmoPatients = await Patient.find({ hmo: hmo.name }).select('_id');
            const hmoPatientIds = hmoPatients.map(p => p._id);

            const existingCharges = await EncounterCharge.find({
                patient: { $in: hmoPatientIds },
                hmoPortion: { $gt: 0 }
            });
            const totalUtilized = existingCharges.reduce((sum, c) => sum + c.hmoPortion, 0);

            const totalDepositsNum = Number(totalDeposits) || 0;
            const totalUtilizedNum = Number(totalUtilized) || 0;
            const manualChargesNum = Number(manualCharges) || 0;
            const balanceNum = totalDepositsNum - (totalUtilizedNum + manualChargesNum);
            const requiredAmount = Number(registrationCharge) || 0;

            console.log('--- HMO DEPOSIT CHECK DEBUG (REFINED) ---');
            console.log('Total Deposits Num:', totalDepositsNum);
            console.log('Total Utilized Num:', totalUtilizedNum);
            console.log('Manual Charges Num:', manualChargesNum);
            console.log('Balance Num:', balanceNum);
            console.log('Required Amount:', requiredAmount);
            console.log('-------------------------------');

            if (totalDepositsNum === 0) {
                return res.status(400).json({
                    message: "No initial deposit was found for this retainership. Please make a deposit first."
                });
            }

            if (balanceNum < requiredAmount) {
                return res.status(400).json({
                    message: `Insufficient HMO Retainership balance. Balance: ₦${balanceNum.toLocaleString()}, Required: ₦${requiredAmount.toLocaleString()}`
                });
            }

            // Create negative transaction (charge) for registration
            await HMOTransaction.create({
                hmo: hmoId,
                type: 'charge',
                amount: registrationCharge,
                description: 'Retainership Registration Fee (Deducted from Deposit)',
                recordedBy: req.user._id
            });
        }

        // Generate receipt number
        const receiptNumber = `RCP-HMO-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        // Create receipt
        const receipt = await Receipt.create({
            hmo: hmoId,
            amountPaid: registrationCharge,
            paymentMethod: paymentMethod || 'cash',
            cashier: req.user._id,
            receiptNumber
        });

        // Update HMO status
        hmo.paymentStatus = 'paid';
        hmo.paidAt = Date.now();
        await hmo.save();

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate({ path: 'hmo', model: 'HMO' })
            .populate('cashier', 'name');

        res.status(201).json(populatedReceipt);
    } catch (error) {
        console.error('Error creating HMO receipt:', error);
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    createReceipt,
    getReceipts,
    getReceiptById,
    getReceiptsWithClaimStatus,
    createReceiptForCharges,
    validateReceipt,
    getReceiptByNumber,
    reverseReceipt,
    createFamilyFileReceipt,
    createHMOReceipt
};
