import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaPlus, FaEdit, FaTrash, FaPills, FaSyringe, FaClock, FaWeight } from 'react-icons/fa';
import { toast } from 'react-toastify';

const DrugMetadataManagement = () => {
    const { user } = useContext(AuthContext);
    const [activeTab, setActiveTab] = useState('route'); // route, form, dosage, frequency
    const [metadataList, setMetadataList] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [formData, setFormData] = useState({
        value: '',
        description: ''
    });

    useEffect(() => {
        fetchMetadata();
    }, [activeTab]);

    const fetchMetadata = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`http://localhost:5000/api/drug-metadata?type=${activeTab}`, config);
            setMetadataList(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching data');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editItem) {
                await axios.put(`http://localhost:5000/api/drug-metadata/${editItem._id}`, formData, config);
                toast.success('Updated successfully');
            } else {
                await axios.post('http://localhost:5000/api/drug-metadata', {
                    ...formData,
                    type: activeTab
                }, config);
                toast.success('Created successfully');
            }

            setShowModal(false);
            setEditItem(null);
            setFormData({ value: '', description: '' });
            fetchMetadata();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving data');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this item?')) {
            try {
                const config = { headers: { Authorization: `Bearer ${user.token}` } };
                await axios.delete(`http://localhost:5000/api/drug-metadata/${id}`, config);
                toast.success('Deleted successfully');
                fetchMetadata();
            } catch (error) {
                console.error(error);
                toast.error('Error deleting item');
            }
        }
    };

    const openEditModal = (item) => {
        setEditItem(item);
        setFormData({
            value: item.value,
            description: item.description || ''
        });
        setShowModal(true);
    };

    const openAddModal = () => {
        setEditItem(null);
        setFormData({ value: '', description: '' });
        setShowModal(true);
    };

    const tabs = [
        { id: 'route', label: 'Routes', icon: <FaSyringe /> },
        { id: 'form', label: 'Forms', icon: <FaPills /> },
        { id: 'dosage', label: 'Dosages', icon: <FaWeight /> },
        { id: 'frequency', label: 'Frequencies', icon: <FaClock /> },
    ];

    return (
        <Layout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FaPills className="text-green-600" />
                        Drug Metadata Management
                    </h1>
                    <p className="text-gray-600 mt-2">Manage drug routes, forms, dosages, and frequencies</p>
                </div>
                <button
                    onClick={openAddModal}
                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                >
                    <FaPlus /> Add New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
                </button>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded shadow mb-6">
                <div className="flex border-b">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`flex-1 p-4 font-semibold flex items-center justify-center gap-2 ${activeTab === tab.id
                                    ? 'bg-green-50 text-green-600 border-b-2 border-green-600'
                                    : 'text-gray-500 hover:bg-gray-50'
                                }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">Value</th>
                            <th className="p-4 border-b">Description</th>
                            <th className="p-4 border-b">Status</th>
                            <th className="p-4 border-b text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr>
                                <td colSpan="4" className="p-8 text-center text-gray-500">Loading...</td>
                            </tr>
                        ) : metadataList.length === 0 ? (
                            <tr>
                                <td colSpan="4" className="p-8 text-center text-gray-500">No items found. Add one to get started.</td>
                            </tr>
                        ) : (
                            metadataList.map(item => (
                                <tr key={item._id} className="hover:bg-gray-50 border-b last:border-0">
                                    <td className="p-4 font-semibold">{item.value}</td>
                                    <td className="p-4 text-gray-600">{item.description || '-'}</td>
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
                                        <button
                                            onClick={() => handleDelete(item._id)}
                                            className="text-red-600 hover:text-red-800"
                                        >
                                            <FaTrash />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-96 shadow-xl">
                        <h3 className="text-xl font-bold mb-4">
                            {editItem ? 'Edit Item' : `Add New ${activeTab}`}
                        </h3>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Value</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.value}
                                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                                    placeholder={`e.g., ${activeTab === 'dosage' ? '500mg' : activeTab === 'frequency' ? 'Twice Daily' : 'Oral'}`}
                                    required
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Description (Optional)</label>
                                <textarea
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500 outline-none"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows="3"
                                ></textarea>
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

export default DrugMetadataManagement;
