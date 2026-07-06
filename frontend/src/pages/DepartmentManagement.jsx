import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaBuilding, FaPlus, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';

const DepartmentManagement = () => {
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const [departments, setDepartments] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingDepartment, setEditingDepartment] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        description: ''
    });

    useEffect(() => {
        fetchDepartments();
    }, []);

    const fetchDepartments = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/clinics`, config);
            setDepartments(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching departments');
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

        if (!formData.name) {
            toast.error('Please fill in department name');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = {
                name: formData.name,
                description: formData.description,
                department: formData.name // satisfy backend validation requiring a department field
            };

            if (editingDepartment) {
                await axios.put(
                    `${backendUrl}/api/clinics/${editingDepartment._id}`,
                    payload,
                    config
                );
                toast.success('Department updated successfully!');
            } else {
                await axios.post(`${backendUrl}/api/clinics`, payload, config);
                toast.success('Department created successfully!');
            }

            resetForm();
            fetchDepartments();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving department');
        }
    };

    const handleEdit = (dept) => {
        setEditingDepartment(dept);
        setFormData({
            name: dept.name,
            description: dept.description || ''
        });
        setShowForm(true);
    };

    const handleDeactivate = async (deptId) => {
        if (!window.confirm('Are you sure you want to deactivate this department?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/clinics/${deptId}`, config);
            toast.success('Department deactivated');
            fetchDepartments();
        } catch (error) {
            console.error(error);
            toast.error('Error deactivating department');
        }
    };

    const handleActivate = async (deptId) => {
        if (!window.confirm('Are you sure you want to activate this department?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`${backendUrl}/api/clinics/${deptId}`, { active: true }, config);
            toast.success('Department activated');
            fetchDepartments();
        } catch (error) {
            console.error(error);
            toast.error('Error activating department');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: ''
        });
        setEditingDepartment(null);
        setShowForm(false);
    };

    const activeDepartments = departments
        .filter(d => d.active)
        .filter(d =>
            d.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const inactiveDepartments = departments
        .filter(d => !d.active)
        .filter(d =>
            d.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

    if (user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'readonly_admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access department management.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaBuilding className="text-blue-600" /> Department Management
                    </h2>
                    <p className="text-gray-600 text-sm">Manage hospital departments</p>
                </div>
                {user?.role !== 'readonly_admin' && (
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2 animate-fade-in"
                    >
                        {showForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Add New Department</>}
                    </button>
                )}
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-6 border border-gray-100 animate-slide-down">
                    <h3 className="text-xl font-bold mb-4">
                        {editingDepartment ? 'Edit Department' : 'Create New Department'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">
                                Department Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                placeholder="e.g., General Medicine, Pediatrics, Pharmacy"
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">
                                Description (Optional)
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleInputChange}
                                className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                rows="3"
                                placeholder="Brief description of the department"
                            ></textarea>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <FaSave /> {editingDepartment ? 'Update Department' : 'Create Department'}
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
                    className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="Search department by name..."
                />
            </div>

            {/* Active Departments List */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4">Active Departments ({activeDepartments.length})</h3>
                {activeDepartments.length === 0 ? (
                    <p className="text-gray-500">No active departments. Create one to get started.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-3 font-semibold w-1/3">Department Name</th>
                                    <th className="text-left p-3 font-semibold w-1/2">Description</th>
                                    <th className="text-left p-3 font-semibold w-1/6">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeDepartments.map(dept => (
                                    <tr key={dept._id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">
                                            <p className="font-semibold text-gray-800">{dept.name}</p>
                                        </td>
                                        <td className="p-3 text-sm text-gray-600">
                                            {dept.description || '-'}
                                        </td>
                                        <td className="p-3">
                                            {user?.role !== 'readonly_admin' ? (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleEdit(dept)}
                                                        className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm font-semibold"
                                                    >
                                                        <FaEdit /> Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeactivate(dept._id)}
                                                        className="text-red-600 hover:text-red-800 text-sm font-semibold"
                                                    >
                                                        Deactivate
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-xs font-semibold">Read Only</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Inactive Departments */}
            {inactiveDepartments.length > 0 && (
                <div className="bg-gray-50 p-6 rounded shadow">
                    <h3 className="text-xl font-bold mb-4 text-gray-600">
                        Inactive Departments ({inactiveDepartments.length})
                    </h3>
                    <div className="space-y-2">
                        {inactiveDepartments.map(dept => (
                            <div key={dept._id} className="bg-white p-3 rounded border flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-600">{dept.name}</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded font-bold">
                                        Inactive
                                    </span>
                                    {user?.role !== 'readonly_admin' && (
                                        <button
                                            onClick={() => handleActivate(dept._id)}
                                            className="text-green-600 hover:text-green-800 text-sm font-semibold"
                                        >
                                            Activate
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default DepartmentManagement;
