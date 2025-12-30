import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import { FaChartLine, FaDownload, FaCalendar } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const RevenueReports = () => {
    const [department, setDepartment] = useState('overall');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const { user } = useContext(AuthContext);

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
                case 'overall':
                    endpoint = 'overall-revenue';
                    break;
                default:
                    endpoint = 'overall-revenue';
            }

            const { data } = await axios.get(
                `http://localhost:5000/api/reports/${endpoint}?startDate=${startDate}&endDate=${endDate}`,
                config
            );
            setReportData(data);
            // Small delay to ensure UI finishes rendering before hiding overlay
            setTimeout(() => setLoading(false), 300);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching report');
            setLoading(false);
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
                'Medicines': rx.medicines.map(m => m.name).join(', '),
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

    if (user?.role !== 'admin') {
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
                                <option value="nurse-triage">Nurse Triage</option>
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
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow">
                                <p className="text-gray-600 text-sm font-semibold mb-2">Total Revenue</p>
                                <p className="text-3xl font-bold text-green-600">
                                    ₦{reportData.summary?.totalRevenue?.toLocaleString() || 0}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Paid transactions</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <p className="text-gray-600 text-sm font-semibold mb-2">Pending Insurence</p>
                                <p className="text-3xl font-bold text-yellow-600">
                                    ₦{reportData.summary?.pendingInsuranceRevenue?.toLocaleString() || 0}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Patient portion not paid</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <p className="text-gray-600 text-sm font-semibold mb-2">Pending Patient</p>
                                <p className="text-3xl font-bold text-yellow-600">
                                    ₦{reportData.summary?.pendingPatientRevenue?.toLocaleString() || 0}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Awaiting patient payment</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <p className="text-gray-600 text-sm font-semibold mb-2">Pending HMO Payment</p>
                                <p className="text-3xl font-bold text-orange-600">
                                    ₦{reportData.summary?.pendingHMOAmount?.toLocaleString() || 0}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Awaiting HMO payment</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <p className="text-gray-600 text-sm font-semibold mb-2">
                                    {department === 'lab' ? 'Total Tests' :
                                        department === 'radiology' ? 'Total Scans' :
                                            department === 'pharmacy' ? 'Total Prescriptions' :
                                                department === 'consultation' ? 'Total Consultations' :
                                                    'Total Charges'}
                                </p>
                                <p className="text-3xl font-bold text-blue-600">
                                    {reportData.summary?.totalTests ||
                                        reportData.summary?.totalScans ||
                                        reportData.summary?.totalPrescriptions ||
                                        reportData.summary?.totalConsultations ||
                                        reportData.summary?.totalCharges || 0}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">In date range</p>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow">
                                <p className="text-gray-600 text-sm font-semibold mb-2">
                                    {department === 'lab' ? 'Paid Tests' :
                                        department === 'radiology' ? 'Paid Scans' :
                                            department === 'pharmacy' ? 'Paid Prescriptions' :
                                                department === 'consultation' ? 'Paid Consultations' :
                                                    'Paid Charges'}
                                </p>
                                <p className="text-3xl font-bold text-purple-600">
                                    {reportData.summary?.paidTests ||
                                        reportData.summary?.paidScans ||
                                        reportData.summary?.paidPrescriptions ||
                                        reportData.summary?.paidConsultations ||
                                        reportData.summary?.paidCharges || 0}
                                </p>
                                <p className="text-xs text-gray-500 mt-2">Completed payments</p>
                            </div>
                        </div>

                        {/* Department Breakdown */}
                        {department === 'overall' && reportData.byDepartment && (
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-xl font-bold mb-4">Revenue by Department</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byDepartment).map(([dept, data]) => (
                                        <div key={dept} className="border p-4 rounded">
                                            <p className="text-gray-600 text-sm font-semibold mb-1 capitalize">{dept}</p>
                                            <p className="text-2xl font-bold text-green-600">
                                                ₦{data.revenue?.toLocaleString() || 0}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">{data.count} charges</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Test/Scan Type Breakdown */}
                        {(department === 'lab' && reportData.byTestType) && (
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-xl font-bold mb-4">Revenue by Test Type</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byTestType).map(([test, data]) => (
                                        <div key={test} className="border p-4 rounded hover:shadow-md transition-shadow">
                                            <p className="text-gray-600 text-sm font-semibold mb-1 capitalize truncate" title={test}>{test}</p>
                                            <p className="text-2xl font-bold text-green-600">
                                                ₦{data.revenue?.toLocaleString() || 0}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">{data.count} tests</p>
                                            <div className="mt-2 text-xs flex justify-between text-gray-400">
                                                <span>Paid: {data.paid}</span>
                                                <span>Pending: {data.pending}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(department === 'radiology' && reportData.byScanType) && (
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-xl font-bold mb-4">Revenue by Scan Type</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byScanType).map(([scan, data]) => (
                                        <div key={scan} className="border p-4 rounded hover:shadow-md transition-shadow">
                                            <p className="text-gray-600 text-sm font-semibold mb-1 capitalize truncate" title={scan}>{scan}</p>
                                            <p className="text-2xl font-bold text-green-600">
                                                ₦{data.revenue?.toLocaleString() || 0}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">{data.count} scans</p>
                                            <div className="mt-2 text-xs flex justify-between text-gray-400">
                                                <span>Paid: {data.paid}</span>
                                                <span>Pending: {data.pending}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(department === 'pharmacy' && reportData.byDrug) && (
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-xl font-bold mb-4">Top Dispensed Drugs</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byDrug)
                                        .sort((a, b) => b[1].count - a[1].count)
                                        .slice(0, 10)
                                        .map(([drug, data]) => (
                                            <div key={drug} className="border p-4 rounded hover:shadow-md transition-shadow">
                                                <p className="text-gray-600 text-sm font-semibold mb-1 capitalize truncate" title={drug}>{drug}</p>
                                                <p className="text-2xl font-bold text-blue-600">
                                                    {data.totalQuantity}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-1">Total Quantity</p>
                                                <p className="text-xs text-gray-400 mt-2">{data.count} prescriptions</p>
                                            </div>
                                        ))}
                                </div>
                            </div>
                        )}

                        {(department === 'consultation' && reportData.byService) && (
                            <div className="bg-white p-6 rounded-lg shadow">
                                <h3 className="text-xl font-bold mb-4">Revenue by Service</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                                    {Object.entries(reportData.byService).map(([service, data]) => (
                                        <div key={service} className="border p-4 rounded hover:shadow-md transition-shadow">
                                            <p className="text-gray-600 text-sm font-semibold mb-1 capitalize truncate" title={service}>{service}</p>
                                            <p className="text-2xl font-bold text-green-600">
                                                ₦{data.revenue?.toLocaleString() || 0}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">{data.count} consultations</p>
                                            <div className="mt-2 text-xs flex justify-between text-gray-400">
                                                <span>Paid: {data.paid}</span>
                                                <span>Pending: {data.pending}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="bg-white p-12 rounded-lg shadow text-center">
                        <FaCalendar className="text-6xl text-gray-300 mx-auto mb-4" />
                        <p className="text-xl text-gray-600">Select date range to generate report</p>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default RevenueReports;
