const Pharmacy = require('../models/pharmacyModel');

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
    getMainPharmacy
};
