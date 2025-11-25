import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaUserInjured, FaSearch, FaEdit, FaTrash, FaEye, FaCalendar, FaDownload, FaHospital } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import LoadingOverlay from '../components/loadingOverlay';

const PatientManagement = () => {
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState([]);
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [encounters, setEncounters] = useState([]);
    const [showEncountersModal, setShowEncountersModal] = useState(false);
    const [showEditPatientModal, setShowEditPatientModal] = useState(false);
    const [editPatient, setEditPatient] = useState(null);
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        if (user && (user.role === 'admin' || user.role === 'receptionist')) {
            fetchPatients();
        }
    }, [user]);

    useEffect(() => {
        filterPatients();
    }, [searchTerm, startDate, endDate, patients]);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients', config);
            setPatients(data);
            setFilteredPatients(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patients');
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

        setFilteredPatients(filtered);
    };

    const fetchPatientEncounters = async (patientId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`http://localhost:5000/api/visits/patient/${patientId}`, config);
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
            await axios.delete(`http://localhost:5000/api/visits/${encounterId}`, config);
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
            await axios.put(`http://localhost:5000/api/visits/${encounterId}`,
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
            await axios.put(`http://localhost:5000/api/patients/${editPatient._id}`, editPatient, config);
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
            await axios.delete(`http://localhost:5000/api/patients/${patientId}`, config);
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

    if (user?.role !== 'admin' && user?.role !== 'receptionist') {
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
                    <div className="mt-4 flex gap-2">
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
                            {patients.filter(p => p.gender?.toLowerCase() === 'male').length}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <p className="text-gray-600 text-sm font-semibold mb-2">Female Patients</p>
                        <p className="text-3xl font-bold text-pink-600">
                            {patients.filter(p => p.gender?.toLowerCase() === 'female').length}
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
                                <th className="p-4 text-left">Registered</th>
                                <th className="p-4 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPatients.map((patient) => (
                                <tr key={patient._id} className="border-b hover:bg-gray-50">
                                    <td className="p-4 font-semibold text-blue-600">{patient.mrn || 'N/A'}</td>
                                    <td className="p-4 font-semibold">{patient.name}</td>
                                    <td className="p-4">
                                        {patient.age || 'N/A'} / {patient.gender || 'N/A'}
                                    </td>
                                    <td className="p-4 text-gray-600">{patient.contact || 'N/A'}</td>
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
                                            <button
                                                onClick={() => {
                                                    setEditPatient(patient);
                                                    setShowEditPatientModal(true);
                                                }}
                                                className="text-green-600 hover:text-green-800"
                                                title="Edit Patient"
                                            >
                                                <FaEdit />
                                            </button>
                                            {user.role === 'admin' && (
                                                <button
                                                    onClick={() => handleDeletePatient(patient._id)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Delete Patient"
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
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
                                                    value={encounter.encounterStatus}
                                                    onChange={(e) => handleUpdateEncounterStatus(encounter._id, e.target.value)}
                                                    className="border p-1 rounded text-sm"
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
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Name</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={editPatient.name}
                                        onChange={(e) => setEditPatient({ ...editPatient, name: e.target.value })}
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
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Age</label>
                                    <input
                                        type="number"
                                        className="w-full border p-2 rounded"
                                        value={editPatient.age || ''}
                                        onChange={(e) => setEditPatient({ ...editPatient, age: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Gender</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={editPatient.gender || ''}
                                        onChange={(e) => setEditPatient({ ...editPatient, gender: e.target.value })}
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
                                        className="w-full border p-2 rounded"
                                        value={editPatient.contact || ''}
                                        onChange={(e) => setEditPatient({ ...editPatient, contact: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Address</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    rows="2"
                                    value={editPatient.address || ''}
                                    onChange={(e) => setEditPatient({ ...editPatient, address: e.target.value })}
                                />
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
        </Layout>
    );
};

export default PatientManagement;
