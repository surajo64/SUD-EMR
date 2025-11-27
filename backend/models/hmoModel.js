const mongoose = require('mongoose');

const hmoSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    code: {
        type: String,
        trim: true
    },
    category: {
        type: String,
        required: true,
        enum: ['Private', 'NHIA', 'State Scheme', 'Retainership', 'Other'],
        default: 'Private'
    },
    description: {
        type: String
    },
    active: {
        type: Boolean,
        default: true
    },
    contactPerson: {
        type: String
    },
    contactPhone: {
        type: String
    },
    contactEmail: {
        type: String
    }
}, {
    timestamps: true,
});

const HMO = mongoose.model('HMO', hmoSchema);

module.exports = HMO;
