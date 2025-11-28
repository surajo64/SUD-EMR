import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaUniversity, FaPlus, FaEdit, FaTrash, FaStar } from 'react-icons/fa';
import { toast } from 'react-toastify';

const BankManagement = () => {
    const { user } = useContext(AuthContext);
    const [banks, setBanks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingBank, setEditingBank] = useState(null);
    const [formData, setFormData] = useState({
        bankName: '',
        accountName: '',
        accountNumber: '',
        branchName: '',
        swiftCode: '',
        isDefault: false
    });

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchBanks();
        }
    }, [user]);

    const fetchBanks = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/banks', config);
            setBanks(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching banks');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editingBank) {
                await axios.put(
                    `http://localhost:5000/api/banks/${editingBank._id}`,
                    formData,
                    config
                );
                toast.success('Bank updated successfully');
            } else {
                await axios.post('http://localhost:5000/api/banks', formData, config);
                toast.success('Bank created successfully');
            }

            fetchBanks();
            closeModal();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving bank');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this bank?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/banks/${id}`, config);
            toast.success('Bank deleted successfully');
            fetchBanks();
        } catch (error) {
            console.error(error);
            toast.error('Error deleting bank');
        }
    };

    const handleSetDefault = async (id) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/banks/${id}/set-default`, {}, config);
            toast.success('Default bank updated');
            fetchBanks();
        } catch (error) {
            console.error(error);
            toast.error('Error setting default bank');
        }
    };

    const openModal = (bank = null) => {
        if (bank) {
            setEditingBank(bank);
            setFormData({
                bankName: bank.bankName,
                accountName: bank.accountName,
                accountNumber: bank.accountNumber,
                branchName: bank.branchName || '',
                swiftCode: bank.swiftCode || '',
                isDefault: bank.isDefault
            });
        } else {
            setEditingBank(null);
            setFormData({
                bankName: '',
                accountName: '',
                accountNumber: '',
                branchName: '',
                swiftCode: '',
                isDefault: false
            });
        }
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingBank(null);
        setFormData({
            bankName: '',
            accountName: '',
            accountNumber: '',
            branchName: '',
            swiftCode: '',
            isDefault: false
        });
    };

    if (user?.role !== 'admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access bank management.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <FaUniversity className="text-green-600" />
                            Bank Management
                        </h1>
                        <p className="text-gray-600 mt-2">Manage hospital bank accounts</p>
                    </div>
                    <button
                        onClick={() => openModal()}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                    >
                        <FaPlus /> Add Bank Account
                    </button>
                </div>

                {/* Banks List */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-gray-600">Loading...</div>
                    ) : banks.length === 0 ? (
                        <div className="p-12 text-center text-gray-600">
                            No bank accounts found. Add one to get started.
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-4 text-left">Bank Name</th>
                                    <th className="p-4 text-left">Account Name</th>
                                    <th className="p-4 text-left">Account Number</th>
                                    <th className="p-4 text-left">Branch</th>
                                    <th className="p-4 text-left">SWIFT Code</th>
                                    <th className="p-4 text-left">Status</th>
                                    <th className="p-4 text-left">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {banks.map((bank) => (
                                    <tr key={bank._id} className="border-b hover:bg-gray-50">
                                        <td className="p-4 font-semibold">
                                            {bank.bankName}
                                            {bank.isDefault && (
                                                <FaStar className="inline ml-2 text-yellow-500" title="Default Bank" />
                                            )}
                                        </td>
                                        <td className="p-4">{bank.accountName}</td>
                                        <td className="p-4 font-mono">{bank.accountNumber}</td>
                                        <td className="p-4">{bank.branchName || '-'}</td>
                                        <td className="p-4">{bank.swiftCode || '-'}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${bank.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                }`}>
                                                {bank.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex gap-2">
                                                {!bank.isDefault && (
                                                    <button
                                                        onClick={() => handleSetDefault(bank._id)}
                                                        className="text-yellow-600 hover:text-yellow-800"
                                                        title="Set as default"
                                                    >
                                                        <FaStar />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openModal(bank)}
                                                    className="text-blue-600 hover:text-blue-800"
                                                    title="Edit"
                                                >
                                                    <FaEdit />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(bank._id)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Delete"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h2 className="text-2xl font-bold mb-4">
                            {editingBank ? 'Edit Bank Account' : 'Add Bank Account'}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">Bank Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.bankName}
                                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                                    className="w-full border p-2 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Account Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.accountName}
                                    onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                                    className="w-full border p-2 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Account Number *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.accountNumber}
                                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                                    className="w-full border p-2 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Branch Name</label>
                                <input
                                    type="text"
                                    value={formData.branchName}
                                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                                    className="w-full border p-2 rounded"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">SWIFT Code</label>
                                <input
                                    type="text"
                                    value={formData.swiftCode}
                                    onChange={(e) => setFormData({ ...formData, swiftCode: e.target.value })}
                                    className="w-full border p-2 rounded"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isDefault"
                                    checked={formData.isDefault}
                                    onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                                />
                                <label htmlFor="isDefault" className="text-sm font-semibold">Set as default bank</label>
                            </div>
                            <div className="flex gap-2 justify-end mt-6">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 border rounded hover:bg-gray-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                    {editingBank ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default BankManagement;
