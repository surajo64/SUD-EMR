import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaBed, FaPlus, FaTrash, FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

const WardManagement = () => {
    const [wards, setWards] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [selectedWard, setSelectedWard] = useState(null);
    const { user } = useContext(AuthContext);

    // Form States
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

    useEffect(() => {
        if (user) {
            fetchWards();
        }
    }, [user]);

    const fetchWards = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/wards', config);
            setWards(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching wards');
        } finally {
            setLoading(false);
        }
    };

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

            await axios.post('http://localhost:5000/api/wards', payload, config);
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
        if (!window.confirm('Are you sure you want to delete this ward?')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/wards/${id}`, config);
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

            await axios.put(`http://localhost:5000/api/wards/${selectedWard._id}`, payload, config);
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

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaBed className="text-blue-600" /> Ward Management
                </h2>
                <button
                    onClick={() => setShowModal(true)}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                >
                    <FaPlus /> Add Ward
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wards.map((ward) => (
                    <div key={ward._id} className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold">{ward.name}</h3>
                                <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                    {ward.type}
                                </span>
                            </div>
                            <div className="flex gap-2">
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
                                    className="text-blue-600 hover:text-blue-800"
                                    title="Manage Beds"
                                >
                                    <FaEdit />
                                </button>
                                <button
                                    onClick={() => handleDeleteWard(ward._id)}
                                    className="text-red-600 hover:text-red-800"
                                    title="Delete Ward"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                        <p className="text-gray-600 mb-4 text-sm">{ward.description || 'No description'}</p>
                        <div className="flex justify-between items-center text-sm font-semibold">
                            <span className="text-gray-700">Total Beds: {ward.beds.length}</span>
                            <span className="text-green-600">
                                Available: {ward.beds.filter(b => !b.isOccupied).length}
                            </span>
                        </div>
                        <div className="mt-2 text-sm text-gray-500">
                            Standard Rate: ₦{ward.dailyRate}
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Ward Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold mb-4">Add New Ward</h3>
                        <form onSubmit={handleCreateWard} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Ward Name</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        value={newWard.name}
                                        onChange={(e) => setNewWard({ ...newWard, name: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Type</label>
                                    <select
                                        className="w-full border p-2 rounded"
                                        value={newWard.type}
                                        onChange={(e) => setNewWard({ ...newWard, type: e.target.value })}
                                    >
                                        <option value="General">General</option>
                                        <option value="Private">Private</option>
                                        <option value="ICU">ICU</option>
                                        <option value="Emergency">Emergency</option>
                                        <option value="Maternity">Maternity</option>
                                        <option value="Pediatric">Pediatric</option>
                                        <option value="Surgical">Surgical</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">Initial Bed Count</label>
                                    <input
                                        type="number"
                                        className="w-full border p-2 rounded"
                                        value={newWard.bedCount}
                                        onChange={(e) => setNewWard({ ...newWard, bedCount: parseInt(e.target.value) })}
                                        min="0"
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-4 mt-4">
                                <h4 className="font-semibold text-gray-700 mb-2">Daily Rates by Provider</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Standard (Cash)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={newWard.rates.Standard}
                                            onChange={(e) => handleRateChange('Standard', e.target.value)}
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">NHIA</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={newWard.rates.NHIA}
                                            onChange={(e) => handleRateChange('NHIA', e.target.value)}
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Retainership</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={newWard.rates.Retainership}
                                            onChange={(e) => handleRateChange('Retainership', e.target.value)}
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">KSCHMA</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={newWard.rates.KSCHMA}
                                            onChange={(e) => handleRateChange('KSCHMA', e.target.value)}
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold mb-1">Description</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    value={newWard.description}
                                    onChange={(e) => setNewWard({ ...newWard, description: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-2 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">Manage Ward</h3>
                            <button onClick={() => setShowManageModal(false)} className="text-gray-500 hover:text-gray-700">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="mb-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">Ward Name</label>
                                <input
                                    type="text"
                                    className="w-full border p-2 rounded"
                                    value={selectedWard.name}
                                    onChange={(e) => setSelectedWard({ ...selectedWard, name: e.target.value })}
                                />
                            </div>

                            <div className="border p-4 rounded bg-gray-50">
                                <h4 className="font-semibold text-gray-700 mb-3">Daily Rates Configuration</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Standard (Cash)</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={selectedWard.rates?.Standard || 0}
                                            onChange={(e) => handleSelectedRateChange('Standard', e.target.value)}
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">NHIA</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={selectedWard.rates?.NHIA || 0}
                                            onChange={(e) => handleSelectedRateChange('NHIA', e.target.value)}
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">Retainership</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={selectedWard.rates?.Retainership || 0}
                                            onChange={(e) => handleSelectedRateChange('Retainership', e.target.value)}
                                            min="0"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">KSCHMA</label>
                                        <input
                                            type="number"
                                            className="w-full border p-2 rounded"
                                            value={selectedWard.rates?.KSCHMA || 0}
                                            onChange={(e) => handleSelectedRateChange('KSCHMA', e.target.value)}
                                            min="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-lg">Beds Configuration</h4>
                                <button
                                    onClick={handleAddBed}
                                    className="text-sm bg-green-100 text-green-700 px-3 py-1 rounded hover:bg-green-200 flex items-center gap-1"
                                >
                                    <FaPlus /> Add Bed
                                </button>
                            </div>
                            <div className="bg-gray-50 p-4 rounded border max-h-60 overflow-y-auto">
                                {selectedWard.beds.length === 0 ? (
                                    <p className="text-gray-500 text-center">No beds configured.</p>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {selectedWard.beds.map((bed, index) => (
                                            <div key={index} className="flex items-center gap-2 bg-white p-2 rounded border shadow-sm">
                                                <input
                                                    type="text"
                                                    value={bed.number}
                                                    onChange={(e) => handleBedNumberChange(index, e.target.value)}
                                                    className="w-full border-b focus:outline-none focus:border-blue-500 text-sm"
                                                />
                                                <button
                                                    onClick={() => handleRemoveBed(index)}
                                                    className="text-red-500 hover:text-red-700"
                                                    disabled={bed.isOccupied}
                                                    title={bed.isOccupied ? "Cannot remove occupied bed" : "Remove Bed"}
                                                >
                                                    <FaTimes />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowManageModal(false)}
                                className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateWard}
                                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
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
