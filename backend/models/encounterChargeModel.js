const mongoose = require('mongoose');

const encounterChargeSchema = mongoose.Schema({
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    charge: { type: mongoose.Schema.Types.ObjectId, ref: 'Charge' }, // Optional for custom/system charges
    quantity: { type: Number, default: 1 },
    totalAmount: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'paid', 'cancelled'], default: 'pending' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Optional for system charges
    itemType: { type: String }, // e.g., 'Service', 'Drug', 'Lab', 'Daily Bed Fee'
    itemName: { type: String }, // Snapshot of the name
    receipt: { type: mongoose.Schema.Types.ObjectId, ref: 'Receipt' }, // Linked after payment
    notes: { type: String },
}, {
    timestamps: true,
});

module.exports = mongoose.model('EncounterCharge', encounterChargeSchema);
