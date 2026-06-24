const mongoose = require('mongoose');

const drugAdministrationSchema = mongoose.Schema({
    visit: { type: mongoose.Schema.Types.ObjectId, ref: 'Visit', required: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    nurse: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    prescription: { type: mongoose.Schema.Types.ObjectId, ref: 'Prescription', required: true },
    medicineId: { type: String, required: true }, // The _id of the medicine in the medicines array
    medicineName: { type: String, required: true },
    dosage: { type: String },
    
    administeredAt: { type: Date, required: true },
    remarks: { type: String },
}, {
    timestamps: true,
});

const DrugAdministration = mongoose.model('DrugAdministration', drugAdministrationSchema);

module.exports = DrugAdministration;
