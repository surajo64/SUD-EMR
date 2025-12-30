import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import AppointmentModal from '../components/AppointmentModal';
import { FaTimes, FaFileMedical, FaPills, FaChevronDown, FaHeartbeat, FaNotesMedical, FaProcedures, FaXRay, FaVial, FaUserMd, FaCalendarPlus, FaPlus, FaTrash, FaEdit, FaSearch } from 'react-icons/fa';
import icd11Data from '../data/icd11.json';

const PatientDetails = () => {
    const { id } = useParams();
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [patient, setPatient] = useState(null);
    const [encounter, setEncounter] = useState(null);
    const [vitals, setVitals] = useState(null);
    const [labCharges, setLabCharges] = useState([]);
    const [radiologyCharges, setRadiologyCharges] = useState([]);
    const [inventoryDrugs, setInventoryDrugs] = useState([]);
    const [expandedDays, setExpandedDays] = useState({});

    // SOAP Note
    const [soapNote, setSoapNote] = useState({
        subjective: '',
        objective: '',
        assessment: '',
        plan: '',
        diagnosis: [] // Array of {code, description}
    });

    const [diagSearchTerm, setDiagSearchTerm] = useState('');
    const [showDiagDropdown, setShowDiagDropdown] = useState(false);
    const [showSoapModal, setShowSoapModal] = useState(false);

    useEffect(() => {
        if (showSoapModal && encounter) {
            setSoapNote({
                subjective: encounter.subjective || '',
                objective: encounter.objective || '',
                assessment: encounter.assessment || '',
                plan: encounter.plan || '',
                diagnosis: encounter.diagnosis || []
            });
        }
    }, [showSoapModal, encounter]);

    // Orders
    const [selectedLabTest, setSelectedLabTest] = useState('');
    const [tempLabOrders, setTempLabOrders] = useState([]); // Multi-select for Lab
    const [labSearchTerm, setLabSearchTerm] = useState('');
    const [showLabDropdown, setShowLabDropdown] = useState(false);

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
    const [showDrugDropdown, setShowDrugDropdown] = useState(false);

    // History & Lists
    const [pastEncounters, setPastEncounters] = useState([]);
    const [viewingPastEncounter, setViewingPastEncounter] = useState(false); // New state for read-only mode
    const [currentLabOrders, setCurrentLabOrders] = useState([]);
    const [currentRadOrders, setCurrentRadOrders] = useState([]);
    const [currentPrescriptions, setCurrentPrescriptions] = useState([]);
    const [clinicalNotes, setClinicalNotes] = useState([]); // New state for clinical notes
    const [newNote, setNewNote] = useState(''); // State for new note input
    const [showNoteModal, setShowNoteModal] = useState(false); // Modal for adding note

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


    // Tab State - default based on user role
    const getDefaultTab = () => {
        if (user?.role === 'lab_technician') return 'lab';
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
    const [vitalsData, setVitalsData] = useState({
        temperature: '',
        bloodPressure: '',
        heartRate: '',
        respiratoryRate: '',
        weight: '',
        height: ''
    });


    useEffect(() => {
        if (user && user.token) {
            fetchPatient();
            fetchCharges();
        }
    }, [id, user]);

    const fetchPatient = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients', config);
            const foundPatient = data.find(p => p._id === id);
            setPatient(foundPatient);

            // Fetch all visits for history
            const visitsRes = await axios.get('http://localhost:5000/api/visits', config);
            const patientVisits = visitsRes.data.filter(v => v.patient._id === id || v.patient === id);

            // Sort by date desc
            patientVisits.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setPastEncounters(patientVisits);

            // Find active encounter
            const activeEncounter = patientVisits.find(v =>
                v.encounterStatus === 'with_doctor' || v.encounterStatus === 'in_nursing' || v.encounterStatus === 'in_pharmacy' || v.encounterStatus === 'in_ward'
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
            // Vitals
            const vitalsRes = await axios.get(`http://localhost:5000/api/vitals/visit/${encounterId}`, config);
            if (vitalsRes.data.length > 0) setVitals(vitalsRes.data[0]); // Get latest
            else setVitals(null); // Clear if none

            // Lab Orders
            const labRes = await axios.get(`http://localhost:5000/api/lab/visit/${encounterId}`, config);
            setCurrentLabOrders(labRes.data);

            // Radiology Orders
            const radRes = await axios.get(`http://localhost:5000/api/radiology/visit/${encounterId}`, config);
            setCurrentRadOrders(radRes.data);

            // Prescriptions
            const rxRes = await axios.get(`http://localhost:5000/api/prescriptions/visit/${encounterId}`, config);
            setCurrentPrescriptions(rxRes.data);

            // Clinical Notes (from visit object)
            const visitRes = await axios.get(`http://localhost:5000/api/visits/${encounterId}`, config);
            setClinicalNotes(visitRes.data.notes || []);

            // Referrals
            const referralsRes = await axios.get(`http://localhost:5000/api/referrals/visit/${encounterId}`, config);
            setReferrals(referralsRes.data);

        } catch (error) {
            console.error('Error fetching encounter details', error);
        }
    };

    const handleViewPastEncounter = (visit) => {
        setEncounter(visit);
        setViewingPastEncounter(true);
        const config = { headers: { Authorization: `Bearer ${user.token}` } };
        fetchEncounterDetails(visit._id, config);
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
            // Active statuses: admitted, in_progress, with_doctor, in_nursing, in_lab, in_radiology, in_pharmacy, in_ward
            const activeStatuses = ['admitted', 'in_progress', 'with_doctor', 'in_nursing', 'in_lab', 'in_radiology', 'in_pharmacy', 'in_ward'];
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
    const canEdit = ['doctor', 'nurse', 'admin'].includes(user?.role) && !viewingPastEncounter && isEncounterActive();

    const fetchCharges = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/charges?active=true', config);

            setLabCharges(data.filter(c => c.type === 'lab'));
            setRadiologyCharges(data.filter(c => c.type === 'radiology'));

            // Fetch inventory drugs - filter by doctor's pharmacy if doctor role
            let inventoryUrl = 'http://localhost:5000/api/inventory';
            if (user.role === 'doctor' && user.assignedPharmacy) {
                inventoryUrl += `?pharmacy=${user.assignedPharmacy._id || user.assignedPharmacy}`;
            }
            const inventoryRes = await axios.get(inventoryUrl, config);
            setInventoryDrugs(inventoryRes.data.filter(item => item.quantity > 0));
        } catch (error) {
            console.error(error);
        }
    };

    const handleSaveSOAP = async () => {
        if (!encounter) {
            toast.error('No active encounter found');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `http://localhost:5000/api/visits/${encounter._id}`,
                {
                    ...soapNote,
                    assessment: soapNote.assessment,
                    diagnosis: soapNote.diagnosis // Pass the array of objects
                },
                config
            );
            toast.success('SOAP notes saved!');
            setShowSoapModal(false);

            // Refresh encounter to show updated SOAP notes
            const { data } = await axios.get(`http://localhost:5000/api/visits/${encounter._id}`, config);
            setEncounter(data);

            // Clear form
            setSoapNote({
                subjective: '',
                objective: '',
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
                    'http://localhost:5000/api/encounter-charges',
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
                    'http://localhost:5000/api/lab',
                    {
                        patientId: patient._id,
                        visitId: encounter._id,
                        chargeId: chargeRes.data._id, // Link to charge
                        testName: test.name,
                        notes: 'Doctor ordered'
                    },
                    config
                );
            }

            toast.success(`${ordersToPlace.length} Lab order(s) placed!`);
            setSelectedLabTest('');
            setTempLabOrders([]);
            setShowLabModal(false);
            // Refresh list
            const labRes = await axios.get(`http://localhost:5000/api/lab/visit/${encounter._id}`, config);
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
                    'http://localhost:5000/api/encounter-charges',
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
                    'http://localhost:5000/api/radiology',
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
            const radRes = await axios.get(`http://localhost:5000/api/radiology/visit/${encounter._id}`, config);
            setCurrentRadOrders(radRes.data);
        } catch (error) {
            console.error(error);
            toast.error('Error placing radiology order');
        } finally {
            setLoading(false);
        }
    };

    // Filter drugs based on search term
    useEffect(() => {
        if (drugSearchTerm) {
            const filtered = inventoryDrugs.filter(d =>
                d.name.toLowerCase().includes(drugSearchTerm.toLowerCase())
            );
            setFilteredDrugs(filtered);
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
            duration: drugDuration || 'As directed'
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

        // Find or create drug charge
        let drugCharge = await axios.get('http://localhost:5000/api/charges?active=true', config);
        let chargeForDrug = drugCharge.data.find(c => c.type === 'drugs' && c.name === selectedDrugData.name);

        // If no charge exists for this drug, create one
        if (!chargeForDrug) {
            const newCharge = await axios.post(
                'http://localhost:5000/api/charges',
                {
                    name: selectedDrugData.name,
                    type: 'drugs',
                    basePrice: selectedDrugData.price,
                    department: 'Pharmacy',
                    active: true
                },
                config
            );
            chargeForDrug = newCharge.data;
        }

        // 1. Add charge to encounter FIRST
        const chargeRes = await axios.post(
            'http://localhost:5000/api/encounter-charges',
            {
                encounterId: encounter._id,
                patientId: patient._id,
                chargeId: chargeForDrug._id,
                quantity: drugItem.quantity,
                notes: `${selectedDrugData.name} - Qty: ${drugItem.quantity}`
            },
            config
        );

        // 2. Create prescription with charge ID
        await axios.post(
            'http://localhost:5000/api/prescriptions',
            {
                patientId: patient._id,
                visitId: encounter._id,
                chargeId: chargeRes.data._id, // Link to charge
                medicines: [{
                    name: selectedDrugData.name,
                    dosage: drugItem.dosage,
                    frequency: drugItem.frequency,
                    duration: drugItem.duration,
                    quantity: drugItem.quantity
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
                `http://localhost:5000/api/visits/${encounter._id}`,
                { encounterStatus: 'in_pharmacy' },
                config
            );

            toast.success(`All prescriptions created! Status updated to Pharmacy.`);

            // Reset and close
            setTempDrugs([]);
            setShowRxModal(false);

            // Refresh list
            const rxRes = await axios.get(`http://localhost:5000/api/prescriptions/visit/${encounter._id}`, config);
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
            const res = await axios.get(`http://localhost:5000/api/referrals/visit/${encounter._id}`, config);
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
                const res = await axios.put(`http://localhost:5000/api/referrals/${editingReferral._id}`, {
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
                const res = await axios.post('http://localhost:5000/api/referrals', {
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
                `http://localhost:5000/api/visits/${encounter._id}`,
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
                `http://localhost:5000/api/visits/${encounter._id}/notes`,
                { text: newNote },
                config
            );
            setClinicalNotes(data);
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
                        <!-- Logo Placeholder -->
                        <div style="margin-bottom: 10px;">
                             <!-- <img src="/logo.png" style="height: 60px;" /> -->
                        </div>
                        <div class="hospital-name">KIRCT KILIMANJARO HOSPITAL</div>
                        <div class="hospital-info">Km1 Kwanar Dawaki, Kano-Kaduna Express Way.</div>
                        <div class="hospital-info">Email: kirctkilimanjarohospital@kirct.com , kirctkilimanjarohospital@gmail.com</div>
                        <div class="hospital-info">Phone: +2348024646465</div>
                        
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
                                <span class="input-line">${patient.age}</span>
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
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800">{patient.name}</h2>
                <p className="text-gray-600">MRN: {patient.mrn} | Age: {patient.age} | {patient.gender}</p>
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
            {
                user.role === 'doctor' && (
                    <div className="flex justify-end mb-4">
                        <button
                            onClick={() => setShowAppointmentModal(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
                        >
                            <FaCalendarPlus /> Schedule Follow-up
                        </button>
                        <button
                            onClick={() => setShowReferralModal(true)}
                            className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700 ml-2"
                        >
                            <FaFileMedical /> Referral
                        </button>
                    </div>
                )
            }

            <div className="flex gap-6">
                {/* History Sidebar */}
                <div className="w-1/4 bg-white p-4 rounded shadow h-fit">
                    <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Visit History</h3>
                    {pastEncounters.length === 0 ? (
                        <p className="text-sm text-gray-500">No previous visits.</p>
                    ) : (
                        <div className="space-y-3">
                            {pastEncounters.map(visit => (
                                <div
                                    key={visit._id}
                                    onClick={() => handleViewPastEncounter(visit)}
                                    className={`p-3 rounded border cursor-pointer ${visit._id === encounter?._id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
                                >
                                    <p className="font-semibold text-sm">{new Date(visit.createdAt).toLocaleDateString()}</p>
                                    <p className="text-xs text-gray-600">{visit.type}</p>
                                    <p className="text-xs text-gray-500 capitalize">{visit.encounterStatus}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Main Content */}
                <div className="flex-1">
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
                                {!['lab_technician', 'radiologist', 'pharmacist'].includes(user.role) && (
                                    <>
                                        <button
                                            onClick={() => setActiveTab('vitals')}
                                            className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'vitals' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-800'}`}
                                        >
                                            <FaHeartbeat /> Vitals
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
                                {!['lab_technician', 'pharmacist'].includes(user.role) && (
                                    <button
                                        onClick={() => setActiveTab('radiology')}
                                        className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'radiology' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-800'}`}
                                    >
                                        <FaXRay /> Radiology ({currentRadOrders.length})
                                    </button>
                                )}

                                {/* Prescriptions - Show for doctors, pharmacist, and receptionist */}
                                {!['lab_technician', 'radiologist'].includes(user.role) && (
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
                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
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
                                            return null;
                                        })()}
                                    </div>
                                )}

                                {/* SOAP Notes Tab */}
                                {activeTab === 'soap' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-bold">Clinical Documentation</h3>
                                            <button
                                                onClick={() => setShowSoapModal(true)}
                                                disabled={!canEdit}
                                                className={`px-4 py-2 rounded flex items-center gap-2 ${!canEdit ? 'bg-gray-300 cursor-not-allowed text-gray-500' : 'bg-green-600 text-white hover:bg-green-700'}`}
                                            >
                                                <FaPlus /> Add Clinical Note
                                            </button>
                                        </div>
                                        {encounter.subjective || encounter.objective || encounter.assessment || encounter.plan ? (
                                            <div className="space-y-4">
                                                {encounter.subjective && (
                                                    <div className="bg-gray-50 p-4 rounded">
                                                        <p className="font-semibold text-gray-700 mb-2">Subjective:</p>
                                                        <p className="text-gray-800">{encounter.subjective}</p>
                                                    </div>
                                                )}
                                                {encounter.objective && (
                                                    <div className="bg-gray-50 p-4 rounded">
                                                        <p className="font-semibold text-gray-700 mb-2">Objective:</p>
                                                        <p className="text-gray-800">{encounter.objective}</p>
                                                    </div>
                                                )}
                                                {(encounter.assessment || (encounter.diagnosis && encounter.diagnosis.length > 0)) && (
                                                    <div className="bg-gray-50 p-4 rounded">
                                                        <p className="font-semibold text-gray-700 mb-2">Assessment (Diagnosis):</p>
                                                        {encounter.diagnosis && encounter.diagnosis.length > 0 && (
                                                            <div className="mb-2 flex flex-wrap gap-2">
                                                                {encounter.diagnosis.map((d, i) => (
                                                                    <span key={i} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium border border-blue-200">
                                                                        {d.code} - {d.description}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        <p className="text-gray-800">{encounter.assessment}</p>
                                                    </div>
                                                )}
                                                {encounter.plan && (
                                                    <div className="bg-gray-50 p-4 rounded">
                                                        <p className="font-semibold text-gray-700 mb-2">Plan:</p>
                                                        <p className="text-gray-800">{encounter.plan}</p>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="text-gray-500">No Clinical notes recorded yet. Click "Add Clinical Note" to begin documentation.</p>
                                        )}
                                    </div>
                                )}

                                {/* Lab Orders Tab */}
                                {activeTab === 'lab' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="text-xl font-bold">Lab Orders</h3>
                                            {(user.role === 'doctor' || (user.role === 'lab_technician' && encounter?.type === 'External Investigation')) && (
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
                                                                {order.result && (
                                                                    <details className="mt-2">
                                                                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-semibold">
                                                                            View Results
                                                                        </summary>
                                                                        <div className="mt-2 p-3 bg-white rounded border text-sm whitespace-pre-wrap font-mono">
                                                                            {order.result}
                                                                        </div>
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
                                                            </div>
                                                        </div>
                                                        {order.signedBy && (
                                                            <p className="text-xs text-gray-500 mt-2 italic border-t pt-2">
                                                                Result by: {order.signedBy.name}
                                                            </p>
                                                        )}
                                                        {order.approvedBy && (
                                                            <p className="text-xs text-green-600 mt-1 italic font-semibold">
                                                                Reviewed and Approved by: {order.approvedBy.name}
                                                            </p>
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
                                                                        {order.resultImage && (
                                                                            <div className="mt-2">
                                                                                <a href={order.resultImage} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                                                                                    View Image
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
                                                                                                <p className="font-semibold text-lg text-gray-800">{med.name}</p>
                                                                                                <div className="text-sm text-gray-600 space-y-1 mt-1">
                                                                                                    <p><span className="font-medium">Dosage:</span> {med.dosage}</p>
                                                                                                    <p><span className="font-medium">Frequency:</span> {med.frequency}</p>
                                                                                                    <p><span className="font-medium">Duration:</span> {med.duration}</p>
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


                                        {/* Edit Encounter Modal */}
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
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">S - Subjective (Chief Complaint)</label>
                                    <textarea
                                        className="w-full border p-3 rounded"
                                        rows="3"
                                        value={soapNote.subjective}
                                        onChange={(e) => setSoapNote({ ...soapNote, subjective: e.target.value })}
                                        placeholder="Patient's complaints, symptoms, history..."
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">O - Objective (Physical Exam Findings)</label>
                                    <textarea
                                        className="w-full border p-3 rounded"
                                        rows="3"
                                        value={soapNote.objective}
                                        onChange={(e) => setSoapNote({ ...soapNote, objective: e.target.value })}
                                        placeholder="Physical examination findings, observations..."
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">A - Assessment (Diagnosis)</label>

                                    {/* ICD11 Search and Add */}
                                    <div className="space-y-3 p-3 border rounded bg-gray-50 mb-3">
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
                                                    {icd11Data.filter(d =>
                                                        d.code.toLowerCase().includes(diagSearchTerm.toLowerCase()) ||
                                                        d.description.toLowerCase().includes(diagSearchTerm.toLowerCase())
                                                    ).length > 0 ? (
                                                        icd11Data.filter(d =>
                                                            d.code.toLowerCase().includes(diagSearchTerm.toLowerCase()) ||
                                                            d.description.toLowerCase().includes(diagSearchTerm.toLowerCase())
                                                        ).map((diag, idx) => (
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
                                                                    <span className="font-bold text-blue-700 mr-2">{diag.code}</span>
                                                                    <span className="text-gray-700">{diag.description}</span>
                                                                </div>
                                                                <FaPlus className="text-blue-500" />
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <div className="p-4 text-gray-500 text-sm text-center">No matching ICD-11 codes found</div>
                                                    )}
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

                                    <textarea
                                        className="w-full border p-3 rounded"
                                        rows="2"
                                        value={soapNote.assessment}
                                        onChange={(e) => setSoapNote({ ...soapNote, assessment: e.target.value })}
                                        placeholder="Additional assessment comments, clinical impression..."
                                    ></textarea>
                                </div>
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">P - Plan (Treatment Plan)</label>
                                    <textarea
                                        className="w-full border p-3 rounded"
                                        rows="3"
                                        value={soapNote.plan}
                                        onChange={(e) => setSoapNote({ ...soapNote, plan: e.target.value })}
                                        placeholder="Treatment plan, follow-up instructions..."
                                    ></textarea>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleSaveSOAP}
                                        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 font-semibold"
                                    >
                                        Save SOAP Notes
                                    </button>
                                    <button
                                        onClick={() => setShowSoapModal(false)}
                                        className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
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
                                                            className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                                                            onClick={() => handleSelectDrugFromSearch(drug)}
                                                        >
                                                            <div className="font-semibold">{drug.name}</div>
                                                            <div className="text-xs text-gray-500">Stock: {drug.quantity} | ₦{drug.price}</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {selectedDrug && (
                                            <div className="grid grid-cols-7 gap-2 items-end">
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Route</label>
                                                    <input
                                                        type="text"
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugRoute}
                                                        onChange={(e) => setDrugRoute(e.target.value)}
                                                        placeholder="Oral"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Dosage</label>
                                                    <input
                                                        type="text"
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugDosage}
                                                        onChange={(e) => setDrugDosage(e.target.value)}
                                                        placeholder="500mg"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Form</label>
                                                    <input
                                                        type="text"
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugForm}
                                                        onChange={(e) => setDrugForm(e.target.value)}
                                                        placeholder="Tablet"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs text-gray-600 mb-1">Frequency</label>
                                                    <input
                                                        type="text"
                                                        className="w-full border p-2 rounded text-sm"
                                                        value={drugFrequency}
                                                        onChange={(e) => setDrugFrequency(e.target.value)}
                                                        placeholder="BD"
                                                    />
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
                                                <div>
                                                    <button
                                                        onClick={handleAddDrugToQueue}
                                                        className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm font-semibold"
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
                                                        <tr key={drug.id} className="border-b">
                                                            <td className="p-2 font-semibold">{drug.name}</td>
                                                            <td className="p-2">{drug.route}</td>
                                                            <td className="p-2">{drug.dosage}</td>
                                                            <td className="p-2">{drug.form}</td>
                                                            <td className="p-2">{drug.frequency}</td>
                                                            <td className="p-2">{drug.duration}</td>
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
