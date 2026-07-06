import { useContext, useEffect, useState } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AdminDashboard from './AdminDashboard';
import { FaUserMd, FaPrescription, FaVials, FaCreditCard, FaUserNurse, FaCalendarDay, FaUserCheck, FaNotesMedical, FaClock, FaCalendarAlt, FaFlask, FaMicroscope, FaHistory, FaBriefcaseMedical, FaChartBar, FaFileInvoiceDollar, FaReceipt, FaCheckCircle, FaXRay } from 'react-icons/fa';
import { formatCompactNumber, formatCurrency } from '../utils/formatters';

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const navigate = useNavigate();
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user && !['admin', 'super_admin', 'readonly_admin'].includes(user.role)) {
            fetchUserStats();
        }
    }, [user, backendUrl]);

    const fetchUserStats = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/reports/user-stats`, config);
            setStats(data);
        } catch (error) {
            console.error('Error fetching user stats:', error);
        } finally {
            setLoading(false);
        }
    };

    // Show AdminDashboard for admin and super_admin users
    if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'readonly_admin') {
        return <AdminDashboard />;
    }

    const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl transition-all duration-500 group overflow-hidden relative border-b-4" style={{ borderBottomColor: `var(--tw-color-${color}-500)` }}>
            <div className={`absolute top-0 right-0 w-32 h-32 -mr-12 -mt-12 rounded-full opacity-[0.03] group-hover:opacity-[0.08] group-hover:scale-110 transition-all duration-700 bg-current`}></div>
            <div className="flex items-center justify-between relative z-10">
                <div className="flex-1">
                    <p className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">{title}</p>
                    <h3 className="text-3xl font-black text-gray-800 tracking-tighter leading-none mb-1">
                        {typeof value === 'number' && (
                            title.toLowerCase().includes('revenue') ||
                            title.toLowerCase().includes('collected') ||
                            title.toLowerCase().includes('sales') ||
                            title.toLowerCase().includes('income') ||
                            title.toLowerCase().includes('cash')
                        )
                            ? formatCurrency(value)
                            : (typeof value === 'number' ? formatCompactNumber(value) : (value || 0))}
                    </h3>
                    {subtitle && (
                        <div className="flex items-center gap-1.5 pt-1">
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-${color}-50 text-${color}-600 border border-${color}-100`}>
                                {subtitle}
                            </span>
                        </div>
                    )}
                </div>
                <div className={`p-4 rounded-2xl bg-${color}-50 text-${color}-600 group-hover:bg-${color}-600 group-hover:text-white transition-all duration-500 shadow-sm border border-${color}-100/50`}>
                    <Icon size={28} />
                </div>
            </div>
        </div>
    );

    return (
        <Layout>
            <div className="mb-8">
                <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-64 h-64 bg-white opacity-5 rounded-full -ml-32 -mt-32"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-3xl font-bold mb-1 tracking-tight">Welcome, {user.name || 'User'}!</h2>
                            <p className="opacity-90 flex items-center gap-2">
                                <FaCalendarDay className="opacity-70" /> {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <p className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-sm font-medium backdrop-blur-sm border border-white/20">
                                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse"></span> {user.role.charAt(0).toUpperCase() + user.role.slice(1).replace('_', ' ')} Access
                            </p>
                        </div>
                        <div className="hidden md:block text-right">
                            <p className="text-green-100 text-sm font-medium mb-1">Your ID</p>
                            <p className="text-xl font-mono text-white tracking-widest">{user._id.slice(-6).toUpperCase()}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-8">
                {/* Statistics Grid */}
                {!loading && Object.keys(stats).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 tracking-tight">
                        {user.role === 'receptionist' && (
                            <>
                                <StatCard title="Registered Today" value={stats.registeredToday} icon={FaUserCheck} color="blue" subtitle="DAILY GROWTH" />
                                <StatCard title="Total Registered" value={stats.totalRegistered} icon={FaBriefcaseMedical} color="indigo" subtitle="LIFETIME IMPACT" />
                                <StatCard title="Visits Today" value={stats.encountersCreated} icon={FaCalendarAlt} color="green" subtitle="DAILY TRAFFIC" />
                                <StatCard title="Total Visits" value={stats.totalEncounters} icon={FaHistory} color="purple" subtitle="CUMULATIVE LOAD" />
                            </>
                        )}
                        {user.role === 'nurse' && (
                            <>
                                <StatCard title="Vitals Captured" value={stats.vitalsToday} icon={FaUserNurse} color="pink" subtitle="TRAINING TODAY" />
                                <StatCard title="Lifetime Vitals" value={stats.totalVitals} icon={FaHistory} color="rose" subtitle="TOTAL TRIAGES" />
                                <StatCard title="Active Queue" value={stats.vitalsToday || 0} icon={FaClock} color="orange" subtitle="AWAITING SERVICE" />
                                <StatCard title="Dept Load" value={stats.totalVitals || 0} icon={FaChartBar} color="blue" subtitle="HISTORICAL REACH" />
                            </>
                        )}
                        {user.role === 'doctor' && (
                            <>
                                <StatCard title="Consults Today" value={stats.patientsSeen} icon={FaUserMd} color="blue" subtitle="PATIENT LOG" />
                                <StatCard title="Lifetime Consults" value={stats.totalPatientsSeen} icon={FaBriefcaseMedical} color="indigo" subtitle="CARE HISTORY" />
                                <StatCard title="Prescriptions" value={stats.prescriptionsWritten} icon={FaPrescription} color="green" subtitle="DAILY ORDERS" />
                                <StatCard title="Total Prescriptions" value={stats.totalPrescriptions} icon={FaHistory} color="teal" subtitle="LIFETIME SCRIPTS" />
                            </>
                        )}
                        {user.role === 'cashier' && (
                            <>
                                <StatCard title="Collected Today" value={stats.paymentsCollected} icon={FaCreditCard} color="green" subtitle="DAILY REVENUE" />
                                <StatCard title="Lifetime Revenue" value={stats.lifetimeRevenue} icon={FaHistory} color="purple" subtitle="CUMULATIVE" />
                                <StatCard title="Receipts Today" value={stats.receiptsIssued} icon={FaReceipt} color="blue" subtitle="PROCESSED" />
                                <StatCard title="Total Receipts" value={stats.totalReceipts} icon={FaChartBar} color="orange" subtitle="LIFETIME COUNT" />
                            </>
                        )}
                        {user.role === 'pharmacist' && (
                            <>
                                <StatCard title="Dispensed Today" value={stats.dispensedToday} icon={FaPrescription} color="emerald" subtitle="SALES VOLUME" />
                                <StatCard title="Lifetime Dispensed" value={stats.totalDispensed} icon={FaHistory} color="teal" subtitle="CUMULATIVE SALES" />
                                <StatCard title="Pharmacy Revenue" value={stats.revenueToday} icon={FaCreditCard} color="blue" subtitle="TODAY'S CASH" />
                                <StatCard title="Lifetime Revenue" value={stats.lifetimeRevenue} icon={FaFileInvoiceDollar} color="indigo" subtitle="TOTAL INCOME" />
                            </>
                        )}
                        {user.role === 'lab_technician' && (
                            <>
                                <StatCard title="Results Today" value={stats.testsToday} icon={FaFlask} color="purple" subtitle="REPORTS SIGNED" />
                                <StatCard title="Lifetime Results" value={stats.totalTestsSigned} icon={FaHistory} color="violet" subtitle="TOTAL DIAGNOSTICS" />
                                <StatCard title="Lab Efficiency" value={stats.testsToday || 0} icon={FaChartBar} color="fuchsia" subtitle="DAILY THROUGHPUT" />
                                <StatCard title="Total Impact" value={stats.totalTestsSigned || 0} icon={FaVials} color="pink" subtitle="CUMULATIVE LOAD" />
                            </>
                        )}
                        {user.role === 'radiologist' && (
                            <>
                                <StatCard title="Imaging Today" value={stats.scansToday} icon={FaMicroscope} color="indigo" subtitle="REPORTS SIGNED" />
                                <StatCard title="Lifetime Imaging" value={stats.totalScansSigned} icon={FaHistory} color="blue" subtitle="TOTAL SCANS" />
                                <StatCard title="Scan Volume" value={stats.scansToday || 0} icon={FaChartBar} color="sky" subtitle="DAILY OUTPUT" />
                                <StatCard title="Total Reach" value={stats.totalScansSigned || 0} icon={FaXRay || FaMicroscope} color="cyan" subtitle="CUMULATIVE CARE" />
                            </>
                        )}
                    </div>
                )}

                {/* Navigation Section */}
                <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="w-1 h-6 bg-green-500 rounded-full"></span> Quick Access & Navigation
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {/* My Profile - Standard for all */}
                        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:border-green-300 group transition-all duration-300">
                            <h3 className="text-lg font-bold mb-2 group-hover:text-green-600 transition-colors">My Profile</h3>
                            <p className="text-gray-500 text-sm mb-4 truncate">{user.email}</p>
                            <span className="inline-block px-3 py-1 rounded bg-gray-100 text-gray-600 text-xs font-bold uppercase">{user.role}</span>
                        </div>

                        {/* Role Specific Actions */}
                        {user.role === 'doctor' && (
                            <>
                                <div onClick={() => navigate('/patients')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-blue-400 transition group">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                                        <FaUserCheck size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2">Patients</h3>
                                    <p className="text-gray-500 text-sm">Clinical list & prescriptions.</p>
                                </div>
                                <div onClick={() => navigate('/appointments')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-blue-400 transition group">
                                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition">
                                        <FaCalendarAlt size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2">Appointments</h3>
                                    <p className="text-gray-500 text-sm">View scheduled visits.</p>
                                </div>
                            </>
                        )}

                        {user.role === 'pharmacist' && (
                            <>
                                <div onClick={() => navigate('/pharmacy/prescriptions')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-green-400 transition group">
                                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition">
                                        <FaPrescription size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 text-green-700">Prescriptions</h3>
                                    <p className="text-gray-500 text-sm">Dispense medicines.</p>
                                </div>
                                <div onClick={() => navigate('/pharmacy/inventory')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-green-400 transition group">
                                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition">
                                        <FaFlask size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 text-green-700">Inventory</h3>
                                    <p className="text-gray-500 text-sm">Manage medicine stock.</p>
                                </div>
                            </>
                        )}

                        {user.role === 'receptionist' && (
                            <div onClick={() => navigate('/front-desk')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-green-400 transition group">
                                <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition">
                                    <FaUserCheck size={20} />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-green-700">Front Desk</h3>
                                <p className="text-gray-500 text-sm">Register & check-in patients.</p>
                            </div>
                        )}

                        {user.role === 'nurse' && (
                            <div onClick={() => navigate('/nurse/triage')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-pink-400 transition group">
                                <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-pink-600 group-hover:text-white transition">
                                    <FaUserNurse size={20} />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-pink-700">Triage Station</h3>
                                <p className="text-gray-500 text-sm">Record patient vitals.</p>
                            </div>
                        )}

                        {user.role === 'cashier' && (
                            <div onClick={() => navigate('/cashier')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-yellow-400 transition group">
                                <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-yellow-600 group-hover:text-white transition">
                                    <FaCreditCard size={20} />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-yellow-700">Cashier POS</h3>
                                <p className="text-gray-500 text-sm">Collect payments.</p>
                            </div>
                        )}

                        {user.role === 'lab_technician' && (
                            <div onClick={() => navigate('/lab')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-purple-400 transition group">
                                <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-purple-600 group-hover:text-white transition">
                                    <FaFlask size={20} />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-purple-700">Lab Dashboard</h3>
                                <p className="text-gray-500 text-sm">View & update lab orders.</p>
                            </div>
                        )}

                        {user.role === 'radiologist' && (
                            <div onClick={() => navigate('/radiology')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-indigo-400 transition group">
                                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-indigo-600 group-hover:text-white transition">
                                    <FaMicroscope size={20} />
                                </div>
                                <h3 className="text-lg font-bold mb-2 text-indigo-700">Radiology</h3>
                                <p className="text-gray-500 text-sm">View & update radiology orders.</p>
                            </div>
                        )}

                        {(user.role === 'admin' || user.role === 'super_admin' || user.role === 'readonly_admin') && (
                            <>
                                <div onClick={() => navigate('/admin')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-green-400 transition group">
                                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition">
                                        <FaChartBar size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 text-green-700">Admin Dashboard</h3>
                                    <p className="text-gray-500 text-sm">System Overview & Analytics.</p>
                                </div>
                                <div onClick={() => navigate('/nurse/triage')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-pink-400 transition group">
                                    <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-pink-600 group-hover:text-white transition">
                                        <FaUserNurse size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 text-pink-700">Triage Station</h3>
                                    <p className="text-gray-500 text-sm">Record patient vitals.</p>
                                </div>
                                <div onClick={() => navigate('/pharmacy/prescriptions')} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-lg hover:border-green-400 transition group">
                                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-lg flex items-center justify-center mb-4 group-hover:bg-green-600 group-hover:text-white transition">
                                        <FaPrescription size={20} />
                                    </div>
                                    <h3 className="text-lg font-bold mb-2 text-green-700">Pending Prescriptions</h3>
                                    <p className="text-gray-500 text-sm">Dispense medicines.</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Layout>
    );
};

export default Dashboard;
