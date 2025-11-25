const mongoose = require('mongoose');

const pharmacySchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    location: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isMainPharmacy: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Ensure only one pharmacy can be marked as main
pharmacySchema.pre('save', async function (next) {
    if (this.isMainPharmacy) {
        await mongoose.model('Pharmacy').updateMany(
            { _id: { $ne: this._id } },
            { isMainPharmacy: false }
        );
    }
    next();
});

const Pharmacy = mongoose.model('Pharmacy', pharmacySchema);

module.exports = Pharmacy;
