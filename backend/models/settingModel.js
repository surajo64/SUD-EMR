const mongoose = require('mongoose');

const settingSchema = mongoose.Schema({
    hospitalName: { type: String, default: 'SUD EMR System' },
    hospitalLogo: { type: String }, // Store as Base64 or URL
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    systemVersion: { type: String, default: '1.0.0' },
    environment: { type: String, default: 'Production' },
    database: { type: String, default: 'MongoDB' },
    reportHeader: { type: String, default: '' },
    reportFooter: { type: String, default: '' },
    currencySymbol: { type: String, default: '₦' },
    idPrefix: { type: String, default: 'PAT' }, // Prefix for MRN generation (e.g., 'SUD', 'HOSP')
    mrnCounter: { type: Number, default: 0 }, // Auto-incrementing counter for MRN
    familyFileCounter: { type: Number, default: 0 }, // Auto-incrementing counter for Family Files
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;
