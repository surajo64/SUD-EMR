const mongoose = require('mongoose');

const familyFileSchema = mongoose.Schema({
    familyName: {
        type: String,
        required: true,
        trim: true
    },
    fileNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Family of 5', 'Family Above 5'],
        default: 'Family of 5'
    },
    memberCount: {
        type: Number,
        default: 0
    },
    registrationCharge: {
        type: Number,
        required: true,
        default: 0
    },
    familyCharge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Charge'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    active: {
        type: Boolean,
        default: true
    },
    description: {
        type: String
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid'],
        default: 'pending'
    },
    paidAt: {
        type: Date
    }
}, {
    timestamps: true,
});

const FamilyFile = mongoose.model('FamilyFile', familyFileSchema);

module.exports = FamilyFile;
