import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaDollarSign, FaFileInvoiceDollar, FaCheckCircle, FaUndo, FaWallet, FaPrint, FaSearch, FaUser, FaExclamationTriangle, FaBuilding, FaHistory, FaPlus } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

const BillingDashboard = () => {
    const [loading, setLoading] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [patients, setPatients] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [activeTab, setActiveTab] = useState('invoices');
    const [selectedInsuranceInvoices, setSelectedInsuranceInvoices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showPatientSearch, setShowPatientSearch] = useState(false);
    const [patientSearchTerm, setPatientSearchTerm] = useState('');
    const [viewingPatient, setViewingPatient] = useState(null);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [depositSearchTerm, setDepositSearchTerm] = useState('');

    const [retainershipSearchTerm, setRetainershipSearchTerm] = useState('');
    const [retainershipHMOs, setRetainershipHMOs] = useState([]);
    const [selectedHMO, setSelectedHMO] = useState(null);
    const [hmoStatement, setHmoStatement] = useState(null);
    const [showHMODepositModal, setShowHMODepositModal] = useState(false);
    const [hmoDepositAmount, setHmoDepositAmount] = useState('');
    const [hmoDepositDescription, setHmoDepositDescription] = useState('Deposit');
    const [hmoDepositReference, setHmoDepositReference] = useState('');
    const [statementStartDate, setStatementStartDate] = useState('');
    const [statementEndDate, setStatementEndDate] = useState('');

    const [systemSettings, setSystemSettings] = useState(null);

    const { user } = useContext(AuthContext);

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const { data } = await axios.get('http://localhost:5000/api/settings');
                setSystemSettings(data);
            } catch (error) {
                console.error('Error fetching system settings:', error);
            }
        };
        fetchSystemSettings();
        fetchInvoices();
        fetchPatients();
        fetchReceipts();
    }, []);

    const [newInvoice, setNewInvoice] = useState({
        patientId: '',
        items: [{ description: '', cost: '' }],
        paymentMethod: 'cash'
    });

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/invoices', config);
            setInvoices(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching invoices');
        } finally {
            setLoading(false);
        }
    };

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients', config);
            setPatients(data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchReceipts = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/receipts/with-claim-status', config);
            setReceipts(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching receipts');
        } finally {
            setLoading(false);
        }
    };

    // --- Retainership Billing Functions ---

    const searchRetainershipHMOs = async () => {
        if (!retainershipSearchTerm) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/hmos?active=true', config);

            const filtered = data.filter(h =>
                h.category === 'Retainership' &&
                h.name.toLowerCase().includes(retainershipSearchTerm.toLowerCase())
            );

            setRetainershipHMOs(filtered);
            if (filtered.length === 0) {
                toast.info('No Retainership HMOs found matching your search');
            }
        } catch (error) {
            console.error(error);
            toast.error('Error searching HMOs');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectHMO = async (hmo) => {
        setSelectedHMO(hmo);
        fetchHMOStatement(hmo._id);
    };

    const fetchHMOStatement = async (hmoId) => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            let url = `http://localhost:5000/api/hmo-transactions/statement/${hmoId}`;
            if (statementStartDate && statementEndDate) {
                url += `?startDate=${statementStartDate}&endDate=${statementEndDate}`;
            }
            const response = await axios.get(url, config);
            setHmoStatement(response.data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching HMO statement');
        } finally {
            setLoading(false);
        }
    };

    const handleAddHMODeposit = async (e) => {
        e.preventDefault();
        if (!hmoDepositAmount || isNaN(hmoDepositAmount) || Number(hmoDepositAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post('http://localhost:5000/api/hmo-transactions/deposit', {
                hmoId: selectedHMO._id,
                amount: Number(hmoDepositAmount),
                description: hmoDepositDescription,
                reference: hmoDepositReference
            }, config);

            toast.success('Deposit added successfully');
            setShowHMODepositModal(false);
            setHmoDepositAmount('');
            setHmoDepositDescription('Deposit');
            setHmoDepositReference('');

            // Refresh statement
            fetchHMOStatement(selectedHMO._id);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error adding deposit');
        } finally {
            setLoading(false);
        }
    };


    const handleAddDeposit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post(`http://localhost:5000/api/patients/${selectedPatient}/deposit`,
                { amount: parseFloat(depositAmount) }, config);
            toast.success('Deposit added successfully!');
            setShowDepositModal(false);
            setDepositAmount('');
            setSelectedPatient(null);
            fetchPatients();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error adding deposit');
        } finally {
            setLoading(false);
        }
    };

    const handleViewPatientDetails = async (patient) => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const depositRes = await axios.get(`http://localhost:5000/api/patients/${patient._id}/deposit`, config);
            setViewingPatient({ ...patient, depositBalance: depositRes.data.balance, lowDepositThreshold: depositRes.data.threshold });
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patient details');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintPatientStatement = (patient) => {
        const patientReceipts = receipts.filter(r => r.patient?._id === patient._id);
        const totalSpent = patientReceipts.reduce((sum, r) => sum + r.amountPaid, 0);

        const printWindow = window.open('', '', 'width=800,height=600');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Patient Statement - ${patient.name}</title>
                    <style>
                        body { font-family: 'Helvetica', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #333; }
                        .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                        .logo { font-size: 24px; font-weight: bold; color: #2c3e50; }
                        .statement-title { font-size: 36px; color: #2c3e50; margin: 0; }
                        .patient-info { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
                        .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                        .table th { text-align: left; padding: 12px; background: #f8f9fa; border-bottom: 2px solid #eee; }
                        .table td { padding: 12px; border-bottom: 1px solid #eee; }
                        .summary { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-top: 30px; }
                        .summary-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 16px; }
                        .summary-row.total { font-size: 20px; font-weight: bold; border-top: 2px solid #333; padding-top: 10px; margin-top: 10px; }
                        .footer { margin-top: 60px; text-align: center; font-size: 12px; color: #7f8c8d; border-top: 1px solid #eee; padding-top: 20px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="logo">
                            ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                            <div style="font-size: 24px; font-weight: bold; margin-top: 0;">${systemSettings?.reportHeader || 'SUD EMR'}</div>
                        </div>
                        <div>
                            <h1 class="statement-title">PATIENT STATEMENT</h1>
                            <p>Date: ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div class="patient-info">
                        <h3 style="margin-top: 0;">Patient Information</h3>
                        <div class="info-row"><span><strong>Name:</strong></span> <span>${patient.name}</span></div>
                        <div class="info-row"><span><strong>MRN:</strong></span> <span>${patient.mrn}</span></div>
                        <div class="info-row"><span><strong>Contact:</strong></span> <span>${patient.contact || 'N/A'}</span></div>
                        <div class="info-row"><span><strong>Deposit Balance:</strong></span> <span style="color: #28a745; font-weight: bold;">₦${(patient.depositBalance || 0).toLocaleString()}</span></div>
                    </div>

                    <h3>Transaction History</h3>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Receipt #</th>
                                <th>Services</th>
                                <th>Amount</th>
                                <th>Payment Method</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${patientReceipts.map(r => `
                                <tr>
                                    <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                                    <td>${r.receiptNumber}</td>
                                    <td>${r.charges?.map(c => c.charge?.name || 'Service').join(', ') || 'N/A'}</td>
                                    <td>₦${r.amountPaid.toLocaleString()}</td>
                                    <td style="text-transform: capitalize;">${r.paymentMethod}</td>
                                </tr>
                            `).join('')}
                            ${patientReceipts.length === 0 ? '<tr><td colspan="5" style="text-align: center; color: #999;">No transactions found</td></tr>' : ''}
                        </tbody>
                    </table>

                    <div class="summary">
                        <h3 style="margin-top: 0;">Summary</h3>
                        <div class="summary-row"><span>Total Paid:</span> <span style="color: #28a745;">₦${totalSpent.toLocaleString()}</span></div>
                        <div class="summary-row"><span>Total Receipts:</span> <span>${patientReceipts.length}</span></div>
                        <div class="summary-row"><span>Current Deposit:</span> <span style="color: #17a2b8;">₦${(patient.depositBalance || 0).toLocaleString()}</span></div>
                    </div>

                    <div class="footer">
                        <p>${systemSettings?.hospitalName || 'SUD EMR Hospital'} | ${systemSettings?.address || ''} 
                           ${systemSettings?.phone ? ` | Phone: ${systemSettings.phone}` : ''}
                           ${systemSettings?.email ? ` | Email: ${systemSettings.email}` : ''}</p>
                        ${systemSettings?.reportFooter ? `<p style="font-size: 10px;">${systemSettings.reportFooter}</p>` : ''}
                        <p>This is a computer-generated statement</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const handleReverseReceipt = async (receiptId) => {
        if (!window.confirm('Are you sure you want to reverse this payment? This will restore the patient\'s deposit if paid via deposit.')) {
            return;
        }
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post(`http://localhost:5000/api/receipts/${receiptId}/reverse`, {}, config);
            toast.success('Payment reversed successfully!');
            fetchReceipts();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error reversing payment');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReceipt = (receipt) => {
        const printWindow = window.open('', '', 'width=600,height=600');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Receipt ${receipt.receiptNumber}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
                        .items-table { width: 100%; margin-top: 15px; border-collapse: collapse; }
                        .items-table th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px; }
                        .items-table td { padding: 5px 0; }
                        .total-row { border-top: 2px dashed #000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 18px; display: flex; justify-content: space-between; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                        <h2 style="margin: 0 0 5px 0;">${systemSettings?.reportHeader || 'SUD EMR'}</h2>
                        <p style="margin: 5px 0; font-size: 12px;">${systemSettings?.address || ''}</p>
                        <p style="margin: 2px 0; font-size: 12px;">
                            ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                            ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                            ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                        </p>
                        <h3>PAYMENT RECEIPT</h3>
                    </div>
                    
                    <div class="info-row"><span>Receipt #:</span> <strong>${receipt.receiptNumber}</strong></div>
                    <div class="info-row"><span>Date:</span> <span>${new Date(receipt.paymentDate).toLocaleString()}</span></div>
                    <div class="info-row"><span>Patient:</span> <strong>${receipt.patient?.name}</strong></div>
                    <div class="info-row"><span>MRN:</span> <span>${receipt.patient?.mrn || 'N/A'}</span></div>
                    <div class="info-row"><span>Cashier:</span> <strong>${receipt.cashier?.name || 'Unknown'}</strong></div>
                    <div class="info-row"><span>Method:</span> <span style="text-transform: uppercase;">${receipt.paymentMethod}</span></div>

                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Item / Service</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${receipt.charges?.map(c => `
                                <tr>
                                    <td>
                                        ${c.charge?.name || 'Service'} 
                                        ${c.quantity > 1 ? `(x${c.quantity})` : ''}
                                    </td>
                                    <td style="text-align: right;">₦${c.totalAmount.toFixed(2)}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="2">No items</td></tr>'}
                        </tbody>
                    </table>

                    <div class="total-row">
                        <span>TOTAL PAID:</span>
                        <span>₦${receipt.amountPaid.toFixed(2)}</span>
                    </div>

                    <div class="footer">
                        <p>Thank you for your payment!</p>
                        <p>Please retain this receipt for your records.</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    // Filter receipts:
    // Collected: Cash, Deposit, Retainership, OR Insurance where claim is PAID
    // Pending HMO: Insurance where claim is NOT PAID

    const collectedReceipts = receipts.filter(r => {
        if (r.paymentMethod === 'insurance') {
            return r.claimStatus === 'paid';
        }
        return true;
    });

    const pendingHMOReceipts = receipts.filter(r => {
        return r.paymentMethod === 'insurance' && r.claimStatus !== 'paid';
    });

    const totalCollectedToday = collectedReceipts
        .filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString())
        .reduce((sum, r) => sum + r.amountPaid, 0);

    const totalPendingHMO = pendingHMOReceipts
        .reduce((sum, r) => {
            // Calculate from charges to avoid double counting if multiple receipts link to same claim
            const chargesHmoTotal = r.charges?.reduce((cSum, c) => cSum + (c.hmoPortion || 0), 0) || 0;
            return sum + chargesHmoTotal;
        }, 0);

    const totalReceiptsToday = receipts.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).length;

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaFileInvoiceDollar className="text-green-600" /> Billing & Receipts
                </h2>

                {/* Tabs */}
                <div className="flex bg-gray-200 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('invoices')}
                        className={`px-4 py-2 rounded-md font-semibold transition-colors ${activeTab === 'invoices'
                            ? 'bg-white text-blue-600 shadow'
                            : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        General Billing
                    </button>
                    <button
                        onClick={() => setActiveTab('retainership')}
                        className={`px-4 py-2 rounded-md font-semibold transition-colors ${activeTab === 'retainership'
                            ? 'bg-white text-purple-600 shadow'
                            : 'text-gray-600 hover:text-gray-800'
                            }`}
                    >
                        Retainership Billing
                    </button>
                </div>

                {activeTab === 'invoices' && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowPatientSearch(true)}
                            className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
                        >
                            <FaSearch /> Search Patient
                        </button>
                        <button
                            onClick={() => setShowDepositModal(true)}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                        >
                            <FaWallet /> Add Deposit
                        </button>
                    </div>
                )}
            </div>

            {activeTab === 'invoices' ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-green-50 p-6 rounded shadow">
                            <p className="text-green-700 text-sm font-semibold">Collected Today</p>
                            <p className="text-3xl font-bold text-green-800">₦{totalCollectedToday.toLocaleString()}</p>
                        </div>
                        <div className="bg-yellow-50 p-6 rounded shadow">
                            <p className="text-yellow-700 text-sm font-semibold">Pending to HMOs</p>
                            <p className="text-3xl font-bold text-yellow-800">₦{totalPendingHMO.toLocaleString()}</p>
                            <p className="text-xs text-yellow-600 mt-1">{pendingHMOReceipts.length} pending receipts</p>
                        </div>
                        <div className="bg-blue-50 p-6 rounded shadow">
                            <p className="text-blue-700 text-sm font-semibold">Total Receipts Today</p>
                            <p className="text-3xl font-bold text-blue-800">{totalReceiptsToday}</p>
                        </div>
                    </div>

                    {/* Deposit Modal */}
                    {showDepositModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-lg w-96 max-h-[90vh] overflow-y-auto">
                                <h3 className="text-xl font-bold mb-4">Add Patient Deposit</h3>

                                {!selectedPatient ? (
                                    <div>
                                        <div className="mb-4">
                                            <label className="block text-gray-700 mb-2">Search Patient</label>
                                            <input
                                                type="text"
                                                placeholder="Name or MRN..."
                                                className="w-full border p-2 rounded"
                                                value={depositSearchTerm}
                                                onChange={(e) => setDepositSearchTerm(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <div className="space-y-2 max-h-60 overflow-y-auto">
                                            {patients
                                                .filter(p =>
                                                    !depositSearchTerm ||
                                                    p.name.toLowerCase().includes(depositSearchTerm.toLowerCase()) ||
                                                    (p.mrn && p.mrn.toLowerCase().includes(depositSearchTerm.toLowerCase()))
                                                )
                                                .slice(0, 10)
                                                .map(p => (
                                                    <div
                                                        key={p._id}
                                                        onClick={() => setSelectedPatient(p._id)}
                                                        className="p-3 border rounded hover:bg-blue-50 cursor-pointer flex justify-between items-center"
                                                    >
                                                        <div>
                                                            <p className="font-semibold">{p.name}</p>
                                                            <p className="text-xs text-gray-500">{p.mrn}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs text-gray-500">Bal:</p>
                                                            <p className="font-bold text-green-600">₦{p.depositBalance || 0}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                ) : (
                                    <form onSubmit={handleAddDeposit}>
                                        <div className="mb-4 p-3 bg-blue-50 rounded flex justify-between items-center">
                                            <div>
                                                <p className="text-sm text-gray-500">Selected Patient</p>
                                                <p className="font-bold">
                                                    {patients.find(p => p._id === selectedPatient)?.name}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedPatient(null)}
                                                className="text-blue-600 text-sm hover:underline"
                                            >
                                                Change
                                            </button>
                                        </div>

                                        <div className="mb-4">
                                            <label className="block text-gray-700 mb-2">Amount (₦)</label>
                                            <input
                                                type="number"
                                                className="w-full border p-2 rounded"
                                                value={depositAmount}
                                                onChange={(e) => setDepositAmount(e.target.value)}
                                                required
                                                min="0"
                                                autoFocus
                                            />
                                        </div>
                                        <div className="flex justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowDepositModal(false);
                                                    setSelectedPatient(null);
                                                    setDepositSearchTerm('');
                                                }}
                                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                            >
                                                Add Deposit
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Patient Search Modal */}
                    {showPatientSearch && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-lg w-[600px] max-h-[80vh] overflow-y-auto">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <FaSearch /> Search Patient
                                </h3>
                                <input
                                    type="text"
                                    placeholder="Search by name or MRN..."
                                    className="w-full border p-2 rounded mb-4"
                                    value={patientSearchTerm}
                                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                                />
                                <div className="space-y-2 mb-4">
                                    {patients
                                        .filter(p =>
                                            p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
                                            (p.mrn && p.mrn.toLowerCase().includes(patientSearchTerm.toLowerCase()))
                                        )
                                        .slice(0, 10)
                                        .map(patient => (
                                            <div
                                                key={patient._id}
                                                className="border p-3 rounded hover:bg-gray-50 cursor-pointer"
                                                onClick={() => {
                                                    handleViewPatientDetails(patient);
                                                    setShowPatientSearch(false);
                                                }}
                                            >
                                                <p className="font-semibold">{patient.name}</p>
                                                <p className="text-sm text-gray-600">
                                                    MRN: {patient.mrn} | Age: {patient.age} | {patient.gender}
                                                </p>
                                            </div>
                                        ))}
                                    {patients.filter(p =>
                                        p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
                                        (p.mrn && p.mrn.toLowerCase().includes(patientSearchTerm.toLowerCase()))
                                    ).length === 0 && (
                                            <p className="text-gray-500 text-center py-4">No patients found</p>
                                        )}
                                </div>
                                <button
                                    onClick={() => {
                                        setShowPatientSearch(false);
                                        setPatientSearchTerm('');
                                    }}
                                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Patient Details Modal */}
                    {viewingPatient && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-lg w-[700px] max-h-[80vh] overflow-y-auto">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-xl font-bold flex items-center gap-2">
                                        <FaUser /> Patient Details
                                    </h3>
                                    <button
                                        onClick={() => setViewingPatient(null)}
                                        className="text-gray-500 hover:text-gray-700 text-2xl"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="bg-gray-50 p-4 rounded mb-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <p className="text-sm text-gray-600">Name</p>
                                            <p className="font-semibold">{viewingPatient.name}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">MRN</p>
                                            <p className="font-semibold">{viewingPatient.mrn}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Age / Gender</p>
                                            <p className="font-semibold">{viewingPatient.age} / {viewingPatient.gender}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Contact</p>
                                            <p className="font-semibold">{viewingPatient.contact || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-blue-50 p-4 rounded mb-4">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-sm text-blue-600">Deposit Balance</p>
                                            <p className="text-3xl font-bold text-blue-800">
                                                ₦{(viewingPatient.depositBalance || 0).toLocaleString()}
                                            </p>
                                        </div>
                                        {(viewingPatient.depositBalance || 0) < (viewingPatient.lowDepositThreshold || 5000) && (
                                            <div className="text-yellow-600 flex items-center gap-2">
                                                <FaExclamationTriangle />
                                                <span className="text-sm">Low Balance</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h4 className="font-bold mb-2">Transaction Summary</h4>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-green-50 p-3 rounded">
                                            <p className="text-xs text-green-600">Paid</p>
                                            <p className="text-lg font-bold text-green-700">
                                                ₦{receipts
                                                    .filter(r => r.patient?._id === viewingPatient._id)
                                                    .reduce((sum, r) => sum + r.amountPaid, 0)
                                                    .toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="bg-yellow-50 p-3 rounded">
                                            <p className="text-xs text-yellow-600">Pending</p>
                                            <p className="text-lg font-bold text-yellow-700">
                                                ₦0
                                            </p>
                                        </div>
                                        <div className="bg-gray-50 p-3 rounded">
                                            <p className="text-xs text-gray-600">Total Receipts</p>
                                            <p className="text-lg font-bold text-gray-700">
                                                {receipts.filter(r => r.patient?._id === viewingPatient._id).length}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handlePrintPatientStatement(viewingPatient)}
                                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2"
                                    >
                                        <FaPrint /> Print Statement
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedPatient(viewingPatient._id);
                                            setShowDepositModal(true);
                                            setViewingPatient(null);
                                        }}
                                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
                                    >
                                        <FaWallet /> Add Deposit
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}



                    {/* Recent Receipts */}
                    <div className="bg-white p-6 rounded shadow">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaDollarSign className="text-green-600" /> Receipts
                            </h3>
                            <div className="flex gap-2 items-center">
                                <label className="text-sm font-semibold">From:</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="border p-2 rounded text-sm"
                                />
                                <label className="text-sm font-semibold">To:</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="border p-2 rounded text-sm"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-gray-100">
                                    <tr>
                                        <th className="p-3 border-b">Receipt #</th>
                                        <th className="p-3 border-b">Patient</th>
                                        <th className="p-3 border-b">Services</th>
                                        <th className="p-3 border-b">Amount</th>
                                        <th className="p-3 border-b">Method</th>
                                        <th className="p-3 border-b">Received By</th>
                                        <th className="p-3 border-b">Time</th>
                                        <th className="p-3 border-b">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {receipts
                                        .filter(r => {
                                            const receiptDate = new Date(r.createdAt).toISOString().split('T')[0];
                                            return receiptDate >= startDate && receiptDate <= endDate;
                                        })
                                        .slice(0, 20)
                                        .map((receipt) => (
                                            <tr key={receipt._id} className="hover:bg-gray-50">
                                                <td className="p-3 border-b font-mono text-sm">{receipt.receiptNumber}</td>
                                                <td className="p-3 border-b font-semibold">{receipt.patient?.name}</td>
                                                <td className="p-3 border-b text-sm">
                                                    {receipt.charges?.map(c => c.charge?.name || 'Service').join(', ') || 'N/A'}
                                                </td>
                                                <td className="p-3 border-b text-green-600 font-bold">₦{receipt.amountPaid.toFixed(2)}</td>
                                                <td className="p-3 border-b capitalize">
                                                    {receipt.paymentMethod}
                                                    {receipt.paymentMethod === 'insurance' && receipt.claimStatus !== 'paid' && (
                                                        <span className="ml-2 bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-1 rounded">
                                                            Pending HMO
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-3 border-b text-sm">{receipt.cashier?.name || 'N/A'}</td>
                                                <td className="p-3 border-b text-sm">{new Date(receipt.paymentDate).toLocaleTimeString()}</td>
                                                <td className="p-3 border-b">
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handlePrintReceipt(receipt)}
                                                            className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                                                            title="Print Receipt"
                                                        >
                                                            <FaPrint /> Print
                                                        </button>
                                                        {user?.role === 'admin' && (
                                                            <button
                                                                onClick={() => handleReverseReceipt(receipt._id)}
                                                                className="text-red-600 hover:underline flex items-center gap-1 text-sm"
                                                                title="Reverse Payment"
                                                            >
                                                                <FaUndo /> Reverse
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    {receipts.filter(r => {
                                        const receiptDate = new Date(r.createdAt).toISOString().split('T')[0];
                                        return receiptDate >= startDate && receiptDate <= endDate;
                                    }).length === 0 && (
                                            <tr>
                                                <td colSpan="7" className="p-4 text-center text-gray-500">
                                                    No receipts today
                                                </td>
                                            </tr>
                                        )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                /* --- Retainership Billing View --- */
                <div className="space-y-6">
                    {/* Search Retainership HMO */}
                    <div className="bg-white p-6 rounded shadow">
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <FaBuilding /> Find Retainership HMO
                        </h3>
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="Search Retainership HMO by Name..."
                                className="flex-1 border p-2 rounded"
                                value={retainershipSearchTerm}
                                onChange={(e) => setRetainershipSearchTerm(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && searchRetainershipHMOs()}
                            />
                            <button
                                onClick={searchRetainershipHMOs}
                                className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700"
                            >
                                Search
                            </button>
                        </div>

                        {/* HMO Results */}
                        {retainershipHMOs.length > 0 && !selectedHMO && (
                            <div className="space-y-2">
                                <p className="font-semibold text-gray-700">Search Results:</p>
                                {retainershipHMOs.map(hmo => (
                                    <div
                                        key={hmo._id}
                                        onClick={() => handleSelectHMO(hmo)}
                                        className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                                    >
                                        <div>
                                            <p className="font-semibold">{hmo.name}</p>
                                            <p className="text-sm text-gray-600">Contact: {hmo.contactPerson || 'N/A'}</p>
                                        </div>
                                        <span className="bg-purple-100 text-purple-800 text-xs font-semibold px-2 py-1 rounded">
                                            {hmo.category}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Selected HMO Dashboard */}
                    {selectedHMO && hmoStatement && (
                        <>
                            {/* Account Summary */}
                            <div className="bg-white p-6 rounded shadow">
                                <div className="flex justify-between items-start mb-6">
                                    <div>
                                        <h2 className="text-2xl font-bold text-gray-800">{selectedHMO.name}</h2>
                                        <p className="text-gray-600">Retainership Account</p>
                                        <button
                                            onClick={() => {
                                                setSelectedHMO(null);
                                                setHmoStatement(null);
                                            }}
                                            className="text-purple-600 text-sm mt-2 hover:underline"
                                        >
                                            ← Change HMO
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setShowHMODepositModal(true)}
                                        className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 shadow-lg"
                                    >
                                        <FaPlus /> Add Deposit
                                    </button>
                                </div>

                                {/* Date Range Filter */}
                                <div className="flex gap-4 items-end mb-6 bg-gray-50 p-4 rounded border">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">Start Date</label>
                                        <input
                                            type="date"
                                            value={statementStartDate}
                                            onChange={(e) => setStatementStartDate(e.target.value)}
                                            className="border p-2 rounded text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1">End Date</label>
                                        <input
                                            type="date"
                                            value={statementEndDate}
                                            onChange={(e) => setStatementEndDate(e.target.value)}
                                            className="border p-2 rounded text-sm"
                                        />
                                    </div>
                                    <button
                                        onClick={() => fetchHMOStatement(selectedHMO._id)}
                                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-sm font-semibold h-10"
                                    >
                                        Filter Statement
                                    </button>
                                    <button
                                        onClick={() => {
                                            setStatementStartDate('');
                                            setStatementEndDate('');
                                            fetchHMOStatement(selectedHMO._id);
                                        }}
                                        className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 text-sm font-semibold h-10"
                                    >
                                        Clear
                                    </button>
                                    <div className="flex-1 text-right">
                                        <button
                                            onClick={() => {
                                                const printWindow = window.open('', '', 'width=800,height=600');
                                                printWindow.document.write(`
                                                    <html>
                                                        <head>
                                                            <title>Retainership Statement - ${selectedHMO.name}</title>
                                                            <style>
                                                                body { font-family: sans-serif; padding: 20px; }
                                                                .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                                                                .hmo-info { margin-bottom: 20px; }
                                                                .summary-box { display: flex; justify-content: space-between; margin-bottom: 30px; background: #f9f9f9; padding: 15px; border: 1px solid #ddd; }
                                                                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                                                                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                                                                th { background-color: #f2f2f2; }
                                                                .credit { color: green; }
                                                                .debit { color: red; }
                                                                .text-right { text-align: right; }
                                                            </style>
                                                        </head>
                                                        <body>
                                                              <div class="header">
                                                                ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                                                                <h1 style="margin: 0 0 5px 0;">${systemSettings?.reportHeader || 'SUD EMR'}</h1>
                                                                <p style="margin: 5px 0; font-size: 14px;">${systemSettings?.address || ''}</p>
                                                                <p style="margin: 2px 0; font-size: 12px;">
                                                                    ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                                                                    ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                                                                    ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                                                                </p>
                                                                <h2>Retainership Account Statement</h2>
                                                                ${statementStartDate && statementEndDate ? `<p>Period: ${new Date(statementStartDate).toLocaleDateString()} to ${new Date(statementEndDate).toLocaleDateString()}</p>` : ''}
                                                            </div>
                                                            
                                                            <div class="hmo-info">
                                                                <h3>${selectedHMO.name}</h3>
                                                                <p>Category: ${selectedHMO.category}</p>
                                                                <p>Contact: ${selectedHMO.contactPerson || 'N/A'}</p>
                                                            </div>

                                                            <div class="summary-box">
                                                                <div><strong>Total Deposits:</strong> ₦${hmoStatement.summary.totalDeposits.toLocaleString()}</div>
                                                                <div><strong>Total Utilized:</strong> ₦${hmoStatement.summary.totalCharges.toLocaleString()}</div>
                                                                <div><strong>Balance:</strong> ₦${hmoStatement.summary.balance.toLocaleString()}</div>
                                                            </div>

                                                            <h3>Transaction History</h3>
                                                            <table>
                                                                <thead>
                                                                    <tr>
                                                                        <th>Date</th>
                                                                        <th>Type</th>
                                                                        <th>Patient</th>
                                                                        <th>Service Name</th>
                                                                        <th>Description</th>
                                                                        <th>Reference</th>
                                                                        <th class="text-right">Amount</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    ${hmoStatement.transactions.map(tx => `
                                                                        <tr>
                                                                            <td>${new Date(tx.date).toLocaleDateString()}</td>
                                                                            <td><strong>${tx.type}</strong></td>
                                                                            <td>${tx.patientName}</td>
                                                                            <td><strong>${tx.serviceName || 'Deposit'}</strong></td>
                                                                            <td>${tx.description || 'Service'}</td>
                                                                            <td>${tx.reference || '-'}</td>
                                                                            <td class="text-right ${tx.isCredit ? 'credit' : 'debit'}">
                                                                                ${tx.isCredit ? '+' : '-'}₦${tx.amount.toLocaleString()}
                                                                            </td>
                                                                        </tr>
                                                                    `).join('')}
                                                                </tbody>
                                                            </table>
                                                            
                                                            <p style="margin-top: 30px; font-size: 12px; text-align: center;">Generated on ${new Date().toLocaleString()}</p>
                                                        </body>
                                                    </html>
                                                `);
                                                printWindow.document.close();
                                                printWindow.print();
                                            }}
                                            className="bg-gray-800 text-white px-4 py-2 rounded hover:bg-gray-900 text-sm font-semibold h-10 flex items-center gap-2 ml-auto"
                                        >
                                            <FaPrint /> Print Statement
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="bg-green-50 p-6 rounded shadow border-l-4 border-green-500">
                                        <p className="text-green-700 text-sm font-semibold flex items-center gap-2">
                                            <FaWallet /> Total Deposits
                                        </p>
                                        <p className="text-3xl font-bold text-green-800">
                                            ₦{hmoStatement.summary.totalDeposits.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-red-50 p-6 rounded shadow border-l-4 border-red-500">
                                        <p className="text-red-700 text-sm font-semibold flex items-center gap-2">
                                            <FaFileInvoiceDollar /> Total Utilized
                                        </p>
                                        <p className="text-3xl font-bold text-red-800">
                                            ₦{hmoStatement.summary.totalCharges.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="bg-blue-50 p-6 rounded shadow border-l-4 border-blue-500">
                                        <p className="text-blue-700 text-sm font-semibold flex items-center gap-2">
                                            <FaDollarSign /> Current Balance
                                        </p>
                                        <p className={`text-3xl font-bold ${hmoStatement.summary.balance >= 0 ? 'text-blue-800' : 'text-red-600'}`}>
                                            ₦{hmoStatement.summary.balance.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Transaction History */}
                            <div className="bg-white p-6 rounded shadow">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <FaHistory /> Transaction History
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="p-3 border-b">Date</th>
                                                <th className="p-3 border-b">Type</th>
                                                <th className="p-3 border-b">Patient</th>
                                                <th className="p-3 border-b">Service Name</th>
                                                <th className="p-3 border-b">Description</th>
                                                <th className="p-3 border-b">Reference</th>
                                                <th className="p-3 border-b text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {hmoStatement.transactions.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="p-8 text-center text-gray-500">
                                                        No transactions found
                                                    </td>
                                                </tr>
                                            ) : (
                                                hmoStatement.transactions.map((tx) => (
                                                    <tr key={tx._id} className="hover:bg-gray-50">
                                                        <td className="p-3 border-b text-sm">
                                                            {new Date(tx.date).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-3 border-b">
                                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${tx.isCredit ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                                }`}>
                                                                {tx.type}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 border-b font-semibold text-gray-700">
                                                            {tx.patientName}
                                                        </td>
                                                        <td className="p-3 border-b text-sm font-bold text-blue-700">
                                                            {tx.serviceName || 'Deposit'}
                                                        </td>
                                                        <td className="p-3 border-b text-sm text-gray-600">
                                                            {tx.description}
                                                        </td>
                                                        <td className="p-3 border-b text-sm text-gray-500">
                                                            {tx.reference || '-'}
                                                        </td>
                                                        <td className={`p-3 border-b text-right font-bold ${tx.isCredit ? 'text-green-600' : 'text-red-600'
                                                            }`}>
                                                            {tx.isCredit ? '+' : '-'}₦{tx.amount.toLocaleString()}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}

                    {/* HMO Deposit Modal */}
                    {showHMODepositModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-lg w-96">
                                <h3 className="text-xl font-bold mb-4">Add Retainership Deposit</h3>
                                <form onSubmit={handleAddHMODeposit}>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 mb-2">Amount (₦)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={hmoDepositAmount}
                                            onChange={(e) => setHmoDepositAmount(e.target.value)}
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 mb-2">Description</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={hmoDepositDescription}
                                            onChange={(e) => setHmoDepositDescription(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 mb-2">Reference (e.g., Check #)</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded"
                                            value={hmoDepositReference}
                                            onChange={(e) => setHmoDepositReference(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowHMODepositModal(false)}
                                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                                        >
                                            Add Deposit
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
};

export default BillingDashboard;
