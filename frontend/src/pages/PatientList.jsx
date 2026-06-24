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
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    useEffect(() => {
        if (user) {
            fetchPatients();
        }
    }, [user]);

    useEffect(() => {
        if (search.trim() === '') {
            setFilteredPatients(todayPatients);
        } else {
            const filtered = patients.filter(p =>
                p.name.toLowerCase().includes(search.toLowerCase()) ||
                (p.mrn && p.mrn.toLowerCase().includes(search.toLowerCase())) ||
                (p.contact && p.contact.includes(search))
            );
            setFilteredPatients(filtered);
        }
    }, [search, patients, todayPatients]);

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

            // Visits are already sorted by recent in many cases, but we ensure order
            const sortedVisits = [...todayVisits].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            sortedVisits.forEach(visit => {
                if (visit.patient && !seenPatientIds.has(visit.patient._id)) {
                    seenPatientIds.add(visit.patient._id);
                    uniqueTodayPatients.push(visit.patient);
                }
            });

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
                            <th className="p-4 border-b">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredPatients.map((patient) => (
                            <tr key={patient._id} className="hover:bg-gray-50">
                                <td className="p-4 border-b font-mono text-sm text-gray-600">{patient.mrn || 'N/A'}</td>
                                <td className="p-4 border-b font-semibold">{patient.name}</td>
                                <td className="p-4 border-b">{formatAge(patient.age)}</td>
                                <td className="p-4 border-b capitalize">{patient.gender}</td>
                                <td className="p-4 border-b">{patient.contact}</td>
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
