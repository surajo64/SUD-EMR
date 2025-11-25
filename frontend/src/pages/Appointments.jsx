import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import AppointmentModal from '../components/AppointmentModal';
import LoadingOverlay from '../components/loadingOverlay';
import { FaCalendarPlus, FaFilter, FaCheck, FaTimes, FaUserMd, FaUser } from 'react-icons/fa';
import { toast } from 'react-toastify';

const Appointments = () => {
    const { user } = useContext(AuthContext);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [doctors, setDoctors] = useState([]);

    // Filters
    const [filterDate, setFilterDate] = useState('');
    const [filterDoctor, setFilterDoctor] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    useEffect(() => {
        if (user && user.token) {
            fetchAppointments();
            fetchDoctors();
        }
    }, [user?.token, filterDate, filterDoctor, filterStatus]);

    const fetchDoctors = async () => {
        if (!user) return;
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/users/doctors', config);
            setDoctors(data);
        } catch (error) {
            console.error('Error fetching doctors', error);
        }
    };

    const fetchAppointments = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            let query = `?`;
            if (filterDate) {
                query += `date=${filterDate}`;
            } else {
                query += `upcoming=true`;
            }

            if (user.role === 'doctor') {
                query += `&doctor=${user._id}`;
            } else if (filterDoctor) {
                query += `&doctor=${filterDoctor}`;
            }
            if (filterStatus) query += `&status=${filterStatus}`;

            const { data } = await axios.get(`http://localhost:5000/api/appointments${query}`, config);
            setAppointments(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching appointments');
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (id, status) => {
        if (!window.confirm(`Are you sure you want to mark this appointment as ${status}?`)) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/appointments/${id}/status`, { status }, config);
            toast.success(`Appointment marked as ${status}`);
            fetchAppointments();
        } catch (error) {
            console.error(error);
            toast.error('Error updating status');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Scheduled': return 'bg-blue-100 text-blue-800';
            case 'Completed': return 'bg-green-100 text-green-800';
            case 'Cancelled': return 'bg-red-100 text-red-800';
            case 'No-show': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}

            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Appointments</h1>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                >
                    <FaCalendarPlus /> New Appointment
                </button>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow mb-6 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                        type="date"
                        className="border p-2 rounded"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                    />
                </div>
                {user.role !== 'doctor' && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
                        <select
                            className="border p-2 rounded w-48"
                            value={filterDoctor}
                            onChange={(e) => setFilterDoctor(e.target.value)}
                        >
                            <option value="">All Doctors</option>
                            {doctors.map(doc => (
                                <option key={doc._id} value={doc._id}>{doc.name}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                        className="border p-2 rounded w-48"
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                    >
                        <option value="">All Statuses</option>
                        <option value="Scheduled">Scheduled</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="No-show">No Show</option>
                    </select>
                </div>
                <button
                    onClick={() => {
                        setFilterDate('');
                        setFilterDoctor('');
                        setFilterStatus('');
                    }}
                    className="text-gray-500 hover:text-gray-700 pb-2"
                >
                    Clear Filters
                </button>
            </div>

            {/* Appointments List */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type / Reason</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {appointments.length > 0 ? (
                            appointments.map((app) => (
                                <tr key={app._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {new Date(app.date).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {app.time}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                                <FaUser size={14} />
                                            </div>
                                            <div className="ml-4">
                                                <div className="text-sm font-medium text-gray-900">{app.patient?.name}</div>
                                                <div className="text-sm text-gray-500">{app.patient?.mrn}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <FaUserMd className="text-gray-400 mr-2" />
                                            <span className="text-sm text-gray-900">{app.doctor?.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm text-gray-900 font-medium capitalize">{app.type}</div>
                                        <div className="text-sm text-gray-500 truncate max-w-xs">{app.reason}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(app.status)} capitalize`}>
                                            {app.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        {app.status === 'Scheduled' && (
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleStatusUpdate(app._id, 'Completed')}
                                                    className="text-green-600 hover:text-green-900"
                                                    title="Mark Completed"
                                                >
                                                    <FaCheck />
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(app._id, 'Cancelled')}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Cancel Appointment"
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                                    No appointments found for this date.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <AppointmentModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={() => {
                    setShowModal(false);
                    fetchAppointments();
                }}
                user={user}
            />
        </Layout>
    );
};

export default Appointments;
