const DrugMetadata = require('../models/drugMetadataModel');

// @desc    Get all drug metadata
// @route   GET /api/drug-metadata
// @access  Private
const getDrugMetadata = async (req, res) => {
    try {
        const { type } = req.query;
        const filter = {};
        if (type) {
            filter.type = type;
        }

        const metadata = await DrugMetadata.find(filter).sort({ type: 1, value: 1 });
        res.json(metadata);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new drug metadata
// @route   POST /api/drug-metadata
// @access  Private (Admin)
const createDrugMetadata = async (req, res) => {
    try {
        const { type, value, description } = req.body;

        const exists = await DrugMetadata.findOne({ type, value });
        if (exists) {
            return res.status(400).json({ message: `${value} already exists for ${type}` });
        }

        const metadata = await DrugMetadata.create({
            type,
            value,
            description
        });

        res.status(201).json(metadata);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update drug metadata
// @route   PUT /api/drug-metadata/:id
// @access  Private (Admin)
const updateDrugMetadata = async (req, res) => {
    try {
        const { value, description, isActive } = req.body;
        const metadata = await DrugMetadata.findById(req.params.id);

        if (!metadata) {
            return res.status(404).json({ message: 'Item not found' });
        }

        metadata.value = value || metadata.value;
        metadata.description = description !== undefined ? description : metadata.description;
        metadata.isActive = isActive !== undefined ? isActive : metadata.isActive;

        const updatedMetadata = await metadata.save();
        res.json(updatedMetadata);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete drug metadata
// @route   DELETE /api/drug-metadata/:id
// @access  Private (Admin)
const deleteDrugMetadata = async (req, res) => {
    try {
        const metadata = await DrugMetadata.findById(req.params.id);

        if (!metadata) {
            return res.status(404).json({ message: 'Item not found' });
        }

        await metadata.remove();
        res.json({ message: 'Item removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDrugMetadata,
    createDrugMetadata,
    updateDrugMetadata,
    deleteDrugMetadata
};
