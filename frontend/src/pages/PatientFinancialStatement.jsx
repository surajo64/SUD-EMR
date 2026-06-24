import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaDollarSign, FaFileInvoiceDollar, FaSearch, FaUser, FaTrash, FaCalendarAlt, FaHistory, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

const PatientFinancialStatement = () => {
    const [loading, setLoading] = useState(false);
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [charges, setCharges] = useState([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showPatientSearch, setShowPatientSearch] = useState(false);

    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    useEffect(() => {
        fetchPatients();
    }, []);

    const fetchPatients = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/patients`, config);
            setPatients(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patients');
        } finally {
            setLoading(false);
        }
    };

    const fetchPatientStatement = async (patientId) => {
        if (!patientId) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            let url = `${backendUrl}/api/encounter-charges/patient/${patientId}`;
            
            const params = [];
            if (startDate) params.push(`startDate=${startDate}`);
            if (endDate) params.push(`endDate=${endDate}`);
            
            if (params.length > 0) {
                url += `?${params.join('&')}`;
            }

            const { data } = await axios.get(url, config);
            setCharges(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching patient statement');
        } finally {
            setLoading(false);
        }
    };

    const handlePatientSelect = (patient) => {
        setSelectedPatient(patient);
        setShowPatientSearch(false);
        fetchPatientStatement(patient._id);
    };

    const handleDeleteCharge = async (chargeId) => {
        if (!window.confirm('Are you sure you want to delete this pending charge? This action cannot be undone.')) {
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/encounter-charges/${chargeId}`, config);
            toast.success('Charge deleted successfully');
            fetchPatientStatement(selectedPatient._id);
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error deleting charge');
        } finally {
            setLoading(false);
        }
    };

    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.mrn.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const totalBilled = charges.reduce((sum, c) => sum + c.totalAmount, 0);
    const totalPaid = charges.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.totalAmount, 0);
    const totalPending = charges.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.totalAmount, 0);

    const isAdmin = user.role === 'admin' || user.role === 'super_admin';

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaFileInvoiceDollar className="text-green-600" /> Patient Financial Statement
                </h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowPatientSearch(true)}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2 transition-colors"
                    >
                        <FaSearch /> {selectedPatient ? 'Change Patient' : 'Select Patient'}
                    </button>
                </div>
            </div>

            {selectedPatient && (
                <div className="bg-white p-6 rounded-lg shadow-md mb-6 border-t-4 border-green-600">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="bg-green-100 p-4 rounded-full">
                                <FaUser className="text-green-600 text-2xl" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">{selectedPatient.name}</h3>
                                <p className="text-sm text-gray-500">MRN: <span className="font-mono font-bold text-gray-700">{selectedPatient.mrn}</span></p>
                                <p className="text-xs text-gray-400 capitalize">{selectedPatient.gender} | {selectedPatient.provider} Provider</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-4 items-end">
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Start Date</label>
                                <input 
                                    type="date" 
                                    className="border rounded p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">End Date</label>
                                <input 
                                    type="date" 
                                    className="border rounded p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={() => fetchPatientStatement(selectedPatient._id)}
                                className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2 transition-all shadow-sm"
                            >
                                <FaSearch /> Filter
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedPatient ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-shadow">
                            <div className="bg-blue-50 p-3 rounded-lg mb-3 group-hover:bg-blue-100 transition-colors">
                                <FaDollarSign className="text-blue-600 text-xl" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium mb-1">Total Billed</p>
                            <h4 className="text-2xl font-bold text-gray-900">₦{totalBilled.toLocaleString()}</h4>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-shadow">
                            <div className="bg-green-50 p-3 rounded-lg mb-3 group-hover:bg-green-100 transition-colors">
                                <FaCheckCircle className="text-green-600 text-xl" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium mb-1">Total Paid</p>
                            <h4 className="text-2xl font-bold text-green-600">₦{totalPaid.toLocaleString()}</h4>
                        </div>
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center group hover:shadow-md transition-shadow">
                            <div className="bg-yellow-50 p-3 rounded-lg mb-3 group-hover:bg-yellow-100 transition-colors">
                                <FaExclamationCircle className="text-yellow-600 text-xl" />
                            </div>
                            <p className="text-sm text-gray-500 font-medium mb-1">Pending Amount</p>
                            <h4 className="text-2xl font-bold text-yellow-600">₦{totalPending.toLocaleString()}</h4>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <FaHistory className="text-blue-500" /> Transaction History
                            </h3>
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest bg-white px-2 py-1 rounded border">
                                {charges.length} Entries
                            </span>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-bold">
                                    <tr>
                                        <th className="px-6 py-3 tracking-wider">Date</th>
                                        <th className="px-6 py-3 tracking-wider">Service/Item</th>
                                        <th className="px-6 py-3 tracking-wider">Type</th>
                                        <th className="px-6 py-3 tracking-wider">Qty</th>
                                        <th className="px-6 py-3 tracking-wider text-right">Amount</th>
                                        <th className="px-6 py-3 tracking-wider text-center">Status</th>
                                        {isAdmin && <th className="px-6 py-3 tracking-wider text-center">Action</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {charges.length > 0 ? charges.map((charge) => (
                                        <tr key={charge._id} className="hover:bg-gray-50 transition-colors group">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(charge.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-gray-900">{charge.itemName || charge.charge?.name}</div>
                                                {charge.notes && <div className="text-xs text-gray-400 italic">{charge.notes}</div>}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 py-1 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700 uppercase">
                                                    {charge.itemType || charge.charge?.type || 'Service'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {charge.quantity}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                                                ₦{charge.totalAmount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`px-2 py-1 text-[10px] font-bold rounded-full uppercase ${
                                                    charge.status === 'paid' ? 'bg-green-100 text-green-700' : 
                                                    charge.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {charge.status}
                                                </span>
                                            </td>
                                            {isAdmin && (
                                                <td className="px-6 py-4 whitespace-nowrap text-center">
                                                    {charge.status === 'pending' ? (
                                                        <button 
                                                            onClick={() => handleDeleteCharge(charge._id)}
                                                            className="text-red-500 hover:text-red-700 transition-colors p-2 rounded-full hover:bg-red-50"
                                                            title="Delete Charge"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={isAdmin ? 7 : 6} className="px-6 py-12 text-center text-gray-500">
                                                <div className="flex flex-col items-center gap-2">
                                                    <FaCalendarAlt className="text-gray-300 text-4xl" />
                                                    <p>No transactions found for the selected criteria.</p>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-white p-20 rounded-xl shadow-sm border border-dashed border-gray-300 text-center text-gray-500">
                    <FaUser className="mx-auto text-6xl text-gray-200 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">No Patient Selected</h3>
                    <p className="mb-6">Please select a patient to view their financial statement and manage charges.</p>
                    <button 
                        onClick={() => setShowPatientSearch(true)}
                        className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 font-bold shadow-md hover:shadow-lg transition-all"
                    >
                        Search Patients
                    </button>
                </div>
            )}

            {/* Patient Search Modal */}
            {showPatientSearch && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="text-xl font-bold text-gray-800">Search Patient</h3>
                            <button 
                                onClick={() => setShowPatientSearch(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-full hover:bg-gray-200"
                            >
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="relative mb-6">
                                <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by Name or MRN..."
                                    className="w-full pl-12 pr-4 py-4 border-2 border-gray-100 rounded-xl focus:border-green-500 focus:ring-0 outline-none text-lg transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                                {filteredPatients.length > 0 ? filteredPatients.map(patient => (
                                    <div
                                        key={patient._id}
                                        onClick={() => handlePatientSelect(patient)}
                                        className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50 cursor-pointer transition-all group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-gray-100 p-3 rounded-full text-gray-500 group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                                                <FaUser />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900">{patient.name}</h4>
                                                <p className="text-xs text-gray-500">MRN: <span className="font-mono font-bold">{patient.mrn}</span></p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-[10px] font-bold px-2 py-1 bg-gray-200 rounded uppercase tracking-wider text-gray-600 group-hover:bg-green-200 group-hover:text-green-800">Select</span>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="text-center py-12 text-gray-400">
                                        <FaUser className="mx-auto text-4xl mb-2 opacity-20" />
                                        <p>No patients found matching your search.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default PatientFinancialStatement;
