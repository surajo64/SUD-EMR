const Clinic = require('../models/clinicModel');

// @desc    Get all clinics
// @route   GET /api/clinics
// @access  Private
const getClinics = async (req, res) => {
    try {
        const { active } = req.query;
        const filter = {};

        if (active !== undefined) {
            filter.active = active === 'true';
        }

        const clinics = await Clinic.find(filter).sort({ name: 1 });
        res.json(clinics);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single clinic by ID
// @route   GET /api/clinics/:id
// @access  Private
const getClinicById = async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.params.id);

        if (!clinic) {
            return res.status(404).json({ message: 'Clinic not found' });
        }

        res.json(clinic);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new clinic
// @route   POST /api/clinics
// @access  Private (Admin only)
const createClinic = async (req, res) => {
    try {
        const { name, description, department } = req.body;

        if (!name || !department) {
            return res.status(400).json({ message: 'Name and department are required' });
        }

        const clinic = await Clinic.create({
            name,
            description,
            department,
            active: true
        });

        res.status(201).json(clinic);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update clinic
// @route   PUT /api/clinics/:id
// @access  Private (Admin only)
const updateClinic = async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.params.id);

        if (!clinic) {
            return res.status(404).json({ message: 'Clinic not found' });
        }

        const { name, description, department, active } = req.body;

        clinic.name = name || clinic.name;
        clinic.description = description !== undefined ? description : clinic.description;
        clinic.department = department || clinic.department;
        clinic.active = active !== undefined ? active : clinic.active;

        const updatedClinic = await clinic.save();
        res.json(updatedClinic);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete/Deactivate clinic
// @route   DELETE /api/clinics/:id
// @access  Private (Admin only)
const deleteClinic = async (req, res) => {
    try {
        const clinic = await Clinic.findById(req.params.id);

        if (!clinic) {
            return res.status(404).json({ message: 'Clinic not found' });
        }

        // Soft delete - just deactivate
        clinic.active = false;
        await clinic.save();

        res.json({ message: 'Clinic deactivated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getClinics,
    getClinicById,
    createClinic,
    updateClinic,
    deleteClinic
};
