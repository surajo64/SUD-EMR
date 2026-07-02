import { useState, useEffect, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import { FaSearch, FaUserPlus } from 'react-icons/fa';
import { formatAge } from '../utils/patientUtils';

const PatientList = () => {
    const [patients, setPatients] = useState([]);
    const [todayPatients, setTodayPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'seen', 'unseen'
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    useEffect(() => {
        if (user) {
            fetchPatients();
        }
    }, [user]);

    useEffect(() => {
        if (search.trim() === '') {
            let result = [...todayPatients];
            if (statusFilter === 'seen') {
                result = result.filter(p => p.seen);
            } else if (statusFilter === 'unseen') {
                result = result.filter(p => !p.seen);
            }
            setFilteredPatients(result);
        } else {
            const filtered = patients.filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.mrn && p.mrn.toLowerCase().includes(search.toLowerCase())) ||
                (p.contact && p.contact.includes(search))
            );
            setFilteredPatients(filtered);
        }
    }, [search, patients, todayPatients, statusFilter]);

    const fetchPatients = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Fetch all patients for searching
            const { data: allPatients } = await axios.get(`${backendUrl}/api/patients`, config);
            setPatients(allPatients);

            // Fetch today's patients via visits
            const { data: todayVisits } = await axios.get(`${backendUrl}/api/visits?today=true`, config);

            // Extract unique patients from visits, maintaining recent order
            const uniqueTodayPatients = [];
            const seenPatientIds = new Set();

            // Sort visits oldest first (first come first serve)
            const sortedVisits = [...todayVisits].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            sortedVisits.forEach(visit => {
                if (visit.patient && !seenPatientIds.has(visit.patient._id)) {
                    seenPatientIds.add(visit.patient._id);
                    uniqueTodayPatients.push({
                        ...visit.patient,
                        hasUnpaidConsultation: visit.hasUnpaidConsultation,
                        visitId: visit._id,
                        visitCreatedAt: visit.createdAt,
                        seen: visit.seen,
                        seenBy: visit.seenBy,
                        seenAt: visit.seenAt,
                        encounterStatus: visit.encounterStatus
                    });
                }
            });

            // Ensure todayPatients are sorted oldest first by check-in (createdAt)
            uniqueTodayPatients.sort((a, b) => new Date(a.visitCreatedAt) - new Date(b.visitCreatedAt));

            setTodayPatients(uniqueTodayPatients);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                    {search ? 'Search Results' : "Today's Active Patients"}
                </h2>
                {!search && (
                    <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded-full uppercase">
                        {todayPatients.length} active today
                    </span>
                )}
            </div>

            {!search && (
                <div className="flex gap-2 mb-6">
                    <button
                        onClick={() => setStatusFilter('all')}
                        className={`px-4 py-2 rounded text-sm font-semibold transition ${
                            statusFilter === 'all'
                                ? 'bg-green-700 text-white shadow'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        All Active ({todayPatients.length})
                    </button>
                    <button
                        onClick={() => setStatusFilter('unseen')}
                        className={`px-4 py-2 rounded text-sm font-semibold transition ${
                            statusFilter === 'unseen'
                                ? 'bg-amber-600 text-white shadow'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Unseen ({todayPatients.filter(p => !p.seen).length})
                    </button>
                    <button
                        onClick={() => setStatusFilter('seen')}
                        className={`px-4 py-2 rounded text-sm font-semibold transition ${
                            statusFilter === 'seen'
                                ? 'bg-green-600 text-white shadow'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Seen ({todayPatients.filter(p => p.seen).length})
                    </button>
                </div>
            )}

            <div className="mb-6 relative">
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by Name, MRN or Phone..."
                    className="w-full pl-10 p-2 border rounded focus:outline-none focus:border-green-500"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">MRN</th>
                            <th className="p-4 border-b">Name</th>
                            <th className="p-4 border-b">Age</th>
                            <th className="p-4 border-b">Gender</th>
                            <th className="p-4 border-b">Contact</th>
                            <th className="p-4 border-b">Status</th>
                            <th className="p-4 border-b">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPatients.map((patient) => (
                            <tr key={patient._id} className="hover:bg-gray-50">
                                <td className="p-4 border-b font-mono text-sm text-gray-600">{patient.mrn || 'N/A'}</td>
                                <td className="p-4 border-b font-semibold">
                                    <div className="flex items-center gap-2">
                                        {patient.name}
                                        {patient.hasUnpaidConsultation && user?.role === 'doctor' && (
                                            <span className="bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded border border-red-200 uppercase tracking-wider">
                                                Unpaid consultation
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="p-4 border-b">{formatAge(patient.age)}</td>
                                <td className="p-4 border-b capitalize">{patient.gender}</td>
                                <td className="p-4 border-b">{patient.contact}</td>
                                <td className="p-4 border-b">
                                    {patient.visitId ? (
                                        patient.seen ? (
                                            <div className="flex flex-col">
                                                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 w-fit">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                                                    Seen by {patient.seenBy?.name || 'Doctor'}
                                                </span>
                                                <span className="text-[10px] text-gray-500 mt-1">
                                                    {new Date(patient.seenAt).toLocaleDateString()} at {new Date(patient.seenAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 w-fit">
                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                Unseen
                                            </span>
                                        )
                                    ) : (
                                        <span className="text-gray-400 text-xs">-</span>
                                    )}
                                </td>
                                <td className="p-4 border-b">
                                    <Link to={`/patient/${patient._id}`} className="text-blue-600 hover:underline">View Details</Link>
                                </td>
                            </tr>
                        ))}
                        {filteredPatients.length === 0 && (
                            <tr>
                                <td colSpan="6" className="p-4 text-center text-gray-500">No patients found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </Layout>
    );
};

export default PatientList;
