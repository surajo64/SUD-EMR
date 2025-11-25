import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaTrashAlt, FaUndo, FaPlus } from 'react-icons/fa';
import { toast } from 'react-toastify';

const DrugDisposal = () => {
    const { user } = useContext(AuthContext);
    const [disposals, setDisposals] = useState([]);
    const [mainPharmacy, setMainPharmacy] = useState(null);
    const [inventory, setInventory] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        drugId: '',
        quantity: '',
        disposalType: 'destruction',
        reason: '',
        notes: '',
        supplierReturnDetails: {
            supplierName: '',
            returnReason: '',
            refundAmount: '',
            trackingNumber: ''
        }
    });

    useEffect(() => {
        fetchDisposals();
        fetchMainPharmacy();
    }, []);

    const fetchDisposals = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/drug-disposals', config);
            setDisposals(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching disposals');
        }
    };

    const fetchMainPharmacy = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data: pharmacy } = await axios.get('http://localhost:5000/api/pharmacies/main', config);
            setMainPharmacy(pharmacy);

            // Fetch inventory for main pharmacy
            const { data: inv } = await axios.get(`http://localhost:5000/api/inventory?pharmacy=${pharmacy._id}`, config);
            setInventory(inv);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching main pharmacy');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = {
                ...formData,
                pharmacyId: mainPharmacy._id
            };

            await axios.post('http://localhost:5000/api/drug-disposals', payload, config);
            toast.success('Disposal recorded successfully');
            setShowModal(false);
            setFormData({
                drugId: '',
                quantity: '',
                disposalType: 'destruction',
                reason: '',
                notes: '',
                supplierReturnDetails: {
                    supplierName: '',
                    returnReason: '',
                    refundAmount: '',
                    trackingNumber: ''
                }
            });
            fetchDisposals();
            fetchMainPharmacy(); // Refresh inventory
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error recording disposal');
        }
    };

    return (
        <Layout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FaTrashAlt className="text-red-600" />
                        Drug Disposal Management
                    </h1>
                    <p className="text-gray-600 mt-2">Record drug destruction and supplier returns (Main Pharmacy only)</p>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2"
                    disabled={!mainPharmacy}
                >
                    <FaPlus /> Record Disposal
                </button>
            </div>

            {/* Disposals List */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">Drug</th>
                            <th className="p-4 border-b">Quantity</th>
                            <th className="p-4 border-b">Type</th>
                            <th className="p-4 border-b">Reason</th>
                            <th className="p-4 border-b">Disposed By</th>
                            <th className="p-4 border-b">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        {disposals.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="p-8 text-center text-gray-500">No disposal records found</td>
                            </tr>
                        ) : (
                            disposals.map(disposal => (
                                <tr key={disposal._id} className="hover:bg-gray-50 border-b">
                                    <td className="p-4 font-semibold">
                                        <div>{disposal.drug?.name}</div>
                                        <div className="text-xs text-gray-500">Batch: {disposal.batchNumber || 'N/A'}</div>
                                    </td>
                                    <td className="p-4">{disposal.quantity}</td>
                                    <td className="p-4">
                                        {disposal.disposalType === 'destruction' ? (
                                            <span className="px-3 py-1 rounded-full text-xs bg-red-100 text-red-800">
                                                <FaTrashAlt className="inline mr-1" /> Destruction
                                            </span>
                                        ) : (
                                            <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                                                <FaUndo className="inline mr-1" /> Return to Supplier
                                            </span>
                                        )}
                                    </td>
                                    <td className="p-4 text-sm">{disposal.reason}</td>
                                    <td className="p-4">{disposal.disposedBy?.name}</td>
                                    <td className="p-4">{new Date(disposal.createdAt).toLocaleDateString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Disposal Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl my-8">
                        <h3 className="text-xl font-bold mb-4">Record Drug Disposal</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Drug</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={formData.drugId}
                                    onChange={(e) => setFormData({ ...formData, drugId: e.target.value })}
                                    required
                                >
                                    <option value="">-- Select Drug --</option>
                                    {inventory.map(item => (
                                        <option key={item._id} value={item._id}>
                                            {item.name} (Stock: {item.quantity})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Quantity</label>
                                <input
                                    type="number"
                                    className="w-full border p-2 rounded"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Disposal Type</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={formData.disposalType}
                                    onChange={(e) => setFormData({ ...formData, disposalType: e.target.value })}
                                    required
                                >
                                    <option value="destruction">Destruction</option>
                                    <option value="return_to_supplier">Return to Supplier</option>
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Reason</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    rows="2"
                                    placeholder="e.g., Expired, Damaged, Quality Issue"
                                    required
                                ></textarea>
                            </div>

                            {formData.disposalType === 'return_to_supplier' && (
                                <>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 mb-2 font-semibold">Supplier Name</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={formData.supplierReturnDetails.supplierName}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                supplierReturnDetails: {
                                                    ...formData.supplierReturnDetails,
                                                    supplierName: e.target.value
                                                }
                                            })}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 mb-2 font-semibold">Refund Amount (₦)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={formData.supplierReturnDetails.refundAmount}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                supplierReturnDetails: {
                                                    ...formData.supplierReturnDetails,
                                                    refundAmount: e.target.value
                                                }
                                            })}
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 mb-2 font-semibold">Tracking Number</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={formData.supplierReturnDetails.trackingNumber}
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                supplierReturnDetails: {
                                                    ...formData.supplierReturnDetails,
                                                    trackingNumber: e.target.value
                                                }
                                            })}
                                        />
                                    </div>
                                </>
                            )}

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
                                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                    Record Disposal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default DrugDisposal;
