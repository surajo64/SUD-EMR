import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { FaSearch, FaUserPlus } from 'react-icons/fa';

const PatientList = () => {
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [search, setSearch] = useState('');
    const { user } = useContext(AuthContext);

    useEffect(() => {
        if (user) {
            fetchPatients();
        }
    }, [user]);

    useEffect(() => {
        const filtered = patients.filter(p =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.mrn && p.mrn.toLowerCase().includes(search.toLowerCase()))
        );
        setFilteredPatients(filtered);
    }, [search, patients]);

    const fetchPatients = async () => {
        if (!user) return;
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients', config);
            setPatients(data);
            setFilteredPatients(data);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <Layout>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Patient Registry List</h2>

            </div>

            <div className="mb-6 relative">
                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                <input
                    type="text"
                    placeholder="Search by Name or MRN..."
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
                                <td className="p-4 border-b">{patient.age}</td>
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
