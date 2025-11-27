const HMO = require('../models/hmoModel');
const xlsx = require('xlsx');

// @desc    Get all HMOs
// @route   GET /api/hmos
// @access  Private
const getHMOs = async (req, res) => {
    try {
        const { active } = req.query;
        const filter = {};

        if (active === 'true') {
            filter.active = true;
        }

        const hmos = await HMO.find(filter).sort({ name: 1 });
        res.json(hmos);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single HMO
// @route   GET /api/hmos/:id
// @access  Private
const getHMOById = async (req, res) => {
    try {
        const hmo = await HMO.findById(req.params.id);

        if (!hmo) {
            return res.status(404).json({ message: 'HMO not found' });
        }

        res.json(hmo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new HMO
// @route   POST /api/hmos
// @access  Private (Admin)
const createHMO = async (req, res) => {
    try {
        const { name, code, category, description, contactPerson, contactPhone, contactEmail } = req.body;

        // Check if HMO with same name already exists
        const existingHMO = await HMO.findOne({ name });
        if (existingHMO) {
            return res.status(400).json({ message: 'HMO with this name already exists' });
        }

        const hmo = await HMO.create({
            name,
            code,
            category: category || 'Private',
            description,
            contactPerson,
            contactPhone,
            contactEmail
        });

        res.status(201).json(hmo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update HMO
// @route   PUT /api/hmos/:id
// @access  Private (Admin)
const updateHMO = async (req, res) => {
    try {
        const hmo = await HMO.findById(req.params.id);

        if (!hmo) {
            return res.status(404).json({ message: 'HMO not found' });
        }

        // Check if updating name to an existing name
        if (req.body.name && req.body.name !== hmo.name) {
            const existingHMO = await HMO.findOne({ name: req.body.name });
            if (existingHMO) {
                return res.status(400).json({ message: 'HMO with this name already exists' });
            }
        }

        hmo.name = req.body.name || hmo.name;
        hmo.code = req.body.code !== undefined ? req.body.code : hmo.code;
        hmo.category = req.body.category || hmo.category;
        hmo.description = req.body.description !== undefined ? req.body.description : hmo.description;
        hmo.contactPerson = req.body.contactPerson !== undefined ? req.body.contactPerson : hmo.contactPerson;
        hmo.contactPhone = req.body.contactPhone !== undefined ? req.body.contactPhone : hmo.contactPhone;
        hmo.contactEmail = req.body.contactEmail !== undefined ? req.body.contactEmail : hmo.contactEmail;

        const updatedHMO = await hmo.save();
        res.json(updatedHMO);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete HMO
// @route   DELETE /api/hmos/:id
// @access  Private (Admin)
const deleteHMO = async (req, res) => {
    try {
        const hmo = await HMO.findById(req.params.id);

        if (!hmo) {
            return res.status(404).json({ message: 'HMO not found' });
        }

        await hmo.deleteOne();
        res.json({ message: 'HMO deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Toggle HMO active status
// @route   PATCH /api/hmos/:id/toggle-status
// @access  Private (Admin)
const toggleHMOStatus = async (req, res) => {
    try {
        const hmo = await HMO.findById(req.params.id);

        if (!hmo) {
            return res.status(404).json({ message: 'HMO not found' });
        }

        hmo.active = !hmo.active;
        const updatedHMO = await hmo.save();

        res.json(updatedHMO);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Import HMOs from Excel
// @route   POST /api/hmos/import-excel
// @access  Private (Admin)
const importHMOsFromExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Read Excel file
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        const results = {
            success: [],
            failed: []
        };

        // Process each row
        for (const row of data) {
            try {
                // Check required field
                if (!row['HMO Name'] && !row['name']) {
                    results.failed.push({
                        row,
                        error: 'HMO Name is required'
                    });
                    continue;
                }

                const hmoName = row['HMO Name'] || row['name'];

                // Check if HMO already exists
                const existingHMO = await HMO.findOne({ name: hmoName });
                if (existingHMO) {
                    results.failed.push({
                        row,
                        error: 'HMO already exists'
                    });
                    continue;
                }

                // Create HMO
                const hmo = await HMO.create({
                    name: hmoName,
                    code: row['Code'] || row['code'] || '',
                    category: row['Category'] || row['category'] || 'Private',
                    description: row['Description'] || row['description'] || '',
                    contactPerson: row['Contact Person'] || row['contactPerson'] || '',
                    contactPhone: row['Contact Phone'] || row['contactPhone'] || '',
                    contactEmail: row['Contact Email'] || row['contactEmail'] || ''
                });

                results.success.push(hmo);
            } catch (error) {
                results.failed.push({
                    row,
                    error: error.message
                });
            }
        }

        res.json({
            message: `Imported ${results.success.length} HMOs successfully. ${results.failed.length} failed.`,
            results
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getHMOs,
    getHMOById,
    createHMO,
    updateHMO,
    deleteHMO,
    toggleHMOStatus,
    importHMOsFromExcel
};
