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
    // Discharge Summary
    dischargeNotes: { type: String },
    dischargedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    clinicalNotes: [{
        doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
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
        generalAppearance: { type: String },
        heent: { type: String },
        neck: { type: String },
        cvs: { type: String },
        resp: { type: String },
        abd: { type: String },
        neuro: { type: String },
        msk: { type: String },
        skin: { type: String },
        assessment: { type: String },
        plan: { type: String },
        diagnosis: [{
            code: String,
            description: String,
            type: { type: String, enum: ['Primary', 'Secondary'] }
        }],
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    }],

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
        // Consent Form Data & Uploads
        consent: {
            patientName: String,
            patientAddress: String,
            physicianName: String,
            procedureName: String,
            consentDate: Date,
            relationship: String,
            explanationDate: Date,

            patientSignatureName: String,
            patientSignatureDate: Date,
            surgeonSignatureName: String,
            surgeonSignatureDate: Date,
            guardianSignatureName: String,
            guardianSignatureDate: Date,
            anaesthetistSignatureName: String,
            anaesthetistSignatureDate: Date,
            relationshipWithPatient: String,

            patientThumbprint: String,
            patientThumbprintDate: Date,
            witnessThumbprint: String,
            witnessThumbprintDate: Date,

            uploadedFile: String, // URL/Path to PDF or Image file
            
            filledAt: Date,
            filledBy: String
        }
    }],

    // Detached Consent Forms
    consents: [{
        patientName: String,
        patientAddress: String,
        physicianName: String,
        procedureName: String,
        consentDate: Date,
        relationship: String,
        explanationDate: Date,

        patientSignatureName: String,
        patientSignatureDate: Date,
        surgeonSignatureName: String,
        surgeonSignatureDate: Date,
        guardianSignatureName: String,
        guardianSignatureDate: Date,
        anaesthetistSignatureName: String,
        anaesthetistSignatureDate: Date,
        relationshipWithPatient: String,

        patientThumbprint: String,
        patientThumbprintDate: Date,
        witnessThumbprint: String,
        witnessThumbprintDate: Date,

        uploadedFile: String, // URL/Path to PDF or Image file
        
        filledAt: Date,
        filledBy: String,
        createdAt: { type: Date, default: Date.now }
    }],

    // Anaesthetic Machine/Medication & Equipment Checklists
    checklists: [{
        primaryOxygenChecked: String,
        backupOxygenAvailable: String,
        oxygenAlarmWorking: String,
        flowmetersWorking: String,
        vaporiserAttachedFull: String,
        leakTestPassed: String,
        scavengingChecked: String,
        monitoringEquipmentFunctioning: String,
        halothaneIsofluraneAvailable: String,

        emergencyEquipmentChecked: String,
        endotrachealTubesChecked: String,
        airwayAidsChecked: String,
        selfInflatingBagChecked: String,
        intravenousCannulaeChecked: String,
        fluidAdministrationSetChecked: String,
        isotonicCrystalloidChecked: String,
        epinephrineChecked: String,
        atropineChecked: String,
        antagonistsChecked: String,

        filledAt: Date,
        filledBy: String,
        createdAt: { type: Date, default: Date.now }
    }],

    // Pre-Anaesthesia Checklists
    preAnaesthesiaChecklists: [{
        firstName: String,
        lastName: String,
        patientMRN: String,
        historyClinicalExamSignificant: String,
        historyClinicalExamDetails: String,
        abnormalitiesWarrantInvestigation: String,
        specificInvestigationsDetails: String,
        abnormalitiesCanBeStabilised: String,
        anticipatedComplications: String,
        complicationManagement: String,
        premedication: String,
        painManagement: String,
        anaesthesiaInductionMaintenance: String,
        patientMonitoring: String,
        bodyTemperatureMaintenance: String,
        postAnaestheticManagement: String,
        facilitiesAvailable: String,
        unavailableResourcesDetails: String,
        filledAt: Date,
        filledBy: String,
        createdAt: { type: Date, default: Date.now }
    }],

    // Postoperative Handover Checklists
    postoperativeHandoverChecklists: [{
        patientNumber: String,
        firstName: String,
        lastName: String,
        age: String,
        allergyStatus: String,
        diagnosis: String,
        procedure: String,
        currentPatientStatusSelect: String,
        currentPatientStatusDetails: String,
        vitalsRecordedInEmr: String,
        
        anaesthesiaType: String,
        intraoperativeAnaestheticCourse: String,
        postoperativeBloodTransfusionRequired: String,
        medicationsGivenInTheatre: String,
        planForMonitoring: String,
        planForIntravenousFluids: String,
        planForPainRelief: String,
        planForLines: String,
        postoperativeInvestigationsRequired: String,
        
        consultantSurgeon: String,
        durationOfSurgery: String,
        intraoperativeSurgicalCourse: String,
        bloodLossTransfusions: String,
        planForNasogastricTube: String,
        dvtProphylaxisPlan: String,
        antibioticPlan: String,
        consultantAnaesthesiologistFirstName: String,
        consultantAnaesthesiologistLastName: String,
        nurseAnaesthetistFirstName: String,
        nurseAnaesthetistLastName: String,
        zonalWardNurseFirstName: String,
        zonalWardNurseLastName: String,
        
        filledAt: Date,
        filledBy: String,
        createdAt: { type: Date, default: Date.now }
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
    isActive: { type: Boolean },
}, {
    timestamps: true,
});

const Visit = mongoose.model('Visit', visitSchema);

module.exports = Visit;
