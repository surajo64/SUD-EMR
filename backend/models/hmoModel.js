const mongoose = require('mongoose');

const hmoSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    code: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Private', 'NHIA', 'State Scheme', 'Retainership', 'Other'],
        default: 'Retainership'
    },
    // Retainership-specific fields
    retainershipType: {
        type: String,
        enum: ['Family', 'Corporate', ''],
        default: ''
    },
    registrationChargeRef: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Charge'
    },
    registrationCharge: {
        type: Number,
        default: 0
    },
    description: {
        type: String
    },
    active: {
        type: Boolean,
        default: true
    },
    contactPerson: {
        type: String
    },
    contactPhone: {
        type: String
    },
    contactEmail: {
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

const HMO = mongoose.model('HMO', hmoSchema);

module.exports = HMO;
