const Charge = require('../models/chargeModel');
const xlsx = require('xlsx');

// @desc    Create new charge (master data)
// @route   POST /api/charges
// @access  Private (Admin only)
const createCharge = async (req, res) => {
    try {
        const { name, type, basePrice, department, description, code, resultTemplate, standardFee, retainershipFee, nhiaFee, kschmaFee } = req.body;
        console.log('Creating Charge. labSpecialization:', req.body.labSpecialization);

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
            kschmaFee,
            labSpecialization: req.body.labSpecialization
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
        console.log('Updating Charge ID:', req.params.id);
        console.log('Update Body:', JSON.stringify(req.body, null, 2));

        if (charge) {
            charge.name = req.body.name || charge.name;
            charge.type = req.body.type || charge.type;
            charge.basePrice = req.body.basePrice !== undefined ? req.body.basePrice : charge.basePrice;
            charge.department = req.body.department !== undefined ? req.body.department : charge.department;
            charge.code = req.body.code !== undefined ? req.body.code : charge.code;
            charge.description = req.body.description !== undefined ? req.body.description : charge.description;
            charge.active = req.body.active !== undefined ? req.body.active : charge.active;
            charge.resultTemplate = req.body.resultTemplate !== undefined ? req.body.resultTemplate : charge.resultTemplate;

            // Multi-tier pricing updates
            charge.standardFee = req.body.standardFee !== undefined ? req.body.standardFee : charge.standardFee;
            charge.retainershipFee = req.body.retainershipFee !== undefined ? req.body.retainershipFee : charge.retainershipFee;
            charge.nhiaFee = req.body.nhiaFee !== undefined ? req.body.nhiaFee : charge.nhiaFee;
            charge.kschmaFee = req.body.kschmaFee !== undefined ? req.body.kschmaFee : charge.kschmaFee;

            if (req.body.labSpecialization !== undefined) {
                charge.labSpecialization = req.body.labSpecialization;
            }

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

// @desc    Import Charges from Excel
// @route   POST /api/charges/import-excel
// @access  Private
const importChargesFromExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { type, department } = req.query;
        if (!type) {
            return res.status(400).json({ message: 'Service type is required (query param: type)' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        const results = { success: [], failed: [] };

        for (const row of data) {
            try {
                const name = row['Service Name'] || row['name'];
                if (!name) {
                    results.failed.push({ row, error: 'Service Name is required' });
                    continue;
                }

                const standardFee = parseFloat(row['Standard Fee'] || row['standardFee'] || 0);

                // Skip if already exists
                const existing = await Charge.findOne({ name, type });
                if (existing) {
                    results.failed.push({ row, error: `${name} already exists` });
                    continue;
                }

                const charge = await Charge.create({
                    name,
                    type,
                    basePrice: standardFee,
                    standardFee,
                    retainershipFee: parseFloat(row['Retainership Fee'] || row['retainershipFee'] || 0),
                    nhiaFee: parseFloat(row['NHIA Fee'] || row['nhiaFee'] || 0),
                    kschmaFee: parseFloat(row['KSCHMA Fee'] || row['kschmaFee'] || 0),
                    department: department || row['Department'] || type,
                    description: row['Description'] || row['description'] || '',
                    code: row['Code'] || row['code'] || undefined,
                    labSpecialization: row['Lab Specialization'] || row['labSpecialization'] || undefined,
                });

                results.success.push(charge);
            } catch (error) {
                results.failed.push({ row, error: error.message });
            }
        }

        res.json({
            message: `Imported ${results.success.length} service(s) successfully. ${results.failed.length} failed.`,
            results
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createCharge,
    getCharges,
    updateCharge,
    deactivateCharge,
    importChargesFromExcel,
};
