import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaUserMd, FaPlus, FaEdit, FaSave, FaTimes, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

const NursingServiceManagement = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [services, setServices] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        basePrice: '',
        standardFee: '',
        retainershipFee: '',
        nhiaFee: '',
        kschmaFee: '',
        description: '',
        code: ''
    });

    useEffect(() => {
        fetchServices();
    }, []);

    const fetchServices = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/charges?type=nursing', config);
            setServices(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching nursing services');
        } finally {
            setLoading(false);
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

        if (!formData.name || !formData.standardFee) {
            toast.error('Please fill in service name and price');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = {
                name: formData.name,
                type: 'nursing',
                type: 'nursing',
                basePrice: parseFloat(formData.standardFee) || 0, // Set basePrice to standardFee for schema compatibility
                standardFee: parseFloat(formData.standardFee) || 0,
                retainershipFee: parseFloat(formData.retainershipFee) || 0,
                nhiaFee: parseFloat(formData.nhiaFee) || 0,
                kschmaFee: parseFloat(formData.kschmaFee) || 0,
                department: 'Nursing',
                description: formData.description,
                code: formData.code
            };

            if (editingService) {
                await axios.put(
                    `http://localhost:5000/api/charges/${editingService._id}`,
                    payload,
                    config
                );
                toast.success('Service updated successfully!');
            } else {
                await axios.post('http://localhost:5000/api/charges', payload, config);
                toast.success('Service created successfully!');
            }

            resetForm();
            fetchServices();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving service');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (service) => {
        setEditingService(service);
        setFormData({
            name: service.name,
            basePrice: service.basePrice.toString(),
            standardFee: (service.standardFee || 0).toString(),
            retainershipFee: (service.retainershipFee || 0).toString(),
            nhiaFee: (service.nhiaFee || 0).toString(),
            kschmaFee: (service.kschmaFee || 0).toString(),
            description: service.description || '',
            code: service.code || ''
        });
        setShowForm(true);
    };

    const handleDeactivate = async (serviceId) => {
        if (!window.confirm('Are you sure you want to deactivate this service?')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/charges/${serviceId}`, config);
            toast.success('Service deactivated');
            fetchServices();
        } catch (error) {
            console.error(error);
            toast.error('Error deactivating service');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            basePrice: '',
            standardFee: '',
            retainershipFee: '',
            nhiaFee: '',
            kschmaFee: '',
            description: '',
            code: ''
        });
        setEditingService(null);
        setShowForm(false);
    };

    const activeServices = services.filter(s => s.active);
    const inactiveServices = services.filter(s => !s.active);

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaUserMd className="text-green-600" /> Nursing Service Management
                    </h2>
                    <p className="text-gray-600 text-sm">Manage nursing service catalog and prices</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                >
                    {showForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Add New Service</>}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h3 className="text-xl font-bold mb-4">
                        {editingService ? 'Edit Service' : 'Create New Service'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Service Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., Wound Dressing"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">Pricing Configuration</label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded border">
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-blue-600">Standard Fee <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        name="standardFee"
                                        value={formData.standardFee}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded text-sm border-blue-200 focus:border-blue-500"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-purple-600">Retainership</label>
                                    <input
                                        type="number"
                                        name="retainershipFee"
                                        value={formData.retainershipFee}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded text-sm border-purple-200 focus:border-purple-500"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-green-600">NHIA Fee</label>
                                    <input
                                        type="number"
                                        name="nhiaFee"
                                        value={formData.nhiaFee}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded text-sm border-green-200 focus:border-green-500"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-orange-600">KSCHMA Fee</label>
                                    <input
                                        type="number"
                                        name="kschmaFee"
                                        value={formData.kschmaFee}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded text-sm border-orange-200 focus:border-orange-500"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Service Code (Optional)
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., NUR-WD-001"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Description (Optional)
                                </label>
                                <input
                                    type="text"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="Brief description of the service"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <FaSave /> {editingService ? 'Update Service' : 'Create Service'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                        </div>
                    </form >
                </div >
            )}

            {/* Active Services List */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4">Active Services ({activeServices.length})</h3>
                {activeServices.length === 0 ? (
                    <p className="text-gray-500">No active services. Create one to get started.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-3 font-semibold">Service Name</th>
                                    <th className="text-left p-3 font-semibold">Code</th>
                                    <th className="text-left p-3 font-semibold">Price</th>
                                    <th className="text-left p-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeServices.map(service => (
                                    <tr key={service._id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">
                                            <p className="font-semibold">{service.name}</p>
                                            {service.description && (
                                                <p className="text-xs text-gray-600">{service.description}</p>
                                            )}
                                        </td>
                                        <td className="p-3 text-sm text-gray-600">
                                            {service.code || '-'}
                                        </td>
                                        <td className="p-3">
                                            <div className="text-sm">
                                                <div className="flex justify-between gap-2 border-b border-gray-100 pb-1 mb-1">
                                                    <span className="text-gray-500">Standard:</span>
                                                    <span className="font-semibold text-gray-800">${(service.standardFee || 0).toFixed(2)}</span>
                                                </div>
                                                {(service.standardFee > 0 || service.retainershipFee > 0 || service.nhiaFee > 0 || service.kschmaFee > 0) && (
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                                        {service.standardFee > 0 && (
                                                            <div className="flex justify-between gap-1">
                                                                <span className="text-blue-600">Std:</span>
                                                                <span>${service.standardFee.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {service.retainershipFee > 0 && (
                                                            <div className="flex justify-between gap-1">
                                                                <span className="text-purple-600">Ret:</span>
                                                                <span>${service.retainershipFee.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {service.nhiaFee > 0 && (
                                                            <div className="flex justify-between gap-1">
                                                                <span className="text-green-600">NHIA:</span>
                                                                <span>${service.nhiaFee.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {service.kschmaFee > 0 && (
                                                            <div className="flex justify-between gap-1">
                                                                <span className="text-orange-600">KSC:</span>
                                                                <span>${service.kschmaFee.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(service)}
                                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                                                >
                                                    <FaEdit /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeactivate(service._id)}
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

            {/* Inactive Services */}
            {
                inactiveServices.length > 0 && (
                    <div className="bg-gray-50 p-6 rounded shadow">
                        <h3 className="text-xl font-bold mb-4 text-gray-600">
                            Inactive Services ({inactiveServices.length})
                        </h3>
                        <div className="space-y-2">
                            {inactiveServices.map(service => (
                                <div key={service._id} className="bg-white p-3 rounded border flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-600">{service.name}</p>
                                        <p className="text-sm text-gray-500">${service.basePrice.toFixed(2)}</p>
                                    </div>
                                    <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded">
                                        Inactive
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
        </Layout >
    );
};

export default NursingServiceManagement;
