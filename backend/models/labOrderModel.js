const mongoose = require('mongoose');

const labOrderSchema = mongoose.Schema({
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' },
    charge: { type: mongoose.Schema.Types.ObjectId, ref: 'EncounterCharge' },
    testName: { type: String, required: true },
    result: { type: String },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    notes: { type: String },

    // Signature tracking
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    signedAt: { type: Date },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lastModifiedAt: { type: Date },

    // Approval tracking
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
}, {
    timestamps: true,
});

const LabOrder = mongoose.model('LabOrder', labOrderSchema);

module.exports = LabOrder;
