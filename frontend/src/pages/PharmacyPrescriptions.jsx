import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaPills, FaSearch, FaCheckCircle, FaSave, FaBoxOpen } from 'react-icons/fa';
import { toast } from 'react-toastify';
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
    const { user } = useContext(AuthContext);

    useEffect(() => {
        const fetchSystemSettings = async () => {
            try {
                const { data } = await axios.get('http://localhost:5000/api/settings');
                setSystemSettings(data);
            } catch (error) {
                console.error('Error fetching system settings:', error);
            }
        };
        fetchSystemSettings();
        if (user) fetchPrescriptions();
    }, [user]);

    const fetchPrescriptions = async () => {
        if (!user) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/prescriptions', config);
            // Sort by creation date (newest first)
            data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setPrescriptions(data);
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
            p.patient?.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setPrescriptions(filtered);
    };

    const handleSelectPatient = (patient) => {
        setSelectedPatient(patient);
        setSelectedPrescription(null);
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
            const { data } = await axios.get('http://localhost:5000/api/inventory', config);

            const availability = {};
            medicines.forEach(med => {
                const inventoryItems = data.filter(item =>
                    item.name.toLowerCase().includes(med.name.toLowerCase()) && item.quantity > 0
                );
                const totalAvailable = inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
                availability[med.name] = {
                    available: totalAvailable,
                    items: inventoryItems
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
        const printWindow = window.open('', '_blank');
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
                    <p><strong>Patient Name:</strong> ${selectedPatient.name}</p>
                    <p><strong>MRN:</strong> ${selectedPatient.mrn || 'N/A'}</p>
                    <p><strong>Date:</strong> ${new Date(selectedPrescription.createdAt).toLocaleDateString()}</p>
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
                            ${selectedPrescription.medicines.map(med => `
                                <tr>
                                    <td>${med.name}</td>
                                    <td>${med.dosage}</td>
                                    <td>${med.frequency}</td>
                                    <td>${med.duration}</td>
                                    <td>${med.quantity || 1}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                
                ${selectedPrescription.notes ? `
                    <div style="margin-top: 20px;">
                        <p><strong>Additional Notes:</strong></p>
                        <p>${selectedPrescription.notes}</p>
                    </div>
                ` : ''}
                
                <div class="footer">
                    <p><strong>Prescribing Doctor:</strong> ${selectedPrescription.doctor?.name || 'N/A'}</p>
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
                `http://localhost:5000/api/prescriptions/${selectedPrescription._id}/dispense-with-inventory`,
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
                    const visitRes = await axios.get(`http://localhost:5000/api/visits/${visitId}`, config);
                    const visit = visitRes.data;

                    let newStatus = visit.encounterStatus;
                    if (visit.encounterType === 'Outpatient') {
                        newStatus = 'checkout';
                    } else if (visit.encounterType === 'Inpatient') {
                        newStatus = 'in_ward';
                    }

                    if (newStatus !== visit.encounterStatus) {
                        await axios.put(
                            `http://localhost:5000/api/visits/${visitId}`,
                            { encounterStatus: newStatus },
                            config
                        );
                        toast.info(`Encounter status updated to: ${newStatus}`);
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
                    toast.error(`${item.name}: ${item.reason} (Available: ${item.available || 0})`);
                });
            }
        } finally {
            setLoading(false);
        }
    };

    const renderMedicines = (medicines) => {
        if (!Array.isArray(medicines)) return medicines || '';
        return medicines.map((med, idx) => (
            <div key={idx} className="mb-1">
                <span className="font-semibold">{med.name}</span> - {med.dosage}, {med.frequency}, {med.duration}
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
                        placeholder="Search by patient name or MRN..."
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
                    <h3 className="text-xl font-bold mb-4">
                        Prescriptions for {selectedPatient.name}
                    </h3>
                    {patientPrescriptions.length === 0 ? (
                        <p className="text-gray-500">No prescriptions found for this patient</p>
                    ) : (
                        <div className="space-y-2">
                            {patientPrescriptions.map(p => (
                                <div
                                    key={p._id}
                                    className="border p-4 rounded hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleSelectPrescription(p)}
                                >
                                    <div className="flex justify-between">
                                        <div>
                                            <p className="font-bold text-lg">
                                                Encounter on {new Date(p.createdAt).toLocaleDateString()}
                                            </p>
                                            <div className="mt-2">
                                                {renderMedicines(p.medicines)}
                                            </div>
                                            <div className="mt-2 flex gap-2">
                                                <span className={`text-xs px-3 py-1 rounded ${p.charge?.status === 'paid' ? 'bg-green-200 text-green-800' : 'bg-yellow-200 text-yellow-800'}`}>
                                                    {p.charge?.status === 'paid' ? 'Paid' : 'Unpaid'}
                                                </span>
                                                <span className={`text-xs px-3 py-1 rounded ${p.status === 'dispensed' ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'}`}>
                                                    {p.status}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
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
                            <FaSave /> Print Prescription
                        </button>
                    </div>

                    {/* Already Dispensed Check */}
                    {selectedPrescription.status === 'dispensed' ? (
                        <div className="border-2 border-green-300 bg-green-50 p-6 rounded mb-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-green-800">
                                <FaCheckCircle /> Already Dispensed
                            </h3>
                            <p className="text-sm text-gray-700 mb-4">
                                This prescription has already been dispensed and cannot be dispensed again.
                            </p>
                            <div className="bg-white p-4 rounded border">
                                <p className="font-semibold mb-2">Dispensing Details:</p>
                                <p className="text-sm text-gray-700">
                                    Dispensed on: {selectedPrescription.dispensedAt ? new Date(selectedPrescription.dispensedAt).toLocaleString() : 'N/A'}
                                </p>
                                <div className="mt-3">
                                    <p className="font-semibold mb-2">Medications Dispensed:</p>
                                    {renderMedicines(selectedPrescription.medicines)}
                                </div>
                            </div>
                        </div>
                    ) : selectedPrescription.charge?.status !== 'paid' ? (
                        <div className="border-2 border-red-300 bg-red-50 p-6 rounded mb-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-800">
                                <FaCheckCircle /> Payment Required
                            </h3>
                            <p className="text-sm text-gray-700 mb-4">
                                This prescription has not been paid for yet. Please ask the patient to pay at the cashier before dispensing.
                            </p>
                            <div className="flex gap-2 items-center">
                                <span className="font-bold text-red-600">Status: Unpaid</span>
                                <button
                                    onClick={fetchPrescriptions}
                                    className="text-blue-600 hover:underline text-sm ml-4"
                                >
                                    Refresh Status
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
                                                        value={med.duration}
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
            )}
        </Layout>
    );
};

export default PharmacyPrescriptions;
