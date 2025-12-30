const Setting = require('../models/settingModel');

// @desc    Get system settings
// @route   GET /api/settings
// @access  Public
const getSettings = async (req, res) => {
    try {
        let settings = await Setting.findOne();
        if (!settings) {
            // Create default settings if not exists
            settings = await Setting.create({
                hospitalName: 'SUD EMR System',
                systemVersion: '1.0.0'
            });
        }
        res.json(settings);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update system settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    try {
        let settings = await Setting.findOne();

        if (settings) {
            settings.hospitalName = req.body.hospitalName || settings.hospitalName;
            settings.hospitalLogo = req.body.hospitalLogo || settings.hospitalLogo;
            settings.address = req.body.address || settings.address;
            settings.phone = req.body.phone || settings.phone;
            settings.email = req.body.email || settings.email;
            settings.website = req.body.website || settings.website;
            settings.systemVersion = req.body.systemVersion || settings.systemVersion;
            settings.reportHeader = req.body.reportHeader || settings.reportHeader;
            settings.reportFooter = req.body.reportFooter || settings.reportFooter;
            settings.currencySymbol = req.body.currencySymbol || settings.currencySymbol;
            settings.lastUpdatedBy = req.user._id;

            const updatedSettings = await settings.save();
            res.json(updatedSettings);
        } else {
            const newSettings = await Setting.create({
                ...req.body,
                lastUpdatedBy: req.user._id
            });
            res.status(201).json(newSettings);
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
