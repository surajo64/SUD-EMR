const Setting = require('../models/settingModel');

/**
 * Generate MRN in format: IDPrefixYear0001
 * @returns {Promise<string>} Generated MRN
 */
const generateMRN = async () => {
    try {
        // Get or create settings
        let settings = await Setting.findOne();

        if (!settings) {
            settings = await Setting.create({
                idPrefix: 'PAT',
                mrnCounter: 0
            });
        }

        // Get current year
        const currentYear = new Date().getFullYear();

        // Increment counter
        settings.mrnCounter += 1;
        await settings.save();

        // Format counter with leading zeros (4 digits)
        const paddedCounter = settings.mrnCounter.toString().padStart(4, '0');

        // Generate MRN: PREFIX YEAR 0001 (no dashes)
        const mrn = `${settings.idPrefix}${currentYear}${paddedCounter}`;

        return mrn;
    } catch (error) {
        console.error('Error generating MRN:', error);
        // Fallback to old format if there's an error
        return `PAT${Date.now().toString().slice(-6)}${Math.floor(1000 + Math.random() * 9000)}`;
    }
};

module.exports = { generateMRN };
