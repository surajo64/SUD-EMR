const mongoose = require('mongoose');

const appointmentSchema = mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    time: { type: String, required: true }, // e.g., "10:00 AM"
    type: { type: String, enum: ['Checkup', 'Follow-up', 'Emergency'], default: 'Checkup' },
    status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled', 'No-show'], default: 'Scheduled' },
    reason: { type: String },
}, {
    timestamps: true,
});

const Appointment = mongoose.model('Appointment', appointmentSchema);

module.exports = Appointment;
