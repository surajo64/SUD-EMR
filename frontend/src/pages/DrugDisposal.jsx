import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import { FaTrash, FaPlus, FaUndo, FaFileExcel, FaPrint } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const DrugDisposal = () => {
    const { user, loading } = useContext(AuthContext);
    const [disposals, setDisposals] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [dateRange, setDateRange] = useState({
        startDate: '',
        endDate: ''
    });

    // Search and select states
    const [drugSearchTerm, setDrugSearchTerm] = useState('');
    const [filteredDrugs, setFilteredDrugs] = useState([]);
    const [showDrugDropdown, setShowDrugDropdown] = useState(false);
    const [selectedDrug, setSelectedDrug] = useState('');
    const [tempDisposals, setTempDisposals] = useState([]); // List of drugs to dispose

    // Individual disposal form data
    const [disposalForm, setDisposalForm] = useState({
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

    // Prevent crash if user is not loaded yet
    if (loading) {
        return <LoadingOverlay />;
    }

    if (!user) {
        return (
            <Layout>
                <div className="p-8 text-center text-red-600">Please log in to access this page.</div>
            </Layout>
        );
    }

    const isMainPharmacy = user.assignedPharmacy?.isMainPharmacy;
    const isBranchPharmacy = user.role === 'pharmacist' && !isMainPharmacy;
    // Make admin check case-insensitive
    const isAdmin = user.role?.toLowerCase() === 'admin';
    const isAdminOrMainPharmacy = isAdmin || isMainPharmacy;

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
        if (user) {
            fetchDisposals();
            fetchInventory();
        }
    }, [user]);

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

            let pharmacyParam = '';

            // For admin or main pharmacy: fetch ONLY main pharmacy drugs
            // DEBUG: Check user role
            // toast.info(`Role: ${user.role}, Assigned: ${JSON.stringify(user.assignedPharmacy)}`);

            if (isAdminOrMainPharmacy) {
                try {
                    const pharmaciesRes = await axios.get('http://localhost:5000/api/pharmacies', config);
                    const mainPharmacy = pharmaciesRes.data.find(p => p.isMainPharmacy);
                    if (mainPharmacy) {
                        pharmacyParam = `?pharmacy=${mainPharmacy._id}`;
                    } else {
                        console.warn('No main pharmacy found');
                        toast.warning('No main pharmacy configured in the system');
                    }
                } catch (error) {
                    console.error('Error fetching pharmacies:', error);
                    toast.error('Error loading pharmacy information');
                    return;
                }
            } else if (user.assignedPharmacy) {
                // For branch pharmacy: fetch only their branch drugs
                pharmacyParam = `?pharmacy=${user.assignedPharmacy._id || user.assignedPharmacy}`;
            } else {
                toast.error(`User not assigned to any pharmacy (Role: ${user.role})`);
                return;
            }

            const { data } = await axios.get(`http://localhost:5000/api/inventory${pharmacyParam}`, config);
            setInventory(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching inventory');
        }
    };

    // Filter drugs based on search term
    useEffect(() => {
        if (drugSearchTerm) {
            const filtered = inventory.filter(d =>
                d.name.toLowerCase().includes(drugSearchTerm.toLowerCase())
            );
            setFilteredDrugs(filtered);
            setShowDrugDropdown(true);
        } else {
            setFilteredDrugs([]);
            setShowDrugDropdown(false);
        }
    }, [drugSearchTerm, inventory]);

    // Select drug from search dropdown
    const handleSelectDrugFromSearch = (drug) => {
        setSelectedDrug(drug._id);
        setDrugSearchTerm(drug.name);
        setShowDrugDropdown(false);
        setSelectedDrugDetails(drug);
    };

    // Add drug to disposal list
    const handleAddToDisposalList = () => {
        if (!selectedDrug || !disposalForm.quantity || !disposalForm.reason) {
            toast.error('Please select a drug, enter quantity, and select a reason');
            return;
        }

        const drugData = inventory.find(d => d._id === selectedDrug);
        if (!drugData) return;

        // Check if quantity exceeds available stock
        if (parseInt(disposalForm.quantity) > drugData.quantity) {
            toast.error(`Quantity exceeds available stock (${drugData.quantity})`);
            return;
        }

        const newDisposal = {
            id: Date.now(), // Temp ID for UI
            drug: selectedDrug,
            drugName: drugData.name,
            drugDetails: drugData,
            quantity: parseInt(disposalForm.quantity),
            reason: disposalForm.reason,
            notes: disposalForm.notes
        };

        setTempDisposals([...tempDisposals, newDisposal]);

        // Reset form
        setSelectedDrug('');
        setDrugSearchTerm('');
        setSelectedDrugDetails(null);
        setDisposalForm({ quantity: '', reason: '', notes: '' });
        toast.success('Drug added to disposal list');
    };

    // Remove drug from disposal list
    const handleRemoveFromDisposalList = (id) => {
        setTempDisposals(tempDisposals.filter(d => d.id !== id));
    };

    // Submit all disposals
    const handleSubmitAll = async () => {
        if (tempDisposals.length === 0) {
            toast.error('No drugs in the disposal list');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            for (const disposal of tempDisposals) {
                const payload = {
                    drug: disposal.drug,
                    quantity: disposal.quantity,
                    reason: disposal.reason,
                    notes: disposal.notes
                };

                if (isBranchPharmacy) {
                    // For branch pharmacy - this is a return to main pharmacy
                    await axios.post('http://localhost:5000/api/drug-disposals/return', payload, config);
                } else {
                    // For main pharmacy - this is disposal
                    await axios.post('http://localhost:5000/api/drug-disposals', payload, config);
                }
            }

            toast.success(`${tempDisposals.length} disposal(s) processed successfully`);
            setShowModal(false);
            setTempDisposals([]);
            setSelectedDrug('');
            setDrugSearchTerm('');
            setDisposalForm({ quantity: '', reason: '', notes: '' });
            fetchDisposals();
            fetchInventory();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error processing disposals');
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
                            <FaPlus /> {isBranchPharmacy ? 'Return Drug' : 'Return/Disposal'}
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
                    <div className="bg-white p-6 rounded-lg w-full max-w-4xl shadow-xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">
                            {isBranchPharmacy ? 'Return Drugs to Main Pharmacy' : 'Record Drug Disposal'}
                        </h3>

                        <div className="space-y-4">
                            {/* Drug Search & Add Form */}
                            <div className="bg-gray-50 p-4 rounded border">
                                <h4 className="font-semibold text-sm text-gray-700 mb-3">Add Drug to Disposal List</h4>

                                {/* Search Drug */}
                                <div className="mb-3 relative">
                                    <label className="block text-xs text-gray-600 mb-1">Search Drug</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        placeholder="Type to search..."
                                        value={drugSearchTerm}
                                        onChange={(e) => setDrugSearchTerm(e.target.value)}
                                        onFocus={() => drugSearchTerm && setShowDrugDropdown(true)}
                                    />
                                    {showDrugDropdown && filteredDrugs.length > 0 && (
                                        <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                            {filteredDrugs.map(drug => (
                                                <div
                                                    key={drug._id}
                                                    className="p-2 hover:bg-blue-50 cursor-pointer text-sm"
                                                    onClick={() => handleSelectDrugFromSearch(drug)}
                                                >
                                                    <div className="font-semibold">{drug.name}</div>
                                                    <div className="text-xs text-gray-500">Available: {drug.quantity}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {selectedDrug && (
                                    <div className="grid grid-cols-4 gap-2 items-end">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                                            <input
                                                type="number"
                                                className="w-full border p-2 rounded text-sm"
                                                value={disposalForm.quantity}
                                                onChange={(e) => setDisposalForm({ ...disposalForm, quantity: e.target.value })}
                                                min="1"
                                                placeholder="Qty"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Reason</label>
                                            <select
                                                className="w-full border p-2 rounded text-sm"
                                                value={disposalForm.reason}
                                                onChange={(e) => setDisposalForm({ ...disposalForm, reason: e.target.value })}
                                            >
                                                <option value="">-- Select --</option>
                                                {isBranchPharmacy ? (
                                                    <>
                                                        <option value="return_to_main">Return to Main</option>
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
                                        <div className="col-span-2">
                                            <label className="block text-xs text-gray-600 mb-1">Notes (Optional)</label>
                                            <input
                                                type="text"
                                                className="w-full border p-2 rounded text-sm"
                                                value={disposalForm.notes}
                                                onChange={(e) => setDisposalForm({ ...disposalForm, notes: e.target.value })}
                                                placeholder="Additional details..."
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedDrug && (
                                    <div className="mt-3">
                                        <button
                                            onClick={handleAddToDisposalList}
                                            className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm font-semibold"
                                        >
                                            Add to List
                                        </button>
                                    </div>
                                )}

                                {/* Drug Details - Show when Return to Supplier is selected */}
                                {disposalForm.reason === 'return_to_supplier' && selectedDrugDetails && (
                                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
                                        <h4 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
                                            <span>📦</span> Drug Details for Return
                                        </h4>
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
                            </div>

                            {/* Temporary Disposal List */}
                            <div className="border rounded overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-2">Drug</th>
                                            <th className="p-2">Quantity</th>
                                            <th className="p-2">Reason</th>
                                            <th className="p-2">Notes</th>
                                            <th className="p-2">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tempDisposals.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="p-4 text-center text-gray-500">
                                                    No drugs added yet. Search and add drugs above.
                                                </td>
                                            </tr>
                                        ) : (
                                            tempDisposals.map(disposal => (
                                                <tr key={disposal.id} className="border-b">
                                                    <td className="p-2 font-semibold">{disposal.drugName}</td>
                                                    <td className="p-2">{disposal.quantity}</td>
                                                    <td className="p-2">
                                                        <span className={`px-2 py-1 rounded text-xs ${disposal.reason === 'expired' ? 'bg-red-100 text-red-800' :
                                                            disposal.reason === 'damaged' ? 'bg-orange-100 text-orange-800' :
                                                                disposal.reason === 'return_to_supplier' ? 'bg-blue-100 text-blue-800' :
                                                                    disposal.reason === 'return_to_main' ? 'bg-green-100 text-green-800' :
                                                                        'bg-gray-100 text-gray-800'
                                                            }`}>
                                                            {disposal.reason.replace(/_/g, ' ').toUpperCase()}
                                                        </span>
                                                    </td>
                                                    <td className="p-2 text-xs">{disposal.notes || '-'}</td>
                                                    <td className="p-2">
                                                        <button
                                                            onClick={() => handleRemoveFromDisposalList(disposal.id)}
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

                            <div className="flex gap-2 justify-end mt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        setTempDisposals([]);
                                        setSelectedDrug('');
                                        setDrugSearchTerm('');
                                        setDisposalForm({ quantity: '', reason: '', notes: '' });
                                    }}
                                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSubmitAll}
                                    disabled={tempDisposals.length === 0}
                                    className={`px-4 py-2 text-white rounded flex items-center gap-2 ${tempDisposals.length === 0
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : isBranchPharmacy
                                            ? 'bg-blue-600 hover:bg-blue-700'
                                            : 'bg-red-600 hover:bg-red-700'
                                        }`}
                                >
                                    <FaTrash /> {isBranchPharmacy ? 'Submit All Returns' : 'Process All Disposals'} ({tempDisposals.length})
                                </button>
                            </div>
                        </div>
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
