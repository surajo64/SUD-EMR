const mongoose = require('mongoose');

const patientSchema = mongoose.Schema({
    mrn: { type: String, unique: true, required: true },
    name: { type: String, required: true },
    age: { type: Number, required: true },
    gender: { type: String, required: true },
    contact: { type: String, required: true },
    address: { type: String },
    medicalHistory: [{ type: String }],

    // Insurance/Provider Details
    provider: {
        type: String,
        enum: ['Standard', 'Retainership', 'NHIA', 'KSCHMA'],
        default: 'Standard'
    },
    hmo: { type: String }, // Only for NHIA patients
    insuranceNumber: { type: String },

    // Financials
    depositBalance: { type: Number, default: 0 },
    lowDepositThreshold: { type: Number, default: 5000 }, // Alert when below this amount

    // Emergency Contact
    emergencyContactName: { type: String },
    emergencyContactPhone: { type: String },

    // Clinical Data (V3)
    allergies: [{ type: String }],
    immunizations: [{
        name: String,
        date: Date,
        notes: String
    }],
    pastSurgeries: [{ type: String }],
}, {
    timestamps: true,
});

const Patient = mongoose.model('Patient', patientSchema);

module.exports = Patient;
