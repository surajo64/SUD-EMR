const mongoose = require('mongoose');

const radiologyOrderSchema = mongoose.Schema({
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' },
    charge: { type: mongoose.Schema.Types.ObjectId, ref: 'EncounterCharge' },
    scanType: { type: String, required: true }, // e.g., X-Ray, MRI
    resultImage: { type: String }, // URL to image
    report: { type: String },
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reportDate: { type: Date },
}, {
    timestamps: true,
});

const RadiologyOrder = mongoose.model('RadiologyOrder', radiologyOrderSchema);

module.exports = RadiologyOrder;
