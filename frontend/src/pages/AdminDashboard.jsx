import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import {
    FaUsers, FaUserMd, FaDollarSign, FaFileInvoiceDollar,
    FaChartLine, FaHospital, FaPills, FaFlask, FaXRay,
    FaUserInjured, FaReceipt, FaChartBar
} from 'react-icons/fa';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import RegisterPatientModal from '../components/RegisterPatientModal';
import { formatCompactNumber, formatCurrency } from '../utils/formatters';

const AdminDashboard = () => {
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const [stats, setStats] = useState({
        totalPatients: 0,
        totalUsers: 0,
        totalInvoices: 0,
        totalReceipts: 0,
        totalRevenue: 0,
        pendingPayments: 0,
        pendingHMOAmount: 0
    });

    const [revenueByDepartment, setRevenueByDepartment] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [activeTab, setActiveTab] = useState('overview'); // overview, reports, users
    const [settings, setSettings] = useState(null);
    const [showRegisterPatientModal, setShowRegisterPatientModal] = useState(false);
    const [totalPatientDeposits, setTotalPatientDeposits] = useState(0);
    const [totalRetainershipBalance, setTotalRetainershipBalance] = useState(0);

    useEffect(() => {
        if (user && (user.role === 'admin' || user.role === 'super_admin' || user.role === 'readonly_admin')) {
            fetchDashboardData();
            fetchSettings();
        }
    }, [user]);

    const fetchSettings = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/settings`);
            setSettings(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDashboardData = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Fetch dashboard stats from new API
            const { data } = await axios.get(`${backendUrl}/api/reports/dashboard-stats`, config);

            setStats({
                totalPatients: data.patients.total,
                totalUsers: data.counts.users,
                totalInvoices: data.counts.charges, // Using charges count as invoices
                totalReceipts: data.counts.receipts,
                totalRevenue: data.revenue.total,
                pendingPayments: data.pendingPayments,
                pendingHMOAmount: data.pendingHMOAmount,
                dashboardStats: data
            });

            setRevenueByDepartment(data.revenueByDepartment);

            // Fetch patient deposit balance sum
            const { data: patientsData } = await axios.get(`${backendUrl}/api/patients`, config);
            const patTotal = patientsData.reduce((sum, p) => sum + (p.depositBalance || 0), 0);
            setTotalPatientDeposits(patTotal);

            // Fetch HMO retainership deposit balance
            const { data: hmoData } = await axios.get(`${backendUrl}/api/hmo-transactions/total-retainership-balance`, config);
            setTotalRetainershipBalance(hmoData.balance || 0);

        } catch (error) {
            console.error(error);
            toast.error('Error fetching dashboard data');
        }
    };

    const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#6b7280'];

    return (
        <Layout>
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                    <FaChartLine className="text-green-600" />
                    Admin Dashboard
                </h1>
                <p className="text-gray-600 mt-2">System Overview & Analytics</p>
            </div>

            {/* Tab Navigation */}
            <div className="bg-white rounded shadow mb-6">
                <div className="flex border-b">
                    <button
                        className={`flex-1 p-4 font-semibold flex items-center justify-center gap-2 ${activeTab === 'overview'
                            ? 'bg-green-50 text-green-600 border-b-2 border-green-600'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <FaChartBar /> Overview
                    </button>
                    <button
                        className={`flex-1 p-4 font-semibold flex items-center justify-center gap-2 ${activeTab === 'reports'
                            ? 'bg-blue-50 text-blue-600 border-b-2 border-blue-600'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        onClick={() => setActiveTab('reports')}
                    >
                        <FaFileInvoiceDollar /> Reports & Analytics
                    </button>
                    <button
                        className={`flex-1 p-4 font-semibold flex items-center justify-center gap-2 ${activeTab === 'system'
                            ? 'bg-purple-50 text-purple-600 border-b-2 border-purple-600'
                            : 'text-gray-500 hover:bg-gray-50'
                            }`}
                        onClick={() => setActiveTab('system')}
                    >
                        <FaHospital /> System Info
                    </button>
                </div>
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Total Patients */}
                        <div className="group bg-white p-6 rounded-2xl border border-blue-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaUserInjured className="text-6xl text-blue-600" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-blue-500 text-xs font-bold uppercase tracking-wider mb-1">Total Patients</p>
                                <h3 className="text-3xl font-extrabold text-blue-900 mb-1">{formatCompactNumber(stats.totalPatients)}</h3>
                                <div className="flex items-center text-xs text-blue-400 font-medium">
                                    <span className="bg-blue-50 px-2 py-0.5 rounded-full">Registered in system</span>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-blue-50 absolute bottom-0 left-0">
                                <div className="h-full bg-blue-500 rounded-r-full group-hover:w-full transition-all duration-700" style={{ width: '40%' }}></div>
                            </div>
                        </div>

                        {/* Total Revenue */}
                        <div className="group bg-white p-6 rounded-2xl border border-green-100 shadow-sm hover:shadow-xl hover:border-green-200 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaDollarSign className="text-6xl text-green-600" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-green-500 text-xs font-bold uppercase tracking-wider mb-1">Total Revenue</p>
                                <h3 className="text-3xl font-extrabold text-green-900 mb-1">{formatCurrency(stats.totalRevenue, true)}</h3>
                                <div className="flex items-center text-xs text-green-400 font-medium">
                                    <span className="bg-green-50 px-2 py-0.5 rounded-full">All-time collected</span>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-green-50 absolute bottom-0 left-0">
                                <div className="h-full bg-green-500 rounded-r-full group-hover:w-full transition-all duration-700" style={{ width: '70%' }}></div>
                            </div>
                        </div>

                        {/* Pending Payments */}
                        <div className="group bg-white p-6 rounded-2xl border border-yellow-100 shadow-sm hover:shadow-xl hover:border-yellow-200 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaFileInvoiceDollar className="text-6xl text-yellow-600" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-1">Pending Payments</p>
                                <h3 className="text-3xl font-extrabold text-yellow-900 mb-1">{formatCurrency(stats.pendingPayments, true)}</h3>
                                <div className="flex items-center text-xs text-yellow-400 font-medium">
                                    <span className="bg-yellow-50 px-2 py-0.5 rounded-full">Awaiting collection</span>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-yellow-50 absolute bottom-0 left-0">
                                <div className="h-full bg-yellow-500 rounded-r-full group-hover:w-full transition-all duration-700" style={{ width: '30%' }}></div>
                            </div>
                        </div>

                        {/* Pending to HMOs */}
                        <div className="group bg-white p-6 rounded-2xl border border-orange-100 shadow-sm hover:shadow-xl hover:border-orange-200 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaHospital className="text-6xl text-orange-600" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-orange-500 text-xs font-bold uppercase tracking-wider mb-1">Pending to HMOs</p>
                                <h3 className="text-3xl font-extrabold text-orange-900 mb-1">{formatCurrency(stats.pendingHMOAmount, true)}</h3>
                                <div className="flex items-center text-xs text-orange-400 font-medium">
                                    <span className="bg-orange-50 px-2 py-0.5 rounded-full">Unpaid insurance claims</span>
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-orange-50 absolute bottom-0 left-0">
                                <div className="h-full bg-orange-500 rounded-r-full group-hover:w-full transition-all duration-700" style={{ width: '55%' }}></div>
                            </div>
                        </div>

                        {/* Total Deposit Balance */}
                        <div className="group bg-white p-6 rounded-2xl border border-purple-100 shadow-sm hover:shadow-xl hover:border-purple-200 transition-all duration-300 relative overflow-hidden lg:col-span-2">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaReceipt className="text-7xl text-purple-600" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-purple-500 text-xs font-bold uppercase tracking-wider mb-1">Total Deposit Balance</p>
                                <h3 className="text-4xl font-black text-purple-900 mb-1">{formatCurrency(totalPatientDeposits + totalRetainershipBalance, true)}</h3>
                                <div className="grid grid-cols-2 gap-4 mt-3">
                                    <div className="bg-purple-50 p-2 rounded-xl border border-purple-100">
                                        <p className="text-[10px] text-purple-400 uppercase font-bold">Patients</p>
                                        <p className="font-bold text-purple-700">{formatCurrency(totalPatientDeposits, true)}</p>
                                    </div>
                                    <div className="bg-indigo-50 p-2 rounded-xl border border-indigo-100">
                                        <p className="text-[10px] text-indigo-400 uppercase font-bold">Retainership</p>
                                        <p className="font-bold text-indigo-700">{formatCurrency(totalRetainershipBalance, true)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* System Users */}
                        <div className="group bg-white p-6 rounded-2xl border border-pink-100 shadow-sm hover:shadow-xl hover:border-pink-200 transition-all duration-300 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <FaUsers className="text-6xl text-pink-600" />
                            </div>
                            <div className="relative z-10">
                                <p className="text-pink-500 text-xs font-bold uppercase tracking-wider mb-1">System Users</p>
                                <h3 className="text-3xl font-extrabold text-pink-900 mb-1">{stats.totalUsers}</h3>
                                <div className="flex items-center text-xs text-pink-400 font-medium">
                                    <span className="bg-pink-50 px-2 py-0.5 rounded-full">Active staff accounts</span>
                                </div>
                            </div>
                        </div>

                        {/* Total Invoices/Receipts Combined */}
                        <div className="group bg-white p-6 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all duration-300 relative overflow-hidden">
                            <div className="flex flex-col gap-4">
                                <div>
                                    <p className="text-indigo-500 text-[10px] font-bold uppercase tracking-wider">Total Invoices</p>
                                    <h4 className="text-xl font-bold text-indigo-900">{formatCompactNumber(stats.totalInvoices)}</h4>
                                </div>
                                <div className="border-t border-indigo-50 pt-2">
                                    <p className="text-indigo-500 text-[10px] font-bold uppercase tracking-wider">Total Receipts</p>
                                    <h4 className="text-xl font-bold text-indigo-900">{formatCompactNumber(stats.totalReceipts)}</h4>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Charts Section in Overview */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-800">Revenue Performance</h3>
                                <span className="text-xs bg-green-50 text-green-600 px-3 py-1 rounded-full font-bold">LIVE DATA</span>
                            </div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={revenueByDepartment}>
                                        <defs>
                                            <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <XAxis dataKey="name" hide />
                                        <YAxis hide />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => formatCurrency(value)}
                                        />
                                        <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-bold text-gray-800">Revenue Contribution</h3>
                                <p className="text-xs text-gray-400">By Department</p>
                            </div>
                            <div className="h-64 relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={revenueByDepartment}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={5}
                                            dataKey="revenue"
                                        >
                                            {revenueByDepartment.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} cornerRadius={4} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                            formatter={(value) => formatCurrency(value)}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                    <p className="text-[10px] text-gray-400 uppercase font-black">Total</p>
                                    <p className="text-lg font-black text-gray-800">{formatCurrency(revenueByDepartment.reduce((acc, d) => acc + d.revenue, 0), true)}</p>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* Quick Actions */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-gray-800">Quick Actions</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            <div className="group p-5 bg-green-50 rounded-2xl border border-green-100 hover:shadow-lg transition-all duration-300 flex flex-col items-center gap-3 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-green-500 opacity-50"></div>
                                <FaUserInjured className="text-4xl text-green-600 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-black text-green-900 uppercase tracking-widest">Patients</span>
                                <div className="flex flex-col gap-2 w-full mt-2">
                                    <Link to="/admin/patients" className="w-full bg-white text-green-600 text-[10px] font-bold py-2 rounded-xl text-center border border-green-200 hover:bg-green-600 hover:text-white shadow-sm transition-colors">
                                        VIEW RECORDS
                                    </Link>
                                    {user.role !== 'readonly_admin' && (
                                        <button
                                            onClick={() => setShowRegisterPatientModal(true)}
                                            className="w-full bg-green-600 text-white text-[10px] font-bold py-2 rounded-xl shadow-md shadow-green-200 hover:bg-green-700 transition-colors"
                                        >
                                            NEW REGISTRATION
                                        </button>
                                    )}
                                </div>
                            </div>

                            <Link to="/billing" className="group p-5 bg-blue-50 rounded-2xl border border-blue-100 hover:shadow-lg transition-all duration-300 flex flex-col items-center justify-center gap-3 relative overflow-hidden text-center">
                                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-50"></div>
                                <FaDollarSign className="text-4xl text-blue-600 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-black text-blue-900 uppercase tracking-widest">Billing</span>
                                <p className="text-[10px] text-blue-400 font-medium">Manage Revenue</p>
                            </Link>

                            <Link to="/admin/users" className="group p-5 bg-purple-50 rounded-2xl border border-purple-100 hover:shadow-lg transition-all duration-300 flex flex-col items-center justify-center gap-3 relative overflow-hidden text-center">
                                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500 opacity-50"></div>
                                <FaUsers className="text-4xl text-purple-600 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-black text-purple-900 uppercase tracking-widest">Users</span>
                                <p className="text-[10px] text-purple-400 font-medium">Staff Accounts</p>
                            </Link>

                            <Link to="/admin/reports" className="group p-5 bg-indigo-50 rounded-2xl border border-indigo-100 hover:shadow-lg transition-all duration-300 flex flex-col items-center justify-center gap-3 relative overflow-hidden text-center">
                                <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 opacity-50"></div>
                                <FaChartLine className="text-4xl text-indigo-600 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-black text-indigo-900 uppercase tracking-widest">Analytic</span>
                                <p className="text-[10px] text-indigo-400 font-medium">System Reports</p>
                            </Link>
                        </div>
                    </div>
                </div>
            )}

            {/* Reports Tab */}
            {activeTab === 'reports' && (
                <div className="space-y-6">
                    {/* Revenue by Department - Bar Chart */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                            <FaChartBar className="text-green-600" />
                            Revenue by Department
                        </h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={revenueByDepartment}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="revenue" fill="#10b981" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Revenue Distribution - Pie Chart */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Revenue Distribution</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={revenueByDepartment}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="revenue"
                                >
                                    {revenueByDepartment.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Department Summary Table */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Department Revenue Summary</h3>
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="p-3 border-b">Department</th>
                                    <th className="p-3 border-b">Revenue</th>
                                    <th className="p-3 border-b">Percentage</th>
                                </tr>
                            </thead>
                            <tbody>
                                {revenueByDepartment.map((dept, idx) => {
                                    const total = revenueByDepartment.reduce((acc, d) => acc + d.revenue, 0);
                                    const percentage = ((dept.revenue / total) * 100).toFixed(1);
                                    return (
                                        <tr key={idx} className="hover:bg-gray-50">
                                            <td className="p-3 border-b font-semibold">{dept.name}</td>
                                            <td className="p-3 border-b text-green-600 font-bold">{formatCurrency(dept.revenue)}</td>
                                            <td className="p-3 border-b">{percentage}%</td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-gray-100 font-bold">
                                    <td className="p-3 border-b">Total</td>
                                    <td className="p-3 border-b text-green-700">
                                        {formatCurrency(revenueByDepartment.reduce((acc, d) => acc + d.revenue, 0))}
                                    </td>
                                    <td className="p-3 border-b">100%</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* System Info Tab */}
            {activeTab === 'system' && (
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
                            <FaHospital className="text-green-600" />
                            System Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-3">Application Details</h4>
                                <div className="space-y-2 text-sm">
                                    <p><span className="font-semibold">Name:</span> {settings?.hospitalName || 'SUD EMR'}</p>
                                    <p><span className="font-semibold">Version:</span> {settings?.systemVersion || '4.0'}</p>
                                    <p><span className="font-semibold">Environment:</span> {settings?.environment || 'Production'}</p>
                                    <p><span className="font-semibold">Database:</span> {settings?.database || 'MongoDB'}</p>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold text-gray-700 mb-3">Modules Enabled</h4>
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <FaUserMd className="text-green-600" />
                                        <span>Clinical (SOAP Notes, Visits)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <FaPills className="text-green-600" />
                                        <span>Pharmacy (Prescriptions, Inventory)</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <FaFlask className="text-green-600" />
                                        <span>Laboratory</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <FaXRay className="text-green-600" />
                                        <span>Radiology</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <FaDollarSign className="text-green-600" />
                                        <span>Billing & Revenue Cycle</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* User Roles Summary */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">User Roles</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-blue-50 rounded text-center">
                                <FaUserMd className="text-3xl text-blue-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-blue-800">Doctors</p>
                            </div>
                            <div className="p-4 bg-purple-50 rounded text-center">
                                <FaPills className="text-3xl text-purple-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-purple-800">Pharmacists</p>
                            </div>
                            <div className="p-4 bg-green-50 rounded text-center">
                                <FaUsers className="text-3xl text-green-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-green-800">Nurses</p>
                            </div>
                            <div className="p-4 bg-yellow-50 rounded text-center">
                                <FaDollarSign className="text-3xl text-yellow-600 mx-auto mb-2" />
                                <p className="text-2xl font-bold text-yellow-800">Cashiers</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Register Patient Modal */}
            <RegisterPatientModal
                isOpen={showRegisterPatientModal}
                onClose={() => setShowRegisterPatientModal(false)}
                onSuccess={() => {
                    setShowRegisterPatientModal(false);
                    // Could add a refresh or notification here
                }}
                userToken={user.token}
            />
        </Layout>
    );
};

export default AdminDashboard;
