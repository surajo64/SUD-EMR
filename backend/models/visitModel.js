const mongoose = require('mongoose');

const visitSchema = mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    type: { type: String, enum: ['Outpatient', 'Inpatient', 'Emergency', 'External Investigation'], required: true },
    status: { type: String, enum: ['Admitted', 'Discharged', 'In Progress'], default: 'In Progress' },

    // SOAP Notes (V3)
    subjective: { type: String }, // Chief Complaint, History of Present Illness
    objective: { type: String }, // Physical Exam Findings
    assessment: { type: String }, // Diagnosis/Analysis
    plan: { type: String }, // Treatment Plan
    reasonForVisit: { type: String }, // Reason for visit

    // Legacy/Simple fields (optional)
    diagnosis: [{
        code: String, // ICD-10 Code
        description: String,
        type: { type: String, enum: ['Primary', 'Secondary'] }
    }],

    // Inpatient Specific
    admissionDate: { type: Date },
    dischargeDate: { type: Date },
    roomNumber: { type: String },

    // V5: Payment Validation & Encounter Workflow
    consultingPhysician: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    nursingNotes: { type: String },
    paymentValidated: { type: Boolean, default: false },
    receiptNumber: { type: String }, // For department validation
    encounterStatus: {
        type: String,
        enum: ['registered', 'payment_pending', 'in_nursing', 'with_doctor', 'awaiting_services', 'in_pharmacy', 'checkout', 'in_ward', 'completed', 'admitted', 'discharged', 'cancelled'],
        default: 'registered'
    },
    ward: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Ward'
    },
    bed: {
        type: String
    },
    admissionDate: {
        type: Date
    },
    dischargeDate: {
        type: Date
    },
    notes: [{
        text: String,
        author: String, // Name of the user who added the note
        role: String,
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    // Clinic and Encounter Type
    clinic: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
    encounterType: {
        type: String,
        enum: ['Outpatient', 'Emergency', 'Follow-up', 'Inpatient', 'Consultation', 'External Investigation'],
        default: 'Outpatient'
    },
}, {
    timestamps: true,
});

const Visit = mongoose.model('Visit', visitSchema);

module.exports = Visit;
