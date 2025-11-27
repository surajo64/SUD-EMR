const mongoose = require('mongoose');

const receiptSchema = mongoose.Schema({
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    amountPaid: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['cash', 'card', 'insurance', 'deposit', 'retainership'], default: 'cash' },
    cashier: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    receiptNumber: { type: String, unique: true, required: true },
    paymentDate: { type: Date, default: Date.now },

    // V5: Validation tracking
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' },
    charges: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EncounterCharge' }],
    validated: { type: Boolean, default: false },
    validatedBy: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        department: { type: String },
        timestamp: { type: Date, default: Date.now }
    }],
}, {
    timestamps: true,
});

module.exports = mongoose.model('Receipt', receiptSchema);
