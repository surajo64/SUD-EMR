import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaFileInvoiceDollar, FaFilter, FaDownload, FaEye, FaCheck, FaTimes, FaMoneyBillWave, FaPrint } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import LoadingOverlay from '../components/loadingOverlay';

const ClaimsManagement = () => {
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
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
    const [systemSettings, setSystemSettings] = useState(null);

    useEffect(() => {
        if (user?.token) {
            fetchHMOs();
            fetchClaims();
            fetchSummary();
            fetchDefaultBank();
            fetchSystemSettings();
        }
    }, [user]);

    useEffect(() => {
        if (user?.token) {
            fetchClaims();
            fetchSummary();
        }
    }, [selectedHMO, selectedStatus, startDate, endDate, user]);

    const fetchSystemSettings = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/settings`);
            setSystemSettings(data);
        } catch (error) {
            console.error('Error fetching system settings:', error);
        }
    };

    const fetchHMOs = async () => {
        try {
            if (!user?.token) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/hmos`, config);
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

            const { data } = await axios.get(`${backendUrl}/api/claims`, { ...config, params });
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
            if (selectedHMO) params.hmo = selectedHMO;
            if (selectedStatus) params.status = selectedStatus;
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const { data } = await axios.get(`${backendUrl}/api/claims/summary`, { ...config, params });
            setSummary(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleViewDetails = async (claimId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/claims/${claimId}`, config);
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
                `${backendUrl}/api/claims/${selectedClaim._id}/status`,
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

            const { data } = await axios.get(`${backendUrl}/api/claims/export`, { ...config, params });

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
            const { data } = await axios.get(`${backendUrl}/api/banks/default`, config);
            setDefaultBank(data);
        } catch (error) {
            console.error('No default bank set:', error);
        }
    };

    const handlePrintClaim = async (claimId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/claims/${claimId}`, config);

            // Calculate totals
            const totalBilled = data.totalClaimAmount;
            const patientPayable = data.claimItems.reduce((sum, item) => sum + (item.patientPortion || 0), 0);
            const hmoPayable = data.claimItems.reduce((sum, item) => sum + (item.hmoPortion || 0), 0);

            const printWindow = window.open('', '', 'width=800,height=600');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Claim Statement - ${data.claimNumber}</title>
                    <style>
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .logo { height: 80px; margin-bottom: 10px; }
                        .hospital-name { font-size: 24px; font-weight: bold; color: #000; text-transform: uppercase; margin: 0; }
                        .hospital-details { font-size: 14px; margin: 5px 0; color: #555; }
                        .document-title { font-size: 20px; font-weight: bold; text-align: center; margin: 20px 0 10px 0; color: #000; }
                        
                        .separator { border-bottom: 2px solid #000; margin-bottom: 30px; }
                        
                        .info-section { margin-bottom: 30px; }
                        .info-row { margin-bottom: 8px; font-size: 15px; }
                        .label { font-weight: bold; width: 120px; display: inline-block; }
                        
                        .summary-box { 
                            background-color: #f9f9f9; 
                            border: 1px solid #ddd; 
                            padding: 15px; 
                            margin-bottom: 30px; 
                            display: flex; 
                            justify-content: space-between;
                        }
                        .summary-item { text-align: center; }
                        .summary-label { font-size: 14px; color: #666; font-weight: bold; display: block; margin-bottom: 5px; }
                        .summary-value { font-size: 18px; font-weight: bold; color: #000; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        th { text-align: left; padding: 10px; border-bottom: 2px solid #ddd; font-weight: bold; color: #000; }
                        td { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
                        .amount-col { text-align: right; }
                        
                        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
                        
                        @media print { button { display: none; } body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                       ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                        <h1 class="hospital-name">${systemSettings?.reportHeader || systemSettings?.hospitalName || 'Not Recorded'}</h1>
                        <p class="hospital-details">${systemSettings?.address || 'Not Recorded'}</p>
                        <p class="hospital-details">Phone: ${systemSettings?.phone || 'Not Recorded'} | Email: ${systemSettings?.email || 'Not Recorded'}</p>
                    </div>

                    <h2 class="document-title">HMO Claim Statement</h2>
                    <div class="separator"></div>

                    <div class="info-section">
                        <div class="info-row"><span class="label">Patient:</span> ${data.patient?.name || 'N/A'}</div>
                        <div class="info-row"><span class="label">MRN:</span> ${data.patient?.mrn || 'N/A'}</div>
                        <div class="info-row"><span class="label">Insurance No:</span> ${data.patient?.insuranceNumber || 'N/A'}</div>
                        <div class="info-row"><span class="label">HMO:</span> ${data.hmo?.name || 'N/A'}</div>
                        <div class="info-row"><span class="label">Claim No:</span> ${data.claimNumber}</div>
                        <div class="info-row"><span class="label">Date:</span> ${new Date().toLocaleDateString()}</div>
                    </div>

                    <div class="summary-box">
                        <div class="summary-item">
                            <span class="summary-label">Total Billed</span>
                            <span class="summary-value">₦${totalBilled.toLocaleString()}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Patient Payable</span>
                            <span class="summary-value">₦${patientPayable.toLocaleString()}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">HMO Payable</span>
                            <span class="summary-value">₦${hmoPayable.toLocaleString()}</span>
                        </div>
                    </div>

                    <h3>Service Details</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Type</th>
                                <th class="amount-col">Qty</th>
                                <th class="amount-col">Unit Price</th>
                                <th class="amount-col">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.claimItems.map(item => `
                                <tr>
                                    <td>${item.description}</td>
                                    <td>${item.chargeType}</td>
                                    <td class="amount-col">${item.quantity}</td>
                                    <td class="amount-col">₦${item.unitPrice.toLocaleString()}</td>
                                    <td class="amount-col">₦${item.totalAmount.toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    ${defaultBank ? `
                    <div style="margin-top: 30px; background: #f0f8ff; padding: 15px; border-radius: 5px;">
                        <h4 style="margin-top: 0; margin-bottom: 10px;">Payment Details</h4>
                        <p style="margin: 5px 0;"><strong>Bank:</strong> ${defaultBank.bankName}</p>
                        <p style="margin: 5px 0;"><strong>Account Name:</strong> ${defaultBank.accountName}</p>
                        <p style="margin: 5px 0;"><strong>Account Number:</strong> ${defaultBank.accountNumber}</p>
                    </div>
                    ` : ''}

                    <div class="footer">
                        <p>Generated on ${new Date().toLocaleString()}</p>
                        <p>This document is computer generated and valid without signature.</p>
                    </div>

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

            const { data } = await axios.get(`${backendUrl}/api/claims`, { ...config, params });

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
                        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; }
                        .header { text-align: center; margin-bottom: 20px; }
                        .logo { height: 120px; object-fit: contain; margin-bottom: 5px; }
                        .hospital-name { font-size: 26px; font-weight: bold; color: #000; text-transform: uppercase; margin: 0; }
                        .hospital-details { font-size: 14px; margin: 5px 0; color: #555; }
                        .document-title { font-size: 22px; font-weight: bold; text-align: center; margin: 20px 0 10px 0; color: #000; }
                        
                        .separator { border-bottom: 2px solid #000; margin-bottom: 30px; }
                        
                        .summary-box { 
                            background-color: #f9f9f9; 
                            border: 1px solid #ddd; 
                            padding: 20px; 
                            margin-bottom: 30px; 
                            display: flex; 
                            justify-content: space-between;
                            align-items: center;
                        }
                        .summary-item { text-align: center; flex: 1; }
                        .summary-label { font-size: 14px; color: #666; font-weight: bold; display: block; margin-bottom: 5px; }
                        .summary-value { font-size: 24px; font-weight: bold; color: #2d5016; }
                        
                        .patient-section { margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px; page-break-inside: avoid; }
                        .patient-header { font-size: 16px; font-weight: bold; color: #000; margin-bottom: 5px; }
                        .patient-sub { font-size: 13px; color: #666; margin-bottom: 10px; }
                        
                        table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                        th { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; background-color: #f5f5f5; font-size: 12px; font-weight: bold; }
                        td { padding: 8px; border-bottom: 1px solid #eee; font-size: 12px; }
                        .amount-col { text-align: right; }
                        .total-row { font-weight: bold; }
                        
                        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #888; border-top: 1px solid #eee; padding-top: 20px; }
                        
                        @media print { button { display: none; } body { padding: 0; } }
                    </style>
                </head>
                <body>
                    <div class="header">
                       ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                        <h1 class="hospital-name">${systemSettings?.reportHeader || systemSettings?.hospitalName || 'Not Recorded'}</h1>
                        <p class="hospital-details">${systemSettings?.address || 'Not Recorded'}</p>
                        <p class="hospital-details">Phone: ${systemSettings?.phone || 'Not Recorded'} | Email: ${systemSettings?.email || 'Not Recorded'}</p>
                    </div>

                    <h2 class="document-title">Consolidated HMO Claim Statement</h2>
                    <div class="separator"></div>

                    <div style="margin-bottom: 20px;">
                        <p><strong>HMO:</strong> ${hmoName}</p>
                        <p><strong>Period:</strong> ${startDate || 'Any'} to ${endDate || 'Any'}</p>
                    </div>

                    <div class="summary-box">
                        <div class="summary-item">
                            <span class="summary-label">Total Claims</span>
                            <span class="summary-value">${data.length}</span>
                        </div>
                        <div class="summary-item">
                            <span class="summary-label">Grand Total Payable</span>
                            <span class="summary-value">₦${grandTotal.toLocaleString()}</span>
                        </div>
                    </div>

                    ${data.map((claim, index) => `
                        <div class="patient-section">
                            <div class="patient-header">${index + 1}. ${claim.patient?.name || 'N/A'}</div>
                            <div class="patient-sub">MRN: ${claim.patient?.mrn || 'N/A'} | Insurance No: ${claim.patient?.insuranceNumber || 'N/A'} | Claim #: ${claim.claimNumber}</div>
                            
                            <table>
                                <thead>
                                    <tr>
                                        <th>Service</th>
                                        <th>Type</th>
                                        <th class="amount-col">Qty</th>
                                        <th class="amount-col">Unit Price</th>
                                        <th class="amount-col">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${claim.claimItems.map(item => `
                                        <tr>
                                            <td>${item.description}</td>
                                            <td>${item.chargeType}</td>
                                            <td class="amount-col">${item.quantity}</td>
                                            <td class="amount-col">₦${item.unitPrice.toLocaleString()}</td>
                                            <td class="amount-col">₦${item.totalAmount.toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                    <tr class="total-row">
                                        <td colspan="4" class="amount-col">Subtotal:</td>
                                        <td class="amount-col">₦${claim.totalClaimAmount.toLocaleString()}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    `).join('')}

                    ${defaultBank ? `
                    <div style="margin-top: 30px; background: #f0f8ff; padding: 15px; border-radius: 5px;">
                        <h4 style="margin-top: 0; margin-bottom: 10px;">Payment Details</h4>
                        <p style="margin: 5px 0;"><strong>Bank:</strong> ${defaultBank.bankName}</p>
                        <p style="margin: 5px 0;"><strong>Account Name:</strong> ${defaultBank.accountName}</p>
                        <p style="margin: 5px 0;"><strong>Account Number:</strong> ${defaultBank.accountNumber}</p>
                    </div>
                    ` : ''}

                    <div class="footer">
                        <p>Generated on ${new Date().toLocaleString()}</p>
                        <p>This document is computer generated and valid without signature.</p>
                    </div>

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

    if (user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'cashier' && user?.role !== 'readonly_admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access claims management.</p>
                </div>
            </Layout>
        );
    }

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
                                <p className="text-sm text-gray-600">Insurance No: {selectedClaim.patient?.insuranceNumber || 'N/A'}</p>
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

                        {user.role !== 'readonly_admin' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setShowStatusModal(true)}
                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                                >
                                    <FaCheck /> Update Status
                                </button>
                            </div>
                        )}
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
