import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaExchangeAlt, FaCheck, FaTimes, FaPlus, FaEdit, FaDownload, FaFileExcel, FaUndo } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const DrugTransfer = () => {
    const { user } = useContext(AuthContext);
    const [transfers, setTransfers] = useState([]);
    const [returns, setReturns] = useState([]);
    const [filteredTransfers, setFilteredTransfers] = useState([]);
    const [pharmacies, setPharmacies] = useState([]);
    const [inventory, setInventory] = useState([]); // For return modal
    const [showModal, setShowModal] = useState(false);
    const [showReturnModal, setShowReturnModal] = useState(false); // New return modal
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [selectedTransfer, setSelectedTransfer] = useState(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });

    // Transfer Request Form Data
    const [formData, setFormData] = useState({
        drugName: '',
        toPharmacyId: '',
        requestedQuantity: '',
        notes: ''
    });

    // Search State
    const [mainInventory, setMainInventory] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [mainPharmacyId, setMainPharmacyId] = useState(null);

    // Return Form Data
    const [returnFormData, setReturnFormData] = useState({
        drug: '',
        quantity: '',
        reason: '',
        notes: ''
    });

    const [approvalData, setApprovalData] = useState({
        approvedQuantity: '',
        rejectionReason: ''
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const isAdminOrMainPharmacist = user.role === 'admin' ||
        (user.role === 'pharmacist' && user.assignedPharmacy?.isMainPharmacist);

    useEffect(() => {
        fetchTransfers();
        fetchReturns();
        fetchPharmacies();
        if (user.role === 'pharmacist' && !user.assignedPharmacy?.isMainPharmacy) {
            fetchInventory();
        }
    }, []);

    useEffect(() => {
        filterTransfers();
    }, [transfers, returns, statusFilter]);

    // Calculate pagination
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredTransfers.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredTransfers.length / itemsPerPage);

    const paginate = (pageNumber) => setCurrentPage(pageNumber);

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

    const fetchReturns = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            // Fetch returns (disposals with type=return)
            const { data } = await axios.get('http://localhost:5000/api/drug-disposals?type=return', config);

            // Map returns to match transfer structure
            const mappedReturns = data.map(ret => ({
                _id: ret._id,
                drug: ret.drug, // { name, batchNumber }
                requestedQuantity: ret.quantity,
                approvedQuantity: ret.quantity, // Returns are auto-approved
                fromPharmacy: ret.pharmacy, // Source pharmacy
                toPharmacy: { name: 'Main Pharmacy', isMainPharmacy: true }, // Always to main
                status: 'Returned',
                createdAt: ret.createdAt,
                type: 'return', // Custom field to distinguish
                notes: ret.notes,
                processedBy: ret.processedBy
            }));
            setReturns(mappedReturns);
        } catch (error) {
            console.error('Error fetching returns:', error);
        }
    };

    const fetchPharmacies = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/pharmacies', config);
            setPharmacies(data);

            // Find and set Main Pharmacy ID
            const main = data.find(p => p.isMainPharmacy);
            if (main) {
                setMainPharmacyId(main._id);
                setFormData(prev => ({ ...prev, toPharmacyId: main._id }));
                fetchMainInventory(main._id);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMainInventory = async (mainId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`http://localhost:5000/api/inventory?pharmacy=${mainId}`, config);
            setMainInventory(data);
        } catch (error) {
            console.error("Error fetching main inventory", error);
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

    const filterTransfers = () => {
        // Combine transfers and returns
        let allItems = [...transfers, ...returns];

        // Role-based filtering
        if (user.role === 'pharmacist' && !user.assignedPharmacy?.isMainPharmacy) {
            // Branch pharmacists see only their requests (as sender or receiver)
            const userPharmacyId = user.assignedPharmacy?._id || user.assignedPharmacy;
            allItems = allItems.filter(t =>
                t.toPharmacy?._id === userPharmacyId ||
                t.fromPharmacy?._id === userPharmacyId ||
                (t.type === 'return' && t.fromPharmacy?._id === userPharmacyId) // Returns from this pharmacy
            );
        }
        // Admin and main pharmacy see all (including returns from others)

        // Status filtering
        if (statusFilter !== 'all') {
            if (statusFilter === 'Returned') {
                allItems = allItems.filter(t => t.status === 'Returned');
            } else if (statusFilter === 'completed') {
                // Filter for completed transfers (displayed as Transfered)
                allItems = allItems.filter(t => t.status === 'completed');
            } else {
                allItems = allItems.filter(t => t.status === statusFilter);
            }
        }

        // Sort by date desc
        allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        setFilteredTransfers(allItems);
        setCurrentPage(1); // Reset to first page on filter change
    };

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            // Ensure toPharmacyId is set to Main Pharmacy
            const payload = { ...formData, toPharmacyId: mainPharmacyId };

            await axios.post('http://localhost:5000/api/drug-transfers', payload, config);
            toast.success('Transfer request submitted successfully');
            setShowModal(false);
            setFormData({ drugName: '', toPharmacyId: mainPharmacyId, requestedQuantity: '', notes: '' });
            fetchTransfers();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error creating transfer request');
        }
    };

    const handleReturnSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post('http://localhost:5000/api/drug-disposals/return', returnFormData, config);
            toast.success('Drug return to main pharmacy submitted successfully');
            setShowReturnModal(false);
            setReturnFormData({ drug: '', quantity: '', reason: '', notes: '' });
            fetchReturns(); // Refresh returns list
            fetchInventory(); // Refresh inventory
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error processing return');
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

    const generateReport = () => {
        let reportData = filteredTransfers;

        // Apply date range filter with full day coverage
        if (dateRange.startDate) {
            const startDate = new Date(dateRange.startDate);
            startDate.setHours(0, 0, 0, 0); // Start of day
            reportData = reportData.filter(t => new Date(t.createdAt) >= startDate);
        }
        if (dateRange.endDate) {
            const endDate = new Date(dateRange.endDate);
            endDate.setHours(23, 59, 59, 999); // End of day
            reportData = reportData.filter(t => new Date(t.createdAt) <= endDate);
        }

        // Role-based filtering for report
        if (user.role === 'pharmacist' && !user.assignedPharmacy?.isMainPharmacy) {
            const userPharmacyId = user.assignedPharmacy?._id || user.assignedPharmacy;
            reportData = reportData.filter(t =>
                t.toPharmacy?._id === userPharmacyId ||
                t.fromPharmacy?._id === userPharmacyId
            );
        }

        return reportData;
    };

    const downloadReport = () => {
        const reportData = generateReport();

        const excelData = reportData.map(t => ({
            'Date': new Date(t.createdAt).toLocaleDateString(),
            'Drug': t.drug?.name || 'N/A',
            'From Pharmacy': t.fromPharmacy?.name || 'N/A',
            'To Pharmacy': t.toPharmacy?.name || 'N/A',
            'Requested Qty': t.requestedQuantity,
            'Approved Qty': t.approvedQuantity || 'N/A',
            'Status': t.status === 'completed' ? 'TRANSFERED' : t.status.toUpperCase(),
            'Requested By': t.requestedBy?.name || 'N/A',
            'Reviewed By': t.reviewedBy?.name || 'N/A',
            'Notes': t.notes || '',
            'Rejection Reason': t.rejectionReason || ''
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Transfer Report');

        const fileName = `Drug_Transfer_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), fileName);

        toast.success('Report downloaded successfully');
        setShowReportModal(false);
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            approved: 'bg-blue-100 text-blue-800',
            completed: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            Returned: 'bg-purple-100 text-purple-800'
        };

        let label = status.charAt(0).toUpperCase() + status.slice(1);
        if (status === 'completed') label = 'Transfered';

        return (
            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${styles[status] || 'bg-gray-100'}`}>
                {label}
            </span>
        );
    };

    return (
        <Layout>
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                            <FaExchangeAlt className="text-green-600" />
                            {isAdminOrMainPharmacist ? 'Drug Transfer Requests' : 'My Transfer Requests'}
                        </h1>
                        <p className="text-gray-600 mt-2">
                            {isAdminOrMainPharmacist
                                ? 'Review and approve transfer requests from all pharmacies'
                                : 'View your transfer requests and their status'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowReportModal(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                        >
                            <FaFileExcel /> Generate Report
                        </button>
                        {user.role === 'pharmacist' && !user.assignedPharmacy?.isMainPharmacy && (
                            <>
                                <button
                                    onClick={() => setShowModal(true)}
                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                                >
                                    <FaPlus /> Request Transfer
                                </button>
                                <button
                                    onClick={() => setShowReturnModal(true)}
                                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
                                >
                                    <FaUndo /> Return Drugs
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Status Filter */}
                <div className="mb-4">
                    <label className="text-sm text-gray-600 mr-2">Filter by Status:</label>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border p-2 rounded"
                    >
                        <option value="all">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="completed">Transfered</option>
                        <option value="rejected">Rejected</option>
                        <option value="Returned">Returned</option>
                    </select>
                </div>
            </div>

            {/* Transfers List */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">Date</th>
                            <th className="p-4 border-b">Drug</th>
                            <th className="p-4 border-b">From</th>
                            <th className="p-4 border-b">To</th>
                            <th className="p-4 border-b">Requested Qty</th>
                            <th className="p-4 border-b">Approved Qty</th>
                            <th className="p-4 border-b">Status</th>
                            <th className="p-4 border-b">Requested By</th>
                            <th className="p-4 border-b text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredTransfers.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="p-8 text-center text-gray-500">No transfer requests found</td>
                            </tr>
                        ) : (
                            currentItems.map(transfer => (
                                <tr key={transfer._id} className="hover:bg-gray-50 border-b">
                                    <td className="p-4">{new Date(transfer.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4 font-semibold">{transfer.drug?.name}</td>
                                    <td className="p-4">{transfer.fromPharmacy?.name}</td>
                                    <td className="p-4">{transfer.toPharmacy?.name}</td>
                                    <td className="p-4">{transfer.requestedQuantity}</td>
                                    <td className="p-4">{transfer.approvedQuantity || '-'}</td>
                                    <td className="p-4">{getStatusBadge(transfer.status)}</td>
                                    <td className="p-4">{transfer.requestedBy?.name || transfer.processedBy?.name}</td>
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
                                            <span className="text-xs text-red-600 cursor-help" title={transfer.rejectionReason}>
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

            {/* Request Modal (Pharmacist) */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold mb-4">Request Drug Transfer</h3>
                        <form onSubmit={handleSubmitRequest}>
                            <div className="mb-4 relative">
                                <label className="block text-gray-700 mb-2 font-semibold">Drug Name</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded"
                                    value={formData.drugName}
                                    onChange={(e) => {
                                        setFormData({ ...formData, drugName: e.target.value });
                                        setShowSuggestions(true);
                                    }}
                                    placeholder="Search drug in Main Pharmacy..."
                                    required
                                    autoComplete="off"
                                />
                                {showSuggestions && formData.drugName && (
                                    <ul className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-60 overflow-y-auto mt-1">
                                        {mainInventory
                                            .filter(item => item.name.toLowerCase().includes(formData.drugName.toLowerCase()))
                                            .map(item => (
                                                <li
                                                    key={item._id}
                                                    className="p-2 hover:bg-gray-100 cursor-pointer border-b last:border-b-0"
                                                    onClick={() => {
                                                        setFormData({ ...formData, drugName: item.name });
                                                        setShowSuggestions(false);
                                                    }}
                                                >
                                                    <div className="font-semibold">{item.name}</div>
                                                    <div className="text-xs text-gray-500">Available: {item.quantity}</div>
                                                </li>
                                            ))}
                                        {mainInventory.filter(item => item.name.toLowerCase().includes(formData.drugName.toLowerCase())).length === 0 && (
                                            <li className="p-2 text-gray-500">No drugs found</li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">To Pharmacy</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded bg-gray-100 text-gray-600"
                                    value="Main Pharmacy"
                                    disabled
                                />
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

            {/* Return Modal (Branch Pharmacist) */}
            {showReturnModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold mb-4">Return Drugs to Main Pharmacy</h3>
                        <form onSubmit={handleReturnSubmit}>
                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Select Drug</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={returnFormData.drug}
                                    onChange={(e) => setReturnFormData({ ...returnFormData, drug: e.target.value })}
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
                                    value={returnFormData.quantity}
                                    onChange={(e) => setReturnFormData({ ...returnFormData, quantity: e.target.value })}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Reason</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={returnFormData.reason}
                                    onChange={(e) => setReturnFormData({ ...returnFormData, reason: e.target.value })}
                                    required
                                >
                                    <option value="">-- Select Reason --</option>
                                    <option value="return_to_main">Return to Main Pharmacy</option>
                                    <option value="excess_stock">Excess Stock</option>
                                    <option value="near_expiry">Near Expiry</option>
                                </select>
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 mb-2 font-semibold">Notes (Optional)</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    value={returnFormData.notes}
                                    onChange={(e) => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                                    rows="2"
                                ></textarea>
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setShowReturnModal(false)}
                                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                                >
                                    Submit Return
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

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold mb-4">Generate Transfer Report</h3>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">Start Date</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={dateRange.startDate}
                                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">End Date</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={dateRange.endDate}
                                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                            />
                        </div>

                        <div className="mb-4 p-3 bg-blue-50 rounded">
                            <p className="text-sm text-blue-800">
                                <strong>Records to include:</strong> {generateReport().length} transfer(s)
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                                {isAdminOrMainPharmacist
                                    ? 'Report will include all pharmacy transfers'
                                    : 'Report will include only your pharmacy transfers'}
                            </p>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setShowReportModal(false)}
                                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={downloadReport}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                            >
                                Download Excel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default DrugTransfer;
