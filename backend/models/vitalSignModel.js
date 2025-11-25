const mongoose = require('mongoose');

const vitalSignSchema = mongoose.Schema({
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    nurse: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    bloodPressure: { type: String }, // e.g., "120/80"
    temperature: { type: Number }, // in Celsius
    pulseRate: { type: Number },
    respiratoryRate: { type: Number },
    weight: { type: Number }, // in kg
    height: { type: Number }, // in cm
    spo2: { type: Number }, // Oxygen Saturation

    notes: { type: String },
}, {
    timestamps: true,
});

const VitalSign = mongoose.model('VitalSign', vitalSignSchema);

module.exports = VitalSign;
