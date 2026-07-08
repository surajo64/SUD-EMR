import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaUserMd, FaSearch, FaBed, FaUserInjured, FaHospital } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';
import { formatAge } from '../utils/patientUtils';

const InpatientManagement = () => {
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [inpatients, setInpatients] = useState([]);
    const [filteredInpatients, setFilteredInpatients] = useState([]);
    const [wards, setWards] = useState([]);
    const [selectedWard, setSelectedWard] = useState('all');

    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (user) {
            fetchInpatients();
            fetchWards();
        }
    }, [user]);

    const fetchWards = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/wards`, config);
            setWards(data);
        } catch (error) {
            console.error('Error fetching wards:', error);
        }
    };

    const fetchInpatients = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            // Fetch all inpatient visits and filter for active ones in the frontend for maximum compatibility
            const { data } = await axios.get(`${backendUrl}/api/visits?type=Inpatient`, config);

            const activeInpatients = data.filter(v => v.patient && v.encounterStatus !== 'discharged' && v.encounterStatus !== 'cancelled');

            // Sort by admission date or created date (latest first)
            activeInpatients.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setInpatients(activeInpatients);
            setFilteredInpatients(activeInpatients);
        } catch (error) {
            console.error('Error fetching inpatients:', error);
            toast.error('Error fetching inpatient list');
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = (term, wardId) => {
        let filtered = inpatients;

        if (wardId && wardId !== 'all') {
            filtered = filtered.filter(visit => visit.ward?._id === wardId || visit.ward === wardId);
        }

        if (term) {
            const lowerTerm = term.toLowerCase();
            filtered = filtered.filter(visit =>
                visit.patient.name.toLowerCase().includes(lowerTerm) ||
                (visit.patient.mrn && visit.patient.mrn.toLowerCase().includes(lowerTerm)) ||
                (visit.ward && visit.ward.name.toLowerCase().includes(lowerTerm))
            );
        }

        setFilteredInpatients(filtered);
    };

    const handleSearch = (e) => {
        const term = e.target.value;
        setSearchTerm(term);
        applyFilters(term, selectedWard);
    };

    const handleWardFilter = (e) => {
        const wardId = e.target.value;
        setSelectedWard(wardId);
        applyFilters(searchTerm, wardId);
    };

    const handleSelectPatient = (visit) => {
        if (user.role === 'doctor') {
            // Navigate to patient details for doctors
            navigate(`/patient/${visit.patient._id}`);
        } else {
            // Navigate to triage page for nurses
            navigate(`/nurse/triage/${visit.patient._id}/${visit._id}`);
        }
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}

            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaBed className="text-green-600" /> Inpatient Management
                    </h2>
                    <p className="text-gray-600">View and manage currently admitted patients</p>
                </div>
                <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-bold flex items-center gap-2">
                    <FaUserInjured /> {filteredInpatients.length} Admitted Patients
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded shadow mb-6 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by Name or MRN..."
                        className="w-full border p-3 pl-10 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition"
                        value={searchTerm}
                        onChange={handleSearch}
                    />
                </div>
                <div className="md:w-64">
                    <select
                        className="w-full border p-3 rounded-lg focus:ring-2 focus:ring-green-500 outline-none transition bg-white"
                        value={selectedWard}
                        onChange={handleWardFilter}
                    >
                        <option value="all">All Wards</option>
                        {wards.map(ward => (
                            <option key={ward._id} value={ward._id}>{ward.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Inpatient List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredInpatients.length === 0 ? (
                    <div className="col-span-full bg-gray-50 border-2 border-dashed border-gray-200 p-12 rounded-xl text-center">
                        <FaHospital className="text-6xl text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-xl font-medium">No inpatients found matching your search.</p>
                        <button
                            onClick={fetchInpatients}
                            className="mt-4 text-green-600 font-bold hover:underline"
                        >
                            Refresh List
                        </button>
                    </div>
                ) : (
                    filteredInpatients.map((visit) => (
                        <div
                            key={visit._id}
                            onClick={() => handleSelectPatient(visit)}
                            className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer border border-transparent hover:border-green-200"
                        >
                            <div className="bg-green-600 p-4 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-bold text-lg truncate">{visit.patient.name}</h3>
                                        <p className="text-green-100 text-xs uppercase tracking-wider font-semibold">
                                            MRN: {visit.patient.mrn || 'N/A'}
                                        </p>
                                    </div>
                                    <div className="bg-white/20 px-2 py-1 rounded text-xs">
                                        {visit.patient.gender} | {formatAge(visit.patient.age)}
                                    </div>
                                </div>
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-3 text-gray-700">
                                    <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center text-green-600">
                                        <FaHospital size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Ward / Bed</p>
                                        <p className="font-semibold text-sm">
                                            {visit.ward?.name || 'Unassigned'} - Bed {visit.bed || 'N/A'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 text-gray-700">
                                    <div className="w-8 h-8 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                        <FaUserMd size={14} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold">Consulting Doctor</p>
                                        <p className="font-semibold text-sm">
                                            {visit.consultingPhysician?.name ? ` ${visit.consultingPhysician.name}` : 'Not assigned'}
                                        </p>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-gray-50 flex justify-between items-center text-xs text-gray-500">
                                    <span>Admitted: {new Date(visit.admissionDate || visit.createdAt).toLocaleDateString()}</span>
                                    <span className={`px-2 py-1 rounded font-bold uppercase ${visit.encounterStatus === 'in_ward' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                        {visit.encounterStatus.replace('_', ' ')}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </Layout>
    );
};

export default InpatientManagement;
