import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaHospital, FaPlus, FaEdit, FaTrash, FaToggleOn, FaToggleOff, FaDownload, FaUpload, FaSearch } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';
import * as XLSX from 'xlsx';

const HMOManagement = () => {
    const [loading, setLoading] = useState(false);
    const [hmos, setHmos] = useState([]);
    const [filteredHMOs, setFilteredHMOs] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [currentHMO, setCurrentHMO] = useState({
        name: '',
        code: '',
        category: 'Private',
        description: '',
        contactPerson: '',
        contactPhone: '',
        contactEmail: ''
    });
    const { user } = useContext(AuthContext);

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchHMOs();
        }
    }, [user]);

    useEffect(() => {
        // Filter HMOs based on search term
        if (searchTerm) {
            const filtered = hmos.filter(hmo =>
                hmo.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (hmo.code && hmo.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (hmo.contactPerson && hmo.contactPerson.toLowerCase().includes(searchTerm.toLowerCase()))
            );
            setFilteredHMOs(filtered);
        } else {
            setFilteredHMOs(hmos);
        }
    }, [searchTerm, hmos]);

    const fetchHMOs = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/hmos', config);
            setHmos(data);
            setFilteredHMOs(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching HMOs');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (hmo = null) => {
        if (hmo) {
            setEditMode(true);
            setCurrentHMO(hmo);
        } else {
            setEditMode(false);
            setCurrentHMO({
                name: '',
                code: '',
                category: 'Private',
                description: '',
                contactPerson: '',
                contactPhone: '',
                contactEmail: ''
            });
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditMode(false);
        setCurrentHMO({
            name: '',
            code: '',
            category: 'Private',
            description: '',
            contactPerson: '',
            contactPhone: '',
            contactEmail: ''
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editMode) {
                await axios.put(`http://localhost:5000/api/hmos/${currentHMO._id}`, currentHMO, config);
                toast.success('HMO updated successfully');
            } else {
                await axios.post('http://localhost:5000/api/hmos', currentHMO, config);
                toast.success('HMO created successfully');
            }

            handleCloseModal();
            fetchHMOs();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving HMO');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (hmo) => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.patch(`http://localhost:5000/api/hmos/${hmo._id}/toggle-status`, {}, config);
            toast.success(`HMO ${hmo.active ? 'deactivated' : 'activated'} successfully`);
            fetchHMOs();
        } catch (error) {
            console.error(error);
            toast.error('Error toggling HMO status');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this HMO?')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/hmos/${id}`, config);
            toast.success('HMO deleted successfully');
            fetchHMOs();
        } catch (error) {
            console.error(error);
            toast.error('Error deleting HMO');
        } finally {
            setLoading(false);
        }
    };

    const handleExportToExcel = () => {
        const exportData = hmos.map(hmo => ({
            'HMO Name': hmo.name,
            'Code': hmo.code || '',
            'Description': hmo.description || '',
            'Contact Person': hmo.contactPerson || '',
            'Contact Phone': hmo.contactPhone || '',
            'Contact Email': hmo.contactEmail || '',
            'Status': hmo.active ? 'Active' : 'Inactive'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'HMOs');
        XLSX.writeFile(wb, `HMOs_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast.success('HMOs exported successfully');
    };

    const handleDownloadTemplate = () => {
        const templateData = [{
            'HMO Name': 'Example HMO',
            'Code': 'HMO001',
            'Description': 'Example description',
            'Contact Person': 'John Doe',
            'Contact Phone': '08012345678',
            'Contact Email': 'contact@hmo.com'
        }];

        const ws = XLSX.utils.json_to_sheet(templateData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, 'HMO_Import_Template.xlsx');
        toast.success('Template downloaded');
    };

    const handleImportExcel = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            setLoading(true);
            const formData = new FormData();
            formData.append('file', file);

            const config = {
                headers: {
                    Authorization: `Bearer ${user.token}`,
                    'Content-Type': 'multipart/form-data'
                }
            };

            const { data } = await axios.post('http://localhost:5000/api/hmos/import-excel', formData, config);
            toast.success(data.message);

            if (data.results.failed.length > 0) {
                console.log('Failed imports:', data.results.failed);
                toast.warning(`${data.results.failed.length} HMOs failed to import. Check console for details.`);
            }

            fetchHMOs();
            e.target.value = ''; // Reset file input
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error importing HMOs');
        } finally {
            setLoading(false);
        }
    };

    if (!user || user.role !== 'admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access HMO management.</p>
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
                        <FaHospital /> HMO Management
                    </h1>
                    <p className="text-blue-100">Manage Health Maintenance Organizations</p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex-1 min-w-[300px]">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search HMOs..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => handleOpenModal()}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                            >
                                <FaPlus /> Add HMO
                            </button>
                            <button
                                onClick={handleDownloadTemplate}
                                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2"
                            >
                                <FaDownload /> Template
                            </button>
                            <label className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2 cursor-pointer">
                                <FaUpload /> Import
                                <input
                                    type="file"
                                    accept=".xlsx,.xls"
                                    onChange={handleImportExcel}
                                    className="hidden"
                                />
                            </label>
                            <button
                                onClick={handleExportToExcel}
                                className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
                            >
                                <FaDownload /> Export
                            </button>
                        </div>
                    </div>
                </div>

                {/* HMOs Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        HMO Name
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Category
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Code
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contact Person
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contact Phone
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredHMOs.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                                            No HMOs found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredHMOs.map((hmo) => (
                                        <tr key={hmo._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900">{hmo.name}</div>
                                                {hmo.description && (
                                                    <div className="text-sm text-gray-500">{hmo.description}</div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    {hmo.category || 'Private'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {hmo.code || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {hmo.contactPerson || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {hmo.contactPhone || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${hmo.active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {hmo.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleOpenModal(hmo)}
                                                        className="text-blue-600 hover:text-blue-900"
                                                        title="Edit"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleStatus(hmo)}
                                                        className={hmo.active ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'}
                                                        title={hmo.active ? 'Deactivate' : 'Activate'}
                                                    >
                                                        {hmo.active ? <FaToggleOn /> : <FaToggleOff />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(hmo._id)}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="Delete"
                                                    >
                                                        <FaTrash />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <p className="text-gray-600 text-sm font-semibold mb-2">Total HMOs</p>
                        <p className="text-3xl font-bold text-blue-600">{hmos.length}</p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <p className="text-gray-600 text-sm font-semibold mb-2">Active HMOs</p>
                        <p className="text-3xl font-bold text-green-600">
                            {hmos.filter(h => h.active).length}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <p className="text-gray-600 text-sm font-semibold mb-2">Inactive HMOs</p>
                        <p className="text-3xl font-bold text-red-600">
                            {hmos.filter(h => !h.active).length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaHospital /> {editMode ? 'Edit HMO' : 'Add New HMO'}
                            </h3>
                            <button
                                onClick={handleCloseModal}
                                className="text-white hover:text-gray-200 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-6">
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        value={currentHMO.category}
                                        onChange={(e) => setCurrentHMO({ ...currentHMO, category: e.target.value })}
                                        className="w-full border p-2 rounded"
                                        required
                                    >
                                        <option value="Private">Private</option>
                                        <option value="NHIA">NHIA</option>
                                        <option value="State Scheme">State Scheme</option>
                                        <option value="Retainership">Retainership</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-1">
                                        HMO Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={currentHMO.name}
                                        onChange={(e) => setCurrentHMO({ ...currentHMO, name: e.target.value })}
                                        className="w-full border p-2 rounded"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-1">Code</label>
                                    <input
                                        type="text"
                                        value={currentHMO.code}
                                        onChange={(e) => setCurrentHMO({ ...currentHMO, code: e.target.value })}
                                        className="w-full border p-2 rounded"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-1">Description</label>
                                    <textarea
                                        value={currentHMO.description}
                                        onChange={(e) => setCurrentHMO({ ...currentHMO, description: e.target.value })}
                                        className="w-full border p-2 rounded"
                                        rows="3"
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Contact Person</label>
                                        <input
                                            type="text"
                                            value={currentHMO.contactPerson}
                                            onChange={(e) => setCurrentHMO({ ...currentHMO, contactPerson: e.target.value })}
                                            className="w-full border p-2 rounded"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Contact Phone</label>
                                        <input
                                            type="text"
                                            value={currentHMO.contactPhone}
                                            onChange={(e) => setCurrentHMO({ ...currentHMO, contactPhone: e.target.value })}
                                            className="w-full border p-2 rounded"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold mb-1">Contact Email</label>
                                    <input
                                        type="email"
                                        value={currentHMO.contactEmail}
                                        onChange={(e) => setCurrentHMO({ ...currentHMO, contactEmail: e.target.value })}
                                        className="w-full border p-2 rounded"
                                    />
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                    >
                                        {editMode ? 'Update HMO' : 'Create HMO'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default HMOManagement;
