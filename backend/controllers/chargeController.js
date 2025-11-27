const Charge = require('../models/chargeModel');

// @desc    Create new charge (master data)
// @route   POST /api/charges
// @access  Private (Admin only)
const createCharge = async (req, res) => {
    try {
        const { name, type, basePrice, department, description, code, resultTemplate, standardFee, retainershipFee, nhiaFee, kschmaFee } = req.body;

        const charge = await Charge.create({
            name,
            type,
            basePrice,
            department,
            description,
            code,
            resultTemplate,
            standardFee,
            retainershipFee,
            nhiaFee,
            kschmaFee
        });

        res.status(201).json(charge);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all charges
// @route   GET /api/charges
// @access  Private
const getCharges = async (req, res) => {
    try {
        const { type, active } = req.query;
        const filter = {};

        if (type) filter.type = type;
        if (active !== undefined) filter.active = active === 'true';

        const charges = await Charge.find(filter).sort({ type: 1, name: 1 });
        res.json(charges);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update charge
// @route   PUT /api/charges/:id
// @access  Private (Admin only)
const updateCharge = async (req, res) => {
    try {
        const charge = await Charge.findById(req.params.id);

        if (charge) {
            charge.name = req.body.name || charge.name;
            charge.basePrice = req.body.basePrice !== undefined ? req.body.basePrice : charge.basePrice;
            charge.description = req.body.description || charge.description;
            charge.active = req.body.active !== undefined ? req.body.active : charge.active;
            charge.resultTemplate = req.body.resultTemplate !== undefined ? req.body.resultTemplate : charge.resultTemplate;

            // Multi-tier pricing updates
            charge.standardFee = req.body.standardFee !== undefined ? req.body.standardFee : charge.standardFee;
            charge.retainershipFee = req.body.retainershipFee !== undefined ? req.body.retainershipFee : charge.retainershipFee;
            charge.nhiaFee = req.body.nhiaFee !== undefined ? req.body.nhiaFee : charge.nhiaFee;
            charge.kschmaFee = req.body.kschmaFee !== undefined ? req.body.kschmaFee : charge.kschmaFee;

            const updatedCharge = await charge.save();
            res.json(updatedCharge);
        } else {
            res.status(404).json({ message: 'Charge not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Deactivate charge
// @route   DELETE /api/charges/:id
// @access  Private (Admin only)
const deactivateCharge = async (req, res) => {
    try {
        const charge = await Charge.findById(req.params.id);

        if (charge) {
            charge.active = false;
            await charge.save();
            res.json({ message: 'Charge deactivated' });
        } else {
            res.status(404).json({ message: 'Charge not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createCharge,
    getCharges,
    updateCharge,
    deactivateCharge,
};
