const mongoose = require('mongoose');

const drugMetadataSchema = mongoose.Schema({
    type: {
        type: String,
        required: true,
        enum: ['route', 'form', 'dosage', 'frequency']
    },
    value: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Ensure unique value per type
drugMetadataSchema.index({ type: 1, value: 1 }, { unique: true });

const DrugMetadata = mongoose.model('DrugMetadata', drugMetadataSchema);

module.exports = DrugMetadata;
