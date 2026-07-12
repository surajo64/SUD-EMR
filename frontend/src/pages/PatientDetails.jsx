import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import { formatAge } from '../utils/patientUtils';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import { checkRange, getRangeColorClass } from '../utils/labUtils';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import AppointmentModal from '../components/AppointmentModal';
import { FaTimes, FaFileMedical, FaPills, FaChevronDown, FaChevronUp, FaHeartbeat, FaNotesMedical, FaProcedures, FaXRay, FaVial, FaUserMd, FaCalendarPlus, FaPlus, FaTrash, FaEdit, FaSearch, FaClock, FaChevronRight, FaFileAlt, FaCheckCircle, FaInfoCircle, FaDollarSign, FaPrint, FaUpload, FaEye, FaDownload } from 'react-icons/fa';
import icd11Data from '../data/icd11.json';
import useHospitalSettings from '../hooks/useHospitalSettings';

const getNurseFirstName = (fullName) => {
    if (!fullName) return 'Unknown';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return 'Unknown';
    const firstPartLower = parts[0].toLowerCase().replace(/[^a-z]/g, '');
    const titles = ['nurse', 'matron', 'sister', 'sr', 'mr', 'mrs', 'ms', 'dr', 'doc'];
    if (titles.includes(firstPartLower) && parts.length > 1) {
        return parts[1];
    }
    return parts[0];
};

const anaestheticMachineItems = [
    { key: 'primaryOxygenChecked', label: 'PRIMARY OXYGEN source checked' },
    { key: 'backupOxygenAvailable', label: 'BACK-UP OXYGEN available' },
    { key: 'oxygenAlarmWorking', label: 'OXYGEN ALARM working (if present)' },
    { key: 'flowmetersWorking', label: 'FLOWMETERS working' },
    { key: 'vaporiserAttachedFull', label: 'VAPORISER attached and full' },
    { key: 'leakTestPassed', label: 'Anaesthetic machine passes LEAK TEST' },
    { key: 'scavengingChecked', label: 'SCAVENGING checked' },
    { key: 'monitoringEquipmentFunctioning', label: 'Available MONITORING equipment functioning' },
    { key: 'halothaneIsofluraneAvailable', label: 'Sufficient Halothane & Isoflurane available' }
];

const medicationsEquipmentItems = [
    { key: 'emergencyEquipmentChecked', label: 'EMERGENCY equipment and medications checked' },
    { key: 'endotrachealTubesChecked', label: 'Endotracheal tubes (cuffs checked)' },
    { key: 'airwayAidsChecked', label: 'Airway aids (e.g. laryngoscope, urinary catheter, lidocaine spray, suction, guide-wire/stylet)' },
    { key: 'selfInflatingBagChecked', label: 'Self-inflating bag (or demand valve for equine anaesthetics)' },
    { key: 'intravenousCannulaeChecked', label: 'Intravenous cannulae' },
    { key: 'fluidAdministrationSetChecked', label: 'Fluid administration set' },
    { key: 'isotonicCrystalloidChecked', label: 'Isotonic crystalloid solution ie. normal saline' },
    { key: 'epinephrineChecked', label: 'Epinephrine/adrenaline' },
    { key: 'atropineChecked', label: 'Atropine' },
    { key: 'antagonistsChecked', label: 'Antagonists (e.g. atipamezole, naloxone/butorphanol)' }
];

const PatientDetails = () => {
    const { id } = useParams();
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const { settings: hospitalSettings } = useHospitalSettings();
    const [loading, setLoading] = useState(false);
    const [patient, setPatient] = useState(null);
    const [encounter, setEncounter] = useState(null);
    const [vitals, setVitals] = useState(null);
    const [labCharges, setLabCharges] = useState([]);
    const [radiologyCharges, setRadiologyCharges] = useState([]);
    const [inventoryDrugs, setInventoryDrugs] = useState([]);
    const [expandedDays, setExpandedDays] = useState({});

    // Parse text-based template or saved result into table format
    const parseTextTemplate = (template) => {
        if (!template) return [];

        const lines = template.split('\n');
        const params = [];

        for (const line of lines) {
            // Match patterns like "- WBC: _____ x10^3/Î¼L (Normal: 4.0-11.0)"
            // OR "- Malaria: ++ Positive/Negative"
            const match = line.match(/^\s*-\s*([^:]+):\s*(.*?)(?:\s*\(?(?:Normal:\s*)?([^)]*)\)?)?$/);
            if (match) {
                const name = match[1].trim();
                let fullValue = match[2].trim();
                const normalRange = (match[3] || '').trim();

                // Extract value from underscores if present (e.g., "__yes__")
                const valueMatch = fullValue.match(/^_*([^_]*)_*$/);
                const value = valueMatch ? valueMatch[1].trim() : fullValue;

                params.push({
                    name,
                    value: value === '_____' ? '' : value,
                    unit: '', // Text templates usually don't have separate unit column
                    normalRange
                });
            }
        }
        return params;
    };

    const handleUniversalPrint = (order) => {
        try {
            const printWindow = window.open("", "_blank");
            if (!printWindow) {
                alert("Please allow popups for this website to print reports.");
                return;
            }

            const printContent = `
                <html>
                    <head>
                        <title>Laboratory Report - ${order.testName}</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1a202c; }
                            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                            .header h1 { font-size: 28px; margin: 0; }
                            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px; }
                            .info-grid p { margin: 8px 0; }
                            .results-section { border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 20px 0; margin-bottom: 30px; }
                            .results-section h3 { font-size: 18px; margin-bottom: 15px; }
                            .results-content { background: #f9f9f9; padding: 15px; white-space: pre-wrap; font-family: monospace; font-size: 13px; }
                            .signature-section { margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; }
                            .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
                            .signature-grid p { margin: 5px 0; font-size: 13px; }
                            .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; }
                            @media print {
                                body { padding: 0; }
                                .results-content { background: none; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="header">
                            ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                            <h1 style="margin: 0 0 5px 0;">${systemSettings?.reportHeader || 'LABORATORY REPORT'}</h1>
                            <p style="margin: 5px 0; font-size: 14px;">${systemSettings?.address || ''}</p>
                            <p style="margin: 2px 0; font-size: 12px;">
                                ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                                ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                                ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                            </p>
                            <h2 style="font-size: 20px; border-top: 1px solid #eee; padding-top: 10px; margin-top: 10px;">Laboratory Report</h2>
                        </div>

                        <div class="info-grid">
                            <div>
                                <p><strong>Patient Name:</strong> ${patient?.name}</p>
                                <p><strong>MRN:</strong> ${patient?.mrn}</p>
                                <p><strong>Age/Sex:</strong> ${formatAge(patient?.dateOfBirth)} / ${patient?.gender}</p>
                            </div>
                            <div>
                                <p><strong>Test Name:</strong> ${order.testName}</p>
                                <p><strong>Date Ordered:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                                <p><strong>Ref. Doctor:</strong> ${order.doctor?.name || 'Self'}</p>
                            </div>
                        </div>

                        ${order.clinicalDetails ? `
                        <div style="margin-bottom: 20px; padding: 10px; background: #f9fafb; border-left: 4px solid #9ca3af; font-style: italic;">
                            <p style="margin: 0; font-weight: bold; font-style: normal; color: #374151; font-size: 14px;">Clinical Detail:</p>
                            <p style="margin: 5px 0 0 0; font-size: 13px; color: #4b5563;">${order.clinicalDetails}</p>
                        </div>
                        ` : ''}

                        <div class="results-section">
                            <h3>Test Results:</h3>
                            ${(() => {
                    try {
                        const parsed = JSON.parse(order.result);
                        if (parsed.format === 'table' && Array.isArray(parsed.parameters)) {
                            return `
                                            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                                <thead>
                                                    <tr style="background: #f3f4f6;">
                                                        <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600;">Parameter</th>
                                                        <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 120px;">Value</th>
                                                        <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 100px;">Unit</th>
                                                        <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 150px;">Normal Range</th>
                                                        <th style="text-align: center; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 80px;">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    ${parsed.parameters.map(p => {
                                const rangeS = checkRange(p.value, p.normalRange);
                                let bgColor = '#f9fafb';
                                let statusText = '';
                                let statusColor = '';

                                if (p.value) {
                                    if (rangeS === 'low') {
                                        bgColor = '#fed7aa';
                                        statusText = 'â†“ LOW';
                                        statusColor = '#9a3412';
                                    } else if (rangeS === 'high') {
                                        bgColor = '#fecaca';
                                        statusText = 'â†‘ HIGH';
                                        statusColor = '#991b1b';
                                    } else {
                                        bgColor = '#d1fae5';
                                        statusText = 'âœ“ Normal';
                                        statusColor = '#065f46';
                                    }
                                }

                                return `
                                                            <tr style="background: ${bgColor};">
                                                                <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: 500;">${p.name}</td>
                                                                <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: 600;">${p.value || '-'}</td>
                                                                <td style="padding: 10px; border: 1px solid #d1d5db; color: #6b7280;">${p.unit || ''}</td>
                                                                <td style="padding: 10px; border: 1px solid #d1d5db; color: #6b7280;">${p.normalRange || ''}</td>
                                                                <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">
                                                                    ${(p.value && !p.name.toLowerCase().trim().includes('blood group') && !p.name.toLowerCase().trim().includes('genotype')) ? `<span style="color: ${statusColor}; font-weight: 600; font-size: 11px;">${statusText}</span>` : ''}
                                                                </td>
                                                            </tr>
                                                        `;
                            }).join('')}
                                                </tbody>
                                            </table>
                                        `;
                        }
                    } catch (e) {
                        // Not JSON - try to parse as text-to-table
                        const parsedParams = parseTextTemplate(order.result);
                        if (parsedParams.length > 0) {
                            return `
                                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                    <thead>
                                        <tr style="background: #f3f4f6;">
                                            <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600;">Parameter</th>
                                            <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 250px;">Result</th>
                                            <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 200px;">Normal Range</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${parsedParams.map(param => `
                                            <tr>
                                                <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: 500;">${param.name}</td>
                                                <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: 600;">${param.value || '-'}</td>
                                                <td style="padding: 10px; border: 1px solid #d1d5db; color: #6b7280;">${param.normalRange || ''}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            `;
                        }
                    }
                    return `<div class="text-result">${order.result}</div>`;
                })()}
                        </div>

                        <div class="signature-section" style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #333;">
                            <h4 style="margin: 0 0 15px 0; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: #374151;">Audit Trail & Signatures</h4>
                            <div class="signature-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                                ${order.signedBy ? `
                                    <div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px;">
                                        <p style="margin: 0; font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Performed By</p>
                                        <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">${order.signedBy.name}</p>
                                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #9ca3af;">${new Date(order.signedAt).toLocaleString()}</p>
                                    </div>
                                ` : ''}

                                ${order.rejectedBy ? `
                                    <div style="padding: 10px; border: 1px solid #fee2e2; border-radius: 6px; background-color: #fef2f2;">
                                        <p style="margin: 0; font-size: 10px; font-weight: bold; color: #b91c1c; text-transform: uppercase;">Rejected By</p>
                                        <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">${order.rejectedBy.name || 'Lab Scientist'}</p>
                                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #f87171;">${order.rejectionReason ? `Reason: ${order.rejectionReason}` : ''}</p>
                                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #f87171;">${new Date(order.rejectedAt).toLocaleString()}</p>
                                    </div>
                                ` : ''}

                                ${order.lastModifiedBy ? `
                                    <div style="padding: 10px; border: 1px solid #fef3c7; border-radius: 6px; background-color: #fffbeb;">
                                        <p style="margin: 0; font-size: 10px; font-weight: bold; color: #92400e; text-transform: uppercase;">Last Edited By</p>
                                        <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">${order.lastModifiedBy.name}</p>
                                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #d97706;">${new Date(order.lastModifiedAt).toLocaleString()}</p>
                                    </div>
                                ` : ''}

                                ${order.approvedBy ? `
                                    <div style="padding: 10px; border: 1px solid #dcfce7; border-radius: 6px; background-color: #f0fdf4;">
                                        <p style="margin: 0; font-size: 10px; font-weight: bold; color: #166534; text-transform: uppercase;">Verified & Approved By</p>
                                        <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">${order.approvedBy.name}</p>
                                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #22c55e;">${new Date(order.approvedAt).toLocaleString()}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>

                        <div class="footer" style="margin-top: 30px; text-align: center; font-size: 11px; color: #666;">
                            <p>This is an electronically signed document. No handwritten signature is required.</p>
                        </div>
                        <script>
                            window.onload = function() { 
                                window.focus();
                                setTimeout(() => {
                                    window.print();
                                    window.close();
                                }, 250);
                            }
                        </script>
                    </body>
                </html>
            `;

            printWindow.document.write(printContent);
            printWindow.document.close();
        } catch (err) {
            console.error("Print Error:", err);
            toast.error("Error generating report: " + err.message);
        }
    };
    // State for collapsible clinical notes sections
    const [expandedSections, setExpandedSections] = useState({
        history: true, // History section expanded by default
        physicalExam: true, // Physical Examination expanded by default
        assessment: true // Assessment & Plan expanded by default
    });

    // SOAP Note - Structured Clinical Documentation
    const [soapNote, setSoapNote] = useState({
        presentingComplaints: '',
        historyOfPresentingComplaint: '',
        systemReview: '',
        pastMedicalSurgicalHistory: '',
        socialFamilyHistory: '',
        drugsHistory: '',
        functionalCognitiveStatus: '',
        menstruationGynecologicalObstetricsHistory: '',
        pregnancyHistory: '',
        immunization: '',
        nutritional: '',
        developmentalMilestones: '',
        // Physical Examination
        generalAppearance: '',
        heent: '',
        neck: '',
        cvs: '',
        resp: '',
        abd: '',
        neuro: '',
        msk: '',
        skin: '',
        assessment: '',
        plan: '',
        diagnosis: [] // Array of {code, description}
    });

    const [diagSearchTerm, setDiagSearchTerm] = useState('');
    const [showDiagDropdown, setShowDiagDropdown] = useState(false);
    const [showSoapModal, setShowSoapModal] = useState(false);
    const [editingNoteId, setEditingNoteId] = useState(null); // null = new note, string = editing existing note _id
    const [showDischargeModal, setShowDischargeModal] = useState(false);
    const [dischargeNote, setDischargeNote] = useState('');

    // Inpatient Conversion State
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [wards, setWards] = useState([]);
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBed, setSelectedBed] = useState('');
    const [retainershipDepositStatus, setRetainershipDepositStatus] = useState([]);
    const [availableBeds, setAvailableBeds] = useState([]);

    // Orders
    const [selectedLabTest, setSelectedLabTest] = useState('');
    const [tempLabOrders, setTempLabOrders] = useState([]); // Multi-select for Lab
    const [labSearchTerm, setLabSearchTerm] = useState('');
    const [showLabDropdown, setShowLabDropdown] = useState(false);
    const [labClinicalDetails, setLabClinicalDetails] = useState('');

    const [selectedRadTest, setSelectedRadTest] = useState('');
    const [tempRadOrders, setTempRadOrders] = useState([]); // Multi-select for Radiology
    const [radSearchTerm, setRadSearchTerm] = useState('');
    const [showRadDropdown, setShowRadDropdown] = useState(false);
    const [selectedDrug, setSelectedDrug] = useState('');
    const [drugQuantity, setDrugQuantity] = useState(1);
    const [drugDosage, setDrugDosage] = useState('');
    const [drugFrequency, setDrugFrequency] = useState('');
    const [drugDuration, setDrugDuration] = useState('');
    const [drugRoute, setDrugRoute] = useState('');
    const [drugForm, setDrugForm] = useState('');

    // Multi-Drug Prescription State
    const [drugSearchTerm, setDrugSearchTerm] = useState('');
    const [filteredDrugs, setFilteredDrugs] = useState([]);
    const [tempDrugs, setTempDrugs] = useState([]); // List of drugs to prescribe
    const [buyOutside, setBuyOutside] = useState(false); // New state for Buy Outside
    const [showDrugDropdown, setShowDrugDropdown] = useState(false);
    const [metadataOptions, setMetadataOptions] = useState({
        dosage: [],
        frequency: [],
        route: [],
        form: []
    });

    // History & Lists
    const [pastEncounters, setPastEncounters] = useState([]);
    const [viewingPastEncounter, setViewingPastEncounter] = useState(false); // New state for read-only mode
    const [currentLabOrders, setCurrentLabOrders] = useState([]);
    const [currentRadOrders, setCurrentRadOrders] = useState([]);
    const [currentPrescriptions, setCurrentPrescriptions] = useState([]);
    const [clinicalNotes, setClinicalNotes] = useState([]); // Other Notes (general)
    const [newNote, setNewNote] = useState('');
    const [showNoteModal, setShowNoteModal] = useState(false);
    // Ward Round Notes
    const [wardRoundNotes, setWardRoundNotes] = useState([]);
    const [newWardRoundNote, setNewWardRoundNote] = useState('');
    const [showWardRoundModal, setShowWardRoundModal] = useState(false);
    // Theatre Operation Notes
    const [theatreNotes, setTheatreNotes] = useState([]);
    const [consents, setConsents] = useState([]); // Detached consents state
    const [showTheatreModal, setShowTheatreModal] = useState(false);
    const [editingTheatreNote, setEditingTheatreNote] = useState(null);
    const emptyTheatreNote = {
        dateOfSurgery: '', startTime: '', endTime: '', theatreName: '',
        surgeryType: 'Elective', procedurePerformed: '', preOperativeDiagnosis: '',
        postOperativeDiagnosis: '', operativeFindings: '', operativeNotes: '',
        estimatedBloodLoss: '', bloodTransfusion: '', complications: '', drains: '',
        specimens: '', implants: '', woundClosure: '', postOperativeCondition: '',
        postOperativeInstructions: '', leadSurgeon: '', assistantSurgeons: '',
        anaesthetist: '', scrubNurse: '', circulatingNurse: '', anaesthesiaType: '',
        anaesthesiaNote: '', digitalSignature: '', status: 'Draft'
    };
    const [theatreNoteForm, setTheatreNoteForm] = useState({ ...emptyTheatreNote });
    const [showConsentModal, setShowConsentModal] = useState(false);
    const [consentActiveNote, setConsentActiveNote] = useState(null);
    const [consentTab, setConsentTab] = useState('digital');
    const [consentFile, setConsentFile] = useState(null);
    const [isConsentViewing, setIsConsentViewing] = useState(false);
    const emptyConsentForm = {
        patientName: '',
        patientAddress: '',
        physicianName: '',
        procedureName: '',
        consentDate: '',
        relationship: 'self',
        explanationDate: '',
        patientSignatureName: '',
        patientSignatureDate: '',
        surgeonSignatureName: '',
        surgeonSignatureDate: '',
        guardianSignatureName: '',
        guardianSignatureDate: '',
        anaesthetistSignatureName: '',
        anaesthetistSignatureDate: '',
        relationshipWithPatient: '',
        patientThumbprint: '',
        patientThumbprintDate: '',
        witnessThumbprint: '',
        witnessThumbprintDate: '',
    };
    const [consentForm, setConsentForm] = useState({ ...emptyConsentForm });
    const [dispensedPrescriptions, setDispensedPrescriptions] = useState([]);
    const [administrationHistory, setAdministrationHistory] = useState([]);

    // Checklist States
    const [checklists, setChecklists] = useState([]);
    const [showChecklistModal, setShowChecklistModal] = useState(false);
    const [editingChecklist, setEditingChecklist] = useState(null);
    const emptyChecklistForm = {
        filledBy: '',
        // Anaesthetic Machine
        primaryOxygenChecked: '', backupOxygenAvailable: '', oxygenAlarmWorking: '',
        flowmetersWorking: '', vaporiserAttachedFull: '', leakTestPassed: '',
        scavengingChecked: '', monitoringEquipmentFunctioning: '', halothaneIsofluraneAvailable: '',
        // Medications/Equipment
        emergencyEquipmentChecked: '', endotrachealTubesChecked: '', airwayAidsChecked: '',
        selfInflatingBagChecked: '', intravenousCannulaeChecked: '', fluidAdministrationSetChecked: '',
        isotonicCrystalloidChecked: '', epinephrineChecked: '', atropineChecked: '', antagonistsChecked: ''
    };
    const [checklistForm, setChecklistForm] = useState({ ...emptyChecklistForm });

    const handleSaveChecklist = async () => {
        try {
            const payload = { ...checklistForm, filledAt: new Date().toISOString() };
            const { data } = await axios.post(`${backendUrl}/api/visits/${encounter._id}/checklists`, payload, { headers: { Authorization: `Bearer ${user.token}` } });
            setChecklists(data.checklists || []);
            setShowChecklistModal(false);
            setEditingChecklist(null);
            setChecklistForm({ ...emptyChecklistForm, filledBy: user.name || '' });
        } catch (err) {
            alert(err?.response?.data?.message || 'Failed to save checklist');
        }
    };

    const printChecklistFromData = (chk) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert('Please allow popups to print.'); return; }
        const radioVal = (val) => val === 'yes' ? '☑ Yes  ☐ No  ☐ N/A' : val === 'no' ? '☐ Yes  ☑ No  ☐ N/A' : val === 'na' ? '☐ Yes  ☐ No  ☑ N/A' : '☐ Yes  ☐ No  ☐ N/A';
        const rows = (items) => items.map(it => `<tr><td style="padding:6px 10px;border:1px solid #ccc;">${it.label}</td><td style="padding:6px 10px;border:1px solid #ccc;font-family:monospace;">${radioVal(chk[it.key])}</td></tr>`).join('');
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Anaesthetic Checklist</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#111}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:20px}th{background:#e8e8e8;padding:8px 10px;border:1px solid #ccc;text-align:left}p{font-size:13px}@media print{}</style></head><body>
            <h2>Anaesthetic Machine / Medication & Equipment Checklist</h2>
            <p><strong>Patient:</strong> ${patient?.name || ''} &nbsp;&nbsp; <strong>MRN:</strong> ${patient?.mrn || ''}</p>
            <p><strong>Filled by:</strong> ${chk.filledBy || ''} &nbsp;&nbsp; <strong>Date:</strong> ${chk.filledAt ? new Date(chk.filledAt).toLocaleString() : 'N/A'}</p>
            <h3>Section 1: Anaesthetic Machine</h3>
            <table><thead><tr><th>Item</th><th>Response</th></tr></thead><tbody>${rows(anaestheticMachineItems)}</tbody></table>
            <h3>Section 2: Medications / Equipment</h3>
            <table><thead><tr><th>Item</th><th>Response</th></tr></thead><tbody>${rows(medicationsEquipmentItems)}</tbody></table>
            <script>window.onload=()=>{window.print();}<\/script></body></html>`);
        printWindow.document.close();
    };

    // Pre-Anaesthesia Checklist States
    const [preAnaesthesiaChecklists, setPreAnaesthesiaChecklists] = useState([]);
    const [showPreAnaesthesiaModal, setShowPreAnaesthesiaModal] = useState(false);
    const [editingPreAnaesthesiaChecklist, setEditingPreAnaesthesiaChecklist] = useState(null);
    const emptyPreAnaesthesiaForm = {
        firstName: '', lastName: '', patientMRN: '',
        historyClinicalExamSignificant: '', historyClinicalExamDetails: '',
        abnormalitiesWarrantInvestigation: '', specificInvestigationsDetails: '',
        abnormalitiesCanBeStabilised: '',
        anticipatedComplications: '', complicationManagement: '',
        premedication: '',
        painManagement: '', anaesthesiaInductionMaintenance: '',
        patientMonitoring: '', bodyTemperatureMaintenance: '',
        postAnaestheticManagement: '',
        facilitiesAvailable: '', unavailableResourcesDetails: '',
        filledBy: ''
    };
    const [preAnaesthesiaForm, setPreAnaesthesiaForm] = useState({ ...emptyPreAnaesthesiaForm });

    const handleSavePreAnaesthesiaChecklist = async () => {
        try {
            const payload = { ...preAnaesthesiaForm, filledAt: new Date().toISOString() };
            if (editingPreAnaesthesiaChecklist) payload._id = editingPreAnaesthesiaChecklist;
            const { data } = await axios.post(
                `${backendUrl}/api/visits/${encounter._id}/pre-anaesthesia-checklists`,
                payload,
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setPreAnaesthesiaChecklists(data.preAnaesthesiaChecklists || []);
            setShowPreAnaesthesiaModal(false);
            setEditingPreAnaesthesiaChecklist(null);
            setPreAnaesthesiaForm({ ...emptyPreAnaesthesiaForm, filledBy: user.name || '' });
        } catch (err) {
            alert(err?.response?.data?.message || 'Failed to save pre-anaesthesia checklist');
        }
    };

    const printPreAnaesthesiaChecklist = (chk) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert('Please allow popups to print.'); return; }
        const selVal = (val) => val === 'yes' ? 'Yes' : val === 'no' ? 'No' : val || 'N/A';
        const row = (label, val) => `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-weight:bold;width:50%;">${label}</td><td style="padding:6px 10px;border:1px solid #ccc;">${val || 'N/A'}</td></tr>`;
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Pre-Anaesthesia Checklist</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#111}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:20px}@media print{}</style></head><body>
            <h2>Pre-Anaesthesia Checklist</h2>
            <p><strong>Patient:</strong> ${chk.firstName || ''} ${chk.lastName || ''} &nbsp;&nbsp; <strong>MRN:</strong> ${chk.patientMRN || ''}</p>
            <p><strong>Filled by:</strong> ${chk.filledBy || ''} &nbsp;&nbsp; <strong>Date:</strong> ${chk.filledAt ? new Date(chk.filledAt).toLocaleString() : 'N/A'}</p>
            <table>
                ${row('Has anything significant been identified in the history and/or clinical examination?', selVal(chk.historyClinicalExamSignificant))}
                ${row('If yes, explain exactly what was identified', chk.historyClinicalExamDetails)}
                ${row('Do any abnormalities warrant further investigation?', selVal(chk.abnormalitiesWarrantInvestigation))}
                ${row('If yes, which specific investigations need to be requested?', chk.specificInvestigationsDetails)}
                ${row('Can any abnormalities be stabilised prior to anaesthesia?', selVal(chk.abnormalitiesCanBeStabilised))}
                ${row('What complications are anticipated during anaesthesia?', chk.anticipatedComplications)}
                ${row('How can these complications be managed?', chk.complicationManagement)}
                ${row('Would the patient benefit from premedication?', selVal(chk.premedication))}
                ${row('How will any pain associated with the procedure be managed?', chk.painManagement)}
                ${row('How will anaesthesia be induced & maintained?', chk.anaesthesiaInductionMaintenance)}
                ${row('How will the patient be monitored?', chk.patientMonitoring)}
                ${row("How will the patient's body temperature be maintained?", chk.bodyTemperatureMaintenance)}
                ${row('How will the patient be managed in the post-anaesthetic period?', chk.postAnaestheticManagement)}
                ${row('Are the required facilities, personnel & medications available?', selVal(chk.facilitiesAvailable))}
                ${row('If not, list what/who is currently unavailable', chk.unavailableResourcesDetails)}
            </table>
            <script>window.onload=()=>{window.print();}<\/script></body></html>`);
        printWindow.document.close();
    };

    // Postoperative Handover Checklist States
    const [postoperativeHandoverChecklists, setPostoperativeHandoverChecklists] = useState([]);
    const [showPostoperativeHandoverModal, setShowPostoperativeHandoverModal] = useState(false);
    const [editingPostoperativeHandoverChecklist, setEditingPostoperativeHandoverChecklist] = useState(null);
    const emptyPostoperativeHandoverForm = {
        patientNumber: '', firstName: '', lastName: '', age: '', allergyStatus: '', diagnosis: '', procedure: '',
        currentPatientStatusSelect: '', currentPatientStatusDetails: '', vitalsRecordedInEmr: '',
        anaesthesiaType: '', intraoperativeAnaestheticCourse: '', postoperativeBloodTransfusionRequired: '',
        medicationsGivenInTheatre: '', planForMonitoring: '', planForIntravenousFluids: '', planForPainRelief: '',
        planForLines: '', postoperativeInvestigationsRequired: '',
        consultantSurgeon: '', durationOfSurgery: '', intraoperativeSurgicalCourse: '', bloodLossTransfusions: '',
        planForNasogastricTube: '', dvtProphylaxisPlan: '', antibioticPlan: '',
        consultantAnaesthesiologistFirstName: '', consultantAnaesthesiologistLastName: '',
        nurseAnaesthetistFirstName: '', nurseAnaesthetistLastName: '',
        zonalWardNurseFirstName: '', zonalWardNurseLastName: '',
        filledBy: ''
    };
    const [postoperativeHandoverForm, setPostoperativeHandoverForm] = useState({ ...emptyPostoperativeHandoverForm });

    const handleSavePostoperativeHandoverChecklist = async () => {
        try {
            const payload = { ...postoperativeHandoverForm, filledAt: new Date().toISOString() };
            if (editingPostoperativeHandoverChecklist) payload._id = editingPostoperativeHandoverChecklist;
            const { data } = await axios.post(
                `${backendUrl}/api/visits/${encounter._id}/postoperative-handover-checklists`,
                payload,
                { headers: { Authorization: `Bearer ${user.token}` } }
            );
            setPostoperativeHandoverChecklists(data.postoperativeHandoverChecklists || []);
            setShowPostoperativeHandoverModal(false);
            setEditingPostoperativeHandoverChecklist(null);
            setPostoperativeHandoverForm({ ...emptyPostoperativeHandoverForm, filledBy: user.name || '' });
        } catch (err) {
            alert(err?.response?.data?.message || 'Failed to save postoperative handover checklist');
        }
    };

    const printPostoperativeHandoverChecklist = (chk) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) { alert('Please allow popups to print.'); return; }
        const row = (label, val) => `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-weight:bold;width:50%;">${label}</td><td style="padding:6px 10px;border:1px solid #ccc;">${val || 'N/A'}</td></tr>`;
        printWindow.document.write(`<!DOCTYPE html><html><head><title>Postoperative Handover Checklist</title><style>body{font-family:Arial,sans-serif;padding:30px;color:#111}h2{text-align:center}table{width:100%;border-collapse:collapse;margin-bottom:20px}@media print{}</style></head><body>
            <h2>Postoperative Handover Checklist</h2>
            <p><strong>Patient Name:</strong> ${chk.firstName || ''} ${chk.lastName || ''} &nbsp;&nbsp; <strong>Patient No:</strong> ${chk.patientNumber || 'N/A'} &nbsp;&nbsp; <strong>Age:</strong> ${chk.age || 'N/A'}</p>
            <p><strong>Filled by:</strong> ${chk.filledBy || ''} &nbsp;&nbsp; <strong>Date:</strong> ${chk.filledAt ? new Date(chk.filledAt).toLocaleString() : 'N/A'}</p>
            
            <h3>1. Patient Specific Information</h3>
            <table>
                ${row('Allergy Status', chk.allergyStatus)}
                ${row('Diagnosis', chk.diagnosis)}
                ${row('Procedure', chk.procedure)}
                ${row('Current Patient Status (Select)', chk.currentPatientStatusSelect)}
                ${row('Current Patient Status (Details)', chk.currentPatientStatusDetails)}
                ${row('Has the zonal/ward nurse recorded the vital signs of the patient in the EMR?', chk.vitalsRecordedInEmr)}
            </table>

            <h3>2. Anaesthetic Information</h3>
            <table>
                ${row('Anaesthesia Type', chk.anaesthesiaType)}
                ${row('Intraoperative anaesthetic course and any complications', chk.intraoperativeAnaestheticCourse)}
                ${row('Is a postoperative blood transfusion required?', chk.postoperativeBloodTransfusionRequired)}
                ${row('Medications given in theatre', chk.medicationsGivenInTheatre)}
                ${row('Plan for monitoring (Vitals parameter range and action)', chk.planForMonitoring)}
                ${row('Plan for intravenous fluids', chk.planForIntravenousFluids)}
                ${row('Plan for pain relief', chk.planForPainRelief)}
                ${row('Plan for lines, eg- central venous, arterial', chk.planForLines)}
                ${row('Any postoperative investigations required?', chk.postoperativeInvestigationsRequired)}
            </table>

            <h3>3. Surgical Information</h3>
            <table>
                ${row('Consultant Surgeon', chk.consultantSurgeon)}
                ${row('Duration of Surgery', chk.durationOfSurgery)}
                ${row('Intraoperative surgical course and any complications', chk.intraoperativeSurgicalCourse)}
                ${row('How much blood was lost (if any)? Any blood transfusions during surgery? If so, how many pints?', chk.bloodLossTransfusions)}
                ${row('Plan for nasogastric tube/feeding', chk.planForNasogastricTube)}
                ${row('DVT prophylaxis plan', chk.dvtProphylaxisPlan)}
                ${row('Antibiotic plan', chk.antibioticPlan)}
                ${row('Consultant Anaesthesiologist', `${chk.consultantAnaesthesiologistFirstName || ''} ${chk.consultantAnaesthesiologistLastName || ''}`.trim())}
                ${row('Nurse Anaesthetist', `${chk.nurseAnaesthetistFirstName || ''} ${chk.nurseAnaesthetistLastName || ''}`.trim())}
                ${row('Zonal/Ward Nurse', `${chk.zonalWardNurseFirstName || ''} ${chk.zonalWardNurseLastName || ''}`.trim())}
            </table>
            <script>window.onload=()=>{window.print();}<\/script></body></html>`);
        printWindow.document.close();
    };

    // Modal States
    const [showLabModal, setShowLabModal] = useState(false);
    const [showRadModal, setShowRadModal] = useState(false);
    const [showRxModal, setShowRxModal] = useState(false);
    const [showAppointmentModal, setShowAppointmentModal] = useState(false); // Appointment Modal State
    const [showReferralModal, setShowReferralModal] = useState(false); // Referral Modal State
    const [referrals, setReferrals] = useState([]); // List of referrals for current visit
    const [editingReferral, setEditingReferral] = useState(null); // Track which referral is being edited
    const [referralData, setReferralData] = useState({
        referredTo: '',
        reason: '',
        diagnosis: '',
        notes: '',
        medicalHistory: ''
    });


    const [systemSettings, setSystemSettings] = useState(null);

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const { data } = await axios.get(`${backendUrl}/api/settings`);
                setSystemSettings(data);
            } catch (error) {
                console.error('Error fetching system settings:', error);
            }
        };
        fetchSystemSettings();
    }, []);

    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const { data } = await axios.get(`${backendUrl}/api/drug-metadata`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                const organized = {
                    dosage: data.filter(m => m.type === 'dosage' && m.isActive),
                    frequency: data.filter(m => m.type === 'frequency' && m.isActive),
                    route: data.filter(m => m.type === 'route' && m.isActive),
                    form: data.filter(m => m.type === 'form' && m.isActive)
                };
                setMetadataOptions(organized);
            } catch (error) {
                console.error('Error fetching drug metadata:', error);
            }
        };
        if (showRxModal) {
            fetchMetadata();
        }
    }, [showRxModal, backendUrl, user.token]);

    // Auto-calculate prescription quantity
    useEffect(() => {
        if (!showRxModal || !selectedDrug) return;

        const calculateTotal = () => {
            // Parse dose units (e.g., "1 tab", "500", "5ml")
            const parseDose = (str) => {
                if (!str) return 1;
                // If it contains strength like mg/mcg/g, we assume 1 unit of that strength
                if (/mg|mcg|g|ml|l|unit/i.test(str)) {
                    // But if it starts with a number, and that number is small (< 10), it might be units (e.g. 2mg)
                    // Actually, let's keep it simple: if it contains a strength unit, assume 1 unless it's like "2 tabs"
                    if (/tab|cap|pill|vial|amp/i.test(str)) {
                        const match = str.match(/^(\d+(\.\d+)?)/);
                        return match ? parseFloat(match[1]) : 1;
                    }
                    return 1;
                }
                const match = str.match(/^(\d+(\.\d+)?)/);
                const num = match ? parseFloat(match[1]) : 1;
                return num > 20 ? 1 : num; // If it's a large number (e.g. 500), it's likely strength
            };

            const doseUnits = parseDose(drugDosage);

            // Parse frequencyMultiplier based on medical abbreviations
            const freqLower = (drugFrequency || '').toLowerCase().trim();
            let freqMultiplier = 1;

            if (freqLower === 'od' || freqLower.includes('once daily') || freqLower === 'daily' || freqLower === 'od' || freqLower === 'once' || freqLower === 'stat' || freqLower === 'nocte' || freqLower === 'ac' || freqLower === 'pc' || freqLower === 'hs' || freqLower === 'prn') {
                freqMultiplier = 1;
            } else if (freqLower === 'bd' || freqLower.includes('twice daily') || freqLower === 'bid' || freqLower.includes('twice') || freqLower.includes('12 hourly') || freqLower.includes('12h')) {
                freqMultiplier = 2;
            } else if (freqLower === 'tds' || freqLower.includes('three times daily') || freqLower === 'tid' || freqLower.includes('trice') || freqLower.includes('8 hourly') || freqLower.includes('8h')) {
                freqMultiplier = 3;
            } else if (freqLower === 'qid' || freqLower.includes('four times daily') || freqLower === '6 hourly') {
                freqMultiplier = 4;
            } else if (freqLower.includes('weekly')) {
                freqMultiplier = 1 / 7;
            } else if (freqLower.match(/(\d+)\s*times/)) {
                freqMultiplier = parseInt(freqLower.match(/(\d+)\s*times/)[1]);
            }

            // Parse totalDays
            const durationLower = (drugDuration || '').toLowerCase();
            const durMatch = durationLower.match(/(\d+(\.\d+)?)/);
            const durNum = durMatch ? parseFloat(durMatch[1]) : 0;
            let totalDays = durNum;

            if (durationLower.includes('week')) {
                totalDays = durNum * 7;
            } else if (durationLower.includes('month')) {
                totalDays = durNum * 30;
            }

            const total = Math.ceil(doseUnits * freqMultiplier * totalDays);
            if (total > 0 && !isNaN(total)) {
                setDrugQuantity(total);
            }
        };

        const timer = setTimeout(calculateTotal, 300); // Debounce
        return () => clearTimeout(timer);
    }, [drugDosage, drugFrequency, drugDuration, showRxModal, selectedDrug]);

    // Tab State - default based on user role
    const getDefaultTab = () => {
        if (['lab_technician', 'lab_scientist'].includes(user?.role)) return 'lab';
        if (user?.role === 'radiologist') return 'radiology';
        if (user?.role === 'pharmacist') return 'prescriptions';
        if (user?.role === 'receptionist') return 'referrals'; // Receptionists start at referrals tab
        return 'vitals';
    };
    const [activeTab, setActiveTab] = useState(getDefaultTab());
    const [showEditEncounterModal, setShowEditEncounterModal] = useState(false);
    const [editEncounterStatus, setEditEncounterStatus] = useState('');



    // Nurse Workflow State
    const [showVitalsModal, setShowVitalsModal] = useState(false);
    const [showNurseNoteModal, setShowNurseNoteModal] = useState(false);
    const [nursingNote, setNursingNote] = useState('');

    useEffect(() => {
        if (showSoapModal && encounter && patient) {
            // Determine note source: if editing an existing note, load its values; otherwise blank
            const blankSoap = {
                presentingComplaints: '',
                historyOfPresentingComplaint: '',
                systemReview: '',
                pastMedicalSurgicalHistory: '',
                socialFamilyHistory: '',
                drugsHistory: '',
                functionalCognitiveStatus: '',
                menstruationGynecologicalObstetricsHistory: '',
                pregnancyHistory: '',
                immunization: '',
                nutritional: '',
                developmentalMilestones: '',
                generalAppearance: '',
                heent: '',
                neck: '',
                cvs: '',
                resp: '',
                abd: '',
                neuro: '',
                msk: '',
                skin: '',
                assessment: '',
                plan: '',
                diagnosis: []
            };

            let initialSoap = blankSoap;
            if (editingNoteId) {
                // Find the note being edited
                const noteSource = editingNoteId === 'legacy-root'
                    ? encounter
                    : (encounter.clinicalNotes || []).find(n => n._id?.toString() === editingNoteId);
                if (noteSource) {
                    initialSoap = {
                        presentingComplaints: noteSource.presentingComplaints || '',
                        historyOfPresentingComplaint: noteSource.historyOfPresentingComplaint || '',
                        systemReview: noteSource.systemReview || '',
                        pastMedicalSurgicalHistory: noteSource.pastMedicalSurgicalHistory || '',
                        socialFamilyHistory: noteSource.socialFamilyHistory || '',
                        drugsHistory: noteSource.drugsHistory || '',
                        functionalCognitiveStatus: noteSource.functionalCognitiveStatus || '',
                        menstruationGynecologicalObstetricsHistory: noteSource.menstruationGynecologicalObstetricsHistory || '',
                        pregnancyHistory: noteSource.pregnancyHistory || '',
                        immunization: noteSource.immunization || '',
                        nutritional: noteSource.nutritional || '',
                        developmentalMilestones: noteSource.developmentalMilestones || '',
                        generalAppearance: noteSource.generalAppearance || '',
                        heent: noteSource.heent || '',
                        neck: noteSource.neck || '',
                        cvs: noteSource.cvs || '',
                        resp: noteSource.resp || '',
                        abd: noteSource.abd || '',
                        neuro: noteSource.neuro || '',
                        msk: noteSource.msk || '',
                        skin: noteSource.skin || '',
                        assessment: noteSource.assessment || '',
                        plan: noteSource.plan || '',
                        diagnosis: noteSource.diagnosis || []
                    };
                }
            }

            // Restore draft for new notes only
            if (!editingNoteId) {
                const saved = localStorage.getItem(`draft_soap_${patient._id}_${encounter._id}`);
                if (saved) {
                    try {
                        const draft = JSON.parse(saved);
                        setSoapNote({ ...initialSoap, ...draft });
                    } catch (e) {
                        console.error("Error parsing SOAP draft", e);
                        setSoapNote(initialSoap);
                    }
                } else {
                    setSoapNote(initialSoap);
                }
            } else {
                setSoapNote(initialSoap);
            }
        }

        // Reset conversion state when modal closes
        if (!showConvertModal) {
            setSelectedWard('');
            setSelectedBed('');
        }
    }, [showSoapModal, encounter, showConvertModal, patient, editingNoteId]);

    // Auto-save SOAP Note
    useEffect(() => {
        if (showSoapModal && encounter && patient) {
            localStorage.setItem(`draft_soap_${patient._id}_${encounter._id}`, JSON.stringify(soapNote));
        }
    }, [soapNote, showSoapModal, encounter, patient]);

    // Auto-save Clinical Note
    useEffect(() => {
        if (showNoteModal && encounter && patient) {
            localStorage.setItem(`draft_note_${patient._id}_${encounter._id}`, newNote);
        }
    }, [newNote, showNoteModal, encounter, patient]);

    // Restore Clinical Note Draft
    useEffect(() => {
        if (showNoteModal && encounter && patient) {
            const saved = localStorage.getItem(`draft_note_${patient._id}_${encounter._id}`);
            if (saved) setNewNote(saved);
        }
    }, [showNoteModal, encounter, patient]);
    const [vitalsData, setVitalsData] = useState({
        temperature: '',
        bloodPressure: '',
        heartRate: '',
        respiratoryRate: '',
        weight: '',
        height: ''
    });




    useEffect(() => {
        if (user && user.token && id && id !== 'undefined') {
            fetchPatient();
            fetchCharges();
        }
    }, [id, user]);

    const fetchPatient = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/patients`, config);
            const foundPatient = data.find(p => p._id === id);
            setPatient(foundPatient);

            // Fetch all visits for this specific patient
            const visitsRes = await axios.get(`${backendUrl}/api/visits?patient=${id}`, config);
            const patientVisits = visitsRes.data;

            // Sort by date desc
            patientVisits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setPastEncounters(patientVisits);

            // Find active encounter
            const activeEncounter = patientVisits.find(v =>
                ['registered', 'payment_pending', 'in_nursing', 'with_doctor', 'awaiting_services', 'in_pharmacy', 'in_lab', 'in_radiology', 'in_ward', 'admitted'].includes(v.encounterStatus)
            );
            setEncounter(activeEncounter);

            // Fetch vitals & orders if encounter exists
            if (activeEncounter) {
                await fetchEncounterDetails(activeEncounter._id, config);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patient');
        } finally {
            setLoading(false);
        }
    };

    const fetchEncounterDetails = async (encounterId, config) => {
        try {
            const [vitalsRes, labRes, radRes, rxRes, visitRes, referralsRes] = await Promise.all([
                axios.get(`${backendUrl}/api/vitals/visit/${encounterId}`, config),
                axios.get(`${backendUrl}/api/lab/visit/${encounterId}`, config),
                axios.get(`${backendUrl}/api/radiology/visit/${encounterId}`, config),
                axios.get(`${backendUrl}/api/prescriptions/visit/${encounterId}`, config),
                axios.get(`${backendUrl}/api/visits/${encounterId}`, config),
                axios.get(`${backendUrl}/api/referrals/visit/${encounterId}`, config)
            ]);

            // Vitals
            if (vitalsRes.data.length > 0) setVitals(vitalsRes.data[0]);
            else setVitals(null);

            // Lab Orders
            setCurrentLabOrders(labRes.data);

            // Radiology Orders
            setCurrentRadOrders(radRes.data);

            // Prescriptions
            setCurrentPrescriptions(rxRes.data);

            // Clinical Notes (Other Notes)
            setClinicalNotes(visitRes.data.notes || []);
            // Ward Round Notes
            setWardRoundNotes(visitRes.data.wardRoundNotes || []);
            // Theatre Notes
            setTheatreNotes(visitRes.data.theatreNotes || []);
            // Consents
            setConsents(visitRes.data.consents || []);
            // Checklists
            setChecklists(visitRes.data.checklists || []);
            setPreAnaesthesiaChecklists(visitRes.data.preAnaesthesiaChecklists || []);
            setPostoperativeHandoverChecklists(visitRes.data.postoperativeHandoverChecklists || []);

            // Update encounter with fully-populated data (so consultingPhysician.name is available)
            setEncounter(visitRes.data);

            // Referrals
            setReferrals(referralsRes.data);

            // Fetch drug administration data if Inpatient
            if (visitRes.data.type === 'Inpatient') {
                await fetchDrugAdministrationData(encounterId, config);
            }

        } catch (error) {
            console.error('Error fetching encounter details', error);
            toast.error('Error fetching data');
        }
    };

    const fetchDrugAdministrationData = async (encounterId, config) => {
        try {
            const [rxRes, historyRes] = await Promise.all([
                axios.get(`${backendUrl}/api/prescriptions/visit/${encounterId}`, config),
                axios.get(`${backendUrl}/api/drug-administration/visit/${encounterId}`, config)
            ]);
            const consumableKeywords = ['syringe', 'cannula', 'giving set', 'infusion set', 'needle', 'plaster', 'gloves', 'mask', 'catheter', 'bandage'];
            const dispensedRx = rxRes.data.filter(p => p.status === 'dispensed').map(p => ({
                ...p,
                medicines: p.medicines.filter(m => {
                    const isMedication = m.dosage || m.route || m.frequency;
                    const isConsumable = consumableKeywords.some(keyword => m.name.toLowerCase().includes(keyword));
                    return isMedication && !isConsumable;
                })
            })).filter(p => p.medicines.length > 0);

            setDispensedPrescriptions(dispensedRx);
            setAdministrationHistory(historyRes.data);
        } catch (error) {
            console.error('Error fetching drug admin data:', error);
        }
    };

    const handleViewPastEncounter = async (visit) => {
        try {
            setLoading(true);
            setEncounter(visit);
            setViewingPastEncounter(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await fetchEncounterDetails(visit._id, config);
        } catch (error) {
            console.error(error);
            toast.error('Error loading encounter details');
        } finally {
            setLoading(false);
        }
    };

    const handleBackToActive = () => {
        setViewingPastEncounter(false);
        fetchPatient(); // Re-fetch to get active encounter
    };

    // Check if encounter is active based on rules:
    // 1. Inpatient: Active until discharged
    // 2. Outpatient: Active for 24 hours from creation
    const isEncounterActive = () => {
        if (!encounter) {
            console.log('🔍 isEncounterActive: No encounter');
            return false;
        }
        if (viewingPastEncounter) {
            console.log('🔍 isEncounterActive: Viewing past encounter');
            return false;
        }

        const inactiveStatuses = ['completed', 'cancelled', 'discharged'];
        if (inactiveStatuses.includes(encounter.encounterStatus)) {
            return false;
        }
        if (encounter.isActive === false) return false;
        if (encounter.isActive === true) return true;

        if (encounter.type === 'Inpatient') {
            // Inpatient encounters are active until discharged
            // Active statuses: admitted, in_progress, with_doctor, in_nursing, in_lab, in_radiology, in_pharmacy, in_ward, awaiting_services
            const activeStatuses = ['admitted', 'in_progress', 'with_doctor', 'in_nursing', 'in_lab', 'in_radiology', 'in_pharmacy', 'in_ward', 'awaiting_services', 'registered', 'payment_pending'];
            const isActive = activeStatuses.includes(encounter.encounterStatus);
            console.log('🔍 isEncounterActive: Inpatient encounter', {
                encounterStatus: encounter.encounterStatus,
                isActive,
                ward: encounter.ward,
                bed: encounter.bed
            });
            return isActive;
        } else {
            // For outpatient and other encounter types, check 24-hour window
            const oneDay = 24 * 60 * 60 * 1000;
            const created = new Date(encounter.createdAt).getTime();
            const now = new Date().getTime();
            const isActive = (now - created) < oneDay;
            const hoursOld = Math.floor((now - created) / (60 * 60 * 1000));
            console.log('🔍 isEncounterActive: Non-inpatient encounter', {
                type: encounter.type,
                createdAt: encounter.createdAt,
                hoursOld,
                isActive
            });
            return isActive;
        }
    };

    // Determine if user can edit (read-only for receptionists, viewing past encounters, or inactive encounters)
    const canEdit = ['doctor', 'admin'].includes(user?.role) && !viewingPastEncounter && isEncounterActive();
    // Nurses can also record theater forms (except Theatre Note which is doctor/admin only)
    const canEditNurse = ['doctor', 'admin', 'nurse'].includes(user?.role) && !viewingPastEncounter && isEncounterActive();

    const fetchCharges = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/charges`, config);

            setLabCharges(data.filter(c => c.type === 'lab'));
            setRadiologyCharges(data.filter(c => c.type === 'radiology'));

            // Fetch inventory drugs - filter by doctor's pharmacy if doctor role
            let inventoryUrl = `${backendUrl}/api/inventory`;
            if (user.role === 'doctor' && user.assignedPharmacy) {
                inventoryUrl += `?pharmacy=${user.assignedPharmacy._id || user.assignedPharmacy}`;
            }
            const inventoryRes = await axios.get(inventoryUrl, config);
            setInventoryDrugs(inventoryRes.data); // Include all drugs (even 0 qty)
        } catch (error) {
            console.error(error);
        }
    };

    const fetchRetainershipDepositStatus = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/hmo-transactions/retainership-deposit-status`, config);
            setRetainershipDepositStatus(data);
        } catch (error) {
            console.error('Error fetching retainership deposit status:', error);
        }
    };

    const fetchWards = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/wards`, config);
            setWards(data);
        } catch (error) {
            console.error('Error fetching wards:', error);
            toast.error('Error fetching wards');
        }
    };

    useEffect(() => {
        if (showConvertModal) {
            fetchWards();
            fetchRetainershipDepositStatus();
        }
    }, [showConvertModal]);

    useEffect(() => {
        if (selectedWard && wards.length > 0) {
            const ward = wards.find(w => w._id === selectedWard);
            if (ward) {
                setAvailableBeds(ward.beds.filter(b => !b.isOccupied));
            }
        } else {
            setAvailableBeds([]);
        }
    }, [selectedWard, wards]);

    const formatDateForInput = (d) => {
        if (!d) return '';
        try {
            return new Date(d).toISOString().slice(0, 10);
        } catch (e) {
            return '';
        }
    };

    const handleOpenConsentModal = (item) => {
        setConsentActiveNote(item);
        setConsentFile(null);
        if (item && item._id) {
            setIsConsentViewing(true);
            setConsentForm({
                patientName: item.patientName || '',
                patientAddress: item.patientAddress || '',
                physicianName: item.physicianName || '',
                procedureName: item.procedureName || '',
                consentDate: formatDateForInput(item.consentDate),
                relationship: item.relationship || 'self',
                explanationDate: formatDateForInput(item.explanationDate),

                patientSignatureName: item.patientSignatureName || '',
                patientSignatureDate: formatDateForInput(item.patientSignatureDate),
                surgeonSignatureName: item.surgeonSignatureName || '',
                surgeonSignatureDate: formatDateForInput(item.surgeonSignatureDate),
                guardianSignatureName: item.guardianSignatureName || '',
                guardianSignatureDate: formatDateForInput(item.guardianSignatureDate),
                anaesthetistSignatureName: item.anaesthetistSignatureName || '',
                anaesthetistSignatureDate: formatDateForInput(item.anaesthetistSignatureDate),

                relationshipWithPatient: item.relationshipWithPatient || '',

                patientThumbprint: item.patientThumbprint || '',
                patientThumbprintDate: formatDateForInput(item.patientThumbprintDate),
                witnessThumbprint: item.witnessThumbprint || '',
                witnessThumbprintDate: formatDateForInput(item.witnessThumbprintDate),
                uploadedFile: item.uploadedFile || '',
            });
            if (item.uploadedFile) {
                setConsentTab('upload');
            } else {
                setConsentTab('digital');
            }
        } else {
            setIsConsentViewing(false);
            setConsentTab('digital');
            setConsentForm({
                patientName: patient?.name || '',
                patientAddress: patient?.address || '',
                physicianName: user?.name || '',
                procedureName: '',
                consentDate: formatDateForInput(new Date()),
                relationship: 'self',
                explanationDate: formatDateForInput(new Date()),

                patientSignatureName: patient?.name || '',
                patientSignatureDate: formatDateForInput(new Date()),
                surgeonSignatureName: user?.name || '',
                surgeonSignatureDate: formatDateForInput(new Date()),
                guardianSignatureName: '',
                guardianSignatureDate: '',
                anaesthetistSignatureName: '',
                anaesthetistSignatureDate: formatDateForInput(new Date()),

                relationshipWithPatient: '',

                patientThumbprint: '',
                patientThumbprintDate: '',
                witnessThumbprint: '',
                witnessThumbprintDate: '',
                uploadedFile: '',
            });
        }
        setShowConsentModal(true);
    };

    const handleSaveConsent = async () => {
        if (!encounter) return;
        try {
            setLoading(true);
            const config = {
                headers: {
                    Authorization: `Bearer ${user.token}`,
                    'Content-Type': 'multipart/form-data'
                }
            };

            const formData = new FormData();

            if (consentTab === 'upload' && !consentFile && !consentForm.uploadedFile) {
                toast.error('Please select a PDF or image file to upload.');
                setLoading(false);
                return;
            }

            if (consentFile) {
                formData.append('consentFile', consentFile);
            }

            const payload = { ...consentForm };
            if (consentActiveNote && consentActiveNote._id) {
                payload._id = consentActiveNote._id;
            }

            // Send the entire consentForm data to preserve both digital fields and file path
            formData.append('consentData', JSON.stringify(payload));

            const { data } = await axios.post(
                `${backendUrl}/api/visits/${encounter._id}/consents`,
                formData,
                config
            );

            setTheatreNotes(data.theatreNotes || []);
            setConsents(data.consents || []);
            setShowConsentModal(false);
            setConsentActiveNote(null);
            toast.success('Consent saved successfully');
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving consent');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintConsent = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups for this website to print.');
            return;
        }

        const logoHtml = hospitalSettings?.hospitalLogo
            ? `<img src="${hospitalSettings.hospitalLogo.startsWith('data:') || hospitalSettings.hospitalLogo.startsWith('http') ? hospitalSettings.hospitalLogo : `${backendUrl}/uploads/${hospitalSettings.hospitalLogo}`}" alt="Logo" style="max-height: 80px; max-width: 150px; object-fit: contain; display: block; margin: 0 auto 10px;" />`
            : '';

        const phoneHtml = hospitalSettings?.phone
            ? `<p>Phone: ${hospitalSettings.phone} ${hospitalSettings.email ? ` | Email: ${hospitalSettings.email}` : ''}</p>`
            : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Consent Form - ${patient?.name || ''}</title>
                    <style>
                        @page {
                            size: A4;
                            margin: 10mm 15mm;
                        }
                        body { font-family: 'Times New Roman', serif; padding: 0; margin: 0; color: #000; line-height: 1.35; font-size: 13px; }
                        .header { text-align: center; margin-bottom: 12px; border-bottom: 2px double #000; padding-bottom: 6px; position: relative; }
                        .header h1 { font-size: 18px; text-transform: uppercase; margin: 2px 0; font-weight: bold; letter-spacing: 0.5px; }
                        .header p { font-size: 12px; margin: 1px 0; }
                        .title { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; text-decoration: underline; margin: 10px 0; letter-spacing: 0.5px; }
                        .paragraph { margin: 6px 0; text-align: justify; }
                        .line-fill { border-bottom: 1px dotted #000; display: inline-block; padding: 0 5px; font-weight: bold; font-style: italic; min-width: 120px; text-align: center; }
                        .grid-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 25px; margin-top: 12px; }
                        .signature-box { border-top: 1px solid #000; margin-top: 15px; padding-top: 2px; font-size: 11px; line-height: 1.35; }
                        .footer { text-align: center; font-size: 9px; margin-top: 15px; color: #555; border-top: 1px solid #ddd; padding-top: 4px; }
                        @media print {
                            body { padding: 0; margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${logoHtml}
                        <h1>${hospitalSettings?.reportHeader || 'HOSPITAL CONSENT'}</h1>
                        <p>${hospitalSettings?.address || ''}</p>
                        ${phoneHtml}
                    </div>
                    <div class="title">Consent for Surgery/Procedures</div>
                    
                    <div class="paragraph">
                        I, <span class="line-fill" style="min-width: 300px;">${consentForm.patientName || '______________________________________'}</span> (Full names of the patient, surname first),
                    </div>
                    <div class="paragraph">
                        of <span class="line-fill" style="min-width: 450px;">${consentForm.patientAddress || '______________________________________'}</span> (Full address of the Patient not P.O.Box),
                    </div>
                    <div class="paragraph">
                        Hereby, after detailed explanation of the risks and benefits to me by
                    </div>
                    <div class="paragraph">
                        Dr. <span class="line-fill" style="min-width: 300px;">${consentForm.physicianName || '______________________________________'}</span> (Full names of the physician, surname first),
                    </div>
                    <div class="paragraph">
                        Willingly consent to the procedure of <span class="line-fill" style="min-width: 300px;">${consentForm.procedureName || '______________________________________'}</span> 
                        on <span class="line-fill" style="min-width: 150px;">${consentForm.consentDate ? new Date(consentForm.consentDate).toLocaleDateString() : '__________________'}</span>.
                    </div>
                    <div class="paragraph">
                        Relationship to Patient: <span class="line-fill" style="min-width: 250px;">${consentForm.relationship || '__________________'}</span>.
                    </div>
                    
                    <div class="paragraph" style="margin-top: 25px;">
                        I affirm that I clearly understand the language of presentation. The option to think over the procedure for a period before assenting was also presented to me.
                    </div>
                    
                    <div class="paragraph">
                        <strong>I further affirm:</strong>
                        <ul style="margin-top: 5px; padding-left: 20px;">
                            <li>That explanation about this Surgery/procedure was first given to me at presentation date <span class="line-fill" style="min-width: 150px;">${consentForm.explanationDate ? new Date(consentForm.explanationDate).toLocaleDateString() : '_______________'}</span></li>
                            <li>That the extent of the procedure and mode of Anaesthesia are left to the discretion of the Physician, including the use of blood and/or its product.</li>
                            <li>That any additional surgery or procedure to that described above will only be carried out if necessary and in my best interest and can be justified for medical reasons.</li>
                            <li>I understand that an assurance has not been given that the operation will be performed by a particular surgeon.</li>
                        </ul>
                    </div>

                    <div class="grid-signatures">
                        <div class="signature-box">
                            <strong>Name and Signature of Patient:</strong><br/>
                            Name: ${consentForm.patientSignatureName || '______________________'}<br/>
                            Date: ${consentForm.patientSignatureDate ? new Date(consentForm.patientSignatureDate).toLocaleDateString() : '__________'}
                        </div>
                        <div class="signature-box">
                            <strong>Name and Signature of Surgeon:</strong><br/>
                            Name: ${consentForm.surgeonSignatureName || '______________________'}<br/>
                            Date: ${consentForm.surgeonSignatureDate ? new Date(consentForm.surgeonSignatureDate).toLocaleDateString() : '__________'}
                        </div>
                        <div class="signature-box">
                            <strong>Name and Signature of Guardian/Witness:</strong><br/>
                            Name: ${consentForm.guardianSignatureName || '______________________'}<br/>
                            Relationship: ${consentForm.relationshipWithPatient || '______________________'}<br/>
                            Date: ${consentForm.guardianSignatureDate ? new Date(consentForm.guardianSignatureDate).toLocaleDateString() : '__________'}
                        </div>
                        <div class="signature-box">
                            <strong>Name and Signature of Anaesthetist:</strong><br/>
                            Name: ${consentForm.anaesthetistSignatureName || '______________________'}<br/>
                            Date: ${consentForm.anaesthetistSignatureDate ? new Date(consentForm.anaesthetistSignatureDate).toLocaleDateString() : '__________'}
                        </div>
                    </div>

                    <div class="grid-signatures" style="margin-top: 30px;">
                        <div class="signature-box">
                            <strong>Thumb print of Patient:</strong><br/>
                            Confirm: ${consentForm.patientThumbprint ? 'Yes' : '______________________'}<br/>
                            Date: ${consentForm.patientThumbprintDate ? new Date(consentForm.patientThumbprintDate).toLocaleDateString() : '__________'}
                        </div>
                        <div class="signature-box">
                            <strong>Thumb print of Witness/Guardian:</strong><br/>
                            Confirm: ${consentForm.witnessThumbprint ? 'Yes' : '______________________'}<br/>
                            Date: ${consentForm.witnessThumbprintDate ? new Date(consentForm.witnessThumbprintDate).toLocaleDateString() : '__________'}
                        </div>
                    </div>

                    <div class="footer">
                        Generated by ${user.name} on ${new Date().toLocaleString()} | EMR Consent Registry
                    </div>
                    
                    <script>
                        window.onload = function() {
                            window.print();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const printConsentFromData = (consent) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups for this website to print.');
            return;
        }

        const logoHtml = hospitalSettings?.hospitalLogo
            ? `<img src="${hospitalSettings.hospitalLogo.startsWith('data:') || hospitalSettings.hospitalLogo.startsWith('http') ? hospitalSettings.hospitalLogo : `${backendUrl}/uploads/${hospitalSettings.hospitalLogo}`}" alt="Logo" style="max-height: 80px; max-width: 150px; object-fit: contain; display: block; margin: 0 auto 10px;" />`
            : '';

        const phoneHtml = hospitalSettings?.phone
            ? `<p>Phone: ${hospitalSettings.phone} ${hospitalSettings.email ? ` | Email: ${hospitalSettings.email}` : ''}</p>`
            : '';

        printWindow.document.write(`
            <html>
                <head>
                    <title>Consent Form - ${patient?.name || ''}</title>
                    <style>
                        @page {
                            size: A4;
                            margin: 10mm 15mm;
                        }
                        body { font-family: 'Times New Roman', serif; padding: 0; margin: 0; color: #000; line-height: 1.35; font-size: 13px; }
                        .header { text-align: center; margin-bottom: 12px; border-bottom: 2px double #000; padding-bottom: 6px; position: relative; }
                        .header h1 { font-size: 18px; text-transform: uppercase; margin: 2px 0; font-weight: bold; letter-spacing: 0.5px; }
                        .header p { font-size: 12px; margin: 1px 0; }
                        .title { text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; text-decoration: underline; margin: 10px 0; letter-spacing: 0.5px; }
                        .paragraph { margin: 6px 0; text-align: justify; }
                        .line-fill { border-bottom: 1px dotted #000; display: inline-block; padding: 0 5px; font-weight: bold; font-style: italic; min-width: 120px; text-align: center; }
                        .grid-signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 25px; margin-top: 12px; }
                        .signature-box { border-top: 1px solid #000; margin-top: 15px; padding-top: 2px; font-size: 11px; line-height: 1.35; }
                        .footer { text-align: center; font-size: 9px; margin-top: 15px; color: #555; border-top: 1px solid #ddd; padding-top: 4px; }
                        @media print {
                            body { padding: 0; margin: 0; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${logoHtml}
                        <h1>${hospitalSettings?.reportHeader || 'HOSPITAL CONSENT'}</h1>
                        <p>${hospitalSettings?.address || ''}</p>
                        ${phoneHtml}
                    </div>
                    <div class="title">Consent for Surgery/Procedures</div>
                    
                    <div class="paragraph">
                        I, <span class="line-fill" style="min-width: 300px;">${consent.patientName || '______________________________________'}</span> (Full names of the patient, surname first),
                    </div>
                    <div class="paragraph">
                        of <span class="line-fill" style="min-width: 450px;">${consent.patientAddress || '______________________________________'}</span> (Full address of the Patient not P.O.Box),
                    </div>
                    <div class="paragraph">
                        Hereby, after detailed explanation of the risks and benefits to me by
                    </div>
                    <div class="paragraph">
                        Dr. <span class="line-fill" style="min-width: 300px;">${consent.physicianName || '______________________________________'}</span> (Full names of the physician, surname first),
                    </div>
                    <div class="paragraph">
                        Willingly consent to the procedure of <span class="line-fill" style="min-width: 300px;">${consent.procedureName || '______________________________________'}</span> 
                        on <span class="line-fill" style="min-width: 150px;">${consent.consentDate ? new Date(consent.consentDate).toLocaleDateString() : '__________________'}</span>.
                    </div>
                    <div class="paragraph">
                        Relationship to Patient: <span class="line-fill" style="min-width: 250px;">${consent.relationship || '__________________'}</span>.
                    </div>
                    
                    <div class="paragraph" style="margin-top: 25px;">
                        I affirm that I clearly understand the language of presentation. The option to think over the procedure for a period before assenting was also presented to me.
                    </div>
                    
                    <div class="paragraph">
                        <strong>I further affirm:</strong>
                        <ul style="margin-top: 5px; padding-left: 20px;">
                            <li>That explanation about this Surgery/procedure was first given to me at presentation date <span class="line-fill" style="min-width: 150px;">${consent.explanationDate ? new Date(consent.explanationDate).toLocaleDateString() : '_______________'}</span></li>
                            <li>That the extent of the procedure and mode of Anaesthesia are left to the discretion of the Physician, including the use of blood and/or its product.</li>
                            <li>That any additional surgery or procedure to that described above will only be carried out if necessary and in my best interest and can be justified for medical reasons.</li>
                            <li>I understand that an assurance has not been given that the operation will be performed by a particular surgeon.</li>
                        </ul>
                    </div>

                    <div class="grid-signatures">
                        <div class="signature-box">
                            <strong>Name and Signature of Patient:</strong><br/>
                            Name: ${consent.patientSignatureName || '______________________'}<br/>
                            Date: ${consent.patientSignatureDate ? new Date(consent.patientSignatureDate).toLocaleDateString() : '__________'}
                        </div>
                        <div class="signature-box">
                            <strong>Name and Signature of Surgeon:</strong><br/>
                            Name: ${consent.surgeonSignatureName || '______________________'}<br/>
                            Date: ${consent.surgeonSignatureDate ? new Date(consent.surgeonSignatureDate).toLocaleDateString() : '__________'}
                        </div>
                        <div class="signature-box">
                            <strong>Name and Signature of Guardian/Witness:</strong><br/>
                            Name: ${consent.guardianSignatureName || '______________________'}<br/>
                            Relationship: ${consent.relationshipWithPatient || '______________________'}<br/>
                            Date: ${consent.guardianSignatureDate ? new Date(consent.guardianSignatureDate).toLocaleDateString() : '__________'}
                        </div>
                        <div class="signature-box">
                            <strong>Name and Signature of Anaesthetist:</strong><br/>
                            Name: ${consent.anaesthetistSignatureName || '______________________'}<br/>
                            Date: ${consent.anaesthetistSignatureDate ? new Date(consent.anaesthetistSignatureDate).toLocaleDateString() : '__________'}
                        </div>
                    </div>

                    <div class="grid-signatures" style="margin-top: 30px;">
                        <div class="signature-box">
                            <strong>Thumb print of Patient:</strong><br/>
                            Confirm: ${consent.patientThumbprint ? 'Yes' : '______________________'}<br/>
                            Date: ${consent.patientThumbprintDate ? new Date(consent.patientThumbprintDate).toLocaleDateString() : '__________'}
                        </div>
                        <div class="signature-box">
                            <strong>Thumb print of Witness/Guardian:</strong><br/>
                            Confirm: ${consent.witnessThumbprint ? 'Yes' : '______________________'}<br/>
                            Date: ${consent.witnessThumbprintDate ? new Date(consent.witnessThumbprintDate).toLocaleDateString() : '__________'}
                        </div>
                    </div>

                    <div class="footer">
                        Generated by ${user.name} on ${new Date().toLocaleString()} | EMR Consent Registry
                    </div>
                    
                    <script>
                        window.onload = function() {
                            window.print();
                        }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleConvertToInpatient = async () => {
        if (!selectedWard || !selectedBed) {
            toast.error('Please select both Ward and Bed');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/visits/${encounter._id}/convert-to-inpatient`,
                { ward: selectedWard, bed: selectedBed },
                config
            );

            toast.success('Patient converted to Inpatient successfully');
            setShowConvertModal(false);
            fetchPatient(); // Refresh data
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error converting encounter');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveSOAP = async () => {
        if (!encounter) {
            toast.error('No active encounter found');
            return;
        }

        if (!soapNote.diagnosis || soapNote.diagnosis.length === 0) {
            toast.error('Diagnosis is compulsory. Please search and select at least one ICD diagnosis.');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = {
                ...soapNote,
                diagnosis: soapNote.diagnosis,
                ...(editingNoteId ? { noteId: editingNoteId } : {})
            };
            const { data } = await axios.post(
                `${backendUrl}/api/visits/${encounter._id}/clinical-notes`,
                payload,
                config
            );
            toast.success(editingNoteId ? 'Clinical note updated!' : 'Clinical note added!');
            localStorage.removeItem(`draft_soap_${patient._id}_${encounter._id}`);
            setShowSoapModal(false);
            setEditingNoteId(null);

            // Update encounter with fresh data from server response
            setEncounter(data);
            setClinicalNotes(data.notes || []);

            // Clear form
            setSoapNote({
                presentingComplaints: '',
                historyOfPresentingComplaint: '',
                systemReview: '',
                pastMedicalSurgicalHistory: '',
                socialFamilyHistory: '',
                drugsHistory: '',
                functionalCognitiveStatus: '',
                menstruationGynecologicalObstetricsHistory: '',
                pregnancyHistory: '',
                immunization: '',
                nutritional: '',
                developmentalMilestones: '',
                generalAppearance: '',
                heent: '',
                neck: '',
                cvs: '',
                resp: '',
                abd: '',
                neuro: '',
                msk: '',
                skin: '',
                assessment: '',
                plan: '',
                diagnosis: []
            });
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving clinical note');
        } finally {
            setLoading(false);
        }
    };

    const handleAddLabToQueue = () => {
        if (!selectedLabTest) return;
        const test = labCharges.find(c => c._id === selectedLabTest);

        if (test && test.active === false) {
            toast.error('This investigation is currently inactive or out of reagent.');
            return;
        }

        if (test && !tempLabOrders.find(t => t._id === test._id)) {
            setTempLabOrders([...tempLabOrders, test]);
            setSelectedLabTest(''); // Reset selection
            setLabSearchTerm(''); // Reset search
            toast.success('Test added to list');
        }
    };

    const handleRemoveLabFromQueue = (id) => {
        setTempLabOrders(tempLabOrders.filter(t => t._id !== id));
    };

    const handlePlaceLabOrder = async () => {
        if (tempLabOrders.length === 0 && !selectedLabTest) return;

        // If user has a selected test but didn't add to queue, add it now
        let ordersToPlace = [...tempLabOrders];
        if (selectedLabTest) {
            const test = labCharges.find(c => c._id === selectedLabTest);
            if (test && !ordersToPlace.find(t => t._id === test._id)) {
                ordersToPlace.push(test);
            }
        }

        if (ordersToPlace.length === 0) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            for (const test of ordersToPlace) {
                // 1. Add charge to encounter FIRST
                const chargeRes = await axios.post(
                    `${backendUrl}/api/encounter-charges`,
                    {
                        encounterId: encounter._id,
                        patientId: patient._id,
                        chargeId: test._id,
                        quantity: 1
                    },
                    config
                );

                // 2. Create lab order with charge ID
                await axios.post(
                    `${backendUrl}/api/lab`,
                    {
                        patientId: patient._id,
                        visitId: encounter._id,
                        chargeId: chargeRes.data._id, // Link to charge
                        testName: test.name,
                        notes: 'Doctor ordered',
                        clinicalDetails: labClinicalDetails
                    },
                    config
                );
            }

            toast.success(`${ordersToPlace.length} Lab order(s) placed!`);
            setSelectedLabTest('');
            setTempLabOrders([]);
            setLabClinicalDetails('');
            setShowLabModal(false);
            // Refresh list
            const labRes = await axios.get(`${backendUrl}/api/lab/visit/${encounter._id}`, config);
            setCurrentLabOrders(labRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Error placing lab order');
        } finally {
            setLoading(false);
        }
    };

    const handleAddRadToQueue = () => {
        if (!selectedRadTest) return;
        const scan = radiologyCharges.find(c => c._id === selectedRadTest);

        if (scan && scan.active === false) {
            toast.error('This investigation is currently inactive or out of reagent.');
            return;
        }

        if (scan && !tempRadOrders.find(s => s._id === scan._id)) {
            setTempRadOrders([...tempRadOrders, scan]);
            setSelectedRadTest(''); // Reset selection
            setRadSearchTerm(''); // Reset search
            toast.success('Scan added to list');
        }
    };

    const handleRemoveRadFromQueue = (id) => {
        setTempRadOrders(tempRadOrders.filter(s => s._id !== id));
    };

    const handlePlaceRadiologyOrder = async () => {
        if (tempRadOrders.length === 0 && !selectedRadTest) return;

        // If user has a selected test but didn't add to queue, add it now
        let ordersToPlace = [...tempRadOrders];
        if (selectedRadTest) {
            const scan = radiologyCharges.find(c => c._id === selectedRadTest);
            if (scan && !ordersToPlace.find(s => s._id === scan._id)) {
                ordersToPlace.push(scan);
            }
        }

        if (ordersToPlace.length === 0) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            for (const scan of ordersToPlace) {
                // 1. Add charge to encounter FIRST
                const chargeRes = await axios.post(
                    `${backendUrl}/api/encounter-charges`,
                    {
                        encounterId: encounter._id,
                        patientId: patient._id,
                        chargeId: scan._id,
                        quantity: 1
                    },
                    config
                );

                // 2. Create radiology order with charge ID
                await axios.post(
                    `${backendUrl}/api/radiology`,
                    {
                        patientId: patient._id,
                        visitId: encounter._id,
                        chargeId: chargeRes.data._id, // Link to charge
                        scanType: scan.name,
                        notes: 'Doctor ordered'
                    },
                    config
                );
            }

            toast.success(`${ordersToPlace.length} Radiology order(s) placed!`);
            setSelectedRadTest('');
            setTempRadOrders([]);
            setShowRadModal(false);
            // Refresh list
            const radRes = await axios.get(`${backendUrl}/api/radiology/visit/${encounter._id}`, config);
            setCurrentRadOrders(radRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Error placing radiology order');
        } finally {
            setLoading(false);
        }
    };

    // Filter drugs based on search term - Aggregate batches by name
    useEffect(() => {
        if (drugSearchTerm) {
            const filtered = inventoryDrugs.filter(d =>
                d.name.toLowerCase().includes(drugSearchTerm.toLowerCase())
            );

            // Group by name
            const grouped = filtered.reduce((acc, drug) => {
                const key = drug.name.toLowerCase();
                if (!acc[key]) {
                    acc[key] = {
                        ...drug,
                        quantity: 0,
                        batches: []
                    };
                }
                acc[key].quantity += drug.quantity;
                acc[key].batches.push(drug);
                return acc;
            }, {});

            // Sort batches within each group by expiryDate (earliest first)
            Object.values(grouped).forEach(drugGroup => {
                drugGroup.batches.sort((a, b) => {
                    if (!a.expiryDate) return 1;
                    if (!b.expiryDate) return -1;
                    return new Date(a.expiryDate) - new Date(b.expiryDate);
                });
                // Update primary drug info to use the earliest non-expired batch if possible
                const earliestActive = drugGroup.batches.find(b => b.quantity > 0 && (!b.expiryDate || new Date(b.expiryDate) > new Date())) || drugGroup.batches[0];
                if (earliestActive) {
                    drugGroup._id = earliestActive._id;
                    drugGroup.price = earliestActive.price;
                    drugGroup.expiryDate = earliestActive.expiryDate;
                }
            });

            setFilteredDrugs(Object.values(grouped));
            setShowDrugDropdown(true);
        } else {
            setFilteredDrugs([]);
            setShowDrugDropdown(false);
        }
    }, [drugSearchTerm, inventoryDrugs]);

    const handleSelectDrugFromSearch = (drug) => {
        setSelectedDrug(drug._id);
        setDrugSearchTerm(drug.name);
        setShowDrugDropdown(false);
        setBuyOutside(false); // Reset Buy Outside toggle when selecting a new drug

        // Auto-populate fields from drug data
        setDrugRoute(drug.route || '');
        setDrugDosage(drug.dosage || '');
        setDrugForm(drug.form || '');
        setDrugFrequency(drug.frequency || '');
    };

    const handleAddDrugToQueue = () => {
        if (!selectedDrug) return;

        const drugData = inventoryDrugs.find(d => d._id === selectedDrug);
        if (!drugData) return;

        // Restriction Check - Bypass if Buy Outside is checked
        if (!buyOutside) {
            if (drugData.expiryDate && new Date(drugData.expiryDate) < new Date()) {
                toast.error('Cannot prescribe: This drug is expired. Use "Buy Outside" mode if needed for records.');
                return;
            }

            if (drugData.quantity < drugQuantity) {
                toast.error(`Cannot prescribe: Insufficient inventory (Only ${drugData.quantity} available). Use "Buy Outside" mode if needed for records.`);
                return;
            }
        }

        const newDrugItem = {
            id: Date.now(), // Temp ID
            drugId: selectedDrug,
            name: drugData.name,
            price: drugData.price,
            quantity: drugQuantity,
            route: drugRoute || 'As directed',
            dosage: drugDosage || 'As directed',
            form: drugForm || 'As directed',
            frequency: drugFrequency || 'As directed',
            duration: (drugDuration && !isNaN(drugDuration)) ? `${drugDuration} days` : (drugDuration || 'As directed'),
            buyOutside: buyOutside // Include flag
        };

        setTempDrugs([...tempDrugs, newDrugItem]);

        // Reset form
        setSelectedDrug('');
        setDrugSearchTerm('');
        setDrugQuantity(1);
        setDrugRoute('');
        setDrugDosage('');
        setDrugForm('');
        setDrugFrequency('');
        setDrugDuration('');
        toast.success('Drug added to list');
    };

    const handleRemoveDrugFromQueue = (id) => {
        setTempDrugs(tempDrugs.filter(d => d.id !== id));
    };

    const processSinglePrescription = async (drugItem, config) => {
        const selectedDrugData = inventoryDrugs.find(d => d._id === drugItem.drugId);

        // removed charge generation logic here

        // Create prescription WITHOUT charge ID
        await axios.post(
            `${backendUrl}/api/prescriptions`,
            {
                patientId: patient._id,
                visitId: encounter._id,
                // chargeId is now omitted
                medicines: [{
                    name: selectedDrugData.name,
                    dosage: drugItem.dosage,
                    frequency: drugItem.frequency,
                    duration: drugItem.duration,
                    route: drugItem.route,
                    form: drugItem.form,
                    quantity: drugItem.quantity,
                    buyOutside: drugItem.buyOutside // Pass the flag
                }],
                notes: 'Doctor prescribed'
            },
            config
        );
    };

    const handlePrescribeAll = async () => {
        if (tempDrugs.length === 0) {
            toast.error('No drugs in the list to prescribe');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Process all drugs in queue
            for (const drugItem of tempDrugs) {
                await processSinglePrescription(drugItem, config);
            }

            // 3. Update encounter status to 'in_pharmacy'
            await axios.put(
                `${backendUrl}/api/visits/${encounter._id}`,
                { encounterStatus: 'in_pharmacy' },
                config
            );

            toast.success(`All prescriptions created! Status updated to Pharmacy.`);

            // Reset and close
            setTempDrugs([]);
            setShowRxModal(false);

            // Refresh list
            const rxRes = await axios.get(`${backendUrl}/api/prescriptions/visit/${encounter._id}`, config);
            setCurrentPrescriptions(rxRes.data);

            // Refresh encounter to reflect status change
            await fetchPatient();
        } catch (error) {
            console.error(error);
            toast.error('Error processing prescriptions');
            setLoading(false);
        }
    };

    // Referral Functions

    const fetchReferrals = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const res = await axios.get(`${backendUrl}/api/referrals/visit/${encounter._id}`, config);
            setReferrals(res.data);
        } catch (error) {
            console.error('Error fetching referrals:', error);
        }
    };

    const handleCreateReferral = async () => {
        if (!referralData.referredTo || !referralData.reason) {
            toast.error('Please fill in "Referred To" and "Reason" fields');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editingReferral) {
                // Update existing referral
                const res = await axios.put(`${backendUrl}/api/referrals/${editingReferral._id}`, {
                    referredTo: referralData.referredTo,
                    reason: referralData.reason,
                    diagnosis: referralData.diagnosis,
                    notes: referralData.notes,
                    medicalHistory: referralData.medicalHistory
                }, config);

                setReferrals(referrals.map(ref => ref._id === editingReferral._id ? res.data : ref));
                toast.success('Referral updated successfully');
            } else {
                // Create new referral
                const res = await axios.post(`${backendUrl}/api/referrals`, {
                    patientId: patient._id,
                    visitId: encounter._id,
                    referredTo: referralData.referredTo,
                    reason: referralData.reason,
                    diagnosis: referralData.diagnosis,
                    notes: referralData.notes,
                    medicalHistory: referralData.medicalHistory
                }, config);

                setReferrals([...referrals, res.data]);
                toast.success('Referral created successfully');
            }

            setReferralData({ referredTo: '', reason: '', diagnosis: '', notes: '', medicalHistory: '' });
            setEditingReferral(null);
            setShowReferralModal(false);
        } catch (error) {
            console.error(error);
            toast.error(editingReferral ? 'Error updating referral' : 'Error creating referral');
        }
    };

    const handleEditClick = (referral) => {
        setEditingReferral(referral);
        setReferralData({
            referredTo: referral.referredTo,
            reason: referral.reason,
            diagnosis: referral.diagnosis,
            notes: referral.notes || '',
            medicalHistory: referral.medicalHistory || ''
        });
        setShowReferralModal(true);
    };

    const handleCancelEdit = () => {
        setEditingReferral(null);
        setReferralData({ referredTo: '', reason: '', diagnosis: '', notes: '', medicalHistory: '' });
        setShowReferralModal(false);
    };

    const handleDischarge = async () => {
        if (!encounter) return;
        setShowDischargeModal(true);
    };

    const handleConfirmDischarge = async () => {
        if (!encounter) return;
        if (!dischargeNote.trim()) {
            toast.error('Please write a discharge note / summary before discharging.');
            return;
        }
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/visits/${encounter._id}`,
                {
                    encounterStatus: 'discharged',
                    status: 'Discharged',
                    dischargeNotes: dischargeNote
                },
                config
            );
            toast.success('Patient discharged successfully');
            setShowDischargeModal(false);
            setDischargeNote('');
            fetchPatient();
        } catch (error) {
            console.error(error);
            toast.error('Error discharging patient');
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async () => {
        if (!newNote.trim() || !encounter) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.post(
                `${backendUrl}/api/visits/${encounter._id}/notes`,
                { text: newNote },
                config
            );
            setClinicalNotes(data);
            localStorage.removeItem(`draft_note_${patient._id}_${encounter._id}`);
            setNewNote('');
            setShowNoteModal(false);
            toast.success('Note added successfully');
        } catch (error) {
            console.error(error);
            toast.error('Error adding note');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteOrder = async (type, orderId) => {
        if (!window.confirm(`Are you sure you want to delete this ${type} order? This will also remove the associated pending charge.`)) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            let endpoint = '';
            if (type === 'lab') endpoint = `${backendUrl}/api/lab/${orderId}`;
            else if (type === 'radiology') endpoint = `${backendUrl}/api/radiology/${orderId}`;
            else if (type === 'prescription') endpoint = `${backendUrl}/api/prescriptions/${orderId}`;

            await axios.delete(endpoint, config);
            toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} order deleted successfully`);

            // Refresh the relevant list
            if (type === 'lab') {
                const labRes = await axios.get(`${backendUrl}/api/lab/visit/${encounter._id}`, config);
                setCurrentLabOrders(labRes.data);
            } else if (type === 'radiology') {
                const radRes = await axios.get(`${backendUrl}/api/radiology/visit/${encounter._id}`, config);
                setCurrentRadOrders(radRes.data);
            } else if (type === 'prescription') {
                const rxRes = await axios.get(`${backendUrl}/api/prescriptions/visit/${encounter._id}`, config);
                setCurrentPrescriptions(rxRes.data);
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || `Error deleting ${type} order`);
        } finally {
            setLoading(false);
        }
    };

    const printReferral = (referral) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Referral Form - ${patient.name}</title>
                    <style>
                        body { font-family: 'Times New Roman', Times, serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #000; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .hospital-name { font-size: 24px; font-weight: bold; color: #2c5282; margin-bottom: 5px; text-transform: uppercase; }
                        .hospital-info { font-size: 14px; margin-bottom: 3px; }
                        .doc-title { font-size: 22px; margin-top: 20px; font-weight: bold; text-decoration: underline; color: #2c5282; text-align: center; }
                        .content { margin-top: 30px; }
                        .row { display: flex; justify-content: space-between; margin-bottom: 15px; align-items: flex-end; }
                        .col { flex: 1; }
                        .field-line { border-bottom: 1px solid #000; padding-bottom: 2px; display: inline-block; width: 100%; }
                        .label { font-weight: bold; margin-right: 5px; }
                        .section { margin-bottom: 25px; }
                        .section-title { font-weight: bold; margin-bottom: 5px; }
                        .lines { border-bottom: 1px solid #000; height: 25px; margin-bottom: 5px; }
                        .footer { margin-top: 60px; }
                        
                        /* Specific adjustments to match image */
                        .input-line { border-bottom: 1px solid #000; flex-grow: 1; margin-left: 5px; padding-left: 5px; }
                        .flex-field { display: flex; align-items: flex-end; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-contain: contain; margin-bottom: 0;" />` : ''}
                        <div class="hospital-name" style="margin-top: 0;">${systemSettings?.reportHeader || 'SUD EMR'}</div>
                        <div class="hospital-info">${systemSettings?.address || ''}</div>
                        <div class="hospital-info">
                            ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                            ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                            ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                        </div>
                        
                        <div class="doc-title">Referral Form</div>
                    </div>
                    
                    <div class="content">
                        <div class="row">
                            <div class="flex-field" style="flex: 2;">
                                <span class="label">Full Name:</span>
                                <span class="input-line">${patient.name}</span>
                            </div>
                            <div class="flex-field" style="flex: 1; margin-left: 20px;">
                                <span class="label">Age:</span>
                                <span class="input-line">${formatAge(patient.age)}</span>
                            </div>
                            <div class="flex-field" style="flex: 1; margin-left: 20px;">
                                <span class="label">Gender:</span>
                                <span class="input-line">${patient.gender}</span>
                            </div>
                        </div>

                        <div class="row">
                            <div class="flex-field" style="flex: 2;">
                                <span class="label">Address:</span>
                                <span class="input-line">${patient.address || ''}</span>
                            </div>
                            <div class="flex-field" style="flex: 1; margin-left: 20px;">
                                <span class="label">Phone:</span>
                                <span class="input-line">${patient.phone || ''}</span>
                            </div>
                        </div>

                        <div class="section">
                            <div class="flex-field">
                                <span class="label">Referred Clinic/hospital:</span>
                                <span class="input-line">${referral.referredTo}</span>
                            </div>
                        </div>

                        <div class="section">
                            <div class="label">Reason For Referral:</div>
                            <div style="border-bottom: 1px solid #000; min-height: 25px; margin-top: 5px;">${referral.reason}</div>
                            <div class="lines"></div>
                            <div class="lines"></div>
                        </div>

                        <div class="section">
                            <div class="label">Client Medical History:</div>
                            <div style="border-bottom: 1px solid #000; min-height: 25px; margin-top: 5px;">${referral.medicalHistory || referral.diagnosis || ''}</div>
                            <div class="lines"></div>
                            <div class="lines"></div>
                            <div class="lines"></div>
                        </div>

                        <div class="section">
                            <div class="label">Client Examination Findings:</div>
                            <div class="row" style="margin-top: 15px;">
                                <div class="flex-field" style="flex: 1;">
                                    <span class="label">Blood Pressure:</span>
                                    <span class="input-line">${vitals?.bloodPressure || ''}</span>
                                </div>
                                <div class="flex-field" style="flex: 1; margin-left: 20px;">
                                    <span class="label">Height:</span>
                                    <span class="input-line">${vitals?.height || ''}</span>
                                </div>
                                <div class="flex-field" style="flex: 1; margin-left: 20px;">
                                    <span class="label">Weight:</span>
                                    <span class="input-line">${vitals?.weight || ''}</span>
                                </div>
                            </div>
                            <div class="lines"></div>
                            <div class="lines"></div>
                            <div class="lines"></div>
                        </div>

                        <div class="footer">
                            <div class="flex-field">
                                <span class="label">Referrer Name & Signature:</span>
                                <span style="border-bottom: 1px solid #000; flex-grow: 1; padding-left: 10px;">Dr. ${user.name}</span>
                            </div>
                        </div>

                        ${systemSettings?.reportFooter ? `
                        <div style="margin-top: 40px; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #eee; pt-2;">
                            ${systemSettings.reportFooter}
                        </div>
                        ` : ''}
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Helper function to get color class for vital signs based on normal ranges
    const getVitalColorClass = (vitalType, value) => {
        if (!value || value === '-') return '';

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '';

        switch (vitalType) {
            case 'temperature':
                // Normal: 36.1-37.2Â°C
                if (numValue < 36.1) return 'text-yellow-600 font-semibold';
                if (numValue > 37.2) return 'text-red-600 font-semibold';
                return '';

            case 'heartRate':
                // Normal: 60-100 bpm
                if (numValue < 60) return 'text-yellow-600 font-semibold';
                if (numValue > 100) return 'text-red-600 font-semibold';
                return '';

            case 'respiratoryRate':
                // Normal: 12-20 breaths/min
                if (numValue < 12) return 'text-yellow-600 font-semibold';
                if (numValue > 20) return 'text-red-600 font-semibold';
                return '';

            case 'spo2':
                // Normal: â‰¥95%
                if (numValue < 95) return 'text-red-600 font-semibold';
                if (numValue < 90) return 'text-red-700 font-bold';
                return '';

            case 'bloodPressure':
                // Parse systolic/diastolic (e.g., "120/80")
                const parts = value.toString().split('/');
                if (parts.length === 2) {
                    const systolic = parseFloat(parts[0]);
                    const diastolic = parseFloat(parts[1]);

                    // Normal: Systolic 90-120, Diastolic 60-80
                    if (systolic < 90 || diastolic < 60) return 'text-yellow-600 font-semibold';
                    if (systolic > 140 || diastolic > 90) return 'text-red-600 font-semibold';
                }
                return '';

            default:
                return '';
        }
    };

    const isRetainership = ['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(patient?.provider);
    const hasPatientDeposit = (patient?.depositBalance || 0) > 0;
    const hmoDepositInfo = isRetainership && retainershipDepositStatus.find(s => s.name === patient?.hmo);
    const hasHmoDeposit = hmoDepositInfo ? hmoDepositInfo.hasDeposit : false;
    const isBlocked = isRetainership ? (!hasPatientDeposit && !hasHmoDeposit) : !hasPatientDeposit;

    if (!patient) return <LoadingOverlay />;

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="mb-6 flex justify-between items-start">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">{patient.name}</h2>
                    <p className="text-gray-600">MRN: {patient.mrn} | Age: {formatAge(patient.age)} | {patient.gender}</p>
                    {encounter && (
                        <div className="flex items-center gap-4 mt-2">
                            <p className="text-sm text-blue-600">
                                {viewingPastEncounter ? 'Viewing Past Encounter' : 'Active Encounter'}: {encounter.type} - {new Date(encounter.createdAt).toLocaleDateString()}
                            </p>
                            {encounter.waiveConsultationFee ? (
                                <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded shadow-sm">
                                    Consultation Fee Waived by {encounter.waivedBy?.name || encounter.doctor?.name || 'Staff'}
                                </span>
                            ) : (
                                <span className={`text-xs font-semibold px-2 py-0.5 rounded shadow-sm ${encounter.isANC || encounter.paymentValidated ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                    {encounter.isANC ? 'ANC' : (encounter.paymentValidated ? 'Paid' : 'Unpaid')}
                                </span>
                            )}
                            {viewingPastEncounter && (
                                <button onClick={handleBackToActive} className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded">
                                    Back to Active
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Encounter History Dropdown */}
                <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-gray-700">Medical History:</label>
                    <select
                        className="border p-2 rounded text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onChange={(e) => {
                            if (e.target.value === 'active') {
                                handleBackToActive();
                            } else {
                                const selected = pastEncounters.find(p => p._id === e.target.value);
                                if (selected) handleViewPastEncounter(selected);
                            }
                        }}
                        value={viewingPastEncounter && encounter ? encounter._id : 'active'}
                    >
                        <option value="active">Current Active Visit</option>
                        {pastEncounters.map(visit => (
                            <option key={visit._id} value={visit._id}>
                                {new Date(visit.createdAt).toLocaleDateString()} - {visit.type} ({visit.encounterStatus})
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            {
                ['doctor', 'nurse', 'receptionist', 'admin'].includes(user.role) && (
                    <div className="flex justify-end mb-4 font-sans">
                        {user.role === 'doctor' && (
                            <button
                                onClick={() => setShowAppointmentModal(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition shadow-sm font-semibold text-sm"
                            >
                                <FaCalendarPlus /> Schedule Follow-up
                            </button>
                        )}
                        {(['doctor', 'receptionist'].includes(user.role) || (user.role === 'nurse' && referrals.length > 0)) && (
                            referrals.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {referrals.map(ref => (
                                        <div key={ref._id} className="ml-2 bg-orange-50 border border-orange-200 px-3 py-1.5 rounded flex items-center gap-3 shadow-sm font-sans text-xs">
                                            <div className="flex items-center gap-1">
                                                <FaFileMedical className="text-orange-600 shrink-0" />
                                                <span className="font-bold text-orange-700 shrink-0">Referral:</span>
                                                <span className="font-semibold text-gray-800 truncate max-w-[120px]">{ref.referredTo}</span>
                                            </div>
                                            <span className="text-[10px] text-gray-500 shrink-0">
                                                by Dr. {ref.doctor?.name || 'Unknown'}
                                            </span>
                                            <div className="flex gap-1 shrink-0">
                                                {ref.doctor?._id === user._id && user.role === 'doctor' && (
                                                    <button
                                                        onClick={() => handleEditClick(ref)}
                                                        className="text-green-600 hover:text-green-800 flex items-center gap-0.5 px-2 py-0.5 border border-green-600 rounded bg-white font-semibold text-[10px] transition"
                                                    >
                                                        <FaEdit /> Edit
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => printReferral(ref)}
                                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-0.5 px-2 py-0.5 border border-blue-600 rounded bg-white font-semibold text-[10px] transition"
                                                >
                                                    <FaFileMedical /> Print
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <button
                                    onClick={() => {
                                        if (user.role === 'receptionist') {
                                            setActiveTab('referrals');
                                            document.getElementById('visit-sections')?.scrollIntoView({ behavior: 'smooth' });
                                            return;
                                        }
                                        if (encounter) {
                                            const diagStr = (encounter.diagnosis || []).map(d => `${d.code}: ${d.description}`).join(', ');

                                            const historyParts = [];

                                            // Encounter (SOAP) Details
                                            if (encounter.presentingComplaints) historyParts.push(`Presenting Complaints: ${encounter.presentingComplaints}`);
                                            if (encounter.historyOfPresentingComplaint) historyParts.push(`HPC: ${encounter.historyOfPresentingComplaint}`);
                                            if (encounter.pastMedicalSurgicalHistory) historyParts.push(`PMH: ${encounter.pastMedicalSurgicalHistory}`);
                                            if (encounter.socialFamilyHistory) historyParts.push(`Social/Family: ${encounter.socialFamilyHistory}`);
                                            if (encounter.drugsHistory) historyParts.push(`Drug History: ${encounter.drugsHistory}`);

                                            // Add all clinical notes
                                            if (clinicalNotes && clinicalNotes.length > 0) {
                                                historyParts.push('\n--- Clinical Notes ---');
                                                clinicalNotes.forEach(note => {
                                                    historyParts.push(`- ${note.text}`);
                                                });
                                            }

                                            // Add Vitals
                                            if (vitals) {
                                                historyParts.push('\n--- Recent Vitals ---');
                                                if (vitals.bloodPressure) historyParts.push(`BP: ${vitals.bloodPressure}`);
                                                if (vitals.heartRate) historyParts.push(`HR: ${vitals.heartRate} bpm`);
                                                if (vitals.temperature) historyParts.push(`Temp: ${vitals.temperature} °C`);
                                                if (vitals.weight) historyParts.push(`Weight: ${vitals.weight} kg`);
                                                if (vitals.respiratoryRate) historyParts.push(`RR: ${vitals.respiratoryRate} resp/min`);
                                                if (vitals.spo2) historyParts.push(`SpO2: ${vitals.spo2}%`);
                                            }

                                            setReferralData({
                                                ...referralData,
                                                diagnosis: diagStr || '',
                                                medicalHistory: historyParts.join('\n')
                                            });
                                        }
                                        setShowReferralModal(true);
                                    }}
                                    className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700 ml-2 transition shadow-sm font-semibold text-sm"
                                >
                                    <FaFileMedical /> {user.role === 'receptionist' ? 'View Referrals' : 'Referral'}
                                </button>
                            )
                        )}
                        {['doctor', 'nurse', 'receptionist', 'admin'].includes(user.role) &&
                            ['Outpatient', 'Emergency'].includes(encounter?.type) &&
                            isEncounterActive() &&
                            !viewingPastEncounter && (
                                <button
                                    onClick={() => setShowConvertModal(true)}
                                    className="bg-emerald-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-emerald-700 ml-2 transition shadow-sm font-semibold text-sm"
                                >
                                    <FaProcedures /> Admit Patient
                                </button>
                            )}
                    </div>
                )
            }

            {/* Main Content Info - Full Width */}
            <div className="flex flex-col">

                {/* Main Content */}
                <div className="w-full">
                    {!encounter && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
                            <p className="text-yellow-700">
                                No active encounter found. Patient may not have checked in or completed payment.
                            </p>
                        </div>
                    )}

                    {encounter && (
                        <div className="bg-white rounded shadow">
                            {encounter.hasUnpaidConsultation && user.role === 'doctor' ? (
                                <div className="p-8 text-center max-w-2xl mx-auto my-12 animate-fade-in">
                                    <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-red-100">
                                        <FaDollarSign size={40} className="animate-pulse" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-gray-800 mb-3">Encounter Access Locked</h3>
                                    <p className="text-gray-600 mb-6 leading-relaxed">
                                        This patient has unpaid consultation charges for the current encounter.
                                        Clinical access is restricted until payment is processed at the cashier.
                                    </p>
                                    <div className="bg-red-50 border border-red-100 rounded-lg p-4 mb-6 inline-block text-left">
                                        <p className="text-sm font-semibold text-red-800 flex items-center gap-2">
                                            <FaInfoCircle /> Required Action:
                                        </p>
                                        <p className="text-xs text-red-700 mt-1">
                                            Please direct the patient to the cashier to validate and pay their consultation fee. Once paid, this page will automatically unlock.
                                        </p>
                                    </div>
                                    <div>
                                        <button
                                            onClick={fetchPatient}
                                            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition shadow-sm flex items-center gap-2 mx-auto"
                                        >
                                            <FaClock /> Check Payment Status
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {/* Tab Navigation */}
                                    <div className="border-b flex">
                                        {/* Vitals & SOAP - Hidden for lab_technician, radiologist, and pharmacist */}
                                        {!['lab_technician', 'lab_scientist', 'radiologist', 'pharmacist'].includes(user.role) && (
                                            <>
                                                <button
                                                    onClick={() => setActiveTab('vitals')}
                                                    className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'vitals' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                                                >
                                                    <FaHeartbeat /> Nursing Triage
                                                </button>
                                                <button
                                                    onClick={() => setActiveTab('soap')}
                                                    className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'soap' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 hover:text-gray-800'}`}
                                                >
                                                    <FaNotesMedical /> Clinic Notes
                                                </button>
                                            </>
                                        )}

                                        {/* Lab Orders - Show for doctors, lab_technician, lab_scientist, and receptionist */}
                                        {!['radiologist', 'pharmacist'].includes(user.role) && (
                                            <button
                                                onClick={() => setActiveTab('lab')}
                                                className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'lab' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-gray-800'}`}
                                            >
                                                <FaVial /> Lab Orders ({currentLabOrders.length})
                                            </button>
                                        )}

                                        {/* Radiology - Show for doctors, radiologist, and receptionist */}
                                        {!['lab_technician', 'lab_scientist', 'pharmacist'].includes(user.role) && (
                                            <button
                                                onClick={() => setActiveTab('radiology')}
                                                className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'radiology' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-800'}`}
                                            >
                                                <FaXRay /> Radiology ({currentRadOrders.length})
                                            </button>
                                        )}

                                        {/* Prescriptions - Show for doctors, pharmacist, and receptionist */}
                                        {!['lab_technician', 'lab_scientist', 'radiologist'].includes(user.role) && (
                                            <button
                                                onClick={() => setActiveTab('prescriptions')}
                                                className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'prescriptions' ? 'border-b-2 border-pink-600 text-pink-600' : 'text-gray-600 hover:text-gray-800'}`}
                                            >
                                                <FaPills /> Prescriptions ({currentPrescriptions.length})
                                            </button>
                                        )}

                                        {/* Referrals Tab - Show for all users */}
                                        <button
                                            onClick={() => setActiveTab('referrals')}
                                            className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'referrals' ? 'border-b-2 border-orange-600 text-orange-600' : 'text-gray-600 hover:text-gray-800'}`}
                                        >
                                            <FaFileMedical /> Theatre Notes ({theatreNotes.length})
                                        </button>

                                        {/* Inpatient Notes Tab - formerly Other Notes, Ward Round, Theatre */}
                                        {['doctor', 'nurse', 'receptionist'].includes(user.role) && encounter?.type === 'Inpatient' && (
                                            <button
                                                onClick={() => setActiveTab('notes')}
                                                className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'notes' ? 'border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-800'}`}
                                            >
                                                <FaFileMedical /> Inpatient Notes ({clinicalNotes.length + wardRoundNotes.length + theatreNotes.length})
                                            </button>
                                        )}
                                    </div>

                                    {/* Tab Content */}
                                    <div className="p-6">
                                        {/* Vitals Tab */}
                                        {activeTab === 'vitals' && (
                                            <div>
                                                <h3 className="text-xl font-bold mb-4">Vital Signs & Nursing Assessment</h3>
                                                {vitals ? (
                                                    <div>
                                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 mb-4">
                                                            <div className="bg-blue-50 p-2 rounded text-center">
                                                                <p className="text-xs text-gray-600">Temp (Â°C)</p>
                                                                <p className={`font-bold ${getVitalColorClass('temperature', vitals.temperature)}`}>
                                                                    {vitals.temperature || '-'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-blue-50 p-2 rounded text-center">
                                                                <p className="text-xs text-gray-600">BP (mmHg)</p>
                                                                <p className={`font-bold ${getVitalColorClass('bloodPressure', vitals.bloodPressure)}`}>
                                                                    {vitals.bloodPressure || '-'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-blue-50 p-2 rounded text-center">
                                                                <p className="text-xs text-gray-600">HR (bpm)</p>
                                                                <p className={`font-bold ${getVitalColorClass('heartRate', vitals.heartRate || vitals.pulseRate)}`}>
                                                                    {vitals.heartRate || vitals.pulseRate || '-'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-blue-50 p-2 rounded text-center">
                                                                <p className="text-xs text-gray-600">RR (/min)</p>
                                                                <p className={`font-bold ${getVitalColorClass('respiratoryRate', vitals.respiratoryRate)}`}>
                                                                    {vitals.respiratoryRate || '-'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-blue-50 p-2 rounded text-center">
                                                                <p className="text-xs text-gray-600">SpO2 (%)</p>
                                                                <p className={`font-bold ${getVitalColorClass('spo2', vitals.spo2)}`}>
                                                                    {vitals.spo2 || '-'}
                                                                </p>
                                                            </div>
                                                            <div className="bg-blue-50 p-2 rounded text-center">
                                                                <p className="text-xs text-gray-600">Weight (kg)</p>
                                                                <p className="font-bold">{vitals.weight || '-'}</p>
                                                            </div>
                                                            <div className="bg-blue-50 p-2 rounded text-center">
                                                                <p className="text-xs text-gray-600">Height (cm)</p>
                                                                <p className="font-bold">{vitals.height || '-'}</p>
                                                            </div>
                                                            <div className={`p-2 rounded text-center ${vitals.bmi || (vitals.weight && vitals.height) ? (
                                                                (() => {
                                                                    const bmiValue = vitals.bmi || (vitals.weight / Math.pow(vitals.height / 100, 2));
                                                                    const b = parseFloat(bmiValue);
                                                                    return b < 18.5 ? 'bg-yellow-100 border border-yellow-300' :
                                                                        b < 25 ? 'bg-green-100 border border-green-300' :
                                                                            b < 30 ? 'bg-orange-100 border border-orange-300' :
                                                                                b < 35 ? 'bg-red-100 border border-red-300' :
                                                                                    b < 40 ? 'bg-red-200 border border-red-400' :
                                                                                        b < 50 ? 'bg-red-300 border border-red-500' :
                                                                                            'bg-purple-200 border border-purple-500';
                                                                })()
                                                            ) : 'bg-blue-50'
                                                                }`}>
                                                                <p className="text-xs text-gray-600">BMI (kg/m)</p>
                                                                <p className={`font-bold ${vitals.bmi || (vitals.weight && vitals.height) ? (
                                                                    (() => {
                                                                        const bmiValue = vitals.bmi || (vitals.weight / Math.pow(vitals.height / 100, 2));
                                                                        const b = parseFloat(bmiValue);
                                                                        return b < 18.5 ? 'text-yellow-700' :
                                                                            b < 25 ? 'text-green-700' :
                                                                                b < 30 ? 'text-orange-700' :
                                                                                    b < 35 ? 'text-red-700' :
                                                                                        b < 40 ? 'text-red-800' :
                                                                                            b < 50 ? 'text-red-900' :
                                                                                                'text-purple-700';
                                                                    })()
                                                                ) : ''
                                                                    }`}>
                                                                    {vitals.bmi ? vitals.bmi.toFixed(1) :
                                                                        (vitals.weight && vitals.height) ?
                                                                            (vitals.weight / Math.pow(vitals.height / 100, 2)).toFixed(1) :
                                                                            '-'}
                                                                </p>
                                                                {(vitals.bmi || (vitals.weight && vitals.height)) && (
                                                                    <p className="text-xs font-semibold mt-1">
                                                                        {(() => {
                                                                            const bmiValue = vitals.bmi || (vitals.weight / Math.pow(vitals.height / 100, 2));
                                                                            const b = parseFloat(bmiValue);
                                                                            return b < 18.5 ? 'Underweight' :
                                                                                b < 25 ? 'Normal' :
                                                                                    b < 30 ? 'Overweight' :
                                                                                        b < 35 ? 'Grade I Obese' :
                                                                                            b < 40 ? 'Grade II Obese' :
                                                                                                b < 50 ? 'Morbidly Obese' :
                                                                                                    'Super Obese';
                                                                        })()}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {vitals.nurse && (
                                                            <p className="text-xs text-gray-500 mt-2 italic">
                                                                Recorded by: {vitals.nurse.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-500">No vital signs recorded yet.</p>
                                                )}
                                                {encounter.nursingNotes && (() => {
                                                    try {
                                                        const notes = JSON.parse(encounter.nursingNotes);
                                                        if (Array.isArray(notes) && notes.length > 0) {
                                                            return (
                                                                <div className="bg-blue-50 p-4 rounded mt-4 border border-blue-200">
                                                                    <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                                                                        <FaNotesMedical className="text-blue-600" /> Nursing Notes
                                                                    </h4>
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full border-collapse border text-xs bg-white">
                                                                            <thead className="bg-gray-100">
                                                                                <tr>
                                                                                    <th className="p-2 text-left border">Service</th>
                                                                                    <th className="p-2 text-left border">Comment</th>
                                                                                    <th className="p-2 text-left border">Nurse</th>
                                                                                    <th className="p-2 text-left border">Time</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {notes.map((note, index) => (
                                                                                    <tr key={note.id || index} className="border-b hover:bg-gray-50">
                                                                                        <td className="p-2 border font-semibold text-blue-700">{note.service?.name || 'N/A'}</td>
                                                                                        <td className="p-2 border text-gray-700">{note.comment}</td>
                                                                                        <td className="p-2 border text-gray-600">{note.nurse?.name || 'Unknown'}</td>
                                                                                        <td className="p-2 border text-gray-600">
                                                                                            {new Date(note.createdAt).toLocaleString()}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            );
                                                        }
                                                    } catch (e) {
                                                        // If parsing fails or old format, show as plain text
                                                        return (
                                                            <div className="bg-gray-50 p-4 rounded mt-4">
                                                                <p className="text-sm font-semibold text-gray-700 mb-2">Nursing Notes:</p>
                                                                <p className="text-gray-800">{encounter.nursingNotes}</p>
                                                            </div>
                                                        );
                                                    }
                                                })()}

                                                {/* Drug Observation Chart (MAR) - For Inpatients */}
                                                {encounter.type === 'Inpatient' && (
                                                    <div className="mt-8 border rounded-lg overflow-hidden shadow-sm bg-white">
                                                        <div className="bg-blue-600 text-white p-3 flex justify-between items-center">
                                                            <h4 className="font-bold flex items-center gap-2">
                                                                <FaClock /> Drug Observation Chart
                                                            </h4>
                                                        </div>

                                                        <div className="p-4 bg-white">
                                                            {dispensedPrescriptions.length === 0 ? (
                                                                <div className="text-center py-6 text-gray-500 italic bg-gray-50 rounded border border-dashed">
                                                                    No dispensed medications found for this encounter.
                                                                </div>
                                                            ) : (
                                                                <div className="space-y-4">
                                                                    {(() => {
                                                                        const admissionDate = new Date(encounter.createdAt);
                                                                        admissionDate.setHours(0, 0, 0, 0);

                                                                        // Get all unique dates from history, and today
                                                                        const historyDates = [...new Set(administrationHistory.map(h => {
                                                                            const d = new Date(h.administeredAt);
                                                                            d.setHours(0, 0, 0, 0);
                                                                            return d.getTime();
                                                                        }))];

                                                                        const today = new Date();
                                                                        today.setHours(0, 0, 0, 0);
                                                                        if (!historyDates.includes(today.getTime())) {
                                                                            historyDates.push(today.getTime());
                                                                        }

                                                                        return historyDates.sort().reverse().map((dateTimestamp, idx) => {
                                                                            const currentDate = new Date(dateTimestamp);
                                                                            const diffTime = dateTimestamp - admissionDate.getTime();
                                                                            const dayNum = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                                                            const isExpanded = expandedDays[dateTimestamp] !== false;

                                                                            const dayHistory = administrationHistory.filter(h => {
                                                                                const d = new Date(h.administeredAt);
                                                                                d.setHours(0, 0, 0, 0);
                                                                                return d.getTime() === dateTimestamp;
                                                                            });

                                                                            const dayTimes = [...new Set(dayHistory.map(h =>
                                                                                new Date(h.administeredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                                                            ))].sort();

                                                                            return (
                                                                                <div key={dateTimestamp} className="border rounded mb-3 overflow-hidden">
                                                                                    <button
                                                                                        onClick={() => setExpandedDays(prev => ({ ...prev, [dateTimestamp]: !isExpanded }))}
                                                                                        className="w-full bg-gray-50 px-4 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between text-blue-900"
                                                                                    >
                                                                                        <div className="flex items-center gap-3">
                                                                                            {isExpanded ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
                                                                                            <span className="font-bold text-sm">Day {dayNum} <span className="text-gray-400 font-normal ml-2">({currentDate.toLocaleDateString('en-GB')})</span></span>
                                                                                            {dayNum === 1 && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">ADMISSION</span>}
                                                                                            {dateTimestamp === today.getTime() && <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold">TODAY</span>}
                                                                                        </div>
                                                                                        <div className="text-[10px] text-gray-500">
                                                                                            {dayHistory.length} Administrations recorded
                                                                                        </div>
                                                                                    </button>

                                                                                    {isExpanded && (
                                                                                        <div className="overflow-x-auto">
                                                                                            <table className="w-full text-xs text-left border-collapse">
                                                                                                <thead className="bg-gray-100 border-b">
                                                                                                    <tr>
                                                                                                        <th className="p-2 border-r font-bold text-gray-600 w-64">Medication</th>
                                                                                                        {dayTimes.length > 0 ? dayTimes.map(timeStr => (
                                                                                                            <th key={timeStr} className="p-2 border-r font-bold text-gray-600 text-center min-w-[70px]">
                                                                                                                {timeStr}
                                                                                                            </th>
                                                                                                        )) : (
                                                                                                            <th className="p-2 border-r font-bold text-gray-400 text-center italic">No records for this day</th>
                                                                                                        )}
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody>
                                                                                                    {(() => {
                                                                                                        let overallRowIdx = 0;
                                                                                                        return dispensedPrescriptions.flatMap(p => p.medicines.map(m => {
                                                                                                            const isFirstRow = overallRowIdx === 0;
                                                                                                            overallRowIdx++;
                                                                                                            return (
                                                                                                                <tr key={`${p._id}-${m._id || m.name}`} className="hover:bg-blue-50/10 border-b last:border-0 transition-colors">
                                                                                                                    <td className="p-2 border-r">
                                                                                                                        <div className="font-bold text-blue-950 leading-tight">{m.name}</div>
                                                                                                                        <div className="text-[9px] text-gray-500 flex items-center gap-1 mt-0.5">
                                                                                                                            <span className="font-medium text-gray-700">{m.dosage}</span>
                                                                                                                            <span>|</span>
                                                                                                                            <span className="font-medium text-gray-700">{m.frequency}</span>
                                                                                                                            {m.route && <><span className="text-orange-500 font-bold px-1 rounded uppercase bg-orange-50 text-[8px] border border-orange-100">{m.route}</span></>}
                                                                                                                        </div>
                                                                                                                    </td>
                                                                                                                    {dayTimes.map(timeStr => {
                                                                                                                        const admin = dayHistory.find(h =>
                                                                                                                            new Date(h.administeredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) === timeStr &&
                                                                                                                            (h.medicineId === m._id || h.medicineName === m.name)
                                                                                                                        );
                                                                                                                        return (
                                                                                                                            <td key={timeStr} className="p-2 border-r text-center">
                                                                                                                                {admin ? (
                                                                                                                                    <div className="inline-flex flex-col items-center justify-center p-1 rounded-md bg-green-50 border border-green-200 shadow-sm group relative cursor-help">
                                                                                                                                        <span className="font-black text-[8px] text-green-700 uppercase tracking-tighter">Given</span>
                                                                                                                                        <span className="text-[7px] text-green-600 leading-none">{getNurseFirstName(admin.nurse?.name)}</span>
                                                                                                                                        {isFirstRow ? (
                                                                                                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-gray-900 border border-gray-700 text-white p-2 rounded-lg text-[9px] hidden group-hover:block z-50 shadow-2xl backdrop-blur-sm text-left">
                                                                                                                                                <div className="font-bold mb-1" style={{ color: '#ffffff' }}>
                                                                                                                                                    Administered by: {admin.nurse?.name || 'Unknown'}
                                                                                                                                                </div>
                                                                                                                                                {admin.remarks && (
                                                                                                                                                    <div className="text-gray-300 break-words mt-1 border-t border-gray-700 pt-1">
                                                                                                                                                        Remarks: {admin.remarks}
                                                                                                                                                    </div>
                                                                                                                                                )}
                                                                                                                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                                                                                                                                            </div>
                                                                                                                                        ) : (
                                                                                                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 border border-gray-700 text-white p-2 rounded-lg text-[9px] hidden group-hover:block z-50 shadow-2xl backdrop-blur-sm text-left">
                                                                                                                                                <div className="font-bold mb-1" style={{ color: '#ffffff' }}>
                                                                                                                                                    Administered by: {admin.nurse?.name || 'Unknown'}
                                                                                                                                                </div>
                                                                                                                                                {admin.remarks && (
                                                                                                                                                    <div className="text-gray-300 break-words mt-1 border-t border-gray-700 pt-1">
                                                                                                                                                        Remarks: {admin.remarks}
                                                                                                                                                    </div>
                                                                                                                                                )}
                                                                                                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                                                                                                            </div>
                                                                                                                                        )}
                                                                                                                                    </div>
                                                                                                                                ) : <span className="text-gray-200">-</span>}
                                                                                                                            </td>
                                                                                                                        );
                                                                                                                    })}
                                                                                                                </tr>
                                                                                                            );
                                                                                                        }));
                                                                                                    })()}
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        });
                                                                    })()}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="p-3 bg-gray-50 text-[10px] text-gray-500 flex items-center gap-2 border-t italic">
                                                            <FaClock className="text-blue-400" /> This is a read-only view of the medication administration record.
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* SOAP Notes Tab */}
                                        {activeTab === 'soap' && (
                                            <div className="space-y-4">
                                                <div className="flex justify-between items-center">
                                                    <h3 className="text-xl font-bold">Clinical Documentation</h3>
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => { setEditingNoteId(null); setShowSoapModal(true); }}
                                                            className="px-4 py-2 rounded flex items-center gap-2 bg-green-600 text-white hover:bg-green-700"
                                                        >
                                                            <FaPlus /> Add Clinical Note
                                                        </button>
                                                    )}
                                                </div>

                                                {/* List of clinical notes */}
                                                {(() => {
                                                    const allNotes = encounter.clinicalNotes && encounter.clinicalNotes.length > 0
                                                        ? encounter.clinicalNotes
                                                        : [];
                                                    if (allNotes.length === 0) {
                                                        return (
                                                            <p className="text-gray-500">No clinical notes recorded yet. Click "Add Clinical Note" to begin documentation.</p>
                                                        );
                                                    }
                                                    return (
                                                        <div className="space-y-6">
                                                            {allNotes.map((note, noteIndex) => {
                                                                const noteId = note._id?.toString();
                                                                const noteDoctor = note.doctor;
                                                                const noteDoctorId = typeof noteDoctor === 'object' ? noteDoctor?._id?.toString() : noteDoctor?.toString();
                                                                const isNoteAuthor = noteDoctorId === user?._id;
                                                                const noteDoctorName = typeof noteDoctor === 'object' ? (noteDoctor?.name || 'Unknown') : (encounter.consultingPhysician?.name || 'Unknown');

                                                                return (
                                                                    <div key={noteId || noteIndex} className="border rounded-xl shadow-sm overflow-hidden">
                                                                        {/* Note Header */}
                                                                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-3 flex justify-between items-center">
                                                                            <div className="flex items-center gap-3">
                                                                                <div className="w-8 h-8 rounded-full bg-white text-blue-700 flex items-center justify-center font-bold text-sm">
                                                                                    {noteIndex + 1}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-semibold text-sm">Dr. {noteDoctorName}</p>
                                                                                    <p className="text-blue-200 text-xs">
                                                                                        {note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Date N/A'}
                                                                                        {note.updatedAt && note.updatedAt !== note.createdAt && (
                                                                                            <span className="ml-2">(updated {new Date(note.updatedAt).toLocaleString()})</span>
                                                                                        )}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                            {canEdit && isNoteAuthor && (
                                                                                <button
                                                                                    onClick={() => { setEditingNoteId(noteId); setShowSoapModal(true); }}
                                                                                    className="flex items-center gap-1 bg-white text-blue-700 px-3 py-1 rounded-lg text-sm font-semibold hover:bg-blue-50 transition"
                                                                                >
                                                                                    <FaEdit /> Edit
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        <div className="bg-white p-4 space-y-3">
                                                                            {/* Clinical History - Collapsible */}
                                                                            {(note.presentingComplaints || note.historyOfPresentingComplaint ||
                                                                                note.systemReview || note.pastMedicalSurgicalHistory ||
                                                                                note.socialFamilyHistory || note.drugsHistory ||
                                                                                note.functionalCognitiveStatus || note.menstruationGynecologicalObstetricsHistory ||
                                                                                note.pregnancyHistory || note.immunization ||
                                                                                note.nutritional || note.developmentalMilestones) && (
                                                                                    <div className="border rounded-lg overflow-hidden">
                                                                                        <button
                                                                                            onClick={() => setExpandedSections(prev => ({ ...prev, [`history_${noteId}`]: !prev[`history_${noteId}`] }))}
                                                                                            className="w-full bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 p-3 flex justify-between items-center transition-colors"
                                                                                        >
                                                                                            <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                                                                                <FaNotesMedical className="text-blue-600" /> Clinical History
                                                                                            </h4>
                                                                                            {expandedSections[`history_${noteId}`] ? <FaChevronUp className="text-gray-600" /> : <FaChevronDown className="text-gray-600" />}
                                                                                        </button>
                                                                                        {expandedSections[`history_${noteId}`] && (
                                                                                            <div className="p-4 space-y-3 bg-white">
                                                                                                {note.presentingComplaints && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">01. Presenting Complaints</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.presentingComplaints}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.historyOfPresentingComplaint && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">02. History of Presenting Complaint</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.historyOfPresentingComplaint}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.systemReview && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">03. System Review</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.systemReview}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.pastMedicalSurgicalHistory && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">04. Past Medical / Surgical History</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.pastMedicalSurgicalHistory}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.socialFamilyHistory && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">05. Social and Family History</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.socialFamilyHistory}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.drugsHistory && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">06. Drugs History</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.drugsHistory}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.functionalCognitiveStatus && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">07. Functional Cognitive Status</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.functionalCognitiveStatus}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.menstruationGynecologicalObstetricsHistory && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">08. Menstruation / Gyn / Obstetrics History</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.menstruationGynecologicalObstetricsHistory}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.pregnancyHistory && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">09. Pregnancy History</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.pregnancyHistory}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.immunization && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">10. Immunization</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.immunization}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.nutritional && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">11. Nutritional</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.nutritional}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                                {note.developmentalMilestones && (
                                                                                                    <div className="bg-gray-50 p-3 rounded border-l-4 border-gray-400">
                                                                                                        <p className="font-semibold text-gray-700 mb-1 text-sm">12. Developmental Milestones</p>
                                                                                                        <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.developmentalMilestones}</p>
                                                                                                    </div>
                                                                                                )}
                                                                                            </div>
                                                                                        )}
                                                                                    </div>
                                                                                )}

                                                                            {/* Physical Examination - Collapsible */}
                                                                            {(note.generalAppearance || note.heent || note.neck || note.cvs || note.resp || note.abd || note.neuro || note.msk || note.skin) && (
                                                                                <div className="border rounded-lg overflow-hidden">
                                                                                    <button
                                                                                        onClick={() => setExpandedSections(prev => ({ ...prev, [`physEx_${noteId}`]: !prev[`physEx_${noteId}`] }))}
                                                                                        className="w-full bg-gradient-to-r from-teal-100 to-teal-50 hover:from-teal-200 hover:to-teal-100 p-3 flex justify-between items-center transition-colors"
                                                                                    >
                                                                                        <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                                                                            <FaHeartbeat className="text-teal-600" /> Physical Examination
                                                                                        </h4>
                                                                                        {expandedSections[`physEx_${noteId}`] ? <FaChevronUp className="text-gray-600" /> : <FaChevronDown className="text-gray-600" />}
                                                                                    </button>
                                                                                    {expandedSections[`physEx_${noteId}`] && (
                                                                                        <div className="p-4 space-y-3 bg-white">
                                                                                            {note.generalAppearance && (
                                                                                                <div className="bg-teal-50 p-3 rounded border-l-4 border-teal-500">
                                                                                                    <p className="font-semibold text-gray-700 mb-1 text-sm">A. General Appearance</p>
                                                                                                    <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.generalAppearance}</p>
                                                                                                </div>
                                                                                            )}
                                                                                            {(note.heent || note.neck || note.cvs || note.resp || note.abd || note.neuro || note.msk || note.skin) && (
                                                                                                <div className="bg-teal-50 p-3 rounded border-l-4 border-teal-400">
                                                                                                    <p className="font-semibold text-gray-700 mb-2 text-sm">B. Systemic Examination</p>
                                                                                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                                                                                        {note.heent && <div><span className="font-semibold text-gray-600">HEENT: </span><span className="text-gray-800">{note.heent}</span></div>}
                                                                                                        {note.neck && <div><span className="font-semibold text-gray-600">Neck: </span><span className="text-gray-800">{note.neck}</span></div>}
                                                                                                        {note.cvs && <div><span className="font-semibold text-gray-600">CVS: </span><span className="text-gray-800">{note.cvs}</span></div>}
                                                                                                        {note.resp && <div><span className="font-semibold text-gray-600">Resp: </span><span className="text-gray-800">{note.resp}</span></div>}
                                                                                                        {note.abd && <div><span className="font-semibold text-gray-600">Abd: </span><span className="text-gray-800">{note.abd}</span></div>}
                                                                                                        {note.neuro && <div><span className="font-semibold text-gray-600">Neuro: </span><span className="text-gray-800">{note.neuro}</span></div>}
                                                                                                        {note.msk && <div><span className="font-semibold text-gray-600">MSK: </span><span className="text-gray-800">{note.msk}</span></div>}
                                                                                                        {note.skin && <div><span className="font-semibold text-gray-600">Skin: </span><span className="text-gray-800">{note.skin}</span></div>}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            {/* Assessment & Plan - Collapsible */}
                                                                            {(note.assessment || (note.diagnosis && note.diagnosis.length > 0) || note.plan) && (
                                                                                <div className="border rounded-lg overflow-hidden">
                                                                                    <button
                                                                                        onClick={() => setExpandedSections(prev => ({ ...prev, [`assess_${noteId}`]: !prev[`assess_${noteId}`] }))}
                                                                                        className="w-full bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 p-3 flex justify-between items-center transition-colors"
                                                                                    >
                                                                                        <h4 className="text-base font-bold text-gray-800 flex items-center gap-2">
                                                                                            <FaFileMedical className="text-green-600" /> Assessment & Plan
                                                                                        </h4>
                                                                                        {expandedSections[`assess_${noteId}`] ? <FaChevronUp className="text-gray-600" /> : <FaChevronDown className="text-gray-600" />}
                                                                                    </button>
                                                                                    {expandedSections[`assess_${noteId}`] && (
                                                                                        <div className="p-4 space-y-3 bg-white">
                                                                                            {(note.assessment || (note.diagnosis && note.diagnosis.length > 0)) && (
                                                                                                <div className="bg-blue-50 p-3 rounded border-l-4 border-blue-600">
                                                                                                    <p className="font-semibold text-gray-700 mb-2 text-sm">Assessment (Diagnosis):</p>
                                                                                                    {note.diagnosis && note.diagnosis.length > 0 && (
                                                                                                        <div className="mb-2 flex flex-wrap gap-2">
                                                                                                            {note.diagnosis.map((d, i) => (
                                                                                                                <span key={i} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium border border-blue-300">
                                                                                                                    {d.code} - {d.description}
                                                                                                                </span>
                                                                                                            ))}
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {note.assessment && <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.assessment}</p>}
                                                                                                </div>
                                                                                            )}
                                                                                            {note.plan && (
                                                                                                <div className="bg-green-50 p-3 rounded border-l-4 border-green-600">
                                                                                                    <p className="font-semibold text-gray-700 mb-1 text-sm">Plan:</p>
                                                                                                    <p className="text-gray-800 whitespace-pre-wrap text-sm">{note.plan}</p>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        )}


                                        {/* Lab Orders Tab */}
                                        {activeTab === 'lab' && (
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-xl font-bold">Lab Orders</h3>
                                                    {(user.role === 'doctor' || (['lab_technician', 'lab_scientist'].includes(user.role) && encounter?.type === 'External Investigation')) && (
                                                        <button
                                                            onClick={() => setShowLabModal(true)}
                                                            disabled={!canEdit}
                                                            className={`px-4 py-2 rounded flex items-center gap-2 ${!canEdit ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                                                        >
                                                            <FaPlus /> Add Lab Order
                                                        </button>
                                                    )}
                                                </div>
                                                {currentLabOrders.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {currentLabOrders.map(order => (
                                                            <div key={order._id} className="bg-purple-50 p-4 rounded border">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1">
                                                                        <p className="font-semibold text-lg">{order.testName}</p>
                                                                        <p className="text-sm text-gray-600">Ordered: {new Date(order.createdAt).toLocaleString()}</p>
                                                                        {order.clinicalDetails && (
                                                                            <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-400 text-xs italic">
                                                                                <span className="font-bold text-blue-800 not-italic">Clinical Detail: </span>
                                                                                {order.clinicalDetails}
                                                                            </div>
                                                                        )}
                                                                        {order.result ? (
                                                                            <details className="mt-2" open={!order.approvedBy}>
                                                                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-semibold flex items-center gap-2">
                                                                                    {order.approvedBy ? (
                                                                                        <>View Official Results</>
                                                                                    ) : (
                                                                                        <>
                                                                                            <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-[10px] font-bold border border-orange-200">
                                                                                                PRELIMINARY
                                                                                            </span>
                                                                                            View Early Results
                                                                                        </>
                                                                                    )}
                                                                                </summary>
                                                                                {!order.approvedBy && (
                                                                                    <div className="mt-2 p-2 bg-orange-50 border-l-4 border-orange-400 text-xs text-orange-800 italic">
                                                                                        <FaInfoCircle className="inline mr-1" />
                                                                                        These results have been entered but not yet formally reviewed and approved by a Lab Scientist.
                                                                                    </div>
                                                                                )}
                                                                                <div className="mt-2 p-3 bg-white rounded border text-sm">
                                                                                    {(() => {
                                                                                        try {
                                                                                            const parsed = JSON.parse(order.result);
                                                                                            if (parsed.format === 'table' && Array.isArray(parsed.parameters)) {
                                                                                                return (
                                                                                                    <div className="overflow-x-auto">
                                                                                                        <table className="w-full border-collapse">
                                                                                                            <thead className="bg-gray-100 text-xs text-gray-700">
                                                                                                                <tr>
                                                                                                                    <th className="text-left p-2 font-semibold border">Parameter</th>
                                                                                                                    <th className="text-left p-2 font-semibold border w-24">Value</th>
                                                                                                                    <th className="text-left p-2 font-semibold border w-16">Unit</th>
                                                                                                                    <th className="text-left p-2 font-semibold border w-32">Normal</th>
                                                                                                                    <th className="text-center p-2 font-semibold border w-20">Status</th>
                                                                                                                </tr>
                                                                                                            </thead>
                                                                                                            <tbody className="text-xs">
                                                                                                                {parsed.parameters.map((param, index) => {
                                                                                                                    const rangeStatus = checkRange(param.value, param.normalRange);
                                                                                                                    const colorClass = getRangeColorClass(rangeStatus);

                                                                                                                    return (
                                                                                                                        <tr key={index} className={`${param.value ? colorClass : ''} border`}>
                                                                                                                            <td className="p-2 font-medium border">{param.name}</td>
                                                                                                                            <td className="p-2 font-semibold border">{param.value || '-'}</td>
                                                                                                                            <td className="p-2 text-gray-600 border">{param.unit}</td>
                                                                                                                            <td className="p-2 text-gray-600 border">{param.normalRange}</td>
                                                                                                                            <td className="p-2 text-center border">
                                                                                                                                {param.value && (
                                                                                                                                    <span className={`text-[10px] px-1 py-0.5 rounded font-bold ${rangeStatus === 'low' ? 'bg-orange-200 text-orange-900 border border-orange-300' :
                                                                                                                                        rangeStatus === 'high' ? 'bg-red-200 text-red-900 border border-red-300' :
                                                                                                                                            'bg-green-200 text-green-900 border border-green-300'
                                                                                                                                        }`}>
                                                                                                                                        {rangeStatus === 'low' ? 'LOW' :
                                                                                                                                            rangeStatus === 'high' ? 'HIGH' :
                                                                                                                                                'NORMAL'}
                                                                                                                                    </span>
                                                                                                                                )}
                                                                                                                            </td>
                                                                                                                        </tr>
                                                                                                                    );
                                                                                                                })}
                                                                                                            </tbody>
                                                                                                        </table>
                                                                                                    </div>
                                                                                                );
                                                                                            }
                                                                                        } catch (e) {
                                                                                            // Fallback to text
                                                                                        }
                                                                                        return <pre className="whitespace-pre-wrap font-mono">{order.result}</pre>;
                                                                                    })()}
                                                                                </div>
                                                                            </details>
                                                                        ) : null}
                                                                    </div>
                                                                    <div className="flex gap-2 ml-4">
                                                                        <span className={`text-xs px-3 py-1 rounded ${order.charge?.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                                            {order.charge?.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                                        </span>
                                                                        <span className={`text-xs px-3 py-1 rounded font-bold uppercase tracking-wider ${order.status === 'completed'
                                                                            ? (order.approvedBy ? 'bg-green-600 text-white' : 'bg-blue-200 text-blue-800')
                                                                            : order.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-gray-200 text-gray-600'}`}>
                                                                            {order.status === 'completed' ? (order.approvedBy ? 'Approved' : 'Review Pending') : order.status}
                                                                        </span>
                                                                        {canEdit && (user.role === 'admin' || order.doctor === user._id || order.doctor?._id === user._id) && order.status !== 'completed' && order.charge?.status !== 'paid' && (
                                                                            <button
                                                                                onClick={() => handleDeleteOrder('lab', order._id)}
                                                                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                                                                title="Delete Order"
                                                                            >
                                                                                <FaTrash />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {order.approvedBy && (
                                                                    <div className="mt-2 pt-2 border-t flex justify-between items-end">
                                                                        <div className="text-[10px] text-gray-500 italic">
                                                                            <p>Result by: {order.signedBy?.name}</p>
                                                                            <p>Approved by: {order.approvedBy.name}</p>
                                                                        </div>
                                                                        <button
                                                                            type="button"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleUniversalPrint(order);
                                                                            }}
                                                                            className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                                                                            title="Print Report"
                                                                        >
                                                                            <FaFileAlt />
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-500">No lab orders yet. Click "Add Lab Order" to order tests.</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Radiology Orders Tab */}
                                        {activeTab === 'radiology' && (
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-xl font-bold">Radiology Orders</h3>
                                                    <button
                                                        onClick={() => setShowRadModal(true)}
                                                        disabled={!canEdit}
                                                        className={`px-4 py-2 rounded flex items-center gap-2 ${!canEdit ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                                    >
                                                        <FaPlus /> Add Radiology Order
                                                    </button>
                                                </div>
                                                {currentRadOrders.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {currentRadOrders.map(order => (
                                                            <div key={order._id} className="bg-indigo-50 p-4 rounded border">
                                                                <div className="flex justify-between items-start">
                                                                    <div className="flex-1">
                                                                        <p className="font-semibold text-lg">{order.scanType}</p>
                                                                        <p className="text-sm text-gray-600">Ordered: {new Date(order.createdAt).toLocaleString()}</p>
                                                                        {order.report && (
                                                                            <details className="mt-2">
                                                                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-semibold">
                                                                                    View Report
                                                                                </summary>
                                                                                <div className="mt-2 p-3 bg-white rounded border text-sm whitespace-pre-wrap font-mono">
                                                                                    {order.report}
                                                                                </div>

                                                                                {/* Display uploaded images */}
                                                                                {order.images && order.images.length > 0 && (
                                                                                    <div className="mt-3">
                                                                                        <p className="font-semibold text-sm mb-2 text-indigo-700">Attached Images:</p>
                                                                                        <div className="grid grid-cols-2 gap-3">
                                                                                            {order.images.map((img, index) => (
                                                                                                <div key={index} className="border rounded p-2 bg-gray-50">
                                                                                                    <p className="font-semibold text-xs mb-1 text-blue-600">{img.name}</p>
                                                                                                    <img
                                                                                                        src={`${backendUrl}/${img.path}`}
                                                                                                        alt={img.name}
                                                                                                        className="w-full h-32 object-contain bg-white rounded cursor-pointer hover:opacity-80 border"
                                                                                                        onClick={() => window.open(`${backendUrl}/${img.path}`, '_blank')}
                                                                                                        title="Click to view full size"
                                                                                                    />
                                                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                                                        {new Date(img.uploadedAt).toLocaleString()}
                                                                                                    </p>
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                )}

                                                                                {/* Legacy image URL support */}
                                                                                {order.resultImage && (
                                                                                    <div className="mt-2">
                                                                                        <a href={order.resultImage} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                                                                                            View Image (Legacy)
                                                                                        </a>
                                                                                    </div>
                                                                                )}
                                                                            </details>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-2 ml-4">
                                                                        <span className={`text-xs px-3 py-1 rounded ${order.charge?.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                                            {order.charge?.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                                        </span>
                                                                        <span className={`text-xs px-3 py-1 rounded ${order.status === 'completed' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                                                                            {order.status}
                                                                        </span>
                                                                        {canEdit && (user.role === 'admin' || order.doctor === user._id || order.doctor?._id === user._id) && order.status !== 'completed' && order.charge?.status !== 'paid' && (
                                                                            <button
                                                                                onClick={() => handleDeleteOrder('radiology', order._id)}
                                                                                className="p-1.5 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                                                                title="Delete Order"
                                                                            >
                                                                                <FaTrash />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {order.signedBy && (
                                                                    <p className="text-xs text-gray-500 mt-2 italic border-t pt-2">
                                                                        Report by: {order.signedBy.name}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-500">No radiology orders yet. Click "Add Radiology Order" to order imaging studies.</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Prescriptions Tab */}
                                        {activeTab === 'prescriptions' && (
                                            <div>
                                                <div className="flex justify-between items-center mb-4">
                                                    <h3 className="text-xl font-bold">Prescriptions</h3>
                                                    <button
                                                        onClick={() => setShowRxModal(true)}
                                                        disabled={!canEdit}
                                                        className={`px-4 py-2 rounded flex items-center gap-2 ${!canEdit ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-pink-600 text-white hover:bg-pink-700'}`}
                                                    >
                                                        <FaPlus /> Add Prescription
                                                    </button>
                                                </div>

                                                {currentPrescriptions.length > 0 ? (
                                                    <div className="space-y-3">
                                                        {/* Group prescriptions by date and sort by latest first */}
                                                        {Object.entries(
                                                            currentPrescriptions.reduce((acc, rx) => {
                                                                const date = new Date(rx.createdAt).toLocaleDateString('en-CA'); // Use ISO-like format YYYY-MM-DD for sorting
                                                                if (!acc[date]) acc[date] = [];
                                                                acc[date].push(rx);
                                                                return acc;
                                                            }, {})
                                                        )
                                                            .sort(([dateA], [dateB]) => new Date(dateB) - new Date(dateA)) // Sort dates descending (newest first)
                                                            .map(([date, prescriptions]) => (
                                                                <div key={date} className="border rounded-lg overflow-hidden">
                                                                    {/* Day Header - Collapsible */}
                                                                    <button
                                                                        onClick={() => {
                                                                            const newExpandedDays = { ...expandedDays };
                                                                            newExpandedDays[date] = !newExpandedDays[date];
                                                                            setExpandedDays(newExpandedDays);
                                                                        }}
                                                                        className="w-full bg-pink-100 hover:bg-pink-200 p-4 flex justify-between items-center transition-colors"
                                                                    >
                                                                        <div className="flex items-center gap-3">
                                                                            <span className={`transform transition-transform ${expandedDays[date] ? 'rotate-180' : ''}`}>
                                                                                <FaChevronDown />
                                                                            </span>
                                                                            <h4 className="font-semibold text-lg">
                                                                                {new Date(date).toLocaleDateString('en-US', {
                                                                                    weekday: 'long',
                                                                                    year: 'numeric',
                                                                                    month: 'long',
                                                                                    day: 'numeric'
                                                                                })}
                                                                            </h4>
                                                                            <span className="bg-pink-600 text-white text-xs px-2 py-1 rounded-full">
                                                                                {prescriptions.length} prescription{prescriptions.length > 1 ? 's' : ''}
                                                                            </span>
                                                                        </div>
                                                                        <FaChevronDown className={`transform transition-transform ${expandedDays[date] ? 'rotate-180' : ''}`} />
                                                                    </button>

                                                                    {/* Prescriptions List - Collapsible Content */}
                                                                    {expandedDays[date] && (
                                                                        <div className="bg-white divide-y">
                                                                            {prescriptions
                                                                                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) // Sort prescriptions within day (newest first)
                                                                                .map(rx => (
                                                                                    <div key={rx._id} className="p-4 hover:bg-gray-50 transition-colors">
                                                                                        <div className="flex justify-between items-start">
                                                                                            <div className="flex-1">
                                                                                                {rx.medicines.map((med, idx) => (
                                                                                                    <div key={idx} className="mb-3 last:mb-0">
                                                                                                        <p className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                                                                                                            {med.name}
                                                                                                            {med.buyOutside && (
                                                                                                                <span className="text-[10px] bg-orange-100 text-orange-800 px-2 py-0.5 rounded border border-orange-200">
                                                                                                                    BUY OUTSIDE
                                                                                                                </span>
                                                                                                            )}
                                                                                                        </p>
                                                                                                        <div className="text-sm text-gray-600 space-y-1 mt-1">
                                                                                                            <p><span className="font-medium">Dosage:</span> {med.dosage}</p>
                                                                                                            <p><span className="font-medium">Frequency:</span> {med.frequency}</p>
                                                                                                            <p><span className="font-medium">Duration:</span> {(med.duration && !isNaN(med.duration)) ? `${med.duration} days` : med.duration}</p>
                                                                                                            {med.instructions && (
                                                                                                                <p><span className="font-medium">Instructions:</span> {med.instructions}</p>
                                                                                                            )}
                                                                                                        </div>
                                                                                                    </div>
                                                                                                ))}
                                                                                                <p className="text-xs text-gray-500 mt-2">
                                                                                                    Prescribed at: {new Date(rx.createdAt).toLocaleString()}
                                                                                                </p>
                                                                                            </div>
                                                                                            <div className="flex flex-col gap-2 ml-4">
                                                                                                <span className={`text-xs px-3 py-1 rounded text-center ${rx.charge?.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                                                                    {rx.charge?.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                                                                </span>
                                                                                                <span className={`text-xs px-3 py-1 rounded text-center ${rx.status === 'dispensed' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                                                                                                    {rx.status}
                                                                                                </span>
                                                                                                {canEdit && (user.role === 'admin' || rx.doctor === user._id || rx.doctor?._id === user._id) && rx.status !== 'dispensed' && rx.charge?.status !== 'paid' && (
                                                                                                    <button
                                                                                                        onClick={() => handleDeleteOrder('prescription', rx._id)}
                                                                                                        className="p-1.5 text-red-600 hover:bg-red-100 rounded-full transition-colors"
                                                                                                        title="Delete Prescription"
                                                                                                    >
                                                                                                        <FaTrash />
                                                                                                    </button>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                        {rx.dispensedBy && (
                                                                                            <p className="text-xs text-gray-500 mt-2 italic border-t pt-2">
                                                                                                Dispensed by: {rx.dispensedBy.name}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-gray-500">No prescriptions yet. Click "Add Prescription" to prescribe medications.</p>
                                                )}
                                            </div>
                                        )}

                                        {/* Operation/Theater Tab */}
                                        {activeTab === 'referrals' && (
                                            <div className="p-6">
                                                <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
                                                    <h3 className="text-xl font-bold text-gray-800">Operation / Theater</h3>
                                                    <div className="flex flex-wrap gap-2">
                                                        {user.role === 'doctor' && (() => {
                                                            if (theatreNotes.length > 0) {
                                                                return (
                                                                    <span className="px-4 py-2 rounded flex items-center gap-2 text-sm bg-green-100 text-green-700 border border-green-400 font-semibold cursor-default">
                                                                        <FaCheckCircle /> Theatre Note ✓
                                                                    </span>
                                                                );
                                                            }
                                                            const prereqsMet = consents.length > 0 && checklists.length > 0 && preAnaesthesiaChecklists.length > 0;
                                                            const isDisabled = !canEdit || !prereqsMet;
                                                            const title = !prereqsMet
                                                                ? `Required before adding operation note:\n${consents.length === 0 ? '• Consent note\n' : ''}${checklists.length === 0 ? '• Anes. Med. Equip checklist\n' : ''}${preAnaesthesiaChecklists.length === 0 ? '• Pre-Anaesthesia checklist' : ''}`
                                                                : '';
                                                            return (
                                                                <button
                                                                    onClick={() => { setTheatreNoteForm({ ...emptyTheatreNote }); setEditingTheatreNote(null); setShowTheatreModal(true); }}
                                                                    disabled={isDisabled}
                                                                    title={title}
                                                                    className={`px-4 py-2 rounded flex items-center gap-2 text-sm ${isDisabled ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-red-700 text-white hover:bg-red-800'}`}
                                                                >
                                                                    <FaPlus /> Add Theatre Note
                                                                </button>
                                                            );
                                                        })()}
                                                        {['doctor', 'nurse', 'receptionist', 'admin'].includes(user.role) && (
                                                            consents.length > 0 ? (
                                                                <span className="px-4 py-2 rounded flex items-center gap-2 text-sm bg-green-100 text-green-700 border border-green-400 font-semibold cursor-default">
                                                                    <FaCheckCircle /> Consent note ✓
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleOpenConsentModal(null)}
                                                                    disabled={!canEditNurse}
                                                                    className={`px-4 py-2 rounded flex items-center gap-2 text-sm ${!canEditNurse ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                                                                >
                                                                    <FaPlus /> Consent note
                                                                </button>
                                                            )
                                                        )}
                                                        {['doctor', 'nurse'].includes(user.role) && (
                                                            checklists.length > 0 ? (
                                                                <span className="px-4 py-2 rounded flex items-center gap-2 text-sm bg-green-100 text-green-700 border border-green-400 font-semibold cursor-default">
                                                                    <FaCheckCircle /> Anes. Med. Equip ✓
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { setChecklistForm({ ...emptyChecklistForm, filledBy: user.name || '' }); setEditingChecklist(null); setShowChecklistModal(true); }}
                                                                    disabled={!canEditNurse}
                                                                    className={`px-4 py-2 rounded flex items-center gap-2 text-sm ${!canEditNurse ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                                                                >
                                                                    <FaPlus /> Anes. Med. Equip
                                                                </button>
                                                            )
                                                        )}
                                                        {['doctor', 'nurse'].includes(user.role) && (
                                                            preAnaesthesiaChecklists.length > 0 ? (
                                                                <span className="px-4 py-2 rounded flex items-center gap-2 text-sm bg-green-100 text-green-700 border border-green-400 font-semibold cursor-default">
                                                                    <FaCheckCircle /> Pre-Anaes. ✓
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { setPreAnaesthesiaForm({ ...emptyPreAnaesthesiaForm, firstName: patient?.name?.split(' ')[0] || '', lastName: patient?.name?.split(' ').slice(1).join(' ') || '', patientMRN: patient?.mrn || '', filledBy: user.name || '' }); setEditingPreAnaesthesiaChecklist(null); setShowPreAnaesthesiaModal(true); }}
                                                                    disabled={!canEditNurse}
                                                                    className={`px-4 py-2 rounded flex items-center gap-2 text-sm ${!canEditNurse ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-teal-600 text-white hover:bg-teal-700'}`}
                                                                >
                                                                    <FaPlus /> Pre-Anaes.
                                                                </button>
                                                            )
                                                        )}
                                                        {['doctor', 'nurse'].includes(user.role) && (
                                                            postoperativeHandoverChecklists.length > 0 ? (
                                                                <span className="px-4 py-2 rounded flex items-center gap-2 text-sm bg-green-100 text-green-700 border border-green-400 font-semibold cursor-default">
                                                                    <FaCheckCircle /> Post-Op Handover ✓
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    onClick={() => {
                                                                        setPostoperativeHandoverForm({
                                                                            ...emptyPostoperativeHandoverForm,
                                                                            patientNumber: patient?.mrn || '',
                                                                            firstName: patient?.name?.split(' ')[0] || '',
                                                                            lastName: patient?.name?.split(' ').slice(1).join(' ') || '',
                                                                            age: patient?.age || '',
                                                                            filledBy: user.name || ''
                                                                        });
                                                                        setEditingPostoperativeHandoverChecklist(null);
                                                                        setShowPostoperativeHandoverModal(true);
                                                                    }}
                                                                    disabled={!canEditNurse || theatreNotes.length === 0}
                                                                    title={theatreNotes.length === 0 ? 'Required before adding postoperative handover:\n• Theatre Note' : ''}
                                                                    className={`px-4 py-2 rounded flex items-center gap-2 text-sm ${(!canEditNurse || theatreNotes.length === 0) ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
                                                                >
                                                                    <FaPlus /> Post-Op Handover
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Theatre Operation Notes Section */}
                                                <div className="mb-8 font-sans">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FaProcedures className="text-red-600" />
                                                        <h4 className="text-base font-bold text-red-700">Theatre Operation Notes</h4>
                                                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">{theatreNotes.length}</span>
                                                    </div>
                                                    {theatreNotes.length > 0 ? (
                                                        <div className="space-y-5">
                                                            {[...theatreNotes].reverse().map((note, idx) => (
                                                                <div key={idx} className="border border-red-200 rounded-lg overflow-hidden bg-white mb-6">
                                                                    <div className="bg-red-700 text-white px-5 py-3 flex justify-between items-center">
                                                                        <div>
                                                                            <p className="font-bold">{note.procedurePerformed || 'Operation Note'}</p>
                                                                            <p className="text-xs opacity-80">
                                                                                {note.dateOfSurgery ? new Date(note.dateOfSurgery).toLocaleDateString() : 'Date N/A'}
                                                                            </p>
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-xs px-3 py-1 rounded-full font-bold bg-blue-300 text-blue-900">{note.status || 'Completed'}</span>
                                                                            {canEdit && (
                                                                                <button
                                                                                    onClick={() => { setTheatreNoteForm({ ...note }); setEditingTheatreNote(note._id); setShowTheatreModal(true); }}
                                                                                    className="text-white hover:text-yellow-300 transition" title="Edit"
                                                                                >
                                                                                    <FaEdit />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white divide-y divide-gray-100">
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Diagnosis (Pre-op)</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.preOperativeDiagnosis || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Diagnosis (Operative)</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.postOperativeDiagnosis || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Operative</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.procedurePerformed || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Surgeon</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.leadSurgeon || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Assistant(s)</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.assistantSurgeons || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Anaesthetist</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.anaesthetist || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Anaesthetic</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.anaesthesiaType || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Scrub Nurse</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.scrubNurse || 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3 grid grid-cols-3 gap-2 border-b">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Date</span>
                                                                            <span className="text-sm text-gray-800 col-span-2">{note.dateOfSurgery ? new Date(note.dateOfSurgery).toLocaleDateString() : 'N/A'}</span>
                                                                        </div>
                                                                        <div className="p-3">
                                                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">Findings:</span>
                                                                            <div className="text-sm text-gray-800 whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200 min-h-[80px]">{note.operativeFindings || 'No findings recorded.'}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-gray-50 px-4 py-2 text-xs text-gray-400 flex justify-between border-t">
                                                                        <span>Created by: {note.createdBy} — {note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}</span>
                                                                        {note.updatedBy && <span>Updated by: {note.updatedBy} — {note.updatedAt ? new Date(note.updatedAt).toLocaleString() : ''}</span>}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 italic mb-6">No theatre operation notes recorded yet.</p>
                                                    )}
                                                </div>

                                                {/* Surgical Consents Section */}
                                                <div className="mb-8 font-sans">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FaFileMedical className="text-emerald-600" />
                                                        <h4 className="text-base font-bold text-emerald-700">Surgical Consents</h4>
                                                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">{consents.length}</span>
                                                    </div>
                                                    {consents.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {consents.map(consent => (
                                                                <div key={consent._id} className="border border-emerald-200 rounded-lg overflow-hidden bg-white p-4 flex justify-between items-center">
                                                                    <div>
                                                                        <p className="font-bold text-gray-800 text-sm">{consent.procedureName || 'Surgical Consent'}</p>
                                                                        <p className="text-xs text-gray-600 mt-1">
                                                                            Patient: <span className="font-semibold">{consent.patientName}</span> |
                                                                            Physician: <span className="font-semibold">{consent.physicianName}</span> |
                                                                            Date: <span className="font-semibold">{consent.consentDate ? new Date(consent.consentDate).toLocaleDateString() : 'N/A'}</span>
                                                                        </p>
                                                                        <div className="mt-2">
                                                                            {consent.uploadedFile ? (
                                                                                <span className="text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                                                                                    Uploaded File
                                                                                </span>
                                                                            ) : (
                                                                                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                                                                    Digitally Signed
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => handleOpenConsentModal(consent)}
                                                                            className="text-emerald-600 hover:text-emerald-800 flex items-center gap-1 px-3 py-2 border border-emerald-600 rounded hover:bg-emerald-50 text-xs font-semibold"
                                                                        >
                                                                            <FaEdit /> Edit / View
                                                                        </button>
                                                                        <button
                                                                            onClick={() => printConsentFromData(consent)}
                                                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-2 border border-blue-600 rounded hover:bg-blue-50 text-xs font-semibold"
                                                                        >
                                                                            <FaFileMedical /> Print
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 italic mb-6">No surgical consents recorded yet.</p>
                                                    )}
                                                </div>

                                                {/* Equipment & Anaesthesia Checklists Section */}
                                                <div className="mb-8 font-sans">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FaCheckCircle className="text-indigo-600" />
                                                        <h4 className="text-base font-bold text-indigo-700">Anaesthetic & Equipment Checklists</h4>
                                                        <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">{checklists.length}</span>
                                                    </div>
                                                    {checklists.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {checklists.map((chk) => (
                                                                <div key={chk._id} className="border border-indigo-200 rounded-lg overflow-hidden bg-white p-4 flex justify-between items-center shadow-sm hover:shadow transition">
                                                                    <div>
                                                                        <p className="font-bold text-gray-800 text-sm">Anaesthetic Machine/Medication & Equipment Checklist</p>
                                                                        <p className="text-xs text-gray-600 mt-1">
                                                                            Filled by: <span className="font-semibold">{chk.filledBy}</span> |
                                                                            Date: <span className="font-semibold">{chk.filledAt ? new Date(chk.filledAt).toLocaleString() : 'N/A'}</span>
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                setChecklistForm({ ...chk });
                                                                                setEditingChecklist(chk._id);
                                                                                setShowChecklistModal(true);
                                                                            }}
                                                                            className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-3 py-2 border border-indigo-600 rounded hover:bg-indigo-50 text-xs font-semibold"
                                                                        >
                                                                            <FaEdit /> Edit / View
                                                                        </button>
                                                                        <button
                                                                            onClick={() => printChecklistFromData(chk)}
                                                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-2 border border-blue-600 rounded hover:bg-blue-50 text-xs font-semibold"
                                                                        >
                                                                            <FaPrint /> Print
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 italic mb-6">No checklists recorded yet.</p>
                                                    )}
                                                </div>

                                                {/* Pre-Anaesthesia Checklists Section */}
                                                <div className="mb-8 font-sans">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FaCheckCircle className="text-teal-600" />
                                                        <h4 className="text-base font-bold text-teal-700">Pre-Anaesthesia Checklists</h4>
                                                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">{preAnaesthesiaChecklists.length}</span>
                                                    </div>
                                                    {preAnaesthesiaChecklists.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {preAnaesthesiaChecklists.map((chk) => (
                                                                <div key={chk._id} className="border border-teal-200 rounded-lg bg-white p-4 flex justify-between items-center shadow-sm hover:shadow transition">
                                                                    <div>
                                                                        <p className="font-bold text-gray-800 text-sm">Pre-Anaesthesia Checklist</p>
                                                                        <p className="text-xs text-gray-600 mt-1">
                                                                            Patient: <span className="font-semibold">{chk.firstName} {chk.lastName}</span> |
                                                                            Filled by: <span className="font-semibold">{chk.filledBy}</span> |
                                                                            Date: <span className="font-semibold">{chk.filledAt ? new Date(chk.filledAt).toLocaleString() : 'N/A'}</span>
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => { setPreAnaesthesiaForm({ ...chk }); setEditingPreAnaesthesiaChecklist(chk._id); setShowPreAnaesthesiaModal(true); }}
                                                                            className="text-teal-600 hover:text-teal-800 flex items-center gap-1 px-3 py-2 border border-teal-600 rounded hover:bg-teal-50 text-xs font-semibold"
                                                                        >
                                                                            <FaEdit /> Edit / View
                                                                        </button>
                                                                        <button
                                                                            onClick={() => printPreAnaesthesiaChecklist(chk)}
                                                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-2 border border-blue-600 rounded hover:bg-blue-50 text-xs font-semibold"
                                                                        >
                                                                            <FaPrint /> Print
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 italic mb-6">No pre-anaesthesia checklists recorded yet.</p>
                                                    )}
                                                </div>

                                                {/* Postoperative Handover Checklists Section */}
                                                <div className="mb-8 font-sans">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FaCheckCircle className="text-purple-600" />
                                                        <h4 className="text-base font-bold text-purple-700">Postoperative Handover Checklists</h4>
                                                        <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-semibold">{postoperativeHandoverChecklists.length}</span>
                                                    </div>
                                                    {postoperativeHandoverChecklists.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {postoperativeHandoverChecklists.map((chk) => (
                                                                <div key={chk._id} className="border border-purple-200 rounded-lg bg-white p-4 flex justify-between items-center shadow-sm hover:shadow transition">
                                                                    <div>
                                                                        <p className="font-bold text-gray-800 text-sm">Postoperative Handover Checklist</p>
                                                                        <p className="text-xs text-gray-600 mt-1">
                                                                            Patient: <span className="font-semibold">{chk.firstName} {chk.lastName}</span> |
                                                                            Filled by: <span className="font-semibold">{chk.filledBy}</span> |
                                                                            Date: <span className="font-semibold">{chk.filledAt ? new Date(chk.filledAt).toLocaleString() : 'N/A'}</span>
                                                                        </p>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => { setPostoperativeHandoverForm({ ...chk }); setEditingPostoperativeHandoverChecklist(chk._id); setShowPostoperativeHandoverModal(true); }}
                                                                            className="text-purple-600 hover:text-purple-800 flex items-center gap-1 px-3 py-2 border border-purple-600 rounded hover:bg-purple-50 text-xs font-semibold"
                                                                        >
                                                                            <FaEdit /> Edit / View
                                                                        </button>
                                                                        <button
                                                                            onClick={() => printPostoperativeHandoverChecklist(chk)}
                                                                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-2 border border-blue-600 rounded hover:bg-blue-50 text-xs font-semibold"
                                                                        >
                                                                            <FaPrint /> Print
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 italic mb-6">No postoperative handover checklists recorded yet.</p>
                                                    )}
                                                </div>


                                            </div>
                                        )}

                                        {/* Inpatient Notes Tab - unified tab for ward round notes & theatre operation notes */}
                                        {activeTab === 'notes' && (
                                            <div>
                                                {/* Header: title + action buttons */}
                                                <div className="flex flex-wrap justify-between items-center mb-5 gap-3">
                                                    <h3 className="text-xl font-bold text-gray-800">Inpatient Notes</h3>
                                                    <div className="flex flex-wrap gap-2">

                                                        {/* Add Ward Round Note button â€” doctors & nurses */}
                                                        {['doctor', 'nurse'].includes(user.role) && (
                                                            <button
                                                                onClick={() => setShowWardRoundModal(true)}
                                                                disabled={!canEdit}
                                                                className={`px-4 py-2 rounded flex items-center gap-2 text-sm ${!canEdit ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-teal-600 text-white hover:bg-teal-700'
                                                                    }`}
                                                            >
                                                                <FaPlus /> Add Ward Round Note
                                                            </button>
                                                        )}
                                                        {/* Discharge button */}
                                                        {encounter.encounterStatus !== 'discharged' && (
                                                            <button
                                                                onClick={handleDischarge}
                                                                disabled={!canEdit}
                                                                className={`px-4 py-2 rounded flex items-center gap-2 text-sm ${!canEdit ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-red-600 text-white hover:bg-red-700'
                                                                    }`}
                                                            >
                                                                <FaTimes />
                                                                {encounter.encounterStatus === 'admitted' ? 'Discharge Patient' : 'Mark as Discharged'}
                                                            </button>
                                                        )}
                                                        {encounter.encounterStatus === 'discharged' && (
                                                            <div className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 text-sm">
                                                                <FaTimes /> Discharged
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Admission / Discharge Info Banner */}
                                                {encounter.ward && (
                                                    <div className={`p-4 rounded mb-5 border ${encounter.encounterStatus === 'discharged' ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                                                        <p className={`font-semibold ${encounter.encounterStatus === 'discharged' ? 'text-green-800' : 'text-blue-800'}`}>
                                                            <FaProcedures className="inline mr-2" />
                                                            {encounter.encounterStatus === 'discharged' ? 'Discharge Record' : 'Admitted In:'}
                                                        </p>
                                                        <p className="text-sm text-gray-700 ml-6 mt-1">
                                                            Ward: {typeof encounter.ward === 'object' && encounter.ward?.name ? encounter.ward.name : (typeof encounter.ward === 'string' ? `ID: ${encounter.ward}` : 'N/A')} |
                                                            Bed: {encounter.bed || 'N/A'} |
                                                            Admitted On: {encounter.admissionDate ? new Date(encounter.admissionDate).toLocaleString() : 'N/A'}
                                                        </p>
                                                        {encounter.encounterStatus === 'discharged' && (
                                                            <div className="mt-3 pt-3 border-t border-green-200 space-y-3">
                                                                <div className="flex flex-wrap gap-4 text-sm">
                                                                    <span className="text-green-800 font-semibold">
                                                                        ✓ Discharged On: {encounter.dischargeDate ? new Date(encounter.dischargeDate).toLocaleString() : (encounter.updatedAt ? new Date(encounter.updatedAt).toLocaleString() : 'N/A')}
                                                                    </span>
                                                                    {encounter.dischargedBy?.name && (
                                                                        <span className="text-gray-600">
                                                                            By: <span className="font-semibold text-gray-800">{encounter.dischargedBy.name}</span>
                                                                            {encounter.dischargedBy.role && <span className="ml-1 text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full capitalize">{encounter.dischargedBy.role}</span>}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {encounter.dischargeNotes ? (
                                                                    <div className="bg-white rounded-lg border border-green-300 overflow-hidden">
                                                                        <div className="bg-green-600 text-white px-3 py-2 text-xs font-semibold flex items-center gap-2">
                                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                                                                            DISCHARGE SUMMARY
                                                                        </div>
                                                                        <p className="text-sm text-gray-700 p-3 whitespace-pre-wrap">{encounter.dischargeNotes}</p>
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                                                                        ⚠ No discharge summary was recorded for this encounter.
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Edit Encounter Status Modal */}
                                                {showEditEncounterModal && (
                                                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                                        <div className="bg-white p-6 rounded shadow-lg w-96">
                                                            <h3 className="text-lg font-semibold mb-4">Edit Encounter Status</h3>
                                                            <label className="block mb-2">Encounter Status</label>
                                                            <select
                                                                className="w-full border rounded p-2 mb-4"
                                                                value={editEncounterStatus}
                                                                onChange={(e) => setEditEncounterStatus(e.target.value)}
                                                            >
                                                                <option value="admitted">Admitted</option>
                                                                <option value="in_progress">In Progress</option>
                                                                <option value="with_doctor">With Doctor</option>
                                                                <option value="in_nursing">In Nursing</option>
                                                                <option value="in_lab">In Lab</option>
                                                                <option value="in_radiology">In Radiology</option>
                                                                <option value="in_pharmacy">In Pharmacy</option>
                                                                <option value="discharged">Discharged</option>
                                                            </select>
                                                            <div className="flex justify-end space-x-2">
                                                                <button className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400" onClick={() => setShowEditEncounterModal(false)}>Cancel</button>
                                                                <button className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700" onClick={handleEditEncounterSave}>Save</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* â”€â”€ SECTION 1: Ward Round Notes â”€â”€ */}
                                                <div className="mb-8">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <FaNotesMedical className="text-teal-600" />
                                                        <h4 className="text-base font-bold text-teal-700">Ward Round Notes</h4>
                                                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-semibold">{wardRoundNotes.length}</span>
                                                    </div>
                                                    {wardRoundNotes.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {[...wardRoundNotes].reverse().map((note, idx) => (
                                                                <div key={idx} className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                                                                    <p className="whitespace-pre-wrap text-gray-800 text-sm">{note.text}</p>
                                                                    <div className="mt-2 text-xs text-gray-500 flex justify-between border-t border-teal-200 pt-2">
                                                                        <span>By: {note.author} ({note.role})</span>
                                                                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-sm text-gray-400 italic">No ward round notes recorded yet.</p>
                                                    )}
                                                </div>



                                                {/* â”€â”€ SECTION 3: General Inpatient Notes (legacy) â”€â”€ */}
                                                {clinicalNotes.length > 0 && (
                                                    <div className="mb-4">
                                                        <div className="flex items-center gap-2 mb-3">
                                                            <FaFileMedical className="text-yellow-600" />
                                                            <h4 className="text-base font-bold text-yellow-700">General Notes</h4>
                                                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold">{clinicalNotes.length}</span>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {clinicalNotes.map((note, index) => (
                                                                <div key={index} className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                                                    <p className="whitespace-pre-wrap text-gray-800 text-sm">{note.text}</p>
                                                                    <div className="mt-2 text-xs text-gray-500 flex justify-between border-t border-yellow-200 pt-2">
                                                                        <span>By: {note.author} ({note.role})</span>
                                                                        <span>{new Date(note.createdAt).toLocaleString()}</span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Empty state */}
                                                {wardRoundNotes.length === 0 && theatreNotes.length === 0 && clinicalNotes.length === 0 && (
                                                    <p className="text-gray-400 italic text-sm">No inpatient notes recorded yet. Use the buttons above to add ward round or theatre operation notes.</p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div >

            {/* Add Note Modal */}
            {
                showNoteModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Add Clinical Note</h3>
                                <button onClick={() => setShowNoteModal(false)} className="text-gray-500 hover:text-gray-700">
                                    <FaTimes size={24} />
                                </button>
                            </div>
                            <textarea
                                className="w-full border p-3 rounded mb-4"
                                rows="5"
                                placeholder="Enter clinical note..."
                                value={newNote}
                                onChange={(e) => setNewNote(e.target.value)}
                            />
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => setShowNoteModal(false)}
                                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddNote}
                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                >
                                    Save Note
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Add Ward Round Note Modal */}
            {showWardRoundModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-teal-700">Add Ward Round Note</h3>
                            <button onClick={() => { setShowWardRoundModal(false); setNewWardRoundNote(''); }} className="text-gray-500 hover:text-gray-700">
                                <FaTimes size={24} />
                            </button>
                        </div>
                        <textarea
                            className="w-full border p-3 rounded mb-4 focus:ring-2 focus:ring-teal-400"
                            rows="6"
                            placeholder="Enter ward round note..."
                            value={newWardRoundNote}
                            onChange={(e) => setNewWardRoundNote(e.target.value)}
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => { setShowWardRoundModal(false); setNewWardRoundNote(''); }}
                                className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!newWardRoundNote.trim() || !encounter) return;
                                    try {
                                        setLoading(true);
                                        const config = { headers: { Authorization: `Bearer ${user.token}` } };
                                        const { data } = await axios.post(
                                            `${backendUrl}/api/visits/${encounter._id}/ward-round-notes`,
                                            { text: newWardRoundNote },
                                            config
                                        );
                                        setWardRoundNotes(data);
                                        setNewWardRoundNote('');
                                        setShowWardRoundModal(false);
                                        toast.success('Ward round note added');
                                    } catch (error) {
                                        toast.error(error.response?.data?.message || 'Error adding ward round note');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700"
                            >
                                Save Note
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Theatre Operation Note Modal */}
            {showTheatreModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-red-700 text-white px-6 py-4 flex justify-between items-center rounded-t-xl sticky top-0 z-10 shadow-md">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaProcedures /> {editingTheatreNote ? 'Edit Operation Note' : 'New Theatre Operation Note'}
                            </h3>
                            <button onClick={() => { setShowTheatreModal(false); setEditingTheatreNote(null); }} className="hover:text-red-200">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Diagnosis (Pre-op)</label>
                                <textarea
                                    rows="2"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Pre-operative Diagnosis"
                                    value={theatreNoteForm.preOperativeDiagnosis || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, preOperativeDiagnosis: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Diagnosis (Operative)</label>
                                <textarea
                                    rows="2"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Post-operative / Operative Diagnosis"
                                    value={theatreNoteForm.postOperativeDiagnosis || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, postOperativeDiagnosis: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Operative</label>
                                <textarea
                                    rows="2"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Procedure Performed"
                                    value={theatreNoteForm.procedurePerformed || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, procedurePerformed: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Surgeon</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Lead Surgeon"
                                    value={theatreNoteForm.leadSurgeon || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, leadSurgeon: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Assistant(s)</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Assistant Surgeon(s)"
                                    value={theatreNoteForm.assistantSurgeons || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, assistantSurgeons: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Anaesthetist</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Anaesthetist"
                                    value={theatreNoteForm.anaesthetist || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, anaesthetist: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Anaesthetic</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Anaesthesia Type (e.g. General, Spinal)"
                                    value={theatreNoteForm.anaesthesiaType || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, anaesthesiaType: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Scrub Nurse</label>
                                <input
                                    type="text"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Scrub Nurse"
                                    value={theatreNoteForm.scrubNurse || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, scrubNurse: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
                                <input
                                    type="date"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    value={theatreNoteForm.dateOfSurgery ? theatreNoteForm.dateOfSurgery.toString().slice(0, 10) : ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, dateOfSurgery: e.target.value }))}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Findings:</label>
                                <textarea
                                    rows="5"
                                    className="w-full border rounded p-2.5 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition"
                                    placeholder="Operative Findings..."
                                    value={theatreNoteForm.operativeFindings || ''}
                                    onChange={e => setTheatreNoteForm(p => ({ ...p, operativeFindings: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3 rounded-b-xl shadow-md z-20">
                            <button
                                onClick={() => { setShowTheatreModal(false); setEditingTheatreNote(null); }}
                                className="bg-gray-200 text-gray-700 px-5 py-2 rounded hover:bg-gray-300 font-semibold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={async () => {
                                    if (!encounter) return;
                                    try {
                                        setLoading(true);
                                        const config = { headers: { Authorization: `Bearer ${user.token}` } };
                                        const payload = { ...theatreNoteForm };
                                        if (editingTheatreNote) payload._id = editingTheatreNote;
                                        const { data } = await axios.post(
                                            `${backendUrl}/api/visits/${encounter._id}/theatre-notes`,
                                            payload,
                                            config
                                        );
                                        setTheatreNotes(data.theatreNotes || data);
                                        setShowTheatreModal(false);
                                        setEditingTheatreNote(null);
                                        toast.success('Theatre note saved successfully');
                                    } catch (error) {
                                        toast.error(error.response?.data?.message || 'Error saving theatre note');
                                    } finally {
                                        setLoading(false);
                                    }
                                }}
                                className="bg-red-600 text-white px-5 py-2 rounded hover:bg-red-700 font-semibold shadow-md hover:shadow-lg transition"
                            >
                                Save Operation Note
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Postoperative Handover Checklist Modal */}
            {showPostoperativeHandoverModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto flex flex-col">
                        <div className="bg-purple-700 text-white px-6 py-4 flex justify-between items-center rounded-t-xl sticky top-0 z-20 shadow-md">
                            <h3 className="text-xl font-bold flex items-center gap-2"><FaCheckCircle /> Postoperative Handover Checklist</h3>
                            <button onClick={() => { setShowPostoperativeHandoverModal(false); setEditingPostoperativeHandoverChecklist(null); }} className="text-white hover:text-red-300 text-2xl font-bold">&times;</button>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Section 1 */}
                            <h4 className="text-md font-bold text-purple-700 border-b pb-1">1. Patient Specific Information</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Patient Number</label>
                                    <input type="text" value={postoperativeHandoverForm.patientNumber || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, patientNumber: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Age</label>
                                    <input type="text" value={postoperativeHandoverForm.age || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, age: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                                    <input type="text" value={postoperativeHandoverForm.firstName || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, firstName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                                    <input type="text" value={postoperativeHandoverForm.lastName || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, lastName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Allergy Status</label>
                                    <input type="text" value={postoperativeHandoverForm.allergyStatus || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, allergyStatus: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Diagnosis</label>
                                    <input type="text" value={postoperativeHandoverForm.diagnosis || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, diagnosis: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Procedure</label>
                                <input type="text" value={postoperativeHandoverForm.procedure || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, procedure: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Current Patient Status</label>
                                    <select value={postoperativeHandoverForm.currentPatientStatusSelect || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, currentPatientStatusSelect: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                                        <option value="">Please Select</option>
                                        <option value="Drowsy">Drowsy</option>
                                        <option value="Unconscious">Unconscious</option>
                                        <option value="In serious pain">In serious pain</option>
                                        <option value="Fully awake, conscious and doing well">Fully awake, conscious and doing well</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Current Patient Status (Details)</label>
                                    <input type="text" value={postoperativeHandoverForm.currentPatientStatusDetails || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, currentPatientStatusDetails: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Has the zonal/ward nurse recorded the vital signs of the patient in the EMR?</label>
                                <select value={postoperativeHandoverForm.vitalsRecordedInEmr || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, vitalsRecordedInEmr: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                                    <option value="">Please Select</option>
                                    <option value="yes">Yes</option>
                                    <option value="no">No</option>
                                </select>
                            </div>

                            {/* Section 2 */}
                            <h4 className="text-md font-bold text-purple-700 border-b pb-1 pt-3">2. Anaesthetic Information</h4>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Anaesthesia Type</label>
                                <select value={postoperativeHandoverForm.anaesthesiaType || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, anaesthesiaType: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400">
                                    <option value="">Please Select</option>
                                    <option value="GA (General Anaesthesia)">GA (General Anaesthesia)</option>
                                    <option value="LA (Local Anaesthesia)">LA (Local Anaesthesia)</option>
                                    <option value="Spinal">Spinal</option>
                                    <option value="Epidural">Epidural</option>
                                    <option value="CSE (Combined Spinal and Epidural)">CSE (Combined Spinal and Epidural)</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Intraoperative anaesthetic course and any complications</label>
                                <textarea rows={3} value={postoperativeHandoverForm.intraoperativeAnaestheticCourse || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, intraoperativeAnaestheticCourse: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Is a postoperative blood transfusion required?</label>
                                <input type="text" value={postoperativeHandoverForm.postoperativeBloodTransfusionRequired || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, postoperativeBloodTransfusionRequired: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Medications given in theatre</label>
                                <textarea rows={3} value={postoperativeHandoverForm.medicationsGivenInTheatre || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, medicationsGivenInTheatre: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Plan for monitoring (Vitals parameter range and action)</label>
                                <textarea rows={3} value={postoperativeHandoverForm.planForMonitoring || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, planForMonitoring: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Plan for intravenous fluids</label>
                                <textarea rows={3} value={postoperativeHandoverForm.planForIntravenousFluids || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, planForIntravenousFluids: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Plan for pain relief</label>
                                <textarea rows={3} value={postoperativeHandoverForm.planForPainRelief || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, planForPainRelief: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Plan for lines, eg- central venous, arterial</label>
                                <textarea rows={3} value={postoperativeHandoverForm.planForLines || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, planForLines: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Any postoperative investigations required?</label>
                                <textarea rows={3} value={postoperativeHandoverForm.postoperativeInvestigationsRequired || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, postoperativeInvestigationsRequired: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>

                            {/* Section 3 */}
                            <h4 className="text-md font-bold text-purple-700 border-b pb-1 pt-3">3. Surgical Information</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Consultant Surgeon</label>
                                    <input type="text" value={postoperativeHandoverForm.consultantSurgeon || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, consultantSurgeon: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Duration of Surgery</label>
                                    <input type="text" value={postoperativeHandoverForm.durationOfSurgery || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, durationOfSurgery: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Intraoperative surgical course and any complications</label>
                                <textarea rows={3} value={postoperativeHandoverForm.intraoperativeSurgicalCourse || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, intraoperativeSurgicalCourse: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">How much blood was lost (if any)? Any blood transfusions during surgery? If so, how many pints?</label>
                                <textarea rows={3} value={postoperativeHandoverForm.bloodLossTransfusions || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, bloodLossTransfusions: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Plan for nasogastric tube/feeding</label>
                                <textarea rows={3} value={postoperativeHandoverForm.planForNasogastricTube || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, planForNasogastricTube: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">DVT prophylaxis plan</label>
                                <textarea rows={3} value={postoperativeHandoverForm.dvtProphylaxisPlan || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, dvtProphylaxisPlan: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-orange-700 mb-1">Antibiotic plan</label>
                                <textarea rows={3} value={postoperativeHandoverForm.antibioticPlan || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, antibioticPlan: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-y" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Consultant Anaesthesiologist First Name</label>
                                    <input type="text" value={postoperativeHandoverForm.consultantAnaesthesiologistFirstName || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, consultantAnaesthesiologistFirstName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Consultant Anaesthesiologist Last Name</label>
                                    <input type="text" value={postoperativeHandoverForm.consultantAnaesthesiologistLastName || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, consultantAnaesthesiologistLastName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nurse Anaesthetist First Name</label>
                                    <input type="text" value={postoperativeHandoverForm.nurseAnaesthetistFirstName || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, nurseAnaesthetistFirstName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nurse Anaesthetist Last Name</label>
                                    <input type="text" value={postoperativeHandoverForm.nurseAnaesthetistLastName || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, nurseAnaesthetistLastName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Zonal/Ward Nurse First Name</label>
                                    <input type="text" value={postoperativeHandoverForm.zonalWardNurseFirstName || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, zonalWardNurseFirstName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Zonal/Ward Nurse Last Name</label>
                                    <input type="text" value={postoperativeHandoverForm.zonalWardNurseLastName || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, zonalWardNurseLastName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Filled by</label>
                                <input type="text" value={postoperativeHandoverForm.filledBy || ''} onChange={e => setPostoperativeHandoverForm(f => ({ ...f, filledBy: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400" />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl sticky bottom-0">
                            <button onClick={() => { setShowPostoperativeHandoverModal(false); setEditingPostoperativeHandoverChecklist(null); }} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-semibold">Cancel</button>
                            <button onClick={handleSavePostoperativeHandoverChecklist} className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold">Save Checklist</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pre-Anaesthesia Checklist Modal */}
            {showPreAnaesthesiaModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] overflow-y-auto flex flex-col">
                        <div className="bg-teal-700 text-white px-6 py-4 flex justify-between items-center rounded-t-xl sticky top-0 z-20 shadow-md">
                            <h3 className="text-xl font-bold flex items-center gap-2"><FaCheckCircle /> Pre-Anaesthesia Checklist</h3>
                            <button onClick={() => { setShowPreAnaesthesiaModal(false); setEditingPreAnaesthesiaChecklist(null); }} className="text-white hover:text-red-300 text-2xl font-bold">&times;</button>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Name + MRN */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">First Name</label>
                                    <input type="text" value={preAnaesthesiaForm.firstName || ''} onChange={e => setPreAnaesthesiaForm(f => ({ ...f, firstName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name</label>
                                    <input type="text" value={preAnaesthesiaForm.lastName || ''} onChange={e => setPreAnaesthesiaForm(f => ({ ...f, lastName: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Patient Number (MRN)</label>
                                    <input type="text" value={preAnaesthesiaForm.patientMRN || ''} onChange={e => setPreAnaesthesiaForm(f => ({ ...f, patientMRN: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-gray-600 mb-1">Filled by</label>
                                    <input type="text" value={preAnaesthesiaForm.filledBy || ''} onChange={e => setPreAnaesthesiaForm(f => ({ ...f, filledBy: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
                                </div>
                            </div>

                            {/* Dropdown fields helper */}
                            {[
                                { key: 'historyClinicalExamSignificant', label: 'Has anything significant been identified in the history and/or clinical examination?' },
                                { key: 'abnormalitiesWarrantInvestigation', label: 'Do any abnormalities warrant further investigation?' },
                                { key: 'abnormalitiesCanBeStabilised', label: 'Can any abnormalities be stabilised prior to anaesthesia?' },
                                { key: 'premedication', label: 'Would the patient benefit from premedication?' },
                                { key: 'facilitiesAvailable', label: 'Are the required facilities, personnel & medications available?' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <label className="block text-sm font-semibold text-orange-700 mb-1">{label}</label>
                                    <select value={preAnaesthesiaForm[key] || ''} onChange={e => setPreAnaesthesiaForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
                                        <option value="">Please Select</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </select>
                                </div>
                            ))}

                            {/* Textarea fields */}
                            {[
                                { key: 'historyClinicalExamDetails', label: 'If yes, then explain exactly what was identified' },
                                { key: 'specificInvestigationsDetails', label: 'If yes, then which specific investigations need to be requested?' },
                                { key: 'anticipatedComplications', label: 'What complications are anticipated during anaesthesia?' },
                                { key: 'complicationManagement', label: 'How can these complications be managed?' },
                                { key: 'painManagement', label: 'How will any pain associated with the procedure be managed?' },
                                { key: 'anaesthesiaInductionMaintenance', label: 'How will anaesthesia be induced & maintained?' },
                                { key: 'patientMonitoring', label: 'How will the patient be monitored?' },
                                { key: 'bodyTemperatureMaintenance', label: "How will the patient's body temperature be maintained?" },
                                { key: 'postAnaestheticManagement', label: 'How will the patient be managed in the post-anaesthetic period?' },
                                { key: 'unavailableResourcesDetails', label: 'If not, then list what or who is currently unavailable and whether it is appropriate to proceed with the surgery' },
                            ].map(({ key, label }) => (
                                <div key={key}>
                                    <label className="block text-sm font-semibold text-orange-700 mb-1">{label}</label>
                                    <textarea rows={3} value={preAnaesthesiaForm[key] || ''} onChange={e => setPreAnaesthesiaForm(f => ({ ...f, [key]: e.target.value }))} className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-y" />
                                </div>
                            ))}
                        </div>
                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl sticky bottom-0">
                            <button onClick={() => { setShowPreAnaesthesiaModal(false); setEditingPreAnaesthesiaChecklist(null); }} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-semibold">Cancel</button>
                            <button onClick={handleSavePreAnaesthesiaChecklist} className="px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 text-sm font-semibold">Save Checklist</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Anaesthetic Machine / Medication & Equipment Checklist Modal */}
            {showChecklistModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] overflow-y-auto flex flex-col">
                        <div className="bg-indigo-700 text-white px-6 py-4 flex justify-between items-center rounded-t-xl sticky top-0 z-20 shadow-md">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaCheckCircle /> Anaesthetic Machine / Medication &amp; Equipment Checklist
                            </h3>
                            <button onClick={() => { setShowChecklistModal(false); setEditingChecklist(null); }} className="text-white hover:text-red-300 text-2xl font-bold">&times;</button>
                        </div>
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Filled by (Name)</label>
                                <input
                                    type="text"
                                    value={checklistForm.filledBy || ''}
                                    onChange={e => setChecklistForm(f => ({ ...f, filledBy: e.target.value }))}
                                    className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    placeholder="Enter name of person filling this form"
                                />
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-700 text-base mb-3 border-b border-indigo-200 pb-1">Section 1: Anaesthetic Machine</h4>
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-indigo-50">
                                            <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">Item</th>
                                            <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-700 text-center w-20">Yes</th>
                                            <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-700 text-center w-20">No</th>
                                            <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-700 text-center w-32">Not Applicable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {anaestheticMachineItems.map((item, i) => (
                                            <tr key={item.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-800">{item.label}</td>
                                                {['yes', 'no', 'na'].map(val => (
                                                    <td key={val} className="px-3 py-2 border border-gray-200 text-center">
                                                        <input type="radio" name={item.key} value={val} checked={checklistForm[item.key] === val} onChange={() => setChecklistForm(f => ({ ...f, [item.key]: val }))} className="w-4 h-4 accent-indigo-600" />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div>
                                <h4 className="font-bold text-indigo-700 text-base mb-3 border-b border-indigo-200 pb-1">Section 2: Medications / Equipment</h4>
                                <table className="w-full text-sm border-collapse">
                                    <thead>
                                        <tr className="bg-indigo-50">
                                            <th className="text-left px-3 py-2 border border-gray-200 font-semibold text-gray-700">Item</th>
                                            <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-700 text-center w-20">Yes</th>
                                            <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-700 text-center w-20">No</th>
                                            <th className="px-3 py-2 border border-gray-200 font-semibold text-gray-700 text-center w-32">Not Applicable</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {medicationsEquipmentItems.map((item, i) => (
                                            <tr key={item.key} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                                <td className="px-3 py-2 border border-gray-200 text-gray-800">{item.label}</td>
                                                {['yes', 'no', 'na'].map(val => (
                                                    <td key={val} className="px-3 py-2 border border-gray-200 text-center">
                                                        <input type="radio" name={item.key} value={val} checked={checklistForm[item.key] === val} onChange={() => setChecklistForm(f => ({ ...f, [item.key]: val }))} className="w-4 h-4 accent-indigo-600" />
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl sticky bottom-0">
                            <button onClick={() => { setShowChecklistModal(false); setEditingChecklist(null); }} className="px-5 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 text-sm font-semibold">Cancel</button>
                            <button onClick={handleSaveChecklist} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-semibold">Save Checklist</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Surgical Consent Form Modal */}
            {showConsentModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] overflow-y-auto flex flex-col">
                        {/* Modal Header */}
                        <div className="bg-indigo-700 text-white px-6 py-4 flex justify-between items-center rounded-t-xl sticky top-0 z-20 shadow-md">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaFileAlt /> Surgical Consent Registry
                            </h3>
                            <button
                                onClick={() => { setShowConsentModal(false); setConsentActiveNote(null); }}
                                className="hover:text-indigo-200 p-1"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        {/* Modal Controls / Tabs */}
                        <div className="bg-gray-50 border-b px-6 py-3 flex flex-wrap justify-between items-center gap-4 sticky top-[60px] z-10">
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setConsentTab('digital')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${consentTab === 'digital'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white border text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    Digital Consent Form
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setConsentTab('upload')}
                                    className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${consentTab === 'upload'
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-white border text-gray-700 hover:bg-gray-100'
                                        }`}
                                >
                                    Upload Filled Form (PDF/Image)
                                </button>
                            </div>

                            <div className="flex gap-2">
                                {isConsentViewing && (
                                    <>
                                        {consentTab === 'digital' && (consentForm.patientSignatureName || consentForm.surgeonSignatureName || consentForm.guardianSignatureName || consentForm.anaesthetistSignatureName) && (
                                            <button
                                                type="button"
                                                onClick={handlePrintConsent}
                                                className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
                                            >
                                                <FaPrint /> Print Form
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setIsConsentViewing(false)}
                                            className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition"
                                        >
                                            <FaEdit /> Edit Consent
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 flex-1 overflow-y-auto">
                            {isConsentViewing ? (
                                /* --- VIEW MODE --- */
                                <div className="space-y-6">
                                    {consentTab === 'digital' ? (
                                        /* Digital View (Structured layout resembling paper form) */
                                        (consentForm.patientSignatureName || consentForm.surgeonSignatureName || consentForm.guardianSignatureName || consentForm.anaesthetistSignatureName) ? (
                                            <div className="border p-8 rounded-xl bg-gray-50 shadow-inner max-w-3xl mx-auto space-y-6 text-gray-800">
                                                {/* Printed Header */}
                                                <div className="text-center border-b pb-4">
                                                    {hospitalSettings?.hospitalLogo && (
                                                        <img
                                                            src={hospitalSettings.hospitalLogo.startsWith('data:') || hospitalSettings.hospitalLogo.startsWith('http') ? hospitalSettings.hospitalLogo : `${backendUrl}/uploads/${hospitalSettings.hospitalLogo}`}
                                                            alt="Logo"
                                                            className="max-h-20 max-w-[150px] mx-auto object-contain mb-3"
                                                        />
                                                    )}
                                                    <h2 className="text-xl font-bold uppercase tracking-wider">{hospitalSettings?.hospitalName || 'Hospital Consent Registry'}</h2>
                                                    <p className="text-sm text-gray-500">{hospitalSettings?.address || ''}</p>
                                                    {hospitalSettings?.phone && <p className="text-xs text-gray-400">Phone: {hospitalSettings.phone}</p>}
                                                </div>

                                                <h3 className="text-center text-lg font-bold uppercase underline">Consent for Surgery/Procedures</h3>

                                                <div className="space-y-4 text-base leading-relaxed">
                                                    <p>
                                                        I, <span className="font-bold underline px-1">{consentForm.patientName || 'N/A'}</span>,
                                                    </p>
                                                    <p>
                                                        of <span className="font-bold underline px-1">{consentForm.patientAddress || 'N/A'}</span>,
                                                    </p>
                                                    <p>
                                                        Hereby, after detailed explanation of the risks and benefits to me by Dr. <span className="font-bold underline px-1">{consentForm.physicianName || 'N/A'}</span>,
                                                    </p>
                                                    <p>
                                                        Willingly consent to the procedure of <span className="font-bold underline px-1">{consentForm.procedureName || 'N/A'}</span> on <span className="font-bold underline px-1">{consentForm.consentDate ? new Date(consentForm.consentDate).toLocaleDateString() : 'N/A'}</span>.
                                                    </p>
                                                    <p>
                                                        Relationship to Patient: <span className="font-bold underline px-1">{consentForm.relationship || 'N/A'}</span>.
                                                    </p>
                                                    <p className="pt-2">
                                                        I affirm that I clearly understand the language of presentation. The option to think over the procedure for a period before assenting was also presented to me.
                                                    </p>
                                                    <div className="pt-2">
                                                        <p className="font-bold">I further affirm:</p>
                                                        <ul className="list-disc pl-5 space-y-1">
                                                            <li>That explanation about this Surgery/procedure was first given to me at presentation date <span className="font-bold underline px-1">{consentForm.explanationDate ? new Date(consentForm.explanationDate).toLocaleDateString() : 'N/A'}</span>.</li>
                                                            <li>That the extent of the procedure and mode of Anaesthesia are left to the discretion of the Physician, including the use of blood and/or its product.</li>
                                                            <li>That any additional surgery or procedure to that described above will only be carried out if necessary and in my best interest and can be justified for medical reasons.</li>
                                                            <li>I understand that an assurance has not been given that the operation will be performed by a particular surgeon.</li>
                                                        </ul>
                                                    </div>
                                                </div>

                                                {/* Signatures Display Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t mt-6">
                                                    <div className="bg-white p-4 rounded border">
                                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Patient</p>
                                                        <p className="font-semibold text-sm">{consentForm.patientSignatureName || 'Not signed'}</p>
                                                        <p className="text-xs text-gray-400">Date: {consentForm.patientSignatureDate ? new Date(consentForm.patientSignatureDate).toLocaleDateString() : 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white p-4 rounded border">
                                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Surgeon</p>
                                                        <p className="font-semibold text-sm">{consentForm.surgeonSignatureName || 'Not signed'}</p>
                                                        <p className="text-xs text-gray-400">Date: {consentForm.surgeonSignatureDate ? new Date(consentForm.surgeonSignatureDate).toLocaleDateString() : 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white p-4 rounded border">
                                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Guardian/Witness</p>
                                                        <p className="font-semibold text-sm">{consentForm.guardianSignatureName || 'Not signed'}</p>
                                                        {consentForm.relationshipWithPatient && <p className="text-xs text-gray-600">Relationship: {consentForm.relationshipWithPatient}</p>}
                                                        <p className="text-xs text-gray-400">Date: {consentForm.guardianSignatureDate ? new Date(consentForm.guardianSignatureDate).toLocaleDateString() : 'N/A'}</p>
                                                    </div>
                                                    <div className="bg-white p-4 rounded border">
                                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Anaesthetist</p>
                                                        <p className="font-semibold text-sm">{consentForm.anaesthetistSignatureName || 'Not signed'}</p>
                                                        <p className="text-xs text-gray-400">Date: {consentForm.anaesthetistSignatureDate ? new Date(consentForm.anaesthetistSignatureDate).toLocaleDateString() : 'N/A'}</p>
                                                    </div>
                                                </div>

                                                {/* Thumbprints Display Grid */}
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                                                    <div className="bg-white p-4 rounded border">
                                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Patient Thumbprint Confirmation</p>
                                                        <p className="font-semibold text-sm text-green-700">{consentForm.patientThumbprint ? 'Confirmed' : 'No thumbprint recorded'}</p>
                                                        {consentForm.patientThumbprintDate && <p className="text-xs text-gray-400">Date: {new Date(consentForm.patientThumbprintDate).toLocaleDateString()}</p>}
                                                    </div>
                                                    <div className="bg-white p-4 rounded border">
                                                        <p className="text-xs text-gray-500 uppercase font-bold mb-1">Witness/Guardian Thumbprint Confirmation</p>
                                                        <p className="font-semibold text-sm text-green-700">{consentForm.witnessThumbprint ? 'Confirmed' : 'No thumbprint recorded'}</p>
                                                        {consentForm.witnessThumbprintDate && <p className="text-xs text-gray-400">Date: {new Date(consentForm.witnessThumbprintDate).toLocaleDateString()}</p>}
                                                    </div>
                                                </div>

                                                <div className="bg-gray-100 p-3 rounded text-center text-xs text-gray-500 mt-6 border">
                                                    Filled at: {consentActiveNote?.filledAt ? new Date(consentActiveNote.filledAt).toLocaleString() : ''} by {consentActiveNote?.filledBy || ''}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-16 px-4 bg-gray-50 border border-dashed rounded-xl max-w-md mx-auto my-8">
                                                <FaFileMedical className="mx-auto text-5xl text-gray-300 mb-4" />
                                                <h4 className="text-base font-bold text-gray-700">No Digital Form Recorded</h4>
                                                <p className="text-xs text-gray-400 mt-2">
                                                    Only the physical uploaded document was saved for this operation note.
                                                </p>
                                                {consentActiveNote?.uploadedFile && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setConsentTab('upload')}
                                                        className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                                    >
                                                        <FaEye /> View Uploaded Form
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    ) : (
                                        /* Upload File View */
                                        <div className="flex flex-col items-center justify-center space-y-4 max-w-4xl mx-auto">
                                            <p className="text-sm text-gray-600 font-semibold">Consent Document Preview:</p>
                                            {consentActiveNote?.uploadedFile ? (
                                                <div className="border w-full rounded-xl overflow-hidden shadow-lg bg-gray-50 flex flex-col items-center p-4">
                                                    {consentActiveNote.uploadedFile.toLowerCase().endsWith('.pdf') ? (
                                                        <div className="w-full flex flex-col items-center space-y-4">
                                                            <div className="w-full h-[600px] border rounded bg-white relative">
                                                                <iframe
                                                                    src={`${backendUrl}/${consentActiveNote.uploadedFile}`}
                                                                    className="w-full h-full"
                                                                    title="Uploaded Consent PDF"
                                                                />
                                                            </div>
                                                            <a
                                                                href={`${backendUrl}/${consentActiveNote.uploadedFile}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition"
                                                            >
                                                                <FaDownload /> Open PDF in New Tab
                                                            </a>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full flex flex-col items-center space-y-4">
                                                            <img
                                                                src={`${backendUrl}/${consentActiveNote.uploadedFile}`}
                                                                alt="Uploaded Consent"
                                                                className="max-w-full max-h-[600px] rounded-lg object-contain shadow-md"
                                                            />
                                                            <a
                                                                href={`${backendUrl}/${consentActiveNote.uploadedFile}`}
                                                                download
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-bold text-sm flex items-center gap-2 shadow-md transition"
                                                            >
                                                                <FaDownload /> Download Image
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-gray-400 italic">No file uploaded.</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* --- EDIT / FILL MODE --- */
                                <div className="space-y-6">
                                    {consentTab === 'digital' ? (
                                        /* Digital Fill Form */
                                        <div className="border p-8 rounded-xl bg-white shadow-sm max-w-4xl mx-auto space-y-8 text-gray-800">
                                            {/* Logo and Header Details */}
                                            <div className="text-center border-b pb-4">
                                                {hospitalSettings?.hospitalLogo && (
                                                    <img
                                                        src={hospitalSettings.hospitalLogo.startsWith('data:') || hospitalSettings.hospitalLogo.startsWith('http') ? hospitalSettings.hospitalLogo : `${backendUrl}/uploads/${hospitalSettings.hospitalLogo}`}
                                                        alt="Logo"
                                                        className="max-h-20 max-w-[150px] mx-auto object-contain mb-3"
                                                    />
                                                )}
                                                <h2 className="text-xl font-bold uppercase tracking-wider">{hospitalSettings?.hospitalName || 'Hospital Consent Registry'}</h2>
                                                <p className="text-sm text-gray-500">{hospitalSettings?.address || ''}</p>
                                                {hospitalSettings?.phone && <p className="text-xs text-gray-400">Phone: {hospitalSettings.phone}</p>}
                                            </div>

                                            <h3 className="text-center text-lg font-bold uppercase underline">Consent for Surgery/Procedures</h3>

                                            {/* Digital Form Fields */}
                                            <div className="space-y-6">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Full Name of Patient (Surname first)</label>
                                                        <input
                                                            type="text"
                                                            className="w-full border rounded p-2 text-sm bg-gray-50"
                                                            placeholder="Patient Name"
                                                            value={consentForm.patientName}
                                                            onChange={e => setConsentForm(p => ({ ...p, patientName: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Full Address of Patient (Not P.O. Box)</label>
                                                        <input
                                                            type="text"
                                                            className="w-full border rounded p-2 text-sm"
                                                            placeholder="Patient Address"
                                                            value={consentForm.patientAddress}
                                                            onChange={e => setConsentForm(p => ({ ...p, patientAddress: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="text-sm font-semibold text-gray-700 italic border-l-4 border-indigo-500 pl-3 py-1.5 bg-indigo-50/50 rounded-r">
                                                    Hereby, after detailed explanation of the risks and benefits to me by:
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Full Name of Physician (Surname first)</label>
                                                        <input
                                                            type="text"
                                                            className="w-full border rounded p-2 text-sm"
                                                            placeholder="Dr. Surname First"
                                                            value={consentForm.physicianName}
                                                            onChange={e => setConsentForm(p => ({ ...p, physicianName: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="text-sm font-semibold text-gray-700 italic border-l-4 border-indigo-500 pl-3 py-1.5 bg-indigo-50/50 rounded-r">
                                                    willingly consent to the procedure of:
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Procedure</label>
                                                        <input
                                                            type="text"
                                                            className="w-full border rounded p-2 text-sm bg-gray-50"
                                                            placeholder="Procedure Name"
                                                            value={consentForm.procedureName}
                                                            onChange={e => setConsentForm(p => ({ ...p, procedureName: e.target.value }))}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Consent Date</label>
                                                        <input
                                                            type="date"
                                                            className="w-full border rounded p-2 text-sm"
                                                            value={consentForm.consentDate}
                                                            onChange={e => setConsentForm(p => ({ ...p, consentDate: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Relationship to Patient (e.g. self/child/spouse/etc.)</label>
                                                        <select
                                                            className="w-full border rounded p-2 text-sm"
                                                            value={consentForm.relationship}
                                                            onChange={e => setConsentForm(p => ({ ...p, relationship: e.target.value }))}
                                                        >
                                                            <option value="self">Self</option>
                                                            <option value="child">Child</option>
                                                            <option value="spouse">Spouse</option>
                                                            <option value="mother">Mother</option>
                                                            <option value="father">Father</option>
                                                            <option value="other">Other</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-600 uppercase mb-1">Explanation Date (Presentation Date)</label>
                                                        <input
                                                            type="date"
                                                            className="w-full border rounded p-2 text-sm"
                                                            value={consentForm.explanationDate}
                                                            onChange={e => setConsentForm(p => ({ ...p, explanationDate: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Affirmations */}
                                                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 text-xs space-y-2 text-indigo-900">
                                                    <p className="font-semibold text-sm">Patient Affirmation & Disclaimer Statement:</p>
                                                    <p>I affirm that I clearly understand the language of presentation. The option to think over the procedure for a period before assenting was also presented to me.</p>
                                                    <ul className="list-disc pl-5 space-y-1 mt-2">
                                                        <li>That explanation about this Surgery/procedure was first given to me at presentation date.</li>
                                                        <li>That the extent of the procedure and mode of Anaesthesia are left to the discretion of the Physician, including the use of blood and/or its product.</li>
                                                        <li>That any additional surgery or procedure to that described above will only be carried out if necessary and in my best interest and can be justified for medical reasons.</li>
                                                        <li>I understand that an assurance has not been given that the operation will be performed by a particular surgeon.</li>
                                                    </ul>
                                                </div>

                                                {/* Signatures Fields */}
                                                <h4 className="text-sm font-bold text-gray-700 border-b pb-1 mt-6">Signatures & Approvals</h4>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    {/* Patient Signature */}
                                                    <div className="border p-4 rounded bg-gray-50 space-y-3">
                                                        <h5 className="text-xs font-bold text-gray-600 uppercase">Patient Signature</h5>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Name / Signature text</label>
                                                            <input type="text" className="w-full border rounded p-2 text-xs bg-white" placeholder="Type name to sign"
                                                                value={consentForm.patientSignatureName} onChange={e => setConsentForm(p => ({ ...p, patientSignatureName: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date</label>
                                                            <input type="date" className="w-full border rounded p-2 text-xs bg-white"
                                                                value={consentForm.patientSignatureDate} onChange={e => setConsentForm(p => ({ ...p, patientSignatureDate: e.target.value }))} />
                                                        </div>
                                                    </div>

                                                    {/* Surgeon Signature */}
                                                    <div className="border p-4 rounded bg-gray-50 space-y-3">
                                                        <h5 className="text-xs font-bold text-gray-600 uppercase">Surgeon Signature</h5>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Name / Signature text</label>
                                                            <input type="text" className="w-full border rounded p-2 text-xs bg-white" placeholder="Type surgeon name"
                                                                value={consentForm.surgeonSignatureName} onChange={e => setConsentForm(p => ({ ...p, surgeonSignatureName: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date</label>
                                                            <input type="date" className="w-full border rounded p-2 text-xs bg-white"
                                                                value={consentForm.surgeonSignatureDate} onChange={e => setConsentForm(p => ({ ...p, surgeonSignatureDate: e.target.value }))} />
                                                        </div>
                                                    </div>

                                                    {/* Guardian/Witness Signature */}
                                                    <div className="border p-4 rounded bg-gray-50 space-y-3">
                                                        <h5 className="text-xs font-bold text-gray-600 uppercase">Guardian / Witness Signature</h5>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Name / Signature</label>
                                                                <input type="text" className="w-full border rounded p-2 text-xs bg-white" placeholder="Type witness name"
                                                                    value={consentForm.guardianSignatureName} onChange={e => setConsentForm(p => ({ ...p, guardianSignatureName: e.target.value }))} />
                                                            </div>
                                                            <div>
                                                                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Relationship</label>
                                                                <input type="text" className="w-full border rounded p-2 text-xs bg-white" placeholder="e.g. Brother, Friend"
                                                                    value={consentForm.relationshipWithPatient} onChange={e => setConsentForm(p => ({ ...p, relationshipWithPatient: e.target.value }))} />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date</label>
                                                            <input type="date" className="w-full border rounded p-2 text-xs bg-white"
                                                                value={consentForm.guardianSignatureDate} onChange={e => setConsentForm(p => ({ ...p, guardianSignatureDate: e.target.value }))} />
                                                        </div>
                                                    </div>

                                                    {/* Anaesthetist Signature */}
                                                    <div className="border p-4 rounded bg-gray-50 space-y-3">
                                                        <h5 className="text-xs font-bold text-gray-600 uppercase">Anaesthetist Signature</h5>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Name / Signature text</label>
                                                            <input type="text" className="w-full border rounded p-2 text-xs bg-white" placeholder="Type anaesthetist name"
                                                                value={consentForm.anaesthetistSignatureName} onChange={e => setConsentForm(p => ({ ...p, anaesthetistSignatureName: e.target.value }))} />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Date</label>
                                                            <input type="date" className="w-full border rounded p-2 text-xs bg-white"
                                                                value={consentForm.anaesthetistSignatureDate} onChange={e => setConsentForm(p => ({ ...p, anaesthetistSignatureDate: e.target.value }))} />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Thumbprints */}
                                                <h4 className="text-sm font-bold text-gray-700 border-b pb-1 mt-6">Thumbprints (Confirmation)</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <div className="border p-4 rounded bg-gray-50 space-y-2">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500"
                                                                checked={consentForm.patientThumbprint === 'Yes'} onChange={e => setConsentForm(p => ({ ...p, patientThumbprint: e.target.checked ? 'Yes' : '' }))} />
                                                            <span className="text-xs font-bold text-gray-600 uppercase">Patient Thumbprint Assent</span>
                                                        </label>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Assent Date</label>
                                                            <input type="date" className="w-full border rounded p-2 text-xs bg-white"
                                                                value={consentForm.patientThumbprintDate} onChange={e => setConsentForm(p => ({ ...p, patientThumbprintDate: e.target.value }))} />
                                                        </div>
                                                    </div>

                                                    <div className="border p-4 rounded bg-gray-50 space-y-2">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input type="checkbox" className="rounded text-indigo-600 focus:ring-indigo-500"
                                                                checked={consentForm.witnessThumbprint === 'Yes'} onChange={e => setConsentForm(p => ({ ...p, witnessThumbprint: e.target.checked ? 'Yes' : '' }))} />
                                                            <span className="text-xs font-bold text-gray-600 uppercase">Witness / Guardian Thumbprint Assent</span>
                                                        </label>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Assent Date</label>
                                                            <input type="date" className="w-full border rounded p-2 text-xs bg-white"
                                                                value={consentForm.witnessThumbprintDate} onChange={e => setConsentForm(p => ({ ...p, witnessThumbprintDate: e.target.value }))} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Upload File Interface */
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 bg-white max-w-xl mx-auto flex flex-col items-center justify-center space-y-4">
                                            <div className="p-4 bg-indigo-50 rounded-full text-indigo-600">
                                                <FaUpload size={32} />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-gray-700">Upload Consent Document</p>
                                                <p className="text-xs text-gray-400 mt-1">Accepts PDF or Image (JPG, PNG, WebP) files up to 10MB</p>
                                            </div>

                                            <div className="w-full max-w-xs">
                                                <input
                                                    type="file"
                                                    id="consent-file-upload"
                                                    accept=".pdf,image/*"
                                                    className="hidden"
                                                    onChange={e => setConsentFile(e.target.files[0])}
                                                />
                                                <label
                                                    htmlFor="consent-file-upload"
                                                    className="block text-center cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm py-2 px-4 rounded-lg shadow transition"
                                                >
                                                    Select File
                                                </label>
                                            </div>

                                            {consentFile ? (
                                                <div className="bg-green-50 border border-green-200 text-green-800 text-xs px-3 py-2 rounded-lg w-full flex justify-between items-center">
                                                    <span className="truncate max-w-[80%] font-semibold">{consentFile.name}</span>
                                                    <button
                                                        onClick={() => setConsentFile(null)}
                                                        className="text-red-500 hover:text-red-700 font-bold ml-2 text-sm"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            ) : consentActiveNote?.uploadedFile ? (
                                                <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs px-3 py-2 rounded-lg w-full text-center">
                                                    Current File: <span className="font-semibold truncate max-w-[70%] inline-block align-bottom">{consentActiveNote.uploadedFile.split('/').pop()}</span>
                                                </div>
                                            ) : null}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Actions */}
                        <div className="bg-gray-50 border-t px-6 py-4 flex justify-end gap-3 rounded-b-xl sticky bottom-0 z-20 shadow-md">
                            <button
                                type="button"
                                onClick={() => { setShowConsentModal(false); setConsentActiveNote(null); }}
                                className="bg-gray-200 text-gray-700 px-5 py-2 rounded-lg font-semibold hover:bg-gray-300 transition"
                            >
                                Close
                            </button>
                            {!isConsentViewing && (
                                <button
                                    type="button"
                                    onClick={handleSaveConsent}
                                    className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg transition"
                                >
                                    Save Consent
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Discharge Note Modal */}
            {showDischargeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Discharge Patient</h3>
                                <p className="text-red-200 text-sm">A discharge note is required to complete this process</p>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
                                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" /></svg>
                                <span>Discharging will <strong>release the bed</strong> and close the encounter. This action cannot be undone.</span>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Discharge Note / Summary <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={dischargeNote}
                                    onChange={e => setDischargeNote(e.target.value)}
                                    rows={6}
                                    placeholder="Write a discharge summary including: condition at discharge, instructions given, follow-up plan, medications prescribed on discharge, etc."
                                    className="w-full border-2 border-gray-200 focus:border-red-400 rounded-lg p-3 text-sm resize-none outline-none transition"
                                />
                                <p className="text-xs text-gray-400 mt-1">{dischargeNote.length} characters</p>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={handleConfirmDischarge}
                                disabled={!dischargeNote.trim() || loading}
                                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition ${!dischargeNote.trim() || loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                            >
                                {loading ? 'Discharging...' : 'Confirm Discharge'}
                            </button>
                            <button
                                onClick={() => { setShowDischargeModal(false); setDischargeNote(''); }}
                                disabled={loading}
                                className="flex-1 py-3 rounded-lg font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SOAP Modal */}
            {
                showSoapModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">{editingNoteId ? 'Edit Clinical Note' : 'Add Clinical Note'}</h3>
                                <button onClick={() => { setShowSoapModal(false); setEditingNoteId(null); }} className="text-gray-500 hover:text-gray-700">
                                    <FaTimes size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                {/* Structured History Fields - 2 columns */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">01. Presenting Complaints</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.presentingComplaints}
                                            onChange={(e) => setSoapNote({ ...soapNote, presentingComplaints: e.target.value })}
                                            placeholder="Chief complaints..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">02. History of Presenting Complaint</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.historyOfPresentingComplaint}
                                            onChange={(e) => setSoapNote({ ...soapNote, historyOfPresentingComplaint: e.target.value })}
                                            placeholder="Detailed history of the presenting complaint..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">03. System Review</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.systemReview}
                                            onChange={(e) => setSoapNote({ ...soapNote, systemReview: e.target.value })}
                                            placeholder="Review of systems..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">04. Past Medical / Surgical History</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.pastMedicalSurgicalHistory}
                                            onChange={(e) => setSoapNote({ ...soapNote, pastMedicalSurgicalHistory: e.target.value })}
                                            placeholder="Past medical and surgical history..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">05. Social and Family History</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.socialFamilyHistory}
                                            onChange={(e) => setSoapNote({ ...soapNote, socialFamilyHistory: e.target.value })}
                                            placeholder="Social and family history..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">06. Drugs History</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.drugsHistory}
                                            onChange={(e) => setSoapNote({ ...soapNote, drugsHistory: e.target.value })}
                                            placeholder="Current and past medications..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">07. Functional Cognitive Status</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.functionalCognitiveStatus}
                                            onChange={(e) => setSoapNote({ ...soapNote, functionalCognitiveStatus: e.target.value })}
                                            placeholder="Functional and cognitive assessment..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">08. Menstruation / Gynecological / Obstetrics History</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.menstruationGynecologicalObstetricsHistory}
                                            onChange={(e) => setSoapNote({ ...soapNote, menstruationGynecologicalObstetricsHistory: e.target.value })}
                                            placeholder="Menstrual, gynecological, and obstetric history..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">09. Pregnancy History</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.pregnancyHistory}
                                            onChange={(e) => setSoapNote({ ...soapNote, pregnancyHistory: e.target.value })}
                                            placeholder="Pregnancy history..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">10. Immunization</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.immunization}
                                            onChange={(e) => setSoapNote({ ...soapNote, immunization: e.target.value })}
                                            placeholder="Immunization history..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">11. Nutritional</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.nutritional}
                                            onChange={(e) => setSoapNote({ ...soapNote, nutritional: e.target.value })}
                                            placeholder="Nutritional assessment..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">12. Developmental Milestones</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={soapNote.developmentalMilestones}
                                            onChange={(e) => setSoapNote({ ...soapNote, developmentalMilestones: e.target.value })}
                                            placeholder="Developmental milestones (for pediatric patients)..."
                                        ></textarea>
                                    </div>
                                </div>

                                {/* Physical Examination Section in Modal */}
                                <div className="border-t pt-4 mt-4">
                                    <h4 className="font-bold text-lg mb-3 text-teal-700">Physical Examination</h4>

                                    <div className="mb-3">
                                        <p className="font-semibold text-gray-700 mb-2">A. General Appearance</p>
                                        <label className="block text-gray-600 text-sm mb-1">General:</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="2"
                                            value={soapNote.generalAppearance}
                                            onChange={(e) => setSoapNote({ ...soapNote, generalAppearance: e.target.value })}
                                            placeholder="General appearance of patient..."
                                        ></textarea>
                                    </div>

                                    <div>
                                        <p className="font-semibold text-gray-700 mb-2">B. Systemic Examination</p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-gray-600 text-sm mb-1">HEENT:</label>
                                                <textarea className="w-full border p-2 rounded text-sm" rows="2" placeholder="No pallor, no jaundice. Pupils PERRLA." value={soapNote.heent} onChange={(e) => setSoapNote({ ...soapNote, heent: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 text-sm mb-1">Neck:</label>
                                                <textarea className="w-full border p-2 rounded text-sm" rows="2" placeholder="No lymphadenopathy, no JVD." value={soapNote.neck} onChange={(e) => setSoapNote({ ...soapNote, neck: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 text-sm mb-1">CVS:</label>
                                                <textarea className="w-full border p-2 rounded text-sm" rows="2" placeholder="S1, S2 normal, no murmurs." value={soapNote.cvs} onChange={(e) => setSoapNote({ ...soapNote, cvs: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 text-sm mb-1">Resp:</label>
                                                <textarea className="w-full border p-2 rounded text-sm" rows="2" placeholder="Clear breath sounds bilaterally." value={soapNote.resp} onChange={(e) => setSoapNote({ ...soapNote, resp: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 text-sm mb-1">Abd:</label>
                                                <textarea className="w-full border p-2 rounded text-sm" rows="2" placeholder="Soft, non-tender, no organomegaly." value={soapNote.abd} onChange={(e) => setSoapNote({ ...soapNote, abd: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 text-sm mb-1">Neuro:</label>
                                                <textarea className="w-full border p-2 rounded text-sm" rows="2" placeholder="Grossly intact." value={soapNote.neuro} onChange={(e) => setSoapNote({ ...soapNote, neuro: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 text-sm mb-1">MSK:</label>
                                                <textarea className="w-full border p-2 rounded text-sm" rows="2" placeholder="Full ROM, no deformities." value={soapNote.msk} onChange={(e) => setSoapNote({ ...soapNote, msk: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-gray-600 text-sm mb-1">Skin:</label>
                                                <textarea className="w-full border p-2 rounded text-sm" rows="2" placeholder="Intact, no rashes." value={soapNote.skin} onChange={(e) => setSoapNote({ ...soapNote, skin: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-4">
                                    <h4 className="font-bold text-lg mb-3 text-gray-800">Assessment & Plan</h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-gray-700 mb-2 font-semibold">
                                                A - Assessment (Diagnosis) <span className="text-red-500">*</span>
                                            </label>

                                            {/* ICD11 Search and Add */}
                                            <div className={`space-y-3 p-3 border rounded mb-3 ${soapNote.diagnosis.length === 0 ? 'bg-red-50 border-red-300' : 'bg-gray-50'}`}>
                                                <div className="relative">
                                                    <div className="flex gap-2">
                                                        <div className="relative flex-1">
                                                            <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                                            <input
                                                                type="text"
                                                                className="w-full border p-2 pl-10 rounded text-sm shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                                placeholder="Search ICD-11 by code or diagnosis name..."
                                                                value={diagSearchTerm}
                                                                onChange={(e) => {
                                                                    setDiagSearchTerm(e.target.value);
                                                                    setShowDiagDropdown(true);
                                                                }}
                                                                onFocus={() => setShowDiagDropdown(true)}
                                                            />
                                                        </div>
                                                    </div>

                                                    {showDiagDropdown && diagSearchTerm && (
                                                        <div className="absolute z-20 w-full bg-white border rounded shadow-xl max-h-60 overflow-y-auto mt-1 border-gray-200">
                                                            {(() => {
                                                                const customCodes = JSON.parse(localStorage.getItem('kuntau_customIcdCodes') || '[]');
                                                                const allDiagData = [...icd11Data, ...customCodes];
                                                                const filtered = allDiagData.filter(d =>
                                                                    d.code.toLowerCase().includes(diagSearchTerm.toLowerCase()) ||
                                                                    d.description.toLowerCase().includes(diagSearchTerm.toLowerCase())
                                                                );

                                                                if (filtered.length > 0) {
                                                                    return filtered.map((diag, idx) => (
                                                                        <div
                                                                            key={idx}
                                                                            className="p-3 hover:bg-blue-50 cursor-pointer text-sm border-b last:border-0 flex justify-between items-center transition-colors"
                                                                            onClick={() => {
                                                                                if (!soapNote.diagnosis.find(d => d.code === diag.code)) {
                                                                                    setSoapNote({
                                                                                        ...soapNote,
                                                                                        diagnosis: [...soapNote.diagnosis, diag]
                                                                                    });
                                                                                }
                                                                                setDiagSearchTerm('');
                                                                                setShowDiagDropdown(false);
                                                                            }}
                                                                        >
                                                                            <div>
                                                                                <span className={`font-bold mr-2 ${diag.code.startsWith('CUST-') ? 'text-orange-600' : 'text-blue-700'}`}>{diag.code}</span>
                                                                                <span className="text-gray-700">{diag.description}</span>
                                                                                {diag.code.startsWith('CUST-') && (
                                                                                    <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-1 rounded">Custom</span>
                                                                                )}
                                                                            </div>
                                                                            <FaPlus className="text-blue-500" />
                                                                        </div>
                                                                    ));
                                                                }

                                                                return (
                                                                    <div className="p-3">
                                                                        <p className="text-gray-400 text-xs text-center mb-2">No matching ICD-11 codes found for "<strong>{diagSearchTerm}</strong>"</p>
                                                                        <button
                                                                            className="w-full bg-orange-500 text-white text-sm px-3 py-2 rounded hover:bg-orange-600 flex items-center justify-center gap-2 transition-colors font-semibold"
                                                                            onClick={() => {
                                                                                const stored = JSON.parse(localStorage.getItem('kuntau_customIcdCodes') || '[]');
                                                                                const nextNum = stored.length + 1;
                                                                                const newEntry = {
                                                                                    code: `CUST-${String(nextNum).padStart(3, '0')}`,
                                                                                    description: diagSearchTerm.trim()
                                                                                };
                                                                                // Avoid duplicates
                                                                                const alreadyExists = stored.find(c => c.description.toLowerCase() === newEntry.description.toLowerCase());
                                                                                const entryToAdd = alreadyExists || newEntry;
                                                                                if (!alreadyExists) {
                                                                                    localStorage.setItem('kuntau_customIcdCodes', JSON.stringify([...stored, newEntry]));
                                                                                }
                                                                                if (!soapNote.diagnosis.find(d => d.description.toLowerCase() === entryToAdd.description.toLowerCase())) {
                                                                                    setSoapNote({ ...soapNote, diagnosis: [...soapNote.diagnosis, entryToAdd] });
                                                                                }
                                                                                setDiagSearchTerm('');
                                                                                setShowDiagDropdown(false);
                                                                            }}
                                                                        >
                                                                            <FaPlus /> Add "{diagSearchTerm}" as custom diagnosis
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Selected Diagnoses Tokens */}
                                                {soapNote.diagnosis.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {soapNote.diagnosis.map((diag, i) => (
                                                            <span key={i} className="bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-sm">
                                                                <span>{diag.code}: {diag.description}</span>
                                                                <button
                                                                    onClick={() => setSoapNote({
                                                                        ...soapNote,
                                                                        diagnosis: soapNote.diagnosis.filter((_, idx) => idx !== i)
                                                                    })}
                                                                    className="hover:text-red-200 transition-colors"
                                                                >
                                                                    <FaTimes />
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {soapNote.diagnosis.length === 0 && (
                                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                                    <span className="font-bold">âš </span> At least one ICD-11 diagnosis is required before saving.
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-gray-700 mb-2 font-semibold">P - Plan (Treatment Plan)</label>
                                            <textarea
                                                className="w-full border p-3 rounded"
                                                rows="4"
                                                value={soapNote.plan}
                                                onChange={(e) => setSoapNote({ ...soapNote, plan: e.target.value })}
                                                placeholder="Treatment plan, follow-up instructions..."
                                            ></textarea>
                                        </div>
                                    </div>
                                </div>
                                {/* End of Assessment & Plan section */}

                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveSOAP}
                                        disabled={soapNote.diagnosis.length === 0}
                                        className={`px-6 py-2 rounded font-semibold transition-colors ${soapNote.diagnosis.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                    >
                                        {editingNoteId ? 'Update Clinical Note' : 'Save Clinical Note'}
                                    </button>
                                    <button
                                        onClick={() => { setShowSoapModal(false); setEditingNoteId(null); }}
                                        className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                    {soapNote.diagnosis.length === 0 && (
                                        <span className="text-red-500 text-sm font-medium">âš  Diagnosis required to save</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Lab Order Modal */}
            {
                showLabModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Add Lab Order</h3>
                                <button onClick={() => setShowLabModal(false)} className="text-gray-500 hover:text-gray-700">
                                    <FaTimes size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">

                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 relative">
                                        <label className="block text-gray-700 mb-2 font-semibold">Search Test</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            placeholder="Type to search test..."
                                            value={labSearchTerm}
                                            onChange={(e) => {
                                                setLabSearchTerm(e.target.value);
                                                setShowLabDropdown(true);
                                                setSelectedLabTest('');
                                            }}
                                            onFocus={() => setShowLabDropdown(true)}
                                        />
                                        {showLabDropdown && labSearchTerm && (
                                            <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                                {labCharges.filter(c => c.name.toLowerCase().includes(labSearchTerm.toLowerCase())).length > 0 ? (
                                                    labCharges.filter(c => c.name.toLowerCase().includes(labSearchTerm.toLowerCase())).map(charge => (
                                                        <div
                                                            key={charge._id}
                                                            className="p-2 hover:bg-purple-50 cursor-pointer text-sm"
                                                            onClick={() => {
                                                                setSelectedLabTest(charge._id);
                                                                setLabSearchTerm(charge.name);
                                                                setShowLabDropdown(false);
                                                            }}
                                                        >
                                                            <div className="font-semibold">{charge.name}</div>
                                                            <div className="text-xs text-gray-500">â‚¦{charge.basePrice}</div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-2 text-gray-500 text-sm">No matches found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleAddLabToQueue}
                                        disabled={!selectedLabTest}
                                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 h-[42px]"
                                    >
                                        Add
                                    </button>
                                </div>

                                {/* List of selected tests */}
                                {tempLabOrders.length > 0 && (
                                    <div className="border rounded max-h-40 overflow-y-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2">Test Name</th>
                                                    <th className="p-2">Price</th>
                                                    <th className="p-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tempLabOrders.map(test => (
                                                    <tr key={test._id} className="border-b">
                                                        <td className="p-2">{test.name}</td>
                                                        <td className="p-2">â‚¦{test.basePrice}</td>
                                                        <td className="p-2">
                                                            <button
                                                                onClick={() => handleRemoveLabFromQueue(test._id)}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">Clinical Detail</label>
                                    <textarea
                                        className="w-full border p-2 rounded"
                                        rows="3"
                                        placeholder="Add clinical details for the lab scientist..."
                                        value={labClinicalDetails}
                                        onChange={(e) => setLabClinicalDetails(e.target.value)}
                                    ></textarea>
                                </div>

                                <div className="flex gap-2 justify-end mt-4">
                                    <button
                                        onClick={() => setShowLabModal(false)}
                                        className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handlePlaceLabOrder}
                                        disabled={tempLabOrders.length === 0 && !selectedLabTest}
                                        className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 font-semibold"
                                    >
                                        Place Order(s)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Radiology Order Modal */}
            {
                showRadModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-md">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Add Radiology Order</h3>
                                <button onClick={() => setShowRadModal(false)} className="text-gray-500 hover:text-gray-700">
                                    <FaTimes size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">

                                <div className="flex gap-2 items-end">
                                    <div className="flex-1 relative">
                                        <label className="block text-gray-700 mb-2 font-semibold">Search Study</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            placeholder="Type to search study..."
                                            value={radSearchTerm}
                                            onChange={(e) => {
                                                setRadSearchTerm(e.target.value);
                                                setShowRadDropdown(true);
                                                setSelectedRadTest('');
                                            }}
                                            onFocus={() => setShowRadDropdown(true)}
                                        />
                                        {showRadDropdown && radSearchTerm && (
                                            <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                                {radiologyCharges.filter(c => c.name.toLowerCase().includes(radSearchTerm.toLowerCase())).length > 0 ? (
                                                    radiologyCharges.filter(c => c.name.toLowerCase().includes(radSearchTerm.toLowerCase())).map(charge => (
                                                        <div
                                                            key={charge._id}
                                                            className="p-2 hover:bg-indigo-50 cursor-pointer text-sm"
                                                            onClick={() => {
                                                                setSelectedRadTest(charge._id);
                                                                setRadSearchTerm(charge.name);
                                                                setShowRadDropdown(false);
                                                            }}
                                                        >
                                                            <div className="font-semibold">{charge.name}</div>
                                                            <div className="text-xs text-gray-500">â‚¦{charge.basePrice}</div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-2 text-gray-500 text-sm">No matches found</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={handleAddRadToQueue}
                                        disabled={!selectedRadTest}
                                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300 h-[42px]"
                                    >
                                        Add
                                    </button>
                                </div>

                                {/* List of selected scans */}
                                {tempRadOrders.length > 0 && (
                                    <div className="border rounded max-h-40 overflow-y-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2">Scan Name</th>
                                                    <th className="p-2">Price</th>
                                                    <th className="p-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tempRadOrders.map(scan => (
                                                    <tr key={scan._id} className="border-b">
                                                        <td className="p-2">{scan.name}</td>
                                                        <td className="p-2">â‚¦{scan.basePrice}</td>
                                                        <td className="p-2">
                                                            <button
                                                                onClick={() => handleRemoveRadFromQueue(scan._id)}
                                                                className="text-red-600 hover:text-red-800"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                <div className="flex gap-2 justify-end mt-4">
                                    <button
                                        onClick={() => setShowRadModal(false)}
                                        className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handlePlaceRadiologyOrder}
                                        disabled={tempRadOrders.length === 0 && !selectedRadTest}
                                        className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400 font-semibold"
                                    >
                                        Place Order(s)
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }







            {/* Prescription Modal */}
            {
                showRxModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-4xl">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Add Prescription</h3>
                                <button onClick={() => setShowRxModal(false)} className="text-gray-500 hover:text-gray-700">
                                    <FaTimes size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div className="space-y-4">
                                    {/* Drug Search & Add Form */}
                                    <div className="bg-gray-50 p-4 rounded border">
                                        <h4 className="font-semibold text-sm text-gray-700 mb-3">Add Drug to List</h4>
                                        <div className="mb-3 relative">
                                            <label className="block text-xs text-gray-600 mb-1">Search Drug</label>
                                            <input
                                                type="text"
                                                className="w-full border p-2 rounded"
                                                placeholder="Type to search..."
                                                value={drugSearchTerm}
                                                onChange={(e) => setDrugSearchTerm(e.target.value)}
                                            />
                                            {showDrugDropdown && filteredDrugs.length > 0 && (
                                                <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                                    {filteredDrugs.map(drug => (
                                                        <div
                                                            key={drug._id}
                                                            className={`p-2 hover:bg-blue-50 cursor-pointer text-sm ${drug.quantity <= 0 || (drug.expiryDate && new Date(drug.expiryDate) < new Date()) ? 'bg-red-50' : ''}`}
                                                            onClick={() => handleSelectDrugFromSearch(drug)}
                                                        >
                                                            <div className="font-semibold flex justify-between">
                                                                <span>{drug.name}</span>
                                                                {drug.expiryDate && new Date(drug.expiryDate) < new Date() && (
                                                                    <span className="text-[10px] bg-red-600 text-white px-1 rounded">EXPIRED</span>
                                                                )}
                                                                {drug.quantity <= 0 && (
                                                                    <span className="text-[10px] bg-gray-600 text-white px-1 rounded">OUT OF STOCK</span>
                                                                )}
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                Total Stock: {drug.quantity} {drug.batches.length > 1 && `(${drug.batches.length} batches)`} | â‚¦{drug.price}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {selectedDrug && (
                                            <div className="grid grid-cols-7 gap-2 items-end">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Route</label>
                                                    <select
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugRoute}
                                                        onChange={(e) => setDrugRoute(e.target.value)}
                                                    >
                                                        <option value="">-- Route --</option>
                                                        {metadataOptions.route.map(m => (
                                                            <option key={m._id} value={m.value}>{m.value}</option>
                                                        ))}
                                                        {!metadataOptions.route.find(m => m.value === drugRoute) && drugRoute && (
                                                            <option value={drugRoute}>{drugRoute}</option>
                                                        )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Dosage</label>
                                                    <select
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugDosage}
                                                        onChange={(e) => setDrugDosage(e.target.value)}
                                                    >
                                                        <option value="">-- Dosage --</option>
                                                        {metadataOptions.dosage.map(m => (
                                                            <option key={m._id} value={m.value}>{m.value}</option>
                                                        ))}
                                                        {!metadataOptions.dosage.find(m => m.value === drugDosage) && drugDosage && (
                                                            <option value={drugDosage}>{drugDosage}</option>
                                                        )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Form</label>
                                                    <select
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugForm}
                                                        onChange={(e) => setDrugForm(e.target.value)}
                                                    >
                                                        <option value="">-- Form --</option>
                                                        {metadataOptions.form.map(m => (
                                                            <option key={m._id} value={m.value}>{m.value}</option>
                                                        ))}
                                                        {!metadataOptions.form.find(m => m.value === drugForm) && drugForm && (
                                                            <option value={drugForm}>{drugForm}</option>
                                                        )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Frequency</label>
                                                    <select
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugFrequency}
                                                        onChange={(e) => setDrugFrequency(e.target.value)}
                                                    >
                                                        <option value="">-- Freq --</option>
                                                        {metadataOptions.frequency.map(m => (
                                                            <option key={m._id} value={m.value}>{m.value}</option>
                                                        ))}
                                                        {!metadataOptions.frequency.find(m => m.value === drugFrequency) && drugFrequency && (
                                                            <option value={drugFrequency}>{drugFrequency}</option>
                                                        )}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Duration</label>
                                                    <input
                                                        type="text"
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugDuration}
                                                        onChange={(e) => setDrugDuration(e.target.value)}
                                                        placeholder="5 days"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                                                    <input
                                                        type="number"
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugQuantity}
                                                        onChange={(e) => setDrugQuantity(parseInt(e.target.value))}
                                                        min="1"
                                                    />
                                                </div>
                                                <div className="flex flex-col items-center justify-center h-full mb-1">
                                                    <label className="text-[10px] text-gray-600 mb-1 font-bold">Buy Outside</label>
                                                    <input
                                                        type="checkbox"
                                                        className="w-5 h-5 cursor-pointer accent-red-600"
                                                        checked={buyOutside}
                                                        onChange={(e) => setBuyOutside(e.target.checked)}
                                                    />
                                                </div>
                                                <div>
                                                    <button
                                                        onClick={handleAddDrugToQueue}
                                                        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm font-semibold h-[38px]"
                                                    >
                                                        Add
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Temporary Drug List */}
                                    <div className="border rounded overflow-hidden">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2">Drug</th>
                                                    <th className="p-2">Route</th>
                                                    <th className="p-2">Dosage</th>
                                                    <th className="p-2">Form</th>
                                                    <th className="p-2">Freq</th>
                                                    <th className="p-2">Dur</th>
                                                    <th className="p-2">Qty</th>
                                                    <th className="p-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {tempDrugs.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="8" className="p-4 text-center text-gray-500">
                                                            No drugs added yet. Search and add drugs above.
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    tempDrugs.map(drug => (
                                                        <tr key={drug.id} className={`border-b ${drug.buyOutside ? 'bg-orange-50' : ''}`}>
                                                            <td className="p-2 font-semibold">
                                                                <div className="flex items-center gap-1">
                                                                    {drug.name}
                                                                    {drug.buyOutside && (
                                                                        <span className="text-[10px] bg-orange-200 text-orange-800 px-1 rounded border border-orange-300">
                                                                            BUY OUTSIDE
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="p-2">{drug.route}</td>
                                                            <td className="p-2">{drug.dosage}</td>
                                                            <td className="p-2">{drug.form}</td>
                                                            <td className="p-2">{drug.frequency}</td>
                                                            <td className="p-2">{(drug.duration && !isNaN(drug.duration)) ? `${drug.duration} days` : drug.duration}</td>
                                                            <td className="p-2">{drug.quantity}</td>
                                                            <td className="p-2">
                                                                <button
                                                                    onClick={() => handleRemoveDrugFromQueue(drug.id)}
                                                                    className="text-red-600 hover:text-red-800"
                                                                >
                                                                    <FaTrash />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="flex gap-2 justify-end mt-4">
                                        <button
                                            onClick={() => setShowRxModal(false)}
                                            className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handlePrescribeAll}
                                            disabled={tempDrugs.length === 0}
                                            className="bg-pink-600 text-white px-6 py-2 rounded hover:bg-pink-700 disabled:bg-gray-400 font-semibold flex items-center gap-2"
                                        >
                                            <FaPills /> Prescribe All ({tempDrugs.length})
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Appointment Modal */}
            <AppointmentModal
                isOpen={showAppointmentModal}
                onClose={() => setShowAppointmentModal(false)}
                onSuccess={() => setShowAppointmentModal(false)}
                patientId={id}
                doctorId={user._id} // Pre-fill current doctor
                user={user}
            />

            {/* Convert to Inpatient Modal */}
            {showConvertModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden border border-gray-100 font-sans">
                        <div className="bg-purple-700 text-white px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <FaProcedures /> Admit Patient (Inpatient)
                            </h3>
                            <button
                                onClick={() => setShowConvertModal(false)}
                                className="text-white hover:text-gray-200 transition font-bold"
                            >
                                âœ•
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="mb-4 bg-purple-50 p-3 rounded border border-purple-100 text-sm">
                                <p className="font-bold text-purple-900">{patient?.name}</p>
                                <p className="text-gray-600">Converting outpatient encounter to Inpatient admission.</p>
                            </div>

                            {/* Deposit Balance status */}
                            <div className="mb-4">
                                <label className="block text-gray-700 font-bold text-sm mb-1">Financial Deposit Balance</label>
                                <div className={`p-3 rounded border text-sm font-semibold flex flex-col gap-1 ${isBlocked
                                    ? 'bg-red-50 text-red-800 border-red-200'
                                    : 'bg-green-50 text-green-800 border-green-200'
                                    }`}>
                                    <div className="flex justify-between items-center">
                                        <span>Patient Deposit:</span>
                                        <span className="font-bold">â‚¦{patient?.depositBalance?.toLocaleString() || '0'}</span>
                                    </div>
                                    {isRetainership && (
                                        <div className="flex justify-between items-center border-t border-dashed border-gray-300 pt-1 mt-1">
                                            <span>Retainership ({patient?.hmo}):</span>
                                            <span className="font-bold">{hasHmoDeposit ? 'âœ… Active Deposit' : 'âŒ No Deposit'}</span>
                                        </div>
                                    )}
                                </div>
                                {isBlocked && (
                                    <p className="text-xs text-red-600 mt-1 font-semibold">
                                        âš ï¸ Patient has no deposit balance. Admission is blocked until a deposit is paid.
                                    </p>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 font-bold text-sm mb-2">Select Ward</label>
                                <select
                                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                    value={selectedWard}
                                    onChange={(e) => setSelectedWard(e.target.value)}
                                    disabled={isBlocked}
                                >
                                    <option value="">-- Select Ward --</option>
                                    {wards.map(ward => (
                                        <option key={ward._id} value={ward._id}>
                                            {ward.name} ({ward.type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 font-bold text-sm mb-2">Select Bed</label>
                                <select
                                    className="w-full border p-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                                    value={selectedBed}
                                    onChange={(e) => setSelectedBed(e.target.value)}
                                    disabled={!selectedWard || isBlocked}
                                >
                                    <option value="">-- Select Bed --</option>
                                    {availableBeds.map(bed => (
                                        <option key={bed._id} value={bed.number}>
                                            {bed.number}
                                        </option>
                                    ))}
                                </select>
                                {selectedWard && availableBeds.length === 0 && (
                                    <p className="text-red-500 text-sm mt-1">No beds available in this ward.</p>
                                )}
                            </div>

                            {selectedWard && patient?.provider && (
                                <div className="mb-4 p-3 bg-blue-50 rounded text-xs text-blue-800 border border-blue-100">
                                    <p className="font-bold">Provider: {patient.provider}</p>
                                    <p>
                                        Rate: â‚¦{wards.find(w => w._id === selectedWard)?.rates?.[patient.provider] ||
                                            wards.find(w => w._id === selectedWard)?.rates?.Standard ||
                                            wards.find(w => w._id === selectedWard)?.dailyRate || 0}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setShowConvertModal(false)}
                                    className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400 text-sm font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConvertToInpatient}
                                    disabled={!selectedWard || !selectedBed || isBlocked}
                                    className={`px-4 py-2 rounded text-white text-sm font-semibold transition ${!selectedWard || !selectedBed || isBlocked
                                        ? 'bg-purple-300 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-700 shadow-sm'
                                        }`}
                                >
                                    Confirm Admission
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Referral Modal */}
            {
                showReferralModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b px-6 py-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-bold">
                                        {editingReferral ? 'Edit Referral' : 'Create Referral'}
                                    </h3>
                                    <button
                                        onClick={handleCancelEdit}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <FaTimes size={20} />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 space-y-4">
                                <div className="grid grid-cols-1 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Referred To
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded text-sm"
                                            value={referralData.referredTo}
                                            onChange={(e) => setReferralData({ ...referralData, referredTo: e.target.value })}
                                            placeholder="Specialist/Facility"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Diagnosis
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded text-sm"
                                            value={referralData.diagnosis}
                                            onChange={(e) => setReferralData({ ...referralData, diagnosis: e.target.value })}
                                            placeholder="Current diagnosis"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Reason for Referral
                                        </label>
                                        <textarea
                                            className="w-full border p-2 rounded text-sm h-20"
                                            value={referralData.reason}
                                            onChange={(e) => setReferralData({ ...referralData, reason: e.target.value })}
                                            placeholder="Detailed reason..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Medical History
                                        </label>
                                        <textarea
                                            className="w-full border p-2 rounded text-sm h-20"
                                            value={referralData.medicalHistory}
                                            onChange={(e) => setReferralData({ ...referralData, medicalHistory: e.target.value })}
                                            placeholder="Patient medical history..."
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Additional Notes
                                        </label>
                                        <textarea
                                            className="w-full border p-2 rounded text-sm h-20"
                                            value={referralData.notes}
                                            onChange={(e) => setReferralData({ ...referralData, notes: e.target.value })}
                                            placeholder="Other relevant information..."
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-3 pt-4">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="px-4 py-2 text-sm bg-gray-300 rounded hover:bg-gray-400 text-gray-800"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleCreateReferral}
                                        className="px-4 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 font-medium"
                                    >
                                        {editingReferral ? 'Update' : 'Create'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </Layout >
    );
};

export default PatientDetails;
