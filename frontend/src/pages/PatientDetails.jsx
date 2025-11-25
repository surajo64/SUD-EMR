import { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import AppointmentModal from '../components/AppointmentModal';
import { FaTimes, FaFileMedical, FaPills, FaHeartbeat, FaNotesMedical, FaProcedures, FaXRay, FaVial, FaUserMd, FaCalendarPlus, FaPlus } from 'react-icons/fa';

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

    // SOAP Note
    const [soapNote, setSoapNote] = useState({
        subjective: '',
        objective: '',
        assessment: '',
        plan: ''
    });

    // Orders
    const [selectedLabTest, setSelectedLabTest] = useState('');
    const [selectedRadTest, setSelectedRadTest] = useState('');
    const [selectedDrug, setSelectedDrug] = useState('');
    const [drugQuantity, setDrugQuantity] = useState(1);
    const [drugDosage, setDrugDosage] = useState('');
    const [drugFrequency, setDrugFrequency] = useState('');
    const [drugDuration, setDrugDuration] = useState('');

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
    const [showSoapModal, setShowSoapModal] = useState(false);
    const [showLabModal, setShowLabModal] = useState(false);
    const [showRadModal, setShowRadModal] = useState(false);
    const [showRxModal, setShowRxModal] = useState(false);
    const [showAppointmentModal, setShowAppointmentModal] = useState(false); // Appointment Modal State

    // Tab State - default based on user role
    const getDefaultTab = () => {
        if (user?.role === 'lab_technician') return 'lab';
        if (user?.role === 'radiologist') return 'radiology';
        if (user?.role === 'pharmacist') return 'prescriptions';
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
                v.encounterStatus === 'with_doctor' || v.encounterStatus === 'in_nursing' || v.encounterStatus === 'in_pharmacy'
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
            // Active statuses: admitted, in_progress, with_doctor, in_nursing, in_lab, in_radiology, in_pharmacy
            const activeStatuses = ['admitted', 'in_progress', 'with_doctor', 'in_nursing', 'in_lab', 'in_radiology', 'in_pharmacy'];
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

    const canEdit = isEncounterActive();
    console.log('🔍 canEdit:', canEdit);

    const fetchCharges = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/charges?active=true', config);

            setLabCharges(data.filter(c => c.type === 'lab'));
            setRadiologyCharges(data.filter(c => c.type === 'radiology'));

            // Fetch inventory drugs instead of drug charges
            const inventoryRes = await axios.get('http://localhost:5000/api/inventory', config);
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
                soapNote,
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
                plan: ''
            });
        } catch (error) {
            console.error(error);
            toast.error('Error saving SOAP notes');
        } finally {
            setLoading(false);
        }
    };

    const handlePlaceLabOrder = async () => {
        if (!selectedLabTest || !encounter) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // 1. Add charge to encounter FIRST
            const chargeRes = await axios.post(
                'http://localhost:5000/api/encounter-charges',
                {
                    encounterId: encounter._id,
                    patientId: patient._id,
                    chargeId: selectedLabTest,
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
                    testName: labCharges.find(c => c._id === selectedLabTest)?.name,
                    notes: 'Doctor ordered'
                },
                config
            );

            toast.success('Lab order placed! Charge generated. Patient must pay before lab test.');
            setSelectedLabTest('');
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

    const handlePlaceRadiologyOrder = async () => {
        if (!selectedRadTest || !encounter) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // 1. Add charge to encounter FIRST
            const chargeRes = await axios.post(
                'http://localhost:5000/api/encounter-charges',
                {
                    encounterId: encounter._id,
                    patientId: patient._id,
                    chargeId: selectedRadTest,
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
                    scanType: radiologyCharges.find(c => c._id === selectedRadTest)?.name,
                    notes: 'Doctor ordered'
                },
                config
            );

            toast.success('Radiology order placed! Charge generated. Patient must pay before imaging.');
            setSelectedRadTest('');
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

    const handlePrescribeDrug = async () => {
        if (!selectedDrug || !encounter) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            const selectedDrugData = inventoryDrugs.find(d => d._id === selectedDrug);

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
                    quantity: drugQuantity,
                    notes: `${selectedDrugData.name} - Qty: ${drugQuantity}`
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
                        dosage: drugDosage || 'As directed',
                        frequency: drugFrequency || 'As directed',
                        duration: drugDuration || 'As directed',
                        quantity: drugQuantity
                    }],
                    notes: 'Doctor prescribed'
                },
                config
            );

            // 3. Update encounter status to 'in_pharmacy'
            await axios.put(
                `http://localhost:5000/api/visits/${encounter._id}`,
                { encounterStatus: 'in_pharmacy' },
                config
            );


            toast.success(`Prescription created! Status updated to Pharmacy.`);
            setSelectedDrug('');
            setDrugQuantity(1);
            setDrugDosage('');
            setDrugFrequency('');
            setDrugDuration('');
            setShowRxModal(false);
            // Refresh list
            const rxRes = await axios.get(`http://localhost:5000/api/prescriptions/visit/${encounter._id}`, config);
            setCurrentPrescriptions(rxRes.data);

            // Refresh encounter to reflect status change
            await fetchPatient();
        } catch (error) {
            console.error(error);
            toast.error('Error prescribing drug');
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

    if (!patient) {
        return <Layout><p>Loading...</p></Layout>;
    }

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
            {user.role === 'doctor' && (
                <div className="flex justify-end mb-4">
                    <button
                        onClick={() => setShowAppointmentModal(true)}
                        className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700"
                    >
                        <FaCalendarPlus /> Schedule Follow-up
                    </button>
                </div>
            )}

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

                                {/* Lab Orders - Show for doctors, lab_technician, and lab_scientist */}
                                {!['radiologist', 'pharmacist'].includes(user.role) && (
                                    <button
                                        onClick={() => setActiveTab('lab')}
                                        className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'lab' ? 'border-b-2 border-purple-600 text-purple-600' : 'text-gray-600 hover:text-gray-800'}`}
                                    >
                                        <FaVial /> Lab Orders ({currentLabOrders.length})
                                    </button>
                                )}

                                {/* Radiology - Show for doctors and radiologist */}
                                {!['lab_technician', 'pharmacist'].includes(user.role) && (
                                    <button
                                        onClick={() => setActiveTab('radiology')}
                                        className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'radiology' ? 'border-b-2 border-indigo-600 text-indigo-600' : 'text-gray-600 hover:text-gray-800'}`}
                                    >
                                        <FaXRay /> Radiology ({currentRadOrders.length})
                                    </button>
                                )}

                                {/* Prescriptions - Show for doctors and pharmacist */}
                                {!['lab_technician', 'radiologist'].includes(user.role) && (
                                    <button
                                        onClick={() => setActiveTab('prescriptions')}
                                        className={`px-6 py-3 font-semibold flex items-center gap-2 ${activeTab === 'prescriptions' ? 'border-b-2 border-pink-600 text-pink-600' : 'text-gray-600 hover:text-gray-800'}`}
                                    >
                                        <FaPills /> Prescriptions ({currentPrescriptions.length})
                                    </button>
                                )}

                                {/* Clinical Notes - Show for doctors and nurses, ONLY for Inpatient */}
                                {['doctor', 'nurse'].includes(user.role) && encounter?.type === 'Inpatient' && (
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
                                                <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-4">
                                                    {vitals.temperature && (
                                                        <div className="bg-blue-50 p-3 rounded">
                                                            <p className="text-xs text-gray-600">Temp (°C)</p>
                                                            <p className="font-bold">{vitals.temperature}</p>
                                                        </div>
                                                    )}
                                                    {vitals.bloodPressure && (
                                                        <div className="bg-blue-50 p-3 rounded">
                                                            <p className="text-xs text-gray-600">BP (mmHg)</p>
                                                            <p className="font-bold">{vitals.bloodPressure}</p>
                                                        </div>
                                                    )}
                                                    {vitals.heartRate && (
                                                        <div className="bg-blue-50 p-3 rounded">
                                                            <p className="text-xs text-gray-600">HR (bpm)</p>
                                                            <p className="font-bold">{vitals.heartRate}</p>
                                                        </div>
                                                    )}
                                                    {vitals.respiratoryRate && (
                                                        <div className="bg-blue-50 p-3 rounded">
                                                            <p className="text-xs text-gray-600">RR</p>
                                                            <p className="font-bold">{vitals.respiratoryRate}</p>
                                                        </div>
                                                    )}
                                                    {vitals.weight && (
                                                        <div className="bg-blue-50 p-3 rounded">
                                                            <p className="text-xs text-gray-600">Weight (kg)</p>
                                                            <p className="font-bold">{vitals.weight}</p>
                                                        </div>
                                                    )}
                                                    {vitals.height && (
                                                        <div className="bg-blue-50 p-3 rounded">
                                                            <p className="text-xs text-gray-600">Height (cm)</p>
                                                            <p className="font-bold">{vitals.height}</p>
                                                        </div>
                                                    )}
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
                                                {encounter.assessment && (
                                                    <div className="bg-gray-50 p-4 rounded">
                                                        <p className="font-semibold text-gray-700 mb-2">Assessment:</p>
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
                                                {currentPrescriptions.map(rx => (
                                                    <div key={rx._id} className="bg-pink-50 p-4 rounded border">
                                                        <div className="flex justify-between items-start">
                                                            <div className="flex-1">
                                                                {rx.medicines.map((med, idx) => (
                                                                    <div key={idx} className="mb-2">
                                                                        <p className="font-semibold text-lg">{med.name}</p>
                                                                        <p className="text-sm text-gray-600">
                                                                            {med.dosage} - {med.frequency} - {med.duration}
                                                                        </p>
                                                                    </div>
                                                                ))}
                                                                <p className="text-sm text-gray-600">Prescribed: {new Date(rx.createdAt).toLocaleString()}</p>
                                                            </div>
                                                            <div className="flex gap-2 ml-4">
                                                                <span className={`text-xs px-3 py-1 rounded ${rx.charge?.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                                    {rx.charge?.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                                </span>
                                                                <span className={`text-xs px-3 py-1 rounded ${rx.status === 'dispensed' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
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
                                        ) : (
                                            <p className="text-gray-500">No prescriptions yet. Click "Add Prescription" to prescribe medications.</p>
                                        )}
                                    </div>
                                )}

                                {/* Clinical Notes Tab */}
                                {activeTab === 'notes' && encounter.type === 'Inpatient' && (
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
                                    <textarea
                                        className="w-full border p-3 rounded"
                                        rows="3"
                                        value={soapNote.assessment}
                                        onChange={(e) => setSoapNote({ ...soapNote, assessment: e.target.value })}
                                        placeholder="Diagnosis, clinical impression..."
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
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">Select Test</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={selectedLabTest}
                                        onChange={(e) => setSelectedLabTest(e.target.value)}
                                    >
                                        <option value="">-- Select Test --</option>
                                        {labCharges.map(charge => (
                                            <option key={charge._id} value={charge._id}>
                                                {charge.name} - ${charge.basePrice}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePlaceLabOrder}
                                        disabled={!selectedLabTest}
                                        className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 font-semibold"
                                    >
                                        Place Order
                                    </button>
                                    <button
                                        onClick={() => setShowLabModal(false)}
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
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">Select Study</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={selectedRadTest}
                                        onChange={(e) => setSelectedRadTest(e.target.value)}
                                    >
                                        <option value="">-- Select Study --</option>
                                        {radiologyCharges.map(charge => (
                                            <option key={charge._id} value={charge._id}>
                                                {charge.name} - ${charge.basePrice}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePlaceRadiologyOrder}
                                        disabled={!selectedRadTest}
                                        className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400 font-semibold"
                                    >
                                        Place Order
                                    </button>
                                    <button
                                        onClick={() => setShowRadModal(false)}
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
                                    <textarea
                                        className="w-full border p-3 rounded"
                                        rows="3"
                                        value={soapNote.assessment}
                                        onChange={(e) => setSoapNote({ ...soapNote, assessment: e.target.value })}
                                        placeholder="Diagnosis, clinical impression..."
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
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">Select Test</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={selectedLabTest}
                                        onChange={(e) => setSelectedLabTest(e.target.value)}
                                    >
                                        <option value="">-- Select Test --</option>
                                        {labCharges.map(charge => (
                                            <option key={charge._id} value={charge._id}>
                                                {charge.name} - ${charge.basePrice}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePlaceLabOrder}
                                        disabled={!selectedLabTest}
                                        className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 font-semibold"
                                    >
                                        Place Order
                                    </button>
                                    <button
                                        onClick={() => setShowLabModal(false)}
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
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">Select Study</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={selectedRadTest}
                                        onChange={(e) => setSelectedRadTest(e.target.value)}
                                    >
                                        <option value="">-- Select Study --</option>
                                        {radiologyCharges.map(charge => (
                                            <option key={charge._id} value={charge._id}>
                                                {charge.name} - ${charge.basePrice}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePlaceRadiologyOrder}
                                        disabled={!selectedRadTest}
                                        className="bg-indigo-600 text-white px-6 py-2 rounded hover:bg-indigo-700 disabled:bg-gray-400 font-semibold"
                                    >
                                        Place Order
                                    </button>
                                    <button
                                        onClick={() => setShowRadModal(false)}
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

            {/* Prescription Modal */}
            {
                showRxModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 w-full max-w-lg">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold">Add Prescription</h3>
                                <button onClick={() => setShowRxModal(false)} className="text-gray-500 hover:text-gray-700">
                                    <FaTimes size={24} />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-gray-700 mb-2 font-semibold">Select Drug (from Inventory)</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={selectedDrug}
                                        onChange={(e) => setSelectedDrug(e.target.value)}
                                    >
                                        <option value="">-- Select Drug --</option>
                                        {inventoryDrugs.map(drug => (
                                            <option key={drug._id} value={drug._id}>
                                                {drug.name} - ₦{drug.price} (Stock: {drug.quantity})
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">Only drugs with available stock are shown</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">Quantity</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={drugQuantity}
                                            onChange={(e) => setDrugQuantity(parseInt(e.target.value))}
                                            min="1"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">Dosage</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={drugDosage}
                                            onChange={(e) => setDrugDosage(e.target.value)}
                                            placeholder="e.g., 500mg"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">Frequency</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={drugFrequency}
                                            onChange={(e) => setDrugFrequency(e.target.value)}
                                            placeholder="e.g., Twice daily"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-700 mb-2 font-semibold">Duration</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={drugDuration}
                                            onChange={(e) => setDrugDuration(e.target.value)}
                                            placeholder="e.g., 7 days"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={handlePrescribeDrug}
                                        disabled={!selectedDrug}
                                        className="bg-pink-600 text-white px-6 py-2 rounded hover:bg-pink-700 disabled:bg-gray-400 font-semibold"
                                    >
                                        Prescribe
                                    </button>
                                    <button
                                        onClick={() => setShowRxModal(false)}
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

            {/* Appointment Modal */}
            <AppointmentModal
                isOpen={showAppointmentModal}
                onClose={() => setShowAppointmentModal(false)}
                onSuccess={() => setShowAppointmentModal(false)}
                patientId={id}
                doctorId={user._id} // Pre-fill current doctor
                user={user}
            />
        </Layout >
    );
};

export default PatientDetails;
