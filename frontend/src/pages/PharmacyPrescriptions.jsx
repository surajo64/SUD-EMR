import { useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaPills, FaSearch, FaCheckCircle, FaSave, FaBoxOpen, FaPrint, FaChevronDown, FaChevronRight, FaClock, FaHistory, FaPrescriptionBottleAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { formatCompactNumber, formatCurrency } from '../utils/formatters';
import LoadingOverlay from '../components/loadingOverlay';

const PharmacyPrescriptions = () => {
    const [loading, setLoading] = useState(false);
    const [prescriptions, setPrescriptions] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [selectedPrescription, setSelectedPrescription] = useState(null);
    const [dispensingMedicines, setDispensingMedicines] = useState([]);
    const [inventoryAvailability, setInventoryAvailability] = useState({});
    const [systemSettings, setSystemSettings] = useState(null);
    const [selectedForPrint, setSelectedForPrint] = useState([]);
    const [expandedDates, setExpandedDates] = useState({});
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const location = useLocation();

    const [userStats, setUserStats] = useState({ prescriptionsDispensed: 0, revenueToday: 0 });
    const [editQuantity, setEditQuantity] = useState(1);
    const [editUnitPrice, setEditUnitPrice] = useState(0);

    useEffect(() => {
        if (user && user.token) {
            fetchUserStats();
        }
    }, [user.token, backendUrl]);

    const fetchUserStats = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/reports/user-stats`, config);
            setUserStats(data);
        } catch (error) {
            console.error('Error fetching user stats:', error);
        }
    };

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const { data } = await axios.get(`${backendUrl}/api/settings`);
                setSystemSettings(data);
            } catch (error) {
                console.error('Error fetching system settings:', error);
            }
        };
        fetchSystemSettings();
        if (user) fetchPrescriptions();
    }, [user]);

    // Pre-fill search if navigating from dashboard
    useEffect(() => {
        if (location.state && location.state.searchTerm && prescriptions.length > 0) {
            setSearchTerm(location.state.searchTerm);
        }
    }, [location.state, prescriptions.length]);

    // Add search term to reactive filter
    useEffect(() => {
        if (searchTerm.trim() && prescriptions.length > 0) {
            handleSearch();
        }
    }, [searchTerm, prescriptions.length]);

    // Synchronize edit price and quantity when prescription changes
    useEffect(() => {
        if (selectedPrescription && selectedPrescription.charge) {
            setEditQuantity(selectedPrescription.charge.quantity || 1);
            const medName = selectedPrescription.medicines?.[0]?.name;
            const inventoryPrice = medName ? getMedicineFee(medName, selectedPrescription.patient?.provider) : 0;
            setEditUnitPrice(inventoryPrice || selectedPrescription.charge.unitPrice || 0);
        }
    }, [selectedPrescription, inventoryAvailability]);

    const fetchPrescriptions = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/prescriptions`, config);
            // Sort by creation date (newest first)
            data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setPrescriptions(data);
            return data;
        } catch (error) {
            console.error(error);
            toast.error('Error fetching prescriptions');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!searchTerm.trim()) {
            fetchPrescriptions();
            return;
        }
        const filtered = prescriptions.filter(p =>
            p.patient?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.patient?.mrn?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.patient?.contact?.includes(searchTerm)
        );
        setPrescriptions(filtered);
    };

    const handleSelectPatient = (patient) => {
        setSelectedPatient(patient);
        setSelectedPrescription(null);
        setSelectedForPrint([]);
        setExpandedDates({});
    };

    const toggleDateExpansion = (dateKey) => {
        setExpandedDates(prev => ({
            ...prev,
            [dateKey]: !prev[dateKey]
        }));
    };

    const handleSelectPrescription = async (prescription) => {
        setSelectedPrescription(prescription);

        // Initialize dispensing medicines from doctor's prescription
        const medicines = Array.isArray(prescription.medicines)
            ? prescription.medicines.map(med => ({
                name: med.name,
                dosage: med.dosage || 'As directed',
                frequency: med.frequency || 'As directed',
                duration: med.duration || 'As directed',
                quantityDispensed: med.quantity || 1 // Use doctor's quantity or default to 1
            }))
            : [];

        setDispensingMedicines(medicines);

        // Check inventory availability for each medicine
        await checkInventoryAvailability(medicines);
    };

    const checkInventoryAvailability = async (medicines) => {
        try {
            // setLoading(true); // Optional, maybe too disruptive for every selection
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Filter by logged-in pharmacist's assigned pharmacy
            let url = `${backendUrl}/api/inventory`;
            const pharmacyId = user?.assignedPharmacy?._id || user?.assignedPharmacy;

            console.log('User:', user);
            console.log('Assigned Pharmacy ID:', pharmacyId);

            if (pharmacyId && typeof pharmacyId === 'string') {
                url += `?pharmacy=${pharmacyId}`;
            }

            const { data } = await axios.get(url, config);
            console.log('Fetched Inventory Data:', data);

            const availability = {};
            medicines.forEach(med => {
                // Modified matching logic: match strictly by name or check includes in both directions
                // Also handle potential whitespace and case sensitivity
                const inventoryItems = data.filter(item => {
                    const itemName = item.name.toLowerCase().trim();
                    const medName = med.name.toLowerCase().trim();
                    return (itemName === medName || itemName.includes(medName) || medName.includes(itemName)) && item.quantity > 0;
                });

                console.log(`Matching for ${med.name}:`, inventoryItems);

                const totalAvailable = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
                availability[med.name] = {
                    available: totalAvailable,
                    items: inventoryItems,
                    fees: inventoryItems.length > 0 ? {
                        standardFee: inventoryItems[0].standardFee,
                        retainershipFee: inventoryItems[0].retainershipFee,
                        familyRetainershipFee: inventoryItems[0].familyRetainershipFee,
                        nhiaFee: inventoryItems[0].nhiaFee,
                        kschmaFee: inventoryItems[0].kschmaFee,
                        price: inventoryItems[0].price
                    } : null
                };
            });

            setInventoryAvailability(availability);
        } catch (error) {
            console.error(error);
        }
    };

    const updateMedicine = (index, field, value) => {
        const updated = [...dispensingMedicines];
        updated[index][field] = value;
        setDispensingMedicines(updated);
    };

    const printPrescription = () => {
        if (!selectedPrescription) return;
        handlePrintSelected([selectedPrescription]);
    };

    const handlePrintSelected = (prescriptionsToPrint = null) => {
        const items = prescriptionsToPrint || patientPrescriptions.filter(p => selectedForPrint.includes(p._id));
        if (items.length === 0) {
            toast.warning('Please select at least one prescription to print');
            return;
        }

        const printWindow = window.open('', '_blank');
        const firstPrescription = items[0];

        const prescriptionHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prescription - ${selectedPatient.name}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                    .header h1 { margin: 0; font-size: 24px; }
                    .header p { margin: 5px 0; font-size: 14px; }
                    .patient-info { margin-bottom: 20px; }
                    .patient-info p { margin: 5px 0; }
                    .medications { margin-top: 20px; }
                    .medications table { width: 100%; border-collapse: collapse; }
                    .medications th, .medications td { border: 1px solid #000; padding: 8px; text-align: left; }
                    .medications th { background-color: #f0f0f0; }
                    .footer { margin-top: 40px; }
                    .signature { margin-top: 60px; border-top: 1px solid #000; width: 200px; text-align: center; padding-top: 5px; }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                    <h1 style="margin: 0 0 5px 0;">MEDICAL PRESCRIPTION</h1>
                    <p style="margin: 0 0 5px 0;"><strong>${systemSettings?.reportHeader || 'SUD EMR'}</strong></p>
                    <p style="margin: 0 0 5px 0;">${systemSettings?.address || ''}</p>
                    <p>
                        ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                        ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                        ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                    </p>
                </div>
                
                <div class="patient-info">
                    <div style="display: flex; justify-content: space-between;">
                        <div>
                            <p><strong>Patient Name:</strong> ${selectedPatient.name}</p>
                            <p><strong>MRN:</strong> ${selectedPatient.mrn || 'N/A'}</p>
                        </div>
                        <div style="text-align: right;">
                            <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>
                
                <div class="medications">
                    <h3>Rx (Prescription)</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Medication</th>
                                <th>Dosage</th>
                                <th>Frequency</th>
                                <th>Duration</th>
                                <th>Quantity</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(p => p.medicines.map(med => `
                                <tr>
                                    <td>${med.name}${med.buyOutside ? ' <br/><small style="color: #e67e22; font-weight: bold;">(Buy Outside/Record Only)</small>' : ''}</td>
                                    <td>${med.dosage}</td>
                                    <td>${med.frequency}</td>
                                    <td>${(med.duration && !isNaN(med.duration)) ? `${med.duration} days` : med.duration}</td>
                                    <td>${med.quantity || 1}</td>
                                </tr>
                            `).join('')).join('')}
                        </tbody>
                    </table>
                </div>
                
                ${items.some(p => p.notes) ? `
                    <div style="margin-top: 20px;">
                        <p><strong>Additional Notes:</strong></p>
                        <ul>
                            ${items.filter(p => p.notes).map(p => `<li>${p.notes}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="footer">
                    <p><strong>Prescribing Doctor(s):</strong> ${Array.from(new Set(items.map(p => p.doctor?.name || 'N/A'))).join(', ')}</p>
                    <div class="signature">
                        Doctor's Signature
                    </div>
                </div>
                
                <div class="no-print" style="margin-top: 20px; text-align: center;">
                    <button onclick="window.print()" style="padding: 10px 20px; background: #4CAF50; color: white; border: none; cursor: pointer; font-size: 16px;">Print</button>
                    <button onclick="window.close()" style="padding: 10px 20px; background: #f44336; color: white; border: none; cursor: pointer; font-size: 16px; margin-left: 10px;">Close</button>
                </div>
            </body>
            </html>
        `;

        printWindow.document.write(prescriptionHTML);
        printWindow.document.close();
    };

    const toggleSelectForPrint = (id) => {
        setSelectedForPrint(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleSelectAllForPrint = () => {
        if (selectedForPrint.length === patientPrescriptions.length) {
            setSelectedForPrint([]);
        } else {
            setSelectedForPrint(patientPrescriptions.map(p => p._id));
        }
    };

    const handleUpdateCharge = async () => {
        if (!selectedPrescription || !selectedPrescription.charge) return;
        
        const qty = parseInt(editQuantity);
        const price = parseFloat(editUnitPrice);
        
        if (isNaN(qty) || qty < 1) {
            toast.error("Quantity must be at least 1");
            return;
        }
        
        if (isNaN(price) || price < 0) {
            toast.error("Unit price must be a valid non-negative number");
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/encounter-charges/${selectedPrescription.charge._id}`,
                {
                    quantity: qty,
                    unitPrice: price
                },
                config
            );
            toast.success('Charge updated successfully!');

            // Refresh prescriptions and keep selected prescription updated
            const refreshed = await fetchPrescriptions();
            if (refreshed) {
                const updatedPres = refreshed.find(p => p._id === selectedPrescription._id);
                if (updatedPres) {
                    setSelectedPrescription(updatedPres);
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error updating charge');
        } finally {
            setLoading(false);
        }
    };

    const handleDispenseWithInventory = async () => {
        if (!selectedPrescription) return;

        // Validate all quantities
        for (const med of dispensingMedicines) {
            const available = inventoryAvailability[med.name]?.available || 0;
            if (med.quantityDispensed > available) {
                toast.error(`Insufficient stock for ${med.name}. Available: ${available}`);
                return;
            }
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const response = await axios.put(
                `${backendUrl}/api/prescriptions/${selectedPrescription._id}/dispense-with-inventory`,
                { medicines: dispensingMedicines },
                config
            );

            toast.success('Prescription dispensed successfully! Inventory updated.');

            // Show inventory updates
            if (response.data.inventoryUpdates) {
                console.log('Inventory Updates:', response.data.inventoryUpdates);
            }

            // Update Encounter Status Logic
            if (selectedPrescription.visit) {
                try {
                    const visitId = selectedPrescription.visit._id || selectedPrescription.visit;
                    const visitRes = await axios.get(`${backendUrl}/api/visits/${visitId}`, config);
                    const visit = visitRes.data;

                    let newStatus = visit.encounterStatus;
                    if (visit.encounterType === 'Outpatient') {
                        // Stay active in case they need other services today
                        newStatus = 'awaiting_services';
                    } else if (visit.encounterType === 'Inpatient') {
                        newStatus = 'in_ward';
                    } else if (visit.encounterType === 'External Pharmacy') {
                        // Keep active as per user request
                        newStatus = 'awaiting_services';
                    }

                    if (newStatus !== visit.encounterStatus) {
                        await axios.put(
                            `${backendUrl}/api/visits/${visitId}`,
                            { encounterStatus: newStatus },
                            config
                        );
                        toast.info(`Encounter status updated to: ${newStatus.replace('_', ' ').toUpperCase()}`);
                    }
                } catch (statusError) {
                    console.error('Error updating encounter status:', statusError);
                    // Don't block the main success flow
                }
            }

            setSelectedPrescription(null);
            setSelectedPatient(null);
            setDispensingMedicines([]);
            setInventoryAvailability({});
            fetchPrescriptions();
        } catch (error) {
            console.error(error);
            const errorMsg = error.response?.data?.message || 'Error dispensing prescription';
            toast.error(errorMsg);

            if (error.response?.data?.insufficientStock) {
                error.response.data.insufficientStock.forEach(item => {
                    // Cleaner error message: Don't show redundant availability if it's an expiry error
                    if (item.reason.includes('EXPIRED')) {
                        toast.error(item.reason, { autoClose: 5000 });
                    } else {
                        toast.error(`${item.name}: ${item.reason} (Available: ${item.available || 0})`);
                    }
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const handleBulkDispense = async () => {
        const selectedPrescriptions = patientPrescriptions.filter(p => selectedForPrint.includes(p._id));

        // Filter to only include those that are paid/process and not already dispensed
        const candidates = selectedPrescriptions.filter(p =>
            p.status !== 'dispensed' &&
            (p.medicines?.some(m => m.buyOutside) || (p.charge && p.charge.status === 'paid'))
        );

        if (candidates.length === 0) {
            toast.warning('No eligible prescriptions selected for dispensing. Ensure they are paid and not already dispensed.');
            return;
        }

        if (!window.confirm(`Are you sure you want to dispense ${candidates.length} eligible prescriptions?`)) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.put(
                `${backendUrl}/api/prescriptions/bulk-dispense`,
                { prescriptionIds: candidates.map(p => p._id) },
                config
            );

            if (data.summary.successCount > 0) {
                toast.success(`Successfully dispensed ${data.summary.successCount} prescriptions!`);
            }
            if (data.summary.failedCount > 0) {
                toast.error(`Failed to dispense ${data.summary.failedCount} prescriptions. Check console for details.`);
                console.log('Bulk Dispense Failures:', data.results.failed);
            }

            setSelectedForPrint([]);
            fetchPrescriptions();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error during bulk dispense');
        } finally {
            setLoading(false);
        }
    };

    const renderMedicines = (medicines) => {
        if (!Array.isArray(medicines)) return medicines || '';
        return medicines.map((med, idx) => (
            <div key={idx} className="mb-1 flex items-center gap-2">
                <span className="font-semibold">{med.name}</span> - {med.dosage}, {med.frequency}, {(med.duration && !isNaN(med.duration)) ? `${med.duration} days` : med.duration}
                {med.buyOutside && (
                    <span className="text-[10px] bg-orange-100 text-orange-700 px-1 rounded border border-orange-200 font-bold">
                        BUY OUTSIDE
                    </span>
                )}
            </div>
        ));
    };

    // Group prescriptions by patient
    const patients = Array.from(
        new Map(prescriptions.map(p => [p.patient._id, p.patient])).values()
    );

    const patientPrescriptions = selectedPatient
        ? prescriptions.filter(p => p.patient._id === selectedPatient._id)
        : [];

    // Group prescriptions by date
    const groupedPrescriptions = patientPrescriptions.reduce((acc, p) => {
        const dateKey = new Date(p.createdAt).toISOString().split('T')[0];
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(p);
        return acc;
    }, {});

    // Sort dates in descending order (newest first)
    const sortedDates = Object.keys(groupedPrescriptions).sort((a, b) => b.localeCompare(a));

    // Auto-expand the most recent encounter if none are explicitly set
    useEffect(() => {
    }, [sortedDates, expandedDates]);

    const getMedicineFee = (medName, provider) => {
        const fees = inventoryAvailability[medName]?.fees;
        if (!fees) return 0;

        let fee = 0;
        if (provider === 'Retainership' || provider === 'Corporate Retainership') fee = fees.retainershipFee || 0;
        else if (provider === 'Family Retainership') fee = fees.familyRetainershipFee || 0;
        else if (provider === 'NHIA') fee = fees.nhiaFee || 0;
        else if (provider === 'KSCHMA') fee = fees.kschmaFee || 0;
        else fee = fees.standardFee || fees.price || 0;

        if (fee === 0 && (provider === 'NHIA' || provider === 'KSCHMA' || provider === 'Retainership' || provider === 'Corporate Retainership' || provider === 'Family Retainership')) {
            fee = fees.standardFee || fees.price || 0;
        }
        return fee;
    };

    const calculatePortions = (totalAmount, provider) => {
        let patientPortion = totalAmount;
        let hmoPortion = 0;

        if (provider === 'Retainership' || provider === 'Corporate Retainership' || provider === 'Family Retainership') {
            patientPortion = 0;
            hmoPortion = totalAmount;
        } else if (provider === 'NHIA' || provider === 'KSCHMA') {
            patientPortion = totalAmount * 0.1;
            hmoPortion = totalAmount * 0.9;
        }
        return { patientPortion, hmoPortion };
    };

    // Calculate grand totals for preview
    const grandTotals = dispensingMedicines.reduce((acc, med) => {
        const defaultUnitPrice = getMedicineFee(med.name, selectedPrescription?.patient?.provider);
        const unitPrice = med.customUnitPrice !== undefined ? med.customUnitPrice : defaultUnitPrice;
        const total = unitPrice * (med.quantityDispensed || 0);
        const { patientPortion, hmoPortion } = calculatePortions(total, selectedPrescription?.patient?.provider);

        return {
            total: acc.total + total,
            patientPortion: acc.patientPortion + patientPortion,
            hmoPortion: acc.hmoPortion + hmoPortion
        };
    }, { total: 0, patientPortion: 0, hmoPortion: 0 });

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <FaPills className="text-green-600" /> Pharmacy Dashboard
            </h2>


            {/* Search */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Search Patient
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search by patient name, MRN or Phone..."
                        className="flex-1 border p-3 rounded"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <button
                        onClick={handleSearch}
                        className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700"
                    >
                        Search
                    </button>
                </div>
            </div>

            {/* Patients List */}
            {!selectedPatient && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h3 className="text-xl font-bold mb-4">Patients</h3>
                    {patients.length === 0 ? (
                        <p className="text-gray-500">No patients found</p>
                    ) : (
                        <div className="space-y-2">
                            {patients.map(patient => (
                                <div
                                    key={patient._id}
                                    className="border p-4 rounded hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleSelectPatient(patient)}
                                >
                                    <p className="font-bold text-lg">{patient.name}</p>
                                    <p className="text-gray-600">MRN: {patient.mrn}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Patient Prescriptions */}
            {selectedPatient && !selectedPrescription && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold">
                            Prescriptions for {selectedPatient.name}
                        </h3>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSelectAllForPrint}
                                className="text-sm bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 border"
                            >
                                {selectedForPrint.length === patientPrescriptions.length ? 'Unselect All' : 'Select All'}
                            </button>
                            {selectedForPrint.length > 0 && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleBulkDispense}
                                        className="text-sm bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        <FaBoxOpen /> Dispense Selected ({selectedForPrint.length})
                                    </button>
                                    <button
                                        onClick={() => handlePrintSelected()}
                                        className="text-sm bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                                    >
                                        <FaPrint /> Print Selected ({selectedForPrint.length})
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                    {patientPrescriptions.length === 0 ? (
                        <p className="text-gray-500">No prescriptions found for this patient</p>
                    ) : (
                        <div className="space-y-6">
                            {sortedDates.map(dateKey => (
                                <div key={dateKey}>
                                    <h4
                                        className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2 cursor-pointer hover:text-green-600 transition-colors group"
                                        onClick={() => toggleDateExpansion(dateKey)}
                                    >
                                        <div className="h-px bg-gray-200 flex-1 group-hover:bg-green-200"></div>
                                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-200 shadow-sm">
                                            {expandedDates[dateKey] ? <FaChevronDown className="text-xs" /> : <FaChevronRight className="text-xs" />}
                                            Encounter on {new Date(dateKey).toLocaleDateString()}
                                        </div>
                                        <div className="h-px bg-gray-200 flex-1 group-hover:bg-green-200"></div>
                                    </h4>
                                    {expandedDates[dateKey] && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                                            {groupedPrescriptions[dateKey].map(p => (
                                                <div
                                                    key={p._id}
                                                    className="border p-4 rounded hover:bg-gray-50 cursor-pointer flex items-center gap-4 bg-white shadow-sm transition-all hover:shadow-md"
                                                >
                                                    <div onClick={(e) => e.stopPropagation()}>
                                                        <input
                                                            type="checkbox"
                                                            className="w-5 h-5 cursor-pointer accent-green-600"
                                                            checked={selectedForPrint.includes(p._id)}
                                                            onChange={() => toggleSelectForPrint(p._id)}
                                                        />
                                                    </div>
                                                    <div className="flex-1" onClick={() => handleSelectPrescription(p)}>
                                                        <div className="flex justify-between">
                                                            <div>
                                                                <div className="mt-0">
                                                                    {renderMedicines(p.medicines)}
                                                                </div>
                                                                <div className="mt-2 flex gap-2">
                                                                    {p.medicines?.some(m => m.buyOutside) ? (
                                                                        <span className="text-xs px-3 py-1 rounded bg-orange-100 text-orange-800 font-bold border border-orange-200">
                                                                            External / Record Only
                                                                        </span>
                                                                    ) : (
                                                                        <span className={`text-xs px-3 py-1 rounded ${!p.charge ? 'bg-blue-100 text-blue-800' : p.charge.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                                            {!p.charge ? 'Process' : p.charge.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                                        </span>
                                                                    )}
                                                                    <span className={`text-xs px-3 py-1 rounded ${p.status === 'dispensed' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                                                                        {p.status}
                                                                    </span>
                                                                    {p.pharmacy && (
                                                                        <span className="text-xs px-3 py-1 rounded bg-purple-100 text-purple-800">
                                                                            Dest: {p.pharmacy.name}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <button
                        onClick={() => setSelectedPatient(null)}
                        className="mt-4 text-blue-600 hover:underline"
                    >
                        ← Back to Patients
                    </button>
                </div>
            )}

            {/* Selected Prescription - Dispensing Form */}
            {selectedPrescription && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-xl font-bold">
                                Prescription for {selectedPatient.name}
                            </h3>
                            <p className="text-sm text-gray-600">
                                Prescribed on: {new Date(selectedPrescription.createdAt).toLocaleString()}
                            </p>
                        </div>
                        <button
                            onClick={printPrescription}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                        >
                            <FaPrint /> Print Prescription
                        </button>
                    </div>

                    {/* Buy Outside / Record Only Mode */}
                    {selectedPrescription.medicines?.some(m => m.buyOutside) ? (
                        <div className="border-2 border-orange-300 bg-orange-50 p-6 rounded mb-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-orange-800">
                                <FaBoxOpen /> External / Record Only Prescription
                            </h3>
                            <p className="text-sm text-orange-700 mb-6">
                                This medication is marked for <strong>External Purchase (Buy Outside)</strong> or was prescribed for <strong>Record Purposes</strong> only.
                                Do not generate charges or dispense from internal hospital inventory.
                                Simply print the prescription sheet for the patient.
                            </p>

                            <div className="bg-white p-4 rounded border mb-6">
                                <h4 className="font-bold text-lg mb-3">Medication Details</h4>
                                {selectedPrescription.medicines.map((med, idx) => (
                                    <div key={idx} className="p-3 border-b last:border-0">
                                        <p className="font-bold">{med.name}</p>
                                        <p className="text-sm text-gray-600">{med.dosage} | {med.frequency} | {med.duration}</p>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={printPrescription}
                                className="w-full bg-orange-600 text-white px-6 py-4 rounded hover:bg-orange-700 font-bold flex items-center justify-center gap-2 text-lg shadow-md transition-all"
                            >
                                <FaPrint /> Print Prescription Sheet for Patient
                            </button>
                        </div>
                    ) : (
                        <>

                            {/* Already Dispensed Check */}
                            {selectedPrescription.status === 'dispensed' ? (
                                <div className="border-2 border-green-300 bg-green-50 p-6 rounded mb-6">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-800">
                                        <FaCheckCircle /> Already Dispensed
                                    </h3>
                                    <p className="text-sm text-gray-700 mb-4">
                                        This prescription has already been dispensed.
                                    </p>
                                </div>
                            ) : !selectedPrescription.charge ? (
                                // CASE 1: NO CHARGE YET (New Workflow)
                                <div className="border-2 border-blue-300 bg-blue-50 p-6 rounded mb-6">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-800">
                                        <FaBoxOpen /> Process Prescription
                                    </h3>
                                    <p className="text-sm text-gray-700 mb-4">
                                        This prescription needs to be processed. Please verify the quantity and generate a charge.
                                    </p>

                                    <div className="bg-white p-4 rounded border mb-4">
                                        <h4 className="font-bold text-lg mb-3">Medication Details</h4>
                                        {dispensingMedicines.map((med, index) => {
                                            const defaultPrice = getMedicineFee(med.name, selectedPrescription?.patient?.provider);
                                            const unitPrice = med.customUnitPrice !== undefined ? med.customUnitPrice : defaultPrice;
                                            const totalCost = unitPrice * (med.quantityDispensed || 0);
                                            const { patientPortion } = calculatePortions(totalCost, selectedPrescription?.patient?.provider);

                                            return (
                                                <div key={index} className="mb-4 pb-4 border-b last:border-0">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <p className="font-bold text-lg">{med.name}</p>
                                                        <div className="text-right">
                                                            <p className="text-sm font-semibold text-gray-700">Unit Price: ₦{unitPrice.toLocaleString()}</p>
                                                            <p className="text-sm font-bold text-blue-600">Total: ₦{totalCost.toLocaleString()}</p>
                                                            {selectedPrescription?.patient?.provider !== 'Standard' && (
                                                                <p className="text-xs font-bold text-green-600">Patient Pays (10%): ₦{patientPortion.toLocaleString()}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                                                        <div>
                                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                                Quantity to Charge
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="border p-2 rounded w-full"
                                                                value={med.quantityDispensed}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    updateMedicine(index, 'quantityDispensed', val === "" ? "" : parseInt(val));
                                                                }}
                                                            />
                                                            <p className="text-xs text-gray-600 mt-1">
                                                                Available Stock: {inventoryAvailability[med.name]?.available || 0}
                                                            </p>
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                                Unit Price (₦)
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                className="border p-2 rounded w-full"
                                                                value={med.customUnitPrice !== undefined ? med.customUnitPrice : unitPrice}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    updateMedicine(index, 'customUnitPrice', val === "" ? "" : parseFloat(val));
                                                                }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                                Dosage/Instruction
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="border p-2 rounded w-full"
                                                                value={med.dosage}
                                                                readOnly
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Cost Summary */}
                                    {(dispensingMedicines.length > 1 || selectedPrescription?.patient?.provider !== 'Standard') && (
                                        <div className="bg-gray-50 p-4 rounded border-2 border-gray-200 mb-6">
                                            <h4 className="font-bold text-lg mb-3 border-bottom pb-2">Cost Summary ({selectedPrescription?.patient?.provider})</h4>
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <span className="text-gray-600">Total Drug Cost:</span>
                                                    <span className="font-bold text-lg">₦{grandTotals.total.toLocaleString()}</span>
                                                </div>
                                                {selectedPrescription?.patient?.provider !== 'Standard' && (
                                                    <>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-gray-600">HMO Portion:</span>
                                                            <span className="font-semibold text-blue-600">₦{grandTotals.hmoPortion.toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center border-t pt-2">
                                                            <span className="font-bold text-gray-800 text-lg">PATIENT TO PAY:</span>
                                                            <span className="font-bold text-2xl text-green-600">₦{grandTotals.patientPortion.toLocaleString()}</span>
                                                        </div>
                                                    </>
                                                )}
                                                {selectedPrescription?.patient?.provider === 'Standard' && (
                                                    <div className="flex justify-between items-center border-t pt-2">
                                                        <span className="font-bold text-gray-800 text-lg">TOTAL TO PAY:</span>
                                                        <span className="font-bold text-2xl text-green-600">₦{grandTotals.total.toLocaleString()}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={async () => {
                                            try {
                                                setLoading(true);
                                                const config = { headers: { Authorization: `Bearer ${user.token}` } };
                                                // Assume single drug per prescription for now as per current structure
                                                const rawQty = dispensingMedicines[0]?.quantityDispensed;
                                                const qty = parseInt(rawQty);
                                                const rawPrice = dispensingMedicines[0]?.customUnitPrice;
                                                const customPrice = rawPrice !== undefined && rawPrice !== "" ? parseFloat(rawPrice) : undefined;

                                                if (isNaN(qty) || qty < 1) {
                                                    toast.error("Quantity must be at least 1");
                                                    setLoading(false);
                                                    return;
                                                }
                                                
                                                if (customPrice !== undefined && (isNaN(customPrice) || customPrice < 0)) {
                                                    toast.error("Unit price must be a valid non-negative number");
                                                    setLoading(false);
                                                    return;
                                                }

                                                await axios.put(
                                                    `${backendUrl}/api/prescriptions/${selectedPrescription._id}/generate-charge`,
                                                    { quantity: qty, unitPrice: customPrice },
                                                    config
                                                );
                                                toast.success('Charge generated successfully!');

                                                // Refresh
                                                fetchPrescriptions();
                                                setSelectedPrescription(null);
                                                setDispensingMedicines([]);
                                            } catch (error) {
                                                console.error(error);
                                                toast.error(error.response?.data?.message || 'Error generating charge');
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="w-full bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 font-bold flex items-center justify-center gap-2"
                                    >
                                        <FaSave /> Generate Charge & Process
                                    </button>
                                </div>
                            ) : selectedPrescription.charge.status !== 'paid' ? (
                                <div className="border-2 border-red-300 bg-red-50 p-6 rounded mb-6 text-gray-800">
                                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-800">
                                        <FaCheckCircle /> Payment Required
                                    </h3>
                                    <p className="text-sm text-gray-700 mb-4">
                                        This prescription has not been paid for yet. Please ask the patient to pay at the cashier before dispensing.
                                    </p>
                                    <div className="flex gap-2 items-center mb-6">
                                        <span className="font-bold text-red-600">Status: Unpaid</span>
                                        <button
                                            onClick={fetchPrescriptions}
                                            className="text-blue-600 hover:underline text-sm ml-4"
                                        >
                                            Refresh Status
                                        </button>
                                    </div>

                                    <div className="border-t border-red-200 pt-4 mt-4">
                                        <h4 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-800">
                                            <FaPrescriptionBottleAlt className="text-blue-600" /> Edit Drug Charge Details
                                        </h4>
                                        <p className="text-xs text-gray-600 mb-4">
                                            You can modify the charge quantity or unit price before the patient makes the payment. Portion totals will update automatically.
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                    Quantity to Charge
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    className="border p-2 rounded w-full bg-white text-gray-800"
                                                    value={editQuantity}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEditQuantity(val === "" ? "" : parseInt(val));
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700 mb-1 flex justify-between items-center">
                                                    <span>Unit Price (₦)</span>
                                                    {(() => {
                                                        const medName = selectedPrescription.medicines?.[0]?.name;
                                                        const inventoryPrice = medName ? getMedicineFee(medName, selectedPrescription.patient?.provider) : 0;
                                                        return inventoryPrice > 0 ? (
                                                            <span className="text-xs font-normal text-gray-500">
                                                                {editUnitPrice !== inventoryPrice ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setEditUnitPrice(inventoryPrice)}
                                                                        className="text-blue-600 hover:underline font-medium"
                                                                    >
                                                                        Use Inventory: ₦{inventoryPrice}
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-green-600 font-medium">✓ Matching Inventory (₦{inventoryPrice})</span>
                                                                )}
                                                            </span>
                                                        ) : null;
                                                    })()}
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    className="border p-2 rounded w-full bg-white text-gray-800"
                                                    value={editUnitPrice}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setEditUnitPrice(val === "" ? "" : parseFloat(val));
                                                    }}
                                                />
                                            </div>
                                        </div>

                                        {/* Dynamic Price Preview */}
                                        {(() => {
                                            const total = (editQuantity || 0) * (editUnitPrice || 0);
                                            const { patientPortion, hmoPortion } = calculatePortions(total, selectedPrescription?.patient?.provider);
                                            return (
                                                <div className="bg-white p-4 rounded border text-sm space-y-2 mb-4">
                                                    <div className="flex justify-between">
                                                        <span className="text-gray-600 font-medium">New Total Cost:</span>
                                                        <span className="font-bold text-gray-800">₦{total.toLocaleString()}</span>
                                                    </div>
                                                    {selectedPrescription?.patient?.provider !== 'Standard' && (
                                                        <>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-gray-500 font-medium">HMO Portion:</span>
                                                                <span className="font-semibold text-blue-600">₦{hmoPortion.toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between border-t pt-2">
                                                                <span className="text-gray-700 font-bold">New Patient Portion:</span>
                                                                <span className="font-bold text-green-600 text-lg">₦{patientPortion.toLocaleString()}</span>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            );
                                        })()}

                                        <button
                                            onClick={handleUpdateCharge}
                                            className="w-full bg-blue-600 text-white px-4 py-2.5 rounded hover:bg-blue-700 font-bold text-sm flex items-center justify-center gap-2"
                                        >
                                            <FaSave /> Save Changes to Charge
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    <div className="bg-green-50 p-4 rounded mb-6">
                                        <p className="text-green-700 font-semibold flex items-center gap-2">
                                            <FaCheckCircle /> Payment Verified - Ready to Dispense
                                        </p>
                                    </div>

                                    {/* Editable Dispensing Form */}
                                    <div className="bg-blue-50 p-6 rounded mb-6">
                                        <h4 className="font-bold text-lg mb-4">Medications to Dispense</h4>
                                        <p className="text-sm text-gray-600 mb-4">
                                            Review and edit quantities/dosages as needed based on doctor's instructions and inventory availability.
                                        </p>

                                        <div className="space-y-4">
                                            {dispensingMedicines.map((med, index) => (
                                                <div key={index} className="bg-white p-4 rounded border">
                                                    <p className="font-bold text-lg mb-3">{med.name}</p>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        <div>
                                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                                Quantity to Dispense
                                                            </label>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                className="border p-2 rounded w-full"
                                                                value={med.quantityDispensed}
                                                                onChange={(e) => updateMedicine(index, 'quantityDispensed', parseInt(e.target.value))}
                                                            />
                                                            <p className="text-xs text-gray-600 mt-1">
                                                                Available: {inventoryAvailability[med.name]?.available || 0}
                                                                {(inventoryAvailability[med.name]?.available || 0) < med.quantityDispensed && (
                                                                    <span className="text-red-600 font-bold ml-2">INSUFFICIENT STOCK!</span>
                                                                )}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                                Dosage
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="border p-2 rounded w-full"
                                                                value={med.dosage}
                                                                onChange={(e) => updateMedicine(index, 'dosage', e.target.value)}
                                                                placeholder="e.g., 500mg"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                                Frequency
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="border p-2 rounded w-full"
                                                                value={med.frequency}
                                                                onChange={(e) => updateMedicine(index, 'frequency', e.target.value)}
                                                                placeholder="e.g., Twice daily"
                                                            />
                                                        </div>

                                                        <div>
                                                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                                                Duration
                                                            </label>
                                                            <input
                                                                type="text"
                                                                className="border p-2 rounded w-full"
                                                                value={(med.duration && !isNaN(med.duration)) ? `${med.duration} days` : med.duration}
                                                                onChange={(e) => updateMedicine(index, 'duration', e.target.value)}
                                                                placeholder="e.g., 7 days"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Dispensing Instructions */}
                                    <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded mb-6">
                                        <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                                            <FaBoxOpen className="text-green-600" /> Dispensing Checklist
                                        </h4>
                                        <ol className="list-decimal list-inside space-y-2 text-gray-700 text-sm">
                                            <li>Verify patient identity (Name & MRN)</li>
                                            <li>Review edited quantities and dosages above</li>
                                            <li>Counsel patient on proper usage and side effects</li>
                                            <li>Label medications clearly with patient name and instructions</li>
                                            <li>Click "Confirm Dispensing" to update inventory automatically</li>
                                        </ol>
                                    </div>

                                    <button
                                        onClick={handleDispenseWithInventory}
                                        className="w-full bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-bold flex items-center justify-center gap-2"
                                    >
                                        <FaSave /> Confirm Dispensing & Update Inventory
                                    </button>
                                    <p className="text-xs text-gray-600 mt-2 text-center">
                                        By confirming, inventory will be automatically deducted using FIFO (First Expiry, First Out) logic
                                    </p>
                                </div>
                            )}
                        </>
                    )}

                    <button
                        onClick={() => {
                            setSelectedPrescription(null);
                            setDispensingMedicines([]);
                            setInventoryAvailability({});
                        }}
                        className="mt-4 text-blue-600 hover:underline"
                    >
                        ← Back to Prescriptions
                    </button>
                </div>
            )
            }
        </Layout >
    );
};

export default PharmacyPrescriptions;
