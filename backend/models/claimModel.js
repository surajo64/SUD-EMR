const mongoose = require('mongoose');

const claimItemSchema = mongoose.Schema({
    charge: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Charge',
        required: false
    },
    chargeType: {
        type: String,
        required: true,
        enum: ['consultation', 'lab', 'radiology', 'drugs', 'nursing', 'other']
    },
    description: {
        type: String,
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        default: 1
    },
    unitPrice: {
        type: Number,
        required: true
    },
    totalAmount: {
        type: Number,
        required: true
    },
    patientPortion: {
        type: Number,
        required: true,
        default: 0
    },
    hmoPortion: {
        type: Number,
        required: true
    }
});

const claimSchema = mongoose.Schema({
    claimNumber: {
        type: String,
        required: true,
        unique: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    hmo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HMO',
        required: true
    },
    encounter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Visit',
        required: true
    },
    claimItems: [claimItemSchema],
    totalClaimAmount: {
        type: Number,
        required: true
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'submitted', 'approved', 'rejected', 'paid'],
        default: 'pending'
    },
    submittedDate: {
        type: Date
    },
    approvedDate: {
        type: Date
    },
    paidDate: {
        type: Date
    },
    rejectionReason: {
        type: String
    },
    notes: {
        type: String
    }
}, {
    timestamps: true
});

// Auto-generate claim number
claimSchema.pre('save', async function (next) {
    if (!this.claimNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose.model('Claim').countDocuments();
        this.claimNumber = `CLM-${year}-${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

const Claim = mongoose.model('Claim', claimSchema);

module.exports = Claim;
