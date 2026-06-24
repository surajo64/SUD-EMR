import { useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaSearch, FaPills, FaPlus, FaTimes, FaTrash, FaArrowRight } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const ExternalPharmacy = () => {
    const { backendUrl } = useContext(AppContext);
    const [searchTerm, setSearchTerm] = useState('');
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [encounters, setEncounters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [allEncounters, setAllEncounters] = useState([]); // All pending encounters
    const [isSearching, setIsSearching] = useState(false);

    // Prescription Modal States
    const [showRxModal, setShowRxModal] = useState(false);
    const [selectedEncounter, setSelectedEncounter] = useState(null);
    const [inventoryDrugs, setInventoryDrugs] = useState([]);
    const [drugSearchTerm, setDrugSearchTerm] = useState('');
    const [filteredDrugs, setFilteredDrugs] = useState([]);
    const [showDrugDropdown, setShowDrugDropdown] = useState(false);
    const [selectedDrug, setSelectedDrug] = useState('');
    const [drugQuantity, setDrugQuantity] = useState(1);
    const [drugDosage, setDrugDosage] = useState('');
    const [drugFrequency, setDrugFrequency] = useState('');
    const [drugDuration, setDrugDuration] = useState('');
    const [drugRoute, setDrugRoute] = useState('');
    const [drugForm, setDrugForm] = useState('');
    const [tempDrugs, setTempDrugs] = useState([]); // List of drugs to prescribe
    const [buyOutside, setBuyOutside] = useState(false); // New state
    const [metadataOptions, setMetadataOptions] = useState({
        dosage: [],
        frequency: [],
        route: [],
        form: []
    });

    // Fetch drug metadata when modal opens
    useEffect(() => {
        const fetchMetadata = async () => {
            try {
                const { data } = await axios.get(`${backendUrl}/api/drug-metadata`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                const organized = {
                    dosage: data.filter(m => m.type === 'dosage' && m.isActive),
                    frequency: data.filter(m => m.type === 'frequency' && m.isActive),
                    route: data.filter(m => m.type === 'route' && m.isActive),
                    form: data.filter(m => m.type === 'form' && m.isActive)
                };
                setMetadataOptions(organized);
            } catch (error) {
                console.error('Error fetching drug metadata:', error);
            }
        };

        const fetchInventory = async () => {
            try {
                const config = { headers: { Authorization: `Bearer ${user.token}` } };
                let url = `${backendUrl}/api/inventory`;
                if (user.assignedPharmacy) {
                    url += `?pharmacy=${user.assignedPharmacy._id || user.assignedPharmacy}`;
                }
                const { data } = await axios.get(url, config);
                setInventoryDrugs(data);
            } catch (error) {
                console.error('Error fetching inventory:', error);
            }
        };

        if (showRxModal) {
            fetchMetadata();
            fetchInventory();
        }
    }, [showRxModal, backendUrl, user.token]);

    // Filter drugs search - Aggregate batches by name
    useEffect(() => {
        if (drugSearchTerm) {
            const filtered = inventoryDrugs.filter(d =>
                d.name.toLowerCase().includes(drugSearchTerm.toLowerCase())
            );

            // Group by name
            const grouped = filtered.reduce((acc, drug) => {
                const key = drug.name.toLowerCase();
                if (!acc[key]) {
                    acc[key] = {
                        ...drug,
                        quantity: 0,
                        batches: []
                    };
                }
                acc[key].quantity += drug.quantity;
                acc[key].batches.push(drug);
                return acc;
            }, {});

            // Sort batches within each group by expiryDate (earliest first)
            Object.values(grouped).forEach(drugGroup => {
                drugGroup.batches.sort((a, b) => {
                    if (!a.expiryDate) return 1;
                    if (!b.expiryDate) return -1;
                    return new Date(a.expiryDate) - new Date(b.expiryDate);
                });
                // Update primary drug info to use the earliest non-expired batch if possible
                const earliestActive = drugGroup.batches.find(b => b.quantity > 0 && (!b.expiryDate || new Date(b.expiryDate) > new Date())) || drugGroup.batches[0];
                if (earliestActive) {
                    drugGroup._id = earliestActive._id;
                    drugGroup.price = earliestActive.price;
                    drugGroup.expiryDate = earliestActive.expiryDate;
                }
            });

            setFilteredDrugs(Object.values(grouped));
            setShowDrugDropdown(true);
        } else {
            setFilteredDrugs([]);
            setShowDrugDropdown(false);
        }
    }, [drugSearchTerm, inventoryDrugs]);

    // Auto-calculate quantity
    useEffect(() => {
        if (!showRxModal || !selectedDrug) return;

        const calculateTotal = () => {
            const parseDose = (str) => {
                if (!str) return 1;
                if (/mg|mcg|g|ml|l|unit/i.test(str)) {
                    if (/tab|cap|pill|vial|amp/i.test(str)) {
                        const match = str.match(/^(\d+(\.\d+)?)/);
                        return match ? parseFloat(match[1]) : 1;
                    }
                    return 1;
                }
                const match = str.match(/^(\d+(\.\d+)?)/);
                const num = match ? parseFloat(match[1]) : 1;
                return num > 20 ? 1 : num;
            };

            const doseUnits = parseDose(drugDosage);
            const freqLower = (drugFrequency || '').toLowerCase().trim();
            let freqMultiplier = 1;

            if (freqLower === 'od' || freqLower.includes('once daily') || freqLower === 'daily' || freqLower === 'od' || freqLower === 'once' || freqLower === 'stat' || freqLower === 'nocte' || freqLower === 'ac' || freqLower === 'pc' || freqLower === 'hs' || freqLower === 'prn') {
                freqMultiplier = 1;
            } else if (freqLower === 'bd' || freqLower.includes('twice daily') || freqLower === 'bid' || freqLower.includes('twice') || freqLower.includes('12 hourly') || freqLower.includes('12h')) {
                freqMultiplier = 2;
            } else if (freqLower === 'tds' || freqLower.includes('three times daily') || freqLower === 'tid' || freqLower.includes('trice') || freqLower.includes('8 hourly') || freqLower.includes('8h')) {
                freqMultiplier = 3;
            } else if (freqLower === 'qid' || freqLower.includes('four times daily') || freqLower.includes('6 hourly') || freqLower.includes('6h') || freqLower.includes('four times')) {
                freqMultiplier = 4;
            } else if (freqLower.includes('weekly')) {
                freqMultiplier = 1 / 7;
            } else if (freqLower.match(/(\d+)\s*times/)) {
                freqMultiplier = parseInt(freqLower.match(/(\d+)\s*times/)[1]);
            }

            const durationLower = (drugDuration || '').toLowerCase();
            const durMatch = durationLower.match(/(\d+(\.\d+)?)/);
            const durNum = durMatch ? parseFloat(durMatch[1]) : 0;
            let totalDays = durNum;

            if (durationLower.includes('week')) {
                totalDays = durNum * 7;
            } else if (durationLower.includes('month')) {
                totalDays = durNum * 30;
            }

            const total = Math.ceil(doseUnits * freqMultiplier * totalDays);
            if (total > 0 && !isNaN(total)) {
                setDrugQuantity(total);
            }
        };

        const timer = setTimeout(calculateTotal, 300);
        return () => clearTimeout(timer);
    }, [drugDosage, drugFrequency, drugDuration, showRxModal, selectedDrug]);

    // Fetch all pending External Pharmacy encounters on mount
    const fetchAllEncounters = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            // Fetch all External Pharmacy visits that are not completed
            const { data } = await axios.get(
                `${backendUrl}/api/visits?type=External Pharmacy&encounterStatus=awaiting_services,in_pharmacy`,
                config
            );

            // Re-filter on frontend just to be absolutely sure
            const filtered = data.filter(v => v.type === 'External Pharmacy');

            // Sort by date (latest first)
            const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(v => ({ ...v, patientInfo: v.patient })); // Normalize patient info format

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

    const searchEncounters = async () => {
        if (!searchTerm.trim()) {
            setEncounters(allEncounters);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Search for all matching patients
            const { data: patients } = await axios.get(
                `${backendUrl}/api/patients?search=${searchTerm}`,
                config
            );

            if (patients.length === 0) {
                toast.info('No patients found');
                setEncounters([]);
                return;
            }

            // Get encounters for all matching patients to find relevant ones
            let allExternalEncounters = [];

            for (const patient of patients) {
                const { data: visits } = await axios.get(
                    `${backendUrl}/api/visits/patient/${patient._id}`,
                    config
                );

                const patientExternalEnc = visits
                    .filter(v => v.type === 'External Pharmacy' && ['awaiting_services', 'in_pharmacy'].includes(v.encounterStatus))
                    .map(enc => ({
                        ...enc,
                        patientInfo: patient
                    }));

                allExternalEncounters = [...allExternalEncounters, ...patientExternalEnc];
            }

            // Sort by date (latest first)
            allExternalEncounters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setEncounters(allExternalEncounters);

            if (allExternalEncounters.length === 0) {
                const names = patients.map(p => p.name).join(', ');
                toast.info(`No External Pharmacy encounters found for: ${names}`);
            } else {
                toast.success(`Found ${allExternalEncounters.length} External Pharmacy encounter(s)`);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error searching encounters');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectDrugFromSearch = (drug) => {
        setSelectedDrug(drug._id);
        setDrugSearchTerm(drug.name);
        setShowDrugDropdown(false);
        setBuyOutside(false); // Reset

        // Auto-populate fields from drug data
        setDrugRoute(drug.route || '');
        setDrugDosage(drug.dosage || '');
        setDrugForm(drug.form || '');
        setDrugFrequency(drug.frequency || '');
    };

    const handleAddDrugToQueue = () => {
        if (!selectedDrug) return;

        const drugData = inventoryDrugs.find(d => d._id === selectedDrug);
        if (!drugData) return;

        if (!buyOutside) {
            if (drugData.expiryDate && new Date(drugData.expiryDate) < new Date()) {
                toast.error('Cannot prescribe: This drug is expired.');
                return;
            }

            if (drugData.quantity < drugQuantity) {
                toast.error(`Cannot prescribe: Insufficient inventory. Only ${drugData.quantity} available.`);
                return;
            }
        }

        const newDrugItem = {
            id: Date.now(),
            drugId: selectedDrug,
            name: drugData.name,
            price: drugData.price,
            quantity: drugQuantity,
            route: drugRoute || 'As directed',
            dosage: drugDosage || 'As directed',
            form: drugForm || 'As directed',
            frequency: drugFrequency || 'As directed',
            duration: (drugDuration && !isNaN(drugDuration)) ? `${drugDuration} days` : (drugDuration || 'As directed'),
            buyOutside: buyOutside
        };

        setTempDrugs([...tempDrugs, newDrugItem]);

        // Reset form
        setSelectedDrug('');
        setDrugSearchTerm('');
        setDrugQuantity(1);
        setDrugRoute('');
        setDrugDosage('');
        setDrugForm('');
        setDrugFrequency('');
        setDrugDuration('');
        toast.success('Drug added to list');
    };

    const handleRemoveDrugFromQueue = (id) => {
        setTempDrugs(tempDrugs.filter(d => d.id !== id));
    };

    const handlePrescribeAll = async () => {
        if (tempDrugs.length === 0) {
            toast.error('No drugs in the list to prescribe');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Process all drugs in queue
            for (const drugItem of tempDrugs) {
                // 1. Create prescription
                const rxRes = await axios.post(
                    `${backendUrl}/api/prescriptions`,
                    {
                        patientId: selectedEncounter.patientInfo._id,
                        visitId: selectedEncounter._id,
                        medicines: [{
                            name: drugItem.name,
                            dosage: drugItem.dosage,
                            frequency: drugItem.frequency,
                            duration: drugItem.duration,
                            route: drugItem.route,
                            form: drugItem.form,
                            quantity: drugItem.quantity,
                            buyOutside: drugItem.buyOutside
                        }],
                        notes: 'Pharmacist prescribed (External)'
                    },
                    config
                );

                // 2. Automatically generate charge - SKIP if Buy Outside
                if (!drugItem.buyOutside) {
                    await axios.put(
                        `${backendUrl}/api/prescriptions/${rxRes.data._id}/generate-charge`,
                        { quantity: drugItem.quantity },
                        config
                    );
                }
            }

            // 3. Update encounter status to 'in_pharmacy'
            await axios.put(
                `${backendUrl}/api/visits/${selectedEncounter._id}`,
                { encounterStatus: 'in_pharmacy' },
                config
            );

            toast.success(`Prescriptions created and charges generated! Status updated to Pharmacy.`);

            // Reset and close
            setTempDrugs([]);
            setShowRxModal(false);
            setSelectedEncounter(null);

            // Refresh list
            fetchAllEncounters();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error processing prescriptions');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenPrescribeModal = (encounter) => {
        setSelectedEncounter(encounter);
        setShowRxModal(true);
    };

    const handleGoToDispensing = (encounter) => {
        navigate('/pharmacy-prescriptions', {
            state: { searchTerm: encounter.patientInfo.name }
        });
    };

    return (
        <Layout>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaPills className="text-pink-600" /> External Pharmacy
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                    Search for patients with External Pharmacy encounters to prescribe medications
                </p>
            </div>

            {/* Search Section */}
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

            {/* Results Section */}
            {encounters.length > 0 && (
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-xl font-bold mb-4">
                        {isSearching ? `Search Results (${encounters.length})` : `All Pending External Pharmacy Encounters (${encounters.length})`}
                    </h3>
                    <div className="space-y-3">
                        {encounters.map(encounter => (
                            <div
                                key={encounter._id}
                                className="border border-pink-200 p-4 rounded hover:bg-pink-50 transition"
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
                                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${encounter.encounterStatus === 'completed' ? 'bg-green-100 text-green-800' :
                                                        encounter.encounterStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {encounter.encounterStatus?.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </p>
                                                <p><strong>Payment:</strong>
                                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${encounter.paymentValidated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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

                                    {encounter.encounterStatus === 'awaiting_services' ? (
                                        <button
                                            onClick={() => handleOpenPrescribeModal(encounter)}
                                            className="bg-pink-600 text-white px-4 py-2 rounded hover:bg-pink-700 flex items-center gap-2 ml-4"
                                        >
                                            <FaPlus /> Prescribe Medication
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleGoToDispensing(encounter)}
                                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 ml-4"
                                        >
                                            <FaArrowRight /> Go to Dispensing
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && encounters.length === 0 && searchTerm && (
                <div className="bg-white p-12 rounded shadow text-center">
                    <FaSearch className="text-gray-400 text-5xl mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No External Pharmacy encounters found</p>
                    <p className="text-gray-500 text-sm mt-2">
                        Try searching with a different patient name or MRN
                    </p>
                </div>
            )}
            {/* Prescription Modal */}
            {showRxModal && selectedEncounter && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-xl font-bold">Add Prescription</h3>
                                <p className="text-sm text-gray-600">Patient: {selectedEncounter.patientInfo.name}</p>
                            </div>
                            <button onClick={() => setShowRxModal(false)} className="text-gray-500 hover:text-gray-700">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Drug Search & Add Form */}
                            <div className="bg-gray-50 p-4 rounded border">
                                <h4 className="font-semibold text-sm text-gray-700 mb-3">Add Drug to List</h4>
                                <div className="mb-3 relative">
                                    <label className="block text-xs text-gray-600 mb-1">Search Drug (Inventory)</label>
                                    <input
                                        type="text"
                                        className="w-full border p-2 rounded"
                                        placeholder="Type to search..."
                                        value={drugSearchTerm}
                                        onChange={(e) => setDrugSearchTerm(e.target.value)}
                                    />
                                    {showDrugDropdown && filteredDrugs.length > 0 && (
                                        <div className="absolute z-10 w-full bg-white border rounded shadow-lg max-h-40 overflow-y-auto mt-1">
                                            {filteredDrugs.map(drug => (
                                                <div
                                                    key={drug._id}
                                                    className={`p-2 hover:bg-pink-50 cursor-pointer text-sm ${drug.quantity <= 0 || (drug.expiryDate && new Date(drug.expiryDate) < new Date()) ? 'bg-red-50' : ''}`}
                                                    onClick={() => handleSelectDrugFromSearch(drug)}
                                                >
                                                    <div className="font-semibold flex justify-between">
                                                        <span>{drug.name}</span>
                                                        {drug.expiryDate && new Date(drug.expiryDate) < new Date() && (
                                                            <span className="text-[10px] bg-red-600 text-white px-1 rounded">EXPIRED</span>
                                                        )}
                                                        {drug.quantity <= 0 && (
                                                            <span className="text-[10px] bg-gray-600 text-white px-1 rounded">OUT OF STOCK</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500">
                                                        Total Stock: {drug.quantity} {drug.batches.length > 1 && `(${drug.batches.length} batches)`} | ₦{drug.price}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {selectedDrug && (
                                    <div className="grid grid-cols-1 md:grid-cols-7 gap-2 items-end">
                                        <div className="md:col-span-1">
                                            <label className="block text-xs text-gray-600 mb-1">Route</label>
                                            <select
                                                className="w-full border p-2 rounded text-sm"
                                                value={drugRoute}
                                                onChange={(e) => setDrugRoute(e.target.value)}
                                            >
                                                <option value="">-- Route --</option>
                                                {metadataOptions.route.map(m => (
                                                    <option key={m._id} value={m.value}>{m.value}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-xs text-gray-600 mb-1">Dosage</label>
                                            <select
                                                className="w-full border p-2 rounded text-sm"
                                                value={drugDosage}
                                                onChange={(e) => setDrugDosage(e.target.value)}
                                            >
                                                <option value="">-- Dosage --</option>
                                                {metadataOptions.dosage.map(m => (
                                                    <option key={m._id} value={m.value}>{m.value}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-xs text-gray-600 mb-1">Form</label>
                                            <select
                                                className="w-full border p-2 rounded text-sm"
                                                value={drugForm}
                                                onChange={(e) => setDrugForm(e.target.value)}
                                            >
                                                <option value="">-- Form --</option>
                                                {metadataOptions.form.map(m => (
                                                    <option key={m._id} value={m.value}>{m.value}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-xs text-gray-600 mb-1">Frequency</label>
                                            <select
                                                className="w-full border p-2 rounded text-sm"
                                                value={drugFrequency}
                                                onChange={(e) => setDrugFrequency(e.target.value)}
                                            >
                                                <option value="">-- Freq --</option>
                                                {metadataOptions.frequency.map(m => (
                                                    <option key={m._id} value={m.value}>{m.value}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-xs text-gray-600 mb-1">Duration</label>
                                            <input
                                                type="text"
                                                className="w-full border p-2 rounded text-sm"
                                                value={drugDuration}
                                                onChange={(e) => setDrugDuration(e.target.value)}
                                                placeholder="5 days"
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <label className="block text-xs text-gray-600 mb-1">Quantity</label>
                                            <input
                                                type="number"
                                                className="w-full border p-2 rounded text-sm"
                                                value={drugQuantity}
                                                onChange={(e) => setDrugQuantity(parseInt(e.target.value))}
                                                min="1"
                                            />
                                        </div>
                                        <div className="md:col-span-1 flex flex-col items-center justify-center">
                                            <label className="text-[10px] text-gray-600 mb-1 font-bold">Buy Outside</label>
                                            <input
                                                type="checkbox"
                                                className="w-5 h-5 cursor-pointer accent-pink-600 mb-1"
                                                checked={buyOutside}
                                                onChange={(e) => setBuyOutside(e.target.checked)}
                                            />
                                        </div>
                                        <div className="md:col-span-1">
                                            <button
                                                onClick={handleAddDrugToQueue}
                                                className="w-full bg-pink-600 text-white p-2 rounded hover:bg-pink-700 text-sm font-semibold h-[38px]"
                                            >
                                                Add
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Temporary Drug List */}
                            <div className="border rounded overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-2">Drug</th>
                                            <th className="p-2">Route</th>
                                            <th className="p-2">Dosage</th>
                                            <th className="p-2">Form</th>
                                            <th className="p-2">Freq</th>
                                            <th className="p-2">Dur</th>
                                            <th className="p-2">Qty</th>
                                            <th className="p-2">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tempDrugs.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" className="p-4 text-center text-gray-500">
                                                    No drugs added yet. Search and add drugs above.
                                                </td>
                                            </tr>
                                        ) : (
                                            tempDrugs.map(drug => (
                                                <tr key={drug.id} className={`border-b ${drug.buyOutside ? 'bg-orange-50' : ''}`}>
                                                    <td className="p-2 font-semibold">
                                                        <div className="flex items-center gap-1">
                                                            {drug.name}
                                                            {drug.buyOutside && (
                                                                <span className="text-[10px] bg-orange-200 text-orange-800 px-1 rounded border border-orange-300 uppercase">
                                                                    Buy Outside
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-2">{drug.route}</td>
                                                    <td className="p-2">{drug.dosage}</td>
                                                    <td className="p-2">{drug.form}</td>
                                                    <td className="p-2">{drug.frequency}</td>
                                                    <td className="p-2">{drug.duration}</td>
                                                    <td className="p-2">{drug.quantity}</td>
                                                    <td className="p-2">
                                                        <button
                                                            onClick={() => handleRemoveDrugFromQueue(drug.id)}
                                                            className="text-red-600 hover:text-red-800"
                                                        >
                                                            <FaTrash />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex gap-2 justify-end mt-4">
                                <button
                                    onClick={() => setShowRxModal(false)}
                                    className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handlePrescribeAll}
                                    disabled={tempDrugs.length === 0 || loading}
                                    className="bg-pink-600 text-white px-6 py-2 rounded hover:bg-pink-700 disabled:bg-gray-400 font-semibold flex items-center gap-2"
                                >
                                    {loading ? 'Processing...' : `Confirm Prescription (${tempDrugs.length})`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default ExternalPharmacy;
