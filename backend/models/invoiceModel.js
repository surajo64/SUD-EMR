const mongoose = require('mongoose');

const invoiceSchema = mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' },
    items: [{
        description: { type: String, required: true },
        cost: { type: Number, required: true }
    }],
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid', 'cancelled', 'reversed'], default: 'pending' },
    paymentMethod: { type: String, enum: ['cash', 'card', 'insurance', 'deposit'], default: 'cash' },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Who created this invoice
    feeType: { type: String, enum: ['consultation', 'lab', 'radiology', 'drugs', 'nursing', 'other'], required: true },
    department: { type: String }, // Department name for reporting

    // Reversal Details
    isReversed: { type: Boolean, default: false },
    reversalReason: { type: String },
    reversedAt: { type: Date },
    reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
    timestamps: true,
});

module.exports = mongoose.model('Invoice', invoiceSchema);
