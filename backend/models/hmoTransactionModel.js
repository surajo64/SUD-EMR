const mongoose = require('mongoose');

const hmoTransactionSchema = mongoose.Schema({
    hmo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HMO',
        required: true
    },
    type: {
        type: String,
        enum: ['deposit', 'charge', 'refund'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    reference: {
        type: String // e.g., Receipt Number, Check Number
    },
    recordedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    date: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('HMOTransaction', hmoTransactionSchema);
