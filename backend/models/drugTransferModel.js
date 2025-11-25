const mongoose = require('mongoose');

const drugTransferSchema = mongoose.Schema({
    drug: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory',
        required: true
    },
    fromPharmacy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pharmacy',
        required: true
    },
    toPharmacy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pharmacy',
        required: true
    },
    requestedQuantity: {
        type: Number,
        required: true,
        min: 1
    },
    approvedQuantity: {
        type: Number,
        min: 1
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'completed'],
        default: 'pending'
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reviewedAt: {
        type: Date
    },
    completedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    completedAt: {
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

const DrugTransfer = mongoose.model('DrugTransfer', drugTransferSchema);

module.exports = DrugTransfer;
