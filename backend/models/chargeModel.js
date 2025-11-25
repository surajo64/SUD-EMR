const mongoose = require('mongoose');

const chargeSchema = mongoose.Schema({
    name: { type: String, required: true }, // e.g., "Consultation Fee", "CBC", "X-Ray Chest"
    type: {
        type: String,
        enum: ['consultation', 'lab', 'radiology', 'drugs', 'nursing', 'other'],
        required: true
    },
    basePrice: { type: Number, required: true },
    active: { type: Boolean, default: true },
    department: { type: String, required: true },
    description: { type: String },
    code: { type: String, unique: true, sparse: true }, // Optional: CPT/ICD code
    resultTemplate: { type: String }, // Default template for results
}, {
    timestamps: true,
});

module.exports = mongoose.model('Charge', chargeSchema);
