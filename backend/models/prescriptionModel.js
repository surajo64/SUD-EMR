const mongoose = require('mongoose');

const prescriptionSchema = mongoose.Schema({
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit' }, // Link to specific encounter
    charge: { type: mongoose.Schema.Types.ObjectId, ref: 'EncounterCharge' },
    medicines: [{

        name: { type: String, required: true },
        dosage: { type: String, required: true },
        frequency: { type: String, required: true },
        duration: { type: String, required: true },
        quantity: { type: Number, default: 1 }, // Doctor's prescribed quantity
    }],
    notes: { type: String },
    status: { type: String, enum: ['pending', 'dispensed'], default: 'pending' },
    dispensedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    dispensedAt: { type: Date },
}, {
    timestamps: true,
});

const Prescription = mongoose.model('Prescription', prescriptionSchema);

module.exports = Prescription;
