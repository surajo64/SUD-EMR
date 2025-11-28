import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import {
    FaUsers, FaUserMd, FaDollarSign, FaFileInvoiceDollar,
    FaChartLine, FaHospital, FaPills, FaFlask, FaXRay,
    FaUserInjured, FaReceipt, FaChartBar
} from 'react-icons/fa';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import RegisterPatientModal from '../components/RegisterPatientModal';

const AdminDashboard = () => {
    const { user } = useContext(AuthContext);
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
    const [showRegisterPatientModal, setShowRegisterPatientModal] = useState(false);

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchDashboardData();
        }
    }, [user]);

    const fetchDashboardData = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Fetch dashboard stats from new API
            const { data } = await axios.get('http://localhost:5000/api/reports/dashboard-stats', config);

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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Total Patients */}
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-lg shadow hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-blue-600 text-sm font-semibold mb-2">Total Patients</p>
                                    <p className="text-4xl font-bold text-blue-800">{stats.totalPatients}</p>
                                    <p className="text-sm text-blue-600 mt-2">Registered in system</p>
                                </div>
                                <FaUserInjured className="text-5xl text-blue-400 opacity-50" />
                            </div>
                        </div>

                        {/* Total Revenue */}
                        <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-lg shadow hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-green-600 text-sm font-semibold mb-2">Total Revenue</p>
                                    <p className="text-4xl font-bold text-green-800">₦{stats.totalRevenue.toLocaleString()}</p>
                                    <p className="text-sm text-green-600 mt-2">All-time collected</p>
                                </div>
                                <FaDollarSign className="text-5xl text-green-400 opacity-50" />
                            </div>
                        </div>

                        {/* Pending Payments */}
                        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 rounded-lg shadow hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-yellow-600 text-sm font-semibold mb-2">Pending Payments</p>
                                    <p className="text-4xl font-bold text-yellow-800">₦{stats.pendingPayments.toLocaleString()}</p>
                                    <p className="text-sm text-yellow-600 mt-2">Awaiting collection</p>
                                </div>
                                <FaFileInvoiceDollar className="text-5xl text-yellow-400 opacity-50" />
                            </div>
                        </div>

                        {/* Pending to HMOs */}
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-lg shadow hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-orange-600 text-sm font-semibold mb-2">Pending to HMOs</p>
                                    <p className="text-4xl font-bold text-orange-800">₦{stats.pendingHMOAmount.toLocaleString()}</p>
                                    <p className="text-sm text-orange-600 mt-2">Unpaid insurance claims</p>
                                </div>
                                <FaFileInvoiceDollar className="text-5xl text-orange-400 opacity-50" />
                            </div>
                        </div>

                        {/* Total Users */}
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-lg shadow hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-purple-600 text-sm font-semibold mb-2">System Users</p>
                                    <p className="text-4xl font-bold text-purple-800">{stats.totalUsers}</p>
                                    <p className="text-sm text-purple-600 mt-2">Active staff accounts</p>
                                </div>
                                <FaUsers className="text-5xl text-purple-400 opacity-50" />
                            </div>
                        </div>

                        {/* Total Invoices */}
                        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 rounded-lg shadow hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-indigo-600 text-sm font-semibold mb-2">Total Invoices</p>
                                    <p className="text-4xl font-bold text-indigo-800">{stats.totalInvoices}</p>
                                    <p className="text-sm text-indigo-600 mt-2">Generated invoices</p>
                                </div>
                                <FaFileInvoiceDollar className="text-5xl text-indigo-400 opacity-50" />
                            </div>
                        </div>

                        {/* Total Receipts */}
                        <div className="bg-gradient-to-br from-pink-50 to-pink-100 p-6 rounded-lg shadow hover:shadow-md transition">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-pink-600 text-sm font-semibold mb-2">Total Receipts</p>
                                    <p className="text-4xl font-bold text-pink-800">{stats.totalReceipts}</p>
                                    <p className="text-sm text-pink-600 mt-2">Payment receipts issued</p>
                                </div>
                                <FaReceipt className="text-5xl text-pink-400 opacity-50" />
                            </div>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-xl font-bold mb-4 text-gray-800">Quick Actions</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition flex flex-col items-center gap-2">
                                <FaUserInjured className="text-3xl text-green-600" />
                                <span className="text-sm font-semibold text-gray-700">Manage Patients</span>
                                <div className="flex gap-2 w-full mt-2">
                                    <Link to="/admin/patients" className="flex-1 bg-green-600 text-white text-xs px-3 py-1 rounded hover:bg-green-700 text-center">
                                        View All
                                    </Link>
                                    <button
                                        onClick={() => setShowRegisterPatientModal(true)}
                                        className="flex-1 bg-blue-600 text-white text-xs px-3 py-1 rounded hover:bg-blue-700"
                                    >
                                        Register
                                    </button>
                                </div>
                            </div>
                            <Link to="/billing" className="p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition flex flex-col items-center gap-2">
                                <FaDollarSign className="text-3xl text-blue-600" />
                                <span className="text-sm font-semibold text-gray-700">View Billing</span>
                            </Link>
                            <Link to="/admin/users" className="p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition flex flex-col items-center gap-2">
                                <FaUsers className="text-3xl text-purple-600" />
                                <span className="text-sm font-semibold text-gray-700">Manage Users</span>
                            </Link>
                            <Link to="/admin/reports" className="p-4 border-2 border-indigo-200 rounded-lg hover:bg-indigo-50 transition flex flex-col items-center gap-2">
                                <FaChartLine className="text-3xl text-indigo-600" />
                                <span className="text-sm font-semibold text-gray-700">View Reports</span>
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
                                            <td className="p-3 border-b text-green-600 font-bold">${dept.revenue.toFixed(2)}</td>
                                            <td className="p-3 border-b">{percentage}%</td>
                                        </tr>
                                    );
                                })}
                                <tr className="bg-gray-100 font-bold">
                                    <td className="p-3 border-b">Total</td>
                                    <td className="p-3 border-b text-green-700">
                                        ${revenueByDepartment.reduce((acc, d) => acc + d.revenue, 0).toFixed(2)}
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
                                    <p><span className="font-semibold">Name:</span> SUD EMR</p>
                                    <p><span className="font-semibold">Version:</span> 4.0</p>
                                    <p><span className="font-semibold">Environment:</span> Production</p>
                                    <p><span className="font-semibold">Database:</span> MongoDB</p>
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
