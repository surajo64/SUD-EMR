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
import { FaTimes, FaFileMedical, FaPills, FaChevronDown, FaChevronUp, FaHeartbeat, FaNotesMedical, FaProcedures, FaXRay, FaVial, FaUserMd, FaCalendarPlus, FaPlus, FaTrash, FaEdit, FaSearch, FaClock, FaChevronRight, FaFileAlt, FaCheckCircle, FaInfoCircle } from 'react-icons/fa';
import icd11Data from '../data/icd11.json';

const PatientDetails = () => {
    const { id } = useParams();
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
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
            // Match patterns like "- WBC: _____ x10^3/μL (Normal: 4.0-11.0)"
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
                                        statusText = '↓ LOW';
                                        statusColor = '#9a3412';
                                    } else if (rangeS === 'high') {
                                        bgColor = '#fecaca';
                                        statusText = '↑ HIGH';
                                        statusColor = '#991b1b';
                                    } else {
                                        bgColor = '#d1fae5';
                                        statusText = '✓ Normal';
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

    // Inpatient Conversion State
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [wards, setWards] = useState([]);
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBed, setSelectedBed] = useState('');
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
    const [clinicalNotes, setClinicalNotes] = useState([]); // New state for clinical notes
    const [newNote, setNewNote] = useState(''); // State for new note input
    const [showNoteModal, setShowNoteModal] = useState(false); // Modal for adding note
    const [dispensedPrescriptions, setDispensedPrescriptions] = useState([]);
    const [administrationHistory, setAdministrationHistory] = useState([]);

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
            const initialSoap = {
                presentingComplaints: encounter.presentingComplaints || '',
                historyOfPresentingComplaint: encounter.historyOfPresentingComplaint || '',
                systemReview: encounter.systemReview || '',
                pastMedicalSurgicalHistory: encounter.pastMedicalSurgicalHistory || '',
                socialFamilyHistory: encounter.socialFamilyHistory || '',
                drugsHistory: encounter.drugsHistory || '',
                functionalCognitiveStatus: encounter.functionalCognitiveStatus || '',
                menstruationGynecologicalObstetricsHistory: encounter.menstruationGynecologicalObstetricsHistory || '',
                pregnancyHistory: encounter.pregnancyHistory || '',
                immunization: encounter.immunization || '',
                nutritional: encounter.nutritional || '',
                developmentalMilestones: encounter.developmentalMilestones || '',
                // Physical Examination
                generalAppearance: encounter.generalAppearance || '',
                heent: encounter.heent || '',
                neck: encounter.neck || '',
                cvs: encounter.cvs || '',
                resp: encounter.resp || '',
                abd: encounter.abd || '',
                neuro: encounter.neuro || '',
                msk: encounter.msk || '',
                skin: encounter.skin || '',
                assessment: encounter.assessment || '',
                plan: encounter.plan || '',
                diagnosis: encounter.diagnosis || []
            };

            // Restore draft if exists
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
        }

        // Reset conversion state when modal closes
        if (!showConvertModal) {
            setSelectedWard('');
            setSelectedBed('');
        }
    }, [showSoapModal, encounter, showConvertModal, patient]);

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

            // Clinical Notes
            setClinicalNotes(visitRes.data.notes || []);

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
            await axios.put(
                `${backendUrl}/api/visits/${encounter._id}`,
                {
                    ...soapNote,
                    assessment: soapNote.assessment,
                    diagnosis: soapNote.diagnosis, // Pass the array of objects
                    consultingPhysician: user.role === 'doctor' ? user._id : (encounter.consultingPhysician || user._id)
                },
                config
            );
            toast.success('SOAP notes saved!');
            localStorage.removeItem(`draft_soap_${patient._id}_${encounter._id}`);
            setShowSoapModal(false);

            // Refresh encounter to show updated SOAP notes
            const { data } = await axios.get(`${backendUrl}/api/visits/${encounter._id}`, config);
            setEncounter(data);

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
            toast.error('Error saving SOAP notes');
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
    useEffect(() => {
        if (showReferralModal && encounter) {
            fetchReferrals();
        }
    }, [showReferralModal, encounter]);

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
        if (!window.confirm('Are you sure you want to discharge this patient? This will release the bed.')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/visits/${encounter._id}`,
                { encounterStatus: 'discharged', status: 'Discharged' },
                config
            );
            toast.success('Patient discharged successfully');
            fetchPatient(); // Refresh to update status
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
                // Normal: 36.1-37.2°C
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
                // Normal: ≥95%
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
                (user.role === 'doctor' || user.role === 'receptionist') && (
                    <div className="flex justify-end mb-4">
                        {user.role === 'doctor' && (
                            <button
                                onClick={() => setShowAppointmentModal(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
                            >
                                <FaCalendarPlus /> Schedule Follow-up
                            </button>
                        )}
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
                            className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700 ml-2"
                        >
                            <FaFileMedical /> {user.role === 'receptionist' ? 'View Referrals' : 'Referral'}
                        </button>
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
                                            <FaNotesMedical /> Clinical Notes
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
                                    <FaFileMedical /> Referrals ({referrals.length})
                                </button>

                                {/* Clinical Notes - Show for doctors, nurses, and receptionists (read-only), ONLY for Inpatient */}
                                {['doctor', 'nurse', 'receptionist'].includes(user.role) && encounter?.type === 'Inpatient' && (
                                    <button
                                        onClick={() => setActiveTab('notes')}
                                        className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'notes' ? 'border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-800'}`}
                                    >
                                        <FaFileMedical /> Ward Round Notes ({clinicalNotes.length})
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
                                                        <p className="text-xs text-gray-600">Temp (°C)</p>
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
                                                        <FaClock /> Drug Observation Chart (MAR)
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
                                                                                            {dispensedPrescriptions.flatMap(p => p.medicines.map(m => (
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
                                                                                                                        <span className="text-[7px] text-green-600 leading-none">{admin.nurse?.name?.split(' ')[0]}</span>
                                                                                                                        {admin.remarks && (
                                                                                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-40 bg-gray-900 border border-gray-700 text-white p-2 rounded-lg text-[9px] hidden group-hover:block z-50 shadow-2xl backdrop-blur-sm">
                                                                                                                                <div className="font-bold text-blue-300 mb-1 border-b border-gray-700 pb-1">Remark:</div>
                                                                                                                                {admin.remarks}
                                                                                                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                                                                                            </div>
                                                                                                                        )}
                                                                                                                    </div>
                                                                                                                ) : <span className="text-gray-200">-</span>}
                                                                                                            </td>
                                                                                                        );
                                                                                                    })}
                                                                                                </tr>
                                                                                            )))}
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
                                    <div>
                                        <h3 className="text-xl font-bold">Clinical Documentation</h3>
                                        {(() => {
                                            const hasNote = !!(encounter.presentingComplaints || encounter.historyOfPresentingComplaint ||
                                                encounter.assessment || encounter.plan ||
                                                (encounter.diagnosis && encounter.diagnosis.length > 0) ||
                                                encounter.generalAppearance || encounter.heent);
                                            const isAuthor = encounter.consultingPhysician?._id === user?._id ||
                                                encounter.consultingPhysician === user?._id;
                                            const isEditMode = hasNote && isAuthor;
                                            return (
                                                <button
                                                    onClick={() => setShowSoapModal(true)}
                                                    disabled={!canEdit}
                                                    className={`px-4 py-2 rounded flex items-center gap-2 ${!canEdit ? 'bg-gray-300 cursor-not-allowed text-gray-500' : isEditMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                                >
                                                    {isEditMode ? <><FaEdit /> Edit Clinical Note</> : <><FaPlus /> Add Clinical Note</>}
                                                </button>
                                            );
                                        })()}
                                        {/* Check if any clinical documentation exists */}
                                        {(encounter.presentingComplaints || encounter.historyOfPresentingComplaint ||
                                            encounter.systemReview || encounter.pastMedicalSurgicalHistory ||
                                            encounter.socialFamilyHistory || encounter.drugsHistory ||
                                            encounter.functionalCognitiveStatus || encounter.menstruationGynecologicalObstetricsHistory ||
                                            encounter.pregnancyHistory || encounter.immunization ||
                                            encounter.nutritional || encounter.developmentalMilestones ||
                                            encounter.assessment || encounter.plan ||
                                            (encounter.diagnosis && encounter.diagnosis.length > 0) ||
                                            encounter.subjective || encounter.objective) ? (
                                            <div className="space-y-4">
                                                {/* Doctor and Timestamp Info */}
                                                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 rounded">
                                                    <p className="text-sm text-gray-700">
                                                        <span className="font-semibold">Documented by:</span>{encounter.consultingPhysician?.name || 'Unknown'}
                                                        {encounter.updatedAt && (
                                                            <span className="ml-4 text-gray-600">
                                                                on {new Date(encounter.updatedAt).toLocaleString()}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>

                                                {/* Structured Clinical History Fields - Collapsible */}
                                                {(encounter.presentingComplaints || encounter.historyOfPresentingComplaint ||
                                                    encounter.systemReview || encounter.pastMedicalSurgicalHistory ||
                                                    encounter.socialFamilyHistory || encounter.drugsHistory ||
                                                    encounter.functionalCognitiveStatus || encounter.menstruationGynecologicalObstetricsHistory ||
                                                    encounter.pregnancyHistory || encounter.immunization ||
                                                    encounter.nutritional || encounter.developmentalMilestones ||
                                                    encounter.subjective || encounter.objective) && (
                                                        <div className="border rounded-lg overflow-hidden">
                                                            {/* Collapsible Header */}
                                                            <button
                                                                onClick={() => setExpandedSections(prev => ({ ...prev, history: !prev.history }))}
                                                                className="w-full bg-gradient-to-r from-gray-100 to-gray-50 hover:from-gray-200 hover:to-gray-100 p-4 flex justify-between items-center transition-colors"
                                                            >
                                                                <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                                    <FaNotesMedical className="text-blue-600" />
                                                                    Clinical History
                                                                </h4>
                                                                {expandedSections.history ? (
                                                                    <FaChevronUp className="text-gray-600" />
                                                                ) : (
                                                                    <FaChevronDown className="text-gray-600" />
                                                                )}
                                                            </button>

                                                            {/* Collapsible Content */}
                                                            {expandedSections.history && (
                                                                <div className="p-4 space-y-4 bg-white">
                                                                    {encounter.presentingComplaints && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">01. Presenting Complaints</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.presentingComplaints}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.historyOfPresentingComplaint && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">02. History of Presenting Complaint</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.historyOfPresentingComplaint}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.systemReview && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">03. System Review</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.systemReview}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.pastMedicalSurgicalHistory && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">04. Past Medical / Surgical History</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.pastMedicalSurgicalHistory}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.socialFamilyHistory && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">05. Social and Family History</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.socialFamilyHistory}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.drugsHistory && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">06. Drugs History</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.drugsHistory}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.functionalCognitiveStatus && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">07. Functional Cognitive Status</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.functionalCognitiveStatus}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.menstruationGynecologicalObstetricsHistory && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">08. Menstruation / Gynecological / Obstetrics History</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.menstruationGynecologicalObstetricsHistory}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.pregnancyHistory && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">09. Pregnancy History</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.pregnancyHistory}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.immunization && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">10. Immunization</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.immunization}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.nutritional && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">11. Nutritional</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.nutritional}</p>
                                                                        </div>
                                                                    )}

                                                                    {encounter.developmentalMilestones && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-gray-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">12. Developmental Milestones</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.developmentalMilestones}</p>
                                                                        </div>
                                                                    )}

                                                                    {/* Legacy SOAP fields (for backward compatibility) */}
                                                                    {encounter.subjective && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-yellow-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">Subjective (Legacy):</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.subjective}</p>
                                                                        </div>
                                                                    )}
                                                                    {encounter.objective && (
                                                                        <div className="bg-gray-50 p-4 rounded border-l-4 border-yellow-400">
                                                                            <p className="font-semibold text-gray-700 mb-2">Objective (Legacy):</p>
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.objective}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                {/* Physical Examination Section - Collapsible */}
                                                {(encounter.generalAppearance || encounter.heent || encounter.neck || encounter.cvs || encounter.resp || encounter.abd || encounter.neuro || encounter.msk || encounter.skin) && (
                                                    <div className="border rounded-lg overflow-hidden mt-4">
                                                        <button
                                                            onClick={() => setExpandedSections(prev => ({ ...prev, physicalExam: !prev.physicalExam }))}
                                                            className="w-full bg-gradient-to-r from-teal-100 to-teal-50 hover:from-teal-200 hover:to-teal-100 p-4 flex justify-between items-center transition-colors"
                                                        >
                                                            <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                                <FaHeartbeat className="text-teal-600" />
                                                                Physical Examination
                                                            </h4>
                                                            {expandedSections.physicalExam ? (
                                                                <FaChevronUp className="text-gray-600" />
                                                            ) : (
                                                                <FaChevronDown className="text-gray-600" />
                                                            )}
                                                        </button>
                                                        {expandedSections.physicalExam && (
                                                            <div className="p-4 space-y-3 bg-white">
                                                                {/* A. General Appearance */}
                                                                {encounter.generalAppearance && (
                                                                    <div className="bg-teal-50 p-4 rounded border-l-4 border-teal-500">
                                                                        <p className="font-semibold text-gray-700 mb-1">A. General Appearance</p>
                                                                        <p className="text-sm text-gray-500 mb-1">General:</p>
                                                                        <p className="text-gray-800 whitespace-pre-wrap">{encounter.generalAppearance}</p>
                                                                    </div>
                                                                )}
                                                                {/* B. Systemic Examination */}
                                                                {(encounter.heent || encounter.neck || encounter.cvs || encounter.resp || encounter.abd || encounter.neuro || encounter.msk || encounter.skin) && (
                                                                    <div className="bg-teal-50 p-4 rounded border-l-4 border-teal-400">
                                                                        <p className="font-semibold text-gray-700 mb-3">B. Systemic Examination</p>
                                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                                                                            {encounter.heent && <div><span className="font-semibold text-gray-600">HEENT: </span><span className="text-gray-800">{encounter.heent}</span></div>}
                                                                            {encounter.neck && <div><span className="font-semibold text-gray-600">Neck: </span><span className="text-gray-800">{encounter.neck}</span></div>}
                                                                            {encounter.cvs && <div><span className="font-semibold text-gray-600">CVS: </span><span className="text-gray-800">{encounter.cvs}</span></div>}
                                                                            {encounter.resp && <div><span className="font-semibold text-gray-600">Resp: </span><span className="text-gray-800">{encounter.resp}</span></div>}
                                                                            {encounter.abd && <div><span className="font-semibold text-gray-600">Abd: </span><span className="text-gray-800">{encounter.abd}</span></div>}
                                                                            {encounter.neuro && <div><span className="font-semibold text-gray-600">Neuro: </span><span className="text-gray-800">{encounter.neuro}</span></div>}
                                                                            {encounter.msk && <div><span className="font-semibold text-gray-600">MSK: </span><span className="text-gray-800">{encounter.msk}</span></div>}
                                                                            {encounter.skin && <div><span className="font-semibold text-gray-600">Skin: </span><span className="text-gray-800">{encounter.skin}</span></div>}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Assessment & Plan Section - Collapsible */}
                                                {(encounter.assessment || (encounter.diagnosis && encounter.diagnosis.length > 0) || encounter.plan) && (
                                                    <div className="border rounded-lg overflow-hidden mt-4">
                                                        {/* Collapsible Header */}
                                                        <button
                                                            onClick={() => setExpandedSections(prev => ({ ...prev, assessment: !prev.assessment }))}
                                                            className="w-full bg-gradient-to-r from-blue-100 to-blue-50 hover:from-blue-200 hover:to-blue-100 p-4 flex justify-between items-center transition-colors"
                                                        >
                                                            <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                                <FaFileMedical className="text-green-600" />
                                                                Assessment & Plan
                                                            </h4>
                                                            {expandedSections.assessment ? (
                                                                <FaChevronUp className="text-gray-600" />
                                                            ) : (
                                                                <FaChevronDown className="text-gray-600" />
                                                            )}
                                                        </button>

                                                        {/* Collapsible Content */}
                                                        {expandedSections.assessment && (
                                                            <div className="p-4 space-y-4 bg-white">
                                                                {(encounter.assessment || (encounter.diagnosis && encounter.diagnosis.length > 0)) && (
                                                                    <div className="bg-blue-50 p-4 rounded border-l-4 border-blue-600">
                                                                        <p className="font-semibold text-gray-700 mb-2">Assessment (Diagnosis):</p>
                                                                        {encounter.diagnosis && encounter.diagnosis.length > 0 && (
                                                                            <div className="mb-2 flex flex-wrap gap-2">
                                                                                {encounter.diagnosis.map((d, i) => (
                                                                                    <span key={i} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium border border-blue-300">
                                                                                        {d.code} - {d.description}
                                                                                    </span>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                        {encounter.assessment && (
                                                                            <p className="text-gray-800 whitespace-pre-wrap">{encounter.assessment}</p>
                                                                        )}
                                                                    </div>
                                                                )}

                                                                {encounter.plan && (
                                                                    <div className="bg-green-50 p-4 rounded border-l-4 border-green-600">
                                                                        <p className="font-semibold text-gray-700 mb-2">Plan:</p>
                                                                        <p className="text-gray-800 whitespace-pre-wrap">{encounter.plan}</p>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500">No clinical notes recorded yet. Click "Add Clinical Note" to begin documentation.</p>
                                        )}
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

                                {/* Referrals Tab */}
                                {activeTab === 'referrals' && (
                                    <div className="p-6">
                                        <h3 className="text-xl font-bold text-gray-700 mb-4">Referral Letters</h3>
                                        {referrals.length === 0 ? (
                                            <p className="text-gray-500">No referrals created for this visit.</p>
                                        ) : (
                                            <div className="space-y-3">
                                                {referrals.map(ref => (
                                                    <div key={ref._id} className="border p-4 rounded bg-gray-50 flex justify-between items-start">
                                                        <div className="flex-1">
                                                            <p className="font-semibold text-lg">{ref.referredTo}</p>
                                                            <p className="text-sm text-gray-600 mt-1"><strong>Diagnosis:</strong> {ref.diagnosis}</p>
                                                            <p className="text-sm text-gray-600 mt-1"><strong>Reason:</strong> {ref.reason}</p>
                                                            <p className="text-xs text-gray-500 mt-2">Created: {new Date(ref.createdAt).toLocaleDateString()} by Dr. {ref.doctor?.name || 'Unknown'}</p>
                                                        </div>
                                                        <div className="flex gap-2 ml-4">
                                                            {ref.doctor?._id === user._id && user.role === 'doctor' && (
                                                                <button
                                                                    onClick={() => handleEditClick(ref)}
                                                                    className="text-green-600 hover:text-green-800 flex items-center gap-1 px-3 py-2 border border-green-600 rounded hover:bg-green-50"
                                                                >
                                                                    <FaEdit /> Edit
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => printReferral(ref)}
                                                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 px-3 py-2 border border-blue-600 rounded hover:bg-blue-50"
                                                            >
                                                                <FaFileMedical /> Print
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Clinical Notes Tab */}
                                {activeTab === 'notes' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-bold">Ward Round Notes</h3>
                                            <div className="flex gap-2">
                                                {/* Show Discharge button only if not already discharged */}
                                                {encounter.encounterStatus !== 'discharged' && (
                                                    <button
                                                        onClick={handleDischarge}
                                                        disabled={!canEdit}
                                                        className={`px-4 py-2 rounded flex items-center gap-2 ${!canEdit
                                                            ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                                            : 'bg-red-600 text-white hover:bg-red-700'
                                                            }`}
                                                    >
                                                        <FaTimes />
                                                        {encounter.encounterStatus === 'admitted' ? 'Discharge Patient' : 'Mark as Discharged'}
                                                    </button>
                                                )}

                                                {/* Show discharged status if already discharged */}
                                                {encounter.encounterStatus === 'discharged' && (
                                                    <div className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2">
                                                        <FaTimes /> Discharged
                                                    </div>
                                                )}

                                                <button
                                                    onClick={() => setShowNoteModal(true)}
                                                    disabled={!canEdit}
                                                    className={`px-4 py-2 rounded flex items-center gap-2 ${!canEdit
                                                        ? 'bg-gray-300 cursor-not-allowed text-gray-500'
                                                        : 'bg-yellow-600 text-white hover:bg-yellow-700'
                                                        }`}
                                                >
                                                    <FaPlus /> Add Ward Round Note
                                                </button>
                                            </div>
                                        </div>

                                        {encounter.ward && (
                                            <div className="bg-blue-50 p-4 rounded mb-4 border border-blue-200">
                                                <p className="font-semibold text-blue-800">
                                                    <FaProcedures className="inline mr-2" />
                                                    Admitted In:
                                                </p>
                                                <p className="text-sm text-gray-700 ml-6">
                                                    Ward: {typeof encounter.ward === 'object' && encounter.ward?.name ? encounter.ward.name : (typeof encounter.ward === 'string' ? `ID: ${encounter.ward}` : 'N/A')} |
                                                    Bed: {encounter.bed || 'N/A'} |
                                                    Admitted On: {encounter.admissionDate ? new Date(encounter.admissionDate).toLocaleString() : 'N/A'}
                                                </p>

                                                {/* Discharge information - only show when discharged */}
                                                {encounter.encounterStatus === 'discharged' && (
                                                    <div className="mt-3 pt-3 border-t border-blue-200">
                                                        <p className="font-semibold text-green-800">
                                                            Discharged On: {encounter.dischargeDate ? new Date(encounter.dischargeDate).toLocaleString() : (encounter.updatedAt ? new Date(encounter.updatedAt).toLocaleString() : 'N/A')}
                                                        </p>
                                                        {encounter.dischargeNotes && (
                                                            <div className="mt-2 p-3 bg-white rounded border">
                                                                <p className="text-sm font-semibold text-gray-700 mb-1">Discharge Summary:</p>
                                                                <p className="text-sm text-gray-600">{encounter.dischargeNotes}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}


                                        {/* Convert to Inpatient Button - Nurse/Receptionist Only */}
                                        {['receptionist', 'admin'].includes(user.role) && (encounter?.type === 'Outpatient' || encounter?.type === 'Emergency') && isEncounterActive() && !viewingPastEncounter && (
                                            <button
                                                onClick={() => setShowConvertModal(true)}
                                                className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700 transition"
                                            >
                                                <FaProcedures /> Convert to Inpatient
                                            </button>
                                        )}

                                        {/* End Visit Button - Admins only */}
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
                                                        <button
                                                            className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                                                            onClick={() => setShowEditEncounterModal(false)}
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                                            onClick={handleEditEncounterSave}
                                                        >
                                                            Save
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {clinicalNotes.length > 0 ? (
                                            <div className="space-y-4">
                                                {clinicalNotes.map((note, index) => (
                                                    <div key={index} className="bg-yellow-50 p-4 rounded border border-yellow-200">
                                                        <p className="whitespace-pre-wrap text-gray-800">{note.text}</p>
                                                        <div className="mt-2 text-xs text-gray-500 flex justify-between border-t border-yellow-200 pt-2">
                                                            <span>By: {note.author} ({note.role})</span>
                                                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500">No ward round notes yet.</p>
                                        )}
                                    </div>
                                )}
                            </div>
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

            {/* SOAP Modal */}
            {
                showSoapModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Add SOAP Note</h3>
                                <button onClick={() => setShowSoapModal(false)} className="text-gray-500 hover:text-gray-700">
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
                                                    <span className="font-bold">⚠</span> At least one ICD-11 diagnosis is required before saving.
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
                                        Save SOAP Notes
                                    </button>
                                    <button
                                        onClick={() => setShowSoapModal(false)}
                                        className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                    {soapNote.diagnosis.length === 0 && (
                                        <span className="text-red-500 text-sm font-medium">⚠ Diagnosis required to save</span>
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
                                                            <div className="text-xs text-gray-500">₦{charge.basePrice}</div>
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
                                                        <td className="p-2">₦{test.basePrice}</td>
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
                                                            <div className="text-xs text-gray-500">₦{charge.basePrice}</div>
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
                                                        <td className="p-2">₦{scan.basePrice}</td>
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
                                                                Total Stock: {drug.quantity} {drug.batches.length > 1 && `(${drug.batches.length} batches)`} | ₦{drug.price}
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
                    <div className="bg-white p-6 rounded-lg shadow-lg w-96">
                        <h3 className="text-xl font-bold mb-4">Convert to Inpatient</h3>

                        <div className="mb-4">
                            <label className="block text-gray-700 font-bold mb-2">Select Ward</label>
                            <select
                                className="w-full border p-2 rounded"
                                value={selectedWard}
                                onChange={(e) => setSelectedWard(e.target.value)}
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
                            <label className="block text-gray-700 font-bold mb-2">Select Bed</label>
                            <select
                                className="w-full border p-2 rounded"
                                value={selectedBed}
                                onChange={(e) => setSelectedBed(e.target.value)}
                                disabled={!selectedWard}
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
                            <div className="mb-4 p-3 bg-blue-50 rounded text-sm text-blue-800">
                                <p className="font-bold">Provider: {patient.provider}</p>
                                <p>
                                    Rate: ₦{wards.find(w => w._id === selectedWard)?.rates?.[patient.provider] ||
                                        wards.find(w => w._id === selectedWard)?.rates?.Standard ||
                                        wards.find(w => w._id === selectedWard)?.dailyRate || 0}
                                </p>
                            </div>
                        )}

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowConvertModal(false)}
                                className="bg-gray-300 px-4 py-2 rounded hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConvertToInpatient}
                                disabled={!selectedWard || !selectedBed}
                                className={`px-4 py-2 rounded text-white ${!selectedWard || !selectedBed
                                    ? 'bg-blue-300 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                Convert
                            </button>
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
