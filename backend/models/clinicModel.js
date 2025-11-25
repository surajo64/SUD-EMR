const mongoose = require('mongoose');

const clinicSchema = mongoose.Schema({
    name: { type: String, required: true }, // e.g., "General Medicine", "Pediatrics", "Cardiology"
    description: { type: String }, // Brief description of the clinic
    department: { type: String, required: true }, // Department category
    active: { type: Boolean, default: true }, // Whether clinic is active
}, {
    timestamps: true,
});

module.exports = mongoose.model('Clinic', clinicSchema);
