import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaUserMd, FaPills, FaFlask, FaXRay, FaUserInjured, FaCalendarAlt, FaNotesMedical, FaSignOutAlt, FaTachometerAlt, FaDollarSign, FaFileInvoiceDollar, FaHeart, FaHospital, FaBed } from 'react-icons/fa';
import { useContext } from 'react';
import AuthContext from '../context/AuthContext';

const Sidebar = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();

    if (!user) {
        return null; // Don't render sidebar if user is not logged in
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path ? 'bg-green-700' : '';

    return (
        <div className="w-64 bg-green-800 text-white min-h-screen flex flex-col">
            <div className="p-6 text-2xl font-bold border-b border-green-700 flex items-center gap-2">
                <FaNotesMedical /> SUD EMR
            </div>

            <nav className="flex-1 p-4 space-y-2">
                <Link to="/dashboard" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/dashboard')}`}>
                    <FaTachometerAlt />Dashboard
                </Link>

                {user.role === 'doctor' && (
                    <>
                        <Link to="/patients" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/patients')}`}>
                            <FaUserInjured /> Patients
                        </Link>
                        <Link to="/appointments" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/appointments')}`}>
                            <FaCalendarAlt /> Appointments
                        </Link>

                    </>
                )}

                {user.role === 'nurse' && (
                    <>
                        <Link to="/nurse/triage" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/nurse/triage')}`}>
                            <FaUserMd /> Triage / Vitals
                        </Link>
                        <Link to="/nurse/services" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/nurse/services')}`}>
                            <FaHeart /> Manage Nurse Services
                        </Link>
                    </>
                )}

                {user.role === 'receptionist' && (
                    <>
                        <Link to="/front-desk" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/front-desk')}`}>
                            <FaUserInjured /> Front Desk
                        </Link>
                        <Link to="/front-desk/patients" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/front-desk/patients')}`}>
                            <FaUserInjured /> Patient Management
                        </Link>
                        <Link to="/appointments" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/appointments')}`}>
                            <FaCalendarAlt /> Appointments
                        </Link>
                    </>
                )}

                {user.role === 'cashier' && (
                    <>
                        <Link to="/cashier" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/cashier')}`}>
                            <FaDollarSign /> Cashier
                        </Link>
                        <Link to="/billing" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/billing')}`}>
                            <FaFileInvoiceDollar /> Billing (New)
                        </Link>
                    </>
                )}

                {user.role === 'pharmacist' && (
                    <>
                        <Link to="/pharmacy/prescriptions" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/pharmacy/prescriptions')}`}>
                            <FaPills /> Prescriptions
                        </Link>
                        <Link to="/pharmacy/external-investigations" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/pharmacy/external-investigations')}`}>
                            <FaPills /> External Pharmacy
                        </Link>
                        <Link to="/pharmacy/inventory" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/pharmacy/inventory')}`}>
                            <FaPills /> Inventory
                        </Link>
                    </>
                )}

                {user.role === 'lab_technician' && (
                    <>
                        <Link to="/lab" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/lab')}`}>
                            <FaFlask /> Lab Orders
                        </Link>
                        <Link to="/lab/external-investigations" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/lab/external-investigations')}`}>
                            <FaFlask /> External Investigations
                        </Link>
                        <Link to="/lab/manage-tests" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/lab/manage-tests')}`}>
                            <FaFlask /> Manage Lab Tests
                        </Link>
                    </>
                )}


                {user.role === 'lab_scientist' && (
                    <>
                        <Link to="/lab" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/lab')}`}>
                            <FaFlask /> Lab Orders
                        </Link>
                        <Link to="/lab/external-investigations" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/lab/external-investigations')}`}>
                            <FaFlask /> External Investigations
                        </Link>
                        <Link to="/lab/manage-tests" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/lab/manage-tests')}`}>
                            <FaFlask /> Manage Lab Tests
                        </Link>
                    </>
                )}

                {user.role === 'radiologist' && (
                    <>
                        <Link to="/radiology" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/radiology')}`}>
                            <FaXRay /> Radiology Orders
                        </Link>
                        <Link to="/radiology/external-investigations" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/radiology/external-investigations')}`}>
                            <FaXRay /> External Radiology
                        </Link>
                        <Link to="/radiology/manage-tests" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/radiology/manage-tests')}`}>
                            <FaXRay /> Manage Radiology Tests
                        </Link>
                    </>
                )}

                {user.role === 'admin' && (
                    <>

                        <Link to="/admin/users" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/admin/users')}`}>
                            <FaUserMd /> User Management
                        </Link>
                        <Link to="/admin/patients" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/admin/patients')}`}>
                            <FaUserInjured /> Patient Management
                        </Link>
                        <Link to="/admin/reports" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/admin/reports')}`}>
                            <FaDollarSign /> Revenue Reports
                        </Link>
                        <Link to="/nurse/services" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/nurse/services')}`}>
                            <FaHeart /> Manage Nurse Services
                        </Link>
                        <Link to="/lab/manage-tests" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/lab/manage-tests')}`}>
                            <FaFlask /> Manage Lab Tests
                        </Link>
                        <Link to="/radiology/manage-tests" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/radiology/manage-tests')}`}>
                            <FaXRay /> Manage Radiology Tests
                        </Link>
                        <Link to="/admin/clinics" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/admin/clinics')}`}>
                            <FaHospital /> Clinic Management
                        </Link>
                        <Link to="/admin/front-desk-charges" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/admin/front-desk-charges')}`}>
                            <FaDollarSign /> Front Desk Charges
                        </Link>
                        <Link to="/admin/wards" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/admin/wards')}`}>
                            <FaBed /> Ward Management
                        </Link>
                        <Link to="/pharmacy/inventory" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/pharmacy/inventory')}`}>
                            <FaPills /> Inventory
                        </Link>
                        <Link to="/appointments" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/appointments')}`}>
                            <FaCalendarAlt /> Appointments
                        </Link>
                        <Link to="/billing" className={`flex items-center gap-3 p-3 rounded hover:bg-green-700 transition ${isActive('/billing')}`}>
                            <FaDollarSign /> Billing
                        </Link>
                    </>
                )}
            </nav>

            <div className="p-4 border-t border-green-700">
                <div className="flex items-center gap-3 mb-4 px-3">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center font-bold">
                        {user.name[0]}
                    </div>
                    <div>
                        <p className="text-sm font-semibold">{user.name}</p>
                        <p className="text-xs text-green-300 capitalize">{user.role}</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center gap-2 bg-red-600 p-2 rounded hover:bg-red-700 transition"
                >
                    <FaSignOutAlt /> Logout
                </button>
            </div>
        </div>
    );
};

export default Sidebar;
