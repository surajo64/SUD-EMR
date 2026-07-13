import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaDollarSign, FaFileInvoiceDollar, FaCheckCircle, FaUndo, FaWallet, FaPrint, FaSearch, FaUser, FaExclamationTriangle, FaBuilding, FaHistory, FaPlus, FaEdit, FaTrash, FaReceipt, FaUsers, FaArrowCircleDown, FaClock } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';
import { formatAge } from '../utils/patientUtils';
import { formatCurrency, formatCompactNumber } from '../utils/formatters';

const BillingDashboard = () => {
    const [loading, setLoading] = useState(false);
    const [invoices, setInvoices] = useState([]);
    const [receipts, setReceipts] = useState([]);
    const [patients, setPatients] = useState([]);
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [depositPaymentMethod, setDepositPaymentMethod] = useState('cash');
    const [activeTab, setActiveTab] = useState('invoices');
    const [selectedInsuranceInvoices, setSelectedInsuranceInvoices] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [showPatientSearch, setShowPatientSearch] = useState(false);
    const [patientSearchTerm, setPatientSearchTerm] = useState('');
    const [viewingPatient, setViewingPatient] = useState(null);
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundAmount, setRefundAmount] = useState('');
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
    const [hmoCurrentPage, setHmoCurrentPage] = useState(1);
    const hmoItemsPerPage = 10;

    const [showReverseModal, setShowReverseModal] = useState(false);
    const [reversingReceipt, setReversingReceipt] = useState(null);
    const [selectedChargesToReverse, setSelectedChargesToReverse] = useState([]);

    const [systemSettings, setSystemSettings] = useState(null);

    const [patientStatementStartDate, setPatientStatementStartDate] = useState('');
    const [patientStatementEndDate, setPatientStatementEndDate] = useState('');

    const [totalRetainershipBalance, setTotalRetainershipBalance] = useState(0);

    const [showHMOEditModal, setShowHMOEditModal] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [editAmount, setEditAmount] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [editReference, setEditReference] = useState('');
    const [editDate, setEditDate] = useState('');

    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const { data } = await axios.get(`${backendUrl}/api/settings`);
                setSystemSettings(data);
            } catch (error) {
                console.error('Error fetching system settings:', error);
            }
        };
        fetchSystemSettings();
        fetchInvoices();
        fetchPatients();
        fetchReceipts();
        fetchRetainershipHMOs();
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
            const { data } = await axios.get(`${backendUrl}/api/invoices`, config);
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
            const { data } = await axios.get(`${backendUrl}/api/patients`, config);
            setPatients(data);
            fetchTotalRetainershipBalance();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTotalRetainershipBalance = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/hmo-transactions/total-retainership-balance`, config);
            setTotalRetainershipBalance(data.balance || 0);
        } catch (error) {
            console.error('Error fetching total retainership balance:', error);
        }
    };

    const handleEditTransaction = (tx) => {
        setEditingTransaction(tx);
        setEditAmount(tx.amount);
        setEditDescription(tx.description);
        setEditReference(tx.reference || '');
        setEditDate(new Date(tx.date).toISOString().split('T')[0]);
        setShowHMOEditModal(true);
    };

    const handleUpdateHMOTransaction = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`${backendUrl}/api/hmo-transactions/${editingTransaction._id}`, {
                amount: Number(editAmount),
                description: editDescription,
                reference: editReference,
                date: editDate
            }, config);

            toast.success('Transaction updated successfully');
            setShowHMOEditModal(false);
            fetchHMOStatement(selectedHMO._id);
            fetchTotalRetainershipBalance();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error updating transaction');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTransaction = async (tx) => {
        if (!window.confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/hmo-transactions/${tx._id}`, config);
            toast.success('Transaction deleted');
            fetchHMOStatement(selectedHMO._id);
            fetchTotalRetainershipBalance();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error deleting transaction');
        } finally {
            setLoading(false);
        }
    };

    const fetchReceipts = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/receipts/with-claim-status`, config);
            setReceipts(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching receipts');
        } finally {
            setLoading(false);
        }
    };

    // --- Retainership Billing Functions ---

    const fetchRetainershipHMOs = async (term = '') => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/hmos?active=true`, config);

            const filtered = data.filter(h =>
                h.category === 'Retainership' &&
                (!term || h.name.toLowerCase().includes(term.toLowerCase()))
            );

            setRetainershipHMOs(filtered);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching HMOs');
        } finally {
            setLoading(false);
        }
    };

    const searchRetainershipHMOs = () => {
        fetchRetainershipHMOs(retainershipSearchTerm);
        setHmoCurrentPage(1);
    };

    const handleSelectHMO = async (hmo) => {
        setSelectedHMO(hmo);
        fetchHMOStatement(hmo._id);
    };

    const fetchHMOStatement = async (hmoId) => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            let url = `${backendUrl}/api/hmo-transactions/statement/${hmoId}`;
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
            await axios.post(`${backendUrl}/api/hmo-transactions/deposit`, {
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
            fetchTotalRetainershipBalance();
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
            await axios.post(`${backendUrl}/api/patients/${selectedPatient}/deposit`,
                { 
                    amount: parseFloat(depositAmount),
                    paymentMethod: depositPaymentMethod
                }, config);
            toast.success('Deposit added successfully!');
            setShowDepositModal(false);
            setDepositAmount('');
            setDepositPaymentMethod('cash');
            setSelectedPatient(null);
            fetchPatients();
            fetchReceipts();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error adding deposit');
        } finally {
            setLoading(false);
        }
    };

    const handleRefundDeposit = async (e) => {
        e.preventDefault();
        if (!refundAmount || isNaN(refundAmount) || Number(refundAmount) <= 0) {
            toast.error('Please enter a valid amount');
            return;
        }

        if (Number(refundAmount) > (viewingPatient?.depositBalance || 0)) {
            toast.error('Refund amount cannot exceed available balance');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post(`${backendUrl}/api/patients/${selectedPatient}/refund`, {
                amount: Number(refundAmount)
            }, config);

            toast.success('Deposit refunded successfully!');
            setShowRefundModal(false);
            setRefundAmount('');

            // Refresh patient data
            const patientRes = await axios.get(`${backendUrl}/api/patients/${selectedPatient}`, config);
            const depositRes = await axios.get(`${backendUrl}/api/patients/${selectedPatient}/deposit`, config);

            setViewingPatient({
                ...patientRes.data,
                depositBalance: depositRes.data.balance,
                lowDepositThreshold: depositRes.data.threshold
            });

            fetchPatients();
            fetchReceipts();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error processing refund');
        } finally {
            setLoading(false);
        }
    };

    const handleViewPatientDetails = async (patient) => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const depositRes = await axios.get(`${backendUrl}/api/patients/${patient._id}/deposit`, config);
            setViewingPatient({ ...patient, depositBalance: depositRes.data.balance, lowDepositThreshold: depositRes.data.threshold });
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patient details');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintPatientStatement = (patient) => {
        let patientReceipts = receipts.filter(r => r.patient?._id === patient._id);

        // Apply date filter if selected
        if (patientStatementStartDate) {
            patientReceipts = patientReceipts.filter(r => {
                const dateVal = r.createdAt || r.paymentDate;
                if (!dateVal) return false;
                try {
                    return new Date(dateVal).toISOString().split('T')[0] >= patientStatementStartDate;
                } catch (e) {
                    return false;
                }
            });
        }
        if (patientStatementEndDate) {
            patientReceipts = patientReceipts.filter(r => {
                const dateVal = r.createdAt || r.paymentDate;
                if (!dateVal) return false;
                try {
                    return new Date(dateVal).toISOString().split('T')[0] <= patientStatementEndDate;
                } catch (e) {
                    return false;
                }
            });
        }

        const totalSpent = patientReceipts
            .filter(r => r.paymentMethod !== 'deposit')
            .reduce((sum, r) => sum + r.amountPaid, 0);

        const printWindow = window.open('', '', 'width=900,height=800');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Patient Statement - ${patient.name}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
                        
                        body { 
                            font-family: 'Roboto', sans-serif; 
                            color: #333; 
                            margin: 0; 
                            padding: 40px; 
                            font-size: 14px;
                            -webkit-print-color-adjust: exact;
                        }

                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }

                        .header { 
                            text-align: center;
                            border-bottom: 3px solid #1a365d; 
                            padding-bottom: 20px; 
                            margin-bottom: 30px; 
                        }

                        .hospital-info {
                            margin-bottom: 15px;
                        }
                        
                        .hospital-info img { 
                            height: 100px;
                            width: auto;
                            object-fit: contain;
                            margin: 0 auto 15px auto;
                            display: block;
                        }

                        .hospital-info h1 {
                            font-size: 28px;
                            font-weight: 800;
                            margin: 0 0 5px 0;
                            color: #1a365d;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }

                        .hospital-info .address {
                            font-size: 15px; 
                            color: #333;
                            margin-bottom: 5px;
                            font-weight: 500;
                        }

                        .hospital-info .contact {
                            font-size: 14px;
                            color: #555;
                            margin-bottom: 5px;
                        }
                        
                        .statement-title-section {
                            margin-top: 25px;
                            border-top: 1px solid #eee;
                            padding-top: 15px;
                        }

                        .statement-title-section h2 {
                            font-size: 24px;
                            font-weight: 700;
                            color: #333;
                            margin: 0 0 10px 0;
                            text-transform: uppercase;
                        }

                        .statement-meta {
                            font-size: 14px;
                            color: #333;
                            font-weight: 500;
                        }

                        .spacer { margin: 0 5px; color: #ccc; }

                        .hospital-info img { 
                            height: 80px; 
                            width: auto; 
                            object-fit: contain; 
                            margin-bottom: 10px;
                        }

                        .hospital-info h1 {
                            font-size: 22px;
                            font-weight: 700;
                            margin: 0;
                            color: #1a365d;
                            text-transform: uppercase;
                        }

                        .hospital-info p {
                            margin: 4px 0;
                            font-size: 12px;
                            color: #555;
                        }

                        .statement-title { 
                            text-align: right; 
                        }

                        .statement-title h2 {
                            font-size: 28px;
                            font-weight: 300;
                            color: #1a365d;
                            margin: 0 0 10px 0;
                            text-transform: uppercase;
                            letter-spacing: 1px;
                        }

                        .statement-meta {
                            text-align: right;
                            font-size: 13px;
                            color: #555;
                        }

                        .statement-meta div {
                            margin-bottom: 5px;
                        }

                        .patient-section {
                            background-color: #f8f9fa;
                            border-left: 5px solid #1a365d;
                            padding: 20px;
                            border-radius: 4px;
                            margin-bottom: 40px;
                            display: flex;
                            justify-content: space-between;
                        }

                        .patient-details h3 {
                            font-size: 14px;
                            text-transform: uppercase;
                            color: #666;
                            margin: 0 0 15px 0;
                            border-bottom: 1px solid #ddd;
                            padding-bottom: 5px;
                            width: 100%;
                        }

                        .info-grid {
                            display: grid;
                            grid-template-columns: auto 1fr;
                            gap: 8px 20px;
                        }

                        .info-label {
                            font-weight: 600;
                            color: #555;
                        }

                        .info-value {
                            color: #000;
                            font-weight: 500;
                        }

                        table {
                            width: 100%;
                            border-collapse: collapse;
                            margin-bottom: 30px;
                        }

                        th {
                            background-color: #1a365d;
                            color: white;
                            text-align: left;
                            padding: 12px 15px;
                            font-weight: 500;
                            font-size: 13px;
                            text-transform: uppercase;
                        }

                        td {
                            padding: 12px 15px;
                            border-bottom: 1px solid #eee;
                            color: #444;
                        }

                        tr:nth-child(even) {
                            background-color: #f8f9fa;
                        }

                        .text-right { text-align: right; }
                        .text-center { text-align: center; }
                        .font-bold { font-weight: 700; }

                        .summary-section {
                            display: flex;
                            justify-content: flex-end;
                            margin-top: 20px;
                        }

                        .summary-box {
                            width: 300px;
                            background-color: #fdfdfd;
                            border: 1px solid #eee;
                            border-radius: 4px;
                            padding: 20px;
                        }

                        .summary-row {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 10px;
                            font-size: 14px;
                        }

                        .summary-row.total {
                            border-top: 2px solid #333;
                            padding-top: 15px;
                            margin-top: 15px;
                            font-weight: 700;
                            font-size: 16px;
                            color: #1a365d;
                        }

                        .footer {
                            margin-top: 60px;
                            text-align: center;
                            font-size: 11px;
                            color: #888;
                            border-top: 1px solid #eee;
                            padding-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div class="hospital-info">
                            ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" alt="Logo" />` : ''}
                            <h1>${systemSettings?.reportHeader || 'MedKare EMR SYSTEM'}</h1>
                            <div class="address">${systemSettings?.address || ''}</div>
                            <div class="contact">
                                ${systemSettings?.phone ? `Tel: ${systemSettings.phone}` : ''} 
                                ${systemSettings?.phone && systemSettings?.email ? '<span class="spacer">|</span>' : ''} 
                                ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                            </div>
                        </div>
                        
                        <div class="statement-title-section">
                            <h2>Statement of Account</h2>
                            <div class="statement-meta">
                                <div>Date Range: ${patientStatementStartDate || 'Beginning'} - ${patientStatementEndDate || 'Present'}</div>
                                <div>Print Date: ${new Date().toLocaleDateString()}</div>
                                <div>Generated By: Cashier ${user.name}</div>
                            </div>
                        </div>
                    </div>
                    <div class="patient-section">
                        <div style="flex: 1; padding-right: 40px;">
                            <div class="patient-details">
                                <h3>Patient Information</h3>
                                <div class="info-grid">
                                    <span class="info-label">Name:</span>
                                    <span class="info-value" style="font-size: 16px;">${patient.name}</span>
                                    
                                    <span class="info-label">MRN:</span>
                                    <span class="info-value">${patient.mrn}</span>
                                    
                                    <span class="info-label">Gender / Age:</span>
                                    <span class="info-value" style="text-transform: capitalize;">${patient.gender} / ${formatAge(patient.age)}</span>
                                </div>
                            </div>
                        </div>
                        <div style="flex: 1;">
                            <div class="patient-details">
                                <h3>Account Summary</h3>
                                <div class="info-grid">
                                    <span class="info-label">Wallet Balance:</span>
                                    <span class="info-value" style="color: ${(patient.depositBalance || 0) < 0 ? '#e53e3e' : '#2f855a'}; font-size: 16px;">
                                        ₦${(patient.depositBalance || 0).toLocaleString()}
                                    </span>

                                    <span class="info-label">Last Activity:</span>
                                    <span class="info-value">${patientReceipts.length > 0 ? new Date(patientReceipts[0].createdAt).toLocaleDateString() : 'N/A'}</span>
                                    
                                    <span class="info-label">Contact:</span>
                                    <span class="info-value">${patient.contact || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Receipt #</th>
                                <th>Description / Services</th>
                                <th>Method</th>
                                <th class="text-right">Amount Paid</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${patientReceipts.map(r => `
                                <tr>
                                    <td>${new Date(r.createdAt).toLocaleDateString()}</td>
                                    <td><span style="font-family: monospace; background: #eee; padding: 2px 5px; border-radius: 3px;">${r.receiptNumber}</span></td>
                                    <td>
                                        ${r.receiptNumber?.startsWith('DEP-') ? 'Patient Deposit' : (r.receiptNumber?.startsWith('RFD-') ? '<span style="color: #e53e3e; font-weight: bold;">Deposit Refund</span>' : (r.charges?.map(c => c.itemName || c.charge?.name || 'Service').join(', ') || 'Payment on Account'))}
                                    </td>
                                    <td style="text-transform: capitalize;">${r.paymentMethod}</td>
                                    <td class="text-right font-bold ${r.amountPaid < 0 ? 'text-red-600' : ''}">
                                        ${r.amountPaid < 0 ? `-₦${Math.abs(r.amountPaid).toLocaleString()}` : `₦${r.amountPaid.toLocaleString()}`}
                                    </td>
                                </tr>
                            `).join('')}
                            ${patientReceipts.length === 0 ? '<tr><td colspan="5" class="text-center" style="padding: 30px; color: #888;">No transaction history found for this patient.</td></tr>' : ''}
                        </tbody>
                    </table>

                    <div class="summary-section">
                        <div class="summary-box">
                            <div class="summary-row">
                                <span>Total Transactions:</span>
                                <span>${patientReceipts.length}</span>
                            </div>
                            <div class="summary-row">
                                <span>Total Paid:</span>
                                <span style="color: #2f855a;">₦${totalSpent.toLocaleString()}</span>
                            </div>
                            <!-- 
                            <div class="summary-row">
                                <span>Total Billed:</span>
                                <span>₦0.00</span>
                            </div> 
                            -->
                            <div class="summary-row total">
                                <span>Current Wallet Balance:</span>
                                <span>₦${(patient.depositBalance || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>Thank you for choosing ${systemSettings?.reportHeader || 'SUD EMR Medical Center'}.</p>
                        <p>For billing inquiries, please contact our accounts department.</p>
                        <p style="margin-top: 10px; font-style: italic;">This is a computer-generated document and does not require a signature.</p>
                    </div>

                    <script>
                        window.onload = function() { window.print(); }
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handleReverseReceipt = (receipt) => {
        setReversingReceipt(receipt);
        // Pre-select all charges by default
        setSelectedChargesToReverse(receipt.charges?.map(c => c._id) || []);
        setShowReverseModal(true);
    };

    const confirmReverseReceipt = async () => {
        if (selectedChargesToReverse.length === 0) {
            toast.error('Please select at least one item to reverse');
            return;
        }

        const isFullReversal = selectedChargesToReverse.length === reversingReceipt.charges.length;
        const confirmMsg = isFullReversal
            ? 'Are you sure you want to reverse this entire payment?'
            : `Are you sure you want to reverse ${selectedChargesToReverse.length} selected item(s)?`;

        if (!window.confirm(confirmMsg)) {
            return;
        }

        const returnDetails = reversingReceipt.charges
            .filter(c => selectedChargesToReverse.includes(c._id) && c.returnQty > 0)
            .map(c => ({
                chargeId: c._id,
                quantity: c.returnQty
            }));

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post(`${backendUrl}/api/receipts/${reversingReceipt._id}/reverse`, {
                chargeIds: selectedChargesToReverse,
                returnDetails
            }, config);

            toast.success(isFullReversal ? 'Payment reversed successfully!' : 'Selected items reversed successfully!');
            setShowReverseModal(false);
            setReversingReceipt(null);
            setSelectedChargesToReverse([]);
            fetchReceipts();
            fetchPatients(); // In case deposit balance changed
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
                    <div class="info-row"><span>${receipt.familyFile ? 'Family' : 'Patient'}:</span> <strong>${receipt.patient?.name || receipt.familyFile?.familyName || 'N/A'}</strong></div>
                    <div class="info-row"><span>${receipt.familyFile ? 'File #' : 'MRN'}:</span> <span>${receipt.patient?.mrn || receipt.familyFile?.fileNumber || 'N/A'}</span></div>
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
                            ${receipt.familyFile ? `
                                <tr>
                                    <td>Family Registration</td>
                                    <td style="text-align: right;">₦${receipt.amountPaid.toFixed(2)}</td>
                                </tr>
                            ` : (receipt.charges?.map(c => `
                                <tr>
                                    <td>
                                        ${c.itemName || c.charge?.name || 'Service'} 
                                        ${c.quantity > 1 ? `(x${c.quantity})` : ''}
                                    </td>
                                    <td style="text-align: right;">₦${c.totalAmount.toFixed(2)}</td>
                                </tr>
                            `).join('') || `
                                <tr>
                                    <td>${receipt.receiptNumber?.startsWith('DEP-') ? 'Patient Deposit' : (receipt.receiptNumber?.startsWith('RFD-') ? 'Deposit Refund' : 'Payment on Account')}</td>
                                    <td style="text-align: right;">
                                        ${receipt.amountPaid < 0 ? `-₦${Math.abs(receipt.amountPaid).toFixed(2)}` : `₦${receipt.amountPaid.toFixed(2)}`}
                                    </td>
                                </tr>
                            `)}
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

    const totalPatientDeposits = patients.reduce((sum, p) => sum + (p.depositBalance || 0), 0);

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
                            <FaSearch /> Patient Wallet
                        </button>
                        {user.role !== 'readonly_admin' && (
                            <button
                                onClick={() => setShowDepositModal(true)}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                            >
                                <FaWallet /> Add Deposit
                            </button>
                        )}
                    </div>
                )}
            </div>

            {activeTab === 'invoices' ? (
                <>

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
                                                placeholder="Name, MRN or Phone..."
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
                                                    (p.mrn && p.mrn.toLowerCase().includes(depositSearchTerm.toLowerCase())) ||
                                                    (p.contact && p.contact.includes(depositSearchTerm))
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
                                                 className="w-full border p-2 rounded mb-4"
                                                 value={depositAmount}
                                                 onChange={(e) => setDepositAmount(e.target.value)}
                                                 required
                                                 min="0"
                                                 autoFocus
                                             />
                                             <label className="block text-gray-700 mb-2">Payment Method</label>
                                             <select
                                                 className="w-full border p-2 rounded bg-white"
                                                 value={depositPaymentMethod}
                                                 onChange={(e) => setDepositPaymentMethod(e.target.value)}
                                             >
                                                 <option value="cash">Cash</option>
                                                 <option value="card">Card</option>
                                             </select>
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

                    {/* Refund Modal */}
                    {showRefundModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
                            <div className="bg-white p-6 rounded-lg shadow-xl w-[400px]">
                                <h3 className="text-xl font-bold mb-4">Refund Patient Deposit</h3>
                                <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded text-sm text-orange-800">
                                    Available Balance: <strong>₦{(viewingPatient?.depositBalance || 0).toLocaleString()}</strong>
                                </div>
                                <form onSubmit={handleRefundDeposit}>
                                    <div className="mb-4">
                                        <label className="block text-sm font-semibold mb-1">Refund Amount (₦)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={refundAmount}
                                            onChange={(e) => setRefundAmount(e.target.value)}
                                            placeholder="Enter amount to refund"
                                            max={viewingPatient?.depositBalance || 0}
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setShowRefundModal(false)}
                                            className="flex-1 bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 font-bold"
                                        >
                                            Process Refund
                                        </button>
                                    </div>
                                </form>
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
                                    placeholder="Search by Name, MRN or Phone..."
                                    className="w-full border p-2 rounded mb-4"
                                    value={patientSearchTerm}
                                    onChange={(e) => setPatientSearchTerm(e.target.value)}
                                />
                                <div className="space-y-2 mb-4">
                                    {patients
                                        .filter(p =>
                                            p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
                                            (p.mrn && p.mrn.toLowerCase().includes(patientSearchTerm.toLowerCase())) ||
                                            (p.contact && p.contact.includes(patientSearchTerm))
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
                                                    MRN: {patient.mrn} | Age: {formatAge(patient.age)} | {patient.gender}
                                                </p>
                                            </div>
                                        ))}
                                    {patients.filter(p =>
                                        p.name.toLowerCase().includes(patientSearchTerm.toLowerCase()) ||
                                        (p.mrn && p.mrn.toLowerCase().includes(patientSearchTerm.toLowerCase())) ||
                                        (p.contact && p.contact.includes(patientSearchTerm))
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
                                            <p className="font-semibold">{formatAge(viewingPatient.age)} / {viewingPatient.gender}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-600">Contact</p>
                                            <p className="font-semibold">{viewingPatient.contact || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const patientReceipts = receipts.filter(r => r.patient?._id === viewingPatient._id);
                                    
                                    const totalDeposits = patientReceipts
                                        .filter(r => r.receiptNumber?.startsWith('DEP-'))
                                        .reduce((sum, r) => sum + r.amountPaid, 0);

                                    const totalUtilized = patientReceipts
                                        .filter(r => r.paymentMethod === 'deposit')
                                        .reduce((sum, r) => sum + r.amountPaid, 0);

                                    const currentBalance = viewingPatient.depositBalance || 0;

                                    const walletTransactions = receipts
                                        .filter(r => r.patient?._id === viewingPatient._id && (
                                            r.receiptNumber?.startsWith('DEP-') || 
                                            r.paymentMethod === 'deposit' || 
                                            r.paymentMethod === 'refund'
                                        ))
                                        .map(r => {
                                            let type = 'Deposit';
                                            let amountClass = 'text-green-600 font-semibold text-right';
                                            let displayAmount = `+₦${r.amountPaid.toLocaleString()}`;
                                            let desc = `Deposit added via ${r.paymentMethod || 'cash'}`;

                                            if (r.paymentMethod === 'deposit') {
                                                type = 'Utilization';
                                                amountClass = 'text-red-600 font-semibold text-right';
                                                displayAmount = `-₦${r.amountPaid.toLocaleString()}`;
                                                const serviceNames = r.charges && r.charges.length > 0 
                                                    ? r.charges.map(c => c.itemName || c.charge?.name).filter(Boolean).join(', ')
                                                    : '';
                                                desc = serviceNames || r.notes || 'Payment for services';
                                            } else if (r.paymentMethod === 'refund') {
                                                type = 'Refund';
                                                amountClass = 'text-orange-600 font-semibold text-right';
                                                displayAmount = `-₦${Math.abs(r.amountPaid).toLocaleString()}`;
                                                desc = r.notes || 'Deposit refunded';
                                            }

                                            return {
                                                id: r._id,
                                                date: r.createdAt || r.paymentDate,
                                                type,
                                                description: desc,
                                                amount: displayAmount,
                                                amountClass,
                                                cashier: r.cashier?.name || 'N/A'
                                            };
                                        })
                                        .sort((a, b) => new Date(b.date) - new Date(a.date));

                                    const last5Transactions = walletTransactions.slice(0, 5);

                                    return (
                                        <>
                                            {/* Wallet Balance Cards (3-column layout matching retainership style) */}
                                            <div className="grid grid-cols-3 gap-3 mb-5">
                                                <div className="bg-green-50 border border-green-200 p-4 rounded-lg shadow-sm">
                                                    <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">Total Deposits</p>
                                                    <p className="text-xl font-bold text-green-800">
                                                        ₦{totalDeposits.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="bg-red-50 border border-red-200 p-4 rounded-lg shadow-sm">
                                                    <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">Total Utilized</p>
                                                    <p className="text-xl font-bold text-red-800">
                                                        ₦{totalUtilized.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg shadow-sm relative">
                                                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Current Balance</p>
                                                    <div className="flex justify-between items-center">
                                                        <p className="text-xl font-bold text-blue-800">
                                                            ₦{currentBalance.toLocaleString()}
                                                        </p>
                                                        {currentBalance < (viewingPatient.lowDepositThreshold || 5000) && (
                                                            <span className="text-yellow-600 text-[10px] flex items-center gap-1 font-bold animate-pulse">
                                                                <FaExclamationTriangle /> Low
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Wallet Transaction History Table */}
                                            <div className="mb-5 bg-white p-4 border rounded-lg shadow-sm">
                                                <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                                                    <FaHistory className="text-blue-600" /> Wallet Transaction History (Last 5)
                                                </h4>
                                                {last5Transactions.length === 0 ? (
                                                    <p className="text-xs text-gray-500 bg-gray-50 p-4 rounded border text-center font-medium">No wallet activity recorded yet.</p>
                                                ) : (
                                                    <div className="overflow-x-auto border rounded-md">
                                                        <table className="w-full text-xs text-left text-gray-600 border-collapse">
                                                            <thead className="bg-gray-50 text-gray-700 border-b uppercase text-[9px] tracking-wider font-semibold">
                                                                <tr>
                                                                    <th className="p-2 border-r font-semibold">Date</th>
                                                                    <th className="p-2 border-r font-semibold">Type</th>
                                                                    <th className="p-2 border-r font-semibold">Description</th>
                                                                    <th className="p-2 border-r font-semibold">Cashier</th>
                                                                    <th className="p-2 text-right font-semibold">Amount</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {last5Transactions.map((tx) => (
                                                                    <tr key={tx.id} className="border-b hover:bg-gray-50 bg-white">
                                                                        <td className="p-2 border-r text-gray-500">{new Date(tx.date).toLocaleDateString()}</td>
                                                                        <td className="p-2 border-r">
                                                                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                                                                tx.type === 'Deposit' ? 'bg-green-100 text-green-800' :
                                                                                tx.type === 'Utilization' ? 'bg-red-100 text-red-800' :
                                                                                'bg-orange-100 text-orange-800'
                                                                            }`}>
                                                                                {tx.type}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-2 border-r truncate max-w-[200px]" title={tx.description}>{tx.description}</td>
                                                                        <td className="p-2 border-r text-gray-500">{tx.cashier}</td>
                                                                        <td className={`p-2 ${tx.amountClass}`}>{tx.amount}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    );
                                })()}

                                <div class="bg-gray-50 p-4 rounded mb-4 border border-gray-200">
                                    <h4 className="font-bold mb-3 text-sm text-gray-700 uppercase tracking-wider">Statement Date Range (Optional)</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">Start Date</label>
                                            <input
                                                type="date"
                                                value={patientStatementStartDate}
                                                onChange={(e) => setPatientStatementStartDate(e.target.value)}
                                                className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">End Date</label>
                                            <input
                                                type="date"
                                                value={patientStatementEndDate}
                                                onChange={(e) => setPatientStatementEndDate(e.target.value)}
                                                className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>
                                    {(patientStatementStartDate || patientStatementEndDate) && (
                                        <button
                                            onClick={() => {
                                                setPatientStatementStartDate('');
                                                setPatientStatementEndDate('');
                                            }}
                                            className="mt-2 text-xs text-blue-600 hover:underline font-medium"
                                        >
                                            Clear Date Range
                                        </button>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handlePrintPatientStatement(viewingPatient)}
                                        className="flex-1 bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center justify-center gap-2 shadow-sm transition-all"
                                    >
                                        <FaPrint /> Print Statement
                                    </button>
                                    {(user?.role === 'admin' || user?.role === 'super_admin') && user?.role !== 'readonly_admin' && (
                                        <button
                                            onClick={() => {
                                                setSelectedPatient(viewingPatient._id);
                                                setShowRefundModal(true);
                                                setRefundAmount('');
                                                // Keep viewingPatient for context in the refund modal
                                            }}
                                            disabled={(viewingPatient.depositBalance || 0) <= 0}
                                            className={`flex-1 px-4 py-2 rounded flex items-center justify-center gap-2 ${(viewingPatient.depositBalance || 0) <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-orange-600 text-white hover:bg-orange-700'}`}
                                        >
                                            <FaUndo /> Refund
                                        </button>
                                    )}
                                    {user.role !== 'readonly_admin' && (
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
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Selective Reversal Modal */}
                    {showReverseModal && reversingReceipt && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-lg w-[600px] max-h-[80vh] flex flex-col">
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <FaUndo className="text-red-600" /> Reverse Payment
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            Receipt: <span className="font-mono font-bold">{reversingReceipt.receiptNumber}</span> |
                                            Patient: <span className="font-bold">{reversingReceipt.patient?.name || reversingReceipt.familyFile?.familyName || 'N/A'}</span>
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setShowReverseModal(false);
                                            setReversingReceipt(null);
                                        }}
                                        className="text-gray-500 hover:text-gray-700 text-2xl"
                                    >
                                        ×
                                    </button>
                                </div>

                                <div className="bg-blue-50 p-3 rounded mb-4 text-sm text-blue-700 flex items-center gap-2">
                                    <FaExclamationTriangle />
                                    <span>Select the items you want to reverse. For pharmacy items, you can also select the quantity to return to inventory.</span>
                                </div>

                                <div className="flex-1 overflow-y-auto mb-4 border rounded">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-100 sticky top-0">
                                            <tr>
                                                <th className="p-3 border-b">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedChargesToReverse.length === reversingReceipt.charges?.length}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedChargesToReverse(reversingReceipt.charges?.map(c => c._id) || []);
                                                            } else {
                                                                setSelectedChargesToReverse([]);
                                                            }
                                                        }}
                                                        className="w-4 h-4 rounded text-blue-600"
                                                    />
                                                </th>
                                                <th className="p-3 border-b text-sm font-bold uppercase">Item / Service</th>
                                                <th className="p-3 border-b text-sm font-bold uppercase text-center">Return Qty</th>
                                                <th className="p-3 border-b text-sm font-bold uppercase text-right">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reversingReceipt.charges?.map((item) => (
                                                <tr key={item._id} className="hover:bg-gray-50">
                                                    <td className="p-3 border-b">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedChargesToReverse.includes(item._id)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setSelectedChargesToReverse([...selectedChargesToReverse, item._id]);
                                                                } else {
                                                                    setSelectedChargesToReverse(selectedChargesToReverse.filter(id => id !== item._id));
                                                                }
                                                            }}
                                                            className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                                                        />
                                                    </td>
                                                    <td className="p-3 border-b text-sm">
                                                        <div className="font-semibold">
                                                            {item.itemName || item.charge?.name || 'Service'}
                                                            {item.quantity > 0 && <span className="text-gray-500 text-xs ml-1 font-normal">(Sold: {item.quantity})</span>}
                                                        </div>
                                                        <div className="text-[10px] text-gray-500 italic uppercase">{item.itemType || item.charge?.type || 'Other'}</div>
                                                    </td>
                                                    <td className="p-3 border-b text-sm text-center">
                                                        {(
                                                            item.itemType?.toLowerCase() === 'pharmacy' ||
                                                            item.itemType?.toLowerCase() === 'drugs' ||
                                                            item.itemType?.toLowerCase() === 'drug' ||
                                                            item.charge?.type?.toLowerCase() === 'pharmacy' ||
                                                            item.charge?.type?.toLowerCase() === 'drugs' ||
                                                            item.charge?.type?.toLowerCase() === 'drug'
                                                        ) ? (
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max={item.quantity}
                                                                className="w-16 border rounded p-1 text-center"
                                                                value={item.returnQty || 0}
                                                                onChange={(e) => {
                                                                    const val = Math.min(item.quantity, Math.max(0, parseInt(e.target.value) || 0));
                                                                    setReversingReceipt({
                                                                        ...reversingReceipt,
                                                                        charges: reversingReceipt.charges.map(c =>
                                                                            c._id === item._id ? { ...c, returnQty: val } : c
                                                                        )
                                                                    });
                                                                    // Auto-select the item if quantity is > 0
                                                                    if (val > 0 && !selectedChargesToReverse.includes(item._id)) {
                                                                        setSelectedChargesToReverse([...selectedChargesToReverse, item._id]);
                                                                    }
                                                                }}
                                                            />
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 border-b text-sm text-right font-mono font-bold">
                                                        ₦{item.totalAmount.toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                            {(!reversingReceipt.charges || reversingReceipt.charges.length === 0) && (
                                                <tr>
                                                    <td colSpan="4" className="p-4 text-center text-gray-500">
                                                        No individual items found on this receipt. Reversing will process the full amount.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="bg-gray-50 p-4 rounded-lg flex justify-between items-center border border-gray-200">
                                    <div>
                                        <p className="text-xs text-gray-500 uppercase font-bold tracking-wider">Amount to Reverse</p>
                                        <p className="text-2xl font-black text-red-600">
                                            ₦{reversingReceipt.charges?.filter(c => selectedChargesToReverse.includes(c._id)).reduce((sum, c) => {
                                                const isPharm = (
                                                    c.itemType?.toLowerCase() === 'pharmacy' ||
                                                    c.itemType?.toLowerCase() === 'drugs' ||
                                                    c.itemType?.toLowerCase() === 'drug' ||
                                                    c.charge?.type?.toLowerCase() === 'pharmacy' ||
                                                    c.charge?.type?.toLowerCase() === 'drugs' ||
                                                    c.charge?.type?.toLowerCase() === 'drug'
                                                );
                                                if (isPharm && (c.returnQty || 0) > 0) {
                                                    const unitPrice = c.unitPrice || (c.totalAmount / (c.quantity || 1));
                                                    return sum + (c.returnQty * unitPrice);
                                                }
                                                return sum + c.totalAmount;
                                            }, 0).toLocaleString() || '0'}
                                        </p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowReverseModal(false);
                                                setReversingReceipt(null);
                                            }}
                                            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-bold"
                                        >
                                            Cancel
                                        </button>
                                        {user.role !== 'readonly_admin' && (
                                            <button
                                                onClick={confirmReverseReceipt}
                                                disabled={selectedChargesToReverse.length === 0}
                                                className={`px-6 py-2 rounded-lg flex items-center gap-2 font-bold transition shadow-md ${selectedChargesToReverse.length === 0
                                                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                                    : 'bg-red-600 text-white hover:bg-red-700'
                                                    }`}
                                            >
                                                <FaUndo /> Confirm Reverse
                                            </button>
                                        )}
                                    </div>
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
                                            const dateVal = r.createdAt || r.paymentDate;
                                            if (!dateVal) return false;
                                            try {
                                                const receiptDate = new Date(dateVal).toISOString().split('T')[0];
                                                return receiptDate >= startDate && receiptDate <= endDate;
                                            } catch (e) {
                                                return false;
                                            }
                                        })
                                        .slice(0, 20)
                                        .map((receipt) => (
                                            <tr key={receipt._id} className="hover:bg-gray-50">
                                                <td className="p-3 border-b font-mono text-sm">{receipt.receiptNumber}</td>
                                                <td className="p-3 border-b font-semibold">
                                                    {receipt.patient?.name || receipt.familyFile?.familyName || 'N/A'}
                                                </td>
                                                <td className="p-3 border-b text-sm">
                                                    {receipt.familyFile ? 'Family Registration' : (receipt.receiptNumber?.startsWith('DEP-') ? 'Patient Deposit' : (receipt.receiptNumber?.startsWith('RFD-') ? 'Deposit Refund' : (receipt.charges?.map(c => c.itemName || c.charge?.name || 'Service').join(', ') || 'N/A')))}
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
                                                        {(user?.role === 'admin' || user?.role === 'super_admin') && user?.role !== 'readonly_admin' && (
                                                            <button
                                                                onClick={() => handleReverseReceipt(receipt)}
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
                                        const dateVal = r.createdAt || r.paymentDate;
                                        if (!dateVal) return false;
                                        try {
                                            const receiptDate = new Date(dateVal).toISOString().split('T')[0];
                                            return receiptDate >= startDate && receiptDate <= endDate;
                                        } catch (e) {
                                            return false;
                                        }
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
                        {!selectedHMO && (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="font-semibold text-gray-700">
                                        {retainershipSearchTerm ? `Search Results (${retainershipHMOs.length}):` : `All Retainership HMOs (${retainershipHMOs.length}):`}
                                    </p>
                                </div>

                                {retainershipHMOs.length === 0 ? (
                                    <p className="text-gray-500 text-center py-4 italic">No retainership entities found.</p>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {retainershipHMOs
                                                .slice((hmoCurrentPage - 1) * hmoItemsPerPage, hmoCurrentPage * hmoItemsPerPage)
                                                .map(hmo => (
                                                    <div
                                                        key={hmo._id}
                                                        onClick={() => handleSelectHMO(hmo)}
                                                        className="p-4 border rounded-xl hover:bg-blue-50 hover:border-blue-200 cursor-pointer flex justify-between items-center transition-all shadow-sm bg-white group"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-gray-800 group-hover:text-blue-700">{hmo.name}</p>
                                                            <p className="text-xs text-gray-500 mt-1">Contact: {hmo.contactPerson || 'N/A'}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="bg-purple-100 text-purple-800 text-[10px] font-black uppercase px-2 py-1 rounded">
                                                                {hmo.category}
                                                            </span>
                                                            <p className="text-[10px] text-gray-400 mt-1 font-mono">{hmo.code}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                        </div>

                                        {/* Pagination Controls */}
                                        {retainershipHMOs.length > hmoItemsPerPage && (
                                            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                                                <p className="text-xs text-gray-500">
                                                    Showing {(hmoCurrentPage - 1) * hmoItemsPerPage + 1} to {Math.min(hmoCurrentPage * hmoItemsPerPage, retainershipHMOs.length)} of {retainershipHMOs.length}
                                                </p>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setHmoCurrentPage(p => Math.max(1, p - 1))}
                                                        disabled={hmoCurrentPage === 1}
                                                        className="px-3 py-1 border rounded text-xs disabled:opacity-50 hover:bg-gray-50"
                                                    >
                                                        Previous
                                                    </button>
                                                    <span className="text-xs flex items-center px-2 font-bold text-gray-600">
                                                        Page {hmoCurrentPage} of {Math.ceil(retainershipHMOs.length / hmoItemsPerPage)}
                                                    </span>
                                                    <button
                                                        onClick={() => setHmoCurrentPage(p => Math.min(Math.ceil(retainershipHMOs.length / hmoItemsPerPage), p + 1))}
                                                        disabled={hmoCurrentPage === Math.ceil(retainershipHMOs.length / hmoItemsPerPage)}
                                                        className="px-3 py-1 border rounded text-xs disabled:opacity-50 hover:bg-gray-50"
                                                    >
                                                        Next
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
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
                                    {user.role !== 'readonly_admin' && (
                                        <button
                                            onClick={() => setShowHMODepositModal(true)}
                                            className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 shadow-lg"
                                        >
                                            <FaPlus /> Add Deposit
                                        </button>
                                    )}
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
                                                {(user?.role === 'admin' || user?.role === 'super_admin') && (
                                                    <th className="p-3 border-b text-center">Actions</th>
                                                )}

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
                                                        {(user?.role === 'admin' || user?.role === 'super_admin') && user?.role !== 'readonly_admin' && (
                                                            <td className="p-3 border-b text-center">
                                                                {tx.type === 'Deposit' ? (
                                                                    <div className="flex justify-center gap-2 text-sm">
                                                                        <button
                                                                            onClick={() => handleEditTransaction(tx)}
                                                                            className="text-blue-600 hover:text-blue-800"
                                                                            title="Edit Transaction"
                                                                        >
                                                                            <FaEdit />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDeleteTransaction(tx)}
                                                                            className="text-red-600 hover:text-red-800"
                                                                            title="Delete Transaction"
                                                                        >
                                                                            <FaTrash />
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-gray-300 text-[10px] font-bold">LOCKED</span>
                                                                )}
                                                            </td>
                                                        )}
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
                    {/* HMO Edit Transaction Modal */}
                    {showHMOEditModal && (
                        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-lg w-[400px] shadow-2xl">
                                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <FaEdit className="text-blue-600" /> Edit Transaction
                                </h3>
                                <div className="mb-4 text-xs bg-blue-50 p-3 rounded-lg text-blue-700 border border-blue-100 flex items-center gap-2">
                                    <FaExclamationTriangle />
                                    <span>Updating this transaction will affect the current balance.</span>
                                </div>
                                <form onSubmit={handleUpdateHMOTransaction}>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 text-sm font-semibold mb-1">Date</label>
                                        <input
                                            type="date"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editDate}
                                            onChange={(e) => setEditDate(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 text-sm font-semibold mb-1">Amount (₦)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            required
                                            min="0"
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-gray-700 text-sm font-semibold mb-1">Description</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editDescription}
                                            onChange={(e) => setEditDescription(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="mb-6">
                                        <label className="block text-gray-700 text-sm font-semibold mb-1">Reference</label>
                                        <input
                                            type="text"
                                            className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editReference}
                                            onChange={(e) => setEditReference(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex justify-end gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setShowHMOEditModal(false)}
                                            className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-bold"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md"
                                        >
                                            Save Changes
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
