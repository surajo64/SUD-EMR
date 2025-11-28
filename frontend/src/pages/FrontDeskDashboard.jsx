import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaUserPlus, FaCalendarCheck, FaDollarSign, FaSearch, FaFileAlt, FaPlus, FaTimes, FaClock, FaCalendarAlt, FaBed } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

const FrontDeskDashboard = () => {
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState([]);
    const [recentPatients, setRecentPatients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [showEncounterModal, setShowEncounterModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [patientEncounters, setPatientEncounters] = useState({}); // Store encounters by patient ID

    // Charges, Clinics
    const [charges, setCharges] = useState([]);
    const [clinics, setClinics] = useState([]);
    const [selectedCharges, setSelectedCharges] = useState([]);
    const [selectedClinic, setSelectedClinic] = useState('');
    const [encounterType, setEncounterType] = useState('Outpatient');
    const [reasonForVisit, setReasonForVisit] = useState('');

    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBed, setSelectedBed] = useState('');
    const [wards, setWards] = useState([]);
    const [availableBeds, setAvailableBeds] = useState([]);

    const { user } = useContext(AuthContext);

    // New Patient Form
    const [newPatient, setNewPatient] = useState({
        name: '',
        age: '',
        gender: 'male',
        contact: '',
        address: '',
        provider: 'Standard',
        hmo: '',
        insuranceNumber: '',
        emergencyContactName: '',
        emergencyContactPhone: ''
    });

    useEffect(() => {
        fetchPatientEncounters();
        fetchPatients();
        fetchRecentPatients();
        fetchCharges();
        fetchClinics();
        fetchWards();
    }, []);

    const fetchWards = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/wards', config);
            setWards(data);
        } catch (error) {
            console.error('Error fetching wards:', error);
        }
    };

    useEffect(() => {
        if (selectedWard) {
            const ward = wards.find(w => w._id === selectedWard);
            if (ward) {
                setAvailableBeds(ward.beds.filter(b => !b.isOccupied));
            }
        } else {
            setAvailableBeds([]);
        }
    }, [selectedWard, wards]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = patients.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.mrn && p.mrn.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setFilteredPatients(filtered);
        } else {
            setFilteredPatients([]);
        }
    }, [searchTerm, patients]);

    const fetchPatients = async () => {
        try {

            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients', config);
            setPatients(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patients');
        }
    };

    const fetchRecentPatients = async () => {
        try {

            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients/recent', config);
            setRecentPatients(data);

            // Fetch encounters for each recent patient
            const encountersMap = {};
            for (const patient of data) {
                const encounters = await fetchPatientEncounters(patient._id);
                encountersMap[patient._id] = encounters;
            }
            setPatientEncounters(encountersMap);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching recent patients');
        }
    };

    const fetchCharges = async () => {
        try {

            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/charges?active=true', config);
            // Filter to only show consultation charges
            const consultationCharges = data.filter(charge => charge.type === 'consultation');
            setCharges(consultationCharges);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching charges');
        }
    };

    const fetchClinics = async () => {
        try {

            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/clinics?active=true', config);
            setClinics(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching clinics');
        }
    };

    const fetchPatientEncounters = async (patientId) => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`http://localhost:5000/api/visits/patient/${patientId}`, config);
            return data;
        } catch (error) {
            console.error(error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    // Load encounters for filtered patients when search term changes
    useEffect(() => {
        if (searchTerm && filteredPatients.length > 0) {
            filteredPatients.forEach((patient) => {
                if (!patientEncounters[patient._id]) {
                    fetchPatientEncounters(patient._id).then((encounters) => {
                        setPatientEncounters((prev) => ({
                            ...prev,
                            [patient._id]: encounters,
                        }));
                    });
                }
            });
        }
    }, [searchTerm, filteredPatients]);

    const hasEncounterToday = (patientId) => {
        const encounters = patientEncounters[patientId] || [];
        const today = new Date().toDateString();
        return encounters.some(encounter => {
            const encounterDate = new Date(encounter.createdAt).toDateString();
            return encounterDate === today;
        });
    };

    const hasActiveInpatientEncounter = (patientId) => {
        const encounters = patientEncounters[patientId] || [];
        return encounters.some(encounter =>
            encounter.type === 'Inpatient' && encounter.encounterStatus !== 'discharged'
        );
    };

    const handleRegisterPatient = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post('http://localhost:5000/api/patients', newPatient, config);
            toast.success('Patient Registered Successfully!');
            setNewPatient({
                name: '', age: '', gender: 'male', contact: '', address: '',
                provider: 'Standard', hmo: '', insuranceNumber: '', emergencyContactName: '', emergencyContactPhone: ''
            });
            setShowRegisterForm(false);
            fetchPatients();
            fetchRecentPatients();
        } catch (error) {
            console.error(error);
            toast.error('Error registering patient');
        } finally {
            setLoading(false);
        }
    };

    const openEncounterModal = (patient) => {
        // 1. Check for active Inpatient encounter (must be discharged first)
        if (hasActiveInpatientEncounter(patient._id)) {
            toast.warning(`${patient.name} has an active Inpatient encounter. They must be discharged before creating a new encounter.`);
            return;
        }

        // 2. Check if patient already has an encounter today (for non-inpatient logic)
        if (hasEncounterToday(patient._id)) {
            toast.warning(`${patient.name} already has an encounter created today. Cannot create another encounter.`);
            return;
        }

        setSelectedPatient(patient);
        setSelectedCharges([]);
        setSelectedClinic('');
        setEncounterType('Outpatient');
        setShowEncounterModal(true);
    };

    const closeEncounterModal = () => {
        setShowEncounterModal(false);
        setSelectedPatient(null);
        setSelectedCharges([]);
        setSelectedClinic('');
        setEncounterType('Outpatient');
        setReasonForVisit('');
        setSelectedWard('');
        setSelectedBed('');
    };

    const handleChargeToggle = (chargeId) => {
        setSelectedCharges(prev => {
            if (prev.includes(chargeId)) {
                return prev.filter(id => id !== chargeId);
            } else {
                return [...prev, chargeId];
            }
        });
    };

    const handleCreateEncounter = async () => {
        if (!selectedPatient) {
            toast.error('No patient selected');
            return;
        }

        if (encounterType !== 'External Investigation' && encounterType !== 'Inpatient' && selectedCharges.length === 0) {
            toast.error('Please select at least one charge');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // 1. Create Visit/Encounter
            const visitData = {
                patientId: selectedPatient._id,
                doctorId: user._id,
                type: encounterType,
                encounterType: encounterType,
                clinic: selectedClinic || undefined,
                subjective: `Encounter created at Front Desk`,
                reasonForVisit: reasonForVisit,
                encounterStatus: 'registered',
                ward: encounterType === 'Inpatient' ? selectedWard : undefined,
                bed: encounterType === 'Inpatient' ? selectedBed : undefined
            };
            const visitResponse = await axios.post('http://localhost:5000/api/visits', visitData, config);

            // 2. Add all selected charges to encounter
            for (const chargeId of selectedCharges) {
                const chargeData = {
                    encounterId: visitResponse.data._id,
                    patientId: selectedPatient._id,
                    chargeId: chargeId,
                    quantity: 1,
                    notes: 'Added at registration'
                };
                await axios.post('http://localhost:5000/api/encounter-charges', chargeData, config);
            }

            // 3. Calculate total and update encounter status
            const selectedChargeObjects = charges.filter(c => selectedCharges.includes(c._id));
            const totalAmount = selectedChargeObjects.reduce((sum, c) => sum + c.basePrice, 0);

            if (encounterType !== 'External Investigation' && encounterType !== 'Inpatient') {
                const newStatus = totalAmount > 0 ? 'payment_pending' : 'in_nursing';
                await axios.put(
                    `http://localhost:5000/api/visits/${visitResponse.data._id}`,
                    { encounterStatus: newStatus },
                    config
                );
            }

            toast.success(`Encounter created! Total charges: $${totalAmount.toFixed(2)}`);
            closeEncounterModal();
            fetchRecentPatients();
        } catch (error) {
            console.error(error);
            const message = error.response?.data?.message || 'Error creating encounter';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    // Group charges by type
    const chargesByType = charges.reduce((acc, charge) => {
        if (!acc[charge.type]) {
            acc[charge.type] = [];
        }
        acc[charge.type].push(charge);
        return acc;
    }, {});

    const chargeTypeLabels = {
        consultation: 'Consultation',
        card: 'Hospital Card',
        lab: 'Lab Investigation',
        radiology: 'Radiology Investigation',
        drugs: 'Drug Purchase',
        nursing: 'Nursing Service',
        other: 'Other'
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaUserPlus className="text-green-600" /> Front Desk
                </h2>
                <div className="flex gap-2">

                    <button
                        onClick={() => setShowRegisterForm(!showRegisterForm)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                    >
                        <FaUserPlus /> Register New Patient
                    </button>
                </div>
            </div>

            {/* Register Patient Form */}
            {showRegisterForm && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h3 className="text-xl font-bold mb-4">New Patient Registration</h3>
                    <form onSubmit={handleRegisterPatient} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Full Name *"
                            className="border p-2 rounded"
                            value={newPatient.name}
                            onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                            required
                        />
                        <input
                            type="number"
                            placeholder="Age *"
                            className="border p-2 rounded"
                            value={newPatient.age}
                            onChange={(e) => setNewPatient({ ...newPatient, age: e.target.value })}
                            required
                        />
                        <select
                            className="border p-2 rounded"
                            value={newPatient.gender}
                            onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })}
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                        <input
                            type="text"
                            placeholder="Contact Number *"
                            className="border p-2 rounded"
                            value={newPatient.contact}
                            onChange={(e) => setNewPatient({ ...newPatient, contact: e.target.value })}
                            required
                        />
                        <input
                            type="text"
                            placeholder="Address"
                            className="border p-2 rounded md:col-span-2"
                            value={newPatient.address}
                            onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })}
                        />
                        <select
                            className="border p-2 rounded"
                            value={newPatient.provider}
                            onChange={(e) => setNewPatient({ ...newPatient, provider: e.target.value })}
                        >
                            <option value="Standard">Standard</option>
                            <option value="Retainership">Retainership</option>
                            <option value="NHIA">NHIA</option>
                            <option value="KSCHMA">KSCHMA</option>
                        </select>
                        {newPatient.provider === 'NHIA' && (
                            <input
                                type="text"
                                placeholder="HMO *"
                                className="border p-2 rounded"
                                value={newPatient.hmo}
                                onChange={(e) => setNewPatient({ ...newPatient, hmo: e.target.value })}
                                required
                            />
                        )}
                        <input
                            type="text"
                            placeholder="Insurance Number (Optional)"
                            className="border p-2 rounded"
                            value={newPatient.insuranceNumber}
                            onChange={(e) => setNewPatient({ ...newPatient, insuranceNumber: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Emergency Contact Name"
                            className="border p-2 rounded"
                            value={newPatient.emergencyContactName}
                            onChange={(e) => setNewPatient({ ...newPatient, emergencyContactName: e.target.value })}
                        />
                        <input
                            type="text"
                            placeholder="Emergency Contact Phone"
                            className="border p-2 rounded"
                            value={newPatient.emergencyContactPhone}
                            onChange={(e) => setNewPatient({ ...newPatient, emergencyContactPhone: e.target.value })}
                        />
                        <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 md:col-span-2">
                            Register Patient
                        </button>
                    </form>
                </div>
            )}

            {/* Search Patients */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch className="text-purple-600" /> Search Patients
                </h3>
                <div className="mb-4 relative">
                    <FaSearch className="absolute left-3 top-3 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search patient by name or MRN..."
                        className="w-full pl-10 p-2 border rounded"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {searchTerm && (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredPatients.map((patient) => {
                            const hasTodayEncounter = hasEncounterToday(patient._id);

                            return (
                                <div
                                    key={patient._id}
                                    className="flex justify-between items-center border p-3 rounded hover:bg-gray-50"
                                >
                                    <div>
                                        <p className="font-semibold">{patient.name}</p>
                                        <p className="text-sm text-gray-600">
                                            MRN: {patient.mrn} | Age: {patient.age} | {patient.gender}
                                        </p>
                                        {hasTodayEncounter && (
                                            <p className="text-xs text-orange-600 mt-1">
                                                ⚠ Already has an encounter today
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => !hasTodayEncounter && openEncounterModal(patient)}
                                        disabled={hasTodayEncounter}
                                        className={`px-4 py-2 rounded flex items-center gap-2 ${hasTodayEncounter
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                        title={hasTodayEncounter ? 'Patient already has an encounter today' : 'Create new encounter'}
                                    >
                                        <FaCalendarCheck /> Create Encounter
                                    </button>
                                </div>
                            );
                        })}
                        {filteredPatients.length === 0 && (
                            <p className="text-gray-500 text-center">No patients found</p>
                        )}
                    </div>
                )}
            </div>

            {/* Recent Patients */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaClock className="text-blue-600" /> Recent Patients (Last 5)
                </h3>
                {recentPatients.length === 0 ? (
                    <p className="text-gray-500">No recent patients</p>
                ) : (
                    <div className="space-y-2">
                        {recentPatients.map((patient) => {
                            const hasTodayEncounter = hasEncounterToday(patient._id);
                            return (
                                <div
                                    key={patient._id}
                                    className="flex justify-between items-center border p-3 rounded hover:bg-gray-50"
                                >
                                    <div>
                                        <p className="font-semibold">{patient.name}</p>
                                        <p className="text-sm text-gray-600">
                                            MRN: {patient.mrn} | Age: {patient.age} | {patient.gender}
                                        </p>
                                        {hasTodayEncounter && (
                                            <p className="text-xs text-orange-600 mt-1">
                                                ⚠ Already has an encounter today
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => !hasTodayEncounter && openEncounterModal(patient)}
                                        disabled={hasTodayEncounter}
                                        className={`px-4 py-2 rounded flex items-center gap-2 ${hasTodayEncounter
                                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                        title={hasTodayEncounter ? 'Patient already has an encounter today' : 'Create new encounter'}
                                    >
                                        <FaCalendarCheck /> Create Encounter
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>



            {/* Quick Stats */}
            <div className="bg-white p-6 rounded shadow">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaFileAlt /> Today's Activity
                </h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-4 rounded">
                        <p className="text-blue-600 text-sm font-semibold">Patients Registered Today</p>
                        <p className="text-3xl font-bold text-blue-800">
                            {patients.filter(p => new Date(p.createdAt).toDateString() === new Date().toDateString()).length}
                        </p>
                    </div>
                    <div className="bg-green-50 p-4 rounded">
                        <p className="text-green-600 text-sm font-semibold">Total Patients</p>
                        <p className="text-3xl font-bold text-green-800">{patients.length}</p>
                    </div>
                </div>
            </div>

            {/* Encounter Creation Modal */}
            {showEncounterModal && selectedPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaCalendarCheck /> Create Encounter
                            </h3>
                            <button
                                onClick={closeEncounterModal}
                                className="text-white hover:text-gray-200"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            {/* Patient Info */}
                            <div className="bg-gray-50 p-4 rounded mb-6">
                                <h4 className="font-bold text-lg mb-2">Patient Information</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Name</p>
                                        <p className="font-semibold">{selectedPatient.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">MRN</p>
                                        <p className="font-semibold">{selectedPatient.mrn}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Age</p>
                                        <p className="font-semibold">{selectedPatient.age} years</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Gender</p>
                                        <p className="font-semibold capitalize">{selectedPatient.gender}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Encounter Type */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">
                                    Encounter Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={encounterType}
                                    onChange={(e) => setEncounterType(e.target.value)}
                                >
                                    <option value="Outpatient">Outpatient</option>
                                    <option value="Inpatient">Inpatient</option>
                                    <option value="Emergency">Emergency</option>
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="External Investigation">External Investigation</option>
                                    <option value="Consultation">Consultation</option>
                                </select>
                            </div>

                            {/* Clinic Selection */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">
                                    Clinic (Optional)
                                </label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={selectedClinic}
                                    onChange={(e) => setSelectedClinic(e.target.value)}
                                >
                                    <option value="">-- No Clinic --</option>
                                    {clinics.map(clinic => (
                                        <option key={clinic._id} value={clinic._id}>
                                            {clinic.name} ({clinic.department})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Reason for Visit */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">
                                    Reason for Visit
                                </label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    rows="3"
                                    placeholder="Enter reason for visit..."
                                    value={reasonForVisit}
                                    onChange={(e) => setReasonForVisit(e.target.value)}
                                />
                            </div>

                            {/* Inpatient Ward Selection */}
                            {encounterType === 'Inpatient' && (
                                <div className="bg-blue-50 p-4 rounded mb-6 border border-blue-200">
                                    <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                                        <FaBed /> Inpatient Admission
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold mb-1">Select Ward</label>
                                            <select
                                                className="w-full border p-2 rounded"
                                                value={selectedWard}
                                                onChange={(e) => {
                                                    setSelectedWard(e.target.value);
                                                    setSelectedBed('');
                                                }}
                                            >
                                                <option value="">-- Select Ward --</option>
                                                {wards.map(ward => (
                                                    <option key={ward._id} value={ward._id}>
                                                        {ward.name} ({ward.type}) - ₦{ward.dailyRate}/day
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-semibold mb-1">Select Bed</label>
                                            <select
                                                className="w-full border p-2 rounded"
                                                value={selectedBed}
                                                onChange={(e) => setSelectedBed(e.target.value)}
                                                disabled={!selectedWard}
                                            >
                                                <option value="">-- Select Bed --</option>
                                                {availableBeds.map(bed => (
                                                    <option key={bed.number} value={bed.number}>
                                                        {bed.number}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    {selectedWard && (
                                        <p className="text-xs text-blue-600 mt-2">
                                            * Daily charges of ₦{wards.find(w => w._id === selectedWard)?.dailyRate} will apply automatically.
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Charges Selection */}
                            {encounterType !== 'External Investigation' && encounterType !== 'Inpatient' && (
                                <div className="mb-6">
                                    <label className="block text-gray-700 font-semibold mb-2">
                                        Select Charges <span className="text-red-500">*</span>
                                    </label>
                                    <p className="text-sm text-gray-600 mb-3">
                                        Select one or more charges for this encounter. Free charges are marked with $0.00.
                                    </p>

                                    {Object.keys(chargesByType).map(type => (
                                        <div key={type} className="mb-4">
                                            <h5 className="font-semibold text-md mb-2 text-blue-700">
                                                {chargeTypeLabels[type] || type}
                                            </h5>
                                            <div className="space-y-2 pl-4">
                                                {chargesByType[type].map(charge => (
                                                    <label
                                                        key={charge._id}
                                                        className={`flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-gray-50 ${selectedCharges.includes(charge._id) ? 'bg-blue-50 border-blue-500' : ''
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedCharges.includes(charge._id)}
                                                                onChange={() => handleChargeToggle(charge._id)}
                                                                className="w-4 h-4"
                                                            />
                                                            <div>
                                                                <p className="font-semibold">{charge.name}</p>
                                                                {charge.description && (
                                                                    <p className="text-xs text-gray-600">{charge.description}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className={`font-bold ${charge.basePrice === 0 ? 'text-green-600' : 'text-gray-800'}`}>
                                                                ${charge.basePrice.toFixed(2)}
                                                            </p>
                                                            {charge.basePrice === 0 && (
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                                    Free
                                                                </span>
                                                            )}
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}

                                    {charges.length === 0 && (
                                        <p className="text-gray-500 text-center py-4">No charges available</p>
                                    )}
                                </div>
                            )}

                            {/* Total */}
                            {selectedCharges.length > 0 && (
                                <div className="bg-blue-50 p-4 rounded mb-6">
                                    <div className="flex justify-between items-center">
                                        <span className="font-semibold text-lg">Total Charges:</span>
                                        <span className="font-bold text-2xl text-blue-700">
                                            ${charges
                                                .filter(c => selectedCharges.includes(c._id))
                                                .reduce((sum, c) => sum + c.basePrice, 0)
                                                .toFixed(2)}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-2">
                                        {selectedCharges.length} charge{selectedCharges.length !== 1 ? 's' : ''} selected
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-gray-50 p-4 rounded-b-lg flex justify-end gap-3">
                            <button
                                onClick={closeEncounterModal}
                                className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateEncounter}
                                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                                disabled={encounterType !== 'External Investigation' && encounterType !== 'Inpatient' && selectedCharges.length === 0}
                            >
                                <FaPlus /> Create Encounter
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default FrontDeskDashboard;
