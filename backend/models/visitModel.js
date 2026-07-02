const mongoose = require('mongoose');

const encounterTypes = ['Outpatient', 'Inpatient', 'Emergency', 'Follow-up', 'Consultation', 'External Investigation', 'External Lab', 'External Radiology', 'External Pharmacy'];

const visitSchema = mongoose.Schema({
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment' },
    type: { type: String, enum: encounterTypes, required: true },
    status: { type: String, enum: ['Admitted', 'Discharged', 'In Progress'], default: 'In Progress' },

    // Structured Clinical Documentation (replaces traditional SOAP S/O)
    presentingComplaints: { type: String },
    historyOfPresentingComplaint: { type: String },
    systemReview: { type: String },
    pastMedicalSurgicalHistory: { type: String },
    socialFamilyHistory: { type: String },
    drugsHistory: { type: String },
    functionalCognitiveStatus: { type: String },
    menstruationGynecologicalObstetricsHistory: { type: String },
    pregnancyHistory: { type: String },
    immunization: { type: String },
    nutritional: { type: String },
    developmentalMilestones: { type: String },

    // Physical Examination
    generalAppearance: { type: String },
    heent: { type: String },
    neck: { type: String },
    cvs: { type: String },
    resp: { type: String },
    abd: { type: String },
    neuro: { type: String },
    msk: { type: String },
    skin: { type: String },

    // Assessment and Plan (retained from SOAP)
    assessment: { type: String }, // Clinical impression/analysis
    plan: { type: String }, // Treatment Plan
    reasonForVisit: { type: String }, // Reason for visit

    // Legacy fields for backward compatibility
    subjective: { type: String }, // Deprecated - use structured fields above
    objective: { type: String }, // Deprecated - use structured fields above

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
    isANC: { type: Boolean, default: false },
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

    // Inpatient Ward Round Notes
    wardRoundNotes: [{
        text: String,
        author: String,
        role: String,
        createdAt: { type: Date, default: Date.now }
    }],

    // Theatre Operation Notes
    theatreNotes: [{
        // Operation Details
        dateOfSurgery: Date,
        startTime: String,
        endTime: String,
        theatreName: String,
        surgeryType: { type: String, enum: ['Elective', 'Emergency'], default: 'Elective' },
        procedurePerformed: String,
        preOperativeDiagnosis: String,
        postOperativeDiagnosis: String,
        operativeFindings: String,
        operativeNotes: String,
        estimatedBloodLoss: String,
        bloodTransfusion: String,
        complications: String,
        drains: String,
        specimens: String,
        implants: String,
        woundClosure: String,
        postOperativeCondition: String,
        postOperativeInstructions: String,
        // Surgical Team
        leadSurgeon: String,
        assistantSurgeons: String,
        anaesthetist: String,
        scrubNurse: String,
        circulatingNurse: String,
        // Anaesthesia
        anaesthesiaType: String,
        anaesthesiaNote: String,
        // Audit
        status: { type: String, enum: ['Draft', 'Completed', 'Reviewed'], default: 'Draft' },
        createdBy: String,
        createdAt: { type: Date, default: Date.now },
        updatedBy: String,
        updatedAt: Date,
        digitalSignature: String,
    }],

    // Clinic and Encounter Type
    clinic: { type: mongoose.Schema.Types.ObjectId, ref: 'Clinic' },
    encounterType: {
        type: String,
        enum: encounterTypes,
        default: 'Outpatient'
    },
    waiveConsultationFee: { type: Boolean, default: false },
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    needSpeciality: { type: Boolean, default: false },
    specialityClinic: { type: mongoose.Schema.Types.ObjectId, ref: 'SpecialityClinic' },
    needSpecificDoctor: { type: Boolean, default: false },
    specificDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    seen: { type: Boolean, default: false },
    seenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    seenAt: { type: Date },
}, {
    timestamps: true,
});

const Visit = mongoose.model('Visit', visitSchema);

module.exports = Visit;
