const Prescription = require('../models/prescriptionModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Visit = require('../models/visitModel');

// @desc    Create new prescription
// @route   POST /api/prescriptions
// @access  Private (Doctor or Pharmacist for External Investigation)
const createPrescription = async (req, res) => {
    const { patientId, visitId, chargeId, medicines, notes } = req.body;

    if (!patientId || !medicines || medicines.length === 0) {
        return res.status(400).json({ message: 'Please add patient and medicines' });
    }

    // Check permissions
    if (req.user.role === 'pharmacist') {
        const visit = await Visit.findById(visitId);
        if (!visit || (visit.type !== 'External Investigation' && visit.type !== 'External Pharmacy')) {
            return res.status(403).json({ message: 'Pharmacists can only prescribe for External Investigations and External Pharmacy.' });
        }
    } else if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Not authorized to create prescriptions.' });
    }

    const prescription = await Prescription.create({
        doctor: req.user._id,
        patient: patientId,
        visit: visitId,
        charge: chargeId || null, // Allow chargeId to be null/undefined
        medicines,
        notes,
        pharmacy: req.user.assignedPharmacy?._id || req.user.assignedPharmacy || null, // Capture doctor's assigned pharmacy
    });

    res.status(201).json(prescription);
};

// @desc    Get all prescriptions (for pharmacy)
// @route   GET /api/prescriptions
// @access  Private (Pharmacist/Admin)
const getPrescriptions = async (req, res) => {
    let filter = {};

    const userRole = req.user.role ? req.user.role.toLowerCase() : '';
    const userPharmacyId = req.user.assignedPharmacy?._id || req.user.assignedPharmacy;

    // Apply access control
    if (userRole === 'pharmacist') {
        if (req.user.assignedPharmacy) {
            const isMain = req.user.assignedPharmacy.isMainPharmacy;
            if (!isMain) {
                // Regular pharmacist - only see prescriptions for their pharmacy
                // (Prescriptions without a pharmacy are visible to all for backward compatibility or if not set)
                filter.$or = [
                    { pharmacy: userPharmacyId },
                    { pharmacy: { $exists: false } },
                    { pharmacy: null }
                ];
            } else {
                // Main pharmacy pharmacists can see all prescriptions
            }
        } else {
            // Pharmacist with no assigned pharmacy - return nothing for safety
            return res.json([]);
        }
    }

    const prescriptions = await Prescription.find(filter)
        .populate('doctor', 'name')
        .populate('patient', 'name age gender mrn provider')
        .populate('charge') // Populate full charge object to get status
        .populate('pharmacy', 'name');
    res.json(prescriptions);
};

// @desc    Get prescriptions for a specific patient
// @route   GET /api/prescriptions/patient/:id
// @access  Private
const getPatientPrescriptions = async (req, res) => {
    const prescriptions = await Prescription.find({ patient: req.params.id })
        .populate('doctor', 'name');
    res.json(prescriptions);
};

// @desc    Get prescriptions by visit
// @route   GET /api/prescriptions/visit/:id
// @access  Private
const getPrescriptionsByVisit = async (req, res) => {
    const prescriptions = await Prescription.find({ visit: req.params.id })
        .populate('doctor', 'name')
        .populate('patient', 'name age gender mrn provider')
        .populate('charge')
        .populate('dispensedBy', 'name');
    res.json(prescriptions);
};

// @desc    Generate charge for a prescription (Pharmacist Verified)
// @route   PUT /api/prescriptions/:id/generate-charge
// @access  Private (Pharmacist)
const generatePrescriptionCharge = async (req, res) => {
    try {
        const { quantity, unitPrice } = req.body;
        const prescription = await Prescription.findById(req.params.id)
            .populate('patient');

        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        // Check pharmacy ownership
        if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
            const userPharmacyId = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
            const isMain = req.user.assignedPharmacy.isMainPharmacy;
            if (!isMain && prescription.pharmacy && prescription.pharmacy.toString() !== userPharmacyId.toString()) {
                return res.status(403).json({ message: 'Not authorized to process prescriptions for another pharmacy' });
            }
        }

        if (prescription.charge) {
            return res.status(400).json({ message: 'Charge already generated for this prescription' });
        }

        // Logic to create charge (similar to frontend PatientDetails logic but secure)
        const Charge = require('../models/chargeModel');
        const EncounterCharge = require('../models/encounterChargeModel');

        // We assume the prescription has one main drug or logic needs to handle multiple?
        // The current model creates ONE prescription document with multiple medicines, 
        // BUT the previous frontend logic created ONE prescription per ONE drug charge (1:1 mapping).
        // Let's verify PatientDetails.jsx:
        // processSinglePrescription creates ONE encounter-charge and ONE prescription with ONE medicine in the array.
        // So we can assume medicine[0] is the target drug.

        const medicine = prescription.medicines[0];
        if (!medicine) {
            return res.status(400).json({ message: 'No medicine found in prescription' });
        }

        // BLOCK: Prevent charging for drugs marked as Buy Outside
        if (medicine.buyOutside) {
            return res.status(400).json({ message: 'Cannot generate charge for a prescription marked for External Purchase (Buy Outside).' });
        }

        // Find existing charge definition for the drug
        let drugCharge = await Charge.findOne({
            type: 'drugs',
            name: medicine.name,
            active: true
        });

        // Current frontend logic creates it if not found, we should probably do same or error.
        // Let's create if not found to maintain compatibility, though ideally drugs should exist in DB.
        // However, we need a price. If it's not in Charge DB, where do we get price?
        // In PatientDetails.jsx, it used `selectedDrugData.price` from Inventory.
        // So we might need to look up Inventory here.

        const Inventory = require('../models/inventoryModel');
        // Find inventory item to get price if Charge doesn't exist or to ensure price consistency
        const inventoryItem = await Inventory.findOne({
            name: medicine.name,
            quantity: { $gt: 0 }
        }).sort({ createdAt: -1 }); // Get latest batch price? Or just any?

        let basePrice = 0;
        if (drugCharge) {
            basePrice = drugCharge.standardFee || drugCharge.basePrice;
        } else if (inventoryItem) {
            basePrice = inventoryItem.standardFee || inventoryItem.price;
            // Create Charge definition since it doesn't exist — include ALL fee tiers from inventory
            drugCharge = await Charge.create({
                name: medicine.name,
                type: 'drugs',
                basePrice: basePrice,
                standardFee: inventoryItem.standardFee || inventoryItem.price || 0,
                retainershipFee: inventoryItem.retainershipFee || 0,
                familyRetainershipFee: inventoryItem.familyRetainershipFee || 0,
                nhiaFee: inventoryItem.nhiaFee || 0,
                kschmaFee: inventoryItem.kschmaFee || 0,
                department: 'Pharmacy',
                active: true
            });
        } else {
            return res.status(400).json({ message: `Drug ${medicine.name} not found in charges or inventory.` });
        }

        // Calculate Fee logic based on patient provider
        const patient = prescription.patient;
        let fee = 0;
        let isCovered = true;

        if (unitPrice !== undefined && unitPrice !== null && !isNaN(parseFloat(unitPrice))) {
            fee = parseFloat(unitPrice);
        } else {
            // Prioritize Inventory price for drugs if available
            if (inventoryItem) {
                if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership') {
                    fee = inventoryItem.retainershipFee || 0;
                } else if (patient.provider === 'Family Retainership') {
                    fee = inventoryItem.familyRetainershipFee || 0;
                } else if (patient.provider === 'NHIA') {
                    fee = inventoryItem.nhiaFee || 0;
                } else if (patient.provider === 'KSCHMA') {
                    fee = inventoryItem.kschmaFee || 0;
                } else {
                    fee = inventoryItem.standardFee || inventoryItem.price || 0;
                }
            }

            // Fallback to drugCharge if fee is still 0
            if (fee === 0 && drugCharge) {
                if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership') {
                    fee = drugCharge.retainershipFee || 0;
                } else if (patient.provider === 'Family Retainership') {
                    fee = drugCharge.familyRetainershipFee || 0;
                } else if (patient.provider === 'NHIA') {
                    fee = drugCharge.nhiaFee || 0;
                } else if (patient.provider === 'KSCHMA') {
                    fee = drugCharge.kschmaFee || 0;
                } else {
                    fee = drugCharge.standardFee || drugCharge.basePrice || 0;
                }
            }

            // Final fallback: if specific tier fee is still 0, use standard fee
            if (fee === 0) {
                fee = drugCharge ? (drugCharge.standardFee || drugCharge.basePrice) : (inventoryItem ? (inventoryItem.standardFee || inventoryItem.price) : 0);
            }
        }

        const finalQuantity = quantity || medicine.quantity || 1;
        const totalAmount = fee * finalQuantity;

        let patientPortion = totalAmount;
        let hmoPortion = 0;

        if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership' || patient.provider === 'Family Retainership') {
            patientPortion = 0;
            hmoPortion = totalAmount;
        } else if (patient.provider === 'NHIA' || patient.provider === 'KSCHMA') {
            patientPortion = totalAmount * 0.1;
            hmoPortion = totalAmount * 0.9;
        }

        // Create Encounter Charge
        const encounterCharge = await EncounterCharge.create({
            encounter: prescription.visit,
            patient: prescription.patient._id,
            charge: drugCharge._id,
            quantity: finalQuantity,
            unitPrice: fee,
            totalAmount,
            patientPortion,
            hmoPortion,
            addedBy: req.user._id, // Pharmacist
            itemType: 'drugs',
            itemName: medicine.name,
            department: 'Pharmacy',
            notes: `${medicine.name} - Qty: ${finalQuantity} (Verified by Pharmacy)`
        });

        // Update Prescription
        prescription.charge = encounterCharge._id;
        // Also update the quantity in the medicine array effectively
        prescription.medicines[0].quantity = finalQuantity;

        await prescription.save();

        res.json({
            message: 'Charge generated successfully',
            prescription,
            encounterCharge
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error generating charge', error: error.message });
    }
};

// @desc    Update prescription status (Dispense)
// @route   PUT /api/prescriptions/:id/dispense
// @access  Private (Pharmacist)
const dispensePrescription = async (req, res) => {
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
        return res.status(404).json({ message: 'Prescription not found' });
    }

    // Check pharmacy ownership
    if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
        const userPharmacyId = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
        const isMain = req.user.assignedPharmacy.isMainPharmacy;
        if (!isMain && prescription.pharmacy && prescription.pharmacy.toString() !== userPharmacyId.toString()) {
            return res.status(403).json({ message: 'Not authorized to dispense prescriptions for another pharmacy' });
        }
    }

    if (prescription) {
        prescription.status = 'dispensed';
        prescription.dispensedBy = req.user._id;
        prescription.dispensedAt = new Date();
        const updatedPrescription = await prescription.save();
        res.json(updatedPrescription);
    } else {
        res.status(404).json({ message: 'Prescription not found' });
    }
};

// @desc    Dispense prescription with inventory deduction
// @route   PUT /api/prescriptions/:id/dispense-with-inventory
// @access  Private (Pharmacist)
const dispenseWithInventory = async (req, res) => {
    try {
        const Inventory = require('../models/inventoryModel');
        const EncounterCharge = require('../models/encounterChargeModel');

        const prescription = await Prescription.findById(req.params.id)
            .populate('charge')
            .populate('patient', 'name mrn');

        if (!prescription) {
            return res.status(404).json({ message: 'Prescription not found' });
        }

        // Check pharmacy ownership
        if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
            const userPharmacyId = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
            const isMain = req.user.assignedPharmacy.isMainPharmacy;
            if (!isMain && prescription.pharmacy && prescription.pharmacy.toString() !== userPharmacyId.toString()) {
                return res.status(403).json({ message: 'Not authorized to dispense prescriptions for another pharmacy' });
            }
        }

        // Verify payment status
        if (!prescription.charge || prescription.charge.status !== 'paid') {
            return res.status(400).json({
                message: 'Payment required. Patient must pay at cashier before dispensing.',
                paymentStatus: prescription.charge?.status || 'unpaid'
            });
        }

        // Get medicines to dispense from request body
        const { medicines } = req.body; // Array of { name, quantityDispensed, dosageGiven, frequencyGiven, durationGiven }

        if (!medicines || medicines.length === 0) {
            return res.status(400).json({ message: 'Please specify medicines to dispense' });
        }

        const inventoryUpdates = [];
        const insufficientStock = [];

        // Process each medicine
        for (const med of medicines) {
            const { name, quantityDispensed, buyOutside } = med;

            // Skip inventory deduction for drugs marked as Buy Outside
            if (buyOutside) {
                inventoryUpdates.push({
                    drug: name,
                    deducted: 0,
                    reason: 'External Purchase (Buy Outside) - No inventory deduction'
                });
                continue;
            }

            // Find inventory items for this drug in the pharmacist's assigned pharmacy
            // If admin or main pharmacy, maybe allow selection? For now, assume strict assignment.
            const pharmacyFilter = {};
            if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
                pharmacyFilter.pharmacy = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
            }

            // Escape special regex characters to ensure literal matching of parentheses, etc.
            const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');



            const inventoryItems = await Inventory.find({
                name: { $regex: new RegExp(escapedName, 'i') },
                quantity: { $gt: 0 },
                ...pharmacyFilter
            }).sort({ expiryDate: 1 });



            if (inventoryItems.length === 0) {


                insufficientStock.push({ name, reason: 'Not in stock' });
                continue;
            }

            // Separate valid and expired stock
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const validStock = inventoryItems.filter(item => new Date(item.expiryDate) >= today);
            const expiredStock = inventoryItems.filter(item => new Date(item.expiryDate) < today);

            // Calculate total available from VALID stock only
            const totalValidAvailable = validStock.reduce((sum, item) => sum + item.quantity, 0);

            if (totalValidAvailable < quantityDispensed) {
                const totalExpired = expiredStock.reduce((sum, item) => sum + item.quantity, 0);

                let reason = 'Insufficient stock';
                if (totalValidAvailable === 0 && totalExpired > 0) {
                    reason = `⛔ BLOCKED: All ${totalExpired} units in stock are EXPIRED.`;
                } else if (totalExpired > 0) {
                    reason = `⚠️ Insufficient valid stock. You have ${totalExpired} expired units that cannot be dispensed.`;
                }

                insufficientStock.push({
                    name,
                    requested: quantityDispensed,
                    available: totalValidAvailable,
                    reason
                });
                continue;
            }

            // Deduct using FIFO (First Expiry, First Out) from VALID items
            let remainingToDispense = quantityDispensed;
            for (const item of validStock) {
                if (remainingToDispense <= 0) break;

                const deductAmount = Math.min(item.quantity, remainingToDispense);
                item.quantity -= deductAmount;
                remainingToDispense -= deductAmount;

                await item.save();
                inventoryUpdates.push({
                    drug: item.name,
                    batch: item.batchNumber,
                    deducted: deductAmount,
                    remaining: item.quantity
                });
            }
        }

        // If any insufficient stock, return error
        if (insufficientStock.length > 0) {
            return res.status(400).json({
                message: 'Insufficient inventory for some medications',
                insufficientStock
            });
        }

        // Update prescription with dispensed medicines and status
        prescription.medicines = medicines;
        prescription.status = 'dispensed';
        prescription.dispensedBy = req.user._id;
        prescription.dispensedAt = new Date();

        await prescription.save();

        res.json({
            message: 'Prescription dispensed successfully',
            prescription,
            inventoryUpdates
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Error dispensing prescription', error: error.message });
    }
};

// @desc    Bulk dispense prescriptions with inventory deduction
// @route   PUT /api/prescriptions/bulk-dispense
// @access  Private (Pharmacist)
const bulkDispenseWithInventory = async (req, res) => {
    try {
        const Inventory = require('../models/inventoryModel');
        const EncounterCharge = require('../models/encounterChargeModel');
        const { prescriptionIds } = req.body;

        if (!prescriptionIds || !Array.isArray(prescriptionIds) || prescriptionIds.length === 0) {
            return res.status(400).json({ message: 'Please specify prescription IDs to dispense' });
        }

        const results = {
            success: [],
            failed: []
        };

        const pharmacyFilter = {};
        if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
            pharmacyFilter.pharmacy = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const id of prescriptionIds) {
            try {
                const prescription = await Prescription.findById(id)
                    .populate('charge')
                    .populate('patient', 'name mrn');

                if (!prescription) {
                    results.failed.push({ id, reason: 'Prescription not found' });
                    continue;
                }

                // Check pharmacy ownership
                if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
                    const userPharmacyId = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
                    const isMain = req.user.assignedPharmacy.isMainPharmacy;
                    if (!isMain && prescription.pharmacy && prescription.pharmacy.toString() !== userPharmacyId.toString()) {
                        results.failed.push({ id, name: prescription.patient?.name, reason: 'Not authorized for this pharmacy' });
                        continue;
                    }
                }

                // Verify status
                if (prescription.status === 'dispensed') {
                    results.failed.push({ id, name: prescription.patient?.name, reason: 'Already dispensed' });
                    continue;
                }

                // Verify payment status
                if (!prescription.charge || prescription.charge.status !== 'paid') {
                    results.failed.push({ id, name: prescription.patient?.name, reason: `Status: ${prescription.charge?.status || 'unpaid'}` });
                    continue;
                }

                const medicines = prescription.medicines;
                const batchUpdates = [];
                let hasStockError = false;

                // Preliminary stock check for all medicines in this prescription
                for (const med of medicines) {
                    if (med.buyOutside) continue;

                    const escapedName = med.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const inventoryItems = await Inventory.find({
                        name: { $regex: new RegExp(escapedName, 'i') },
                        quantity: { $gt: 0 },
                        ...pharmacyFilter
                    }).sort({ expiryDate: 1 });

                    const validStock = inventoryItems.filter(item => new Date(item.expiryDate) >= today);
                    const totalValidAvailable = validStock.reduce((sum, item) => sum + item.quantity, 0);

                    if (totalValidAvailable < (med.quantity || 1)) {
                        results.failed.push({ id, name: prescription.patient?.name, medicine: med.name, reason: 'Insufficient stock' });
                        hasStockError = true;
                        break;
                    }
                    batchUpdates.push({ med, validStock });
                }

                if (hasStockError) continue;

                // Perform deduction
                for (const update of batchUpdates) {
                    let remainingToDispense = update.med.quantity || 1;
                    for (const item of update.validStock) {
                        if (remainingToDispense <= 0) break;
                        const deductAmount = Math.min(item.quantity, remainingToDispense);
                        item.quantity -= deductAmount;
                        remainingToDispense -= deductAmount;
                        await item.save();
                    }
                }

                // Update prescription
                prescription.status = 'dispensed';
                prescription.dispensedBy = req.user._id;
                prescription.dispensedAt = new Date();
                await prescription.save();

                results.success.push({ id, name: prescription.patient?.name });

            } catch (innerError) {
                console.error(`Error processing prescription ${id}:`, innerError);
                results.failed.push({ id, reason: innerError.message });
            }
        }

        res.json({
            message: 'Bulk dispense completed',
            summary: {
                totalRequested: prescriptionIds.length,
                successCount: results.success.length,
                failedCount: results.failed.length
            },
            results
        });

    } catch (error) {
        console.error('Bulk Dispense Error:', error);
        res.status(500).json({ message: 'Internal server error during bulk dispense' });
    }
};

// @desc    Delete prescription
// @route   DELETE /api/prescriptions/:id
// @access  Private (Doctor or Admin)
const deletePrescription = async (req, res) => {
    const prescription = await Prescription.findById(req.params.id);

    if (!prescription) {
        return res.status(404).json({ message: 'Prescription not found' });
    }

    // Verify permissions: Only Admin or the Doctor who created the prescription
    if (req.user.role !== 'admin' && prescription.doctor.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this prescription.' });
    }

    // Safety check: Cannot delete if dispensed
    if (prescription.status === 'dispensed') {
        return res.status(400).json({ message: 'Cannot delete a prescription that has already been dispensed.' });
    }

    // Check if there's an associated charge
    if (prescription.charge) {
        const encounterCharge = await EncounterCharge.findById(prescription.charge);
        if (encounterCharge) {
            if (encounterCharge.status !== 'pending') {
                return res.status(400).json({ message: 'Cannot delete prescription because the charge has already been processed (paid or cancelled).' });
            }
            // Delete the encounter charge
            await encounterCharge.deleteOne();
        }
    }

    await prescription.deleteOne();
    res.json({ message: 'Prescription and associated pending charge deleted.' });
};

module.exports = {
    createPrescription,
    getPrescriptions,
    getPatientPrescriptions,
    getPrescriptionsByVisit,
    generatePrescriptionCharge,
    dispensePrescription,
    dispenseWithInventory,
    bulkDispenseWithInventory,
    deletePrescription,
};
