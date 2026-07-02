const SpecialityClinic = require('../models/specialityClinicModel');

// @desc    Get all speciality clinics
// @route   GET /api/speciality-clinics
// @access  Private
const getSpecialityClinics = async (req, res) => {
    try {
        const { active } = req.query;
        const filter = {};

        if (active !== undefined) {
            filter.active = active === 'true';
        }

        const clinics = await SpecialityClinic.find(filter).sort({ name: 1 });
        res.json(clinics);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single speciality clinic by ID
// @route   GET /api/speciality-clinics/:id
// @access  Private
const getSpecialityClinicById = async (req, res) => {
    try {
        const clinic = await SpecialityClinic.findById(req.params.id);

        if (!clinic) {
            return res.status(404).json({ message: 'Speciality clinic not found' });
        }

        res.json(clinic);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new speciality clinic
// @route   POST /api/speciality-clinics
// @access  Private (Admin & Receptionist)
const createSpecialityClinic = async (req, res) => {
    try {
        const { name, description, department } = req.body;

        if (!name || !department) {
            return res.status(400).json({ message: 'Name and department are required' });
        }

        const clinic = await SpecialityClinic.create({
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

// @desc    Update speciality clinic
// @route   PUT /api/speciality-clinics/:id
// @access  Private (Admin & Receptionist)
const updateSpecialityClinic = async (req, res) => {
    try {
        const clinic = await SpecialityClinic.findById(req.params.id);

        if (!clinic) {
            return res.status(404).json({ message: 'Speciality clinic not found' });
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

// @desc    Delete/Deactivate speciality clinic
// @route   DELETE /api/speciality-clinics/:id
// @access  Private (Admin & Receptionist)
const deleteSpecialityClinic = async (req, res) => {
    try {
        const clinic = await SpecialityClinic.findById(req.params.id);

        if (!clinic) {
            return res.status(404).json({ message: 'Speciality clinic not found' });
        }

        // Soft delete - just deactivate
        clinic.active = false;
        await clinic.save();

        res.json({ message: 'Speciality clinic deactivated successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getSpecialityClinics,
    getSpecialityClinicById,
    createSpecialityClinic,
    updateSpecialityClinic,
    deleteSpecialityClinic
};
