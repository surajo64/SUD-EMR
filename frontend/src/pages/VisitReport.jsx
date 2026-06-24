import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import { FaFileMedicalAlt, FaDownload, FaSearch, FaFilter, FaCalendarAlt, FaUser, FaNotesMedical, FaStethoscope, FaFlask, FaPills, FaHospitalUser, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

const VisitReport = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [expandedVisits, setExpandedVisits] = useState({});
    const { backendUrl } = useContext(AppContext);
    const { user } = useContext(AuthContext);

    useEffect(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7); // Default to last 7 days for visit report (can be large)
        setEndDate(end.toISOString().split('T')[0]);
        setStartDate(start.toISOString().split('T')[0]);
    }, []);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const query = `startDate=${startDate}&endDate=${endDate}&searchTerm=${searchTerm}`;
            const { data } = await axios.get(`${backendUrl}/api/reports/visit-report?${query}`, config);
            setReportData(data);
            setExpandedVisits({});
        } catch (error) {
            console.error(error);
            toast.error('Error fetching visit report');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        fetchReport();
    };

    const toggleVisit = (visitId) => {
        setExpandedVisits(prev => ({
            ...prev,
            [visitId]: !prev[visitId]
        }));
    };

    const exportToExcel = async () => {
        if (!reportData || reportData.length === 0) return;

        let hospitalName = 'MedKare360 EMR';
        try {
            const { data } = await axios.get(`${backendUrl}/api/settings`);
            hospitalName = data.reportHeader;
        } catch (e) {
            console.error('Settings fetch failed', e);
        }

        const worksheetData = reportData.map(v => ({
            'Hospital': hospitalName,
            'Visit Date': new Date(v.createdAt).toLocaleString(),
            'Patient Name': v.patient?.name || 'N/A',
            'Patient ID (MRN)': v.patient?.mrn || 'N/A',
            'Encounter ID': v._id,
            'Clinic/Dept': v.clinic?.name || v.type || 'N/A',
            'Status': v.encounterStatus || v.status || 'N/A',
            'Doctor': v.consultingPhysician?.name || v.doctor?.name || 'N/A',

            // Vital Signs
            'Vitals': v.vitalSigns.map(s => `BP: ${s.bloodPressure}, T: ${s.temperature}C, P: ${s.pulseRate}, R: ${s.respiratoryRate}, SpO2: ${s.spo2}%, W: ${s.weight}kg, H: ${s.height}cm, BMI: ${s.bmi}`).join(' | '),

            // Clinical History
            'Presenting Complaints': v.presentingComplaints || 'N/A',
            'History of Presenting Complaint': v.historyOfPresentingComplaint || 'N/A',
            'System Review': v.systemReview || 'N/A',
            'Past Medical History': v.pastMedicalSurgicalHistory || 'N/A',
            'Social/Family History': v.socialFamilyHistory || 'N/A',

            // Examination
            'Physical Examination': `Gen: ${v.generalAppearance || '-'}, HEENT: ${v.heent || '-'}, Neck: ${v.neck || '-'}, CVS: ${v.cvs || '-'}, Resp: ${v.resp || '-'}, Abd: ${v.abd || '-'}, Neuro: ${v.neuro || '-'}, MSK: ${v.msk || '-'}, Skin: ${v.skin || '-'}`,

            // Assessment & Plan
            'Assessment/Clinical Note': v.assessment || 'N/A',
            'Diagnosis': (v.diagnosis || []).map(d => `${d.code} - ${d.description} (${d.type})`).join('; '),
            'Care Plan': v.plan || 'N/A',

            // Investigations
            'Lab Orders': (v.labOrders || []).map(l => `${l.testName}: ${l.result || 'Pending'}`).join('; '),
            'Radiology Orders': (v.radiologyOrders || []).map(r => `${r.scanType}: ${r.report || 'Pending'}`).join('; '),

            // Drugs
            'Drugs Prescribed': (v.prescriptions || []).flatMap(p => p.medicines.map(m => `${m.name}${m.buyOutside ? ' (Buy Outside)' : ''} (${m.dosage} ${m.frequency} x ${m.duration})`)).join('; '),

            // Ward Rounds
            'Ward Round Notes': (v.notes || []).map(n => `[${n.role}] ${n.author}: ${n.text}`).join(' | ')
        }));

        const worksheet = XLSX.utils.json_to_sheet(worksheetData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Visit History Report');

        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        saveAs(data, `${hospitalName}_Visit_Report_${startDate}_to_${endDate}.xlsx`);
        toast.success('Report exported successfully!');
    };

    if (user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'readonly_admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access visit reports.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-700 to-teal-800 text-white p-6 rounded-lg shadow-lg">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <FaHospitalUser /> Visit History Report
                    </h1>
                    <p className="text-emerald-100 text-sm">Comprehensive clinical history, examinations, and care records per visit</p>
                </div>

                {/* Filters */}
                <div className="bg-white p-6 rounded-lg shadow border-t-4 border-emerald-600">
                    <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Search Patient</label>
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    className="w-full border p-2 pl-10 rounded focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
                                    placeholder="Search by Name, MRN or Encounter ID..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Start Date</label>
                            <div className="relative">
                                <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="date"
                                    className="w-full border p-2 pl-10 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold uppercase text-gray-500 mb-1">End Date</label>
                            <div className="relative">
                                <FaCalendarAlt className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="date"
                                    className="w-full border p-2 pl-10 rounded focus:ring-2 focus:ring-emerald-500 outline-none"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="md:col-span-4 flex justify-end gap-3 mt-2">
                            <button
                                type="submit"
                                className="bg-emerald-600 text-white px-8 py-2 rounded font-bold hover:bg-emerald-700 transition shadow-sm flex items-center gap-2"
                            >
                                <FaFilter /> Generate Report
                            </button>
                            <button
                                type="button"
                                onClick={exportToExcel}
                                disabled={!reportData || reportData.length === 0}
                                className="bg-blue-600 text-white px-8 py-2 rounded font-bold hover:bg-blue-700 disabled:bg-gray-400 transition shadow-sm flex items-center gap-2"
                            >
                                <FaDownload /> Export Excel
                            </button>
                        </div>
                    </form>
                </div>

                {loading ? (
                    <LoadingOverlay />
                ) : reportData ? (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center bg-emerald-50 p-4 rounded-lg border border-emerald-100">
                            <span className="font-bold text-emerald-800">Showing {reportData.length} visit records</span>
                        </div>

                        {reportData.length > 0 ? (
                            <div className="space-y-4">
                                {reportData.map((visit) => (
                                    <div key={visit._id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
                                        {/* Visit Header */}
                                        <div
                                            className="p-4 bg-gray-50 flex flex-wrap justify-between items-center cursor-pointer hover:bg-gray-100"
                                            onClick={() => toggleVisit(visit._id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="bg-emerald-100 text-emerald-700 p-3 rounded-full">
                                                    <FaHospitalUser size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-800 uppercase tracking-tight">{visit.patient?.name}</h3>
                                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                                        <span className="font-mono">ID: {visit.patient?.mrn}</span>
                                                        <span>•</span>
                                                        <span>{new Date(visit.createdAt).toLocaleString()}</span>
                                                        <span>•</span>
                                                        <span className="bg-emerald-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">{visit.encounterStatus || visit.status}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-[10px] uppercase font-bold text-gray-400">Doctor</p>
                                                    <p className="text-sm font-bold text-gray-700">{visit.consultingPhysician?.name || visit.doctor?.name || 'N/A'}</p>
                                                </div>
                                                {expandedVisits[visit._id] ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
                                            </div>
                                        </div>

                                        {/* Visit Details (Collapsible) */}
                                        {expandedVisits[visit._id] && (
                                            <div className="p-6 border-t animate-slideDown">
                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                                                    {/* Left Column: Vitals & History */}
                                                    <div className="space-y-6">
                                                        <section>
                                                            <h4 className="flex items-center gap-2 text-emerald-700 font-bold border-b pb-2 mb-3">
                                                                <FaStethoscope /> Vital Signs
                                                            </h4>
                                                            {visit.vitalSigns.length > 0 ? (
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="bg-emerald-50 p-2 rounded">
                                                                        <p className="text-[10px] text-emerald-600 font-bold uppercase">BP</p>
                                                                        <p className="font-bold">{visit.vitalSigns[0].bloodPressure || '-'}</p>
                                                                    </div>
                                                                    <div className="bg-emerald-50 p-2 rounded">
                                                                        <p className="text-[10px] text-emerald-600 font-bold uppercase">Temp</p>
                                                                        <p className="font-bold">{visit.vitalSigns[0].temperature || '-'}°C</p>
                                                                    </div>
                                                                    <div className="bg-emerald-50 p-2 rounded">
                                                                        <p className="text-[10px] text-emerald-600 font-bold uppercase">Pulse</p>
                                                                        <p className="font-bold">{visit.vitalSigns[0].pulseRate || '-'}</p>
                                                                    </div>
                                                                    <div className="bg-emerald-50 p-2 rounded">
                                                                        <p className="text-[10px] text-emerald-600 font-bold uppercase">BMI</p>
                                                                        <p className="font-bold">{visit.vitalSigns[0].bmi || '-'}</p>
                                                                    </div>
                                                                </div>
                                                            ) : <p className="text-sm text-gray-400 italic">No vitals recorded</p>}
                                                        </section>

                                                        <section>
                                                            <h4 className="flex items-center gap-2 text-emerald-700 font-bold border-b pb-2 mb-3">
                                                                <FaNotesMedical /> Clinical History
                                                            </h4>
                                                            <div className="space-y-3 text-sm">
                                                                <div>
                                                                    <p className="font-bold text-gray-600">Presenting Complaints</p>
                                                                    <p className="text-gray-700">{visit.presentingComplaints || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-600">HPC</p>
                                                                    <p className="text-gray-700">{visit.historyOfPresentingComplaint || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-600">Past Medical History</p>
                                                                    <p className="text-gray-700">{visit.pastMedicalSurgicalHistory || 'N/A'}</p>
                                                                </div>
                                                            </div>
                                                        </section>
                                                    </div>

                                                    {/* Middle Column: Examination & Assessment */}
                                                    <div className="space-y-6">
                                                        <section>
                                                            <h4 className="flex items-center gap-2 text-emerald-700 font-bold border-b pb-2 mb-3">
                                                                <FaSearch /> Physical Examination
                                                            </h4>
                                                            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                                                <div><span className="font-bold text-gray-500">General:</span> {visit.generalAppearance || '-'}</div>
                                                                <div><span className="font-bold text-gray-500">CVS:</span> {visit.cvs || '-'}</div>
                                                                <div><span className="font-bold text-gray-500">Resp:</span> {visit.resp || '-'}</div>
                                                                <div><span className="font-bold text-gray-500">Abd:</span> {visit.abd || '-'}</div>
                                                                <div><span className="font-bold text-gray-500">Neuro:</span> {visit.neuro || '-'}</div>
                                                                <div><span className="font-bold text-gray-500">Skin:</span> {visit.skin || '-'}</div>
                                                            </div>
                                                        </section>

                                                        <section>
                                                            <h4 className="flex items-center gap-2 text-emerald-700 font-bold border-b pb-2 mb-3">
                                                                <FaNotesMedical /> Assessment & Plan
                                                            </h4>
                                                            <div className="space-y-3 text-sm">
                                                                <div className="bg-blue-50 p-3 rounded border border-blue-100">
                                                                    <p className="font-bold text-blue-700">Clinical Note</p>
                                                                    <p className="text-gray-700">{visit.assessment || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-600">Care Plan</p>
                                                                    <p className="text-gray-700">{visit.plan || 'N/A'}</p>
                                                                </div>
                                                                <div>
                                                                    <p className="font-bold text-gray-600">Diagnosis</p>
                                                                    <div className="flex flex-wrap gap-2 mt-1">
                                                                        {visit.diagnosis && visit.diagnosis.length > 0 ? visit.diagnosis.map((d, i) => (
                                                                            <span key={i} className="bg-red-50 text-red-700 px-2 py-1 rounded text-[10px] font-bold border border-red-100">
                                                                                {d.code} - {d.description}
                                                                            </span>
                                                                        )) : <span className="text-gray-400 italic">No diagnosis recorded</span>}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </section>
                                                    </div>

                                                    {/* Right Column: Investigations & Drugs */}
                                                    <div className="space-y-6">
                                                        <section>
                                                            <h4 className="flex items-center gap-2 text-emerald-700 font-bold border-b pb-2 mb-3">
                                                                <FaFlask /> Investigations
                                                            </h4>
                                                            <div className="space-y-3">
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Laboratory</p>
                                                                    <ul className="text-sm space-y-1 mt-1">
                                                                        {visit.labOrders.map((l, i) => (
                                                                            <li key={i} className="flex justify-between items-start border-l-2 border-emerald-400 pl-2">
                                                                                <span className="font-semibold">{l.testName}</span>
                                                                                <span className={`text-[10px] font-bold px-1.5 rounded ${l.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                                    {l.status}
                                                                                </span>
                                                                            </li>
                                                                        ))}
                                                                        {visit.labOrders.length === 0 && <li className="text-gray-400 italic text-xs">No lab tests ordered</li>}
                                                                    </ul>
                                                                </div>
                                                                <div>
                                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Radiology</p>
                                                                    <ul className="text-sm space-y-1 mt-1">
                                                                        {visit.radiologyOrders.map((r, i) => (
                                                                            <li key={i} className="flex justify-between items-start border-l-2 border-indigo-400 pl-2">
                                                                                <span className="font-semibold">{r.scanType}</span>
                                                                                <span className={`text-[10px] font-bold px-1.5 rounded ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                                    {r.status}
                                                                                </span>
                                                                            </li>
                                                                        ))}
                                                                        {visit.radiologyOrders.length === 0 && <li className="text-gray-400 italic text-xs">No radiology scans ordered</li>}
                                                                    </ul>
                                                                </div>
                                                            </div>
                                                        </section>

                                                        <section>
                                                            <h4 className="flex items-center gap-2 text-emerald-700 font-bold border-b pb-2 mb-3">
                                                                <FaPills /> Medications
                                                            </h4>
                                                            <div className="space-y-2">
                                                                {visit.prescriptions.flatMap(p => p.medicines).map((m, i) => (
                                                                    <div key={i} className="bg-gray-50 p-2 rounded border-l-4 border-emerald-500">
                                                                        <p className="text-sm font-bold text-gray-800">{m.name}</p>
                                                                        <p className="text-xs text-gray-500">{m.dosage} {m.frequency} x {m.duration}</p>
                                                                    </div>
                                                                ))}
                                                                {visit.prescriptions.length === 0 && <p className="text-gray-400 italic text-xs">No drugs prescribed</p>}
                                                            </div>
                                                        </section>

                                                        <section>
                                                            <h4 className="flex items-center gap-2 text-emerald-700 font-bold border-b pb-2 mb-3">
                                                                <FaHospitalUser /> Ward Round Notes
                                                            </h4>
                                                            <div className="space-y-3 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                                                {visit.notes && visit.notes.length > 0 ? visit.notes.map((n, i) => (
                                                                    <div key={i} className="text-xs border-b border-gray-100 pb-2">
                                                                        <div className="flex justify-between items-center mb-1">
                                                                            <span className="font-bold text-gray-600">{n.author} ({n.role})</span>
                                                                            <span className="text-[9px] text-gray-400">{new Date(n.createdAt).toLocaleDateString()}</span>
                                                                        </div>
                                                                        <p className="text-gray-700 italic">{n.text}</p>
                                                                    </div>
                                                                )) : <p className="text-gray-400 italic text-xs">No ward notes recorded</p>}
                                                            </div>
                                                        </section>
                                                    </div>

                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-20 text-center bg-white rounded-lg shadow border-2 border-dashed border-gray-200">
                                <FaFileMedicalAlt className="text-8xl text-gray-100 mx-auto mb-6" />
                                <h2 className="text-2xl font-bold text-gray-300 uppercase tracking-widest">No Records Found</h2>
                                <p className="text-gray-400 mt-2">Adjust your filters or search term and try again</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-white p-24 rounded-lg shadow text-center border-2 border-dashed border-gray-100">
                        <FaHospitalUser className="text-9xl text-emerald-50 mx-auto mb-8 animate-pulse" />
                        <h2 className="text-3xl font-bold text-gray-300 uppercase tracking-tighter">Clinical Intelligence Suite</h2>
                        <p className="text-gray-400 mt-4 max-w-md mx-auto">Select a date range and patient parameters to generate a comprehensive visit history report</p>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .animate-slideDown {
                    animation: slideDown 0.3s ease-out forwards;
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #10b981;
                    border-radius: 10px;
                }
            ` }} />
        </Layout>
    );
};

export default VisitReport;
