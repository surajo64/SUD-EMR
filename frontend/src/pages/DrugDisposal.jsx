import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaTrash, FaPlus, FaUndo, FaFileExcel, FaPrint } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const DrugDisposal = () => {
    const { user } = useContext(AuthContext);
    const [disposals, setDisposals] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });
    const [formData, setFormData] = useState({
        drug: '',
        quantity: '',
        reason: '',
        notes: ''
    });
    const [selectedDrugDetails, setSelectedDrugDetails] = useState(null);

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
    const isAdminOrMainPharmacy = user.role === 'admin' || isMainPharmacy;

    // Print drug details for supplier return from table
    const printDisposalEvidence = (disposal) => {
        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.write('<html><head><title>Drug Return to Supplier - Evidence</title>');
        printWindow.document.write('<style>');
        printWindow.document.write('body { font-family: Arial, sans-serif; padding: 20px; }');
        printWindow.document.write('h1 { color: #1e40af; border-bottom: 3px solid #1e40af; padding-bottom: 10px; }');
        printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
        printWindow.document.write('th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }');
        printWindow.document.write('th { background-color: #1e40af; color: white; }');
        printWindow.document.write('.footer { margin-top: 40px; font-size: 12px; color: #666; }');
        printWindow.document.write('</style></head><body>');
        printWindow.document.write('<h1>Drug Return to Supplier - Evidence Document</h1>');
        printWindow.document.write('<p><strong>Date:</strong> ' + new Date(disposal.createdAt).toLocaleString() + '</p>');
        printWindow.document.write('<p><strong>Pharmacy:</strong> ' + (disposal.pharmacy?.name || 'N/A') + '</p>');
        printWindow.document.write('<p><strong>Processed By:</strong> ' + (disposal.processedBy?.name || 'N/A') + '</p>');
        printWindow.document.write('<h2>Drug Information</h2>');
        printWindow.document.write('<table>');
        printWindow.document.write('<tr><th>Field</th><th>Value</th></tr>');
        printWindow.document.write('<tr><td>Drug Name</td><td>' + (disposal.drug?.name || 'N/A') + '</td></tr>');
        printWindow.document.write('<tr><td>Batch Number</td><td>' + (disposal.drug?.batchNumber || 'N/A') + '</td></tr>');
        printWindow.document.write('<tr><td>Supplier</td><td>' + (disposal.drug?.supplier || 'N/A') + '</td></tr>');
        printWindow.document.write('<tr><td>Barcode</td><td>' + (disposal.drug?.barcode || 'N/A') + '</td></tr>');
        printWindow.document.write('<tr><td>Expiry Date</td><td>' + (disposal.drug?.expiryDate ? new Date(disposal.drug.expiryDate).toLocaleDateString() : 'N/A') + '</td></tr>');
        printWindow.document.write('<tr><td>Purchased Price</td><td>₦' + (disposal.drug?.purchasingPrice || 'N/A') + '</td></tr>');
        printWindow.document.write('<tr><td>Drug Form</td><td>' + (disposal.drug?.form || 'N/A') + '</td></tr>');
        printWindow.document.write('<tr><td>Quantity Returned</td><td>' + disposal.quantity + '</td></tr>');
        printWindow.document.write('</table>');
        if (disposal.refundAmount > 0) {
            printWindow.document.write('<h2>Refund Information</h2>');
            printWindow.document.write('<p><strong>Expected Refund Amount:</strong> ₦' + disposal.refundAmount.toLocaleString() + '</p>');
        }
        if (disposal.notes) {
            printWindow.document.write('<h2>Notes</h2>');
            printWindow.document.write('<p>' + disposal.notes + '</p>');
        }
        printWindow.document.write('<div class="footer">This document serves as evidence for drug return to supplier.</div>');
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    };

    // Generate filtered report data
    const generateReportData = () => {
        let reportData = [...disposals];

        // Apply date range filter
        if (dateRange.startDate) {
            const startDate = new Date(dateRange.startDate);
            startDate.setHours(0, 0, 0, 0);
            reportData = reportData.filter(d => new Date(d.createdAt) >= startDate);
        }
        if (dateRange.endDate) {
            const endDate = new Date(dateRange.endDate);
            endDate.setHours(23, 59, 59, 999);
            reportData = reportData.filter(d => new Date(d.createdAt) <= endDate);
        }

        return reportData;
    };

    // Download Excel report
    const downloadReport = () => {
        const reportData = generateReportData();

        const excelData = reportData.map(d => ({
            'Date': new Date(d.createdAt).toLocaleDateString(),
            'Drug': d.drug?.name || 'N/A',
            'Quantity': d.quantity,
            'Reason': d.reason?.replace(/_/g, ' ').toUpperCase(),
            'Pharmacy': d.pharmacy?.name || 'N/A',
            'Processed By': d.processedBy?.name || 'N/A',
            'Notes': d.notes || ''
        }));

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Disposal Report');

        const fileName = `Drug_Disposal_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        saveAs(new Blob([buffer], { type: 'application/octet-stream' }), fileName);

        toast.success('Report downloaded successfully');
        setShowReportModal(false);
    };

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
                                    Return/Disposal
                                </>
                            )}
                        </h1>
                        <p className="text-gray-600 mt-2">
                            {isBranchPharmacy
                                ? 'Return excess or unwanted drugs back to main pharmacy'
                                : 'Record disposal of expired, damaged, or returned drugs'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {isAdminOrMainPharmacy && (
                            <button
                                onClick={() => setShowReportModal(true)}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <FaFileExcel /> Generate Report
                            </button>
                        )}
                        <button
                            onClick={() => setShowModal(true)}
                            className={`${isBranchPharmacy ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'} text-white px-4 py-2 rounded flex items-center gap-2`}
                        >
                            <FaPlus /> {isBranchPharmacy ? 'Return Drug' : 'Record Disposal'}
                        </button>
                    </div>
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
                            <th className="p-4 border-b">Refund Amount</th>
                            <th className="p-4 border-b">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {disposals.length === 0 ? (
                            <tr>
                                <td colSpan="9" className="p-8 text-center text-gray-500">
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
                                    <td className="p-4">
                                        {disposal.refundAmount > 0 ? (
                                            <span className="text-green-600 font-semibold">₦{disposal.refundAmount.toLocaleString()}</span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </td>
                                    <td className="p-4">
                                        {disposal.reason === 'return_to_supplier' && (
                                            <button
                                                onClick={() => printDisposalEvidence(disposal)}
                                                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 flex items-center gap-1 text-sm"
                                                title="Print Evidence"
                                            >
                                                <FaPrint /> Print
                                            </button>
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
                                    onChange={(e) => {
                                        const selectedItem = inventory.find(item => item._id === e.target.value);
                                        setFormData({ ...formData, drug: e.target.value });
                                        setSelectedDrugDetails(selectedItem || null);
                                    }}
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

                            {/* Drug Details - Show when Return to Supplier is selected */}
                            {formData.reason === 'return_to_supplier' && selectedDrugDetails && (
                                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded">
                                    <div className="flex justify-between items-center mb-3">
                                        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
                                            <span>📦</span> Drug Details for Return
                                        </h4>

                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <p className="text-gray-600 font-medium">Batch Number:</p>
                                            <p className="text-gray-900">{selectedDrugDetails.batchNumber || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 font-medium">Supplier:</p>
                                            <p className="text-gray-900">{selectedDrugDetails.supplier || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 font-medium">Barcode:</p>
                                            <p className="text-gray-900">{selectedDrugDetails.barcode || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 font-medium">Expiry Date:</p>
                                            <p className="text-gray-900">
                                                {selectedDrugDetails.expiryDate
                                                    ? new Date(selectedDrugDetails.expiryDate).toLocaleDateString()
                                                    : 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 font-medium">Purchased Price:</p>
                                            <p className="text-gray-900">₦{selectedDrugDetails.purchasingPrice || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-600 font-medium">Drug Form:</p>
                                            <p className="text-gray-900 capitalize">{selectedDrugDetails.form || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

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

            {/* Report Modal */}
            {showReportModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
                        <h3 className="text-xl font-bold mb-4">Generate Disposal Report</h3>

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
                                <strong>Records to include:</strong> {generateReportData().length} disposal(s)
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                                Leave dates empty to include all records
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
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
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

export default DrugDisposal;
