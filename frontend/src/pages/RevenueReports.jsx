import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import { FaChartLine, FaDownload, FaCalendar, FaMoneyBillWave, FaHospital, FaUserInjured, FaFileInvoiceDollar, FaWallet, FaClock, FaHandshake, FaTrash, FaTimes, FaStore, FaExternalLinkAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const RevenueReports = () => {
    const [department, setDepartment] = useState('overall');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [totalPatientDeposits, setTotalPatientDeposits] = useState(0);
    const [totalRetainershipBalance, setTotalRetainershipBalance] = useState(0);
    const [showPendingModal, setShowPendingModal] = useState(false);
    const [pendingItems, setPendingItems] = useState([]);
    const [pendingModalType, setPendingModalType] = useState(''); // 'hmo' or 'patient'
    const [showExternalModal, setShowExternalModal] = useState(false);
    const [externalCashierFilter, setExternalCashierFilter] = useState('');
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    const fetchDepositBalances = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            // Fetch patients
            const { data: patientsData } = await axios.get(`${backendUrl}/api/patients`, config);
            const patTotal = patientsData.reduce((sum, p) => sum + (p.depositBalance || 0), 0);
            setTotalPatientDeposits(patTotal);

            // Fetch retainership balance
            const { data: hmoData } = await axios.get(`${backendUrl}/api/hmo-transactions/total-retainership-balance`, config);
            setTotalRetainershipBalance(hmoData.balance || 0);
        } catch (error) {
            console.error('Error fetching deposit balances for report:', error);
        }
    };

    useEffect(() => {
        // Set default dates (last 30 days)
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);

        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    }, []);

    useEffect(() => {
        if (startDate && endDate) {
            fetchReport();
        }
    }, [department, startDate, endDate]);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            let endpoint = '';

            switch (department) {
                case 'lab':
                    endpoint = 'lab-revenue';
                    break;
                case 'radiology':
                    endpoint = 'radiology-revenue';
                    break;
                case 'pharmacy':
                    endpoint = 'pharmacy-revenue';
                    break;
                case 'consultation':
                    endpoint = 'consultation-revenue';
                    break;
                case 'nurse-triage':
                    endpoint = 'nurse-triage-revenue';
                    break;
                case 'theatre':
                    endpoint = 'theatre-revenue';
                    break;
                case 'family':
                    endpoint = 'family-revenue';
                    break;
                case 'retainership':
                    endpoint = 'retainership-revenue';
                    break;
                case 'overall':
                    endpoint = 'overall-revenue';
                    break;
                default:
                    endpoint = 'overall-revenue';
            }

            const { data } = await axios.get(
                `${backendUrl}/api/reports/${endpoint}?startDate=${startDate}&endDate=${endDate}`,
                config
            );
            setReportData(data);
            fetchDepositBalances();
            // Small delay to ensure UI finishes rendering before hiding overlay
            setTimeout(() => setLoading(false), 300);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching report');
            setLoading(false);
        }
    };

    const openPendingModal = (type) => {
        if (!reportData?.charges) return;

        let filtered = [];
        if (type === 'hmo') {
            filtered = reportData.charges.filter(c => c.status === 'pending' && (c.hmoPortion || 0) > 0);
        } else {
            filtered = reportData.charges.filter(c => c.status === 'pending' && (c.patientPortion || 0) > 0);
        }

        setPendingItems(filtered);
        setPendingModalType(type);
        setShowPendingModal(true);
    };

    const handleRemoveCharge = async (chargeId) => {
        if (!window.confirm('Are you sure you want to remove this pending charge?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/encounter-charges/${chargeId}`, config);
            toast.success('Pending charge removed');

            // Refresh modal list
            setPendingItems(prev => prev.filter(item => item._id !== chargeId));

            // Refresh main report
            fetchReport();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error removing charge');
        }
    };

    const exportToExcel = () => {
        if (!reportData) return;

        let worksheetData = [];
        let filename = '';

        if (department === 'lab') {
            filename = `Lab_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.orders.map(order => ({
                'Date': new Date(order.createdAt).toLocaleDateString(),
                'Patient': order.patient?.name || 'N/A',
                'MRN': order.patient?.mrn || 'N/A',
                'Test': order.testName,
                'Status': order.status,
                'Payment Status': order.charge?.status || 'N/A',
                'Amount': order.charge?.totalAmount || 0
            }));
        } else if (department === 'radiology') {
            filename = `Radiology_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.orders.map(order => ({
                'Date': new Date(order.createdAt).toLocaleDateString(),
                'Patient': order.patient?.name || 'N/A',
                'MRN': order.patient?.mrn || 'N/A',
                'Scan Type': order.scanType,
                'Status': order.status,
                'Payment Status': order.charge?.status || 'N/A',
                'Amount': order.charge?.totalAmount || 0
            }));
        } else if (department === 'pharmacy') {
            filename = `Pharmacy_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.prescriptions.map(rx => ({
                'Date': new Date(rx.createdAt).toLocaleDateString(),
                'Patient': rx.patient?.name || 'N/A',
                'MRN': rx.patient?.mrn || 'N/A',
                'Doctor': rx.doctor?.name || 'N/A',
                'Medicines': rx.medicines.map(m => `${m.name}${m.buyOutside ? ' (Buy Outside)' : ''}`).join(', '),
                'Status': rx.status,
                'Payment Status': rx.charge?.status || 'N/A',
                'Amount': rx.charge?.totalAmount || 0
            }));
        } else if (department === 'consultation') {
            filename = `Consultation_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.charges.map(charge => ({
                'Date': new Date(charge.createdAt).toLocaleDateString(),
                'Patient': charge.patient?.name || 'N/A',
                'MRN': charge.patient?.mrn || 'N/A',
                'Service': charge.charge?.name || 'N/A',
                'Status': charge.status,
                'Amount': charge.totalAmount
            }));
        } else if (department === 'nurse-triage') {
            filename = `Nurse_Triage_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.charges.map(charge => ({
                'Date': new Date(charge.createdAt).toLocaleDateString(),
                'Patient': charge.patient?.name || 'N/A',
                'MRN': charge.patient?.mrn || 'N/A',
                'Service': charge.charge?.name || 'N/A',
                'Status': charge.status,
                'Amount': charge.totalAmount
            }));
        } else if (department === 'theatre') {
            filename = `Theatre_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.charges.map(charge => ({
                'Date': new Date(charge.createdAt).toLocaleDateString(),
                'Patient': charge.patient?.name || 'N/A',
                'MRN': charge.patient?.mrn || 'N/A',
                'Service': charge.charge?.name || 'N/A',
                'Status': charge.status,
                'Amount': charge.totalAmount
            }));
        } else if (department === 'family') {
            filename = `Family_Registration_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.charges.map(charge => ({
                'Date': new Date(charge.createdAt).toLocaleDateString(),
                'Family Name': charge.patient?.name || 'N/A',
                'Receipt #': charge.receiptNumber,
                'Payment Method': charge.paymentMethod,
                'Amount': charge.totalAmount
            }));
        } else if (department === 'retainership') {
            filename = `Retainership_Registration_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.charges.map(charge => ({
                'Date': new Date(charge.createdAt).toLocaleDateString(),
                'Entity Name': charge.patient?.name || 'N/A',
                'Receipt #': charge.receiptNumber,
                'Payment Method': charge.paymentMethod,
                'Amount': charge.totalAmount
            }));
        } else {
            filename = `Overall_Revenue_Report_${startDate}_to_${endDate}.xlsx`;
            worksheetData = reportData.charges.map(charge => ({
                'Date': new Date(charge.createdAt).toLocaleDateString(),
                'Patient': charge.patient?.name || 'N/A',
                'Type': charge.charge?.type || 'N/A',
                'Service': charge.charge?.name || 'N/A',
                'Quantity': charge.quantity,
                'Status': charge.status,
                'Amount': charge.totalAmount
            }));
        }

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Revenue Report');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(data, filename);

        toast.success('Report exported successfully!');
    };

    if (user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'readonly_admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access revenue reports.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 rounded-lg shadow-lg">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <FaChartLine /> Revenue Reports
                    </h1>
                    <p className="text-green-100">Generate detailed revenue reports by department and date range</p>
                </div>

                {/* Filters */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h3 className="text-xl font-bold mb-4">Report Filters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-2">Department</label>
                            <select
                                className="w-full border p-2 rounded"
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                            >
                                <option value="overall">Overall Hospital</option>
                                <option value="lab">Laboratory</option>
                                <option value="radiology">Radiology</option>
                                <option value="pharmacy">Pharmacy</option>
                                <option value="consultation">Consultation</option>
                                <option value="nurse-triage">Nursing / Triage</option>
                                <option value="theatre">Theatre</option>
                                <option value="family">Family Registration</option>
                                <option value="retainership">Retainership Registration</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2">Start Date</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-2">End Date</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={exportToExcel}
                                disabled={!reportData}
                                className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                                <FaDownload /> Export Excel
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <LoadingOverlay />
                ) : reportData ? (
                    <>
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
                            {/* Total Revenue */}
                            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 to-green-700 text-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider mb-1">Total Revenue</p>
                                        <p className="text-2xl font-extrabold">₦{reportData.summary?.totalRevenue?.toLocaleString() || 0}</p>
                                        <p className="text-emerald-200 text-xs mt-2 font-medium">Collected payments</p>
                                    </div>
                                    <div className="bg-white bg-opacity-20 p-3 rounded-full">
                                        <FaMoneyBillWave className="text-2xl text-white" />
                                    </div>
                                </div>
                                <div className="absolute -bottom-3 -right-3 opacity-10">
                                    <FaMoneyBillWave className="text-8xl text-white" />
                                </div>
                            </div>

                            {/* HMO/Retainership Pending */}
                            <div
                                onClick={() => openPendingModal('hmo')}
                                className="relative overflow-hidden bg-gradient-to-br from-amber-400 to-yellow-600 text-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-yellow-100 text-xs font-semibold uppercase tracking-wider mb-1">HMO Pending</p>
                                        <p className="text-2xl font-extrabold">₦{reportData.summary?.pendingInsuranceRevenue?.toLocaleString() || 0}</p>
                                        <p className="text-yellow-100 text-xs mt-2 font-medium">Insurance portion unpaid</p>
                                    </div>
                                    <div className="bg-white bg-opacity-20 p-3 rounded-full">
                                        <FaHandshake className="text-2xl text-white" />
                                    </div>
                                </div>
                                <div className="absolute -bottom-3 -right-3 opacity-10">
                                    <FaHandshake className="text-8xl text-white" />
                                </div>
                            </div>

                            {/* Pending Patient */}
                            <div
                                onClick={() => openPendingModal('patient')}
                                className="relative overflow-hidden bg-gradient-to-br from-orange-400 to-orange-600 text-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-orange-100 text-xs font-semibold uppercase tracking-wider mb-1">Patient Pending</p>
                                        <p className="text-2xl font-extrabold">₦{reportData.summary?.pendingPatientRevenue?.toLocaleString() || 0}</p>
                                        <p className="text-orange-100 text-xs mt-2 font-medium">Awaiting patient payment</p>
                                    </div>
                                    <div className="bg-white bg-opacity-20 p-3 rounded-full">
                                        <FaUserInjured className="text-2xl text-white" />
                                    </div>
                                </div>
                                <div className="absolute -bottom-3 -right-3 opacity-10">
                                    <FaUserInjured className="text-8xl text-white" />
                                </div>
                            </div>

                            {/* HMO Paid Claims */}
                            <div className="relative overflow-hidden bg-gradient-to-br from-red-400 to-rose-600 text-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-red-100 text-xs font-semibold uppercase tracking-wider mb-1">HMO Paid Claims</p>
                                        <p className="text-2xl font-extrabold">₦{reportData.summary?.pendingHMOAmount?.toLocaleString() || 0}</p>
                                        <p className="text-red-100 text-xs mt-2 font-medium">Awaiting HMO reimbursement</p>
                                    </div>
                                    <div className="bg-white bg-opacity-20 p-3 rounded-full">
                                        <FaFileInvoiceDollar className="text-2xl text-white" />
                                    </div>
                                </div>
                                <div className="absolute -bottom-3 -right-3 opacity-10">
                                    <FaFileInvoiceDollar className="text-8xl text-white" />
                                </div>
                            </div>

                            {/* Total Deposits */}
                            <div className="relative overflow-hidden bg-gradient-to-br from-violet-500 to-purple-700 text-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <p className="text-purple-100 text-xs font-semibold uppercase tracking-wider mb-1">Total Deposits</p>
                                        <p className="text-2xl font-extrabold">₦{(totalPatientDeposits + totalRetainershipBalance).toLocaleString()}</p>
                                        <div className="mt-2 pt-2 border-t border-purple-400 border-opacity-50 space-y-1">
                                            <div className="flex justify-between text-xs text-purple-200">
                                                <span>Patients</span>
                                                <span className="font-semibold">₦{totalPatientDeposits.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between text-xs text-purple-200">
                                                <span>Retainership</span>
                                                <span className="font-semibold">₦{totalRetainershipBalance.toLocaleString()}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-white bg-opacity-20 p-3 rounded-full ml-3">
                                        <FaWallet className="text-2xl text-white" />
                                    </div>
                                </div>
                                <div className="absolute -bottom-3 -right-3 opacity-10">
                                    <FaWallet className="text-8xl text-white" />
                                </div>
                            </div>
                        </div>

                        {/* External Purchase Card - shown for Lab, Radiology, Pharmacy */}
                        {['lab', 'radiology', 'pharmacy'].includes(department) && (
                            <div
                                onClick={() => { setExternalCashierFilter(''); setShowExternalModal(true); }}
                                className="relative overflow-hidden bg-gradient-to-br from-cyan-500 to-teal-700 text-white p-5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 mt-4"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-cyan-100 text-xs font-semibold uppercase tracking-wider mb-1">External Purchase</p>
                                        <p className="text-2xl font-extrabold">₦{reportData.summary?.externalRevenue?.toLocaleString() || 0}</p>
                                        <p className="text-cyan-200 text-xs mt-2 font-medium">Walk-in / Standalone services &rarr; click for details</p>
                                    </div>
                                    <div className="bg-white bg-opacity-20 p-3 rounded-full">
                                        <FaStore className="text-2xl text-white" />
                                    </div>
                                </div>
                                <div className="absolute -bottom-3 -right-3 opacity-10">
                                    <FaStore className="text-8xl text-white" />
                                </div>
                            </div>
                        )}

                        {/* External Details Modal */}
                        {showExternalModal && reportData?.externalDetails && (() => {
                            const relevantRoles = {
                                lab: ['lab_technician', 'lab_scientist', 'cashier'],
                                pharmacy: ['pharmacist', 'cashier'],
                                radiology: ['radiologist', 'radiology_technician', 'cashier']
                            };
                            const deptRoles = relevantRoles[department] || [];

                            const allCashiers = [...new Map(
                                reportData.externalDetails
                                    .filter(e => e.cashier?._id && (deptRoles.includes(e.cashier.role) || e.cashier.role === 'cashier'))
                                    .map(e => [e.cashier._id, e.cashier])
                            ).values()];

                            const filtered = externalCashierFilter
                                ? reportData.externalDetails.filter(e => e.cashier?._id === externalCashierFilter)
                                : reportData.externalDetails;

                            const filteredTotal = filtered
                                .filter(e => e.status === 'paid')
                                .reduce((sum, e) => sum + (e.amount || 0), 0);

                            return (
                                <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4" onClick={() => setShowExternalModal(false)}>
                                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                                        {/* Modal Header */}
                                        <div className="bg-gradient-to-r from-cyan-600 to-teal-700 px-6 py-4 rounded-t-2xl flex justify-between items-center">
                                            <div>
                                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                                    <FaStore /> External Purchase Details
                                                </h3>
                                                <p className="text-cyan-200 text-xs mt-0.5 flex items-center gap-2">
                                                    <span>Walk-in and Standalone service transactions</span>
                                                    <span className="bg-white bg-opacity-10 px-1.5 py-0.5 rounded border border-white border-opacity-10 font-medium">
                                                        <FaCalendar className="inline mr-1 opacity-70" /> {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                                                    </span>
                                                </p>
                                            </div>
                                            <button onClick={() => setShowExternalModal(false)} className="text-white hover:text-cyan-200 text-xl"><FaTimes /></button>
                                        </div>

                                        {/* Filters + Total */}
                                        <div className="px-6 py-3 bg-gray-50 border-b flex flex-col sm:flex-row sm:items-center gap-3">
                                            <div className="flex-1">
                                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Filter by Cashier</label>
                                                <select
                                                    value={externalCashierFilter}
                                                    onChange={e => setExternalCashierFilter(e.target.value)}
                                                    className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                                                >
                                                    <option value="">All Cashiers</option>
                                                    {allCashiers.map(c => (
                                                        <option key={c._id} value={c._id}>{c.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="bg-teal-50 border border-teal-200 rounded-xl px-4 py-2 text-center min-w-[140px]">
                                                <p className="text-teal-600 text-xs font-semibold uppercase">Total Collected</p>
                                                <p className="text-teal-800 text-xl font-extrabold">₦{filteredTotal.toLocaleString()}</p>
                                            </div>
                                        </div>

                                        {/* Table */}
                                        <div className="overflow-y-auto flex-1">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-100 sticky top-0">
                                                    <tr>
                                                        <th className="text-left px-4 py-2 text-gray-600 font-semibold">Date</th>
                                                        <th className="text-left px-4 py-2 text-gray-600 font-semibold">Patient</th>
                                                        <th className="text-left px-4 py-2 text-gray-600 font-semibold">Service / Drug</th>
                                                        <th className="text-left px-4 py-2 text-gray-600 font-semibold">Cashier</th>
                                                        <th className="text-right px-4 py-2 text-gray-600 font-semibold">Amount</th>
                                                        <th className="text-center px-4 py-2 text-gray-600 font-semibold">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filtered.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} className="text-center py-8 text-gray-400">No external transactions found</td>
                                                        </tr>
                                                    ) : filtered.map((item, idx) => (
                                                        <tr key={item._id || idx} className="border-b hover:bg-gray-50 transition-colors">
                                                            <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{new Date(item.createdAt).toLocaleDateString()}</td>
                                                            <td className="px-4 py-2 font-medium text-gray-800">{item.patient?.name || '—'}</td>
                                                            <td className="px-4 py-2 text-gray-600 max-w-[160px] truncate" title={item.testName}>{item.testName || '—'}</td>
                                                            <td className="px-4 py-2 text-gray-600">{item.cashier?.name || <span className="text-gray-300 italic">Uncollected</span>}</td>
                                                            <td className="px-4 py-2 text-right font-semibold">₦{(item.amount || 0).toLocaleString()}</td>
                                                            <td className="px-4 py-2 text-center">
                                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${item.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                                    }`}>{item.status || 'pending'}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Footer */}
                                        <div className="px-6 py-3 bg-gray-50 rounded-b-2xl border-t flex justify-between items-center text-xs text-gray-500">
                                            <span>{filtered.length} transaction{filtered.length !== 1 ? 's' : ''}</span>
                                            <button onClick={() => setShowExternalModal(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-lg font-medium transition-colors">Close</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                        {department === 'overall' && reportData.byDepartment && (
                            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-gray-800 to-gray-700 px-6 py-4">
                                    <h3 className="text-white font-bold text-lg tracking-wide">Revenue by Department</h3>
                                    <p className="text-gray-400 text-xs mt-0.5">Breakdown across all hospital departments</p>
                                </div>
                                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                    {Object.entries(reportData.byDepartment).map(([dept, data], idx) => {
                                        const colors = [
                                            'from-green-400 to-emerald-600',
                                            'from-blue-400 to-blue-600',
                                            'from-purple-400 to-purple-600',
                                            'from-amber-400 to-yellow-600',
                                            'from-rose-400 to-red-600',
                                            'from-cyan-400 to-teal-600',
                                        ];
                                        const color = colors[idx % colors.length];
                                        return (
                                            <div key={dept} className={`relative overflow-hidden bg-gradient-to-br ${color} text-white p-4 rounded-xl shadow hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5`}>
                                                <p className="text-white text-opacity-80 text-xs font-semibold uppercase tracking-wider mb-2 capitalize">
                                                    {dept === 'retainership' ? 'Retainership Reg.' : dept}
                                                </p>
                                                <p className="text-xl font-extrabold">₦{data.revenue?.toLocaleString() || 0}</p>
                                                <p className="text-white text-opacity-70 text-xs mt-1">{data.count} items</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Test Type Breakdown */}
                        {(department === 'lab' && reportData.byTestType) && (
                            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-800 to-blue-700 px-6 py-4">
                                    <h3 className="text-white font-bold text-lg">Revenue by Test Type</h3>
                                    <p className="text-blue-300 text-xs mt-0.5">Lab test revenue breakdown</p>
                                </div>
                                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byTestType).map(([test, data]) => (
                                        <div key={test} className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 p-4 rounded-xl hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                                            <p className="text-blue-800 text-xs font-bold uppercase tracking-wide mb-2 truncate" title={test}>{test}</p>
                                            <p className="text-2xl font-extrabold text-blue-700">₦{data.revenue?.toLocaleString() || 0}</p>
                                            <p className="text-blue-500 text-xs mt-1">{data.count} tests</p>
                                            <div className="mt-2 pt-2 border-t border-blue-200 flex justify-between text-xs text-blue-400">
                                                <span className="text-green-600 font-semibold">✓ {data.paid}</span>
                                                <span className="text-orange-500 font-semibold">⏳ {data.pending}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Scan Type Breakdown */}
                        {(department === 'radiology' && reportData.byScanType) && (
                            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-indigo-800 to-indigo-700 px-6 py-4">
                                    <h3 className="text-white font-bold text-lg">Revenue by Scan Type</h3>
                                    <p className="text-indigo-300 text-xs mt-0.5">Radiology scan revenue breakdown</p>
                                </div>
                                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byScanType).map(([scan, data]) => (
                                        <div key={scan} className="bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200 p-4 rounded-xl hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                                            <p className="text-indigo-800 text-xs font-bold uppercase tracking-wide mb-2 truncate" title={scan}>{scan}</p>
                                            <p className="text-2xl font-extrabold text-indigo-700">₦{data.revenue?.toLocaleString() || 0}</p>
                                            <p className="text-indigo-500 text-xs mt-1">{data.count} scans</p>
                                            <div className="mt-2 pt-2 border-t border-indigo-200 flex justify-between text-xs">
                                                <span className="text-green-600 font-semibold">✓ {data.paid}</span>
                                                <span className="text-orange-500 font-semibold">⏳ {data.pending}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Top Dispensed Drugs */}
                        {(department === 'pharmacy' && reportData.byDrug) && (
                            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-purple-800 to-purple-700 px-6 py-4">
                                    <h3 className="text-white font-bold text-lg">Top Dispensed Drugs</h3>
                                    <p className="text-purple-300 text-xs mt-0.5">Most prescribed medications by quantity</p>
                                </div>
                                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byDrug)
                                        .sort((a, b) => b[1].count - a[1].count)
                                        .slice(0, 10)
                                        .map(([drug, data]) => (
                                            <div key={drug} className="bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 p-4 rounded-xl hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                                                <p className="text-purple-800 text-xs font-bold uppercase tracking-wide mb-2 truncate" title={drug}>{drug}</p>
                                                <p className="text-3xl font-extrabold text-purple-700">{data.totalQuantity}</p>
                                                <p className="text-purple-500 text-xs mt-1">Total Qty</p>
                                                <p className="text-purple-400 text-xs mt-2 pt-1 border-t border-purple-200">{data.count} prescriptions</p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {/* Consultation Service Breakdown */}
                        {(department === 'consultation' && reportData.byService) && (
                            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                                <div className="bg-gradient-to-r from-teal-700 to-teal-600 px-6 py-4">
                                    <h3 className="text-white font-bold text-lg">Revenue by Service</h3>
                                    <p className="text-teal-200 text-xs mt-0.5">Consultation revenue breakdown</p>
                                </div>
                                <div className="p-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byService).map(([service, data]) => (
                                        <div key={service} className="bg-gradient-to-br from-teal-50 to-cyan-100 border border-teal-200 p-4 rounded-xl hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                                            <p className="text-teal-800 text-xs font-bold uppercase tracking-wide mb-2 truncate" title={service}>{service}</p>
                                            <p className="text-2xl font-extrabold text-teal-700">₦{data.revenue?.toLocaleString() || 0}</p>
                                            <p className="text-teal-500 text-xs mt-1">{data.count} consultations</p>
                                            <div className="mt-2 pt-2 border-t border-teal-200 flex justify-between text-xs">
                                                <span className="text-green-600 font-semibold">✓ {data.paid}</span>
                                                <span className="text-orange-500 font-semibold">⏳ {data.pending}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-white rounded-xl shadow-lg p-12 text-center">
                        <div className="bg-gray-100 rounded-full w-24 h-24 flex items-center justify-center mx-auto mb-4">
                            <FaCalendar className="text-4xl text-gray-400" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-700 mb-2">No Report Data</h3>
                        <p className="text-gray-500">Select a date range above to generate your revenue report</p>
                    </div>
                )}

                {/* Pending Fees Modal */}
                {showPendingModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className={`p-6 flex justify-between items-center text-white bg-gradient-to-r ${pendingModalType === 'hmo' ? 'from-amber-500 to-yellow-600' : 'from-orange-500 to-orange-600'}`}>
                                <div>
                                    <h3 className="text-xl font-bold">List of Pending {pendingModalType === 'hmo' ? 'HMO' : 'Patient'} Fees</h3>
                                    <p className="text-sm opacity-90">Total: ₦{pendingItems.reduce((sum, item) => sum + (pendingModalType === 'hmo' ? item.hmoPortion : (item.patientPortion || item.totalAmount)), 0).toLocaleString()}</p>
                                </div>
                                <button onClick={() => setShowPendingModal(false)} className="bg-white bg-opacity-20 hover:bg-opacity-30 p-2 rounded-full transition-colors">
                                    <FaTimes />
                                </button>
                            </div>
                            <div className="p-6 overflow-x-auto max-h-[60vh]">
                                {pendingItems.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500">
                                        <p>No pending {pendingModalType} fees found for this period.</p>
                                    </div>
                                ) : (
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-bold border-b">
                                            <tr>
                                                <th className="px-4 py-3">Date</th>
                                                <th className="px-4 py-3">Patient</th>
                                                <th className="px-4 py-3">Item Name</th>
                                                <th className="px-4 py-3 text-right">Amount (₦)</th>
                                                <th className="px-4 py-3 text-center">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {pendingItems.map((item) => (
                                                <tr key={item._id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-4 py-3 text-sm text-gray-600">
                                                        {new Date(item.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3 font-medium text-gray-800">
                                                        {item.patient?.name || 'Unknown'}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm">
                                                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-xs mr-2">{item.itemType || 'Charge'}</span>
                                                        {item.itemName || item.charge?.name}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-bold text-gray-900">
                                                        {(pendingModalType === 'hmo' ? item.hmoPortion : (item.patientPortion || item.totalAmount)).toLocaleString()}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {user.role !== 'readonly_admin' && (
                                                            <button
                                                                onClick={() => handleRemoveCharge(item._id)}
                                                                className="text-red-500 hover:text-red-700 p-2 rounded hover:bg-red-50 transition-all"
                                                                title="Remove pending charge"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="p-4 bg-gray-50 border-t flex justify-end">
                                <button
                                    onClick={() => setShowPendingModal(false)}
                                    className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-2 rounded-lg font-semibold transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default RevenueReports;
