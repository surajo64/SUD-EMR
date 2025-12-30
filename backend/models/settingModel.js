const mongoose = require('mongoose');

const settingSchema = mongoose.Schema({
    hospitalName: { type: String, default: 'SUD EMR System' },
    hospitalLogo: { type: String }, // Store as Base64 or URL
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    website: { type: String, default: '' },
    systemVersion: { type: String, default: '1.0.0' },
    reportHeader: { type: String, default: '' },
    reportFooter: { type: String, default: '' },
    currencySymbol: { type: String, default: '₦' },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
    timestamps: true
});

const Setting = mongoose.model('Setting', settingSchema);

module.exports = Setting;
