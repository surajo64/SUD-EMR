const Pharmacy = require('../models/pharmacyModel');
const Inventory = require('../models/inventoryModel');
const Patient = require('../models/patientModel');
const Visit = require('../models/visitModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Receipt = require('../models/receiptModel');

const getHMOWalletBalance = async (hmoName) => {
    const HMO = require('../models/hmoModel');
    const HMOTransaction = require('../models/hmoTransactionModel');
    const EncounterCharge = require('../models/encounterChargeModel');
    const Patient = require('../models/patientModel');

    const hmo = await HMO.findOne({ name: hmoName });
    if (!hmo) return 0;

    const transactions = await HMOTransaction.find({ hmo: hmo._id });
    const totalDeposits = transactions
        .filter(t => t.type === 'deposit')
        .reduce((sum, d) => sum + d.amount, 0);

    const manualCharges = transactions
        .filter(t => t.type === 'charge')
        .reduce((sum, c) => sum + c.amount, 0);

    const refunds = transactions
        .filter(t => t.type === 'refund')
        .reduce((sum, r) => sum + r.amount, 0);

    const hmoPatients = await Patient.find({ hmo: hmo.name }).select('_id');
    const hmoPatientIds = hmoPatients.map(p => p._id);

    const charges = await EncounterCharge.find({
        patient: { $in: hmoPatientIds },
        hmoPortion: { $gt: 0 }
    });
    const totalUtilized = charges.reduce((sum, c) => sum + c.hmoPortion, 0);

    return totalDeposits - (totalUtilized + manualCharges + refunds);
};

// @desc    Process a direct/walk-in POS sale at pharmacy
// @route   POST /api/pharmacies/pos-sale
// @access  Private (Pharmacist)
const processDirectSale = async (req, res) => {
    try {
        const { patientId, customerName, items, discount, tax, paymentMethod, prescriptionImageUrl } = req.body;
        // items: [{ inventoryId, name, quantity, unitPrice }]

        if (!patientId && (!customerName || !customerName.trim())) {
            return res.status(400).json({ message: 'Customer name is required.' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No items in cart.' });
        }

        // ── 1. Inventory Validation & Stock Check ──────────────────────────────
        const pharmacyFilter = {};
        if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
            pharmacyFilter.pharmacy = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const inventoryUpdates = [];
        let subtotal = 0;

        console.log('POS Sale Items:', JSON.stringify(items));
        console.log('Pharmacy Filter:', JSON.stringify(pharmacyFilter));

        for (const item of items) {
            const { inventoryId, name, quantity, unitPrice } = item;

            // Find all valid stock batches for this drug (FIFO by expiry date)
            let query = {
                quantity: { $gt: 0 },
                expiryDate: { $gte: today },
                ...pharmacyFilter
            };

            if (inventoryId) {
                query._id = inventoryId;
            } else {
                query.name = { $regex: new RegExp(`^${name}$`, 'i') };
            }

            console.log(`Searching for "${name}" with query:`, JSON.stringify(query));
            let batches = await Inventory.find(query).sort({ expiryDate: 1 });

            // If lookup by ID came back empty, broaden search by name
            if (batches.length === 0 && inventoryId) {
                console.log(`No batches found for ID ${inventoryId}, trying name fallback for "${name}"`);
                const nameQuery = {
                    name: { $regex: new RegExp(`^${name}$`, 'i') },
                    quantity: { $gt: 0 },
                    expiryDate: { $gte: today },
                    ...pharmacyFilter
                };
                batches = await Inventory.find(nameQuery).sort({ expiryDate: 1 });
            }

            console.log(`Found ${batches.length} batches for "${name}"`);
            const totalAvailable = batches.reduce((sum, b) => sum + b.quantity, 0);
            console.log(`Total available for "${name}": ${totalAvailable}`);

            if (totalAvailable < quantity) {
                return res.status(400).json({
                    message: `Insufficient stock for "${name}". Available: ${totalAvailable}, Requested: ${quantity}`
                });
            }

            inventoryUpdates.push({ batches, name, quantity, unitPrice });
            subtotal += unitPrice * quantity;
        }

        // Apply discount and tax to get the total amount first
        const discountAmt = parseFloat(discount) || 0;
        const taxAmt = parseFloat(tax) || 0;
        const totalAmount = subtotal - discountAmt + taxAmt;

        // ── 2. Create or find patient record & Handle Wallet / Retainership Detection ──
        let salePatient;
        let finalPaymentMethod = paymentMethod || 'cash';
        let isRetainership = false;
        let isWalletDeduction = false;

        if (patientId) {
            salePatient = await Patient.findById(patientId);
            if (!salePatient) {
                return res.status(404).json({ message: 'Selected patient not found.' });
            }

            const isRetainershipProvider = ['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(salePatient.provider);

            if (isRetainershipProvider && paymentMethod === 'retainership') {
                const hmoBalance = salePatient.hmo ? await getHMOWalletBalance(salePatient.hmo) : 0;
                if (hmoBalance >= totalAmount) {
                    isRetainership = true;
                    finalPaymentMethod = 'retainership';
                } else {
                    isRetainership = false; // reset to prevent HMO portions logic
                    finalPaymentMethod = 'cash';
                }
            } else if (!isRetainershipProvider && paymentMethod === 'deposit') {
                if (salePatient.depositBalance >= totalAmount) {
                    finalPaymentMethod = 'deposit';
                    isWalletDeduction = true;
                    salePatient.depositBalance -= totalAmount;
                    await salePatient.save();
                    console.log(`Deducted ₦${totalAmount} from patient ${salePatient.name} wallet. New balance: ₦${salePatient.depositBalance}`);
                } else {
                    finalPaymentMethod = 'cash';
                }
            } else {
                finalPaymentMethod = paymentMethod || 'cash';
                isRetainership = false;
            }
        } else {
            // Walk-in patients don't have MRN but we create a Visit under their name
            const walkInMrn = `WI-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            salePatient = await Patient.create({
                mrn: walkInMrn,
                name: customerName.trim(),
                age: 0,           // Unknown for walk-ins
                gender: 'Unknown',
                contact: 'Walk-in',
                provider: 'Standard',
                depositBalance: 0
            });
        }

        // ── 3. Create a Walk-in Visit (encounter) ──────────────────────────────
        const walkInVisit = await Visit.create({
            patient: salePatient._id,
            doctor: req.user._id,  // Pharmacist acts as the encounter creator
            type: 'External Pharmacy',
            status: 'Discharged',
            encounterStatus: 'completed',
            paymentValidated: true,
            reasonForVisit: 'Direct Pharmacy Purchase (POS)',
            notes: prescriptionImageUrl ? [{
                text: `Prescription image: ${prescriptionImageUrl}`,
                author: req.user.name || 'Pharmacist',
                role: 'pharmacist'
            }] : []
        });

        // ── 4. Deduct Inventory (FIFO) and create EncounterCharges ────────────
        const createdChargeIds = [];

        for (const update of inventoryUpdates) {
            const { batches, name, quantity, unitPrice } = update;

            // FIFO deduction
            let remaining = quantity;
            for (const batch of batches) {
                if (remaining <= 0) break;
                const deduct = Math.min(batch.quantity, remaining);
                batch.quantity -= deduct;
                remaining -= deduct;
                await batch.save();
            }

            // Create EncounterCharge for revenue tracking
            const totalAmountItem = unitPrice * quantity;

            let patientPortion = totalAmountItem;
            let hmoPortion = 0;

            if (patientId) {
                if (isRetainership) {
                    patientPortion = 0;
                    hmoPortion = totalAmountItem;
                } else if (['NHIA', 'KSCHMA'].includes(salePatient.provider)) {
                    patientPortion = totalAmountItem * 0.1;
                    hmoPortion = totalAmountItem * 0.9;
                }
            }

            const charge = await EncounterCharge.create({
                encounter: walkInVisit._id,
                patient: salePatient._id,
                quantity,
                unitPrice,
                totalAmount: totalAmountItem,
                patientPortion,
                hmoPortion,
                status: 'paid',
                addedBy: req.user._id,
                itemType: 'Pharmacy',
                itemName: name,
                department: 'Pharmacy',
                notes: `POS Sale by ${req.user.name || 'Pharmacist'}`
            });

            createdChargeIds.push(charge._id);
        }

        // ── 5. Create Receipt (marks the sale as paid/revenue) ─────────────────
        const receiptNumber = `POS-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const amountPaid = (patientId && ['NHIA', 'KSCHMA'].includes(salePatient.provider)) ? totalAmount * 0.1 : totalAmount;

        const receipt = await Receipt.create({
            patient: salePatient._id,
            encounter: walkInVisit._id,
            charges: createdChargeIds,
            amountPaid: amountPaid < 0 ? 0 : amountPaid,
            paymentMethod: finalPaymentMethod,
            cashier: req.user._id,
            receiptNumber,
            validated: true,
            validatedBy: [{
                user: req.user._id,
                department: 'Pharmacy',
                timestamp: new Date()
            }]
        });

        // ── 6. Link receipt on charges ─────────────────────────────────────────
        await EncounterCharge.updateMany(
            { _id: { $in: createdChargeIds } },
            { receipt: receipt._id }
        );

        // ── 7. Auto-generate HMO claim for NHIA/KSCHMA patients ───────────────
        if (patientId && ['NHIA', 'KSCHMA'].includes(salePatient.provider)) {
            try {
                const Claim = require('../models/claimModel');
                const HMO = require('../models/hmoModel');

                if (salePatient.hmo) {
                    const hmo = await HMO.findOne({ name: salePatient.hmo });
                    if (hmo) {
                        const claimItems = items.map((item, index) => {
                            const totalAmountItem = item.unitPrice * item.quantity;
                            return {
                                charge: createdChargeIds[index],
                                chargeType: 'Pharmacy',
                                description: item.name,
                                quantity: item.quantity,
                                unitPrice: item.unitPrice,
                                totalAmount: totalAmountItem,
                                patientPortion: totalAmountItem * 0.1,
                                hmoPortion: totalAmountItem * 0.9
                            };
                        });

                        const totalClaimAmount = totalAmount * 0.9;
                        const year = new Date().getFullYear();
                        const claimCount = await Claim.countDocuments();
                        const claimNumber = `CLM-${year}-${String(claimCount + 1).padStart(4, '0')}`;

                        await Claim.create({
                            claimNumber,
                            patient: salePatient._id,
                            hmo: hmo._id,
                            encounter: walkInVisit._id,
                            claimItems,
                            totalClaimAmount,
                            status: 'pending'
                        });
                        console.log(`✅ POS Sale: Auto-generated NHIA/KSCHMA claim ${claimNumber} for patient ${salePatient.name}`);
                    }
                }
            } catch (claimError) {
                console.error('❌ POS Sale claim generation error:', claimError);
            }
        }

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate({
                path: 'charges',
                select: 'itemName quantity unitPrice totalAmount'
            });

        res.status(201).json({
            message: 'Sale completed successfully',
            receipt: populatedReceipt,
            receiptNumber,
            totalAmount: amountPaid < 0 ? 0 : amountPaid
        });

    } catch (error) {
        console.error('POS Sale Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all pharmacies
// @route   GET /api/pharmacies
// @access  Private
const getPharmacies = async (req, res) => {
    try {
        const pharmacies = await Pharmacy.find().sort({ isMainPharmacy: -1, name: 1 });
        res.json(pharmacies);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single pharmacy
// @route   GET /api/pharmacies/:id
// @access  Private
const getPharmacyById = async (req, res) => {
    try {
        const pharmacy = await Pharmacy.findById(req.params.id);
        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }
        res.json(pharmacy);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new pharmacy
// @route   POST /api/pharmacies
// @access  Private (Admin)
const createPharmacy = async (req, res) => {
    try {
        const { name, location, description, isMainPharmacy } = req.body;

        const exists = await Pharmacy.findOne({ name });
        if (exists) {
            return res.status(400).json({ message: 'Pharmacy with this name already exists' });
        }

        const pharmacy = await Pharmacy.create({
            name,
            location,
            description,
            isMainPharmacy: isMainPharmacy || false
        });

        res.status(201).json(pharmacy);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update pharmacy
// @route   PUT /api/pharmacies/:id
// @access  Private (Admin)
const updatePharmacy = async (req, res) => {
    try {
        const { name, location, description, isMainPharmacy, isActive } = req.body;
        const pharmacy = await Pharmacy.findById(req.params.id);

        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        pharmacy.name = name || pharmacy.name;
        pharmacy.location = location !== undefined ? location : pharmacy.location;
        pharmacy.description = description !== undefined ? description : pharmacy.description;
        pharmacy.isMainPharmacy = isMainPharmacy !== undefined ? isMainPharmacy : pharmacy.isMainPharmacy;
        pharmacy.isActive = isActive !== undefined ? isActive : pharmacy.isActive;

        const updatedPharmacy = await pharmacy.save();
        res.json(updatedPharmacy);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete pharmacy
// @route   DELETE /api/pharmacies/:id
// @access  Private (Admin)
const deletePharmacy = async (req, res) => {
    try {
        const pharmacy = await Pharmacy.findById(req.params.id);

        if (!pharmacy) {
            return res.status(404).json({ message: 'Pharmacy not found' });
        }

        if (pharmacy.isMainPharmacy) {
            return res.status(400).json({ message: 'Cannot delete main pharmacy' });
        }

        // Check if pharmacy has inventory
        const Inventory = require('../models/inventoryModel');
        const hasInventory = await Inventory.findOne({ pharmacy: req.params.id });
        if (hasInventory) {
            return res.status(400).json({ message: 'Cannot delete pharmacy with existing inventory. Transfer items first.' });
        }

        await pharmacy.deleteOne();
        res.json({ message: 'Pharmacy removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get main pharmacy
// @route   GET /api/pharmacies/main
// @access  Private
const getMainPharmacy = async (req, res) => {
    try {
        const mainPharmacy = await Pharmacy.findOne({ isMainPharmacy: true });
        if (!mainPharmacy) {
            return res.status(404).json({ message: 'Main pharmacy not found' });
        }
        res.json(mainPharmacy);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getPharmacies,
    getPharmacyById,
    createPharmacy,
    updatePharmacy,
    deletePharmacy,
    getMainPharmacy,
    processDirectSale
};

