import { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaSearch, FaFlask, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import { toast } from 'react-toastify';

const ExternalInvestigations = () => {
    const { backendUrl } = useContext(AppContext);
    const { user } = useContext(AuthContext);

    // Encounter list state
    const [searchTerm, setSearchTerm] = useState('');
    const [encounters, setEncounters] = useState([]);
    const [allEncounters, setAllEncounters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Lab order modal state
    const [showLabModal, setShowLabModal] = useState(false);
    const [selectedEncounter, setSelectedEncounter] = useState(null);
    const [labCharges, setLabCharges] = useState([]);
    const [labSearchTerm, setLabSearchTerm] = useState('');
    const [showLabDropdown, setShowLabDropdown] = useState(false);
    const [selectedLabTest, setSelectedLabTest] = useState('');
    const [tempLabOrders, setTempLabOrders] = useState([]);
    const [labClinicalDetails, setLabClinicalDetails] = useState('');
    const [orderLoading, setOrderLoading] = useState(false);

    const config = { headers: { Authorization: `Bearer ${user.token}` } };

    // ─── Fetch encounters ────────────────────────────────────────────────────
    const fetchAllEncounters = async () => {
        try {
            setLoading(true);
            const [newRes, legacyRes] = await Promise.all([
                axios.get(`${backendUrl}/api/visits?type=External Lab/Radiology&encounterStatus=awaiting_services`, config),
                axios.get(`${backendUrl}/api/visits?type=External Investigation&encounterStatus=awaiting_services`, config)
            ]);

            const combined = [...newRes.data, ...legacyRes.data].filter(v =>
                v.type === 'External Lab/Radiology' || v.type === 'External Investigation'
            );

            const sorted = combined
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(v => ({ ...v, patientInfo: v.patient }));

            setAllEncounters(sorted);
            setEncounters(sorted);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching encounters');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllEncounters();
    }, []);

    // ─── Fetch lab charges ───────────────────────────────────────────────────
    const fetchLabCharges = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/charges`, config);
            setLabCharges(data.filter(c => c.type === 'lab' && c.active !== false));
        } catch (error) {
            console.error('Error fetching lab charges:', error);
            toast.error('Could not load lab tests list');
        }
    };

    // ─── Search encounters ───────────────────────────────────────────────────
    const searchEncounters = async () => {
        if (!searchTerm.trim()) {
            setEncounters(allEncounters);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            setLoading(true);
            const { data: patients } = await axios.get(
                `${backendUrl}/api/patients?search=${searchTerm}`,
                config
            );

            if (patients.length === 0) {
                toast.info('No patients found');
                setEncounters([]);
                return;
            }

            let allExternalEncounters = [];
            for (const patient of patients) {
                const { data: visits } = await axios.get(
                    `${backendUrl}/api/visits/patient/${patient._id}`,
                    config
                );
                const patientExternalEnc = visits
                    .filter(v => v.type === 'External Lab/Radiology' || v.type === 'External Investigation')
                    .map(enc => ({ ...enc, patientInfo: patient }));
                allExternalEncounters = [...allExternalEncounters, ...patientExternalEnc];
            }

            allExternalEncounters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setEncounters(allExternalEncounters);

            if (allExternalEncounters.length === 0) {
                toast.info(`No External Lab/Radiology encounters found`);
            } else {
                toast.success(`Found ${allExternalEncounters.length} encounter(s)`);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error searching encounters');
        } finally {
            setLoading(false);
        }
    };

    // ─── Open lab order modal ────────────────────────────────────────────────
    const handleOpenLabModal = async (encounter) => {
        setSelectedEncounter(encounter);
        setTempLabOrders([]);
        setSelectedLabTest('');
        setLabSearchTerm('');
        await fetchLabCharges();
        setShowLabModal(true);
    };

    const handleCloseLabModal = () => {
        setShowLabModal(false);
        setSelectedEncounter(null);
        setTempLabOrders([]);
        setSelectedLabTest('');
        setLabSearchTerm('');
        setLabClinicalDetails('');
    };

    // ─── Queue management ────────────────────────────────────────────────────
    const handleAddToQueue = () => {
        if (!selectedLabTest) return;
        const test = labCharges.find(c => c._id === selectedLabTest);
        if (!test) return;
        if (tempLabOrders.find(t => t._id === test._id)) {
            toast.info('Test already in list');
            return;
        }
        setTempLabOrders([...tempLabOrders, test]);
        setSelectedLabTest('');
        setLabSearchTerm('');
        toast.success('Test added to list');
    };

    const handleRemoveFromQueue = (id) => {
        setTempLabOrders(tempLabOrders.filter(t => t._id !== id));
    };

    // ─── Place lab orders ────────────────────────────────────────────────────
    const handlePlaceLabOrder = async () => {
        let ordersToPlace = [...tempLabOrders];

        // If user selected but didn't click Add, include it anyway
        if (selectedLabTest) {
            const test = labCharges.find(c => c._id === selectedLabTest);
            if (test && !ordersToPlace.find(t => t._id === test._id)) {
                ordersToPlace.push(test);
            }
        }

        if (ordersToPlace.length === 0) {
            toast.warn('Please select at least one test');
            return;
        }

        const encounter = selectedEncounter;
        const patient = encounter.patientInfo;

        try {
            setOrderLoading(true);

            for (const test of ordersToPlace) {
                // 1. Create encounter charge (generates the bill)
                const chargeRes = await axios.post(
                    `${backendUrl}/api/encounter-charges`,
                    {
                        encounterId: encounter._id,
                        patientId: patient._id,
                        chargeId: test._id,
                        quantity: 1,
                        notes: 'External lab order'
                    },
                    config
                );

                // 2. Create lab order linked to the charge
                await axios.post(
                    `${backendUrl}/api/lab`,
                    {
                        patientId: patient._id,
                        visitId: encounter._id,
                        chargeId: chargeRes.data._id,
                        testName: test.name,
                        notes: 'Ordered via External Investigations',
                        clinicalDetails: labClinicalDetails
                    },
                    config
                );
            }

            toast.success(`✅ ${ordersToPlace.length} lab order(s) placed! Charges generated — awaiting payment.`);
            setLabClinicalDetails('');
            handleCloseLabModal();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error placing lab orders');
        } finally {
            setOrderLoading(false);
        }
    };

    // ─── Compute per-patient fee based on provider ───────────────────────────
    const getFeeForTest = (test, encounter) => {
        if (!test || !encounter?.patientInfo) return test?.standardFee || test?.basePrice || 0;
        const provider = encounter.patientInfo.provider;
        switch (provider) {
            case 'Retainership': return test.retainershipFee || 0;
            case 'NHIA': return test.nhiaFee || 0;
            case 'KSCHMA': return test.kschmaFee || 0;
            default: return test.standardFee || test.basePrice || 0;
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────
    return (
        <Layout>
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaFlask className="text-purple-600" /> External Investigations
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                    Order lab tests for patients with External Lab/Radiology encounters
                </p>
            </div>

            {/* Search */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Search Patient
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Enter Patient Name or MRN..."
                        className="flex-1 border p-3 rounded"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchEncounters()}
                    />
                    <button
                        onClick={searchEncounters}
                        disabled={loading}
                        className="bg-blue-600 text-white px-8 py-3 rounded hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </div>

            {/* Encounter list */}
            {encounters.length > 0 && (
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-xl font-bold mb-4">
                        {isSearching
                            ? `Search Results (${encounters.length})`
                            : `All Pending External Lab/Radiology Encounters (${encounters.length})`}
                    </h3>
                    <div className="space-y-3">
                        {encounters.map(encounter => (
                            <div
                                key={encounter._id}
                                className="border border-purple-200 p-4 rounded hover:bg-purple-50 transition"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="font-bold text-lg text-gray-800">
                                                {encounter.patientInfo.name}
                                            </h4>
                                            <span className="text-sm text-gray-600">
                                                MRN: {encounter.patientInfo.mrn}
                                            </span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                            <div>
                                                <p><strong>Encounter Type:</strong> {encounter.type}</p>
                                                <p><strong>Date:</strong> {new Date(encounter.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div>
                                                <p><strong>Status:</strong>
                                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${encounter.encounterStatus === 'completed'
                                                        ? 'bg-green-100 text-green-800'
                                                        : encounter.encounterStatus === 'in_progress'
                                                            ? 'bg-blue-100 text-blue-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {encounter.encounterStatus?.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </p>
                                                <p><strong>Payment:</strong>
                                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${encounter.paymentValidated
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {encounter.paymentValidated ? 'Validated' : 'Pending'}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>
                                        {encounter.chiefComplaint && (
                                            <p className="text-sm text-gray-600 mt-2">
                                                <strong>Chief Complaint:</strong> {encounter.chiefComplaint}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        id={`order-lab-btn-${encounter._id}`}
                                        onClick={() => handleOpenLabModal(encounter)}
                                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2 ml-4 shrink-0"
                                    >
                                        <FaPlus /> Order Lab Tests
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state */}
            {!loading && encounters.length === 0 && searchTerm && (
                <div className="bg-white p-12 rounded shadow text-center">
                    <FaSearch className="text-gray-400 text-5xl mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No External Lab/Radiology encounters found</p>
                    <p className="text-gray-500 text-sm mt-2">Try searching with a different patient name or MRN</p>
                </div>
            )}

            {/* ─── Lab Order Modal ─────────────────────────────────────────── */}
            {showLabModal && selectedEncounter && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
                        {/* Modal header */}
                        <div className="flex justify-between items-center p-6 border-b">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Order Lab Tests</h3>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    Patient: <span className="font-semibold text-purple-700">
                                        {selectedEncounter.patientInfo.name}
                                    </span>
                                    &nbsp;|&nbsp;MRN: {selectedEncounter.patientInfo.mrn}
                                </p>
                            </div>
                            <button
                                onClick={handleCloseLabModal}
                                className="text-gray-400 hover:text-gray-600 transition"
                            >
                                <FaTimes size={22} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="p-6 space-y-4">
                            {/* Search + Add row */}
                            <div className="flex gap-2 items-end">
                                <div className="flex-1 relative">
                                    <label className="block text-gray-700 mb-1.5 font-semibold text-sm">
                                        Search Lab Test
                                    </label>
                                    <input
                                        id="ext-lab-search"
                                        type="text"
                                        className="w-full border p-2.5 rounded focus:outline-none focus:ring-2 focus:ring-purple-400"
                                        placeholder="Type to search test..."
                                        value={labSearchTerm}
                                        onChange={(e) => {
                                            setLabSearchTerm(e.target.value);
                                            setShowLabDropdown(true);
                                            setSelectedLabTest('');
                                        }}
                                        onFocus={() => setShowLabDropdown(true)}
                                    />
                                    {/* Dropdown */}
                                    {showLabDropdown && labSearchTerm && (
                                        <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-44 overflow-y-auto mt-1">
                                            {labCharges
                                                .filter(c => c.name.toLowerCase().includes(labSearchTerm.toLowerCase()))
                                                .length > 0 ? (
                                                labCharges
                                                    .filter(c => c.name.toLowerCase().includes(labSearchTerm.toLowerCase()))
                                                    .map(charge => (
                                                        <div
                                                            key={charge._id}
                                                            className="p-2.5 hover:bg-purple-50 cursor-pointer text-sm border-b last:border-0"
                                                            onClick={() => {
                                                                setSelectedLabTest(charge._id);
                                                                setLabSearchTerm(charge.name);
                                                                setShowLabDropdown(false);
                                                            }}
                                                        >
                                                            <div className="font-semibold text-gray-800">{charge.name}</div>
                                                            <div className="text-xs text-gray-500">
                                                                ₦{(getFeeForTest(charge, selectedEncounter) || charge.standardFee || charge.basePrice || 0).toLocaleString()}
                                                                {charge.labSpecialization && (
                                                                    <span className="ml-2 bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded text-[10px]">
                                                                        {charge.labSpecialization}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))
                                            ) : (
                                                <div className="p-2.5 text-gray-500 text-sm">No matches found</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={handleAddToQueue}
                                    disabled={!selectedLabTest}
                                    className="bg-blue-600 text-white px-4 py-2.5 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed h-[42px] font-semibold text-sm"
                                >
                                    Add
                                </button>
                            </div>

                            {/* Queued tests table */}
                            {tempLabOrders.length > 0 ? (
                                <div className="border rounded overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-purple-50">
                                            <tr>
                                                <th className="p-2.5 font-semibold text-gray-700">Test Name</th>
                                                <th className="p-2.5 font-semibold text-gray-700 text-right">Fee</th>
                                                <th className="p-2.5 font-semibold text-gray-700 text-center w-16">Remove</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {tempLabOrders.map(test => (
                                                <tr key={test._id} className="hover:bg-gray-50">
                                                    <td className="p-2.5">{test.name}</td>
                                                    <td className="p-2.5 text-right text-green-700 font-semibold">
                                                        ₦{(getFeeForTest(test, selectedEncounter)).toLocaleString()}
                                                    </td>
                                                    <td className="p-2.5 text-center">
                                                        <button
                                                            onClick={() => handleRemoveFromQueue(test._id)}
                                                            className="text-red-500 hover:text-red-700 transition"
                                                            title="Remove"
                                                        >
                                                            <FaTrash size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-gray-50 border-t">
                                            <tr>
                                                <td className="p-2.5 font-bold text-gray-700">Total</td>
                                                <td className="p-2.5 text-right font-bold text-gray-900">
                                                    ₦{tempLabOrders
                                                        .reduce((sum, t) => sum + getFeeForTest(t, selectedEncounter), 0)
                                                        .toLocaleString()}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            ) : (
                                <div className="border-2 border-dashed border-gray-200 rounded p-6 text-center text-gray-400 text-sm">
                                    No tests added yet. Search and click <strong>Add</strong> to queue tests.
                                </div>
                            )}

                            <div>
                                <label className="block text-gray-700 mb-1.5 font-semibold text-sm">
                                    Clinical Detail
                                </label>
                                <textarea
                                    className="w-full border p-2.5 rounded focus:outline-none focus:ring-2 focus:ring-purple-400 text-sm"
                                    rows="3"
                                    placeholder="Enter clinical details or context for the lab staff..."
                                    value={labClinicalDetails}
                                    onChange={(e) => setLabClinicalDetails(e.target.value)}
                                ></textarea>
                            </div>

                            {/* Info note */}
                            <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
                                <strong>ℹ️ Note:</strong> Placing this order will generate charges automatically.
                                The lab scientist will see the order in <em>Pending Lab Orders</em> once payment is confirmed by the cashier.
                            </div>
                        </div>

                        {/* Modal footer */}
                        <div className="flex gap-3 justify-end p-6 border-t bg-gray-50 rounded-b-lg">
                            <button
                                onClick={handleCloseLabModal}
                                disabled={orderLoading}
                                className="px-5 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:opacity-50 font-semibold text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                id="place-lab-order-btn"
                                onClick={handlePlaceLabOrder}
                                disabled={orderLoading || (tempLabOrders.length === 0 && !selectedLabTest)}
                                className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold text-sm flex items-center gap-2"
                            >
                                {orderLoading ? (
                                    <>
                                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                        Placing Orders...
                                    </>
                                ) : (
                                    <>
                                        <FaPlus size={12} />
                                        Place Order{tempLabOrders.length > 1 ? 's' : ''} ({tempLabOrders.length})
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ExternalInvestigations;
