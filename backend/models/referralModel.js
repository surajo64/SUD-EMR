const mongoose = require('mongoose');

const referralSchema = mongoose.Schema({
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient',
        required: true
    },
    visit: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Visit',
        required: true
    },
    doctor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    referredTo: {
        type: String,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    diagnosis: {
        type: String,
        required: true
    },
    notes: {
        type: String
    },
    medicalHistory: {
        type: String
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Referral', referralSchema);
