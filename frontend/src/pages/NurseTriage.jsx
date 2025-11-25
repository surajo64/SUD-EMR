import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaUserMd, FaSearch, FaCheckCircle, FaNotesMedical, FaHeartbeat, FaMoneyBillWave, FaTrash, FaEdit } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

const NurseTriage = () => {
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [encounters, setEncounters] = useState([]);
    const [selectedEncounter, setSelectedEncounter] = useState(null);
    const [receiptNumber, setReceiptNumber] = useState('');
    const [receiptValidated, setReceiptValidated] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [nursingNotesList, setNursingNotesList] = useState([]);
    const [noteForm, setNoteForm] = useState({
        selectedServiceId: '',
        comment: '',
        editingNoteId: null
    });
    const [existingVitals, setExistingVitals] = useState([]);
    const [editingVitalId, setEditingVitalId] = useState(null);
    const [vitals, setVitals] = useState({
        temperature: '',
        bloodPressure: '',
        heartRate: '',
        respiratoryRate: '',
        weight: '',
        height: '',
        spo2: ''
    });

    // Nursing Charges State
    const [nursingCharges, setNursingCharges] = useState([]);
    const [encounterCharges, setEncounterCharges] = useState([]);
    const [chargeForm, setChargeForm] = useState({
        selectedChargeId: '',
        quantity: 1,
        notes: ''
    });
    const [editingChargeId, setEditingChargeId] = useState(null);
    const [showChargesModal, setShowChargesModal] = useState(false);
    const [showNurseNoteModal, setShowNurseNoteModal] = useState(false);

    const { user } = useContext(AuthContext);

    useEffect(() => {
        if (user) {
            fetchDoctors();
            fetchNursingCharges();
        }
    }, [user]);

    const fetchNursingCharges = async () => {
        try {
            // setLoading(true); // Optional: might not want to block UI for background fetch
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/charges?type=nursing&active=true', config);
            setNursingCharges(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDoctors = async () => {
        if (!user) return;
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/users/doctors', config);
            setDoctors(data);
        } catch (error) {
            console.error(error);
        }
    };

    const searchPatients = async () => {
        if (!searchTerm || !user) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients', config);
            const filtered = data.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.mrn && p.mrn.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setPatients(filtered);
        } catch (error) {
            console.error(error);
            toast.error('Error searching patients');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPatient = async (patient) => {
        setSelectedPatient(patient);
        setSelectedEncounter(null);
        setReceiptValidated(false);
        setReceiptNumber('');
        setExistingVitals([]);

        // Fetch patient's encounters
        try {
            if (!user) return;
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/visits', config);
            const patientEncounters = data.filter(v =>
                (v.patient._id === patient._id || v.patient === patient._id) &&
                (v.encounterStatus === 'payment_pending' || v.encounterStatus === 'in_nursing' || v.encounterStatus === 'registered' || v.encounterStatus === 'with_doctor' ||
                    v.encounterStatus === 'completed' || v.encounterStatus === 'cancelled' || v.encounterStatus === 'discharged' || v.encounterStatus === 'in_ward')
            );
            // Sort encounters by creation date - latest first
            patientEncounters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setEncounters(patientEncounters);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching encounters');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectEncounter = async (encounter) => {
        setSelectedEncounter(encounter);

        // Check if already validated
        if (encounter.paymentValidated) {
            setReceiptValidated(true);
            setReceiptNumber(encounter.receiptNumber || 'PRE-VALIDATED');
        } else {
            setReceiptValidated(false);
            setReceiptNumber('');
        }

        try {
            setLoading(true);
            if (!user) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Fetch existing vitals
            try {
                const { data } = await axios.get(`http://localhost:5000/api/vitals/visit/${encounter._id}`, config);
                setExistingVitals(data);
            } catch (error) {
                console.error(error);
            }

            // Fetch encounter charges
            await fetchEncounterCharges(encounter._id);

            // Pre-fill doctor if assigned
            if (encounter.consultingPhysician) {
                setSelectedDoctor(encounter.consultingPhysician._id || encounter.consultingPhysician);
            }
            // Parse nursing notes from JSON if exists
            if (encounter.nursingNotes) {
                try {
                    const notes = JSON.parse(encounter.nursingNotes);
                    setNursingNotesList(Array.isArray(notes) ? notes : []);
                } catch (e) {
                    // If it's old format (plain string), ignore or migrate
                    setNursingNotesList([]);
                }
            } else {
                setNursingNotesList([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleValidateReceipt = async () => {
        if (!receiptNumber.trim()) {
            toast.error('Please enter receipt number');
            return;
        }

        try {
            setLoading(true);
            if (!user) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const response = await axios.post(
                'http://localhost:5000/api/receipts/validate',
                { receiptNumber: receiptNumber.trim(), department: 'Nursing' },
                config
            );

            if (response.data.valid) {
                setReceiptValidated(true);
                toast.success('Receipt validated! You can now proceed with patient care.');

                // Update encounter status
                if (selectedEncounter) {
                    await axios.put(
                        `http://localhost:5000/api/visits/${selectedEncounter._id}`,
                        {
                            encounterStatus: 'in_nursing',
                            paymentValidated: true,
                            receiptNumber: receiptNumber.trim()
                        },
                        config
                    );
                    // Update local state to reflect change
                    setSelectedEncounter({
                        ...selectedEncounter,
                        paymentValidated: true,
                        receiptNumber: receiptNumber.trim()
                    });
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Invalid receipt number');
            setReceiptValidated(false);
        } finally {
            setLoading(false);
        }
    };

    const handleEditVital = (vital) => {
        setEditingVitalId(vital._id);
        setVitals({
            temperature: vital.temperature || '',
            bloodPressure: vital.bloodPressure || '',
            heartRate: vital.pulseRate || '',
            respiratoryRate: vital.respiratoryRate || '',
            weight: vital.weight || '',
            height: vital.height || '',
            spo2: vital.spo2 || ''
        });
        // Scroll to form
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingVitalId(null);
        setVitals({
            temperature: '', bloodPressure: '', heartRate: '',
            respiratoryRate: '', weight: '', height: '', spo2: ''
        });
    };

    const handleRecordVitals = async () => {
        // Check if at least one vital is entered
        if (!vitals.temperature && !vitals.bloodPressure && !vitals.heartRate && !vitals.weight && !vitals.respiratoryRate && !vitals.height && !vitals.spo2) {
            toast.warning('Please enter at least one vital sign');
            return;
        }

        try {
            setLoading(true);
            if (!user) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editingVitalId) {
                // Update existing vital
                await axios.put(
                    `http://localhost:5000/api/vitals/${editingVitalId}`,
                    {
                        ...vitals,
                        pulseRate: vitals.heartRate // Map heartRate back to pulseRate
                    },
                    config
                );
                toast.success('Vitals updated successfully!');
                setEditingVitalId(null);
            } else {
                // Create new vital
                await axios.post(
                    'http://localhost:5000/api/vitals',
                    {
                        patientId: selectedPatient._id,
                        encounterId: selectedEncounter._id,
                        ...vitals,
                        pulseRate: vitals.heartRate // Map heartRate back to pulseRate
                    },
                    config
                );
                toast.success('Vitals recorded successfully!');
            }

            // Refresh vitals list
            const { data } = await axios.get(`http://localhost:5000/api/vitals/visit/${selectedEncounter._id}`, config);
            setExistingVitals(data);

            // Clear form
            setVitals({
                temperature: '', bloodPressure: '', heartRate: '',
                respiratoryRate: '', weight: '', height: '', spo2: ''
            });
        } catch (error) {
            console.error(error);
            toast.error('Error recording vitals');
        } finally {
            setLoading(false);
        }
    };



    const fetchEncounterCharges = async (encounterId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`http://localhost:5000/api/encounter-charges/encounter/${encounterId}`, config);
            setEncounterCharges(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddCharge = async () => {
        if (!chargeForm.selectedChargeId) {
            toast.error('Please select a service');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editingChargeId) {
                await axios.put(
                    `http://localhost:5000/api/encounter-charges/${editingChargeId}`,
                    {
                        quantity: chargeForm.quantity,
                        notes: chargeForm.notes
                    },
                    config
                );
                toast.success('Charge updated');
                setEditingChargeId(null);
            } else {
                await axios.post(
                    'http://localhost:5000/api/encounter-charges',
                    {
                        encounterId: selectedEncounter._id,
                        patientId: selectedPatient._id,
                        chargeId: chargeForm.selectedChargeId,
                        quantity: chargeForm.quantity,
                        notes: chargeForm.notes
                    },
                    config
                );
                toast.success('Charge added');
            }

            setChargeForm({ selectedChargeId: '', quantity: 1, notes: '' });
            fetchEncounterCharges(selectedEncounter._id);
            setShowChargesModal(false); // Auto-close modal after submission
        } catch (error) {
            console.error(error);
            toast.error('Error saving charge');
        } finally {
            setLoading(false);
        }
    };

    const handleEditCharge = (charge) => {
        if (charge.status !== 'pending') {
            toast.error('Cannot edit processed charges');
            return;
        }
        setEditingChargeId(charge._id);
        setChargeForm({
            selectedChargeId: charge.charge._id,
            quantity: charge.quantity,
            notes: charge.notes || ''
        });
        setShowChargesModal(true); // Open modal for editing
    };

    const handleDeleteCharge = async (id) => {
        if (!window.confirm('Are you sure you want to remove this charge?')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/encounter-charges/${id}`, config);
            toast.success('Charge removed');
            fetchEncounterCharges(selectedEncounter._id);
        } catch (error) {
            console.error(error);
            toast.error('Error removing charge');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelChargeEdit = () => {
        setEditingChargeId(null);
        setChargeForm({ selectedChargeId: '', quantity: 1, notes: '' });
    };

    // Nursing Notes CRUD Functions
    // Helper function to save notes to backend
    const saveNotesToBackend = async (notes) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/visits/${selectedEncounter._id}`, {
                nursingNotes: JSON.stringify(notes)
            }, config);
        } catch (error) {
            console.error("Failed to save notes", error);
            toast.error("Failed to save note to server");
        }
    };

    // Nursing Notes CRUD Functions
    const handleAddNote = async () => {
        if (!noteForm.selectedServiceId || !noteForm.comment.trim()) {
            toast.error('Please select a service and add a comment');
            return;
        }

        const selectedService = nursingCharges.find(c => c._id === noteForm.selectedServiceId);
        let updatedNotesList;

        if (noteForm.editingNoteId) {
            // Update existing note
            updatedNotesList = nursingNotesList.map(note =>
                note.id === noteForm.editingNoteId
                    ? {
                        ...note,
                        service: { _id: selectedService._id, name: selectedService.name },
                        comment: noteForm.comment,
                        updatedAt: new Date().toISOString()
                    }
                    : note
            );
            toast.success('Note updated');
        } else {
            // Add new note
            const newNote = {
                id: Date.now().toString(), // Temporary ID
                service: { _id: selectedService._id, name: selectedService.name },
                comment: noteForm.comment,
                nurse: { _id: user._id, name: user.name },
                createdAt: new Date().toISOString()
            };
            updatedNotesList = [...nursingNotesList, newNote];
            toast.success('Note added');
        }

        setNursingNotesList(updatedNotesList);
        await saveNotesToBackend(updatedNotesList);

        // Reset form and close modal
        setNoteForm({ selectedServiceId: '', comment: '', editingNoteId: null });
        setShowNurseNoteModal(false);
    };

    const handleEditNote = (note) => {
        setNoteForm({
            selectedServiceId: note.service._id,
            comment: note.comment,
            editingNoteId: note.id
        });
        setShowNurseNoteModal(true);
    };

    const handleDeleteNote = async (id) => {
        if (!window.confirm('Are you sure you want to delete this note?')) return;
        const updatedNotesList = nursingNotesList.filter(note => note.id !== id);
        setNursingNotesList(updatedNotesList);
        await saveNotesToBackend(updatedNotesList);
        toast.success('Note deleted');
    };

    const handleCancelNoteEdit = () => {
        setNoteForm({ selectedServiceId: '', comment: '', editingNoteId: null });
    };
    // Check if the selected encounter is read-only (completed, cancelled, discharged)
    const isReadOnly = selectedEncounter && (
        selectedEncounter.encounterStatus === 'completed' ||
        selectedEncounter.encounterStatus === 'cancelled' ||
        selectedEncounter.encounterStatus === 'discharged'
    );

    const handleFinishTriage = async () => {
        if (!selectedEncounter || !user || isReadOnly) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // 1. Save Vitals (if any new ones entered)
            if (vitals.temperature || vitals.bloodPressure || vitals.heartRate || vitals.respiratoryRate || vitals.weight || vitals.height) {
                await axios.post('http://localhost:5000/api/vitals', {
                    visitId: selectedEncounter._id,
                    patientId: selectedPatient._id,
                    ...vitals
                }, config);
            }

            // 2. Update Visit Status to 'with_doctor' AND save Nursing Notes
            await axios.put(`http://localhost:5000/api/visits/${selectedEncounter._id}`, {
                encounterStatus: 'with_doctor',
                nursingNotes: JSON.stringify(nursingNotesList) // Save structured notes
            }, config);

            toast.success('Triage completed! Patient sent to Doctor.');

            // Reset states
            setSelectedEncounter(null);
            setVitals({
                temperature: '',
                bloodPressure: '',
                heartRate: '',
                respiratoryRate: '',
                weight: '',
                height: ''
            });
            setNursingNotesList([]);
            setNoteForm({
                selectedServiceId: '',
                comment: '',
                editingNoteId: null
            });
            handleSelectPatient(selectedPatient); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error('Error finishing triage');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FaUserMd className="text-pink-600" /> Nursing Station / Triage
            </h2>

            {/* Search Patient */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Search Patient
                </h3>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Search by Name or MRN..."
                        className="flex-1 border p-2 rounded"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
                    />
                    <button
                        onClick={searchPatients}
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                    >
                        Search
                    </button>
                </div>

                {/* Patient Results */}
                {patients.length > 0 && !selectedPatient && (
                    <div className="space-y-2">
                        <p className="font-semibold text-gray-700">Search Results:</p>
                        {patients.map(patient => (
                            <div
                                key={patient._id}
                                onClick={() => handleSelectPatient(patient)}
                                className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                            >
                                <p className="font-semibold">{patient.name}</p>
                                <p className="text-sm text-gray-600">
                                    MRN: {patient.mrn} | Age: {patient.age} | {patient.gender}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Selected Patient - Show Encounters */}
                {selectedPatient && !selectedEncounter && (
                    <div>
                        <div className="bg-blue-50 p-4 rounded mb-4">
                            <p className="font-bold text-lg">{selectedPatient.name}</p>
                            <p className="text-sm text-gray-600">MRN: {selectedPatient.mrn}</p>
                            <button
                                onClick={() => {
                                    setSelectedPatient(null);
                                    setEncounters([]);
                                }}
                                className="text-blue-600 text-sm mt-2 hover:underline"
                            >
                                ← Change Patient
                            </button>
                        </div>

                        <p className="font-semibold text-gray-700 mb-3">Select Recent Encounter:</p>
                        {encounters.length === 0 ? (
                            <p className="text-gray-500">No pending encounters for this patient</p>
                        ) : (
                            <div className="space-y-2">
                                {encounters.map(encounter => (
                                    <div
                                        key={encounter._id}
                                        onClick={() => handleSelectEncounter(encounter)}
                                        className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                                    >
                                        <div className="flex justify-between">
                                            <div>
                                                <p className="font-semibold">{encounter.type} Visit</p>
                                                <p className="text-sm text-gray-600">
                                                    {new Date(encounter.createdAt).toLocaleDateString()} - Status: {encounter.encounterStatus}
                                                </p>
                                            </div>
                                            <span className={`px-3 py-1 rounded text-sm ${encounter.paymentValidated
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                {encounter.paymentValidated ? 'Paid' : 'Pending'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Receipt Validation & Nursing Care */}
            {selectedEncounter && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <div className="bg-blue-50 p-4 rounded mb-6 flex justify-between items-center">
                        <div>
                            <p className="font-bold">{selectedPatient.name} - {selectedEncounter.type} Visit</p>
                            <p className="text-sm text-gray-600">
                                {new Date(selectedEncounter.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedEncounter(null)}
                            className="text-blue-600 hover:underline text-sm"
                        >
                            Change Encounter
                        </button>
                    </div>

                    {/* Receipt Validation */}
                    {!receiptValidated && (
                        <div className="border-2 border-yellow-300 bg-yellow-50 p-6 rounded mb-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-800">
                                <FaCheckCircle /> Validate Payment Receipt
                            </h3>
                            <p className="text-sm text-gray-700 mb-4">
                                Please verify that the patient has paid the consultation fee before proceeding.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter Receipt Number (e.g., RCP-123456-7890)"
                                    className="flex-1 border-2 border-yellow-300 p-3 rounded font-mono"
                                    value={receiptNumber}
                                    onChange={(e) => setReceiptNumber(e.target.value.toUpperCase())}
                                />
                                <button
                                    onClick={handleValidateReceipt}
                                    className="bg-yellow-600 text-white px-6 py-3 rounded hover:bg-yellow-700 font-semibold"
                                >
                                    Validate Receipt
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Nursing Care Form */}
                    {receiptValidated && (
                        <div>
                            <div className="bg-green-50 p-4 rounded mb-6">
                                <p className="text-green-700 font-semibold flex items-center gap-2">
                                    <FaCheckCircle /> Payment Validated - Receipt #{receiptNumber}
                                </p>
                            </div>

                            {/* Existing Vitals History */}
                            {existingVitals.length > 0 && (
                                <div className="mb-6 border rounded p-4">
                                    <h4 className="font-bold text-gray-700 mb-2">Previous Vitals for this Visit:</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2">Time</th>
                                                    <th className="p-2">BP</th>
                                                    <th className="p-2">Temp</th>
                                                    <th className="p-2">HR</th>
                                                    <th className="p-2">RR</th>
                                                    <th className="p-2">SpO2</th>
                                                    <th className="p-2">Wt</th>
                                                    <th className="p-2">Ht</th>
                                                    <th className="p-2">Nurse</th>
                                                    <th className="p-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {existingVitals.map((v, idx) => (
                                                    <tr key={idx} className="border-b">
                                                        <td className="p-2">{new Date(v.createdAt).toLocaleTimeString()}</td>
                                                        <td className="p-2">{v.bloodPressure || '-'}</td>
                                                        <td className="p-2">{v.temperature ? `${v.temperature}°C` : '-'}</td>
                                                        <td className="p-2">{v.pulseRate || '-'}</td>
                                                        <td className="p-2">{v.respiratoryRate || '-'}</td>
                                                        <td className="p-2">{v.spo2 ? `${v.spo2}%` : '-'}</td>
                                                        <td className="p-2">{v.weight || '-'}</td>
                                                        <td className="p-2">{v.height || '-'}</td>
                                                        <td className="p-2">{v.nurse?.name || 'Unknown'}</td>
                                                        <td className="p-2">
                                                            {(!isReadOnly) && (
                                                                <button
                                                                    onClick={() => handleEditVital(v)}
                                                                    className="text-blue-600 hover:underline text-xs"
                                                                >
                                                                    Edit
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Assign Physician */}
                            <div className="mb-6">
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Assign Consulting Physician *
                                </label>
                                <select
                                    className="w-full border p-3 rounded"
                                    value={selectedDoctor}
                                    onChange={(e) => setSelectedDoctor(e.target.value)}
                                    required
                                >
                                    <option value="">-- Select Doctor --</option>
                                    {doctors.map(doctor => (
                                        <option key={doctor._id} value={doctor._id}>
                                            {doctor.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Vitals */}
                            <div className="mb-6">
                                <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                                    <FaHeartbeat className="text-red-600" />
                                    {editingVitalId ? 'Edit Vital Signs' : 'Record New Vital Signs'}
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Temperature (°C)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full border p-2 rounded"
                                            value={vitals.temperature}
                                            onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                                            placeholder="37.0"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Blood Pressure (mmHg)</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={vitals.bloodPressure}
                                            onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })}
                                            placeholder="120/80"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Heart Rate (bpm)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={vitals.heartRate}
                                            onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })}
                                            placeholder="72"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Respiratory Rate</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={vitals.respiratoryRate}
                                            onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })}
                                            placeholder="16"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">SpO2 (%)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={vitals.spo2}
                                            onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                                            placeholder="98"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Weight (kg)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full border p-2 rounded"
                                            value={vitals.weight}
                                            onChange={(e) => setVitals({ ...vitals, weight: e.target.value })}
                                            placeholder="70.5"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-600 mb-1">Height (cm)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            className="w-full border p-2 rounded"
                                            value={vitals.height}
                                            onChange={(e) => setVitals({ ...vitals, height: e.target.value })}
                                            placeholder="175"
                                            disabled={isReadOnly}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Nursing Charges - Button to open modal */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-lg flex items-center gap-2">
                                        <FaMoneyBillWave className="text-green-600" /> Nursing Service Charges
                                    </h4>
                                    <div className="flex gap-2">
                                        {!isReadOnly && (
                                            <>
                                                <button
                                                    onClick={() => setShowChargesModal(true)}
                                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaMoneyBillWave /> Add Charge
                                                </button>
                                                <button
                                                    onClick={() => setShowNurseNoteModal(true)}
                                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaNotesMedical /> Add Nurse Note
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Charges Table - Always visible */}
                                {encounterCharges.filter(c => c.charge?.type === 'nursing').length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse border text-sm">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2 text-left">Service</th>
                                                    <th className="p-2 text-center">Qty</th>
                                                    <th className="p-2 text-right">Price</th>
                                                    <th className="p-2 text-right">Total</th>
                                                    <th className="p-2 text-left">Notes</th>
                                                    <th className="p-2 text-center">Status</th>
                                                    <th className="p-2 text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {encounterCharges.filter(c => c.charge?.type === 'nursing').map((charge) => (
                                                    <tr key={charge._id} className="border-b hover:bg-gray-50">
                                                        <td className="p-2">{charge.charge?.name}</td>
                                                        <td className="p-2 text-center">{charge.quantity}</td>
                                                        <td className="p-2 text-right">${charge.charge?.basePrice?.toFixed(2)}</td>
                                                        <td className="p-2 text-right font-bold">${charge.totalAmount?.toFixed(2)}</td>
                                                        <td className="p-2 text-gray-600 italic">{charge.notes || '-'}</td>
                                                        <td className="p-2 text-center">
                                                            <span className={`px-2 py-1 rounded text-xs ${charge.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                                }`}>
                                                                {charge.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            {charge.status === 'pending' && !isReadOnly && (
                                                                <div className="flex justify-center gap-2">
                                                                    <button
                                                                        onClick={() => handleEditCharge(charge)}
                                                                        className="text-blue-600 hover:text-blue-800"
                                                                        title="Edit"
                                                                    >
                                                                        <FaEdit />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteCharge(charge._id)}
                                                                        className="text-red-600 hover:text-red-800"
                                                                        title="Remove"
                                                                    >
                                                                        <FaTrash />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-gray-50 font-bold">
                                                    <td colSpan="3" className="p-2 text-right">Total Pending:</td>
                                                    <td className="p-2 text-right text-blue-800">
                                                        ${encounterCharges
                                                            .filter(c => c.charge?.type === 'nursing' && c.status === 'pending')
                                                            .reduce((sum, c) => sum + c.totalAmount, 0)
                                                            .toFixed(2)}
                                                    </td>
                                                    <td colSpan="3"></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Nursing Notes List */}
                            {nursingNotesList.length > 0 && (
                                <div className="mb-6 border rounded p-4 bg-blue-50">
                                    <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <FaNotesMedical className="text-blue-600" /> Nursing Notes
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse border text-sm bg-white">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2 text-left border">Service</th>
                                                    <th className="p-2 text-left border">Comment</th>
                                                    <th className="p-2 text-left border">Nurse</th>
                                                    <th className="p-2 text-left border">Time</th>
                                                    <th className="p-2 text-center border">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {nursingNotesList.map((note) => (
                                                    <tr key={note.id} className="border-b hover:bg-gray-50">
                                                        <td className="p-2 border font-semibold text-blue-700">{note.service.name}</td>
                                                        <td className="p-2 border text-gray-700">{note.comment}</td>
                                                        <td className="p-2 border text-gray-600">{note.nurse?.name || 'Unknown'}</td>
                                                        <td className="p-2 border text-gray-600 text-xs">
                                                            {new Date(note.createdAt).toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border text-center">
                                                            {!isReadOnly && (
                                                                <div className="flex justify-center gap-2">
                                                                    <button
                                                                        onClick={() => handleEditNote(note)}
                                                                        className="text-blue-600 hover:text-blue-800"
                                                                        title="Edit"
                                                                    >
                                                                        <FaEdit />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteNote(note.id)}
                                                                        className="text-red-600 hover:text-red-800"
                                                                        title="Delete"
                                                                    >
                                                                        <FaTrash />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4 mt-6">
                                {editingVitalId && (
                                    <button
                                        onClick={handleCancelEdit}
                                        className="bg-gray-500 text-white px-6 py-3 rounded hover:bg-gray-600 font-bold"
                                    >
                                        Cancel Edit
                                    </button>
                                )}
                                <button
                                    onClick={async () => {
                                        if (isReadOnly) return;
                                        // First record/update vitals if any are entered
                                        const hasVitals = vitals.temperature || vitals.bloodPressure || vitals.heartRate || vitals.weight || vitals.respiratoryRate || vitals.height || vitals.spo2;
                                        if (hasVitals) {
                                            await handleRecordVitals();
                                        }
                                        // Then finish triage
                                        await handleFinishTriage();
                                    }}
                                    disabled={isReadOnly}
                                    className={`flex-1 px-6 py-3 rounded font-bold flex items-center justify-center gap-2 ${isReadOnly ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                                >
                                    <FaCheckCircle /> {isReadOnly ? 'Encounter Completed' : (editingVitalId ? 'Update Vitals & Send to Doctor' : 'Record Vitals & Send to Doctor')}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )
            }

            {/* Nursing Charges Modal */}
            {
                showChargesModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            {/* Modal Header */}
                            <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <FaMoneyBillWave /> Add Nursing Service Charge
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowChargesModal(false);
                                        setEditingChargeId(null);
                                        setChargeForm({ selectedChargeId: '', quantity: 1, notes: '' });
                                    }}
                                    className="text-white hover:text-gray-200 text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6">
                                <div className="bg-gray-50 p-4 rounded mb-4 border">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm text-gray-700 mb-2 font-semibold">Service *</label>
                                            <select
                                                className="w-full border p-3 rounded"
                                                value={chargeForm.selectedChargeId}
                                                onChange={(e) => setChargeForm({ ...chargeForm, selectedChargeId: e.target.value })}
                                                disabled={!!editingChargeId}
                                            >
                                                <option value="">-- Select Service --</option>
                                                {nursingCharges.map(charge => (
                                                    <option key={charge._id} value={charge._id}>
                                                        {charge.name} - ${charge.basePrice.toFixed(2)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-700 mb-2 font-semibold">Quantity *</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full border p-3 rounded"
                                                value={chargeForm.quantity}
                                                onChange={(e) => setChargeForm({ ...chargeForm, quantity: parseInt(e.target.value) || 1 })}
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm text-gray-700 mb-2 font-semibold">Notes (Optional)</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={chargeForm.notes}
                                            onChange={(e) => setChargeForm({ ...chargeForm, notes: e.target.value })}
                                            placeholder="Additional details..."
                                        ></textarea>
                                    </div>

                                    {/* Total Preview */}
                                    {chargeForm.selectedChargeId && (
                                        <div className="bg-blue-50 p-3 rounded">
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold">Total:</span>
                                                <span className="font-bold text-xl text-blue-700">
                                                    ${
                                                        (nursingCharges.find(c => c._id === chargeForm.selectedChargeId)?.basePrice || 0) * chargeForm.quantity
                                                    }.00
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-gray-50 p-4 rounded-b-lg flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowChargesModal(false);
                                        setEditingChargeId(null);
                                        setChargeForm({ selectedChargeId: '', quantity: 1, notes: '' });
                                    }}
                                    className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddCharge}
                                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 font-semibold"
                                    disabled={!chargeForm.selectedChargeId}
                                >
                                    <FaMoneyBillWave /> {editingChargeId ? 'Update Charge' : 'Add Charge'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Nursing Notes Modal */}
            {
                showNurseNoteModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            {/* Modal Header */}
                            <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <FaNotesMedical /> Nursing Notes
                                </h3>
                                <button
                                    onClick={() => setShowNurseNoteModal(false)}
                                    className="text-white hover:text-gray-200 text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6">
                                <div className="bg-gray-50 p-4 rounded mb-4 border">
                                    <div className="mb-4">
                                        <label className="block text-sm text-gray-700 mb-2 font-semibold">
                                            Nursing Service *
                                        </label>
                                        <select
                                            className="w-full border p-3 rounded"
                                            value={noteForm.selectedServiceId}
                                            onChange={(e) => setNoteForm({ ...noteForm, selectedServiceId: e.target.value })}
                                        >
                                            <option value="">-- Select Service --</option>
                                            {nursingCharges.map(charge => (
                                                <option key={charge._id} value={charge._id}>
                                                    {charge.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-700 mb-2 font-semibold">
                                            Comment / Details *
                                        </label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="6"
                                            value={noteForm.comment}
                                            onChange={(e) => setNoteForm({ ...noteForm, comment: e.target.value })}
                                            placeholder="Describe what was done, observations, patient response, etc..."
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-gray-50 p-4 rounded-b-lg flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowNurseNoteModal(false);
                                        handleCancelNoteEdit();
                                    }}
                                    className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddNote}
                                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2 font-semibold"
                                    disabled={!noteForm.selectedServiceId || !noteForm.comment.trim()}
                                >
                                    <FaNotesMedical /> {noteForm.editingNoteId ? 'Update Note' : 'Add Note'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </Layout >
    );
};

export default NurseTriage;
