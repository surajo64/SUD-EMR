const Receipt = require('../models/receiptModel');
const Invoice = require('../models/invoiceModel');
const Patient = require('../models/patientModel');

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
            .populate('invoice');

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
            });

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
            console.log('Patient deposit before:', patient.depositBalance);
            if ((patient.depositBalance || 0) < totalAmount) {
                return res.status(400).json({
                    message: `Insufficient deposit balance. Balance: ₦${patient.depositBalance || 0}, Required: ₦${totalAmount}`
                });
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

            if (patient.provider !== 'Retainership') {
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
            });

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
            });

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
            });

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
    try {
        const receipt = await Receipt.findById(req.params.id)
            .populate({ path: 'charges', populate: { path: 'charge' } })
            .populate('patient', 'name mrn depositBalance')
            .populate('cashier', 'name');

        if (!receipt) {
            return res.status(404).json({ message: 'Receipt not found' });
        }

        // If payment was made via deposit, restore the amount to patient's deposit
        if (receipt.paymentMethod === 'deposit') {
            const patient = await Patient.findById(receipt.patient._id);
            if (patient) {
                patient.depositBalance += receipt.amountPaid;
                await patient.save();
            }
        }

        // Mark the receipt as reversed (you could add a 'status' field to Receipt model)
        // For now, we'll delete it or you can add a status field
        await Receipt.findByIdAndDelete(req.params.id);

        res.json({
            message: 'Payment reversed successfully',
            amountReversed: receipt.amountPaid,
            depositRestored: receipt.paymentMethod === 'deposit'
        });
    } catch (error) {
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
};
