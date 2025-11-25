import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaTrash, FaPlus, FaUndo } from 'react-icons/fa';
import { toast } from 'react-toastify';

const DrugDisposal = () => {
    const { user } = useContext(AuthContext);
    const [disposals, setDisposals] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        drug: '',
        quantity: '',
        reason: '',
        notes: ''
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Calculate pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = disposals.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(disposals.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

    const isMainPharmacy = user.assignedPharmacy?.isMainPharmacy;
    const isBranchPharmacy = user.role === 'pharmacist' && !isMainPharmacy;

    useEffect(() => {
        fetchDisposals();
        fetchInventory();
    }, []);

    const fetchDisposals = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const pharmacyParam = user.role === 'pharmacist' && user.assignedPharmacy
                ? `?pharmacy=${user.assignedPharmacy._id || user.assignedPharmacy}`
                : '';
            const { data } = await axios.get(`http://localhost:5000/api/drug-disposals${pharmacyParam}`, config);
            setDisposals(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching disposal records');
        }
    };

    const fetchInventory = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const pharmacyParam = user.assignedPharmacy
                ? `?pharmacy=${user.assignedPharmacy._id || user.assignedPharmacy}`
                : '';
            const { data } = await axios.get(`http://localhost:5000/api/inventory${pharmacyParam}`, config);
            setInventory(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (isBranchPharmacy) {
                // For branch pharmacy - this is a return to main pharmacy
                await axios.post('http://localhost:5000/api/drug-disposals/return', formData, config);
                toast.success('Drug return to main pharmacy submitted successfully');
            } else {
                // For main pharmacy - this is disposal
                await axios.post('http://localhost:5000/api/drug-disposals', formData, config);
                toast.success('Drug disposal recorded successfully');
            }

            setShowModal(false);
            setFormData({ drug: '', quantity: '', reason: '', notes: '' });
            fetchDisposals();
            fetchInventory();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error processing request');
        }
    };

    return (
        <Layout>
            <div className="mb-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            {isBranchPharmacy ? (
                                <>
                                    <FaUndo className="text-blue-600" />
                                    Return Drugs to Main Pharmacy
                                </>
                            ) : (
                                <>
                                    <FaTrash className="text-red-600" />
                                    Drug Disposal
                                </>
                            )}
                        </h1>
                        <p className="text-gray-600 mt-2">
                            {isBranchPharmacy
                                ? 'Return excess or unwanted drugs back to main pharmacy'
                                : 'Record disposal of expired, damaged, or returned drugs'}
                        </p>
                    </div>
                    <button
                        onClick={() => setShowModal(true)}
                        className={`${isBranchPharmacy ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} text-white px-4 py-2 rounded flex items-center gap-2`}
                    >
                        <FaPlus /> {isBranchPharmacy ? 'Return Drug' : 'Record Disposal'}
                    </button>
                </div>
            </div>

            {/* Disposal/Return Records */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">Date</th>
                            <th className="p-4 border-b">Drug</th>
                            <th className="p-4 border-b">Quantity</th>
                            <th className="p-4 border-b">Reason</th>
                            <th className="p-4 border-b">Pharmacy</th>
                            <th className="p-4 border-b">Processed By</th>
                            <th className="p-4 border-b">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {disposals.length === 0 ? (
                            <tr>
                                <td colSpan="7" className="p-8 text-center text-gray-500">
                                    {isBranchPharmacy ? 'No return records found' : 'No disposal records found'}
                                </td>
                            </tr>
                        ) : (
                            currentItems.map(disposal => (
                                <tr key={disposal._id} className="hover:bg-gray-50 border-b">
                                    <td className="p-4">{new Date(disposal.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4 font-semibold">{disposal.drug?.name}</td>
                                    <td className="p-4">{disposal.quantity}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs ${disposal.reason === 'expired' ? 'bg-red-100 text-red-800' :
                                            disposal.reason === 'damaged' ? 'bg-orange-100 text-orange-800' :
                                                disposal.reason === 'return_to_supplier' ? 'bg-blue-100 text-blue-800' :
                                                    disposal.reason === 'return_to_main' ? 'bg-green-100 text-green-800' :
                                                        'bg-gray-100 text-gray-800'
                                            }`}>
                                            {disposal.reason?.replace(/_/g, ' ').toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4">{disposal.pharmacy?.name}</td>
                                    <td className="p-4">{disposal.processedBy?.name}</td>
                                    <td className="p-4">{disposal.notes || '-'}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex justify-center mt-4 gap-2">
                    <button
                        onClick={() => paginate(currentPage - 1)}
                        disabled={currentPage === 1}
                        className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                    >
                        Prev
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                        <button
                            key={i + 1}
                            onClick={() => paginate(i + 1)}
                            className={`px-3 py-1 rounded ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                        >
                            {i + 1}
                        </button>
                    ))}
                    <button
                        onClick={() => paginate(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-gray-200 hover:bg-gray-300'}`}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold mb-4">
                            {isBranchPharmacy ? 'Return Drug to Main Pharmacy' : 'Record Drug Disposal'}
                        </h3>
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Select Drug</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={formData.drug}
                                    onChange={(e) => setFormData({ ...formData, drug: e.target.value })}
                                    required
                                >
                                    <option value="">-- Select Drug --</option>
                                    {inventory.map(item => (
                                        <option key={item._id} value={item._id}>
                                            {item.name} (Available: {item.quantity})
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
                                <label className="block text-gray-700 mb-2 font-semibold">Reason</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    required
                                >
                                    <option value="">-- Select Reason --</option>
                                    {isBranchPharmacy ? (
                                        <>
                                            <option value="return_to_main">Return to Main Pharmacy</option>
                                            <option value="excess_stock">Excess Stock</option>
                                            <option value="near_expiry">Near Expiry</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="expired">Expired</option>
                                            <option value="damaged">Damaged</option>
                                            <option value="return_to_supplier">Return to Supplier</option>
                                            <option value="other">Other</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Notes (Optional)</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    rows="2"
                                    placeholder="Additional details..."
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
                                    className={`px-4 py-2 text-white rounded ${isBranchPharmacy ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'}`}
                                >
                                    {isBranchPharmacy ? 'Submit Return' : 'Record Disposal'}
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
