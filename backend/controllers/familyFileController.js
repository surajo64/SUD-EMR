const FamilyFile = require('../models/familyFileModel');
const Patient = require('../models/patientModel');
const { generateFamilyFileNumber } = require('../utils/familyFileNumberGenerator');

// @desc    Create new Family File
// @route   POST /api/family-files
// @access  Private
const createFamilyFile = async (req, res) => {
    try {
        console.log('Creating Family File:', req.body);
        const { familyName, type, registrationCharge, familyCharge, description } = req.body;

        // Generate atomic unique file number on save
        const fileNumber = await generateFamilyFileNumber(true);
        console.log('Generated File Number:', fileNumber);

        const familyFile = await FamilyFile.create({
            familyName,
            fileNumber,
            type,
            registrationCharge,
            familyCharge,
            description,
            createdBy: req.user._id
        });

        res.status(201).json(familyFile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get next available Family File Number (Preview Only)
// @route   GET /api/family-files/next-number
// @access  Private
const getNextFamilyFileNumberEndpoint = async (req, res) => {
    try {
        const nextNumber = await generateFamilyFileNumber(false);
        res.json({ nextNumber });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all Family Files
// @route   GET /api/family-files
// @access  Private
const getFamilyFiles = async (req, res) => {
    try {
        const { active, search } = req.query;
        const filter = {};
        if (active === 'true') filter.active = true;
        if (search) {
            filter.$or = [
                { familyName: { $regex: search, $options: 'i' } },
                { fileNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const familyFiles = await FamilyFile.find(filter)
            .populate('familyCharge')
            .sort({ createdAt: -1 });
        res.json(familyFiles);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get Family File by ID
// @route   GET /api/family-files/:id
// @access  Private
const getFamilyFileById = async (req, res) => {
    try {
        const familyFile = await FamilyFile.findById(req.params.id);
        if (!familyFile) {
            return res.status(404).json({ message: 'Family File not found' });
        }
        res.json(familyFile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update Family File
// @route   PUT /api/family-files/:id
// @access  Private
const updateFamilyFile = async (req, res) => {
    try {
        const familyFile = await FamilyFile.findById(req.params.id);
        if (!familyFile) {
            return res.status(404).json({ message: 'Family File not found' });
        }

        familyFile.familyName = req.body.familyName || familyFile.familyName;
        familyFile.type = req.body.type || familyFile.type;
        familyFile.registrationCharge = req.body.registrationCharge !== undefined ? req.body.registrationCharge : familyFile.registrationCharge;
        familyFile.familyCharge = req.body.familyCharge || familyFile.familyCharge;
        familyFile.description = req.body.description !== undefined ? req.body.description : familyFile.description;
        familyFile.active = req.body.active !== undefined ? req.body.active : familyFile.active;

        const updatedFamilyFile = await familyFile.save();
        res.json(updatedFamilyFile);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete Family File
// @route   DELETE /api/family-files/:id
// @access  Private (Admin)
const deleteFamilyFile = async (req, res) => {
    try {
        const familyFile = await FamilyFile.findById(req.params.id);
        if (!familyFile) {
            return res.status(404).json({ message: 'Family File not found' });
        }

        // Check if there are patients linked to this file
        const patientCount = await Patient.countDocuments({ familyFile: familyFile._id });
        if (patientCount > 0) {
            return res.status(400).json({ message: 'Cannot delete Family File with registered patients' });
        }

        await familyFile.deleteOne();
        res.json({ message: 'Family File deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createFamilyFile,
    getFamilyFiles,
    getFamilyFileById,
    updateFamilyFile,
    deleteFamilyFile,
    getNextFamilyFileNumber: getNextFamilyFileNumberEndpoint
};
