import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import { FaPlus, FaEdit, FaTrash, FaHospital, FaStar } from 'react-icons/fa';
import { toast } from 'react-toastify';

const PharmacyManagement = () => {
    const { user } = useContext(AuthContext);
    const [pharmacies, setPharmacies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        description: '',
        isMainPharmacy: false
    });

    useEffect(() => {
        fetchPharmacies();
    }, []);

    const fetchPharmacies = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/pharmacies', config);
            setPharmacies(data);
            // Small delay to ensure UI finishes rendering before hiding overlay
            setTimeout(() => setLoading(false), 300);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching pharmacies');
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editItem) {
                await axios.put(`http://localhost:5000/api/pharmacies/${editItem._id}`, formData, config);
                toast.success('Pharmacy updated successfully');
            } else {
                await axios.post('http://localhost:5000/api/pharmacies', formData, config);
                toast.success('Pharmacy created successfully');
            }

            setShowModal(false);
            setEditItem(null);
            setFormData({ name: '', location: '', description: '', isMainPharmacy: false });
            fetchPharmacies();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving pharmacy');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this pharmacy?')) {
            try {
                const config = { headers: { Authorization: `Bearer ${user.token}` } };
                await axios.delete(`http://localhost:5000/api/pharmacies/${id}`, config);
                toast.success('Pharmacy deleted successfully');
                fetchPharmacies();
            } catch (error) {
                console.error(error);
                toast.error(error.response?.data?.message || 'Error deleting pharmacy');
            }
        }
    };

    const openEditModal = (item) => {
        setEditItem(item);
        setFormData({
            name: item.name,
            location: item.location || '',
            description: item.description || '',
            isMainPharmacy: item.isMainPharmacy
        });
        setShowModal(true);
    };

    const openAddModal = () => {
        setEditItem(null);
        setFormData({ name: '', location: '', description: '', isMainPharmacy: false });
        setShowModal(true);
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FaHospital className="text-green-600" />
                        Pharmacy Management
                    </h1>
                    <p className="text-gray-600 mt-2">Manage pharmacy locations and assignments</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                >
                    <FaPlus /> Add Pharmacy
                </button>
            </div>

            {/* Pharmacies List */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">Name</th>
                            <th className="p-4 border-b">Location</th>
                            <th className="p-4 border-b">Description</th>
                            <th className="p-4 border-b">Type</th>
                            <th className="p-4 border-b">Status</th>
                            <th className="p-4 border-b text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-500">Loading...</td>
                            </tr>
                        ) : pharmacies.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-500">No pharmacies found. Add one to get started.</td>
                            </tr>
                        ) : (
                            pharmacies.map(item => (
                                <tr key={item._id} className="hover:bg-gray-50 border-b last:border-0">
                                    <td className="p-4 font-semibold">
                                        <div className="flex items-center gap-2">
                                            {item.name}
                                            {item.isMainPharmacy && (
                                                <FaStar className="text-yellow-500" title="Main Pharmacy" />
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-600">{item.location || '-'}</td>
                                    <td className="p-4 text-gray-600">{item.description || '-'}</td>
                                    <td className="p-4">
                                        {item.isMainPharmacy ? (
                                            <span className="px-3 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 font-semibold">
                                                Main Pharmacy
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                                Branch
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs ${item.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {item.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right space-x-2">
                                        <button
                                            onClick={() => openEditModal(item)}
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            <FaEdit />
                                        </button>
                                        {!item.isMainPharmacy && (
                                            <button
                                                onClick={() => handleDelete(item._id)}
                                                className="text-red-600 hover:text-red-800"
                                            >
                                                <FaTrash />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
                        <h3 className="text-xl font-bold mb-4">
                            {editItem ? 'Edit Pharmacy' : 'Add New Pharmacy'}
                        </h3>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Name</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Main Pharmacy, Outpatient Pharmacy"
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Location</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g., Ground Floor, Building A"
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Description</label>
                                <textarea
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows="3"
                                    placeholder="Optional description"
                                ></textarea>
                            </div>
                            <div className="mb-4">
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.isMainPharmacy}
                                        onChange={(e) => setFormData({ ...formData, isMainPharmacy: e.target.checked })}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-gray-700 font-semibold">Mark as Main Pharmacy</span>
                                </label>
                                <p className="text-xs text-gray-500 mt-1 ml-6">
                                    Only one pharmacy can be marked as main. This will unmark others.
                                </p>
                            </div>
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 text-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-semibold"
                                >
                                    Save
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default PharmacyManagement;
