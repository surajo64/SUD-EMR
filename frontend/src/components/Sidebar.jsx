import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaUserMd, FaPills, FaFlask, FaXRay, FaUserInjured, FaCalendarAlt, FaNotesMedical, FaSignOutAlt, FaTachometerAlt, FaDollarSign, FaFileInvoiceDollar, FaHeart, FaHospital, FaBed, FaChevronDown, FaChevronRight, FaCogs, FaMoneyBillWave, FaExchangeAlt, FaTrash } from 'react-icons/fa';
import { useContext, useState } from 'react';
import AuthContext from '../context/AuthContext';

const Sidebar = () => {
    const { user, logout } = useContext(AuthContext);
    const location = useLocation();
    const navigate = useNavigate();
    const [openDropdown, setOpenDropdown] = useState('');

    if (!user) {
        return null; // Don't render sidebar if user is not logged in
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isActive = (path) => location.pathname === path ? 'bg-green-700' : '';

    const toggleDropdown = (name) => {
        setOpenDropdown(openDropdown === name ? '' : name);
    };

    const SidebarDropdown = ({ title, icon, name, children }) => (
        <div className="mb-1">
            <button
                onClick={() => toggleDropdown(name)}
                className={`w-full flex items-center justify-between p-3 rounded hover:bg-green-700 transition ${openDropdown === name ? 'bg-green-700' : ''}`}
            >
                <div className="flex items-center gap-3">
                    {icon}
                    <span>{title}</span>
                </div>
                {openDropdown === name ? <FaChevronDown size={12} /> : <FaChevronRight size={12} />}
            </button>
            {openDropdown === name && (
                <div className="ml-4 mt-1 space-y-1 border-l-2 border-green-600 pl-2">
                    {children}
                </div>
            )}
        </div>
    );

    return (
        <div className="w-64 bg-green-800 text-white min-h-screen flex flex-col">
            <div className="p-6 text-2xl font-bold border-b border-green-700 flex items-center gap-2">
                <FaNotesMedical /> SUD EMR
            </div>

            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
                        <SidebarDropdown title="General Management" icon={<FaCogs />} name="general">
                            <Link to="/admin/users" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/admin/users')}`}>
                                <FaUserMd size={14} /> Users
                            </Link>
                            <Link to="/admin/patients" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/admin/patients')}`}>
                                <FaUserInjured size={14} /> Patients
                            </Link>
                            <Link to="/admin/clinics" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/admin/clinics')}`}>
                                <FaHospital size={14} /> Clinics
                            </Link>
                            <Link to="/admin/wards" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/admin/wards')}`}>
                                <FaBed size={14} /> Wards
                            </Link>
                            <Link to="/appointments" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/appointments')}`}>
                                <FaCalendarAlt size={14} /> Appointments
                            </Link>
                        </SidebarDropdown>

                        <SidebarDropdown title="Service Management" icon={<FaHeart />} name="services">
                            <Link to="/nurse/services" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/nurse/services')}`}>
                                <FaHeart size={14} /> Nurse Services
                            </Link>
                            <Link to="/lab/manage-tests" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/lab/manage-tests')}`}>
                                <FaFlask size={14} /> Lab Services
                            </Link>
                            <Link to="/radiology/manage-tests" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/radiology/manage-tests')}`}>
                                <FaXRay size={14} /> Radiology Services
                            </Link>
                            <Link to="/admin/front-desk-charges" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/admin/front-desk-charges')}`}>
                                <FaDollarSign size={14} /> Front Desk Charges
                            </Link>
                        </SidebarDropdown>

                        <SidebarDropdown title="Manage Pharmacy" icon={<FaPills />} name="pharmacy">
                            <Link to="/pharmacy/inventory" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/pharmacy/inventory')}`}>
                                <FaPills size={14} /> Inventory
                            </Link>
                            <Link to="/admin/pharmacies" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/admin/pharmacies')}`}>
                                <FaHospital size={14} /> Pharmacy Locations
                            </Link>
                            <Link to="/pharmacy/transfers" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/pharmacy/transfers')}`}>
                                <FaExchangeAlt size={14} /> Drug Transfers
                            </Link>
                            <Link to="/pharmacy/disposal" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/pharmacy/disposal')}`}>
                                <FaTrash size={14} /> Drug Disposal
                            </Link>
                            <Link to="/admin/drug-metadata" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/admin/drug-metadata')}`}>
                                <FaPills size={14} /> Drug Metadata
                            </Link>
                        </SidebarDropdown>

                        <SidebarDropdown title="Financials" icon={<FaMoneyBillWave />} name="financials">
                            <Link to="/billing" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/billing')}`}>
                                <FaFileInvoiceDollar size={14} /> Billing
                            </Link>
                            <Link to="/admin/reports" className={`flex items-center gap-3 p-2 rounded hover:bg-green-600 transition ${isActive('/admin/reports')}`}>
                                <FaDollarSign size={14} /> Revenue Reports
                            </Link>
                        </SidebarDropdown>
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
