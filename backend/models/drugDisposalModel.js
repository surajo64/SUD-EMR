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
    reason: {
        type: String,
        enum: ['expired', 'damaged', 'return_to_supplier', 'return_to_main', 'excess_stock', 'near_expiry', 'destruction', 'other'],
        required: true
    },
    processedBy: {
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
