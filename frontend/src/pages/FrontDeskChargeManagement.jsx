import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaDollarSign, FaPlus, FaEdit, FaSave, FaTimes, FaDownload, FaUpload } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

const FrontDeskChargeManagement = () => {
    const { backendUrl } = useContext(AppContext);
    const { user } = useContext(AuthContext);
    const [charges, setCharges] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingCharge, setEditingCharge] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [formData, setFormData] = useState({
        name: '',
        type: 'other',
        basePrice: '',
        standardFee: '',
        retainershipFee: '',
        nhiaFee: '',
        kschmaFee: '',
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
            const { data } = await axios.get(`${backendUrl}/api/charges`, config);
            setCharges(data);
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

        if (!formData.name || !formData.type || formData.standardFee === '') {
            toast.error('Please fill in all required fields');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = {
                name: formData.name,
                type: formData.type,
                basePrice: parseFloat(formData.standardFee) || 0, // Use standard fee as base price
                standardFee: parseFloat(formData.standardFee) || 0,
                retainershipFee: parseFloat(formData.retainershipFee) || 0,
                nhiaFee: parseFloat(formData.nhiaFee) || 0,
                kschmaFee: parseFloat(formData.kschmaFee) || 0,
                department: formData.department || 'General',
                description: formData.description,
                code: formData.code
            };

            if (editingCharge) {
                await axios.put(
                    `${backendUrl}/api/charges/${editingCharge._id}`,
                    payload,
                    config
                );
                toast.success('Charge updated successfully!');
            } else {
                await axios.post(`${backendUrl}/api/charges`, payload, config);
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
            standardFee: (charge.standardFee || charge.basePrice || 0).toString(),
            retainershipFee: (charge.retainershipFee || 0).toString(),
            nhiaFee: (charge.nhiaFee || 0).toString(),
            kschmaFee: (charge.kschmaFee || 0).toString(),
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
            await axios.delete(`${backendUrl}/api/charges/${chargeId}`, config);
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
            await axios.put(`${backendUrl}/api/charges/${chargeId}`, { active: true }, config);
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
            type: 'other',
            basePrice: '',
            standardFee: '',
            retainershipFee: '',
            nhiaFee: '',
            kschmaFee: '',
            department: '',
            description: '',
            code: ''
        });
        setEditingCharge(null);
        setShowForm(false);
    };

    const handleDownloadTemplate = () => {
        const templateData = [{
            'Service Name': 'Example Consultation',
            'Code': 'CONS001',
            'Description': 'General consultation fee',
            'Standard Fee': 5000,
            'Retainership Fee': 4000,
            'NHIA Fee': 2000,
            'KSCHMA Fee': 1500
        }];
        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'FrontDeskCharges_Import_Template.xlsx');
        toast.success('Template downloaded');
    };

    const handleExportToExcel = () => {
        const exportData = charges.map(c => ({
            'Service Name': c.name,
            'Code': c.code || '',
            'Description': c.description || '',
            'Standard Fee': c.standardFee || 0,
            'Retainership Fee': c.retainershipFee || 0,
            'NHIA Fee': c.nhiaFee || 0,
            'KSCHMA Fee': c.kschmaFee || 0,
            'Status': c.active ? 'Active' : 'Inactive'
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Charges');
        XLSX.writeFile(wb, `FrontDeskCharges_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('Charges exported successfully');
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const formData = new FormData();
            formData.append('file', file);
            const config = { headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'multipart/form-data' } };
            const { data } = await axios.post(`${backendUrl}/api/charges/import-excel?type=consultation&department=Front+Desk`, formData, config);
            toast.success(data.message);
            if (data.results.failed.length > 0) {
                toast.warning(`${data.results.failed.length} row(s) failed to import.`);
            }
            fetchCharges();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error importing charges');
        } finally {
            e.target.value = '';
        }
    };

    const chargeTypeLabels = {
        consultation: 'Consultation',
        card: 'Hospital Card',
        lab: 'Lab Investigation',
        family: 'Family File Registration',
        retainership: 'Retainership Registration',
        radiology: 'Radiology Investigation',
        drugs: 'Drug Purchase',
        nursing: 'Nursing Service',
        labour: 'Labour Fee',
        theatre: 'Theatre Fee',
        other: 'Other'
    };

    const activeCharges = charges
        .filter(c => c.active)
        .filter(c => filterType === 'all' || c.type === filterType)
        .filter(c =>
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (c.code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.type.toLowerCase().includes(searchTerm.toLowerCase())
        );

    const inactiveCharges = charges
        .filter(c => !c.active)
        .filter(c => filterType === 'all' || c.type === filterType)
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
                {(user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'readonly_admin' || user?.role === 'receptionist') && (
                    <div className="flex gap-2 flex-wrap">
                        {user?.role !== 'readonly_admin' && user?.role !== 'receptionist' && (
                            <>
                                <button onClick={handleDownloadTemplate} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2 text-sm">
                                    <FaDownload /> Template
                                </button>
                                <label className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 flex items-center gap-2 cursor-pointer text-sm">
                                    <FaUpload /> Import
                                    <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} className="hidden" />
                                </label>
                            </>
                        )}
                        <button onClick={handleExportToExcel} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 text-sm">
                            <FaDownload /> Export
                        </button>
                        {user?.role !== 'readonly_admin' && user?.role !== 'receptionist' && (
                            <button onClick={() => setShowForm(!showForm)} className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2">
                                {showForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Add New Charge</>}
                            </button>
                        )}
                        {(user?.role === 'readonly_admin' || user?.role === 'receptionist') && (
                            <div className="flex gap-2">
                                <span className="text-gray-500 bg-gray-100 px-3 py-1 rounded text-sm font-medium border border-gray-200">
                                    Read Only Access
                                </span>
                            </div>
                        )}
                    </div>
                )}
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
                                >
                                    <option value="consultation">Consultation</option>
                                    <option value="lab">Lab Investigation</option>
                                    <option value="radiology">Radiology Investigation</option>
                                    <option value="drugs">Drug Purchase</option>
                                    <option value="nursing">Nursing Service</option>
                                    <option value="family">Family File Registration</option>
                                    <option value="retainership">Retainership Registration</option>
                                    <option value="labour">Labour Fee</option>
                                    <option value="theatre">Theatre Fee</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Standard Fee <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="standardFee"
                                    value={formData.standardFee}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Retainership Fee
                                </label>
                                <input
                                    type="number"
                                    name="retainershipFee"
                                    value={formData.retainershipFee}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    NHIA Fee
                                </label>
                                <input
                                    type="number"
                                    name="nhiaFee"
                                    value={formData.nhiaFee}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    KSCHMA Fee
                                </label>
                                <input
                                    type="number"
                                    name="kschmaFee"
                                    value={formData.kschmaFee}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="0.00"
                                    step="0.01"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
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

            {/* Search & Filter */}
            <div className="mb-4 flex gap-3">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1 border p-2 rounded"
                    placeholder="Search charges by name, code, or type..."
                />
                <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="border p-2 rounded text-sm"
                >
                    <option value="all">All Types</option>
                    <option value="consultation">Consultation</option>
                    <option value="lab">Lab</option>
                    <option value="radiology">Radiology</option>
                    <option value="drugs">Drugs</option>
                    <option value="nursing">Nursing</option>
                    <option value="family">Family File</option>
                    <option value="retainership">Retainership</option>
                    <option value="labour">Labour Fee</option>
                    <option value="theatre">Theatre Fee</option>
                    <option value="other">Other</option>
                </select>
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
                                                        <div className="text-sm">
                                                            <p><span className="font-semibold">Std:</span> ₦{(charge.standardFee || charge.basePrice || 0).toLocaleString()}</p>
                                                            <p className="text-xs text-gray-500">
                                                                NHIA: ₦{(charge.nhiaFee || 0).toLocaleString()} |
                                                                KSCHMA: ₦{(charge.kschmaFee || 0).toLocaleString()}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="p-3 text-sm text-gray-600">
                                                        {charge.department || '-'}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="flex gap-2">
                                                            {(user?.role === 'admin' || user?.role === 'super_admin') && (
                                                                <button onClick={() => handleEdit(charge)} className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm">
                                                                    <FaEdit /> Edit
                                                                </button>
                                                            )}
                                                            {user?.role !== 'readonly_admin' && (
                                                                <button onClick={() => handleDeactivate(charge._id)} className="text-red-600 hover:text-red-800 text-sm">
                                                                    Deactivate
                                                                </button>
                                                            )}
                                                            {user?.role === 'readonly_admin' && (
                                                                <span className="text-gray-400 text-xs font-semibold">Read Only</span>
                                                            )}
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
                                        {chargeTypeLabels[charge.type]} - ₦{(charge.basePrice || 0).toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded">
                                        Inactive
                                    </span>
                                    {user?.role !== 'readonly_admin' && (
                                        <button
                                            onClick={() => handleActivate(charge._id)}
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

export default FrontDeskChargeManagement;
