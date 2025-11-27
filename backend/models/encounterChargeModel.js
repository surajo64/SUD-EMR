const mongoose = require('mongoose');

const encounterChargeSchema = mongoose.Schema({
    encounter: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    charge: { type: mongoose.Schema.Types.ObjectId, ref: 'Charge' }, // Optional for custom/system charges
    quantity: { type: Number, default: 1 },
    unitPrice: { type: Number }, // Unit price based on provider tier
    totalAmount: { type: Number, required: true },
    patientPortion: { type: Number, default: 0 }, // Amount patient pays (10% for NHIA/KSCHMA drugs)
    hmoPortion: { type: Number, default: 0 }, // Amount HMO covers (90% for drugs, 100% for services)
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
