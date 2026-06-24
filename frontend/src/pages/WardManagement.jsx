import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import {
    FaHospital, FaBed, FaSearch, FaFilter, FaUser,
    FaPlus, FaTrash, FaEdit, FaSave, FaTimes
} from 'react-icons/fa';
import LoadingOverlay from '../components/loadingOverlay';
import { toast } from 'react-toastify';

const WardManagement = () => {
    const [wards, setWards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterWard, setFilterWard] = useState('All');

    // Management States
    const [showModal, setShowModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [selectedWard, setSelectedWard] = useState(null);
    const [newWard, setNewWard] = useState({
        name: '',
        type: 'General',
        description: '',
        bedCount: 0,
        dailyRate: 0,
        rates: {
            Standard: 0,
            NHIA: 0,
            Retainership: 0,
            KSCHMA: 0
        }
    });

    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    useEffect(() => {
        if (user) {
            fetchWards();
        }
    }, [user]);

    const fetchWards = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/wards`, config);
            setWards(data);
        } catch (error) {
            console.error('Error fetching wards:', error);
            toast.error('Error loading ward data');
        } finally {
            setLoading(false);
        }
    };

    // Management Handlers
    const handleCreateWard = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Ensure dailyRate matches Standard rate if not set explicitly
            const payload = {
                ...newWard,
                dailyRate: newWard.rates.Standard
            };

            await axios.post(`${backendUrl}/api/wards`, payload, config);
            toast.success('Ward created successfully!');
            setShowModal(false);
            setNewWard({
                name: '',
                type: 'General',
                description: '',
                bedCount: 0,
                dailyRate: 0,
                rates: { Standard: 0, NHIA: 0, Retainership: 0, KSCHMA: 0 }
            });
            fetchWards();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error creating ward');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteWard = async (id) => {
        if (!window.confirm('Are you sure you want to delete this ward? This will remove all beds associated with it.')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/wards/${id}`, config);
            toast.success('Ward deleted successfully!');
            fetchWards();
        } catch (error) {
            console.error(error);
            toast.error('Error deleting ward');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateWard = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Sync dailyRate with Standard rate
            const payload = {
                ...selectedWard,
                dailyRate: selectedWard.rates?.Standard || selectedWard.dailyRate
            };

            await axios.put(`${backendUrl}/api/wards/${selectedWard._id}`, payload, config);
            toast.success('Ward updated successfully!');
            setShowManageModal(false);
            fetchWards();
        } catch (error) {
            console.error(error);
            toast.error('Error updating ward');
        } finally {
            setLoading(false);
        }
    };

    const handleAddBed = () => {
        const nextBedNumber = selectedWard.beds.length + 1;
        const newBed = { number: `Bed ${nextBedNumber}`, isOccupied: false };
        setSelectedWard({ ...selectedWard, beds: [...selectedWard.beds, newBed] });
    };

    const handleRemoveBed = (index) => {
        const updatedBeds = selectedWard.beds.filter((_, i) => i !== index);
        setSelectedWard({ ...selectedWard, beds: updatedBeds });
    };

    const handleBedNumberChange = (index, value) => {
        const updatedBeds = [...selectedWard.beds];
        updatedBeds[index].number = value;
        setSelectedWard({ ...selectedWard, beds: updatedBeds });
    };

    const handleRateChange = (provider, value) => {
        setNewWard(prev => ({
            ...prev,
            rates: {
                ...prev.rates,
                [provider]: parseFloat(value) || 0
            }
        }));
    };

    const handleSelectedRateChange = (provider, value) => {
        setSelectedWard(prev => ({
            ...prev,
            rates: {
                ...(prev.rates || { Standard: prev.dailyRate || 0, NHIA: 0, Retainership: 0, KSCHMA: 0 }),
                [provider]: parseFloat(value) || 0
            }
        }));
    };

    const filteredWards = wards.filter(ward => {
        const matchesSearch = ward.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesFilter = filterWard === 'All' || ward._id === filterWard;
        return matchesSearch && matchesFilter;
    });

    const wardTypes = ['All', 'General', 'Private', 'ICU', 'Emergency', 'Maternity', 'Pediatric', 'Surgical'];

    // Access Check
    if (user?.role !== 'admin' && user?.role !== 'super_admin' && user?.role !== 'nurse' && user?.role !== 'doctor' && user?.role !== 'readonly_admin' && user?.role !== 'receptionist') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access ward management.</p>
                </div>
            </Layout>
        );
    }

    const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="mb-8 flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <FaHospital className="text-blue-600" /> Ward Management & Availability
                    </h2>
                    <p className="text-gray-600 mt-2">Monitor occupancy and manage hospital ward configurations.</p>
                </div>
                {isAdmin && user?.role !== 'readonly_admin' && (
                    <button
                        onClick={() => setShowModal(true)}
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition flex items-center gap-2 shadow-lg shadow-blue-200"
                    >
                        <FaPlus /> Add New Ward
                    </button>
                )}
            </div>

            {/* Controls */}
            <div className="bg-white p-6 rounded-xl shadow-sm mb-8 border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search wards..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <FaFilter className="text-gray-400" />
                    <select
                        className="flex-1 md:w-48 border border-gray-200 rounded-lg py-2 px-3 outline-none focus:ring-2 focus:ring-blue-500 transition"
                        value={filterWard}
                        onChange={(e) => setFilterWard(e.target.value)}
                    >
                        <option value="All">All Wards</option>
                        {wards.map(ward => (
                            <option key={ward._id} value={ward._id}>{ward.name}</option>
                        ))}
                    </select>
                    <button
                        onClick={fetchWards}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200 transition font-medium"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Stats Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-blue-600 p-4 rounded-xl text-white shadow-lg shadow-blue-200">
                    <p className="text-blue-100 text-sm font-semibold uppercase tracking-wider">Total Wards</p>
                    <p className="text-3xl font-bold mt-1">{filteredWards.length}</p>
                </div>
                <div className="bg-green-600 p-4 rounded-xl text-white shadow-lg shadow-green-200">
                    <p className="text-green-100 text-sm font-semibold uppercase tracking-wider">Available Beds</p>
                    <p className="text-3xl font-bold mt-1">
                        {filteredWards.reduce((sum, w) => sum + w.beds.filter(b => !b.isOccupied).length, 0)}
                    </p>
                </div>
                <div className="bg-red-600 p-4 rounded-xl text-white shadow-lg shadow-red-200">
                    <p className="text-red-100 text-sm font-semibold uppercase tracking-wider">Occupied Beds</p>
                    <p className="text-3xl font-bold mt-1">
                        {filteredWards.reduce((sum, w) => sum + w.beds.filter(b => b.isOccupied).length, 0)}
                    </p>
                </div>
                <div className="bg-indigo-600 p-4 rounded-xl text-white shadow-lg shadow-indigo-200">
                    <p className="text-indigo-100 text-sm font-semibold uppercase tracking-wider">Occupancy Rate</p>
                    <p className="text-3xl font-bold mt-1">
                        {filteredWards.length > 0 ? (
                            Math.round((filteredWards.reduce((sum, w) => sum + w.beds.filter(b => b.isOccupied).length, 0) /
                                filteredWards.reduce((sum, w) => sum + (w.beds?.length || 0), 0)) * 100)
                        ) : 0}%
                    </p>
                </div>
            </div>

            {/* Wards Grid */}
            <div className="grid grid-cols-1 gap-8">
                {filteredWards.map(ward => {
                    const occupiedCount = ward.beds?.filter(b => b.isOccupied).length || 0;
                    const totalCount = ward.beds?.length || 0;
                    const percent = totalCount > 0 ? Math.round((occupiedCount / totalCount) * 100) : 0;

                    return (
                        <div key={ward._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-6 border-b border-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shadow-inner ${percent > 90 ? 'bg-red-50 text-red-600' :
                                        percent > 70 ? 'bg-orange-50 text-orange-600' :
                                            'bg-green-50 text-green-600'
                                        }`}>
                                        <FaHospital />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-bold text-gray-800">{ward.name}</h3>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-bold uppercase tracking-tighter">{ward.type}</span>
                                            <span className="text-gray-400 text-xs">•</span>
                                            <span className="text-gray-500 text-xs">{ward.description || 'No description'}</span>
                                            <span className="text-gray-400 text-xs">•</span>
                                            <div className="flex gap-2 text-[10px] font-bold">
                                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded">Standard: ₦{ward.rates?.Standard?.toLocaleString() || ward.dailyRate?.toLocaleString() || 0}</span>
                                                <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">NHIA: ₦{ward.rates?.NHIA?.toLocaleString() || 0}</span>
                                                <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Retainership: ₦{ward.rates?.Retainership?.toLocaleString() || 0}</span>
                                                <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded">State Ins: ₦{ward.rates?.KSCHMA?.toLocaleString() || 0}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col md:items-end gap-2">
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-400 font-bold uppercase">Occupancy</p>
                                            <p className="text-lg font-black text-gray-800">{occupiedCount} / {totalCount}</p>
                                        </div>
                                        <div className="w-16 h-16 relative">
                                            <svg className="w-full h-full" viewBox="0 0 36 36">
                                                <path
                                                    className="text-gray-100 stroke-current"
                                                    strokeWidth="4"
                                                    fill="none"
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                />
                                                <path
                                                    className={`${percent > 90 ? 'text-red-500' : percent > 70 ? 'text-orange-500' : 'text-green-500'} stroke-current`}
                                                    strokeWidth="4"
                                                    strokeDasharray={`${percent}, 100`}
                                                    strokeLinecap="round"
                                                    fill="none"
                                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                                />
                                                <text x="18" y="20.35" className="text-[8px] font-bold fill-current text-gray-700" textAnchor="middle">{percent}%</text>
                                            </svg>
                                        </div>

                                        {/* Admin Actions */}
                                        {isAdmin && user?.role !== 'readonly_admin' && (
                                            <div className="flex gap-2 border-l pl-6 ml-2">
                                                <button
                                                    onClick={() => {
                                                        setSelectedWard({
                                                            ...ward,
                                                            rates: ward.rates || {
                                                                Standard: ward.dailyRate || 0,
                                                                NHIA: 0,
                                                                Retainership: 0,
                                                                KSCHMA: 0
                                                            }
                                                        });
                                                        setShowManageModal(true);
                                                    }}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Edit Ward & Beds"
                                                >
                                                    <FaEdit size={20} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteWard(ward._id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    title="Delete Ward"
                                                >
                                                    <FaTrash size={20} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 bg-gray-50/50">
                                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <FaBed /> Bed Layout & Availability
                                </h4>
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                                    {ward.beds?.map((bed, idx) => (
                                        <div
                                            key={idx}
                                            className={`relative group p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1 ${bed.isOccupied
                                                ? 'bg-red-50 border-red-100 text-red-600'
                                                : 'bg-white border-white hover:border-green-400 text-green-600 hover:shadow-md cursor-help shadow-sm'
                                                }`}
                                        >
                                            <FaBed className={`text-xl ${bed.isOccupied ? 'animate-pulse opacity-40' : ''}`} />
                                            <span className="text-[10px] font-bold uppercase">{bed.number}</span>
                                            {!bed.isOccupied && (
                                                <span className="text-[8px] font-bold text-blue-600">₦{ward.dailyRate?.toLocaleString()}</span>
                                            )}

                                            {/* Tooltip on Hover */}
                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 text-white p-3 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-2xl">
                                                <div className="flex justify-between items-center mb-1 border-b border-gray-700 pb-1">
                                                    <span className="font-bold">{bed.number}</span>
                                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase ${bed.isOccupied ? 'bg-red-500' : 'bg-green-500'}`}>
                                                        {bed.isOccupied ? 'Occupied' : 'Available'}
                                                    </span>
                                                </div>
                                                <div className="mt-2 space-y-1">
                                                    <p className="text-blue-300 font-bold">Standard Rate: ₦{ward.dailyRate?.toLocaleString() || 0}</p>
                                                    {bed.isOccupied ? (
                                                        <>
                                                            <div className="flex items-center gap-2">
                                                                <FaUser className="text-red-400" />
                                                                <span className="font-bold text-red-100">{bed.occupiedBy?.name || 'Unknown Patient'}</span>
                                                            </div>
                                                            <p className="text-gray-400 text-[10px]">MRN: {bed.occupiedBy?.mrn || 'N/A'}</p>
                                                        </>
                                                    ) : (
                                                        <p className="text-green-300 font-medium">Ready for admission</p>
                                                    )}
                                                </div>
                                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-gray-900"></div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!ward.beds || ward.beds.length === 0) && (
                                        <p className="col-span-full text-center text-gray-400 text-sm italic py-4">No beds configured for this ward.</p>
                                    )}
                                </div>
                                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                                    <div className="flex items-center gap-4">
                                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500"></div> Available</span>
                                        <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Occupied</span>
                                    </div>
                                    <div className="ml-auto flex gap-4 text-gray-400">
                                        <span>Standard: ₦{ward.rates?.Standard?.toLocaleString() || ward.dailyRate?.toLocaleString() || 0}</span>
                                        <span>NHIA: ₦{ward.rates?.NHIA?.toLocaleString() || 0}</span>
                                        <span>Retainership: ₦{ward.rates?.Retainership?.toLocaleString() || 0}</span>
                                        <span>State Ins: ₦{ward.rates?.KSCHMA?.toLocaleString() || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Create Ward Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold text-gray-800">Add New Ward</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                                <FaTimes size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateWard} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">Ward Name</label>
                                    <input
                                        type="text"
                                        className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition"
                                        value={newWard.name}
                                        onChange={(e) => setNewWard({ ...newWard, name: e.target.value })}
                                        placeholder="e.g., Male Surgical Ward"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">Type</label>
                                    <select
                                        className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition"
                                        value={newWard.type}
                                        onChange={(e) => setNewWard({ ...newWard, type: e.target.value })}
                                    >
                                        {wardTypes.filter(t => t !== 'All').map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">Initial Bed Count</label>
                                    <input
                                        type="number"
                                        className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition"
                                        value={newWard.bedCount}
                                        onChange={(e) => setNewWard({ ...newWard, bedCount: parseInt(e.target.value) })}
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="bg-gray-50 p-6 rounded-2xl">
                                <h4 className="text-xs font-black uppercase text-gray-400 mb-4 flex items-center gap-2">
                                    <FaSave className="text-blue-500" /> Daily Rates Configuration
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {Object.keys(newWard.rates).map(provider => (
                                        <div key={provider}>
                                            <label className="block text-[10px] font-bold text-gray-500 mb-1">{provider === 'Standard' ? 'Standard (Cash)' : provider}</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₦</span>
                                                <input
                                                    type="number"
                                                    className="w-full border-2 border-white p-2 pl-7 rounded-lg focus:border-blue-500 outline-none transition shadow-sm"
                                                    value={newWard.rates[provider]}
                                                    onChange={(e) => handleRateChange(provider, e.target.value)}
                                                    min="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase text-gray-400 mb-2">Description</label>
                                <textarea
                                    className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition"
                                    rows="3"
                                    value={newWard.description}
                                    onChange={(e) => setNewWard({ ...newWard, description: e.target.value })}
                                    placeholder="Optional description of the ward..."
                                />
                            </div>
                            <div className="flex gap-4 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl hover:bg-gray-200 transition font-bold"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200"
                                >
                                    Create Ward
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Ward Modal */}
            {showManageModal && selectedWard && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-2xl font-bold text-gray-800">Manage {selectedWard.name}</h3>
                                <p className="text-gray-500 text-sm">Update configuration and manage beds.</p>
                            </div>
                            <button onClick={() => setShowManageModal(false)} className="text-gray-400 hover:text-gray-600 transition">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">Ward Name</label>
                                    <input
                                        type="text"
                                        className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition"
                                        value={selectedWard.name}
                                        onChange={(e) => setSelectedWard({ ...selectedWard, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black uppercase text-gray-400 mb-2">Ward Type</label>
                                    <select
                                        className="w-full border-2 border-gray-100 p-3 rounded-xl focus:border-blue-500 outline-none transition"
                                        value={selectedWard.type}
                                        onChange={(e) => setSelectedWard({ ...selectedWard, type: e.target.value })}
                                    >
                                        {wardTypes.filter(t => t !== 'All').map(type => (
                                            <option key={type} value={type}>{type}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                                <h4 className="text-xs font-black uppercase text-blue-600 mb-4 flex items-center gap-2">
                                    <FaSave /> Rates Configuration
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    {['Standard', 'NHIA', 'Retainership', 'KSCHMA'].map(provider => (
                                        <div key={provider}>
                                            <label className="block text-[10px] font-bold text-blue-800/60 mb-1">{provider === 'Standard' ? 'Standard (Cash)' : provider}</label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-400 text-sm font-bold">₦</span>
                                                <input
                                                    type="number"
                                                    className="w-full border-2 border-white p-2 pl-7 rounded-lg focus:border-blue-500 outline-none transition shadow-sm font-bold text-blue-900"
                                                    value={selectedWard.rates?.[provider] || 0}
                                                    onChange={(e) => handleSelectedRateChange(provider, e.target.value)}
                                                    min="0"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="mb-8">
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                    <FaBed className="text-blue-600" /> Bed Configuration
                                </h4>
                                <button
                                    onClick={handleAddBed}
                                    className="bg-green-100 text-green-700 px-4 py-2 rounded-xl hover:bg-green-200 transition flex items-center gap-2 font-bold text-sm"
                                >
                                    <FaPlus /> Add Bed
                                </button>
                            </div>
                            <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100">
                                {(!selectedWard.beds || selectedWard.beds.length === 0) ? (
                                    <p className="text-gray-500 text-center py-8 italic">No beds configured for this ward.</p>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                        {selectedWard.beds.map((bed, index) => (
                                            <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-xl border-2 border-white shadow-sm group hover:border-blue-200 transition">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bed.isOccupied ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                                                    <FaBed />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={bed.number}
                                                    onChange={(e) => handleBedNumberChange(index, e.target.value)}
                                                    className="flex-1 bg-transparent border-b-2 border-transparent focus:border-blue-500 outline-none text-sm font-bold py-1"
                                                    placeholder="Bed Name/No"
                                                />
                                                {!bed.isOccupied ? (
                                                    <button
                                                        onClick={() => handleRemoveBed(index)}
                                                        className="p-1.5 text-gray-300 hover:text-red-500 transition"
                                                        title="Remove Bed"
                                                    >
                                                        <FaTrash size={14} />
                                                    </button>
                                                ) : (
                                                    <span className="text-[8px] font-black uppercase bg-red-100 text-red-600 px-1.5 py-0.5 rounded" title="Cannot remove occupied bed">Occupied</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t">
                            <button
                                onClick={() => setShowManageModal(false)}
                                className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl hover:bg-gray-200 transition font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateWard}
                                className="flex-2 bg-blue-600 text-white py-3 px-8 rounded-xl hover:bg-blue-700 transition font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                            >
                                <FaSave /> Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default WardManagement;
