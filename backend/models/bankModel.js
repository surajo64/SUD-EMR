const mongoose = require('mongoose');

const bankSchema = new mongoose.Schema({
    bankName: {
        type: String,
        required: true,
        trim: true
    },
    accountName: {
        type: String,
        required: true,
        trim: true
    },
    accountNumber: {
        type: String,
        required: true,
        trim: true
    },
    branchName: {
        type: String,
        trim: true
    },
    swiftCode: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isDefault: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Ensure only one default bank at a time
bankSchema.pre('save', async function (next) {
    if (this.isDefault) {
        await this.constructor.updateMany(
            { _id: { $ne: this._id }, isDefault: true },
            { isDefault: false }
        );
    }
    next();
});

module.exports = mongoose.model('Bank', bankSchema);
