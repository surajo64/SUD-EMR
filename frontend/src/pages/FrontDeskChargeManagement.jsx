import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaDollarSign, FaPlus, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';

const FrontDeskChargeManagement = () => {
    const { user } = useContext(AuthContext);
    const [charges, setCharges] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingCharge, setEditingCharge] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        type: 'consultation',
        basePrice: '',
        department: '',
        description: '',
        code: ''
    });

    useEffect(() => {
        fetchCharges();
    }, []);

    const fetchCharges = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/charges', config);
            // Filter to only show consultation charges
            const consultationCharges = data.filter(charge => charge.type === 'consultation');
            setCharges(consultationCharges);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching charges');
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

        if (!formData.name || !formData.type || formData.basePrice === '') {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = {
                name: formData.name,
                type: formData.type,
                basePrice: parseFloat(formData.basePrice),
                department: formData.department || 'General',
                description: formData.description,
                code: formData.code
            };

            if (editingCharge) {
                await axios.put(
                    `http://localhost:5000/api/charges/${editingCharge._id}`,
                    payload,
                    config
                );
                toast.success('Charge updated successfully!');
            } else {
                await axios.post('http://localhost:5000/api/charges', payload, config);
                toast.success('Charge created successfully!');
            }

            resetForm();
            fetchCharges();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving charge');
        }
    };

    const handleEdit = (charge) => {
        setEditingCharge(charge);
        setFormData({
            name: charge.name,
            type: charge.type,
            basePrice: charge.basePrice.toString(),
            department: charge.department || '',
            description: charge.description || '',
            code: charge.code || ''
        });
        setShowForm(true);
    };

    const handleDeactivate = async (chargeId) => {
        if (!window.confirm('Are you sure you want to deactivate this charge?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/charges/${chargeId}`, config);
            toast.success('Charge deactivated');
            fetchCharges();
        } catch (error) {
            console.error(error);
            toast.error('Error deactivating charge');
        }
    };

    const handleActivate = async (chargeId) => {
        if (!window.confirm('Are you sure you want to activate this charge?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/charges/${chargeId}`, { active: true }, config);
            toast.success('Charge activated');
            fetchCharges();
        } catch (error) {
            console.error(error);
            toast.error('Error activating charge');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            type: 'consultation',
            basePrice: '',
            department: '',
            description: '',
            code: ''
        });
        setEditingCharge(null);
        setShowForm(false);
    };

    const chargeTypeLabels = {
        consultation: 'Consultation',
        card: 'Hospital Card',
        lab: 'Lab Investigation',
        radiology: 'Radiology Investigation',
        drugs: 'Drug Purchase',
        nursing: 'Nursing Service',
        other: 'Other'
    };

    const activeCharges = charges
        .filter(c => c.active)
        .filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.type.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const inactiveCharges = charges
        .filter(c => !c.active)
        .filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.type.toLowerCase().includes(searchTerm.toLowerCase())
        );

    // Group active charges by type
    const chargesByType = activeCharges.reduce((acc, charge) => {
        if (!acc[charge.type]) {
            acc[charge.type] = [];
        }
        acc[charge.type].push(charge);
        return acc;
    }, {});

    return (
        <Layout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaDollarSign className="text-green-600" /> Front Desk Charge Management
                    </h2>
                    <p className="text-gray-600 text-sm">Manage charges available for encounter creation at the front desk</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                >
                    {showForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Add New Charge</>}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h3 className="text-xl font-bold mb-4">
                        {editingCharge ? 'Edit Charge' : 'Create New Charge'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Charge Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., Consultation Fee, Patient Card"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Charge Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    required
                                    disabled
                                >
                                    <option value="consultation">Consultation</option>
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    This page manages consultation charges only
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Price ($) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="basePrice"
                                    value={formData.basePrice}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="0.00 for free charges"
                                    step="0.01"
                                    min="0"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Set to 0.00 for free/external services
                                </p>
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Department
                                </label>
                                <input
                                    type="text"
                                    name="department"
                                    value={formData.department}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., General, Emergency"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Charge Code (Optional)
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., CHG-CONS-001"
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
                                    placeholder="Brief description"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <FaSave /> {editingCharge ? 'Update Charge' : 'Create Charge'}
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
                    placeholder="Search charges by name, code, or type..."
                />
            </div>

            {/* Active Charges List - Grouped by Type */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4">Active Charges ({activeCharges.length})</h3>
                {activeCharges.length === 0 ? (
                    <p className="text-gray-500">No active charges. Create one to get started.</p>
                ) : (
                    <div className="space-y-6">
                        {Object.keys(chargesByType).sort().map(type => (
                            <div key={type}>
                                <h4 className="text-lg font-semibold text-blue-700 mb-3 flex items-center gap-2">
                                    <FaDollarSign /> {chargeTypeLabels[type] || type}
                                </h4>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="text-left p-3 font-semibold">Charge Name</th>
                                                <th className="text-left p-3 font-semibold">Code</th>
                                                <th className="text-left p-3 font-semibold">Price</th>
                                                <th className="text-left p-3 font-semibold">Department</th>
                                                <th className="text-left p-3 font-semibold">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chargesByType[type].map(charge => (
                                                <tr key={charge._id} className="border-b hover:bg-gray-50">
                                                    <td className="p-3">
                                                        <p className="font-semibold">{charge.name}</p>
                                                        {charge.description && (
                                                            <p className="text-xs text-gray-600">{charge.description}</p>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">
                                                        {charge.code || '-'}
                                                    </td>
                                                    <td className="p-3">
                                                        <span className={`font-semibold ${charge.basePrice === 0 ? 'text-green-600' : 'text-gray-800'}`}>
                                                            ${charge.basePrice.toFixed(2)}
                                                        </span>
                                                        {charge.basePrice === 0 && (
                                                            <span className="ml-2 text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                                Free
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">
                                                        {charge.department || '-'}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => handleEdit(charge)}
                                                                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                                                            >
                                                                <FaEdit /> Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeactivate(charge._id)}
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
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Inactive Charges */}
            {inactiveCharges.length > 0 && (
                <div className="bg-gray-50 p-6 rounded shadow">
                    <h3 className="text-xl font-bold mb-4 text-gray-600">
                        Inactive Charges ({inactiveCharges.length})
                    </h3>
                    <div className="space-y-2">
                        {inactiveCharges.map(charge => (
                            <div key={charge._id} className="bg-white p-3 rounded border flex justify-between items-center">
                                <div>
                                    <p className="font-semibold text-gray-600">{charge.name}</p>
                                    <p className="text-sm text-gray-500">
                                        {chargeTypeLabels[charge.type]} - ${charge.basePrice.toFixed(2)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded">
                                        Inactive
                                    </span>
                                    <button
                                        onClick={() => handleActivate(charge._id)}
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

export default FrontDeskChargeManagement;
