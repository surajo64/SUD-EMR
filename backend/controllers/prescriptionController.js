const Prescription = require('../models/prescriptionModel');
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
        if (!visit || visit.type !== 'External Investigation') {
            return res.status(403).json({ message: 'Pharmacists can only prescribe for External Investigations.' });
        }
    } else if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Not authorized to create prescriptions.' });
    }

    const prescription = await Prescription.create({
        doctor: req.user._id,
        patient: patientId,
        visit: visitId,
        charge: chargeId,
        medicines,
        notes,
    });

    res.status(201).json(prescription);
};

// @desc    Get all prescriptions (for pharmacy)
// @route   GET /api/prescriptions
// @access  Private (Pharmacist/Admin)
const getPrescriptions = async (req, res) => {
    const prescriptions = await Prescription.find({})
        .populate('doctor', 'name')
        .populate('patient', 'name age gender mrn')
        .populate('charge'); // Populate full charge object to get status
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
        .populate('charge') // Populate full charge object
        .populate('dispensedBy', 'name');
    res.json(prescriptions);
};

// @desc    Update prescription status (Dispense)
// @route   PUT /api/prescriptions/:id/dispense
// @access  Private (Pharmacist)
const dispensePrescription = async (req, res) => {
    const prescription = await Prescription.findById(req.params.id);

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
            const { name, quantityDispensed } = med;

            // Find inventory items for this drug in the pharmacist's assigned pharmacy
            // If admin or main pharmacy, maybe allow selection? For now, assume strict assignment.
            const pharmacyFilter = {};
            if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
                pharmacyFilter.pharmacy = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
            }

            const inventoryItems = await Inventory.find({
                name: { $regex: new RegExp(name, 'i') },
                quantity: { $gt: 0 },
                ...pharmacyFilter
            }).sort({ expiryDate: 1 });

            if (inventoryItems.length === 0) {
                insufficientStock.push({ name, reason: 'Not in stock' });
                continue;
            }

            // Calculate total available
            const totalAvailable = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);

            if (totalAvailable < quantityDispensed) {
                insufficientStock.push({
                    name,
                    requested: quantityDispensed,
                    available: totalAvailable,
                    reason: 'Insufficient stock'
                });
                continue;
            }

            // Deduct using FIFO (First Expiry, First Out)
            let remainingToDispense = quantityDispensed;
            for (const item of inventoryItems) {
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

module.exports = {
    createPrescription,
    getPrescriptions,
    getPatientPrescriptions,
    getPrescriptionsByVisit,
    dispensePrescription,
    dispenseWithInventory,
};
