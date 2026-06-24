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

        const hmos = await HMO.find(filter)
            .populate('registrationChargeRef', 'name standardFee basePrice')
            .sort({ name: 1 });
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
        const hmo = await HMO.findById(req.params.id)
            .populate('registrationChargeRef', 'name standardFee basePrice');

        if (!hmo) {
            return res.status(404).json({ message: 'HMO not found' });
        }

        res.json(hmo);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get next auto-generated HMO code
// @route   GET /api/hmos/next-code
// @access  Private
const getNextHMOCode = async (req, res) => {
    try {
        const { category } = req.query;

        // Determine prefix from category
        let prefix = 'HMO';
        if (category === 'Retainership') prefix = 'RTN';
        else if (category === 'NHIA') prefix = 'NHIA';
        else if (category === 'State Scheme') prefix = 'SS';

        // Find all codes with this prefix and determine max number
        const hmos = await HMO.find({ code: new RegExp(`^${prefix}`) }).select('code');

        let maxNum = 0;
        hmos.forEach(h => {
            const numPart = parseInt((h.code || '').replace(prefix, '')) || 0;
            if (numPart > maxNum) maxNum = numPart;
        });

        const nextNum = String(maxNum + 1).padStart(4, '0');
        res.json({ nextCode: `${prefix}${nextNum}` });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create new HMO
// @route   POST /api/hmos
// @access  Private (Admin/Receptionist)
const createHMO = async (req, res) => {
    try {
        const {
            name, code, category, retainershipType,
            registrationChargeRef, registrationCharge,
            description, contactPerson, contactPhone, contactEmail
        } = req.body;

        // Check if HMO with same name already exists
        const existingHMO = await HMO.findOne({ name });
        if (existingHMO) {
            return res.status(400).json({ message: 'HMO with this name already exists' });
        }

        // Auto-generate code if not provided
        let finalCode = code;
        if (!finalCode) {
            let prefix = 'HMO';
            if (category === 'Retainership') prefix = 'RTN';
            else if (category === 'NHIA') prefix = 'NHIA';
            else if (category === 'State Scheme') prefix = 'SS';

            const existingCodes = await HMO.find({ code: new RegExp(`^${prefix}`) }).select('code');
            let maxNum = 0;
            existingCodes.forEach(h => {
                const numPart = parseInt((h.code || '').replace(prefix, '')) || 0;
                if (numPart > maxNum) maxNum = numPart;
            });
            finalCode = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
        }

        const hmo = await HMO.create({
            name,
            code: finalCode,
            category: category || 'Retainership',
            retainershipType: category === 'Retainership' ? (retainershipType || '') : '',
            registrationChargeRef: registrationChargeRef || null,
            registrationCharge: registrationCharge || 0,
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
// @access  Private (Admin/Receptionist)
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
        hmo.retainershipType = req.body.category === 'Retainership'
            ? (req.body.retainershipType !== undefined ? req.body.retainershipType : hmo.retainershipType)
            : '';
        hmo.registrationChargeRef = req.body.registrationChargeRef !== undefined
            ? (req.body.registrationChargeRef || null)
            : hmo.registrationChargeRef;
        hmo.registrationCharge = req.body.registrationCharge !== undefined
            ? req.body.registrationCharge
            : hmo.registrationCharge;
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
                if (!row['HMO Name'] && !row['name']) {
                    results.failed.push({ row, error: 'HMO Name is required' });
                    continue;
                }

                const hmoName = row['HMO Name'] || row['name'];
                const existingHMO = await HMO.findOne({ name: hmoName });
                if (existingHMO) {
                    results.failed.push({ row, error: 'HMO already exists' });
                    continue;
                }

                const category = row['Category'] || row['category'] || 'Retainership';
                let prefix = 'HMO';
                if (category === 'Retainership') prefix = 'RTN';
                else if (category === 'NHIA') prefix = 'NHIA';
                else if (category === 'State Scheme') prefix = 'SS';

                let code = row['Code'] || row['code'] || '';
                if (!code) {
                    const existingCodes = await HMO.find({ code: new RegExp(`^${prefix}`) }).select('code');
                    let maxNum = 0;
                    existingCodes.forEach(h => {
                        const n = parseInt((h.code || '').replace(prefix, '')) || 0;
                        if (n > maxNum) maxNum = n;
                    });
                    code = `${prefix}${String(maxNum + 1).padStart(4, '0')}`;
                }

                const hmo = await HMO.create({
                    name: hmoName,
                    code,
                    category,
                    description: row['Description'] || row['description'] || '',
                    contactPerson: row['Contact Person'] || row['contactPerson'] || '',
                    contactPhone: row['Contact Phone'] || row['contactPhone'] || '',
                    contactEmail: row['Contact Email'] || row['contactEmail'] || ''
                });

                results.success.push(hmo);
            } catch (error) {
                results.failed.push({ row, error: error.message });
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
    getNextHMOCode,
    createHMO,
    updateHMO,
    deleteHMO,
    toggleHMOStatus,
    importHMOsFromExcel
};
