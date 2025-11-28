const Ward = require('../models/wardModel');

// @desc    Create a new ward
// @route   POST /api/wards
// @access  Private/Admin
const createWard = async (req, res) => {
    const { name, type, description, bedCount, dailyRate, rates } = req.body;

    try {
        const wardExists = await Ward.findOne({ name });

        if (wardExists) {
            return res.status(400).json({ message: 'Ward already exists' });
        }

        // Auto-generate beds
        const beds = [];
        if (bedCount && bedCount > 0) {
            for (let i = 1; i <= bedCount; i++) {
                beds.push({ number: `Bed ${i}`, isOccupied: false });
            }
        }

        const ward = await Ward.create({
            name,
            type,
            description,
            beds,
            dailyRate,
            rates: rates || {
                Standard: dailyRate || 0,
                NHIA: 0,
                Retainership: 0,
                KSCHMA: 0
            }
        });

        if (ward) {
            res.status(201).json(ward);
        } else {
            res.status(400).json({ message: 'Invalid ward data' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all wards
// @route   GET /api/wards
// @access  Private
const getWards = async (req, res) => {
    try {
        const wards = await Ward.find({});
        res.json(wards);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update ward details (including adding/removing beds)
// @route   PUT /api/wards/:id
// @access  Private/Admin
const updateWard = async (req, res) => {
    const { name, type, description, beds, dailyRate, rates } = req.body;

    try {
        const ward = await Ward.findById(req.params.id);

        if (ward) {
            ward.name = name || ward.name;
            ward.type = type || ward.type;
            ward.description = description || ward.description;
            ward.dailyRate = dailyRate !== undefined ? dailyRate : ward.dailyRate;
            if (rates) {
                ward.rates = rates;
            }
            if (beds) {
                ward.beds = beds;
            }

            const updatedWard = await ward.save();
            res.json(updatedWard);
        } else {
            res.status(404).json({ message: 'Ward not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a ward
// @route   DELETE /api/wards/:id
// @access  Private/Admin
const deleteWard = async (req, res) => {
    try {
        const ward = await Ward.findById(req.params.id);

        if (ward) {
            await ward.deleteOne();
            res.json({ message: 'Ward removed' });
        } else {
            res.status(404).json({ message: 'Ward not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createWard,
    getWards,
    updateWard,
    deleteWard
};
