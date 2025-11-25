const mongoose = require('mongoose');

const drugDisposalSchema = mongoose.Schema({
    drug: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Inventory',
        required: true
    },
    pharmacy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pharmacy',
        required: true
    },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    disposalType: {
        type: String,
        enum: ['destruction', 'return_to_supplier'],
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    disposedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    supplierReturnDetails: {
        supplierName: String,
        returnDate: Date,
        returnReason: String,
        refundAmount: Number,
        trackingNumber: String
    },
    batchNumber: String,
    expiryDate: Date,
    notes: String
}, {
    timestamps: true
});

const DrugDisposal = mongoose.model('DrugDisposal', drugDisposalSchema);

module.exports = DrugDisposal;
