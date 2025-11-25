import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { FaTimes, FaCalendarAlt, FaClock, FaUserMd, FaUser } from 'react-icons/fa';

const AppointmentModal = ({ isOpen, onClose, onSuccess, patientId, doctorId, user }) => {
    const [formData, setFormData] = useState({
        patientId: patientId || '',
        doctorId: doctorId || '',
        date: '',
        time: '',
        type: 'Checkup',
        reason: ''
    });

    const [patients, setPatients] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchingPatient, setSearchingPatient] = useState(false);
    const [patientSearchTerm, setPatientSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Reset form when opened, but keep passed props
            setFormData(prev => ({
                ...prev,
                patientId: patientId || prev.patientId,
                doctorId: doctorId || prev.doctorId
            }));

            // Fetch doctors if not provided or if user can select doctor
            if (!doctorId || user.role === 'admin' || user.role === 'receptionist') {
                fetchDoctors();
            }

            // If user is a doctor, ensure they are selected
            if (user.role === 'doctor') {
                setFormData(prev => ({ ...prev, doctorId: user._id }));
            }
        }
    }, [isOpen, patientId, doctorId, user]);

    // Search patients when typing
    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            if (patientSearchTerm && !patientId) {
                searchPatients();
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [patientSearchTerm]);

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

    const searchPatients = async () => {
        if (!user) return;
        try {
            setSearchingPatient(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients', config);
            // Client-side filter for now (ideally backend search)
            const filtered = data.filter(p =>
                p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
                p.mrn.toLowerCase().includes(patientSearchTerm.toLowerCase())
            );
            setPatients(filtered);
        } catch (error) {
            console.error('Error searching patients', error);
        } finally {
            setSearchingPatient(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post('http://localhost:5000/api/appointments', formData, config);
            toast.success('Appointment scheduled successfully!');
            onSuccess();
            onClose();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error scheduling appointment');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Schedule Appointment</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <FaTimes size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Patient Selection (if not provided) */}
                    {!patientId && (
                        <div>
                            <label className="block text-gray-700 mb-2 font-semibold">Patient</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded pl-10"
                                    placeholder="Search by Name or MRN..."
                                    value={patientSearchTerm}
                                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                                />
                                <FaUser className="absolute left-3 top-3 text-gray-400" />
                            </div>
                            {patients.length > 0 && patientSearchTerm && (
                                <ul className="mt-1 border rounded max-h-40 overflow-y-auto bg-white absolute w-full z-10 shadow-lg">
                                    {patients.map(p => (
                                        <li
                                            key={p._id}
                                            className={`p-2 hover:bg-gray-100 cursor-pointer ${formData.patientId === p._id ? 'bg-blue-50' : ''}`}
                                            onClick={() => {
                                                setFormData({ ...formData, patientId: p._id });
                                                setPatientSearchTerm(`${p.name} (${p.mrn})`);
                                                setPatients([]);
                                            }}
                                        >
                                            <div className="font-semibold">{p.name}</div>
                                            <div className="text-xs text-gray-500">{p.mrn} - {p.contact}</div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}

                    {/* Doctor Selection (if admin/receptionist) */}
                    {user.role !== 'doctor' && (!doctorId || user.role === 'admin' || user.role === 'receptionist') && (
                        <div>
                            <label className="block text-gray-700 mb-2 font-semibold">Doctor</label>
                            <div className="relative">
                                <select
                                    className="w-full border p-2 rounded pl-10"
                                    value={formData.doctorId}
                                    onChange={(e) => setFormData({ ...formData, doctorId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Select Doctor --</option>
                                    {doctors.map(doc => (
                                        <option key={doc._id} value={doc._id}>{doc.name}</option>
                                    ))}
                                </select>
                                <FaUserMd className="absolute left-3 top-3 text-gray-400" />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700 mb-2 font-semibold">Date</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    className="w-full border p-2 rounded pl-10"
                                    value={formData.date}
                                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    required
                                    min={new Date().toISOString().split('T')[0]}
                                />
                                <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-gray-700 mb-2 font-semibold">Time</label>
                            <div className="relative">
                                <input
                                    type="time"
                                    className="w-full border p-2 rounded pl-10"
                                    value={formData.time}
                                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                    required
                                />
                                <FaClock className="absolute left-3 top-3 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-700 mb-2 font-semibold">Type</label>
                        <select
                            className="w-full border p-2 rounded"
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                        >
                            <option value="Checkup">Checkup</option>
                            <option value="Follow-up">Follow-up</option>
                            <option value="Emergency">Emergency</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-700 mb-2 font-semibold">Reason</label>
                        <textarea
                            className="w-full border p-2 rounded"
                            rows="3"
                            value={formData.reason}
                            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                            placeholder="Reason for appointment..."
                        ></textarea>
                    </div>

                    <div className="flex gap-2 pt-4">
                        <button
                            type="submit"
                            disabled={loading || !formData.patientId || (!formData.doctorId && user.role !== 'doctor')}
                            className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:bg-gray-400 font-bold"
                        >
                            {loading ? 'Scheduling...' : 'Schedule Appointment'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 font-semibold"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AppointmentModal;
