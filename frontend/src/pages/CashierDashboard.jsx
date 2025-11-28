import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaDollarSign, FaReceipt, FaPrint, FaSearch, FaCheckCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

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



    const { user } = useContext(AuthContext);

    useEffect(() => {
        fetchReceipts();
    }, []);

    // --- Patient Billing Functions ---

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

    const searchPatients = async () => {
        if (!searchTerm) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/patients', config);
            const filtered = data.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.mrn && p.mrn.toLowerCase().includes(searchTerm.toLowerCase()))
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

        // Set default payment method based on provider
        if (patient.provider === 'Retainership') {
            setPaymentMethod('retainership');
        } else if (['NHIA', 'KSCHMA', 'State Scheme'].includes(patient.provider)) {
            setPaymentMethod('insurance');
        } else {
            setPaymentMethod('cash');
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/visits', config);
            const patientEncounters = data.filter(v => v.patient._id === patient._id || v.patient === patient._id);
            // Sort encounters by creation date - latest first
            patientEncounters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setEncounters(patientEncounters);

            // Fetch pending charges for each encounter
            const pendingChargesMap = {};
            for (const encounter of patientEncounters) {
                try {
                    const chargesResponse = await axios.get(
                        `http://localhost:5000/api/encounter-charges/encounter/${encounter._id}`,
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
            const { data } = await axios.get(`http://localhost:5000/api/encounter-charges/encounter/${encounter._id}`, config);
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

    const handleCollectPayment = async () => {
        if (selectedCharges.length === 0) {
            toast.error('Please select charges to pay');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const response = await axios.post(
                'http://localhost:5000/api/receipts/encounter',
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
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error collecting payment');
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
                        <h2>SUD EMR HOSPITAL</h2>
                        <p>123 Hospital Road, City</p>
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
                                        ${c.itemName || c.charge?.name || c.itemType || 'Service'} 
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

    // --- Render Helpers ---

    const totalSelectedAmount = encounterCharges
        .filter(charge => selectedCharges.includes(charge._id))
        .reduce((sum, charge) => sum + (charge.patientPortion !== undefined ? charge.patientPortion : charge.totalAmount), 0);

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
        .reduce((sum, r) => sum + r.amountPaid, 0);

    const pendingCharges = encounterCharges.filter(charge => charge.status === 'pending');

    return (
        <Layout>
            {loading && <LoadingOverlay />}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaDollarSign className="text-green-600" /> Cashier Dashboard
                </h2>
            </div>


            {/* Summary */}
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
                    <p className="text-3xl font-bold text-blue-800">
                        {receipts.filter(r => new Date(r.createdAt).toDateString() === new Date().toDateString()).length}
                    </p>
                </div>
            </div>

            {/* Search Patient */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Find Patient & Encounter
                </h3>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Search by Name or MRN..."
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
                                <p className="text-sm text-gray-600">MRN: {patient.mrn} | Age: {patient.age} | {patient.gender}</p>
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
                                                {/* Red notification badge for outstanding payments */}
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

                        {encounters.length === 0 && (
                            <p className="text-gray-500">No encounters found for this patient.</p>
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

                        {pendingCharges.length > 0 && (
                            <div className="bg-gray-50 p-4 rounded">


                                <p className="font-semibold mb-2">Pending Charges:</p>
                                <div className="space-y-2 mb-4">
                                    {pendingCharges.map(charge => (
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
                                            <p className="font-bold text-green-600">₦{(charge.patientPortion !== undefined ? charge.patientPortion : charge.totalAmount).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={handleCollectPayment}
                                    disabled={selectedCharges.length === 0}
                                    className="w-full bg-green-600 text-white py-3 rounded font-bold hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                                >
                                    <FaCheckCircle /> Collect Payment (₦{totalSelectedAmount.toFixed(2)})
                                </button>
                            </div>
                        )}

                        {pendingCharges.length === 0 && (
                            <p className="text-gray-500">No pending charges for this encounter.</p>
                        )}
                    </div>
                )}
            </div>

            {/* Recent Receipts */}
            <div className="bg-white p-6 rounded shadow">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FaReceipt /> Receipts
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
                                            <button
                                                onClick={() => handlePrintReceipt(receipt)}
                                                className="text-blue-600 hover:underline flex items-center gap-1"
                                            >
                                                <FaPrint /> Reprint
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            {receipts.filter(r => {
                                const receiptDate = new Date(r.createdAt).toISOString().split('T')[0];
                                return receiptDate >= startDate && receiptDate <= endDate;
                            }).length === 0 && (
                                    <tr>
                                        <td colSpan="7" className="p-4 text-center text-gray-500">
                                            No receipts found for selected date range
                                        </td>
                                    </tr>
                                )}
                        </tbody>
                    </table>
                </div>
            </div>

        </Layout>
    );
};

export default CashierDashboard;
