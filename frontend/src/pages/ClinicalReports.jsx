import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import { FaFileMedicalAlt, FaDownload, FaSearch, FaUserFriends, FaVenusMars, FaChevronDown, FaChevronUp, FaFilter } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const ClinicalReports = () => {
    const [reportType, setReportType] = useState('diagnosis');
    const [searchTerm, setSearchTerm] = useState('');
    const [gender, setGender] = useState('All');
    const [minAge, setMinAge] = useState('');
    const [maxAge, setMaxAge] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState({});
    const { user } = useContext(AuthContext);

    useEffect(() => {
        // Default dates: last 30 days
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const query = `reportType=${reportType}&searchTerm=${searchTerm}&gender=${gender}&minAge=${minAge}&maxAge=${maxAge}&startDate=${startDate}&endDate=${endDate}`;
            const { data } = await axios.get(`http://localhost:5000/api/reports/clinical-report?${query}`, config);
            setReportData(data);
            setExpandedCategories({}); // Reset expanded states on new search
        } catch (error) {
            console.error(error);
            toast.error('Error fetching clinical report');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchReport();
    };

    const toggleCategory = (cat) => {
        setExpandedCategories(prev => ({
            ...prev,
            [cat]: !prev[cat]
        }));
    };

    const exportToExcel = async () => {
        if (!reportData || !reportData.categorizedData) return;

        let hospitalName = 'SUD EMR';
        try {
            const { data } = await axios.get('http://localhost:5000/api/settings');
            hospitalName = data.hospitalName;
        } catch (e) {
            console.error('Settings fetch failed', e);
        }

        const worksheetData = [];
        reportData.categorizedData.forEach(cat => {
            cat.records.forEach(rec => {
                worksheetData.push({
                    'Hospital': hospitalName,
                    'Category': cat.category,
                    'Date': new Date(rec.date).toLocaleDateString(),
                    'Patient Name': rec.patient?.name || 'N/A',
                    'MRN': rec.patient?.mrn || 'N/A',
                    'Gender': rec.patient?.gender || 'N/A',
                    'Age': rec.patient?.age || 'N/A',
                    'Details': rec.details,
                    'Doctor': rec.doctor?.name || 'N/A'
                });
            });
        });

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Categorized Clinical Report');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(data, `${hospitalName}_Clinical_Report_${reportType}_${startDate}.xlsx`);
        toast.success('Report exported successfully!');
    };

    if (user?.role !== 'admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access clinical reports.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-700 to-indigo-800 text-white p-6 rounded-lg shadow-lg">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <FaFileMedicalAlt /> Clinical Reports
                    </h1>
                    <p className="text-blue-100">Categorize and analyze patient clinical statistics</p>
                </div>

                {/* Search Form */}
                <div className="bg-white p-6 rounded-lg shadow border-t-4 border-blue-600">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">Report On</label>
                            <select
                                className="w-full border p-2 rounded bg-gray-50 focus:ring-2 focus:ring-blue-500 font-bold"
                                value={reportType}
                                onChange={(e) => setReportType(e.target.value)}
                            >
                                <option value="diagnosis">Diagnosis</option>
                                <option value="medication">Medication</option>
                                <option value="lab">Lab Result</option>
                                <option value="radiology">Radiology Result</option>
                            </select>
                        </div>
                        <div className="lg:col-span-2">
                            <label className="block text-sm font-semibold mb-1 text-gray-700">Filter Term (Optional)</label>
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    className="w-full border p-2 pl-9 rounded focus:ring-2 focus:ring-blue-500"
                                    placeholder={`Filter by ${reportType} name or code...`}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">Gender</label>
                            <select
                                className="w-full border p-2 rounded"
                                value={gender}
                                onChange={(e) => setGender(e.target.value)}
                            >
                                <option value="All">All Genders</option>
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">Age Range</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    className="w-1/2 border p-2 rounded"
                                    placeholder="Min"
                                    value={minAge}
                                    onChange={(e) => setMinAge(e.target.value)}
                                />
                                <input
                                    type="number"
                                    className="w-1/2 border p-2 rounded"
                                    placeholder="Max"
                                    value={maxAge}
                                    onChange={(e) => setMaxAge(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">Start Date</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold mb-1 text-gray-700">End Date</label>
                            <input
                                type="date"
                                className="w-full border p-2 rounded"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        <div className="md:col-span-3 lg:col-span-6 flex justify-end gap-3 mt-2">
                            <button
                                type="submit"
                                className="bg-blue-600 text-white px-8 py-2 rounded font-bold hover:bg-blue-700 transition shadow-sm flex items-center gap-2"
                            >
                                <FaFilter /> Generate Report
                            </button>
                            <button
                                type="button"
                                onClick={exportToExcel}
                                disabled={!reportData}
                                className="bg-green-600 text-white px-8 py-2 rounded font-bold hover:bg-green-700 disabled:bg-gray-400 transition shadow-sm flex items-center gap-2"
                            >
                                <FaDownload /> Export Excel
                            </button>
                        </div>
                    </form>
                </div>

                {loading ? (
                    <LoadingOverlay />
                ) : reportData ? (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="bg-blue-100 p-4 rounded-full text-blue-600">
                                    <FaUserFriends size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500">Total Records Found</p>
                                    <p className="text-2xl font-bold">{reportData.summary.totalVisits}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className="bg-indigo-100 p-4 rounded-full text-indigo-600">
                                    <FaUserFriends size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500">Unique Patients</p>
                                    <p className="text-2xl font-bold">{reportData.summary.totalPatients}</p>
                                </div>
                            </div>
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-center gap-4">
                                <div className={`p-4 rounded-full ${gender?.toLowerCase() === 'female' ? 'bg-pink-100 text-pink-500' : 'bg-blue-100 text-blue-500'}`}>
                                    <FaVenusMars size={24} />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500">
                                        {gender === 'All' ? 'Male / Female' : `${gender === 'male' ? 'Male' : 'Female'} Patients`}
                                    </p>
                                    <div className="text-2xl font-bold">
                                        {gender === 'All' ? (
                                            <div className="flex items-center gap-2">
                                                <span className="text-blue-600">{reportData.summary.maleCount}</span>
                                                <span className="text-gray-300">/</span>
                                                <span className="text-pink-600">{reportData.summary.femaleCount}</span>
                                            </div>
                                        ) : (
                                            <span className={gender === 'male' ? 'text-blue-600' : 'text-pink-600'}>
                                                {gender === 'male' ? reportData.summary.maleCount : reportData.summary.femaleCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Categorized Results */}
                        <div className="space-y-4">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <span className="capitalize">{reportType}</span> Categorization
                            </h2>
                            {reportData.categorizedData.length > 0 ? (
                                reportData.categorizedData.map((cat, index) => (
                                    <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                                        <button
                                            onClick={() => toggleCategory(cat.category)}
                                            className="w-full px-6 py-4 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition"
                                        >
                                            <div className="flex items-center gap-3 text-left">
                                                <span className="font-bold text-gray-700 text-lg uppercase tracking-tight">{cat.category}</span>
                                                <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-bold">
                                                    {cat.count} {cat.count === 1 ? 'Record' : 'Records'}
                                                </span>
                                            </div>
                                            {expandedCategories[cat.category] ? <FaChevronUp /> : <FaChevronDown />}
                                        </button>

                                        {expandedCategories[cat.category] && (
                                            <div className="overflow-x-auto border-t">
                                                <table className="w-full text-sm text-left">
                                                    <thead className="bg-gray-50 font-bold text-gray-600 text-xs uppercase">
                                                        <tr>
                                                            <th className="px-6 py-3">Date</th>
                                                            <th className="px-6 py-3">Patient</th>
                                                            <th className="px-6 py-3">Demographics</th>
                                                            <th className="px-6 py-3">Details / Results</th>
                                                            <th className="px-6 py-3">Prescribing / Ordering Doctor</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-200">
                                                        {cat.records.map((rec, rIdx) => (
                                                            <tr key={rIdx} className="hover:bg-blue-50 transition">
                                                                <td className="px-6 py-4 whitespace-nowrap">
                                                                    {new Date(rec.date).toLocaleDateString()}
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="font-bold text-blue-800 uppercase text-xs">{rec.patient?.name}</div>
                                                                    <div className="text-xs text-gray-500 font-mono">ID: {rec.patient?.mrn}</div>
                                                                </td>
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${rec.patient?.gender?.toLowerCase() === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'}`}>
                                                                            {rec.patient?.gender}
                                                                        </span>
                                                                        <span className="text-gray-700 font-semibold">{rec.patient?.age} Yrs</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 italic text-gray-600">
                                                                    {rec.details}
                                                                </td>
                                                                <td className="px-6 py-4 font-semibold text-gray-700">
                                                                    {rec.doctor?.name || 'SYSTEM ADMIN'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="p-16 text-center bg-gray-50 rounded-lg text-gray-500 border-2 border-dashed">
                                    No records found matching your filters.
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white p-20 rounded-lg shadow text-center border-2 border-dashed border-gray-200">
                        <FaFileMedicalAlt className="text-8xl text-gray-100 mx-auto mb-6" />
                        <h2 className="text-2xl font-bold text-gray-400 uppercase tracking-widest">Clinical Intelligence</h2>
                        <p className="text-gray-400 mt-2">Select an entity from the list above and specify date range to start analysis</p>
                    </div>
                )}
            </div>


        </Layout>
    );
};

export default ClinicalReports;
