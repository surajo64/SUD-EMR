import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaHospital, FaPlus, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';

const ClinicManagement = () => {
    const { user } = useContext(AuthContext);
    const [clinics, setClinics] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingClinic, setEditingClinic] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        department: ''
    });

    useEffect(() => {
        fetchClinics();
    }, []);

    const fetchClinics = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/clinics', config);
            setClinics(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching clinics');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.department) {
            toast.error('Please fill in clinic name and department');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editingClinic) {
                await axios.put(
                    `http://localhost:5000/api/clinics/${editingClinic._id}`,
                    formData,
                    config
                );
                toast.success('Clinic updated successfully!');
            } else {
                await axios.post('http://localhost:5000/api/clinics', formData, config);
                toast.success('Clinic created successfully!');
            }

            resetForm();
            fetchClinics();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving clinic');
        }
    };

    const handleEdit = (clinic) => {
        setEditingClinic(clinic);
        setFormData({
            name: clinic.name,
            description: clinic.description || '',
            department: clinic.department
        });
        setShowForm(true);
    };

    const handleDeactivate = async (clinicId) => {
        if (!window.confirm('Are you sure you want to deactivate this clinic?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/clinics/${clinicId}`, config);
            toast.success('Clinic deactivated');
            fetchClinics();
        } catch (error) {
            console.error(error);
            toast.error('Error deactivating clinic');
        }
    };

    const handleActivate = async (clinicId) => {
        if (!window.confirm('Are you sure you want to activate this clinic?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/clinics/${clinicId}`, { active: true }, config);
            toast.success('Clinic activated');
            fetchClinics();
        } catch (error) {
            console.error(error);
            toast.error('Error activating clinic');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            department: ''
        });
        setEditingClinic(null);
        setShowForm(false);
    };

    const activeClinics = clinics
        .filter(c => c.active)
        .filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.department.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const inactiveClinics = clinics
        .filter(c => !c.active)
        .filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.department.toLowerCase().includes(searchTerm.toLowerCase())
        );

    return (
        <Layout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaHospital className="text-blue-600" /> Clinic Management
                    </h2>
                    <p className="text-gray-600 text-sm">Manage hospital clinics and departments</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                >
                    {showForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Add New Clinic</>}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h3 className="text-xl font-bold mb-4">
                        {editingClinic ? 'Edit Clinic' : 'Create New Clinic'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Clinic Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., General Medicine, Pediatrics"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Department <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="department"
                                    value={formData.department}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., Outpatient, Emergency"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">
                                Description (Optional)
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded"
                                rows="3"
                                placeholder="Brief description of the clinic"
                            ></textarea>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <FaSave /> {editingClinic ? 'Update Clinic' : 'Create Clinic'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Search */}
            <div className="mb-4">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border p-2 rounded"
                    placeholder="Search clinic by name or department..."
                />
            </div>

            {/* Active Clinics List */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4">Active Clinics ({activeClinics.length})</h3>
                {activeClinics.length === 0 ? (
                    <p className="text-gray-500">No active clinics. Create one to get started.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-3 font-semibold">Clinic Name</th>
                                    <th className="text-left p-3 font-semibold">Department</th>
                                    <th className="text-left p-3 font-semibold">Description</th>
                                    <th className="text-left p-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeClinics.map(clinic => (
                                    <tr key={clinic._id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">
                                            <p className="font-semibold">{clinic.name}</p>
                                        </td>
                                        <td className="p-3">
                                            <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                {clinic.department}
                                            </span>
                                        </td>
                                        <td className="p-3 text-sm text-gray-600">
                                            {clinic.description || '-'}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(clinic)}
                                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                                                >
                                                    <FaEdit /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeactivate(clinic._id)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Deactivate
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Inactive Clinics */}
            {inactiveClinics.length > 0 && (
                <div className="bg-gray-50 p-6 rounded shadow">
                    <h3 className="text-xl font-bold mb-4 text-gray-600">
                        Inactive Clinics ({inactiveClinics.length})
                    </h3>
                    <div className="space-y-2">
                        {inactiveClinics.map(clinic => (
                            <div key={clinic._id} className="bg-white p-3 rounded border flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-600">{clinic.name}</p>
                                    <p className="text-sm text-gray-500">{clinic.department}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded">
                                        Inactive
                                    </span>
                                    <button
                                        onClick={() => handleActivate(clinic._id)}
                                        className="text-green-600 hover:text-green-800 text-sm font-semibold"
                                    >
                                        Activate
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ClinicManagement;
