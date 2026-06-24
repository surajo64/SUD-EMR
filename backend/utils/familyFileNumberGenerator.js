const Setting = require('../models/settingModel');

/**
 * Generate next Family File Number in format: FF-Year-0001
 * @param {boolean} increment - Whether to increment and save the counter
 * @returns {Promise<string>} Generated File Number
 */
const generateFamilyFileNumber = async (increment = true) => {
    try {
        let settings = await Setting.findOne();

        if (!settings) {
            settings = await Setting.create({ familyFileCounter: 0 });
        }

        const currentYear = new Date().getFullYear();
        
        let counter = settings.familyFileCounter;
        if (increment) {
            settings.familyFileCounter += 1;
            await settings.save();
            counter = settings.familyFileCounter;
        } else {
            counter += 1; // Preview next
        }

        const paddedCounter = counter.toString().padStart(4, '0');
        return `FF-${currentYear}-${paddedCounter}`;
    } catch (error) {
        console.error('Error generating Family File Number:', error);
        return `FF-${Date.now().toString().slice(-4)}`;
    }
};

module.exports = { generateFamilyFileNumber };
