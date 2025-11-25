import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaUsers, FaPlus, FaEdit, FaTrash, FaKey, FaSearch, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showResetModal, setShowResetModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        password: '',
        role: ''
    });
    const [newPassword, setNewPassword] = useState('');
    const { user } = useContext(AuthContext);

    useEffect(() => {
        if (user && user.role === 'admin') {
            fetchUsers();
        }
    }, [user]);

    useEffect(() => {
        filterUsers();
    }, [searchTerm, roleFilter, users]);

    const fetchUsers = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/users/all', config);
            setUsers(data);
            setFilteredUsers(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching users');
        }
    };

    const filterUsers = () => {
        let filtered = users;

        if (searchTerm) {
            filtered = filtered.filter(u =>
                u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                u.email.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (roleFilter !== 'all') {
            filtered = filtered.filter(u => u.role === roleFilter);
        }

        setFilteredUsers(filtered);
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post('http://localhost:5000/api/users', newUser, config);
            toast.success('User created successfully!');
            setShowAddModal(false);
            setNewUser({ name: '', email: '', password: '', role: 'nurse' });
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error creating user');
        }
    };

    const handleUpdateUser = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/users/${selectedUser._id}`, selectedUser, config);
            toast.success('User updated successfully!');
            setShowEditModal(false);
            setSelectedUser(null);
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error updating user');
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to deactivate this user?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/users/${userId}`, config);
            toast.success('User deactivated successfully!');
            fetchUsers();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error deactivating user');
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post(`http://localhost:5000/api/users/${selectedUser._id}/reset-password`,
                { newPassword },
                config
            );
            toast.success('Password reset successfully!');
            setShowResetModal(false);
            setSelectedUser(null);
            setNewPassword('');
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error resetting password');
        }
    };

    if (user?.role !== 'admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access user management.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-lg shadow-lg">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <FaUsers /> User Management
                    </h1>
                    <p className="text-purple-100">Manage system users and permissions</p>
                </div>

                {/* Search and Filters */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name or email..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                        <select
                            className="border p-2 rounded-lg"
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                        >
                            <option value="all">All Roles</option>
                            <option value="doctor">Doctors</option>
                            <option value="nurse">Nurses</option>
                            <option value="pharmacist">Pharmacists</option>
                            <option value="lab_technician">Lab Technicians</option>
                            <option value="lab_scientist">Lab Scientist</option>
                            <option value="radiologist">Radiologists</option>
                            <option value="cashier">Cashiers</option>
                            <option value="receptionist">Receptionists</option>
                            <option value="admin">Admins</option>
                        </select>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="mt-4 bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2"
                    >
                        <FaPlus /> Add New User
                    </button>
                </div>

                {/* Users Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="p-4 text-left">Name</th>
                                <th className="p-4 text-left">Email</th>
                                <th className="p-4 text-left">Role</th>
                                <th className="p-4 text-left">Status</th>
                                <th className="p-4 text-left">Created</th>
                                <th className="p-4 text-left">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((u) => (
                                <tr key={u._id} className="border-b hover:bg-gray-50">
                                    <td className="p-4 font-semibold">{u.name}</td>
                                    <td className="p-4 text-gray-600">{u.email}</td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.role === 'admin' ? 'bg-red-100 text-red-800' :
                                            u.role === 'doctor' ? 'bg-blue-100 text-blue-800' :
                                                u.role === 'nurse' ? 'bg-green-100 text-green-800' :
                                                    u.role === 'pharmacist' ? 'bg-purple-100 text-purple-800' :
                                                        'bg-gray-100 text-gray-800'
                                            }`}>
                                            {u.role.replace('_', ' ').toUpperCase()}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                            }`}>
                                            {u.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600">
                                        {new Date(u.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="p-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setSelectedUser(u);
                                                    setShowEditModal(true);
                                                }}
                                                className="text-blue-600 hover:text-blue-800"
                                                title="Edit"
                                            >
                                                <FaEdit />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setSelectedUser(u);
                                                    setShowResetModal(true);
                                                }}
                                                className="text-orange-600 hover:text-orange-800"
                                                title="Reset Password"
                                            >
                                                <FaKey />
                                            </button>
                                            {u._id !== user._id && (
                                                <button
                                                    onClick={() => handleDeleteUser(u._id)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="Deactivate"
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-gray-500">
                            No users found
                        </div>
                    )}
                </div>

                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow text-center">
                        <p className="text-gray-600 text-sm">Total Users</p>
                        <p className="text-3xl font-bold text-blue-600">{users.length}</p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow text-center">
                        <p className="text-gray-600 text-sm">Active Users</p>
                        <p className="text-3xl font-bold text-green-600">
                            {users.filter(u => u.isActive).length}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow text-center">
                        <p className="text-gray-600 text-sm">Doctors</p>
                        <p className="text-3xl font-bold text-purple-600">
                            {users.filter(u => u.role === 'doctor').length}
                        </p>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow text-center">
                        <p className="text-gray-600 text-sm">Nurses</p>
                        <p className="text-3xl font-bold text-pink-600">
                            {users.filter(u => u.role === 'nurse').length}
                        </p>
                    </div>
                </div>
            </div>

            {/* Add User Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Add New User</h3>
                            <button onClick={() => setShowAddModal(false)}>
                                <FaTimes className="text-gray-500 hover:text-gray-700" />
                            </button>
                        </div>
                        <form onSubmit={handleAddUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded"
                                    value={newUser.name}
                                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full border p-2 rounded"
                                    value={newUser.email}
                                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Password</label>
                                <input
                                    type="password"
                                    className="w-full border p-2 rounded"
                                    value={newUser.password}
                                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                    required
                                    minLength="6"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Role</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={newUser.role}
                                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                >
                                    <option value="">-- Select Role --</option>
                                    <option value="doctor">Doctor</option>
                                    <option value="nurse">Nurse</option>
                                    <option value="pharmacist">Pharmacist</option>
                                    <option value="lab_scientist">Lab Scientist</option>
                                    <option value="lab_technician">Lab Technicians</option>
                                    <option value="radiologist">Radiologist</option>
                                    <option value="cashier">Cashier</option>
                                    <option value="receptionist">Receptionist</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
                                >
                                    Create User
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {showEditModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Edit User</h3>
                            <button onClick={() => setShowEditModal(false)}>
                                <FaTimes className="text-gray-500 hover:text-gray-700" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">Name</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded"
                                    value={selectedUser.name}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Email</label>
                                <input
                                    type="email"
                                    className="w-full border p-2 rounded"
                                    value={selectedUser.email}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Role</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={selectedUser.role}
                                    onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
                                >
                                    <option value="doctor">Doctor</option>
                                    <option value="nurse">Nurse</option>
                                    <option value="pharmacist">Pharmacist</option>
                                    <option value="lab_technician">Lab Technician</option>
                                    <option value="radiologist">Radiologist</option>
                                    <option value="cashier">Cashier</option>
                                    <option value="receptionist">Receptionist</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedUser.isActive}
                                        onChange={(e) => setSelectedUser({ ...selectedUser, isActive: e.target.checked })}
                                    />
                                    <span className="text-sm font-semibold">Active</span>
                                </label>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                                >
                                    Update User
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowEditModal(false)}
                                    className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Reset Password Modal */}
            {showResetModal && selectedUser && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Reset Password</h3>
                            <button onClick={() => setShowResetModal(false)}>
                                <FaTimes className="text-gray-500 hover:text-gray-700" />
                            </button>
                        </div>
                        <p className="mb-4 text-gray-600">
                            Reset password for <strong>{selectedUser.name}</strong>
                        </p>
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">New Password</label>
                                <input
                                    type="password"
                                    className="w-full border p-2 rounded"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    required
                                    minLength="6"
                                    placeholder="Minimum 6 characters"
                                />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    className="flex-1 bg-orange-600 text-white py-2 rounded hover:bg-orange-700"
                                >
                                    Reset Password
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowResetModal(false)}
                                    className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default UserManagement;
