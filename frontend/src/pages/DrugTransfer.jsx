import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaExchangeAlt, FaCheck, FaTimes, FaPlus, FaEdit } from 'react-icons/fa';
import { toast } from 'react-toastify';

const DrugTransfer = () => {
    const { user } = useContext(AuthContext);
    const [transfers, setTransfers] = useState([]);
    const [pharmacies, setPharmacies] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState(null);
    const [formData, setFormData] = useState({
        drugName: '',
        toPharmacyId: '',
        requestedQuantity: '',
        notes: ''
    });
    const [approvalData, setApprovalData] = useState({
        approvedQuantity: '',
        rejectionReason: ''
    });

    const isAdminOrMainPharmacist = user.role === 'admin' ||
        (user.role === 'pharmacist' && user.assignedPharmacy?.isMainPharmacy);

    useEffect(() => {
        fetchTransfers();
        fetchPharmacies();
    }, []);

    const fetchTransfers = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/drug-transfers', config);
            setTransfers(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching transfer requests');
        }
    };

    const fetchPharmacies = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/pharmacies', config);
            setPharmacies(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post('http://localhost:5000/api/drug-transfers', formData, config);
            toast.success('Transfer request submitted successfully');
            setShowModal(false);
            setFormData({ drugName: '', toPharmacyId: '', requestedQuantity: '', notes: '' });
            fetchTransfers();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error creating transfer request');
        }
    };

    const handleApprove = async (withEdit = false) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = withEdit ? { approvedQuantity: approvalData.approvedQuantity } : {};

            await axios.put(`http://localhost:5000/api/drug-transfers/${selectedTransfer._id}/approve`, payload, config);
            toast.success('Transfer request approved and completed');
            setShowApproveModal(false);
            setSelectedTransfer(null);
            setApprovalData({ approvedQuantity: '', rejectionReason: '' });
            fetchTransfers();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error approving transfer');
        }
    };

    const handleReject = async () => {
        if (!approvalData.rejectionReason.trim()) {
            toast.error('Please provide a rejection reason');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `http://localhost:5000/api/drug-transfers/${selectedTransfer._id}/reject`,
                { rejectionReason: approvalData.rejectionReason },
                config
            );
            toast.success('Transfer request rejected');
            setShowApproveModal(false);
            setSelectedTransfer(null);
            setApprovalData({ approvedQuantity: '', rejectionReason: '' });
            fetchTransfers();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error rejecting transfer');
        }
    };

    const openApproveModal = (transfer) => {
        setSelectedTransfer(transfer);
        setApprovalData({ approvedQuantity: transfer.requestedQuantity, rejectionReason: '' });
        setShowApproveModal(true);
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            approved: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800'
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    return (
        <Layout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FaExchangeAlt className="text-green-600" />
                        Drug Transfer Requests
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {isAdminOrMainPharmacist
                            ? 'Review and approve transfer requests'
                            : 'Request drugs from main pharmacy'}
                    </p>
                </div>
                {user.role === 'pharmacist' && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                    >
                        <FaPlus /> New Request
                    </button>
                )}
            </div>

            {/* Transfers List */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">Drug</th>
                            <th className="p-4 border-b">From</th>
                            <th className="p-4 border-b">To</th>
                            <th className="p-4 border-b">Requested Qty</th>
                            <th className="p-4 border-b">Approved Qty</th>
                            <th className="p-4 border-b">Status</th>
                            <th className="p-4 border-b">Requested By</th>
                            <th className="p-4 border-b">Date</th>
                            <th className="p-4 border-b text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transfers.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="p-8 text-center text-gray-500">No transfer requests found</td>
                            </tr>
                        ) : (
                            transfers.map(transfer => (
                                <tr key={transfer._id} className="hover:bg-gray-50 border-b">
                                    <td className="p-4 font-semibold">{transfer.drug?.name}</td>
                                    <td className="p-4">{transfer.fromPharmacy?.name}</td>
                                    <td className="p-4">{transfer.toPharmacy?.name}</td>
                                    <td className="p-4">{transfer.requestedQuantity}</td>
                                    <td className="p-4">{transfer.approvedQuantity || '-'}</td>
                                    <td className="p-4">{getStatusBadge(transfer.status)}</td>
                                    <td className="p-4">{transfer.requestedBy?.name}</td>
                                    <td className="p-4">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4 text-right space-x-2">
                                        {transfer.status === 'pending' && isAdminOrMainPharmacist && (
                                            <button
                                                onClick={() => openApproveModal(transfer)}
                                                className="text-green-600 hover:text-green-800"
                                                title="Review Request"
                                            >
                                                <FaEdit />
                                            </button>
                                        )}
                                        {transfer.status === 'rejected' && transfer.rejectionReason && (
                                            <span className="text-xs text-red-600" title={transfer.rejectionReason}>
                                                ℹ️
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Request Modal (Pharmacist) */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold mb-4">Request Drug Transfer</h3>
                        <form onSubmit={handleSubmitRequest}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Drug Name</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded"
                                    value={formData.drugName}
                                    onChange={(e) => setFormData({ ...formData, drugName: e.target.value })}
                                    placeholder="Enter drug name"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">To Pharmacy</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={formData.toPharmacyId}
                                    onChange={(e) => setFormData({ ...formData, toPharmacyId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Select Destination --</option>
                                    {pharmacies.map(p => (
                                        <option key={p._id} value={p._id}>
                                            {p.name} {p.isMainPharmacy && '(Main)'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Requested Quantity</label>
                                <input
                                    type="number"
                                    className="w-full border p-2 rounded"
                                    value={formData.requestedQuantity}
                                    onChange={(e) => setFormData({ ...formData, requestedQuantity: e.target.value })}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Notes (Optional)</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Approve/Reject Modal (Admin/Main Pharmacist) */}
            {showApproveModal && selectedTransfer && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold mb-4">Review Transfer Request</h3>

                        <div className="mb-4 p-4 bg-gray-50 rounded">
                            <p><strong>Drug:</strong> {selectedTransfer.drug?.name}</p>
                            <p><strong>From:</strong> {selectedTransfer.fromPharmacy?.name}</p>
                            <p><strong>To:</strong> {selectedTransfer.toPharmacy?.name}</p>
                            <p><strong>Requested By:</strong> {selectedTransfer.requestedBy?.name}</p>
                            <p><strong>Requested Quantity:</strong> {selectedTransfer.requestedQuantity}</p>
                            {selectedTransfer.notes && <p><strong>Notes:</strong> {selectedTransfer.notes}</p>}
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">Approved Quantity</label>
                            <input
                                type="number"
                                className="w-full border p-2 rounded"
                                value={approvalData.approvedQuantity}
                                onChange={(e) => setApprovalData({ ...approvalData, approvedQuantity: e.target.value })}
                                min="1"
                                placeholder="Leave as is or edit"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Leave unchanged to approve requested quantity
                            </p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">Rejection Reason (if rejecting)</label>
                            <textarea
                                className="w-full border p-2 rounded"
                                value={approvalData.rejectionReason}
                                onChange={(e) => setApprovalData({ ...approvalData, rejectionReason: e.target.value })}
                                rows="2"
                                placeholder="Required if rejecting"
                            ></textarea>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowApproveModal(false)}
                                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleReject}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-2"
                            >
                                <FaTimes /> Reject
                            </button>
                            <button
                                type="button"
                                onClick={() => handleApprove(approvalData.approvedQuantity !== selectedTransfer.requestedQuantity.toString())}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <FaCheck /> Approve
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default DrugTransfer;
