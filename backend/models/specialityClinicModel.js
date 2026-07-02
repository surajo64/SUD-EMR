const mongoose = require('mongoose');

const specialityClinicSchema = mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String },
    department: { type: String, required: true },
    active: { type: Boolean, default: true },
}, {
    timestamps: true,
});

module.exports = mongoose.model('SpecialityClinic', specialityClinicSchema);
