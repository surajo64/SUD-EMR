const mongoose = require('mongoose');

const wardSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    type: {
        type: String,
        enum: ['General', 'Private', 'ICU', 'Emergency', 'Maternity', 'Pediatric', 'Surgical'],
        default: 'General'
    },
    dailyRate: {
        type: Number,
        required: true,
        default: 0
    },
    rates: {
        Standard: { type: Number, default: 0 },
        NHIA: { type: Number, default: 0 },
        Retainership: { type: Number, default: 0 },
        KSCHMA: { type: Number, default: 0 }
    },
    description: {
        type: String
    },
    beds: [{
        number: {
            type: String,
            required: true
        },
        isOccupied: {
            type: Boolean,
            default: false
        },
        occupiedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Patient'
        }
    }]
}, {
    timestamps: true
});

module.exports = mongoose.model('Ward', wardSchema);
