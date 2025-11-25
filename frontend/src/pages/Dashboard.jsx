import { useContext } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import AdminDashboard from './AdminDashboard';

const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    if (!user) {
        return <p>Loading...</p>;
    }

    // Show AdminDashboard for admin users
    if (user.role === 'admin') {
        return <AdminDashboard />;
    }

    return (
        <Layout>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Common Stats */}
                <div className="bg-white p-6 rounded shadow border-t-4 border-green-500">
                    <h3 className="text-lg font-semibold mb-2">My Profile</h3>
                    <p className="text-gray-600">Email: {user.email}</p>
                    <p className="text-gray-600">Role: <span className="capitalize">{user.role}</span></p>
                </div>

                {/* Role Specific Content */}
                {user.role === 'doctor' && (
                    <>
                        <div
                            onClick={() => navigate('/patients')}
                            className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-blue-500"
                        >
                            <h3 className="text-lg font-semibold mb-2 text-blue-600">Patients</h3>
                            <p className="text-gray-500">View patients and create prescriptions/orders.</p>
                        </div>
                        <div
                            onClick={() => navigate('/appointments')}
                            className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-blue-500"
                        >
                            <h3 className="text-lg font-semibold mb-2 text-blue-600">Appointments</h3>
                            <p className="text-gray-500">View scheduled appointments.</p>
                        </div>
                    </>
                )}

                {user.role === 'pharmacist' && (
                    <>
                        <div
                            onClick={() => navigate('/pharmacy/prescriptions')}
                            className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-green-500"
                        >
                            <h3 className="text-lg font-semibold mb-2 text-green-600">Pending Prescriptions</h3>
                            <p className="text-gray-500">View and dispense medicines.</p>
                        </div>
                        <div
                            onClick={() => navigate('/pharmacy/inventory')}
                            className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-green-500"
                        >
                            <h3 className="text-lg font-semibold mb-2 text-green-600">Inventory</h3>
                            <p className="text-gray-500">Manage medicine stock.</p>
                        </div>
                    </>
                )}

                {user.role === 'lab_technician' && (
                    <div
                        onClick={() => navigate('/lab')}
                        className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-purple-500"
                    >
                        <h3 className="text-lg font-semibold mb-2 text-purple-600">Lab Dashboard</h3>
                        <p className="text-gray-500">View and update lab orders.</p>
                    </div>
                )}

                {user.role === 'radiologist' && (
                    <div
                        onClick={() => navigate('/radiology')}
                        className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-indigo-500"
                    >
                        <h3 className="text-lg font-semibold mb-2 text-indigo-600">Radiology Dashboard</h3>
                        <p className="text-gray-500">View and update radiology orders.</p>
                    </div>
                )}

                {user.role === 'nurse' && (
                    <div
                        onClick={() => navigate('/nurse/triage')}
                        className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-pink-500"
                    >
                        <h3 className="text-lg font-semibold mb-2 text-pink-600">Triage Station</h3>
                        <p className="text-gray-500">Record patient vitals.</p>
                    </div>
                )}

                {user.role === 'receptionist' && (
                    <div
                        onClick={() => navigate('/front-desk')}
                        className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-green-500"
                    >
                        <h3 className="text-lg font-semibold mb-2 text-green-600">Front Desk</h3>
                        <p className="text-gray-500">Register patients and create encounters.</p>
                    </div>
                )}

                {user.role === 'cashier' && (
                    <div
                        onClick={() => navigate('/cashier')}
                        className="bg-white p-6 rounded shadow cursor-pointer hover:shadow-md transition border-l-4 border-yellow-500"
                    >
                        <h3 className="text-lg font-semibold mb-2 text-yellow-600">Cashier</h3>
                        <p className="text-gray-500">Collect payments and issue receipts.</p>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default Dashboard;
