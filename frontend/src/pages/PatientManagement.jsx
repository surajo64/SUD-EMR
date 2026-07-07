import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaUserInjured, FaSearch, FaEdit, FaTrash, FaEye, FaCalendar, FaDownload, FaHospital, FaCalendarCheck, FaTimes, FaBed } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import LoadingOverlay from '../components/loadingOverlay';
import RegisterPatientModal from '../components/RegisterPatientModal';
import { formatAge } from '../utils/patientUtils';
import { FaIdCard } from 'react-icons/fa';
import PatientIDCard from '../components/PatientIDCard';
import useHospitalSettings from '../hooks/useHospitalSettings';

const PatientManagement = () => {
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [filterProvider, setFilterProvider] = useState('');
    const [filterHMO, setFilterHMO] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const PATIENTS_PER_PAGE = 5;
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [encounters, setEncounters] = useState([]);
    const [showEncountersModal, setShowEncountersModal] = useState(false);
    const [showEditPatientModal, setShowEditPatientModal] = useState(false);
    const [showRegisterPatientModal, setShowRegisterPatientModal] = useState(false);
    const [editPatient, setEditPatient] = useState(null);
    const [hmos, setHmos] = useState([]);
    const [familyFiles, setFamilyFiles] = useState([]);
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const navigate = useNavigate();

    // Create Encounter Modal State
    const [showEncounterModal, setShowEncounterModal] = useState(false);
    const [encounterPatient, setEncounterPatient] = useState(null);
    const [encounterType, setEncounterType] = useState('Outpatient');
    const [selectedClinic, setSelectedClinic] = useState('');
    const [reasonForVisit, setReasonForVisit] = useState('');
    const [charges, setCharges] = useState([]);
    const [clinics, setClinics] = useState([]);
    const [selectedCharges, setSelectedCharges] = useState([]);
    const [wards, setWards] = useState([]);
    const [availableBeds, setAvailableBeds] = useState([]);
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBed, setSelectedBed] = useState('');

    const [specialityClinics, setSpecialityClinics] = useState([]);
    const [doctors, setDoctors] = useState([]);

    const [waiveConsultationFee, setWaiveConsultationFee] = useState(false);
    const [needSpeciality, setNeedSpeciality] = useState(false);
    const [selectedSpecialityClinic, setSelectedSpecialityClinic] = useState('');
    const [needSpecificDoctor, setNeedSpecificDoctor] = useState(false);
    const [selectedSpecificDoctor, setSelectedSpecificDoctor] = useState('');

    // Card Modal State
    const [showCardModal, setShowCardModal] = useState(false);
    const [cardPatient, setCardPatient] = useState(null);
    const { settings: hospitalSettings } = useHospitalSettings();

    const handlePrintCard = () => {
        const frontContent = document.getElementById(`patient-card-front-${cardPatient._id}`);
        const backContent = document.getElementById(`patient-card-back-${cardPatient._id}`);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Patient ID Card - ${cardPatient.name}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
                    <style>
                        body { 
                            margin: 0; 
                            padding: 20px; 
                            font-family: 'Inter', sans-serif; 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            gap: 20px; 
                        }
                        @media print {
                            @page { size: auto; margin: 0; }
                            body { margin: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                            .no-print { display: none; }
                            div[id^="patient-card"] { 
                                margin-bottom: 20px !important; 
                                box-shadow: none !important; 
                                break-inside: avoid;
                                border: none !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div style="margin-bottom: 20px;">
                        ${frontContent.outerHTML}
                    </div>
                    <div style="margin-bottom: 20px;">
                        ${backContent.outerHTML}
                    </div>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };
    const [pendingEncounterPatient, setPendingEncounterPatient] = useState(null);
    const [isANC, setIsANC] = useState(false);

    // Watch for pending encounter patient and register modal closing
    useEffect(() => {
        if (pendingEncounterPatient && !showRegisterPatientModal) {
            setEncounterPatient(pendingEncounterPatient);
            setEncounterType('Outpatient');
            setSelectedClinic('');
            setReasonForVisit('');
            setSelectedCharges([]);
            setSelectedWard('');
            setSelectedBed('');
            setShowEncounterModal(true);
            setPendingEncounterPatient(null);
        }
    }, [pendingEncounterPatient, showRegisterPatientModal]);

    useEffect(() => {
        if (user && (user.role === 'admin' || user.role === 'super_admin' || user.role === 'receptionist' || user.role === 'readonly_admin')) {
            fetchPatients();
            fetchHMOs();
            fetchFamilyFiles();
            fetchClinics();
            fetchCharges();
            fetchWards();
            fetchSpecialityClinics();
            fetchDoctors();
        }
    }, [user]);

    useEffect(() => {
        if (selectedWard) {
            const ward = wards.find(w => w._id === selectedWard);
            if (ward) setAvailableBeds(ward.beds.filter(b => !b.isOccupied));
        } else {
            setAvailableBeds([]);
        }
    }, [selectedWard, wards]);

    useEffect(() => {
        filterPatients();
    }, [searchTerm, startDate, endDate, patients, filterProvider, filterHMO]);

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

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'dateOfBirth') {
            const age = calculateAge(value);
            setEditPatient({ ...editPatient, dateOfBirth: value, age: age });
        } else if (name === 'age') {
            const dob = calculateDOBFromAge(value);
            setEditPatient({ ...editPatient, age: value, dateOfBirth: dob });
        } else {
            setEditPatient({ ...editPatient, [name]: type === 'checkbox' ? checked : value });
        }
    };

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/patients`, config);
            setPatients(data);
            setFilteredPatients(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patients');
        } finally {
            setLoading(false);
        }
    };

    const fetchHMOs = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/hmos?active=true`, config);
            setHmos(data);
        } catch (error) {
            console.error('Error fetching HMOs:', error);
        }
    };

    const fetchFamilyFiles = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/family-files`, config);
            if (Array.isArray(data)) {
                setFamilyFiles(data.filter(f => f.active !== false));
            }
        } catch (error) {
            console.error('Error fetching family files:', error);
        }
    };

    const fetchClinics = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/clinics?active=true`, config);
            setClinics(data);
        } catch (error) {
            console.error('Error fetching clinics:', error);
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

    const fetchCharges = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/charges?active=true`, config);
            setCharges(data.filter(c => c.type === 'consultation'));
        } catch (error) {
            console.error('Error fetching charges:', error);
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

    const closeEncounterModal = () => {
        setShowEncounterModal(false);
        setEncounterPatient(null);
        setEncounterType('Outpatient');
        setSelectedClinic('');
        setReasonForVisit('');
        setSelectedCharges([]);
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
        setSelectedCharges(prev =>
            prev.includes(chargeId) ? prev.filter(id => id !== chargeId) : [...prev, chargeId]
        );
    };

    const handleCreateEncounter = async () => {
        if (!encounterPatient) return;
        if (!isANC && !waiveConsultationFee && !['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(encounterType) && selectedCharges.length === 0) {
            toast.error('Please select at least one charge, or check ANC to skip charges');
            return;
        }
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const visitData = {
                patientId: encounterPatient._id,
                doctorId: user._id,
                type: encounterType,
                encounterType: encounterType,
                clinic: selectedClinic || undefined,
                subjective: 'Encounter created at Front Desk',
                reasonForVisit,
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
            for (const chargeId of selectedCharges) {
                await axios.post(`${backendUrl}/api/encounter-charges`, {
                    encounterId: visitResponse.data._id,
                    patientId: encounterPatient._id,
                    chargeId,
                    quantity: 1,
                    notes: 'Added at registration'
                }, config);
            }
            const total = charges.filter(c => selectedCharges.includes(c._id)).reduce((s, c) => {
                if (waiveConsultationFee && c.type === 'consultation') return s;
                return s + c.basePrice;
            }, 0);
            if (!['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(encounterType)) {
                await axios.put(`${backendUrl}/api/visits/${visitResponse.data._id}`,
                    { encounterStatus: isANC || waiveConsultationFee ? 'in_nursing' : (total > 0 ? 'payment_pending' : 'in_nursing'), isANC: isANC || undefined }, config);
            }
            toast.success('Encounter created successfully!');
            closeEncounterModal();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error creating encounter');
        } finally {
            setLoading(false);
        }
    };

    const filterPatients = () => {
        let filtered = patients;

        // Search filter
        if (searchTerm) {
            filtered = filtered.filter(p =>
                p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.contact?.includes(searchTerm)
            );
        }

        // Date range filter (by registration date)
        if (startDate) {
            filtered = filtered.filter(p => new Date(p.createdAt) >= new Date(startDate));
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filtered = filtered.filter(p => new Date(p.createdAt) <= end);
        }

        // Provider filter
        if (filterProvider) {
            if (filterProvider === 'Standard') {
                filtered = filtered.filter(p => !p.provider || p.provider === 'Standard');
            } else {
                filtered = filtered.filter(p => p.provider === filterProvider);
            }
        }

        // HMO filter
        if (['Retainership', 'NHIA'].includes(filterProvider) && filterHMO) {
            filtered = filtered.filter(p => p.hmo === filterHMO);
        }

        // Sort: newest first
        filtered = [...filtered].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setFilteredPatients(filtered);
        setCurrentPage(1); // reset to first page on any filter change
    };

    const fetchPatientEncounters = async (patientId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/visits/patient/${patientId}`, config);
            setEncounters(data);
            setShowEncountersModal(true);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching encounters');
        }
    };

    const handleDeleteEncounter = async (encounterId) => {
        if (!window.confirm('Are you sure you want to delete this encounter? This will permanently remove all associated data (orders, charges, vitals).')) {
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/visits/${encounterId}`, config);
            toast.success('Encounter deleted successfully!');
            // Refresh encounters
            fetchPatientEncounters(selectedPatient._id);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error deleting encounter');
        }
    };

    const handleUpdateEncounterStatus = async (encounterId, newStatus) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`${backendUrl}/api/visits/${encounterId}`,
                { encounterStatus: newStatus },
                config
            );
            toast.success('Encounter status updated!');
            fetchPatientEncounters(selectedPatient._id);
        } catch (error) {
            console.error(error);
            toast.error('Error updating encounter status');
        }
    };

    const handleUpdatePatient = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`${backendUrl}/api/patients/${editPatient._id}`, editPatient, config);
            toast.success('Patient updated successfully!');
            setShowEditPatientModal(false);
            setEditPatient(null);
            fetchPatients();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error updating patient');
        }
    };

    const handleDeletePatient = async (patientId) => {
        if (!window.confirm('Are you sure you want to delete this patient? This will permanently remove all patient data including encounters, orders, and charges.')) {
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/patients/${patientId}`, config);
            toast.success('Patient deleted successfully!');
            fetchPatients();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error deleting patient');
        }
    };

    const exportToExcel = () => {
        const worksheetData = filteredPatients.map(patient => ({
            'MRN': patient.mrn || 'N/A',
            'Name': patient.name,
            'Age': patient.age || 'N/A',
            'Gender': patient.gender || 'N/A',
            'Phone': patient.contact || 'N/A',
            'Address': patient.address || 'N/A',
            'Registration Date': new Date(patient.createdAt).toLocaleDateString()
        }));

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

        const filename = startDate && endDate
            ? `Patients_${startDate}_to_${endDate}.xlsx`
            : `All_Patients_${new Date().toISOString().split('T')[0]}.xlsx`;

        saveAs(data, filename);
        toast.success('Patient list exported successfully!');
    };

    if (user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'receptionist' && user?.role !== 'readonly_admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access patient management.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg shadow-lg">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <FaUserInjured /> Patient Management
                    </h1>
                    <p className="text-blue-100">Manage patients, encounters, and view patient history</p>
                </div>

                {/* Search and Filters */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-4">Search & Filter Patients</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, MRN, or phone..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">From Date</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1">To Date</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1">Provider Type</label>
                            <select
                                className="w-full border p-2 rounded"
                                value={filterProvider}
                                onChange={(e) => {
                                    setFilterProvider(e.target.value);
                                    setFilterHMO('');
                                }}
                            >
                                <option value="">All Providers</option>
                                <option value="Standard">Standard Patient</option>
                                <option value="Retainership">Retainership</option>
                                <option value="NHIA">NHIA</option>
                                <option value="KSCHMA">State Insurance</option>
                            </select>
                        </div>
                        {(filterProvider === 'Retainership' || filterProvider === 'NHIA') && (
                            <div className="md:col-span-2">
                                <label className="block text-sm font-semibold mb-1">HMO</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={filterHMO}
                                    onChange={(e) => setFilterHMO(e.target.value)}
                                >
                                    <option value="">All HMOs</option>
                                    {hmos
                                        .filter(hmo => hmo.category === filterProvider)
                                        .map(hmo => (
                                            <option key={hmo._id} value={hmo.name}>
                                                {hmo.name}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                        )}
                    </div>
                    <div className="mt-4 flex gap-2">
                        {user.role !== 'readonly_admin' && (
                            <button
                                onClick={() => setShowRegisterPatientModal(true)}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
                            >
                                <FaUserInjured /> Register Patient
                            </button>
                        )}
                        <button
                            onClick={exportToExcel}
                            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                        >
                            <FaDownload /> Export to Excel
                        </button>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setStartDate('');
                                setEndDate('');
                                setFilterProvider('');
                                setFilterHMO('');
                            }}
                            className="bg-gray-400 text-white px-6 py-2 rounded-lg hover:bg-gray-500"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <p className="text-gray-600 text-sm font-semibold mb-2">Total Patients</p>
                        <p className="text-3xl font-bold text-blue-600">{patients.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <p className="text-gray-600 text-sm font-semibold mb-2">Filtered Results</p>
                        <p className="text-3xl font-bold text-green-600">{filteredPatients.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <p className="text-gray-600 text-sm font-semibold mb-2">Male Patients</p>
                        <p className="text-3xl font-bold text-purple-600">
                            {filteredPatients.filter(p => p.gender?.toLowerCase() === 'male').length}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <p className="text-gray-600 text-sm font-semibold mb-2">Female Patients</p>
                        <p className="text-3xl font-bold text-pink-600">
                            {filteredPatients.filter(p => p.gender?.toLowerCase() === 'female').length}
                        </p>
                    </div>
                </div>

                {/* Patients Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-4 text-left">MRN</th>
                                <th className="p-4 text-left">Name</th>
                                <th className="p-4 text-left">Age/Gender</th>
                                <th className="p-4 text-left">Phone</th>
                                <th className="p-4 text-left">Provider</th>
                                <th className="p-4 text-left">Registered</th>
                                <th className="p-4 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients
                                .slice((currentPage - 1) * PATIENTS_PER_PAGE, currentPage * PATIENTS_PER_PAGE)
                                .map((patient) => (
                                    <tr key={patient._id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-semibold text-blue-600">{patient.mrn || 'N/A'}</td>
                                        <td className="p-4 font-semibold">{patient.name}</td>
                                        <td className="p-4">
                                            {formatAge(patient.age)} / {patient.gender || 'N/A'}
                                        </td>
                                        <td className="p-4 text-gray-600">{patient.contact || 'N/A'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${patient.provider === 'Standard' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'
                                                }`}>
                                                {patient.provider || 'Standard'}
                                            </span>
                                            {patient.hmo && (
                                                <div className="text-[10px] text-gray-500 mt-1 italic line-clamp-1 max-w-[120px]">
                                                    HMO: {patient.hmo}
                                                </div>
                                            )}
                                            {patient.familyFile && (
                                                <div className="text-[10px] text-green-600 mt-1 italic font-semibold line-clamp-1 max-w-[120px]">
                                                    Family: {typeof patient.familyFile === 'object' ? patient.familyFile.familyName : 'Linked'}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-gray-600">
                                            {new Date(patient.createdAt).toLocaleDateString()}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => navigate(`/patient/${patient._id}`)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="View Details"
                                                >
                                                    <FaEye />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setSelectedPatient(patient);
                                                        fetchPatientEncounters(patient._id);
                                                    }}
                                                    className="text-purple-600 hover:text-purple-800"
                                                    title="View Encounters"
                                                >
                                                    <FaHospital />
                                                </button>
                                                {user.role !== 'readonly_admin' && (
                                                    <button
                                                        onClick={() => {
                                                            setEditPatient({
                                                                ...patient,
                                                                isFamilyMember: !!patient.familyFile,
                                                                familyFileId: typeof patient.familyFile === 'object' ? patient.familyFile?._id : (patient.familyFile || '')
                                                            });
                                                            setShowEditPatientModal(true);
                                                        }}
                                                        className="text-green-600 hover:text-green-800"
                                                        title="Edit Patient"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                )}
                                                {(user.role === 'admin' || user.role === 'super_admin') && (
                                                    <button
                                                        onClick={() => handleDeletePatient(patient._id)}
                                                        className="text-red-600 hover:text-red-800"
                                                        title="Delete Patient"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        setCardPatient(patient);
                                                        setShowCardModal(true);
                                                    }}
                                                    className="text-orange-600 hover:text-orange-800"
                                                    title="Generate card"
                                                >
                                                    <FaIdCard />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                    {filteredPatients.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No patients found
                        </div>
                    )}
                    {/* Pagination */}
                    {filteredPatients.length > PATIENTS_PER_PAGE && (
                        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                            <p className="text-sm text-gray-600">
                                Showing {Math.min((currentPage - 1) * PATIENTS_PER_PAGE + 1, filteredPatients.length)}–{Math.min(currentPage * PATIENTS_PER_PAGE, filteredPatients.length)} of {filteredPatients.length} patients
                            </p>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ← Prev
                                </button>
                                {Array.from({ length: Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE) }, (_, i) => i + 1)
                                    .filter(page => page === 1 || page === Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE) || Math.abs(page - currentPage) <= 1)
                                    .reduce((acc, page, idx, arr) => {
                                        if (idx > 0 && arr[idx - 1] !== page - 1) acc.push('...');
                                        acc.push(page);
                                        return acc;
                                    }, [])
                                    .map((item, idx) =>
                                        item === '...' ? (
                                            <span key={`ellipsis-${idx}`} className="px-2 text-gray-400">…</span>
                                        ) : (
                                            <button
                                                key={item}
                                                onClick={() => setCurrentPage(item)}
                                                className={`px-3 py-1.5 text-sm border rounded ${currentPage === item
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'hover:bg-gray-100'
                                                    }`}
                                            >
                                                {item}
                                            </button>
                                        )
                                    )
                                }
                                <button
                                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE), p + 1))}
                                    disabled={currentPage === Math.ceil(filteredPatients.length / PATIENTS_PER_PAGE)}
                                    className="px-3 py-1.5 text-sm border rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Encounters Modal */}
            {showEncountersModal && selectedPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">
                                Encounters for {selectedPatient.name}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowEncountersModal(false);
                                    setSelectedPatient(null);
                                    setEncounters([]);
                                }}
                                className="text-gray-500 hover:text-gray-700 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        {encounters.length === 0 ? (
                            <p className="text-center text-gray-500 py-8">No encounters found</p>
                        ) : (
                            <div className="space-y-4">
                                {encounters.map((encounter) => (
                                    <div key={encounter._id} className="border rounded-lg p-4">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="font-semibold text-lg">
                                                    {new Date(encounter.createdAt).toLocaleString()}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    Created By: {encounter.doctor?.name || 'N/A'}
                                                </p>
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <select
                                                    disabled={user.role === 'readonly_admin'}
                                                    value={encounter.encounterStatus}
                                                    onChange={(e) => handleUpdateEncounterStatus(encounter._id, e.target.value)}
                                                    className="border p-1 rounded text-sm disabled:opacity-50 disabled:bg-gray-100"
                                                >
                                                    <option value="registered">Registered</option>
                                                    <option value="admitted">Admitted</option>
                                                    <option value="in_nursing">In Nursing</option>
                                                    <option value="with_doctor">With Doctor</option>
                                                    <option value="in_ward">In Ward</option>
                                                    <option value="discharged">Discharged</option>
                                                    <option value="completed">Completed</option>
                                                    <option value="cancelled">Cancelled</option>
                                                </select>
                                                {user.role === 'admin' && (
                                                    <button
                                                        onClick={() => handleDeleteEncounter(encounter._id)}
                                                        className="text-red-600 hover:text-red-800"
                                                        title="Delete Encounter"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {encounter.ward && (
                                            <div className="bg-blue-50 p-4 rounded mb-4 border border-blue-200">
                                                <p className="font-semibold text-blue-800">

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


                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <p className="font-semibold">Status:</p>
                                                <span className={`px-2 py-1 rounded text-xs ${encounter.encounterStatus === 'active' ? 'bg-green-100 text-green-800' :
                                                    encounter.encounterStatus === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {encounter.encounterStatus}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="font-semibold">Reason:</p>
                                                <p className="text-gray-600">{encounter.reasonForVisit || 'N/A'}</p>
                                            </div>
                                        </div>


                                        {encounter.subjective && (
                                            <div className="mt-3 p-3 bg-gray-50 rounded">
                                                <p className="font-semibold text-sm">SOAP Notes:</p>
                                                <p className="text-sm text-gray-700 mt-1">
                                                    <strong>S:</strong> {encounter.subjective}
                                                </p>
                                                {encounter.objective && (
                                                    <p className="text-sm text-gray-700">
                                                        <strong>O:</strong> {encounter.objective}
                                                    </p>
                                                )}
                                                {encounter.assessment && (
                                                    <p className="text-sm text-gray-700">
                                                        <strong>A:</strong> {encounter.assessment}
                                                    </p>
                                                )}
                                                {encounter.plan && (
                                                    <p className="text-sm text-gray-700">
                                                        <strong>P:</strong> {encounter.plan}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Patient Modal */}
            {showEditPatientModal && editPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Edit Patient</h3>
                            <button
                                onClick={() => {
                                    setShowEditPatientModal(false);
                                    setEditPatient(null);
                                }}
                                className="text-gray-500 hover:text-gray-700 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <form onSubmit={handleUpdatePatient} className="space-y-4">
                            {/* Family File Section */}
                            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        id="editIsFamilyMember"
                                        checked={editPatient.isFamilyMember}
                                        onChange={(e) => setEditPatient({ ...editPatient, isFamilyMember: e.target.checked })}
                                        className="w-5 h-5 text-blue-600"
                                    />
                                    <label htmlFor="editIsFamilyMember" className="font-bold text-blue-800 cursor-pointer flex items-center gap-2">
                                        Belong to Family File?
                                    </label>
                                </div>

                                {editPatient.isFamilyMember && (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                                        <div className="md:col-span-3">
                                            <label className="block text-sm font-semibold text-blue-700 mb-1">Select Family File *</label>
                                            <select
                                                required={editPatient.isFamilyMember}
                                                value={editPatient.familyFileId}
                                                onChange={(e) => setEditPatient({ ...editPatient, familyFileId: e.target.value })}
                                                className="w-full border p-2 rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">-- Choose Family --</option>
                                                {familyFiles.length === 0 ? (
                                                    <option disabled>No families found</option>
                                                ) : (
                                                    familyFiles.map(file => (
                                                        <option key={file._id} value={file._id} disabled={file.type === 'Family of 5' && file.memberCount >= 5 && (typeof editPatient.familyFile === 'object' ? editPatient.familyFile?._id : editPatient.familyFile) !== file._id}>
                                                            {file.familyName} ({file.fileNumber}) - {file.memberCount}/{file.type === 'Family of 5' ? '5' : '∞'}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={fetchFamilyFiles}
                                            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm h-[42px] flex items-center justify-center"
                                            title="Refresh List"
                                        >
                                            ↻ Refresh
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Name</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        name="name"
                                        value={editPatient.name}
                                        onChange={handleEditChange}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">MRN</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={editPatient.mrn || ''}
                                        onChange={(e) => setEditPatient({ ...editPatient, mrn: e.target.value })}
                                        disabled
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Date of Birth</label>
                                    <input
                                        type="date"
                                        name="dateOfBirth"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500"
                                        value={editPatient.dateOfBirth ? new Date(editPatient.dateOfBirth).toISOString().split('T')[0] : ''}
                                        onChange={handleEditChange}
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">
                                        Age *
                                        {editPatient.age && (
                                            <span className="ml-2 text-[10px] text-blue-600 italic">
                                                {formatAge(editPatient.age)}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="number"
                                        name="age"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500"
                                        value={editPatient.age || ''}
                                        onChange={handleEditChange}
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Gender</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        name="gender"
                                        value={editPatient.gender || ''}
                                        onChange={handleEditChange}
                                    >
                                        <option value="">Select</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Phone</label>
                                    <input
                                        type="text"
                                        name="contact"
                                        className="w-full border p-2 rounded"
                                        value={editPatient.contact || ''}
                                        onChange={handleEditChange}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Address *</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    rows="2"
                                    name="address"
                                    value={editPatient.address || ''}
                                    onChange={handleEditChange}
                                    required
                                />
                            </div>

                            {/* Provider & Insurance Section */}
                            <div className="border-t pt-4">
                                <h4 className="font-semibold text-gray-700 mb-3">Provider Information</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Provider</label>
                                        <select
                                            className="w-full border p-2 rounded"
                                            name="provider"
                                            value={editPatient.provider || 'Standard'}
                                            onChange={handleEditChange}
                                        >
                                            <option value="Standard">Standard</option>
                                            <option value="Corporate Retainership">Corporate Retainership</option>
                                            <option value="Family Retainership">Family Retainership</option>
                                            <option value="NHIA">NHIA</option>
                                            <option value="KSCHMA">KSCHMA</option>
                                        </select>
                                    </div>
 
                                    {/* HMO - Shown for Retainership, NHIA and KSCHMA */}
                                    {(['Retainership', 'Corporate Retainership', 'Family Retainership', 'NHIA', 'KSCHMA'].includes(editPatient.provider)) && (
                                        <div>
                                            <label className="block text-sm font-semibold mb-1">
                                                HMO <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                className="w-full border p-2 rounded"
                                                name="hmo"
                                                value={editPatient.hmo || ''}
                                                onChange={handleEditChange}
                                                required={['Retainership', 'Corporate Retainership', 'Family Retainership', 'NHIA', 'KSCHMA'].includes(editPatient.provider)}
                                            >
                                                <option value="">Select HMO *</option>
                                                {hmos
                                                    .filter(hmo => {
                                                        // Strict filtering based on category for NHIA and Retainership
                                                        if (editPatient.provider === 'NHIA') {
                                                            return hmo.category === 'NHIA';
                                                        }
                                                        if (editPatient.provider === 'Corporate Retainership') {
                                                            return hmo.category === 'Retainership' && (hmo.retainershipType === 'Corporate' || hmo.retainershipType === '');
                                                        }
                                                        if (editPatient.provider === 'Family Retainership') {
                                                            return hmo.category === 'Retainership' && hmo.retainershipType === 'Family';
                                                        }
                                                        if (editPatient.provider === 'Retainership') {
                                                            return hmo.category === 'Retainership';
                                                        }
                                                        // For KSCHMA, show only KSCHMA HMO
                                                        if (editPatient.provider === 'KSCHMA') {
                                                            return hmo.name.toUpperCase() === 'KSCHMA';
                                                        }
                                                        return true;
                                                    })
                                                    .map(hmo => (
                                                        <option key={hmo._id} value={hmo.name}>
                                                            {hmo.name}
                                                        </option>
                                                    ))}
                                            </select>
                                        </div>
                                    )}

                                    {(editPatient.provider === 'NHIA' || editPatient.provider === 'KSCHMA') && (
                                        <div>
                                            <label className="block text-sm font-semibold mb-1">Insurance Number <span className="text-red-500">*</span></label>
                                            <input
                                                type="text"
                                                className="w-full border p-2 rounded"
                                                name="insuranceNumber"
                                                value={editPatient.insuranceNumber || ''}
                                                onChange={handleEditChange}
                                                required
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Emergency Contact Section */}
                            <div className="border-t pt-4">
                                <h4 className="font-semibold text-gray-700 mb-3">Emergency Contact</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Contact Name</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            name="emergencyContactName"
                                            value={editPatient.emergencyContactName || ''}
                                            onChange={handleEditChange}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Contact Phone</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            name="emergencyContactPhone"
                                            value={editPatient.emergencyContactPhone || ''}
                                            onChange={handleEditChange}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                >
                                    Update Patient
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowEditPatientModal(false);
                                        setEditPatient(null);
                                    }}
                                    className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Register Patient Modal */}
            <RegisterPatientModal
                isOpen={showRegisterPatientModal}
                onClose={() => setShowRegisterPatientModal(false)}
                onSuccess={(newPatient) => {
                    fetchPatients();
                    setPendingEncounterPatient(newPatient);
                    setShowRegisterPatientModal(false);
                }}
                userToken={user.token}
            />

            {/* Create Encounter Modal */}
            {showEncounterModal && encounterPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */}
                        <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaCalendarCheck /> Create Encounter
                            </h3>
                            <button onClick={closeEncounterModal} className="text-white hover:text-gray-200">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Patient Info */}
                            <div className="bg-gray-50 p-4 rounded mb-6">
                                <h4 className="font-bold text-lg mb-2">Patient Information</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-600">Name</p>
                                        <p className="font-semibold">{encounterPatient.name}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">MRN</p>
                                        <p className="font-semibold">{encounterPatient.mrn}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Age</p>
                                        <p className="font-semibold">{formatAge(encounterPatient.age)}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600">Gender</p>
                                        <p className="font-semibold capitalize">{encounterPatient.gender}</p>
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
                                    <option value="External Lab/Radiology">External Lab/Radiology</option>
                                    <option value="External Pharmacy">External Pharmacy</option>
                                    <option value="Consultation">Consultation</option>
                                </select>
                            </div>

                            {/* Clinic */}
                            <div className="mb-6">
                                <label className="block text-gray-700 font-semibold mb-2">Clinic (Optional)</label>
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
                                <label className="block text-gray-700 font-semibold mb-2">Reason for Visit</label>
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
                                <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${waiveConsultationFee ? 'bg-green-50 border-green-400' : 'bg-gray-50 border-gray-200 hover:border-pink-300'
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

                            {/* Inpatient Ward/Bed */}
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
                                                onChange={(e) => { setSelectedWard(e.target.value); setSelectedBed(''); }}
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
                                                    <option key={bed._id} value={bed.number}>
                                                        {bed.number}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Charges */}
                            {!isANC && !['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(encounterType) && (
                                <div className="mb-6">
                                    <label className="block text-gray-700 font-semibold mb-2">
                                        Consultation Charges <span className="text-red-500">*</span>
                                    </label>
                                    {charges.length === 0 ? (
                                        <p className="text-gray-500 text-sm">No consultation charges available</p>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                            {charges.map(charge => {
                                                const patientFee = (waiveConsultationFee && charge.type === 'consultation') ? 0 : charge.basePrice;
                                                return (
                                                    <label key={charge._id} className={`flex items-center gap-3 p-3 border rounded cursor-pointer ${selectedCharges.includes(charge._id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                                                        }`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedCharges.includes(charge._id)}
                                                            onChange={() => handleChargeToggle(charge._id)}
                                                            className="w-4 h-4"
                                                        />
                                                        <span className="flex-1">{charge.name}</span>
                                                        <span className="font-semibold text-green-600">
                                                            {patientFee === 0 ? 'Waived (₦0)' : `₦${patientFee?.toLocaleString()}`}
                                                        </span>
                                                    </label>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {selectedCharges.length > 0 && (
                                        <p className="mt-2 text-right font-bold text-blue-700">
                                            Total: ₦{charges.filter(c => selectedCharges.includes(c._id)).reduce((s, c) => {
                                                if (waiveConsultationFee && c.type === 'consultation') return s;
                                                return s + c.basePrice;
                                            }, 0).toLocaleString()}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t">
                                <button
                                    onClick={handleCreateEncounter}
                                    disabled={loading || (!isANC && !waiveConsultationFee && !['External Investigation', 'External Pharmacy', 'External Lab/Radiology', 'Inpatient'].includes(encounterType) && selectedCharges.length === 0)}
                                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
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
                                            <FaCalendarCheck /> {isANC ? '🤰 Create ANC Encounter' : 'Create Encounter'}
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={closeEncounterModal}
                                    className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Patient Card Modal */}
            {showCardModal && cardPatient && (
                <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full relative">
                        <div className="bg-gradient-to-r from-orange-500 to-red-600 p-4 flex justify-between items-center text-white">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaIdCard /> Patient ID Card
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCardModal(false);
                                    setCardPatient(null);
                                }}
                                className="hover:bg-white/20 rounded-full p-1 transition-colors"
                            >
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="p-10 flex flex-col items-center justify-center bg-gray-50 max-h-[85vh] overflow-y-auto w-full pb-16">
                            <div className="flex flex-col gap-10 items-center w-full mt-10">
                                <div className="w-full flex flex-col items-center">
                                    <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-3 py-1 bg-gray-200 rounded-full">Front View</p>
                                    <div className="bg-white p-2 rounded-xl shadow-lg transform hover:scale-[1.02] transition-transform duration-300">
                                        <PatientIDCard patient={cardPatient} settings={hospitalSettings} side="front" />
                                    </div>
                                </div>
                                <div className="w-full flex flex-col items-center mt-4">
                                    <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-3 py-1 bg-gray-200 rounded-full">Back View</p>
                                    <div className="bg-white p-2 rounded-xl shadow-lg transform hover:scale-[1.02] transition-transform duration-300">
                                        <PatientIDCard patient={cardPatient} settings={hospitalSettings} side="back" />
                                    </div>
                                </div>
                            </div>

                            <div className="w-full flex gap-3 mt-10">
                                <button
                                    onClick={handlePrintCard}
                                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                                >
                                    <FaDownload /> Print ID Card
                                </button>
                                <button
                                    onClick={() => {
                                        setShowCardModal(false);
                                        setCardPatient(null);
                                    }}
                                    className="flex-1 bg-gray-200 text-gray-800 font-bold py-3 rounded-lg hover:bg-gray-300 transition"
                                >
                                    Close
                                </button>
                            </div>
                            <p className="mt-4 text-xs text-gray-500 text-center">
                                Tip: For best results, print on high-quality PVC cards or heavy cardstock.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default PatientManagement;
