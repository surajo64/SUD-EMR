import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaFileInvoiceDollar, FaFilter, FaDownload, FaEye, FaCheck, FaTimes, FaMoneyBillWave, FaPrint } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/loadingOverlay';

const ClaimsManagement = () => {
    const { user } = useContext(AuthContext);
    const [claims, setClaims] = useState([]);
    const [hmos, setHMOs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [summary, setSummary] = useState(null);

    // Filters
    const [selectedHMO, setSelectedHMO] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal state
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const [showStatusModal, setShowStatusModal] = useState(false);
    const [newStatus, setNewStatus] = useState('');
    const [rejectionReason, setRejectionReason] = useState('');
    const [notes, setNotes] = useState('');
    const [defaultBank, setDefaultBank] = useState(null);

    useEffect(() => {
        if (user?.token) {
            fetchHMOs();
            fetchClaims();
            fetchSummary();
            fetchDefaultBank();
        }
    }, [user]);

    useEffect(() => {
        if (user?.token) {
            fetchClaims();
            fetchSummary();
        }
    }, [selectedHMO, selectedStatus, startDate, endDate, user]);

    const fetchHMOs = async () => {
        try {
            if (!user?.token) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/hmos', config);
            setHMOs(data.filter(hmo => hmo.active && hmo.category !== 'Retainership'));
        } catch (error) {
            console.error(error);
        }
    };

    const fetchClaims = async () => {
        try {
            if (!user?.token) {
                console.log('User not authenticated');
                return;
            }
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const params = {};
            if (selectedHMO) params.hmo = selectedHMO;
            if (selectedStatus) params.status = selectedStatus;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const { data } = await axios.get('http://localhost:5000/api/claims', { ...config, params });
            setClaims(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching claims');
        } finally {
            setLoading(false);
        }
    };

    const fetchSummary = async () => {
        try {
            if (!user?.token) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const { data } = await axios.get('http://localhost:5000/api/claims/summary', { ...config, params });
            setSummary(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleViewDetails = async (claimId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`http://localhost:5000/api/claims/${claimId}`, config);
            setSelectedClaim(data);
            setShowDetailModal(true);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching claim details');
        }
    };

    const handleUpdateStatus = async () => {
        if (!newStatus) {
            toast.error('Please select a status');
            return;
        }

        if (newStatus === 'rejected' && !rejectionReason) {
            toast.error('Please provide a rejection reason');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `http://localhost:5000/api/claims/${selectedClaim._id}/status`,
                { status: newStatus, rejectionReason, notes },
                config
            );
            toast.success('Claim status updated successfully');
            setShowStatusModal(false);
            setShowDetailModal(false);
            setNewStatus('');
            setRejectionReason('');
            setNotes('');
            fetchClaims();
            fetchSummary();
        } catch (error) {
            console.error(error);
            toast.error('Error updating claim status');
        }
    };

    const handleExportToExcel = async () => {
        try {
            const config = {
                headers: { Authorization: `Bearer ${user.token}` },
                responseType: 'blob'
            };
            const params = {};
            if (selectedHMO) params.hmo = selectedHMO;
            if (selectedStatus) params.status = selectedStatus;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const { data } = await axios.get('http://localhost:5000/api/claims/export', { ...config, params });

            const url = window.URL.createObjectURL(new Blob([data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `hmo-claims-${new Date().toISOString().split('T')[0]}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.remove();

            toast.success('Claims exported successfully');
        } catch (error) {
            console.error(error);
            toast.error('Error exporting claims');
        }
    };

    const fetchDefaultBank = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/banks/default', config);
            setDefaultBank(data);
        } catch (error) {
            console.error('No default bank set:', error);
        }
    };

    const handlePrintClaim = async (claimId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`http://localhost:5000/api/claims/${claimId}`, config);

            const printWindow = window.open('', '', 'width=800,height=600');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Claim Statement - ${data.claimNumber}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .header h1 { margin: 0; color: #2d5016; }
                        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                        th { background-color: #f2f2f2; font-weight: bold; }
                        .total-row { font-weight: bold; background-color: #f9f9f9; }
                        .bank-details { background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0; }
                        @media print { button { display: none; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>SUD EMR - HMO Claim Statement</h1>
                        <p>Claim: ${data.claimNumber} | Date: ${new Date().toLocaleDateString()}</p>
                    </div>
                    <p><strong>Patient:</strong> ${data.patient?.name || 'N/A'} (MRN: ${data.patient?.mrn || 'N/A'})</p>
                    <p><strong>HMO:</strong> ${data.hmo?.name || 'N/A'}</p>
                    <table>
                        <thead><tr><th>Service</th><th>Type</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                        <tbody>
                            ${data.claimItems.map(item => `
                                <tr>
                                    <td>${item.description}</td>
                                    <td>${item.chargeType}</td>
                                    <td>${item.quantity}</td>
                                    <td>₦${item.unitPrice.toLocaleString()}</td>
                                    <td>₦${item.totalAmount.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                            <tr class="total-row">
                                <td colspan="4" style="text-align: right;">Total:</td>
                                <td>₦${data.totalClaimAmount.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>
                    ${defaultBank ? `
                    <div class="bank-details">
                        <h3>Payment Details</h3>
                        <p><strong>Bank:</strong> ${defaultBank.bankName}</p>
                        <p><strong>Account Name:</strong> ${defaultBank.accountName}</p>
                        <p><strong>Account Number:</strong> ${defaultBank.accountNumber}</p>
                        ${defaultBank.branchName ? `<p><strong>Branch:</strong> ${defaultBank.branchName}</p>` : ''}
                    </div>
                    ` : '<p style="color: red;">No bank details available.</p>'}
                    <div style="text-align: center; margin: 20px;">
                        <button onclick="window.print()" style="padding: 10px 20px; background: #2d5016; color: white; border: none; border-radius: 5px; cursor: pointer;">Print</button>
                        <button onclick="window.close()" style="padding: 10px 20px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (error) {
            console.error(error);
            toast.error('Error generating claim statement');
        }
    };

    const handlePrintBatchClaims = async () => {
        try {
            if (!selectedHMO) {
                toast.error('Please select an HMO to print batch claims');
                return;
            }

            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const params = { hmo: selectedHMO };
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const { data } = await axios.get('http://localhost:5000/api/claims', { ...config, params });

            if (data.length === 0) {
                toast.error('No claims found for the selected HMO');
                return;
            }

            const hmoName = hmos.find(h => h._id === selectedHMO)?.name || 'HMO';
            const grandTotal = data.reduce((sum, claim) => sum + claim.totalClaimAmount, 0);

            const printWindow = window.open('', '', 'width=1000,height=800');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Batch Claim Statement - ${hmoName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; }
                        .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #2d5016; padding-bottom: 15px; }
                        .header h1 { margin: 0; color: #2d5016; font-size: 24px; }
                        .patient-section { margin: 30px 0; page-break-inside: avoid; border: 1px solid #ddd; padding: 15px; border-radius: 5px; }
                        .patient-header { background-color: #f5f5f5; padding: 10px; margin: -15px -15px 15px -15px; }
                        .patient-header h3 { margin: 0; color: #2d5016; }
                        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
                        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                        th { background-color: #f2f2f2; font-weight: bold; }
                        .subtotal-row { font-weight: bold; background-color: #f9f9f9; }
                        .grand-total { background-color: #2d5016; color: white; padding: 20px; margin: 30px 0; text-align: center; border-radius: 5px; }
                        .grand-total h2 { margin: 0; font-size: 28px; }
                        .bank-details { background-color: #f0f8ff; padding: 20px; border-radius: 5px; margin: 20px 0; border: 2px solid #2d5016; }
                        @media print { button { display: none; } .patient-section { page-break-inside: avoid; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>SUD EMR - CONSOLIDATED HMO CLAIM STATEMENT</h1>
                        <p><strong>HMO:</strong> ${hmoName}</p>
                        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                        <p><strong>Total Claims:</strong> ${data.length} patients</p>
                    </div>
                    ${data.map((claim, index) => `
                        <div class="patient-section">
                            <div class="patient-header">
                                <h3>Patient ${index + 1}: ${claim.patient?.name || 'N/A'}</h3>
                                <p style="margin: 5px 0 0 0;"><strong>MRN:</strong> ${claim.patient?.mrn || 'N/A'} | <strong>Claim #:</strong> ${claim.claimNumber}</p>
                            </div>
                            <table>
                                <thead><tr><th>Service</th><th>Type</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                                <tbody>
                                    ${claim.claimItems.map(item => `
                                        <tr>
                                            <td>${item.description}</td>
                                            <td>${item.chargeType}</td>
                                            <td>${item.quantity}</td>
                                            <td>₦${item.unitPrice.toLocaleString()}</td>
                                            <td>₦${item.totalAmount.toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                    <tr class="subtotal-row">
                                        <td colspan="4" style="text-align: right;">Subtotal:</td>
                                        <td>₦${claim.totalClaimAmount.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    `).join('')}
                    <div class="grand-total">
                        <h2>GRAND TOTAL: ₦${grandTotal.toLocaleString()}</h2>
                        <p style="margin: 10px 0 0 0;">Total payable by ${hmoName}</p>
                    </div>
                    ${defaultBank ? `
                    <div class="bank-details">
                        <h3>PAYMENT INSTRUCTIONS</h3>
                        <p><strong>Bank:</strong> ${defaultBank.bankName}</p>
                        <p><strong>Account Name:</strong> ${defaultBank.accountName}</p>
                        <p><strong>Account Number:</strong> ${defaultBank.accountNumber}</p>
                        ${defaultBank.branchName ? `<p><strong>Branch:</strong> ${defaultBank.branchName}</p>` : ''}
                    </div>
                    ` : '<p style="color: red;">No bank details available.</p>'}
                    <div style="text-align: center; margin: 30px;">
                        <button onclick="window.print()" style="padding: 12px 30px; background: #2d5016; color: white; border: none; border-radius: 5px; cursor: pointer;">Print</button>
                        <button onclick="window.close()" style="padding: 12px 30px; background: #666; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
        } catch (error) {
            console.error(error);
            toast.error('Error generating batch claim statement');
        }
    };

    const getStatusBadgeClass = (status) => {
        const classes = {
            pending: 'bg-yellow-100 text-yellow-800',
            submitted: 'bg-blue-100 text-blue-800',
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800',
            paid: 'bg-purple-100 text-purple-800'
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaFileInvoiceDollar className="text-green-600" /> HMO Claims Management
                </h2>
                <p className="text-gray-600 text-sm">Manage and track HMO claims for NHIA and KSCHMA patients</p>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white p-4 rounded shadow">
                        <p className="text-gray-600 text-sm">Total Claims</p>
                        <p className="text-2xl font-bold text-gray-800">{summary.totalClaims}</p>
                    </div>
                    <div className="bg-white p-4 rounded shadow">
                        <p className="text-gray-600 text-sm">Total Amount</p>
                        <p className="text-2xl font-bold text-green-600">₦{summary.totalClaimAmount.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-4 rounded shadow">
                        <p className="text-gray-600 text-sm">Pending</p>
                        <p className="text-2xl font-bold text-yellow-600">{summary.byStatus.pending}</p>
                    </div>
                    <div className="bg-white p-4 rounded shadow">
                        <p className="text-gray-600 text-sm">Approved</p>
                        <p className="text-2xl font-bold text-green-600">{summary.byStatus.approved}</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="bg-white p-4 rounded shadow mb-6">
                <div className="flex items-center gap-2 mb-4">
                    <FaFilter className="text-gray-600" />
                    <h3 className="font-semibold text-gray-800">Filters</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">HMO</label>
                        <select
                            value={selectedHMO}
                            onChange={(e) => setSelectedHMO(e.target.value)}
                            className="w-full border p-2 rounded"
                        >
                            <option value="">All HMOs</option>
                            {hmos.map(hmo => (
                                <option key={hmo._id} value={hmo._id}>{hmo.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full border p-2 rounded"
                        >
                            <option value="">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="submitted">Submitted</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                            <option value="paid">Paid</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full border p-2 rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full border p-2 rounded"
                        />
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handlePrintBatchClaims}
                            disabled={!selectedHMO}
                            className={`w-full px-4 py-2 rounded flex items-center justify-center gap-2 ${selectedHMO
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                            title={!selectedHMO ? 'Select an HMO to print batch claims' : 'Print all claims for selected HMO'}
                        >
                            <FaPrint /> Print Batch
                        </button>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={handleExportToExcel}
                            className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2"
                        >
                            <FaDownload /> Export
                        </button>
                    </div>
                </div>
            </div>

            {/* Claims Table */}
            <div className="bg-white rounded shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left p-3 font-semibold">Claim #</th>
                                <th className="text-left p-3 font-semibold">Patient</th>
                                <th className="text-left p-3 font-semibold">HMO</th>
                                <th className="text-left p-3 font-semibold">Encounter Date</th>
                                <th className="text-left p-3 font-semibold">Amount</th>
                                <th className="text-left p-3 font-semibold">Status</th>
                                <th className="text-left p-3 font-semibold">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-gray-500">Loading...</td>
                                </tr>
                            ) : claims.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-gray-500">No claims found</td>
                                </tr>
                            ) : (
                                claims.map(claim => (
                                    <tr key={claim._id} className="border-b hover:bg-gray-50">
                                        <td className="p-3 font-semibold text-blue-600">{claim.claimNumber}</td>
                                        <td className="p-3">
                                            <p className="font-semibold">{claim.patient?.name || 'N/A'}</p>
                                            <p className="text-xs text-gray-600">{claim.patient?.mrn || 'N/A'}</p>
                                        </td>
                                        <td className="p-3">{claim.hmo.name}</td>
                                        <td className="p-3">{new Date(claim.encounter.createdAt).toLocaleDateString()}</td>
                                        <td className="p-3 font-semibold text-green-600">₦{claim.totalClaimAmount.toLocaleString()}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusBadgeClass(claim.status)}`}>
                                                {claim.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleViewDetails(claim._id)}
                                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                                                >
                                                    <FaEye /> View
                                                </button>
                                                <button
                                                    onClick={() => handlePrintClaim(claim._id)}
                                                    className="text-green-600 hover:text-green-800 flex items-center gap-1 text-sm"
                                                    title="Print Claim Statement"
                                                >
                                                    <FaPrint /> Print
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

            {/* Claim Detail Modal */}
            {showDetailModal && selectedClaim && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 w-full max-w-4xl my-8 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Claim Details - {selectedClaim.claimNumber}</h3>
                            <button onClick={() => setShowDetailModal(false)} className="text-gray-500 hover:text-gray-700">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        {/* Patient & HMO Info */}
                        <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded">
                            <div>
                                <p className="text-sm text-gray-600">Patient</p>
                                <p className="font-semibold">{selectedClaim.patient?.name || 'N/A'}</p>
                                <p className="text-sm text-gray-600">MRN: {selectedClaim.patient?.mrn || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">HMO</p>
                                <p className="font-semibold">{selectedClaim.hmo.name}</p>
                                <p className="text-sm text-gray-600">{selectedClaim.hmo.code}</p>
                            </div>
                        </div>

                        {/* Claim Items */}
                        <div className="mb-6">
                            <h4 className="font-semibold mb-2">Claim Items</h4>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="text-left p-2">Service</th>
                                            <th className="text-left p-2">Type</th>
                                            <th className="text-right p-2">Qty</th>
                                            <th className="text-right p-2">Unit Price</th>
                                            <th className="text-right p-2">Total</th>
                                            <th className="text-right p-2">Patient (10%)</th>
                                            <th className="text-right p-2">HMO Claim</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedClaim.claimItems.map((item, index) => (
                                            <tr key={index} className="border-b">
                                                <td className="p-2">{item.description}</td>
                                                <td className="p-2">
                                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                                        {item.chargeType}
                                                    </span>
                                                </td>
                                                <td className="p-2 text-right">{item.quantity}</td>
                                                <td className="p-2 text-right">₦{item.unitPrice.toLocaleString()}</td>
                                                <td className="p-2 text-right font-semibold">₦{item.totalAmount.toLocaleString()}</td>
                                                <td className="p-2 text-right text-orange-600">₦{item.patientPortion.toLocaleString()}</td>
                                                <td className="p-2 text-right text-green-600 font-semibold">₦{item.hmoPortion.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-50 font-semibold">
                                        <tr>
                                            <td colSpan="6" className="p-2 text-right">Total Claimable:</td>
                                            <td className="p-2 text-right text-green-600 text-lg">₦{selectedClaim.totalClaimAmount.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        {/* Status & Dates */}
                        <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded">
                            <div>
                                <p className="text-sm text-gray-600">Status</p>
                                <span className={`px-3 py-1 rounded text-sm font-semibold ${getStatusBadgeClass(selectedClaim.status)}`}>
                                    {selectedClaim.status.toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <p className="text-sm text-gray-600">Created</p>
                                <p className="font-semibold">{new Date(selectedClaim.createdAt).toLocaleDateString()}</p>
                            </div>
                            {selectedClaim.submittedDate && (
                                <div>
                                    <p className="text-sm text-gray-600">Submitted</p>
                                    <p className="font-semibold">{new Date(selectedClaim.submittedDate).toLocaleDateString()}</p>
                                </div>
                            )}
                            {selectedClaim.approvedDate && (
                                <div>
                                    <p className="text-sm text-gray-600">Approved</p>
                                    <p className="font-semibold">{new Date(selectedClaim.approvedDate).toLocaleDateString()}</p>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowStatusModal(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                            >
                                <FaCheck /> Update Status
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Update Modal */}
            {showStatusModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4">Update Claim Status</h3>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Status</label>
                            <select
                                value={newStatus}
                                onChange={(e) => setNewStatus(e.target.value)}
                                className="w-full border p-2 rounded"
                            >
                                <option value="">Select Status</option>
                                <option value="submitted">Submitted</option>
                                <option value="approved">Approved</option>
                                <option value="rejected">Rejected</option>
                                <option value="paid">Paid</option>
                            </select>
                        </div>
                        {newStatus === 'rejected' && (
                            <div className="mb-4">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason</label>
                                <textarea
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                    className="w-full border p-2 rounded"
                                    rows="3"
                                    placeholder="Enter reason for rejection"
                                />
                            </div>
                        )}
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full border p-2 rounded"
                                rows="2"
                                placeholder="Additional notes"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleUpdateStatus}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                            >
                                Update
                            </button>
                            <button
                                onClick={() => {
                                    setShowStatusModal(false);
                                    setNewStatus('');
                                    setRejectionReason('');
                                    setNotes('');
                                }}
                                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ClaimsManagement;
