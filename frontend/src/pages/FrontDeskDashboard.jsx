import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';
import { formatAge } from '../utils/patientUtils';
import { formatCompactNumber } from '../utils/formatters';
import { FaUserPlus, FaCalendarCheck, FaDollarSign, FaSearch, FaFileAlt, FaPlus, FaTimes, FaClock, FaCalendarAlt, FaBed, FaUserCheck, FaNotesMedical } from 'react-icons/fa';

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
    const [isANC, setIsANC] = useState(false);

    const [specialityClinics, setSpecialityClinics] = useState([]);
    const [doctors, setDoctors] = useState([]);

    const [waiveConsultationFee, setWaiveConsultationFee] = useState(false);
    const [needSpeciality, setNeedSpeciality] = useState(false);
    const [selectedSpecialityClinic, setSelectedSpecialityClinic] = useState('');
    const [needSpecificDoctor, setNeedSpecificDoctor] = useState(false);
    const [selectedSpecificDoctor, setSelectedSpecificDoctor] = useState('');

    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBed, setSelectedBed] = useState('');
    const [wards, setWards] = useState([]);
    const [availableBeds, setAvailableBeds] = useState([]);

    // Convert/Edit Modal State
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [selectedEncounterId, setSelectedEncounterId] = useState(null);

    // Add Charges Modal State
    const [showAddChargesModal, setShowAddChargesModal] = useState(false);
    const [addChargesPatient, setAddChargesPatient] = useState(null);
    const [addChargesEncounterId, setAddChargesEncounterId] = useState(null);
    const [selectedAdditionalCharges, setSelectedAdditionalCharges] = useState([]);
    const [addChargesSearchQuery, setAddChargesSearchQuery] = useState('');

    // Change Encounter Type State
    const [showChangeEncounterModal, setShowChangeEncounterModal] = useState(false);
    const [changeEncounterVisit, setChangeEncounterVisit] = useState(null);

    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    const [stats, setStats] = useState({ registeredToday: 0, encountersCreated: 0 });

    useEffect(() => {
        fetchUserStats();
    }, [backendUrl, user.token]);

    const fetchUserStats = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/reports/user-stats`, config);
            setStats(data);
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    // New Patient Form
    const [newPatient, setNewPatient] = useState({
        name: '',
        age: '',
        dateOfBirth: '',
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
        fetchPatients();
        fetchRecentPatients();
        fetchCharges();
        fetchClinics();
        fetchWards();
        fetchSpecialityClinics();
        fetchDoctors();
    }, []);

    const calculateAge = (dob) => {
        if (!dob) return '';
        const today = new Date();
        const birthDate = new Date(dob);
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();

        if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
            years--;
            months += 12;
        }

        if (years > 0) {
            return years.toString();
        } else {
            return months > 0 ? `0.${months}` : '0';
        }
    };

    const calculateDOBFromAge = (age) => {
        if (!age) return '';
        const today = new Date();
        const birthYear = today.getFullYear() - parseInt(age);
        const dob = new Date(birthYear, today.getMonth(), today.getDate());
        return dob.toISOString().split('T')[0];
    };

    const handleNewPatientChange = (e) => {
        const { name, value } = e.target;
        if (name === 'dateOfBirth') {
            const age = calculateAge(value);
            setNewPatient({ ...newPatient, dateOfBirth: value, age: age });
        } else if (name === 'age') {
            const dob = calculateDOBFromAge(value);
            setNewPatient({ ...newPatient, age: value, dateOfBirth: dob });
        } else {
            setNewPatient({ ...newPatient, [name]: value });
        }
    };

    const fetchWards = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/wards`, config);
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
                (p.mrn && p.mrn.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.contact && p.contact.includes(searchTerm))
            );
            setFilteredPatients(filtered);
        } else {
            setFilteredPatients([]);
        }
    }, [searchTerm, patients]);

    const fetchPatients = async () => {
        try {

            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/patients`, config);
            setPatients(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patients');
        }
    };

    const fetchRecentPatients = async () => {
        try {

            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/patients/recent`, config);
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
            const { data } = await axios.get(`${backendUrl}/api/charges?active=true`, config);
            setCharges(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching charges');
        }
    };

    const fetchClinics = async () => {
        try {

            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/clinics?active=true`, config);
            setClinics(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching clinics');
        }
    };

    const fetchSpecialityClinics = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/speciality-clinics?active=true`, config);
            setSpecialityClinics(data);
        } catch (error) {
            console.error('Error fetching speciality clinics:', error);
        }
    };

    const fetchDoctors = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/users/doctors`, config);
            setDoctors(data);
        } catch (error) {
            console.error('Error fetching doctors:', error);
        }
    };

    const fetchPatientEncounters = async (patientId) => {
        if (!patientId) return [];
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/visits/patient/${patientId}`, config);
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
            await axios.post(`${backendUrl}/api/patients`, newPatient, config);
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
        setIsANC(false);
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
        setIsANC(false);
        setWaiveConsultationFee(false);
        setNeedSpeciality(false);
        setSelectedSpecialityClinic('');
        setNeedSpecificDoctor(false);
        setSelectedSpecificDoctor('');
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

        if (!isANC && !waiveConsultationFee && !['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(encounterType) && selectedCharges.length === 0) {
            toast.error('Please select at least one charge, or check the ANC checkbox to skip charges');
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
                bed: encounterType === 'Inpatient' ? selectedBed : undefined,
                isANC: isANC,
                waiveConsultationFee,
                needSpeciality,
                specialityClinic: needSpeciality ? (selectedSpecialityClinic || undefined) : undefined,
                needSpecificDoctor: needSpeciality && needSpecificDoctor,
                specificDoctor: (needSpeciality && needSpecificDoctor) ? (selectedSpecificDoctor || undefined) : undefined
            };
            const visitResponse = await axios.post(`${backendUrl}/api/visits`, visitData, config);

            // 2. Add all selected charges to encounter
            for (const chargeId of selectedCharges) {
                const chargeData = {
                    encounterId: visitResponse.data._id,
                    patientId: selectedPatient._id,
                    chargeId: chargeId,
                    quantity: 1,
                    notes: 'Added at registration'
                };
                await axios.post(`${backendUrl}/api/encounter-charges`, chargeData, config);
            }

            // 3. Calculate total and update encounter status (excluding waived consultation)
            const selectedChargeObjects = charges.filter(c => selectedCharges.includes(c._id));
            const totalAmount = selectedChargeObjects.reduce((sum, c) => {
                if (waiveConsultationFee && c.type === 'consultation') return sum;
                return sum + c.basePrice;
            }, 0);

            if (!['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(encounterType)) {
                const newStatus = isANC || waiveConsultationFee ? 'in_nursing' : (totalAmount > 0 ? 'payment_pending' : 'in_nursing');
                await axios.put(
                    `${backendUrl}/api/visits/${visitResponse.data._id}`,
                    { encounterStatus: newStatus, isANC: isANC || undefined },
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

    // Group charges by type (Filter out Lab, Radiology, Drugs, Nursing for Front Desk)
    const allowedFrontDeskTypes = ['consultation'];
    const chargesByType = charges.reduce((acc, charge) => {
        if (!allowedFrontDeskTypes.includes(charge.type)) return acc;
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
        labour: 'Labour Fee',
        theatre: 'Theatre Fee',
        other: 'Other'
    };

    // --- Add Charges to Existing Encounter ---
    const handleAddChargesClick = (patient) => {
        const encounters = patientEncounters[patient._id] || [];
        const today = new Date().toDateString();
        const activeEncounter = encounters.find(e => {
            const eDate = new Date(e.createdAt).toDateString();
            return eDate === today || (e.type !== 'discharged');
        });
        if (!activeEncounter) {
            toast.error('No active encounter found for this patient today');
            return;
        }
        setAddChargesPatient(patient);
        setAddChargesEncounterId(activeEncounter._id);
        setSelectedAdditionalCharges([]);
        setAddChargesSearchQuery('');
        setShowAddChargesModal(true);
    };

    const handleToggleAdditionalCharge = (chargeId) => {
        setSelectedAdditionalCharges(prev =>
            prev.includes(chargeId) ? prev.filter(id => id !== chargeId) : [...prev, chargeId]
        );
    };

    const handleSubmitAdditionalCharges = async () => {
        if (selectedAdditionalCharges.length === 0) {
            toast.error('Please select at least one charge');
            return;
        }
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            for (const chargeId of selectedAdditionalCharges) {
                await axios.post(`${backendUrl}/api/encounter-charges`, {
                    encounterId: addChargesEncounterId,
                    patientId: addChargesPatient._id,
                    chargeId,
                    quantity: 1,
                    notes: 'Added at front desk'
                }, config);
            }
            toast.success(`${selectedAdditionalCharges.length} charge(s) added successfully! Patient can now pay at the cashier.`);
            setShowAddChargesModal(false);
            setAddChargesPatient(null);
            setAddChargesEncounterId(null);
            setSelectedAdditionalCharges([]);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error adding charges');
        } finally {
            setLoading(false);
        }
    };

    // Group all charges by type for the add-charges modal (Filter out Lab, Radiology, Drugs)
    const allChargesByType = charges.reduce((acc, charge) => {
        if (!charge.active) return acc;
        if (['drugs', 'lab', 'radiology'].includes(charge.type)) return acc;

        // Filter by search query if present
        if (addChargesSearchQuery) {
            const query = addChargesSearchQuery.toLowerCase();
            const nameMatch = charge.name?.toLowerCase().includes(query);
            const descMatch = charge.description?.toLowerCase().includes(query);
            const typeMatch = (chargeTypeLabels[charge.type] || charge.type)?.toLowerCase().includes(query);
            if (!nameMatch && !descMatch && !typeMatch) return acc;
        }

        if (!acc[charge.type]) acc[charge.type] = [];
        acc[charge.type].push(charge);
        return acc;
    }, {});


    const handleEditClick = (patient) => {
        const encounters = patientEncounters[patient._id];
        if (!encounters || encounters.length === 0) {
            toast.error('No checks found for this patient');
            return;
        }

        // Find active encounter (should be one created today or active outpatient)
        const today = new Date().toDateString();
        const activeEncounter = encounters.find(e => {
            const eDate = new Date(e.createdAt).toDateString();
            return eDate === today || ((e.type === 'Outpatient' || e.type === 'Emergency') && e.encounterStatus !== 'completed');
        });

        if (!activeEncounter) {
            toast.error('No active encounter found to edit');
            return;
        }

        if (activeEncounter.type === 'Inpatient') {
            toast.info('This encounter is already Inpatient (Admitted).');
            return;
        }

        setSelectedPatient(patient);
        setSelectedEncounterId(activeEncounter._id);
        setSelectedWard('');
        setSelectedBed('');
        setShowConvertModal(true);
    };

    const getActiveExternalEncounter = (patientId) => {
        const encounters = patientEncounters[patientId] || [];
        const today = new Date().toDateString();
        return encounters.find(e => {
            const eDate = new Date(e.createdAt).toDateString();
            return eDate === today && ['External Investigation', 'External Pharmacy', 'External Lab/Radiology'].includes(e.type);
        });
    };

    const openChangeEncounterModal = (patient) => {
        const externalEnc = getActiveExternalEncounter(patient._id);
        if (!externalEnc) {
            toast.error('No qualifying external encounter found for this patient today');
            return;
        }
        setChangeEncounterVisit(externalEnc);
        setSelectedPatient(patient);
        setEncounterType('Outpatient'); // Default new type
        setSelectedClinic(externalEnc.clinic?._id || externalEnc.clinic || '');
        setReasonForVisit(externalEnc.reasonForVisit || '');
        setSelectedCharges([]);
        setSelectedWard('');
        setSelectedBed('');
        setShowChangeEncounterModal(true);
    };

    const handleChangeEncounterSubmission = async () => {
        if (!['Inpatient', 'Outpatient', 'Emergency'].includes(encounterType) && selectedCharges.length === 0) {
            toast.error('Please select at least one charge for the new encounter type');
            return;
        }

        if (encounterType === 'Inpatient' && (!selectedWard || !selectedBed)) {
            toast.error('Ward and Bed are required for Inpatient admission');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // 1. Update Encounter Type & Details
            await axios.put(`${backendUrl}/api/visits/${changeEncounterVisit._id}/change-type`, {
                type: encounterType,
                encounterType: encounterType,
                clinic: selectedClinic || undefined,
                reasonForVisit: reasonForVisit,
                ward: encounterType === 'Inpatient' ? selectedWard : undefined,
                bed: encounterType === 'Inpatient' ? selectedBed : undefined
            }, config);

            // 2. Add New Charges
            for (const chargeId of selectedCharges) {
                await axios.post(`${backendUrl}/api/encounter-charges`, {
                    encounterId: changeEncounterVisit._id,
                    patientId: selectedPatient._id,
                    chargeId: chargeId,
                    quantity: 1,
                    notes: 'Added during encounter type change'
                }, config);
            }

            toast.success('Encounter type changed and charges added!');
            setShowChangeEncounterModal(false);
            setChangeEncounterVisit(null);
            setSelectedPatient(null);
            fetchRecentPatients();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error changing encounter type');
        } finally {
            setLoading(false);
        }
    };

    const handleConvertFromFrontDesk = async () => {
        if (!selectedWard || !selectedBed) {
            toast.error('Please select Ward and Bed');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/visits/${selectedEncounterId}/convert-to-inpatient`,
                { ward: selectedWard, bed: selectedBed },
                config
            );

            toast.success('Encounter converted to Inpatient!');
            setShowConvertModal(false);
            setSelectedEncounterId(null);
            setSelectedPatient(null);
            fetchRecentPatients(); // Refresh lists
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error converting encounter');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaUserPlus className="text-green-600" /> Front Desk
                </h2>
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
                            name="name"
                            value={newPatient.name}
                            onChange={handleNewPatientChange}
                            required
                        />
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-[10px] text-gray-500 uppercase font-bold pl-1">Date of Birth</label>
                                <input
                                    type="date"
                                    name="dateOfBirth"
                                    className="w-full border p-2 rounded text-sm"
                                    value={newPatient.dateOfBirth}
                                    onChange={handleNewPatientChange}
                                    max={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] text-gray-500 uppercase font-bold pl-1">Age *</label>
                                <input
                                    type="number"
                                    name="age"
                                    placeholder="Age *"
                                    className="w-full border p-2 rounded text-sm"
                                    value={newPatient.age}
                                    onChange={handleNewPatientChange}
                                    required
                                    min="0"
                                    step="0.01"
                                />
                                {newPatient.age && (
                                    <span className="text-[10px] text-blue-600 italic pl-1">
                                        {formatAge(newPatient.age)}
                                    </span>
                                )}
                            </div>
                        </div>
                        <select
                            className="border p-2 rounded"
                            name="gender"
                            value={newPatient.gender}
                            onChange={handleNewPatientChange}
                        >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                        </select>
                        <input
                            type="text"
                            name="contact"
                            placeholder="Contact Number *"
                            className="border p-2 rounded"
                            value={newPatient.contact}
                            onChange={handleNewPatientChange}
                            required
                        />
                        <input
                            type="text"
                            name="address"
                            placeholder="Address"
                            className="border p-2 rounded md:col-span-2"
                            value={newPatient.address}
                            onChange={handleNewPatientChange}
                        />
                        <select
                            className="border p-2 rounded"
                            name="provider"
                            value={newPatient.provider}
                            onChange={handleNewPatientChange}
                        >
                            <option value="Standard">Standard</option>
                            <option value="Retainership">Retainership</option>
                            <option value="NHIA">NHIA</option>
                            <option value="KSCHMA">KSCHMA</option>
                        </select>
                        {newPatient.provider === 'NHIA' && (
                            <input
                                type="text"
                                name="hmo"
                                placeholder="HMO *"
                                className="border p-2 rounded"
                                value={newPatient.hmo}
                                onChange={handleNewPatientChange}
                                required
                            />
                        )}
                        <input
                            type="text"
                            name="insuranceNumber"
                            placeholder="Insurance Number (Optional)"
                            className="border p-2 rounded"
                            value={newPatient.insuranceNumber}
                            onChange={handleNewPatientChange}
                        />
                        <input
                            type="text"
                            name="emergencyContactName"
                            placeholder="Emergency Contact Name"
                            className="border p-2 rounded"
                            value={newPatient.emergencyContactName}
                            onChange={handleNewPatientChange}
                        />
                        <input
                            type="text"
                            name="emergencyContactPhone"
                            placeholder="Emergency Contact Phone"
                            className="border p-2 rounded"
                            value={newPatient.emergencyContactPhone}
                            onChange={handleNewPatientChange}
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
                        placeholder="Search patient by name, MRN or Phone..."
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
                                            MRN: {patient.mrn} | Age: {formatAge(patient.age)} | {patient.gender}
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
                                            ? 'hidden'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                        title={hasTodayEncounter ? 'Patient already has an encounter today' : 'Create new encounter'}
                                    >
                                        <FaCalendarCheck /> Create Encounter
                                    </button>
                                    {hasTodayEncounter && (
                                        <div className="flex gap-2">
                                            {getActiveExternalEncounter(patient._id) ? (
                                                <button
                                                    onClick={() => openChangeEncounterModal(patient)}
                                                    className="bg-orange-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-orange-700"
                                                >
                                                    <FaCalendarAlt /> Change Encounter Type
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleAddChargesClick(patient)}
                                                        className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700 text-sm"
                                                    >
                                                        <FaDollarSign /> Add Charges
                                                    </button>
                                                    {hasActiveInpatientEncounter(patient._id) ? (
                                                        <button
                                                            onClick={() => window.location.href = `/patient/${patient._id}`}
                                                            className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-red-700"
                                                        >
                                                            <FaBed /> Discharge
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleEditClick(patient)}
                                                            className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700"
                                                        >
                                                            <FaBed /> Edit / Admit
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
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
                                            MRN: {patient.mrn} | Age: {formatAge(patient.age)} | {patient.gender}
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
                                            ? 'hidden'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                        title={hasTodayEncounter ? 'Patient already has an encounter today' : 'Create new encounter'}
                                    >
                                        <FaCalendarCheck /> Create Encounter
                                    </button>
                                    {hasTodayEncounter && (
                                        <div className="flex gap-2">
                                            {getActiveExternalEncounter(patient._id) ? (
                                                <button
                                                    onClick={() => openChangeEncounterModal(patient)}
                                                    className="bg-orange-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-orange-700"
                                                >
                                                    <FaCalendarAlt /> Change Encounter Type
                                                </button>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => handleAddChargesClick(patient)}
                                                        className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700 text-sm"
                                                    >
                                                        <FaDollarSign /> Add Charges
                                                    </button>
                                                    {hasActiveInpatientEncounter(patient._id) ? (
                                                        <button
                                                            onClick={() => window.location.href = `/patient/${patient._id}`}
                                                            className="bg-red-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-red-700"
                                                        >
                                                            <FaBed /> Discharge
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleEditClick(patient)}
                                                            className="bg-purple-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-purple-700"
                                                        >
                                                            <FaBed /> Edit / Admit
                                                        </button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    )}
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
                                        <p className="font-semibold">{formatAge(selectedPatient.age)}</p>
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
                                    <option value="Follow-up">Follow-up</option>
                                    <option value="Inpatient">Inpatient</option>
                                    <option value="Emergency">Emergency</option>
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

                            {/* ANC and Waive Consultation Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                {/* ANC Checkbox */}
                                <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${isANC ? 'bg-pink-50 border-pink-400' : 'bg-gray-50 border-gray-200 hover:border-pink-300'
                                    }`}>
                                    <input
                                        type="checkbox"
                                        checked={isANC}
                                        onChange={(e) => {
                                            setIsANC(e.target.checked);
                                            if (e.target.checked) setSelectedCharges([]);
                                        }}
                                        className="w-5 h-5 accent-pink-600 flex-shrink-0"
                                    />
                                    <div>
                                        <p className="font-bold text-pink-700 text-sm">🤰 Antenatal Care (ANC) Follow-Up</p>
                                        <p className="text-[10px] text-pink-500 mt-0.5">Check for ANC patients — no charges now.</p>
                                    </div>
                                </label>

                                {/* Waive Consultation Fee Checkbox */}
                                <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${waiveConsultationFee ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-200 hover:border-green-300'
                                    }`}>
                                    <input
                                        type="checkbox"
                                        checked={waiveConsultationFee}
                                        onChange={(e) => setWaiveConsultationFee(e.target.checked)}
                                        className="w-5 h-5 accent-green-600 flex-shrink-0"
                                    />
                                    <div>
                                        <p className="font-bold text-green-700 text-sm">💸 Waive Consultation Fee</p>
                                        <p className="text-[10px] text-green-500 mt-0.5">Allow consultation without payment.</p>
                                    </div>
                                </label>
                            </div>

                            {/* Speciality Restrictions */}
                            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={needSpeciality}
                                        onChange={(e) => {
                                            setNeedSpeciality(e.target.checked);
                                            if (!e.target.checked) {
                                                setSelectedSpecialityClinic('');
                                                setNeedSpecificDoctor(false);
                                                setSelectedSpecificDoctor('');
                                            }
                                        }}
                                        className="w-5 h-5 accent-blue-600"
                                    />
                                    <div>
                                        <p className="font-bold text-blue-800 text-sm">🏥 Need Speciality Clinic Restriction?</p>
                                        <p className="text-xs text-blue-600 mt-0.5">Restrict search and visibility of this patient to doctors within a specific clinic.</p>
                                    </div>
                                </label>

                                {needSpeciality && (
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold mb-1 text-blue-900">Select Speciality Clinic</label>
                                            <select
                                                className="w-full border p-2 rounded bg-white"
                                                value={selectedSpecialityClinic}
                                                onChange={(e) => {
                                                    setSelectedSpecialityClinic(e.target.value);
                                                    setNeedSpecificDoctor(false);
                                                    setSelectedSpecificDoctor('');
                                                }}
                                            >
                                                <option value="">-- Select Speciality Clinic --</option>
                                                {specialityClinics.map(sc => (
                                                    <option key={sc._id} value={sc._id}>
                                                        {sc.name} ({sc.department})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {selectedSpecialityClinic && (
                                            <div className="flex flex-col justify-end">
                                                <label className="flex items-center gap-3 cursor-pointer p-2 border rounded bg-white border-blue-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={needSpecificDoctor}
                                                        onChange={(e) => {
                                                            setNeedSpecificDoctor(e.target.checked);
                                                            if (!e.target.checked) setSelectedSpecificDoctor('');
                                                        }}
                                                        className="w-4 h-4 accent-indigo-600"
                                                    />
                                                    <div>
                                                        <p className="font-semibold text-indigo-900 text-xs">Need Specific Doctor?</p>
                                                        <p className="text-[10px] text-indigo-600">Restrict access to a single doctor.</p>
                                                    </div>
                                                </label>
                                            </div>
                                        )}

                                        {needSpecificDoctor && selectedSpecialityClinic && (
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-semibold mb-1 text-indigo-900">Select Specific Doctor</label>
                                                <select
                                                    className="w-full border p-2 rounded bg-white"
                                                    value={selectedSpecificDoctor}
                                                    onChange={(e) => setSelectedSpecificDoctor(e.target.value)}
                                                >
                                                    <option value="">-- Select Doctor --</option>
                                                    {doctors
                                                        .filter(doc => (doc.assignedSpecialityClinic?._id || doc.assignedSpecialityClinic) === selectedSpecialityClinic)
                                                        .map(doc => (
                                                            <option key={doc._id} value={doc._id}>
                                                                {doc.name}
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
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
                            {!isANC && !['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(encounterType) && (
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
                                                {chargesByType[type].map(charge => {
                                                    // Determine fee based on patient provider
                                                    const provider = selectedPatient?.provider || 'Standard';
                                                    let patientFee = charge.standardFee || charge.basePrice || 0;
                                                    let feeLabel = 'Standard';
                                                    let feeLabelColor = 'bg-blue-100 text-blue-700';
                                                    if (provider === 'Corporate Retainership' || provider === 'Retainership') {
                                                        patientFee = charge.retainershipFee || patientFee;
                                                        feeLabel = 'Corp Ret.';
                                                        feeLabelColor = 'bg-purple-100 text-purple-700';
                                                    } else if (provider === 'Family Retainership') {
                                                        patientFee = charge.familyRetainershipFee || patientFee;
                                                        feeLabel = 'Fam Ret.';
                                                        feeLabelColor = 'bg-pink-100 text-pink-700';
                                                    } else if (provider === 'NHIA') {
                                                        patientFee = charge.nhiaFee || patientFee;
                                                        feeLabel = 'NHIA';
                                                        feeLabelColor = 'bg-green-100 text-green-700';
                                                    } else if (provider === 'KSCHMA') {
                                                        patientFee = charge.kschmaFee || patientFee;
                                                        feeLabel = 'State Ins.';
                                                        feeLabelColor = 'bg-orange-100 text-orange-700';
                                                    }
                                                    if (waiveConsultationFee && charge.type === 'consultation') {
                                                        patientFee = 0;
                                                        feeLabel = 'Waived';
                                                        feeLabelColor = 'bg-yellow-100 text-yellow-800';
                                                    }
                                                    return (
                                                        <label
                                                            key={charge._id}
                                                            className={`flex items-center justify-between p-3 border rounded cursor-pointer hover:bg-gray-50 ${selectedCharges.includes(charge._id) ? 'bg-blue-50 border-blue-500' : ''}`}
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
                                                            <div className="text-right ml-4">
                                                                <p className={`font-bold text-lg ${patientFee === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                                                    ₦{patientFee.toLocaleString()}
                                                                </p>
                                                                <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${patientFee === 0 ? 'bg-green-100 text-green-700' : feeLabelColor}`}>
                                                                    {patientFee === 0 ? 'Free' : feeLabel}
                                                                </span>
                                                            </div>
                                                        </label>
                                                    );
                                                })}
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
                                            ₦{charges
                                                .filter(c => selectedCharges.includes(c._id))
                                                .reduce((sum, c) => {
                                                    if (waiveConsultationFee && c.type === 'consultation') return sum;
                                                    const prov = selectedPatient?.provider || 'Standard';
                                                    let fee = c.standardFee || c.basePrice || 0;
                                                    if (prov === 'Corporate Retainership' || prov === 'Retainership') fee = c.retainershipFee || fee;
                                                    else if (prov === 'Family Retainership') fee = c.familyRetainershipFee || fee;
                                                    else if (prov === 'NHIA') fee = c.nhiaFee || fee;
                                                    else if (prov === 'KSCHMA') fee = c.kschmaFee || fee;
                                                    return sum + fee;
                                                }, 0)
                                                .toLocaleString()}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mt-2">
                                        {selectedCharges.length} charge{selectedCharges.length !== 1 ? 's' : ''} selected &mdash; Rate: <span className="font-semibold">{selectedPatient?.provider || 'Standard'}</span>
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
                                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading || (!isANC && !waiveConsultationFee && !['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(encounterType) && selectedCharges.length === 0)}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Creating...
                                    </>
                                ) : (
                                    <>
                                        <FaPlus /> {isANC ? '🤰 Create ANC Encounter' : 'Create Encounter'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inpatient Conversion Modal (Front Desk) */}
            {showConvertModal && selectedPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="bg-purple-700 text-white p-4 rounded-t-lg flex justify-between items-center">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaBed /> Convert to Inpatient
                            </h3>
                            <button onClick={() => setShowConvertModal(false)} className="text-white hover:text-gray-200">
                                <FaTimes />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="mb-4 bg-purple-50 p-3 rounded">
                                <p className="font-bold">{selectedPatient.name}</p>
                                <p className="text-sm">Converting active encounter to Inpatient admission.</p>
                            </div>

                            {/* Deposit Balance status */}
                            <div className="mb-4">
                                <label className="block text-gray-700 font-bold mb-1">Financial Deposit Balance</label>
                                <div className={`p-3 rounded border text-sm font-semibold flex justify-between items-center ${
                                    (selectedPatient?.depositBalance || 0) <= 0 
                                        ? 'bg-red-50 text-red-800 border-red-200' 
                                        : 'bg-green-50 text-green-800 border-green-200'
                                }`}>
                                    <span>Current Deposit:</span>
                                    <span className="text-base font-bold">₦{selectedPatient?.depositBalance?.toLocaleString() || '0'}</span>
                                </div>
                                {(selectedPatient?.depositBalance || 0) <= 0 && (
                                    <p className="text-xs text-red-600 mt-1 font-semibold">
                                        ⚠️ Patient has no deposit balance. Admission is blocked until a deposit is paid.
                                    </p>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 font-bold mb-2">Select Ward</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={selectedWard}
                                    onChange={(e) => setSelectedWard(e.target.value)}
                                    disabled={(selectedPatient?.depositBalance || 0) <= 0}
                                >
                                    <option value="">-- Select Ward --</option>
                                    {wards.map(ward => (
                                        <option key={ward._id} value={ward._id}>
                                            {ward.name} ({ward.type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-6">
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

                            {selectedWard && selectedPatient?.provider && (
                                <div className="mb-6 p-3 bg-blue-50 rounded text-sm text-blue-800 border border-blue-100">
                                    <p className="font-bold">Provider Scheme: {selectedPatient.provider}</p>
                                    <p>
                                        Daily Rate: ₦{wards.find(w => w._id === selectedWard)?.rates?.[selectedPatient.provider] ||
                                            wards.find(w => w._id === selectedWard)?.rates?.Standard ||
                                            wards.find(w => w._id === selectedWard)?.dailyRate || 0}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowConvertModal(false)}
                                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConvertFromFrontDesk}
                                    disabled={!selectedWard || !selectedBed || (selectedPatient?.depositBalance || 0) <= 0}
                                    className={`px-4 py-2 rounded text-white ${(!selectedWard || !selectedBed || (selectedPatient?.depositBalance || 0) <= 0) ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                                >
                                    Convert & Admit
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ===================== ADD CHARGES MODAL ===================== */}
            {showAddChargesModal && addChargesPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full h-[80vh] max-h-[650px] flex flex-col font-sans">
                        {/* Modal Header */}
                        <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <FaDollarSign /> Add Charges to Patient
                                </h3>
                                <p className="text-green-100 text-sm mt-1">
                                    {addChargesPatient.name} &mdash; MRN: {addChargesPatient.mrn}
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAddChargesModal(false);
                                    setSelectedAdditionalCharges([]);
                                    setAddChargesSearchQuery('');
                                }}
                                className="text-white hover:text-gray-200"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 flex flex-col min-h-0">
                            {/* Search Input and Dropdown */}
                            <div className="relative flex-shrink-0 mb-4">
                                <label className="block text-gray-700 font-semibold mb-1 text-sm">
                                    Search Services / Fees
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Type name, type or description (e.g. consultation, nursing)..."
                                        value={addChargesSearchQuery}
                                        onChange={(e) => setAddChargesSearchQuery(e.target.value)}
                                        className="w-full border border-gray-300 rounded-lg p-2.5 pl-10 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                                    />
                                    <div className="absolute left-3 top-3.5 text-gray-400">
                                        <FaSearch />
                                    </div>
                                    {addChargesSearchQuery && (
                                        <button
                                            onClick={() => setAddChargesSearchQuery('')}
                                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 font-bold px-1 rounded-full text-base"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                {/* Autocomplete Search Dropdown */}
                                {addChargesSearchQuery && (
                                    <>
                                        {charges.filter(charge => {
                                            if (!charge.active) return false;
                                            if (['drugs', 'lab', 'radiology'].includes(charge.type)) return false;
                                            const query = addChargesSearchQuery.toLowerCase();
                                            const nameMatch = charge.name?.toLowerCase().includes(query);
                                            const descMatch = charge.description?.toLowerCase().includes(query);
                                            const typeMatch = (chargeTypeLabels[charge.type] || charge.type)?.toLowerCase().includes(query);
                                            return nameMatch || descMatch || typeMatch;
                                        }).length === 0 ? (
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50 text-center text-sm text-gray-500">
                                                No charges found matching "{addChargesSearchQuery}"
                                            </div>
                                        ) : (
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto z-50">
                                                {charges
                                                    .filter(charge => {
                                                        if (!charge.active) return false;
                                                        if (['drugs', 'lab', 'radiology'].includes(charge.type)) return false;
                                                        const query = addChargesSearchQuery.toLowerCase();
                                                        const nameMatch = charge.name?.toLowerCase().includes(query);
                                                        const descMatch = charge.description?.toLowerCase().includes(query);
                                                        const typeMatch = (chargeTypeLabels[charge.type] || charge.type)?.toLowerCase().includes(query);
                                                        return nameMatch || descMatch || typeMatch;
                                                    })
                                                    .map(charge => {
                                                        // Determine fee based on patient provider
                                                        let fee = charge.standardFee || charge.basePrice || 0;
                                                        if (addChargesPatient.provider === 'Retainership' || addChargesPatient.provider === 'Corporate Retainership') fee = charge.retainershipFee || fee;
                                                        else if (addChargesPatient.provider === 'Family Retainership') fee = charge.familyRetainershipFee || fee;
                                                        else if (addChargesPatient.provider === 'NHIA') fee = charge.nhiaFee || fee;
                                                        else if (addChargesPatient.provider === 'KSCHMA') fee = charge.kschmaFee || fee;

                                                        const isAlreadySelected = selectedAdditionalCharges.includes(charge._id);

                                                        return (
                                                            <button
                                                                key={charge._id}
                                                                type="button"
                                                                onClick={() => {
                                                                    if (!isAlreadySelected) {
                                                                        setSelectedAdditionalCharges(prev => [...prev, charge._id]);
                                                                    }
                                                                    setAddChargesSearchQuery(''); // Clear and close dropdown
                                                                }}
                                                                className={`w-full text-left p-3 hover:bg-gray-50 flex justify-between items-center border-b border-gray-100 last:border-b-0 transition-colors ${
                                                                    isAlreadySelected ? 'opacity-50 cursor-not-allowed bg-green-50/20' : ''
                                                                }`}
                                                                disabled={isAlreadySelected}
                                                            >
                                                                <div>
                                                                    <p className="font-semibold text-sm text-gray-800">{charge.name}</p>
                                                                    <p className="text-xs text-gray-500 capitalize">{chargeTypeLabels[charge.type] || charge.type}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <span className="font-bold text-sm text-gray-900">₦{fee.toLocaleString()}</span>
                                                                    {isAlreadySelected && <span className="ml-2 text-xs text-green-600 font-bold">(Added)</span>}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Selected Charges List */}
                            <div className="flex-1 flex flex-col min-h-0 mt-2">
                                <h4 className="font-bold text-sm text-gray-700 mb-2 flex justify-between items-center flex-shrink-0">
                                    <span>Selected Services &amp; Charges ({selectedAdditionalCharges.length})</span>
                                    {selectedAdditionalCharges.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedAdditionalCharges([])}
                                            className="text-xs text-red-500 hover:text-red-700 font-semibold"
                                        >
                                            Clear All
                                        </button>
                                    )}
                                </h4>

                                {selectedAdditionalCharges.length === 0 ? (
                                    <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center text-gray-400 text-sm flex flex-col items-center justify-center flex-grow">
                                        <FaDollarSign size={32} className="mb-2 text-gray-300" />
                                        <p>No services selected yet.</p>
                                        <p className="text-xs mt-1 text-gray-400">Search and select services above to add them to this encounter.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2 overflow-y-auto flex-grow pr-1">
                                        {charges
                                            .filter(c => selectedAdditionalCharges.includes(c._id))
                                            .map(charge => {
                                                // Determine fee
                                                let fee = charge.standardFee || charge.basePrice || 0;
                                                let addFeeLabel = 'Standard';
                                                let addFeeLabelColor = 'bg-blue-100 text-blue-700';
                                                if (addChargesPatient.provider === 'Retainership' || addChargesPatient.provider === 'Corporate Retainership') {
                                                    fee = charge.retainershipFee || fee;
                                                    addFeeLabel = 'Corp Ret.';
                                                    addFeeLabelColor = 'bg-purple-100 text-purple-700';
                                                } else if (addChargesPatient.provider === 'Family Retainership') {
                                                    fee = charge.familyRetainershipFee || fee;
                                                    addFeeLabel = 'Fam Ret.';
                                                    addFeeLabelColor = 'bg-pink-100 text-pink-700';
                                                } else if (addChargesPatient.provider === 'NHIA') {
                                                    fee = charge.nhiaFee || fee;
                                                    addFeeLabel = 'NHIA';
                                                    addFeeLabelColor = 'bg-green-100 text-green-700';
                                                } else if (addChargesPatient.provider === 'KSCHMA') {
                                                    fee = charge.kschmaFee || fee;
                                                    addFeeLabel = 'State Ins.';
                                                    addFeeLabelColor = 'bg-orange-100 text-orange-700';
                                                }

                                                return (
                                                    <div
                                                        key={charge._id}
                                                        className="flex justify-between items-center p-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <div className="flex-1 min-w-0 pr-4">
                                                            <p className="font-semibold text-sm text-gray-800 truncate">{charge.name}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded uppercase font-semibold">
                                                                    {chargeTypeLabels[charge.type] || charge.type}
                                                                </span>
                                                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${fee === 0 ? 'bg-green-100 text-green-700' : addFeeLabelColor}`}>
                                                                    {fee === 0 ? 'Free' : addFeeLabel}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4 flex-shrink-0">
                                                            <span className={`font-bold text-base ${fee === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                                                ₦{fee.toLocaleString()}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => setSelectedAdditionalCharges(prev => prev.filter(id => id !== charge._id))}
                                                                className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                                                                title="Remove service"
                                                            >
                                                                <FaTimes size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-between items-center flex-shrink-0">
                            <div className="text-sm text-gray-600">
                                {selectedAdditionalCharges.length > 0 ? (
                                    <span className="font-semibold text-green-700">
                                        Total: ₦{
                                            charges
                                                .filter(c => selectedAdditionalCharges.includes(c._id))
                                                .reduce((sum, c) => {
                                                    let fee = c.standardFee || c.basePrice || 0;
                                                    if (addChargesPatient.provider === 'Retainership' || addChargesPatient.provider === 'Corporate Retainership') fee = c.retainershipFee || fee;
                                                    else if (addChargesPatient.provider === 'Family Retainership') fee = c.familyRetainershipFee || fee;
                                                    else if (addChargesPatient.provider === 'NHIA') fee = c.nhiaFee || fee;
                                                    else if (addChargesPatient.provider === 'KSCHMA') fee = c.kschmaFee || fee;
                                                    return sum + fee;
                                                }, 0).toLocaleString()
                                        }
                                    </span>
                                ) : (
                                    <span>Select charges to add</span>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setShowAddChargesModal(false);
                                        setSelectedAdditionalCharges([]);
                                        setAddChargesSearchQuery('');
                                    }}
                                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400 text-sm font-semibold transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitAdditionalCharges}
                                    disabled={selectedAdditionalCharges.length === 0}
                                    className={`px-6 py-2 rounded text-white font-semibold flex items-center gap-2 text-sm transition ${selectedAdditionalCharges.length === 0
                                        ? 'bg-green-300 cursor-not-allowed'
                                        : 'bg-green-600 hover:bg-green-700 shadow-sm'
                                        }`}
                                >
                                    <FaDollarSign /> Add to Encounter
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ===================== CHANGE ENCOUNTER TYPE MODAL ===================== */}
            {showChangeEncounterModal && selectedPatient && changeEncounterVisit && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="bg-orange-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaCalendarAlt /> Change Encounter Type
                            </h3>
                            <button
                                onClick={() => setShowChangeEncounterModal(false)}
                                className="text-white hover:text-gray-200"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6">
                            <div className="bg-orange-50 p-4 rounded mb-6 border border-orange-100">
                                <h4 className="font-bold text-orange-800 mb-1">Current Encounter: {changeEncounterVisit.type}</h4>
                                <p className="text-sm text-orange-700">You are changing the type of the encounter created today for this patient. This is typically used to upgrade an external service to a full consultation or admission.</p>
                            </div>

                            {/* Patient Info */}
                            <div className="bg-gray-50 p-4 rounded mb-6">
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Name</p>
                                        <p className="font-semibold">{selectedPatient.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">MRN</p>
                                        <p className="font-semibold">{selectedPatient.mrn}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Gender</p>
                                        <p className="font-semibold capitalize">{selectedPatient.gender}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Provider</p>
                                        <p className="font-semibold">{selectedPatient.provider}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                {/* Left Side: Configuration */}
                                <div>
                                    <div className="mb-6">
                                        <label className="block text-gray-700 font-semibold mb-2">New Encounter Type</label>
                                        <select
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-orange-500"
                                            value={encounterType}
                                            onChange={(e) => setEncounterType(e.target.value)}
                                        >
                                            <option value="Outpatient">Outpatient Consultation</option>
                                            <option value="Inpatient">Inpatient Admission</option>
                                            <option value="Emergency">Emergency</option>
                                            <option value="External Pharmacy">External Pharmacy</option>
                                            <option value="External Lab/Radiology">External Lab/Radiology</option>
                                            <option value="External Investigation">External Investigation</option>
                                        </select>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-gray-700 font-semibold mb-2">Assign to Clinic</label>
                                        <select
                                            className="w-full border p-2 rounded"
                                            value={selectedClinic}
                                            onChange={(e) => setSelectedClinic(e.target.value)}
                                        >
                                            <option value="">-- Select Clinic --</option>
                                            {clinics.map(clinic => (
                                                <option key={clinic._id} value={clinic._id}>{clinic.name} ({clinic.department})</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block text-gray-700 font-semibold mb-2">Reason for Change / Visit</label>
                                        <textarea
                                            className="w-full border p-2 rounded h-24"
                                            placeholder="Enter reason for visit or change..."
                                            value={reasonForVisit}
                                            onChange={(e) => setReasonForVisit(e.target.value)}
                                        ></textarea>
                                    </div>
                                </div>

                                {/* Right Side: Dynamic Content (Charges or Ward/Bed) */}
                                <div>
                                    {encounterType === 'Inpatient' ? (
                                        <div className="bg-purple-50 p-6 rounded-lg border border-purple-200 h-full flex flex-col">
                                            <h4 className="text-purple-800 font-bold mb-4 flex items-center gap-2 text-lg">
                                                <FaBed className="text-purple-600" /> Ward Admission Assignment
                                            </h4>
                                            <p className="text-sm text-purple-700 mb-6">Allocate a ward and bed for this patient to complete the admission process.</p>

                                            <div className="space-y-6 flex-1">
                                                <div>
                                                    <label className="block text-sm text-gray-700 font-bold mb-2 uppercase tracking-wider">Select Ward</label>
                                                    <select
                                                        className="w-full border-2 border-purple-200 p-3 rounded-lg focus:border-purple-500 transition-colors"
                                                        value={selectedWard}
                                                        onChange={(e) => setSelectedWard(e.target.value)}
                                                    >
                                                        <option value="">-- Choose Ward --</option>
                                                        {wards.map(ward => (
                                                            <option key={ward._id} value={ward._id}>{ward.name} ({ward.type})</option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div>
                                                    <label className="block text-sm text-gray-700 font-bold mb-2 uppercase tracking-wider">Select Bed</label>
                                                    <select
                                                        className="w-full border-2 border-purple-200 p-3 rounded-lg focus:border-purple-500 transition-colors"
                                                        value={selectedBed}
                                                        onChange={(e) => setSelectedBed(e.target.value)}
                                                        disabled={!selectedWard}
                                                    >
                                                        <option value="">-- Choose Bed --</option>
                                                        {availableBeds.map(bed => (
                                                            <option key={bed._id} value={bed.number}>{bed.number}</option>
                                                        ))}
                                                    </select>
                                                    {selectedWard && availableBeds.length === 0 && (
                                                        <p className="text-red-500 text-sm mt-2 font-semibold">⚠ No beds available in this ward.</p>
                                                    )}
                                                </div>

                                                {selectedWard && selectedPatient?.provider && (
                                                    <div className="mt-8 p-4 bg-white rounded shadow-sm border border-purple-100">
                                                        <p className="text-xs text-purple-400 font-bold uppercase mb-1">Billing Summary</p>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-600">Daily Rate ({selectedPatient.provider}):</span>
                                                            <span className="text-xl font-bold text-purple-800">
                                                                ₦{(wards.find(w => w._id === selectedWard)?.rates?.[selectedPatient.provider] ||
                                                                    wards.find(w => w._id === selectedWard)?.rates?.Standard ||
                                                                    wards.find(w => w._id === selectedWard)?.dailyRate || 0).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col h-full overflow-hidden">
                                            <h4 className="text-gray-700 font-bold mb-3 flex items-center gap-2">
                                                <FaDollarSign className="text-green-600" /> Select New Charges (Consultation Fee, etc.)
                                            </h4>
                                            <div className="border rounded-lg overflow-hidden flex flex-col flex-1 max-h-[500px]">
                                                <div className="p-4 bg-gray-50 border-b">
                                                    <p className="text-sm text-gray-500 italic">Select the charges to be added for this new encounter type.</p>
                                                </div>
                                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                                    {Object.keys(chargesByType).map(type => (
                                                        <div key={type} className="mb-4">
                                                            <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{chargeTypeLabels[type] || type}</h5>
                                                            <div className="space-y-2">
                                                                {chargesByType[type].map(charge => {
                                                                    const isSelected = selectedCharges.includes(charge._id);
                                                                    let fee = charge.standardFee || charge.basePrice || 0;
                                                                    if (selectedPatient.provider === 'Retainership') fee = charge.retainershipFee || fee;
                                                                    else if (selectedPatient.provider === 'NHIA') fee = charge.nhiaFee || fee;
                                                                    else if (selectedPatient.provider === 'KSCHMA') fee = charge.kschmaFee || fee;

                                                                    return (
                                                                        <div
                                                                            key={charge._id}
                                                                            onClick={() => handleChargeToggle(charge._id)}
                                                                            className={`flex items-center justify-between p-3 rounded border cursor-pointer transition-all ${isSelected ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <div className={`w-5 h-5 rounded border flex items-center justify-center ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-gray-300'}`}>
                                                                                    {isSelected && <FaPlus size={10} />}
                                                                                </div>
                                                                                <span className="font-semibold text-gray-800">{charge.name}</span>
                                                                            </div>
                                                                            <span className="font-bold text-blue-700">₦{fee.toLocaleString()}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="p-4 bg-gray-100 border-t flex justify-between items-center">
                                                    <span className="text-gray-600 text-sm font-semibold">{selectedCharges.length} item(s) selected</span>
                                                    <span className="text-lg font-bold text-gray-800">
                                                        Total: ₦{charges.filter(c => selectedCharges.includes(c._id)).reduce((sum, c) => {
                                                            let fee = c.standardFee || c.basePrice || 0;
                                                            if (selectedPatient.provider === 'Retainership') fee = c.retainershipFee || fee;
                                                            else if (selectedPatient.provider === 'NHIA') fee = c.nhiaFee || fee;
                                                            else if (selectedPatient.provider === 'KSCHMA') fee = c.kschmaFee || fee;
                                                            return sum + fee;
                                                        }, 0).toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="mt-8 pt-6 border-t flex justify-end gap-4">
                                <button
                                    onClick={() => setShowChangeEncounterModal(false)}
                                    className="px-6 py-2 bg-gray-200 text-gray-800 rounded font-bold hover:bg-gray-300"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleChangeEncounterSubmission}
                                    className="px-8 py-2 bg-orange-600 text-white rounded font-bold hover:bg-orange-700 shadow-lg flex items-center gap-2"
                                >
                                    <FaCalendarAlt /> Update Encounter & Add Charges
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default FrontDeskDashboard;

