import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaDollarSign, FaReceipt, FaPrint, FaSearch, FaCheckCircle, FaTrashAlt, FaUserFriends, FaHospital, FaHistory, FaClock, FaChartBar } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';
import { formatAge } from '../utils/patientUtils';
import { formatCompactNumber, formatCurrency } from '../utils/formatters';

const CashierDashboard = () => {
    const [loading, setLoading] = useState(false);


    // Patient Billing State
    const [receipts, setReceipts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [encounters, setEncounters] = useState([]);
    const [selectedEncounter, setSelectedEncounter] = useState(null);
    const [encounterCharges, setEncounterCharges] = useState([]);
    const [selectedCharges, setSelectedCharges] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [encounterPendingCharges, setEncounterPendingCharges] = useState({});
    const [summaryData, setSummaryData] = useState({
        collectedToday: 0,
        totalPendingHMO: 0,
        pendingPatientFees: 0,
        totalReceiptsToday: 0
    });

    // Family File State
    const [familySearchTerm, setFamilySearchTerm] = useState('');
    const [familyFiles, setFamilyFiles] = useState([]);
    const [selectedFamilyFile, setSelectedFamilyFile] = useState(null);

    // Retainership State
    const [retainershipSearchTerm, setRetainershipSearchTerm] = useState('');
    const [retainerships, setRetainerships] = useState([]);
    const [selectedRetainership, setSelectedRetainership] = useState(null);

    const [activeTab, setActiveTab] = useState('patient'); // 'patient', 'family', 'retainership'



    const [systemSettings, setSystemSettings] = useState(null);

    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const [userStats, setUserStats] = useState({
        collectedToday: 0,
        receiptsToday: 0,
        lifetimeRevenue: 0,
        totalReceipts: 0
    });

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
        fetchReceipts();
        fetchSummary();
        fetchUserStats();
    }, []);

    const fetchUserStats = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/reports/user-stats`, config);
            setUserStats(data);
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    // --- Patient Billing Functions ---

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

    const fetchSummary = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/financials/dashboard-summary`, config);
            setSummaryData(data);
        } catch (error) {
            console.error('Error fetching summary:', error);
        }
    };

    const searchPatients = async () => {
        if (!searchTerm) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/patients`, config);
            const filtered = data.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.mrn && p.mrn.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.contact && p.contact.includes(searchTerm))
            );
            setPatients(filtered);
        } catch (error) {
            console.error(error);
            toast.error('Error searching patients');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectPatient = async (patient) => {
        setSelectedPatient(patient);
        setSelectedEncounter(null);
        setEncounterCharges([]);
        setSelectedCharges([]);

        // Set default payment method based on deposit balance or provider
        if (patient.depositBalance > 0) {
            setPaymentMethod('deposit');
        } else if (patient.provider === 'Retainership') {
            setPaymentMethod('retainership');
        } else if (['NHIA', 'KSCHMA', 'State Scheme'].includes(patient.provider)) {
            setPaymentMethod('insurance');
        } else {
            setPaymentMethod('cash');
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/visits`, config);
            const patientEncounters = data.filter(v => v.patient && (v.patient._id === patient._id || v.patient === patient._id));
            // Sort encounters by creation date - latest first
            patientEncounters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setEncounters(patientEncounters);

            // Fetch pending charges for each encounter
            const pendingChargesMap = {};
            for (const encounter of patientEncounters) {
                try {
                    const chargesResponse = await axios.get(
                        `${backendUrl}/api/encounter-charges/encounter/${encounter._id}`,
                        config
                    );
                    const pending = chargesResponse.data.filter(c => c.status === 'pending');
                    if (pending.length > 0) {
                        const totalPending = pending.reduce((sum, c) => sum + (c.patientPortion !== undefined ? c.patientPortion : c.totalAmount), 0);
                        pendingChargesMap[encounter._id] = {
                            count: pending.length,
                            total: totalPending
                        };
                    }
                } catch (err) {
                    console.error(`Error fetching charges for encounter ${encounter._id}:`, err);
                }
            }
            setEncounterPendingCharges(pendingChargesMap);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching encounters');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectEncounter = async (encounter) => {
        setSelectedEncounter(encounter);
        setSelectedCharges([]);

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/encounter-charges/encounter/${encounter._id}`, config);
            setEncounterCharges(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching charges');
        } finally {
            setLoading(false);
        }
    };

    const handleChargeSelection = (chargeId) => {
        if (selectedCharges.includes(chargeId)) {
            setSelectedCharges(selectedCharges.filter(id => id !== chargeId));
        } else {
            setSelectedCharges([...selectedCharges, chargeId]);
        }
    };

    const handleDeleteCharge = async (chargeId) => {
        if (!window.confirm('Are you sure you want to delete this charge? This action cannot be undone.')) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/encounter-charges/${chargeId}`, config);
            toast.success('Charge deleted successfully');
            // Refresh encounter charges
            await handleSelectEncounter(selectedEncounter);
            // Refresh pending badges for this patient
            await handleSelectPatient(selectedPatient);
            // Re-select the encounter so the user stays on the charge list
            setSelectedEncounter(selectedEncounter);
            // Refresh global summary
            fetchSummary();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error deleting charge');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectPayment = async () => {
        if (selectedCharges.length === 0) {
            toast.error('Please select charges to pay');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const response = await axios.post(
                `${backendUrl}/api/receipts/encounter`,
                {
                    encounterId: selectedEncounter._id,
                    chargeIds: selectedCharges,
                    paymentMethod
                },
                config
            );
            toast.success(`Payment collected! Receipt #${response.data.receiptNumber}`);
            handlePrintReceipt(response.data);

            handleSelectEncounter(selectedEncounter);
            fetchReceipts();
            fetchSummary();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error collecting payment');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReceipt = (receipt) => {
        const printWindow = window.open('', '', 'width=600,height=600');
        if (!printWindow) {
            toast.error('Browser blocked the popup. Please allow popups for this site to print receipts.');
            return;
        }

        const isFamily = !!receipt.familyFile;
        const isHmo = !!receipt.hmo;

        let name = 'N/A';
        let idLabel = 'ID';
        let idVal = 'N/A';
        let itemLabel = 'Service';

        if (isFamily) {
            name = receipt.familyFile?.familyName || 'N/A';
            idLabel = 'File #';
            idVal = receipt.familyFile?.fileNumber || 'N/A';
            itemLabel = 'Family Registration Fee';
        } else if (isHmo) {
            name = receipt.hmo?.name || 'N/A';
            idLabel = 'Code';
            idVal = receipt.hmo?.code || 'N/A';
            itemLabel = 'Retainership Registration Fee';
        } else {
            name = receipt.patient?.name || 'N/A';
            idLabel = 'MRN';
            idVal = receipt.patient?.mrn || 'N/A';
        }

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
                    <div class="info-row"><span>${isFamily ? 'Family' : (isHmo ? 'Entity' : 'Patient')}:</span> <strong>${name}</strong></div>
                    <div class="info-row"><span>${idLabel}:</span> <span>${idVal}</span></div>
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
                            ${(isFamily || isHmo) ? `
                                <tr>
                                    <td>${itemLabel}</td>
                                    <td style="text-align: right;">₦${receipt.amountPaid.toFixed(2)}</td>
                                </tr>
                            ` : (receipt.charges?.map(c => `
                                <tr>
                                    <td>
                                        ${c.itemName || c.charge?.name || c.itemType || 'Service'} 
                                        ${c.quantity > 1 ? `(x${c.quantity})` : ''}
                                    </td>
                                    <td style="text-align: right;">₦${c.totalAmount.toFixed(2)}</td>
                                </tr>
                            `).join('') || '<tr><td colspan="2">No items</td></tr>')}
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

    // --- Family Payment Functions ---

    const searchFamilyFiles = async () => {
        if (!familySearchTerm) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/family-files?search=${familySearchTerm}`, config);
            setFamilyFiles(data);
        } catch (error) {
            console.error(error);
            toast.error('Error searching family files');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectFamilyPayment = async () => {
        if (!selectedFamilyFile) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.post(
                `${backendUrl}/api/receipts/family-file`,
                {
                    familyFileId: selectedFamilyFile._id,
                    paymentMethod
                },
                config
            );
            toast.success(`Payment collected for ${selectedFamilyFile.familyName}!`);
            handlePrintReceipt(data);
            setSelectedFamilyFile(null);
            setFamilyFiles([]);
            setFamilySearchTerm('');
            fetchReceipts();
            fetchSummary();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error collecting payment');
        } finally {
            setLoading(false);
        }
    };

    // --- Retainership Payment Functions ---

    const searchRetainerships = async () => {
        if (!retainershipSearchTerm) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/hmos`, config);
            const filtered = data.filter(h =>
                h.category === 'Retainership' && (
                    h.name.toLowerCase().includes(retainershipSearchTerm.toLowerCase()) ||
                    (h.code && h.code.toLowerCase().includes(retainershipSearchTerm.toLowerCase()))
                )
            );

            // Fetch balance for filtered retainerships
            const enriched = await Promise.all(filtered.map(async (hmo) => {
                try {
                    const balanceRes = await axios.get(`${backendUrl}/api/hmo-transactions/statement/${hmo._id}`, config);
                    return { ...hmo, balance: balanceRes.data.summary.balance };
                } catch (err) {
                    return { ...hmo, balance: 0 };
                }
            }));

            setRetainerships(enriched);
        } catch (error) {
            console.error(error);
            toast.error('Error searching retainerships');
        } finally {
            setLoading(false);
        }
    };

    const handleCollectRetainershipPayment = async () => {
        if (!selectedRetainership) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.post(
                `${backendUrl}/api/receipts/hmo-registration`,
                {
                    hmoId: selectedRetainership._id,
                    paymentMethod
                },
                config
            );
            toast.success(`Payment collected for ${selectedRetainership.name}!`);
            handlePrintReceipt(data);
            setSelectedRetainership(null);
            setRetainerships([]);
            setRetainershipSearchTerm('');
            fetchReceipts();
            fetchSummary();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error collecting payment');
        } finally {
            setLoading(false);
        }
    };

    // --- Render Helpers ---

    const totalSelectedAmount = encounterCharges
        .filter(charge => selectedCharges.includes(charge._id))
        .reduce((sum, charge) => sum + (charge.patientPortion !== undefined ? charge.patientPortion : charge.totalAmount), 0);

    return (
        <Layout>
            {loading && <LoadingOverlay />}



            {/* Tabs */}
            <div className="flex border-b mb-6 overflow-x-auto">
                <button
                    onClick={() => {
                        setActiveTab('patient');
                        setPaymentMethod('cash');
                    }}
                    className={`px-6 py-2 font-bold whitespace-nowrap ${activeTab === 'patient' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Patient Billing
                </button>
                <button
                    onClick={() => {
                        setActiveTab('family');
                        setPaymentMethod('cash');
                    }}
                    className={`px-6 py-2 font-bold whitespace-nowrap ${activeTab === 'family' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Family File Registration
                </button>
                <button
                    onClick={() => {
                        setActiveTab('retainership');
                        setPaymentMethod('deposit'); // Default for retainership
                    }}
                    className={`px-6 py-2 font-bold whitespace-nowrap ${activeTab === 'retainership' ? 'border-b-4 border-blue-600 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                    Retainership Registration
                </button>
            </div>

            {activeTab === 'patient' && (
                <div className="bg-white p-6 rounded shadow mb-6 animate-fadeIn">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FaSearch /> Find Patient & Encounter
                    </h3>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Search by Name, MRN or Phone Number..."
                            className="flex-1 border p-2 rounded"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
                        />
                        <button
                            onClick={searchPatients}
                            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                        >
                            Search
                        </button>
                    </div>

                    {/* Patient Results */}
                    {patients.length > 0 && !selectedPatient && (
                        <div className="space-y-2">
                            <p className="font-semibold text-gray-700">Search Results:</p>
                            {patients.map(patient => (
                                <div
                                    key={patient._id}
                                    onClick={() => handleSelectPatient(patient)}
                                    className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                                >
                                    <p className="font-semibold">{patient.name}</p>
                                    <p className="text-sm text-gray-600">MRN: {patient.mrn} | Age: {formatAge(patient.age)} | {patient.gender}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Selected Patient - Encounters */}
                    {selectedPatient && (
                        <div className="mt-4">
                            <div className="bg-blue-50 p-4 rounded mb-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg">{selectedPatient.name}</p>
                                        <p className="text-sm text-gray-600">MRN: {selectedPatient.mrn}</p>
                                        <button
                                            onClick={() => {
                                                setSelectedPatient(null);
                                                setEncounters([]);
                                                setSelectedEncounter(null);
                                            }}
                                            className="text-blue-600 text-sm mt-2 hover:underline"
                                        >
                                            ← Change Patient
                                        </button>
                                        {selectedPatient.depositBalance > 0 && (
                                            <div className="mt-2 p-2 bg-green-100 border border-green-200 rounded">
                                                <p className="text-xs font-bold text-green-800 uppercase">Available Deposit</p>
                                                <p className="text-lg font-black text-green-900">₦{selectedPatient.depositBalance.toLocaleString()}</p>
                                            </div>
                                        )}
                                    </div>
                                    <div className="w-1/3">
                                        <label className="block text-gray-700 text-sm font-semibold mb-1">Payment Method</label>
                                        <select
                                            value={paymentMethod}
                                            onChange={(e) => setPaymentMethod(e.target.value)}
                                            className="w-full border p-2 rounded text-sm bg-white"
                                        >
                                            <option value="cash">Cash</option>
                                            <option value="card">Card/POS</option>
                                            <option value="insurance">Insurance</option>
                                            <option value="deposit">Patient Deposit</option>
                                            <option value="retainership">Retainership</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {encounters.length > 0 && !selectedEncounter && (
                                <div>
                                    <p className="font-semibold mb-2">Select Encounter:</p>
                                    <div className="space-y-2">
                                        {encounters.map(encounter => {
                                            const hasPendingCharges = encounterPendingCharges[encounter._id];
                                            return (
                                                <div
                                                    key={encounter._id}
                                                    onClick={() => handleSelectEncounter(encounter)}
                                                    className="p-3 border rounded hover:bg-gray-50 cursor-pointer relative"
                                                >
                                                    {hasPendingCharges && (
                                                        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
                                                            <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                                                                {hasPendingCharges.count} Pending
                                                            </span>
                                                            <span className="bg-red-100 text-red-800 text-xs font-semibold px-2 py-1 rounded">
                                                                ₦{hasPendingCharges.total.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    )}
                                                    <p className="font-semibold">
                                                        {new Date(encounter.createdAt).toLocaleDateString()} - {encounter.type}
                                                    </p>
                                                    <p className="text-sm text-gray-600">
                                                        Status: {encounter.encounterStatus} |
                                                        Payment: {encounter.paymentValidated ? '✓ Paid' : '✗ Pending'}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Selected Encounter - Charges */}
                    {selectedEncounter && (
                        <div className="mt-4">
                            <div className="bg-green-50 p-4 rounded mb-4">
                                <p className="font-bold">Encounter: {new Date(selectedEncounter.createdAt).toLocaleDateString()}</p>
                                <p className="text-sm text-gray-600">Type: {selectedEncounter.type}</p>
                                <button
                                    onClick={() => {
                                        setSelectedEncounter(null);
                                        setEncounterCharges([]);
                                        setSelectedCharges([]);
                                    }}
                                    className="text-green-600 text-sm mt-2 hover:underline"
                                >
                                    ← Change Encounter
                                </button>
                            </div>

                            {encounterCharges.filter(c => c.status === 'pending').length > 0 && (
                                <div className="bg-gray-50 p-4 rounded">
                                    <p className="font-semibold mb-2">Pending Charges:</p>
                                    <div className="space-y-2 mb-4">
                                        {encounterCharges.filter(c => c.status === 'pending').map(charge => (
                                            <div
                                                key={charge._id}
                                                className="flex items-center justify-between p-3 border rounded hover:bg-white"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedCharges.includes(charge._id)}
                                                        onChange={() => handleChargeSelection(charge._id)}
                                                        className="w-4 h-4"
                                                    />
                                                    <div>
                                                        <p className="font-semibold">{charge.itemName || charge.charge?.name || charge.itemType || 'Service'}</p>
                                                        <p className="text-sm text-gray-600">Qty: {charge.quantity}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <p className="font-bold text-green-600">₦{(charge.patientPortion !== undefined ? charge.patientPortion : charge.totalAmount).toFixed(2)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {user.role !== 'readonly_admin' && (
                                        <button
                                            onClick={handleCollectPayment}
                                            disabled={selectedCharges.length === 0}
                                            className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                                        >
                                            <FaCheckCircle /> Collect Payment (₦{totalSelectedAmount.toFixed(2)})
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'family' && (
                <div className="bg-white p-6 rounded shadow mb-6 animate-fadeIn">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FaSearch /> Find Family File
                    </h3>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Search by Family Name or File Number..."
                            className="flex-1 border p-2 rounded"
                            value={familySearchTerm}
                            onChange={(e) => setFamilySearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchFamilyFiles()}
                        />
                        <button
                            onClick={searchFamilyFiles}
                            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                        >
                            Search
                        </button>
                    </div>

                    {/* Family File Results */}
                    {familyFiles.length > 0 && !selectedFamilyFile && (
                        <div className="space-y-2">
                            <p className="font-semibold text-gray-700">Search Results:</p>
                            {familyFiles.map(file => (
                                <div
                                    key={file._id}
                                    onClick={() => setSelectedFamilyFile(file)}
                                    className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                                >
                                    <div>
                                        <p className="font-bold">{file.familyName}</p>
                                        <p className="text-sm text-gray-600">File #: {file.fileNumber} | Type: {file.type}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-blue-600">₦{file.registrationCharge.toLocaleString()}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${file.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {file.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Selected Family File Details */}
                    {selectedFamilyFile && (
                        <div className="mt-4">
                            <div className="bg-blue-50 p-4 rounded mb-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg">{selectedFamilyFile.familyName}</p>
                                        <p className="text-sm text-gray-600">File Number: {selectedFamilyFile.fileNumber}</p>
                                        <button onClick={() => { setSelectedFamilyFile(null); setFamilyFiles([]); }} className="text-blue-600 text-sm mt-2 hover:underline">← Change Family File</button>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500 uppercase font-bold">Registration Fee</p>
                                        <p className="text-2xl font-bold text-green-700">₦{selectedFamilyFile.registrationCharge.toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {selectedFamilyFile.paymentStatus === 'pending' ? (
                                <div className="bg-gray-50 p-6 rounded border border-dashed border-gray-300">
                                    <h4 className="font-bold mb-4 flex items-center gap-2"><FaDollarSign className="text-green-600" /> Collect Registration Payment</h4>
                                    <div className="mb-6 max-w-sm">
                                        <label className="block text-gray-700 text-sm font-semibold mb-1">Payment Method</label>
                                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border p-2 rounded text-sm bg-white">
                                            <option value="cash">Cash</option>
                                            <option value="card">Card/POS</option>
                                        </select>
                                    </div>
                                    {user.role !== 'readonly_admin' && (
                                        <button onClick={handleCollectFamilyPayment} className="w-full bg-green-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-green-700 shadow-lg flex items-center justify-center gap-3">
                                            <FaCheckCircle size={24} /> Collect & Print Receipt (₦{selectedFamilyFile.registrationCharge.toLocaleString()})
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-green-50 p-10 rounded-lg border border-green-200 text-center">
                                    <FaCheckCircle className="text-green-500 text-5xl mx-auto mb-4" />
                                    <h4 className="text-2xl font-bold text-green-800">Registration Already Paid</h4>
                                    <p className="text-green-600 mt-2">This family file has been successfully registered and paid for.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'retainership' && (
                <div className="bg-white p-6 rounded shadow mb-6 animate-fadeIn">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <FaSearch /> Find Retainership Entity
                    </h3>
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Search by Entity Name or Code..."
                            className="flex-1 border p-2 rounded"
                            value={retainershipSearchTerm}
                            onChange={(e) => setRetainershipSearchTerm(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && searchRetainerships()}
                        />
                        <button
                            onClick={searchRetainerships}
                            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                        >
                            Search
                        </button>
                    </div>

                    {/* Retainership Results */}
                    {retainerships.length > 0 && !selectedRetainership && (
                        <div className="space-y-2">
                            <p className="font-semibold text-gray-700">Search Results:</p>
                            {retainerships.map(hmo => (
                                <div
                                    key={hmo._id}
                                    onClick={() => setSelectedRetainership(hmo)}
                                    className="p-3 border rounded hover:bg-gray-50 cursor-pointer flex justify-between items-center"
                                >
                                    <div>
                                        <p className="font-bold">{hmo.name}</p>
                                        <p className="text-sm text-gray-600">Code: {hmo.code} | Type: {hmo.retainershipType || 'N/A'}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-bold text-blue-600">₦{(hmo.registrationCharge || 0).toLocaleString()}</p>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${hmo.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                            {hmo.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Selected Retainership Details */}
                    {selectedRetainership && (
                        <div className="mt-4">
                            <div className="bg-purple-50 p-4 rounded mb-6 border border-purple-100">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-lg text-purple-900">{selectedRetainership.name}</p>
                                        <p className="text-sm text-gray-600">Entity Code: {selectedRetainership.code}</p>
                                        <p className="text-sm text-gray-600">Type: {selectedRetainership.retainershipType}</p>
                                        <button onClick={() => { setSelectedRetainership(null); setRetainerships([]); }} className="text-purple-600 text-sm mt-2 hover:underline">← Change Entity</button>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500 uppercase font-bold">Registration Fee</p>
                                        <p className="text-2xl font-bold text-purple-700">₦{(selectedRetainership.registrationCharge || 0).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>

                            {selectedRetainership.paymentStatus !== 'paid' ? (
                                <div className="bg-gray-50 p-6 rounded border border-dashed border-gray-300">
                                    <h4 className="font-bold mb-4 flex items-center gap-2"><FaDollarSign className="text-green-600" /> Collect Retainership Payment</h4>
                                    <div className="mb-6 max-w-sm">
                                        <label className="block text-gray-700 text-sm font-semibold mb-1 mr-2 text-purple-700 font-bold">HMO Balance:</label>
                                        <span className={`text-xl font-bold ${selectedRetainership.balance >= (selectedRetainership.registrationCharge || 0) ? 'text-green-600' : 'text-red-600'}`}>
                                            ₦{(selectedRetainership.balance || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="mb-6 max-w-sm">
                                        <label className="block text-gray-700 text-sm font-semibold mb-1">Payment Method</label>
                                        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full border p-2 rounded text-sm bg-white">
                                            <option value="deposit">Deduct from Deposit</option>
                                            <option value="cash">Cash</option>
                                            <option value="card">Card/POS</option>
                                        </select>
                                    </div>

                                    {user.role !== 'readonly_admin' && (
                                        <button onClick={handleCollectRetainershipPayment} className="w-full bg-purple-600 text-white py-4 rounded-lg font-bold text-lg hover:bg-purple-700 shadow-lg flex items-center justify-center gap-3">
                                            <FaCheckCircle size={24} /> Collect & Print Receipt (₦{(selectedRetainership.registrationCharge || 0).toLocaleString()})
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-green-50 p-10 rounded-lg border border-green-200 text-center">
                                    <FaCheckCircle className="text-green-500 text-5xl mx-auto mb-4" />
                                    <h4 className="text-2xl font-bold text-green-800">Retainership Already Paid</h4>
                                    <p className="text-green-600 mt-2">This entity has been successfully registered and paid for.</p>
                                    {selectedRetainership.paidAt && (
                                        <p className="text-xs text-green-500 mt-1">Paid on: {new Date(selectedRetainership.paidAt).toLocaleString()}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Recent Receipts */}
            <div className="bg-white p-6 rounded shadow">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FaReceipt /> Receipts
                    </h3>
                    <div className="flex gap-2 items-center">
                        <label className="text-sm font-semibold">From:</label>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border p-2 rounded text-sm" />
                        <label className="text-sm font-semibold">To:</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border p-2 rounded text-sm" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-3 border-b">Receipt #</th>
                                <th className="p-3 border-b">Client/Patient</th>
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
                                        <td className="p-3 border-b font-semibold">
                                            {receipt.familyFile ? (
                                                <span className="text-indigo-600 flex items-center gap-1">
                                                    <FaUserFriends /> {receipt.familyFile.familyName} (Family)
                                                </span>
                                            ) : receipt.hmo ? (
                                                <span className="text-purple-600 flex items-center gap-1">
                                                    <FaHospital /> {receipt.hmo.name} (Retainership)
                                                </span>
                                            ) : (
                                                receipt.patient?.name
                                            )}
                                        </td>
                                        <td className="p-3 border-b text-green-600 font-bold">₦{receipt.amountPaid.toFixed(2)}</td>
                                        <td className="p-3 border-b capitalize">{receipt.paymentMethod}</td>
                                        <td className="p-3 border-b">{receipt.cashier?.name}</td>
                                        <td className="p-3 border-b text-xs text-gray-500">{new Date(receipt.createdAt).toLocaleString()}</td>
                                        <td className="p-3 border-b">
                                            <button onClick={() => handlePrintReceipt(receipt)} className="text-blue-600 hover:text-blue-800" title="Print Receipt">
                                                <FaPrint />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default CashierDashboard;
