import { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaUserMd, FaSearch, FaCheckCircle, FaNotesMedical, FaHeartbeat, FaMoneyBillWave, FaTrash, FaEdit, FaPlus, FaTable, FaClock, FaChevronDown, FaChevronRight, FaHistory } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';
import { formatAge } from '../utils/patientUtils';

const getNurseFirstName = (fullName) => {
    if (!fullName) return 'Unknown';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 0) return 'Unknown';
    const firstPartLower = parts[0].toLowerCase().replace(/[^a-z]/g, '');
    const titles = ['nurse', 'matron', 'sister', 'sr', 'mr', 'mrs', 'ms', 'dr', 'doc'];
    if (titles.includes(firstPartLower) && parts.length > 1) {
        return parts[1];
    }
    return parts[0];
};

const NurseTriage = () => {
    const { patientId, encounterId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [encounters, setEncounters] = useState([]);
    const [selectedEncounter, setSelectedEncounter] = useState(null);
    const [receiptNumber, setReceiptNumber] = useState('');
    const [receiptValidated, setReceiptValidated] = useState(false);
    const [doctors, setDoctors] = useState([]);
    const [selectedDoctor, setSelectedDoctor] = useState('');
    const [specialityClinics, setSpecialityClinics] = useState([]);
    const [needSpeciality, setNeedSpeciality] = useState(false);
    const [selectedSpecialityClinic, setSelectedSpecialityClinic] = useState('');
    const [needSpecificDoctor, setNeedSpecificDoctor] = useState(false);
    const [selectedSpecificDoctor, setSelectedSpecificDoctor] = useState('');
    const [nursingNotesList, setNursingNotesList] = useState([]);
    const [noteForm, setNoteForm] = useState({
        category: '',
        comment: '',
        editingNoteId: null
    });
    const [existingVitals, setExistingVitals] = useState([]);
    const [editingVitalId, setEditingVitalId] = useState(null);
    const [vitals, setVitals] = useState({
        temperature: '',
        bloodPressure: '',
        heartRate: '',
        respiratoryRate: '',
        weight: '',
        height: '',
        spo2: '',
        bmi: ''
    });
    const [showVitalsModal, setShowVitalsModal] = useState(false);

    // Calculate BMI automatically when weight and height change
    const calculateBMI = (weight, height) => {
        if (!weight || !height) return '';
        const weightNum = parseFloat(weight);
        const heightNum = parseFloat(height);
        if (isNaN(weightNum) || isNaN(heightNum) || heightNum === 0) return '';

        // BMI = weight (kg) / (height (m))Ã‚Â²
        const heightInMeters = heightNum / 100; // Convert cm to meters
        const bmi = weightNum / (heightInMeters * heightInMeters);
        return bmi.toFixed(1);
    };

    // Nursing Charges State
    const [nursingCharges, setNursingCharges] = useState([]);
    const [encounterCharges, setEncounterCharges] = useState([]);
    const [chargeForm, setChargeForm] = useState({
        selectedChargeId: '',
        quantity: 1,
        notes: ''
    });
    const [editingChargeId, setEditingChargeId] = useState(null);
    const [showChargesModal, setShowChargesModal] = useState(false);
    const [showNurseNoteModal, setShowNurseNoteModal] = useState(false);

    // Inpatient Conversion State (Nurse)
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [wards, setWards] = useState([]);
    const [selectedWard, setSelectedWard] = useState('');
    const [selectedBed, setSelectedBed] = useState('');
    const [availableBeds, setAvailableBeds] = useState([]);
    const [retainershipDepositStatus, setRetainershipDepositStatus] = useState([]);
    const [encounterToConvert, setEncounterToConvert] = useState(null);
    const [showDischargeModal, setShowDischargeModal] = useState(false);
    const [dischargeNote, setDischargeNote] = useState('');
    const [encounterToDischarge, setEncounterToDischarge] = useState(null);

    // Drug Administration State
    const [dispensedPrescriptions, setDispensedPrescriptions] = useState([]);
    const [administrationHistory, setAdministrationHistory] = useState([]);
    const [showDrugAdminModal, setShowDrugAdminModal] = useState(false);
    const [adminForm, setAdminForm] = useState({
        prescriptionId: '',
        medicineId: '',
        medicineName: '',
        dosage: '',
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        remarks: ''
    });
    const [expandedDays, setExpandedDays] = useState({});
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    useEffect(() => {
        if (user) {
            fetchDoctors();
            fetchNursingCharges();
            fetchSpecialityClinics();

            if (patientId) {
                handleFetchAndSelectPatient(patientId, encounterId);
            }
        }
    }, [user, patientId, encounterId]);

    const handleFetchAndSelectPatient = async (pId, eId) => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Fetch patient details
            const { data: patient } = await axios.get(`${backendUrl}/api/patients/${pId}`, config);
            setSelectedPatient(patient);

            // Fetch patient's encounters
            const { data: patientEncounters } = await axios.get(`${backendUrl}/api/visits?patient=${pId}`, config);

            // Filter by relevant statuses if needed (optional, but keep consistent with previous logic if it was filtering)
            const filteredEncounters = patientEncounters.filter(v =>
                ['registered', 'payment_pending', 'in_nursing', 'with_doctor', 'awaiting_services', 'in_pharmacy', 'in_lab', 'in_radiology', 'in_ward', 'admitted', 'completed', 'cancelled', 'discharged'].includes(v.encounterStatus)
            );

            filteredEncounters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setEncounters(filteredEncounters);

            if (eId) {
                const targetEncounter = filteredEncounters.find(e => e._id === eId);
                if (targetEncounter) {
                    handleSelectEncounter(targetEncounter);
                }
            }
        } catch (error) {
            console.error('Error auto-selecting patient:', error);
            toast.error('Error loading patient details');
        } finally {
            setLoading(false);
        }
    };

    const fetchNursingCharges = async () => {
        try {
            // setLoading(true); // Optional: might not want to block UI for background fetch
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/charges?type=nursing&active=true`, config);
            setNursingCharges(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDoctors = async () => {
        if (!user) return;
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/users/doctors`, config);
            setDoctors(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchSpecialityClinics = async () => {
        if (!user) return;
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/speciality-clinics?active=true`, config);
            setSpecialityClinics(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchRetainershipDepositStatus = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/hmo-transactions/retainership-deposit-status`, config);
            setRetainershipDepositStatus(data);
        } catch (error) {
            console.error('Error fetching retainership deposit status:', error);
        }
    };

    const fetchWards = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/wards`, config);
            setWards(data);
        } catch (error) {
            console.error('Error fetching wards:', error);
        }
    };

    useEffect(() => {
        if (showConvertModal) {
            fetchWards();
            fetchRetainershipDepositStatus();
        }
    }, [showConvertModal]);

    useEffect(() => {
        if (selectedWard && wards.length > 0) {
            const ward = wards.find(w => w._id === selectedWard);
            if (ward) {
                setAvailableBeds(ward.beds.filter(b => !b.isOccupied));
            }
        } else {
            setAvailableBeds([]);
        }
    }, [selectedWard, wards]);

    const handleOpenConvertModal = (e, encounter) => {
        e.stopPropagation(); // Prevent selecting the encounter row
        setEncounterToConvert(encounter);
        setSelectedWard('');
        setSelectedBed('');
        setShowConvertModal(true);
    };

    const handleConvertFromNurse = async () => {
        if (!selectedWard || !selectedBed) {
            toast.error('Please select Ward and Bed');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/visits/${encounterToConvert._id}/convert-to-inpatient`,
                { ward: selectedWard, bed: selectedBed },
                config
            );

            toast.success('Patient admitted to Inpatient!');
            setShowConvertModal(false);
            setEncounterToConvert(null);
            handleSelectPatient(selectedPatient); // Refresh encounters
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error converting encounter');
        } finally {
            setLoading(false);
        }
    };

    const searchPatients = async () => {
        if (!searchTerm || !user) return;
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/patients`, config);
            const filtered = data.filter(p =>
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (p.mrn && p.mrn.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (p.contact && p.contact.includes(searchTerm))
            );
            setPatients(filtered);
        } catch (error) {
            console.error(error);
            toast.error('Error searching patients');
        } finally {
            setLoading(false);
        }
    };

    const fetchPatientEncounters = async (patientId) => {
        try {
            if (!user) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data: patientEncounters } = await axios.get(`${backendUrl}/api/visits?patient=${patientId}`, config);

            const filteredEncounters = patientEncounters.filter(v =>
                ['registered', 'payment_pending', 'in_nursing', 'with_doctor', 'awaiting_services', 'in_pharmacy', 'in_lab', 'in_radiology', 'in_ward', 'admitted', 'completed', 'cancelled', 'discharged'].includes(v.encounterStatus)
            );
            // Sort encounters by creation date - latest first
            filteredEncounters.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setEncounters(filteredEncounters);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching encounters');
        }
    };

    const handleSelectPatient = async (patient) => {
        setSelectedPatient(patient);
        setSelectedEncounter(null);
        setReceiptValidated(false);
        setReceiptNumber('');
        setExistingVitals([]);
        setSelectedDoctor('');
        setNeedSpeciality(false);
        setSelectedSpecialityClinic('');
        setNeedSpecificDoctor(false);
        setSelectedSpecificDoctor('');

        setLoading(true);
        await fetchPatientEncounters(patient._id);
        setLoading(false);
    };

    const handleSelectEncounter = async (encounter) => {
        setSelectedEncounter(encounter);

        // Check if already validated OR if it's an ANC visit (bypass payment validation)
        if (encounter.paymentValidated || encounter.isANC) {
            setReceiptValidated(true);
            setReceiptNumber(encounter.receiptNumber || (encounter.isANC ? 'ANC-BYPASS' : 'PRE-VALIDATED'));
        } else {
            setReceiptValidated(false);
            setReceiptNumber('');
        }

        try {
            setLoading(true);
            if (!user) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Fetch existing vitals
            try {
                const { data } = await axios.get(`${backendUrl}/api/vitals/visit/${encounter._id}`, config);
                setExistingVitals(data);
            } catch (error) {
                console.error(error);
            }

            // Fetch encounter charges
            await fetchEncounterCharges(encounter._id);

            // Fetch drug administration data if Inpatient
            if (encounter.type === 'Inpatient') {
                await fetchDrugAdministrationData(encounter._id);
            }

            // Pre-fill doctor and restrictions if assigned
            if (encounter.consultingPhysician) {
                setSelectedDoctor(encounter.consultingPhysician._id || encounter.consultingPhysician);
            }
            setNeedSpeciality(!!encounter.needSpeciality);
            setSelectedSpecialityClinic(encounter.specialityClinic?._id || encounter.specialityClinic || '');
            setNeedSpecificDoctor(!!encounter.needSpecificDoctor);
            setSelectedSpecificDoctor(encounter.specificDoctor?._id || encounter.specificDoctor || '');
            // Parse nursing notes from JSON if exists
            if (encounter.nursingNotes) {
                try {
                    const notes = JSON.parse(encounter.nursingNotes);
                    setNursingNotesList(Array.isArray(notes) ? notes : []);
                } catch (e) {
                    // If it's old format (plain string), ignore or migrate
                    setNursingNotesList([]);
                }
            } else {
                setNursingNotesList([]);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleValidateReceipt = async () => {
        if (!receiptNumber.trim()) {
            toast.error('Please enter receipt number');
            return;
        }

        try {
            setLoading(true);
            if (!user) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const response = await axios.post(
                `${backendUrl}/api/receipts/validate`,
                { receiptNumber: receiptNumber.trim(), department: 'Nursing' },
                config
            );

            if (response.data.valid) {
                setReceiptValidated(true);
                toast.success('Receipt validated! You can now proceed with patient care.');

                // Update encounter status
                if (selectedEncounter) {
                    await axios.put(
                        `${backendUrl}/api/visits/${selectedEncounter._id}`,
                        {
                            encounterStatus: 'in_nursing',
                            paymentValidated: true,
                            receiptNumber: receiptNumber.trim()
                        },
                        config
                    );
                    // Update local state to reflect change
                    setSelectedEncounter({
                        ...selectedEncounter,
                        paymentValidated: true,
                        receiptNumber: receiptNumber.trim()
                    });
                }
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Invalid receipt number');
            setReceiptValidated(false);
        } finally {
            setLoading(false);
        }
    };

    const handleEditVital = (vital) => {
        setEditingVitalId(vital._id);
        const weight = vital.weight || '';
        const height = vital.height || '';
        setVitals({
            temperature: vital.temperature || '',
            bloodPressure: vital.bloodPressure || '',
            heartRate: vital.pulseRate || '',
            respiratoryRate: vital.respiratoryRate || '',
            weight,
            height,
            spo2: vital.spo2 || '',
            bmi: vital.bmi || calculateBMI(weight, height)
        });
        setShowVitalsModal(true);
        // Scroll to form - no longer needed as it's a modal
    };

    const handleCancelEdit = () => {
        setEditingVitalId(null);
        setVitals({
            temperature: '', bloodPressure: '', heartRate: '',
            respiratoryRate: '', weight: '', height: '', spo2: '', bmi: ''
        });
        setShowVitalsModal(false);
    };

    // Helper function to get color class for vital signs based on normal ranges
    const getVitalColorClass = (vitalType, value) => {
        if (!value || value === '-') return '';

        const numValue = parseFloat(value);
        if (isNaN(numValue)) return '';

        switch (vitalType) {
            case 'temperature':
                // Normal: 36.1-37.2Ã‚Â°C
                if (numValue < 36.1) return 'text-yellow-600 font-semibold';
                if (numValue > 37.2) return 'text-red-600 font-semibold';
                return '';

            case 'heartRate':
                // Normal: 60-100 bpm
                if (numValue < 60) return 'text-yellow-600 font-semibold';
                if (numValue > 100) return 'text-red-600 font-semibold';
                return '';

            case 'respiratoryRate':
                // Normal: 12-20 breaths/min
                if (numValue < 12) return 'text-yellow-600 font-semibold';
                if (numValue > 20) return 'text-red-600 font-semibold';
                return '';

            case 'spo2':
                // Normal: Ã¢â€°Â¥95%
                if (numValue < 95) return 'text-red-600 font-semibold';
                if (numValue < 90) return 'text-red-700 font-bold';
                return '';

            case 'bloodPressure':
                // Parse systolic/diastolic (e.g., "120/80")
                const parts = value.toString().split('/');
                if (parts.length === 2) {
                    const systolic = parseFloat(parts[0]);
                    const diastolic = parseFloat(parts[1]);

                    // Normal: Systolic 90-120, Diastolic 60-80
                    if (systolic < 90 || diastolic < 60) return 'text-yellow-600 font-semibold';
                    if (systolic > 140 || diastolic > 90) return 'text-red-600 font-semibold';
                }
                return '';

            default:
                return '';
        }
    };

    const handleRecordVitals = async () => {
        // Check if at least one vital is entered
        if (!vitals.temperature && !vitals.bloodPressure && !vitals.heartRate && !vitals.weight && !vitals.respiratoryRate && !vitals.height && !vitals.spo2) {
            toast.warning('Please enter at least one vital sign');
            return;
        }

        try {
            setLoading(true);
            if (!user) return;
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editingVitalId) {
                // Update existing vital
                await axios.put(
                    `${backendUrl}/api/vitals/${editingVitalId}`,
                    {
                        ...vitals,
                        pulseRate: vitals.heartRate // Map heartRate back to pulseRate
                    },
                    config
                );
                toast.success('Vitals updated successfully!');
                setEditingVitalId(null);
            } else {
                // Create new vital
                await axios.post(
                    `${backendUrl}/api/vitals`,
                    {
                        patientId: selectedPatient._id,
                        encounterId: selectedEncounter._id,
                        ...vitals,
                        pulseRate: vitals.heartRate // Map heartRate back to pulseRate
                    },
                    config
                );
                toast.success('Vitals recorded successfully!');
            }

            // Refresh vitals list
            const { data } = await axios.get(`${backendUrl}/api/vitals/visit/${selectedEncounter._id}`, config);
            setExistingVitals(data);

            setVitals({
                temperature: '', bloodPressure: '', heartRate: '',
                respiratoryRate: '', weight: '', height: '', spo2: '', bmi: ''
            });
            setShowVitalsModal(false);
        } catch (error) {
            console.error(error);
            toast.error('Error recording vitals');
        } finally {
            setLoading(false);
        }
    };



    const fetchEncounterCharges = async (encounterId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/encounter-charges/encounter/${encounterId}`, config);
            setEncounterCharges(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchDrugAdministrationData = async (encounterId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data: prescriptions } = await axios.get(`${backendUrl}/api/prescriptions/visit/${encounterId}`, config);
            const consumableKeywords = ['syringe', 'cannula', 'giving set', 'infusion set', 'needle', 'plaster', 'gloves', 'mask', 'catheter', 'bandage'];
            const filteredPrescriptions = prescriptions.filter(p => p.status === 'dispensed').map(p => ({
                ...p,
                medicines: p.medicines.filter(m => {
                    const isMedication = m.dosage || m.route || m.frequency;
                    const isConsumable = consumableKeywords.some(keyword => m.name.toLowerCase().includes(keyword));
                    return isMedication && !isConsumable;
                })
            })).filter(p => p.medicines.length > 0);

            setDispensedPrescriptions(filteredPrescriptions);

            const { data: history } = await axios.get(`${backendUrl}/api/drug-administration/visit/${encounterId}`, config);
            setAdministrationHistory(history);
        } catch (error) {
            console.error('Error fetching drug admin data:', error);
        }
    };

    const handleRecordDrugAdmin = async () => {
        if (!adminForm.date || !adminForm.time) {
            toast.error('Please select date and time');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const administeredAt = new Date(`${adminForm.date}T${adminForm.time}`);

            await axios.post(`${backendUrl}/api/drug-administration`, {
                visitId: selectedEncounter._id,
                patientId: selectedPatient._id,
                prescriptionId: adminForm.prescriptionId,
                medicineId: adminForm.medicineId,
                medicineName: adminForm.medicineName,
                dosage: adminForm.dosage,
                administeredAt,
                remarks: adminForm.remarks
            }, config);

            toast.success('Drug administration recorded');
            setShowDrugAdminModal(false);
            fetchDrugAdministrationData(selectedEncounter._id);
            setAdminForm({ ...adminForm, remarks: '' });
        } catch (error) {
            console.error(error);
            toast.error('Error recording administration');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCharge = async () => {
        if (!chargeForm.selectedChargeId) {
            toast.error('Please select a service');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            if (editingChargeId) {
                await axios.put(
                    `${backendUrl}/api/encounter-charges/${editingChargeId}`,
                    {
                        quantity: chargeForm.quantity,
                        notes: chargeForm.notes
                    },
                    config
                );
                toast.success('Charge updated');
                setEditingChargeId(null);
            } else {
                await axios.post(
                    `${backendUrl}/api/encounter-charges`,
                    {
                        encounterId: selectedEncounter._id,
                        patientId: selectedPatient._id,
                        chargeId: chargeForm.selectedChargeId,
                        quantity: chargeForm.quantity,
                        notes: chargeForm.notes
                    },
                    config
                );
                toast.success('Charge added');
            }

            setChargeForm({ selectedChargeId: '', quantity: 1, notes: '' });
            fetchEncounterCharges(selectedEncounter._id);
            setShowChargesModal(false); // Auto-close modal after submission
        } catch (error) {
            console.error(error);
            toast.error('Error saving charge');
        } finally {
            setLoading(false);
        }
    };

    const handleEditCharge = (charge) => {
        if (charge.status !== 'pending') {
            toast.error('Cannot edit processed charges');
            return;
        }
        setEditingChargeId(charge._id);
        setChargeForm({
            selectedChargeId: charge.charge._id,
            quantity: charge.quantity,
            notes: charge.notes || ''
        });
        setShowChargesModal(true); // Open modal for editing
    };

    const handleDeleteCharge = async (id) => {
        if (!window.confirm('Are you sure you want to remove this charge?')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/encounter-charges/${id}`, config);
            toast.success('Charge removed');
            fetchEncounterCharges(selectedEncounter._id);
        } catch (error) {
            console.error(error);
            toast.error('Error removing charge');
        } finally {
            setLoading(false);
        }
    };

    const handleCancelChargeEdit = () => {
        setEditingChargeId(null);
        setChargeForm({ selectedChargeId: '', quantity: 1, notes: '' });
    };

    // Nursing Notes CRUD Functions
    // Helper function to save notes to backend
    const saveNotesToBackend = async (notes) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`${backendUrl}/api/visits/${selectedEncounter._id}`, {
                nursingNotes: JSON.stringify(notes)
            }, config);
        } catch (error) {
            console.error("Failed to save notes", error);
            toast.error("Failed to save note to server");
        }
    };

    // Nursing Notes CRUD Functions
    const handleAddNote = async () => {
        if (!noteForm.category?.trim() || !noteForm.comment.trim()) {
            toast.error('Please enter a category and add a comment');
            return;
        }

        let updatedNotesList;

        if (noteForm.editingNoteId) {
            // Update existing note
            updatedNotesList = nursingNotesList.map(note =>
                note.id === noteForm.editingNoteId
                    ? {
                        ...note,
                        service: { _id: note.service?._id || '', name: noteForm.category },
                        category: noteForm.category,
                        comment: noteForm.comment,
                        updatedAt: new Date().toISOString()
                    }
                    : note
            );
            toast.success('Note updated');
        } else {
            // Add new note
            const newNote = {
                id: Date.now().toString(), // Temporary ID
                service: { _id: '', name: noteForm.category },
                category: noteForm.category,
                comment: noteForm.comment,
                nurse: { _id: user._id, name: user.name },
                createdAt: new Date().toISOString()
            };
            updatedNotesList = [...nursingNotesList, newNote];
            toast.success('Note added');
        }

        setNursingNotesList(updatedNotesList);
        await saveNotesToBackend(updatedNotesList);

        // Reset form and close modal
        setNoteForm({ category: '', comment: '', editingNoteId: null });
        setShowNurseNoteModal(false);
    };

    const handleEditNote = (note) => {
        setNoteForm({
            category: note.category || note.service?.name || '',
            comment: note.comment,
            editingNoteId: note.id
        });
        setShowNurseNoteModal(true);
    };

    const handleDeleteNote = async (id) => {
        if (!window.confirm('Are you sure you want to delete this note?')) return;
        const updatedNotesList = nursingNotesList.filter(note => note.id !== id);
        setNursingNotesList(updatedNotesList);
        await saveNotesToBackend(updatedNotesList);
        toast.success('Note deleted');
    };

    const handleCancelNoteEdit = () => {
        setNoteForm({ category: '', comment: '', editingNoteId: null });
    };

    // Helper to check if an encounter is active (for Outpatients, check 24h window; for Inpatients, check status)

    const isEncounterActive = (encounter) => {
        if (!encounter) return false;
        const now = new Date();
        const created = new Date(encounter.createdAt);
        const inactiveStatuses = ['completed', 'cancelled', 'discharged'];

        if (inactiveStatuses.includes(encounter.encounterStatus)) {
            return false;
        }
        if (encounter.isActive === false) return false;
        if (encounter.isActive === true) return true;

        if (encounter.type === 'Inpatient') {
            return !inactiveStatuses.includes(encounter.encounterStatus);
        } else {
            // awaiting_services stays active regardless of time window
            if (encounter.encounterStatus === 'awaiting_services') return true;
            const oneDay = 24 * 60 * 60 * 1000;
            const isActiveTime = (now - created) < oneDay;
            return isActiveTime;
        }
    };

    // Check if the selected encounter is read-only
    const isReadOnly = selectedEncounter && !isEncounterActive(selectedEncounter);

    const handleFinishTriage = async () => {
        if (!selectedEncounter || !user || isReadOnly) return;

        if (!selectedDoctor) {
            toast.warning('Please assign a consulting physician');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Update Visit Status to 'with_doctor' AND save Nursing Notes & Assigned Physician & Restrictions
            await axios.put(`${backendUrl}/api/visits/${selectedEncounter._id}`, {
                encounterStatus: 'with_doctor',
                consultingPhysician: selectedDoctor, // Set the assigned doctor
                nursingNotes: JSON.stringify(nursingNotesList), // Save structured notes
                needSpeciality,
                specialityClinic: needSpeciality ? (selectedSpecialityClinic || undefined) : undefined,
                needSpecificDoctor: needSpeciality && needSpecificDoctor,
                specificDoctor: (needSpeciality && needSpecificDoctor) ? (selectedSpecificDoctor || undefined) : undefined
            }, config);

            toast.success('Triage completed! Patient sent to Doctor.');

            // Reset states
            setSelectedEncounter(null);
            setNeedSpeciality(false);
            setSelectedSpecialityClinic('');
            setNeedSpecificDoctor(false);
            setSelectedSpecificDoctor('');
            setVitals({
                temperature: '',
                bloodPressure: '',
                heartRate: '',
                respiratoryRate: '',
                weight: '',
                height: '',
                spo2: '',
                bmi: ''
            });
            setNursingNotesList([]);
            setNoteForm({
                category: '',
                comment: '',
                editingNoteId: null
            });
            handleSelectPatient(selectedPatient); // Refresh list
        } catch (error) {
            console.error(error);
            toast.error('Error finishing triage');
        } finally {
            setLoading(false);
        }
    };

    const handleDischarge = async (e, encounter) => {
        e.stopPropagation();
        setEncounterToDischarge(encounter);
        setDischargeNote('');
        setShowDischargeModal(true);
    };

    const handleConfirmDischarge = async () => {
        if (!encounterToDischarge) return;
        if (!dischargeNote.trim()) {
            toast.error('Please write a discharge note / summary before discharging.');
            return;
        }
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`${backendUrl}/api/visits/${encounterToDischarge._id}`, {
                encounterStatus: 'discharged',
                status: 'Discharged',
                dischargeNotes: dischargeNote
            }, config);

            toast.success('Patient discharged successfully!');
            setShowDischargeModal(false);
            setDischargeNote('');

            // Refresh patient encounters if this patient is selected
            if (selectedPatient && (selectedPatient._id === encounterToDischarge.patient._id || selectedPatient._id === encounterToDischarge.patient)) {
                handleSelectPatient(selectedPatient);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error discharging patient');
        } finally {
            setLoading(false);
        }
    };

    const isRetainership = ['Retainership', 'Corporate Retainership', 'Family Retainership'].includes(selectedPatient?.provider);
    const hasPatientDeposit = (selectedPatient?.depositBalance || 0) > 0;
    const hmoDepositInfo = isRetainership && retainershipDepositStatus.find(s => s.name === selectedPatient?.hmo);
    const hasHmoDeposit = hmoDepositInfo ? hmoDepositInfo.hasDeposit : false;
    const isBlocked = isRetainership ? (!hasPatientDeposit && !hasHmoDeposit) : !hasPatientDeposit;

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FaUserMd className="text-pink-600" /> Nursing Station / Triage
            </h2>

            {/* Search Patient */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Search Patient
                </h3>
                <div className="flex gap-2 mb-4">
                    <input
                        type="text"
                        placeholder="Search by Name, MRN or Phone Number..."
                        className="flex-1 border p-2 rounded"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchPatients()}
                    />
                    <button
                        onClick={searchPatients}
                        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
                    >
                        Search
                    </button>
                </div>

                {/* Patient Results */}
                {patients.length > 0 && !selectedPatient && (
                    <div className="space-y-2">
                        <p className="font-semibold text-gray-700">Search Results:</p>
                        {patients.map(patient => (
                            <div
                                key={patient._id}
                                onClick={() => handleSelectPatient(patient)}
                                className="p-3 border rounded hover:bg-gray-50 cursor-pointer"
                            >
                                <p className="font-semibold">{patient.name}</p>
                                <p className="text-sm text-gray-600">
                                    MRN: {patient.mrn} | Age: {formatAge(patient.age)} | {patient.gender}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Selected Patient - Show Encounters */}
                {selectedPatient && !selectedEncounter && (
                    <div>
                        <div className="bg-blue-50 p-4 rounded mb-4">
                            <p className="font-bold text-lg">{selectedPatient.name}</p>
                            <p className="text-sm text-gray-600">MRN: {selectedPatient.mrn}</p>
                            <button
                                onClick={() => {
                                    setSelectedPatient(null);
                                    setEncounters([]);
                                }}
                                className="text-blue-600 text-sm mt-2 hover:underline"
                            >
                                Ã¢â€ Â Change Patient
                            </button>
                        </div>

                        <p className="font-semibold text-gray-700 mb-3">Select Recent Encounter:</p>
                        {encounters.length === 0 ? (
                            <p className="text-gray-500">No pending encounters for this patient</p>
                        ) : (
                            <div className="space-y-2">
                                {encounters.map(encounter => (
                                    <div
                                        key={encounter._id}
                                        onClick={() => handleSelectEncounter(encounter)}
                                        className="p-3 border rounded hover:bg-gray-50 cursor-pointer relative"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold flex items-center gap-2">
                                                    {encounter.type} Visit
                                                    {encounter.isANC && (
                                                        <span className="bg-pink-100 text-pink-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                                            ðŸ¤° ANC
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {new Date(encounter.createdAt).toLocaleDateString()} - Status: {encounter.encounterStatus}
                                                </p>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-3 py-1 rounded text-sm ${encounter.waiveConsultationFee
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : (encounter.paymentValidated || encounter.isANC)
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {encounter.waiveConsultationFee
                                                        ? `Waived by ${encounter.waivedBy?.name || encounter.doctor?.name || 'Staff'}`
                                                        : (encounter.paymentValidated || encounter.isANC)
                                                            ? (encounter.isANC ? 'ANC' : 'Paid')
                                                            : 'Pending'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Receipt Validation & Nursing Care */}
            {selectedEncounter && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <div className="bg-blue-50 p-4 rounded mb-6 flex justify-between items-center">
                        <div>
                            <p className="font-bold flex items-center gap-2">
                                {selectedPatient.name} - {selectedEncounter.type} Visit
                                {selectedEncounter.isANC && (
                                    <span className="bg-pink-100 text-pink-700 text-xs px-2 py-1 rounded-full font-bold">
                                        ðŸ¤° ANC Visit (Payment Bypassed)
                                    </span>
                                )}
                            </p>
                            <p className="text-sm text-gray-600">
                                {new Date(selectedEncounter.createdAt).toLocaleDateString()}
                            </p>
                        </div>
                        <button
                            onClick={() => setSelectedEncounter(null)}
                            className="text-blue-600 hover:underline text-sm"
                        >
                            Change Encounter
                        </button>
                    </div>

                    {/* Receipt Validation */}
                    {!receiptValidated && (
                        <div className="border-2 border-yellow-300 bg-yellow-50 p-6 rounded mb-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-800">
                                <FaCheckCircle /> Validate Payment Receipt
                            </h3>
                            <p className="text-sm text-gray-700 mb-4">
                                Please verify that the patient has paid the consultation fee before proceeding.
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter Receipt Number (e.g., RCP-123456-7890)"
                                    className="flex-1 border-2 border-yellow-300 p-3 rounded font-mono"
                                    value={receiptNumber}
                                    onChange={(e) => setReceiptNumber(e.target.value.toUpperCase())}
                                />
                                <button
                                    onClick={handleValidateReceipt}
                                    className="bg-yellow-600 text-white px-6 py-3 rounded hover:bg-yellow-700 font-semibold"
                                >
                                    Validate Receipt
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Nursing Care Form */}
                    {receiptValidated && (
                        <div>
                            <div className="bg-green-50 p-4 rounded mb-6">
                                <p className="text-green-700 font-semibold flex items-center gap-2">
                                    <FaCheckCircle /> {selectedEncounter.isANC ? 'ANC Visit - Payment Verification Bypassed' : `Payment Validated - Receipt #${receiptNumber}`}
                                </p>
                            </div>

                            {/* Existing Vitals History */}
                            {existingVitals.length > 0 && (
                                <div className="mb-6 border rounded p-4">
                                    <h4 className="font-bold text-gray-700 mb-2">Previous Vitals for this Visit:</h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm text-left">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2">Time</th>
                                                    <th className="p-2">BP (mmHg)</th>
                                                    <th className="p-2">Temp (Ã‚Â°C)</th>
                                                    <th className="p-2">HR (bpm)</th>
                                                    <th className="p-2">RR (/min)</th>
                                                    <th className="p-2">SpO2 (%)</th>
                                                    <th className="p-2">Wt (kg)</th>
                                                    <th className="p-2">Ht (cm)</th>
                                                    <th className="p-2">BMI (kg/m\u00b2)</th>
                                                    <th className="p-2">Nurse</th>
                                                    <th className="p-2">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {existingVitals.map((v, idx) => {
                                                    const bmi = v.bmi || calculateBMI(v.weight, v.height);
                                                    return (
                                                        <tr key={idx} className="border-b">
                                                            <td className="p-2">{new Date(v.createdAt).toLocaleTimeString()}</td>
                                                            <td className={`p-2 ${getVitalColorClass('bloodPressure', v.bloodPressure)}`}>
                                                                {v.bloodPressure || '-'}
                                                            </td>
                                                            <td className={`p-2 ${getVitalColorClass('temperature', v.temperature)}`}>
                                                                {v.temperature ? `${v.temperature}` : '-'}
                                                            </td>
                                                            <td className={`p-2 ${getVitalColorClass('heartRate', v.pulseRate)}`}>
                                                                {v.pulseRate || '-'}
                                                            </td>
                                                            <td className={`p-2 ${getVitalColorClass('respiratoryRate', v.respiratoryRate)}`}>
                                                                {v.respiratoryRate || '-'}
                                                            </td>
                                                            <td className={`p-2 ${getVitalColorClass('spo2', v.spo2)}`}>
                                                                {v.spo2 ? `${v.spo2}` : '-'}
                                                            </td>
                                                            <td className="p-2">{v.weight || '-'}</td>
                                                            <td className="p-2">{v.height || '-'}</td>
                                                            <td className={`p-2 font-semibold ${bmi ? (
                                                                parseFloat(bmi) < 18.5 ? 'text-yellow-600' :
                                                                    parseFloat(bmi) < 25 ? 'text-green-600' :
                                                                        parseFloat(bmi) < 30 ? 'text-orange-500' :
                                                                            parseFloat(bmi) < 35 ? 'text-orange-700' :
                                                                                parseFloat(bmi) < 40 ? 'text-red-500' :
                                                                                    parseFloat(bmi) < 50 ? 'text-red-700' :
                                                                                        'text-purple-700'
                                                            ) : ''
                                                                }`}>
                                                                {bmi ? `${bmi} ${parseFloat(bmi) < 18.5 ? '(Underweight)' :
                                                                    parseFloat(bmi) < 25 ? '(Normal)' :
                                                                        parseFloat(bmi) < 30 ? '(Overweight)' :
                                                                            parseFloat(bmi) < 35 ? '(Grade I Obese)' :
                                                                                parseFloat(bmi) < 40 ? '(Grade II Obese)' :
                                                                                    parseFloat(bmi) < 50 ? '(Morbidly Obese)' :
                                                                                        '(Super Obese)'}` : '-'}
                                                            </td>
                                                            <td className="p-2">{v.nurse?.name || 'Unknown'}</td>
                                                            <td className="p-2">
                                                                {(!isReadOnly) && (
                                                                    <button
                                                                        onClick={() => handleEditVital(v)}
                                                                        className="text-blue-600 hover:underline text-xs"
                                                                    >
                                                                        Edit
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Drug Observation Chart - Only for Admitted Inpatients */}
                            {(selectedEncounter.type === 'Inpatient' && selectedEncounter.encounterStatus !== 'discharged' && selectedEncounter.encounterStatus !== 'cancelled') && (
                                <div className="mb-8">
                                    <div className="bg-gradient-to-r from-blue-700 to-blue-600 text-white p-3 rounded-t-lg flex justify-between items-center shadow-md">
                                        <h4 className="font-bold flex items-center gap-2">
                                            <FaTable /> Drug Observation Chart
                                        </h4>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] bg-blue-500/50 px-2 py-0.5 rounded-full uppercase tracking-widest font-bold border border-blue-400/30">Dispensed</span>
                                        </div>
                                    </div>

                                    <div className="bg-white border-x border-b border-blue-200 rounded-b-lg shadow-sm overflow-hidden">
                                        {dispensedPrescriptions.length === 0 ? (
                                            <div className="p-8 text-center text-gray-400 italic text-sm">
                                                No dispensed medications found.
                                            </div>
                                        ) : (
                                            <div className="">
                                                {/* Group administrations by Day */}
                                                {(() => {
                                                    const admissionDate = new Date(selectedEncounter.admissionDate || selectedEncounter.createdAt);
                                                    admissionDate.setHours(0, 0, 0, 0);

                                                    // Get all unique dates from history, and today
                                                    const historyDates = [...new Set(administrationHistory.map(h => {
                                                        const d = new Date(h.administeredAt);
                                                        d.setHours(0, 0, 0, 0);
                                                        return d.getTime();
                                                    }))];

                                                    const today = new Date();
                                                    today.setHours(0, 0, 0, 0);
                                                    if (!historyDates.includes(today.getTime())) {
                                                        historyDates.push(today.getTime());
                                                    }

                                                    return historyDates.sort().reverse().map((dateTimestamp, idx) => {
                                                        const currentDate = new Date(dateTimestamp);
                                                        const diffTime = dateTimestamp - admissionDate.getTime();
                                                        const dayNum = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
                                                        const isExpanded = expandedDays[dateTimestamp] !== false; // Default to true if not explicitly false

                                                        const dayHistory = administrationHistory.filter(h => {
                                                            const d = new Date(h.administeredAt);
                                                            d.setHours(0, 0, 0, 0);
                                                            return d.getTime() === dateTimestamp;
                                                        });

                                                        const dayTimes = [...new Set(dayHistory.map(h =>
                                                            new Date(h.administeredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
                                                        ))].sort();

                                                        return (
                                                            <div key={dateTimestamp} className="border-b last:border-0">
                                                                <button
                                                                    onClick={() => setExpandedDays(prev => ({ ...prev, [dateTimestamp]: !isExpanded }))}
                                                                    className="w-full bg-gray-50/50 px-4 py-2 hover:bg-blue-50 transition-colors flex items-center justify-between text-blue-900 border-b border-gray-100"
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        {isExpanded ? <FaChevronDown size={12} className="text-blue-400" /> : <FaChevronRight size={12} className="text-blue-400" />}
                                                                        <span className="font-bold text-sm">Day {dayNum} <span className="text-gray-400 font-normal ml-2">({currentDate.toLocaleDateString('en-GB')})</span></span>
                                                                        {dayNum === 1 && <span className="text-[9px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase">Admission</span>}
                                                                        {dateTimestamp === today.getTime() && <span className="text-[9px] bg-green-100 text-green-600 px-1.5 py-0.5 rounded font-bold uppercase">Today</span>}
                                                                    </div>
                                                                    <div className="text-[10px] text-gray-500 font-medium">
                                                                        {dayHistory.length} Administrations recorded
                                                                    </div>
                                                                </button>

                                                                {isExpanded && (
                                                                    <div className="overflow-x-auto">
                                                                        <table className="w-full text-xs text-left border-collapse">
                                                                            <thead className="bg-gray-100/50 border-b">
                                                                                <tr>
                                                                                    <th className="p-2 border-r font-bold text-gray-600 w-64">Medication</th>
                                                                                    {dayTimes.map(timeStr => (
                                                                                        <th key={timeStr} className="p-2 border-r font-bold text-gray-600 text-center min-w-[70px]">
                                                                                            {timeStr}
                                                                                        </th>
                                                                                    ))}
                                                                                    <th className="p-2 border-r font-bold text-green-700 text-center w-16 bg-green-50/30">Action</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {(() => {
                                                                                    let overallRowIdx = 0;
                                                                                    return dispensedPrescriptions.flatMap(p => p.medicines.map(m => {
                                                                                        const isFirstRow = overallRowIdx === 0;
                                                                                        overallRowIdx++;
                                                                                        return (
                                                                                            <tr key={`${p._id}-${m._id || m.name}`} className="hover:bg-blue-50/10 border-b last:border-0 transition-colors">
                                                                                                <td className="p-2 border-r">
                                                                                                    <div className="font-bold text-blue-950 leading-tight flex items-center gap-2">
                                                                                                        {m.name}
                                                                                                        {m.buyOutside && (
                                                                                                            <span className="text-[9px] bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded border border-orange-200 uppercase font-black">
                                                                                                                Buy Outside
                                                                                                            </span>
                                                                                                        )}
                                                                                                    </div>
                                                                                                    <div className="text-[9px] text-gray-500 flex items-center gap-1 mt-0.5">
                                                                                                        <span className="font-medium text-gray-700">{m.dosage}</span>
                                                                                                        <span>|</span>
                                                                                                        <span className="font-medium text-gray-700">{m.frequency}</span>
                                                                                                        {m.route && <><span className="text-orange-500 font-bold px-1 rounded uppercase bg-orange-50 text-[8px] border border-orange-100">{m.route}</span></>}
                                                                                                    </div>
                                                                                                </td>
                                                                                                {dayTimes.map(timeStr => {
                                                                                                    const admin = dayHistory.find(h =>
                                                                                                        new Date(h.administeredAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) === timeStr &&
                                                                                                        (h.medicineId === m._id || h.medicineName === m.name)
                                                                                                    );
                                                                                                    return (
                                                                                                        <td key={timeStr} className="p-2 border-r text-center">
                                                                                                            {admin ? (
                                                                                                                <div className="inline-flex flex-col items-center justify-center p-1 rounded-md bg-green-50 border border-green-200 shadow-sm group relative cursor-help">
                                                                                                                    <span className="font-black text-[8px] text-green-700 uppercase tracking-tighter">Given</span>
                                                                                                                    <span className="text-[7px] text-green-600 leading-none">{getNurseFirstName(admin.nurse?.name)}</span>
                                                                                                                    {isFirstRow ? (
                                                                                                                        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-48 bg-gray-900 border border-gray-700 text-white p-2 rounded-lg text-[9px] hidden group-hover:block z-50 shadow-2xl backdrop-blur-sm text-left">
                                                                                                                            <div className="text-white font-bold mb-1" style={{ color: '#ffffff' }}>
                                                                                                                                Administered by: {admin.nurse?.name || 'Unknown'}
                                                                                                                            </div>
                                                                                                                            {admin.remarks && (
                                                                                                                                <div className="text-gray-300 break-words mt-1 border-t border-gray-700 pt-1">
                                                                                                                                    Remarks: {admin.remarks}
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-gray-900"></div>
                                                                                                                        </div>
                                                                                                                    ) : (
                                                                                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-gray-900 border border-gray-700 text-white p-2 rounded-lg text-[9px] hidden group-hover:block z-50 shadow-2xl backdrop-blur-sm text-left">
                                                                                                                            <div className="text-white font-bold mb-1" style={{ color: '#ffffff' }}>
                                                                                                                                Administered by: {admin.nurse?.name || 'Unknown'}
                                                                                                                            </div>
                                                                                                                            {admin.remarks && (
                                                                                                                                <div className="text-gray-300 break-words mt-1 border-t border-gray-700 pt-1">
                                                                                                                                    Remarks: {admin.remarks}
                                                                                                                                </div>
                                                                                                                            )}
                                                                                                                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                                                                                                                        </div>
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            ) : <span className="text-gray-200">-</span>}
                                                                                                        </td>
                                                                                                    );
                                                                                                })}
                                                                                                <td className="p-2 text-center bg-green-50/20">
                                                                                                    {!isReadOnly && (
                                                                                                        <button
                                                                                                            onClick={() => {
                                                                                                                setAdminForm({
                                                                                                                    ...adminForm,
                                                                                                                    prescriptionId: p._id,
                                                                                                                    medicineId: m._id || m.name,
                                                                                                                    medicineName: m.name,
                                                                                                                    dosage: m.dosage || '',
                                                                                                                    date: new Date().toISOString().split('T')[0],
                                                                                                                    time: new Date().toTimeString().slice(0, 5),
                                                                                                                    remarks: ''
                                                                                                                });
                                                                                                                setShowDrugAdminModal(true);
                                                                                                            }}
                                                                                                            className="w-6 h-6 flex items-center justify-center mx-auto bg-green-600 text-white rounded-md hover:bg-green-700 transition hover:scale-110 shadow-sm"
                                                                                                            title="Record Dose"
                                                                                                        >
                                                                                                            <FaPlus size={8} />
                                                                                                        </button>
                                                                                                    )}
                                                                                                </td>
                                                                                            </tr>
                                                                                        );
                                                                                    }));
                                                                                })()}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        )}
                                        <div className="p-3 bg-gray-50/80 text-[10px] text-gray-500 flex items-center gap-2 border-t border-blue-100 italic">
                                            <FaClock className="text-blue-400" /> Compact observation chart. Only dispensed medications are displayed.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Speciality Restrictions */}
                            <div className="mb-6 bg-blue-50 p-4 rounded-lg border border-blue-200">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={needSpeciality}
                                        onChange={(e) => {
                                            setNeedSpeciality(e.target.checked);
                                            if (!e.target.checked) {
                                                setSelectedSpecialityClinic('');
                                                setNeedSpecificDoctor(false);
                                                setSelectedSpecificDoctor('');
                                            }
                                        }}
                                        className="w-5 h-5 accent-blue-600"
                                    />
                                    <div>
                                        <p className="font-bold text-blue-800 text-sm">🏥 Need Speciality Clinic Restriction?</p>
                                        <p className="text-xs text-blue-600 mt-0.5">Restrict search and visibility of this patient to doctors within a specific clinic.</p>
                                    </div>
                                </label>

                                {needSpeciality && (
                                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-semibold mb-1 text-blue-900">Select Speciality Clinic</label>
                                            <select
                                                className="w-full border p-2 rounded bg-white text-sm"
                                                value={selectedSpecialityClinic}
                                                onChange={(e) => {
                                                    setSelectedSpecialityClinic(e.target.value);
                                                    setNeedSpecificDoctor(false);
                                                    setSelectedSpecificDoctor('');
                                                    setSelectedDoctor(''); // reset consulting doctor
                                                }}
                                            >
                                                <option value="">-- Select Speciality Clinic --</option>
                                                {specialityClinics.map(sc => (
                                                    <option key={sc._id} value={sc._id}>
                                                        {sc.name} ({sc.department})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {selectedSpecialityClinic && (
                                            <div className="flex flex-col justify-end">
                                                <label className="flex items-center gap-3 cursor-pointer p-2 border rounded bg-white border-blue-200">
                                                    <input
                                                        type="checkbox"
                                                        checked={needSpecificDoctor}
                                                        onChange={(e) => {
                                                            setNeedSpecificDoctor(e.target.checked);
                                                            if (!e.target.checked) {
                                                                setSelectedSpecificDoctor('');
                                                            } else {
                                                                setSelectedDoctor(''); // reset consulting doctor
                                                            }
                                                        }}
                                                        className="w-4 h-4 accent-indigo-600"
                                                    />
                                                    <div>
                                                        <p className="font-semibold text-indigo-900 text-xs">Need Specific Doctor?</p>
                                                        <p className="text-[10px] text-indigo-600">Restrict access to a single doctor.</p>
                                                    </div>
                                                </label>
                                            </div>
                                        )}

                                        {needSpecificDoctor && selectedSpecialityClinic && (
                                            <div className="md:col-span-2">
                                                <label className="block text-sm font-semibold mb-1 text-indigo-900">Select Specific Doctor</label>
                                                <select
                                                    className="w-full border p-2 rounded bg-white text-sm"
                                                    value={selectedSpecificDoctor}
                                                    onChange={(e) => {
                                                        setSelectedSpecificDoctor(e.target.value);
                                                        setSelectedDoctor(e.target.value); // Specific doctor is also the consulting physician
                                                    }}
                                                >
                                                    <option value="">-- Select Doctor --</option>
                                                    {doctors
                                                        .filter(doc => (doc.assignedSpecialityClinic?._id || doc.assignedSpecialityClinic) === selectedSpecialityClinic)
                                                        .map(doc => (
                                                            <option key={doc._id} value={doc._id}>
                                                                {doc.name}
                                                            </option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Assign Physician */}
                            {!needSpecificDoctor && (
                                <div className="mb-6">
                                    <label className="block text-gray-700 mb-2 font-semibold">
                                        Assign Consulting Physician *
                                    </label>
                                    <select
                                        className="w-full border p-3 rounded bg-white"
                                        value={selectedDoctor}
                                        onChange={(e) => setSelectedDoctor(e.target.value)}
                                        required
                                    >
                                        <option value="">-- Select Doctor --</option>
                                        {doctors
                                            .filter(doc => {
                                                if (needSpeciality && selectedSpecialityClinic) {
                                                    return (doc.assignedSpecialityClinic?._id || doc.assignedSpecialityClinic) === selectedSpecialityClinic;
                                                }
                                                return true;
                                            })
                                            .map(doctor => (
                                                <option key={doctor._id} value={doctor._id}>
                                                    {doctor.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                            )}

                            {/* Vitals Modal moved below */}

                            {/* Nursing Charges - Button to open modal */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-bold text-lg flex items-center gap-2">
                                        <FaMoneyBillWave className="text-green-600" /> Nursing Service Charges
                                    </h4>
                                    <div className="flex gap-2">
                                        {!isReadOnly && (
                                            <>
                                                <button
                                                    onClick={() => navigate(`/patient/${selectedPatient?._id}`)}
                                                    className="bg-orange-600 text-white px-4 py-2 rounded hover:bg-orange-700 flex items-center gap-2 text-sm shadow-sm transition-all"
                                                >
                                                    <FaHistory /> View Clinical History
                                                </button>
                                                <button
                                                    onClick={() => setShowChargesModal(true)}
                                                    className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaMoneyBillWave /> Add Charge
                                                </button>
                                                <button
                                                    onClick={() => setShowVitalsModal(true)}
                                                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaHeartbeat /> Add Vital Sign
                                                </button>
                                                <button
                                                    onClick={() => setShowNurseNoteModal(true)}
                                                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaNotesMedical /> Add Nurse Note
                                                </button>
                                                {(selectedEncounter.type === 'Outpatient' || selectedEncounter.type === 'Emergency') && (
                                                    <button
                                                        onClick={(e) => handleOpenConvertModal(e, selectedEncounter)}
                                                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2 text-sm"
                                                    >
                                                        Admit Patient
                                                    </button>
                                                )}
                                                {selectedEncounter.type === 'Inpatient' && selectedEncounter.encounterStatus !== 'discharged' && (
                                                    <button
                                                        onClick={(e) => handleDischarge(e, selectedEncounter)}
                                                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2 text-sm"
                                                    >
                                                        Discharge Patient
                                                    </button>
                                                )}
                                                {selectedEncounter.type === 'Inpatient' && selectedEncounter.encounterStatus === 'discharged' && (
                                                    <div className="px-4 py-2 bg-green-600 text-white rounded flex items-center gap-2 text-sm">
                                                        ✓ Discharged
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Discharge Summary Banner - shown when patient is discharged */}
                                {selectedEncounter.encounterStatus === 'discharged' && (
                                    <div className="mb-5 rounded-xl border border-green-200 overflow-hidden shadow-sm">
                                        <div className="bg-green-600 text-white px-4 py-2 flex items-center justify-between text-sm font-semibold">
                                            <span>✓ Discharge Record</span>
                                            <span className="font-normal text-green-200 text-xs">
                                                {selectedEncounter.dischargeDate ? new Date(selectedEncounter.dischargeDate).toLocaleString() : ''}
                                                {selectedEncounter.dischargedBy?.name && ` · By ${selectedEncounter.dischargedBy.name}`}
                                            </span>
                                        </div>
                                        <div className="bg-green-50 px-4 py-3">
                                            {selectedEncounter.dischargeNotes ? (
                                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedEncounter.dischargeNotes}</p>
                                            ) : (
                                                <p className="text-sm text-amber-700 italic">No discharge summary was recorded.</p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Charges Table - Always visible */}
                                {encounterCharges.filter(c => c.charge?.type === 'nursing').length > 0 && (
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse border text-sm">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="p-2 text-left">Service</th>
                                                    <th className="p-2 text-center">Qty</th>
                                                    <th className="p-2 text-right">Price</th>
                                                    <th className="p-2 text-right">Total</th>
                                                    <th className="p-2 text-left">Notes</th>
                                                    <th className="p-2 text-center">Status</th>
                                                    <th className="p-2 text-center">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {encounterCharges.filter(c => c.charge?.type === 'nursing').map((charge) => (
                                                    <tr key={charge._id} className="border-b hover:bg-gray-50">
                                                        <td className="p-2">{charge.charge?.name}</td>
                                                        <td className="p-2 text-center">{charge.quantity}</td>
                                                        <td className="p-2 text-right">${charge.charge?.basePrice?.toFixed(2)}</td>
                                                        <td className="p-2 text-right font-bold">${charge.totalAmount?.toFixed(2)}</td>
                                                        <td className="p-2 text-gray-600 italic">{charge.notes || '-'}</td>
                                                        <td className="p-2 text-center">
                                                            <span className={`px-2 py-1 rounded text-xs ${charge.status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                                                }`}>
                                                                {charge.status.toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            {charge.status === 'pending' && !isReadOnly && (
                                                                <div className="flex justify-center gap-2">
                                                                    <button
                                                                        onClick={() => handleEditCharge(charge)}
                                                                        className="text-blue-600 hover:text-blue-800"
                                                                        title="Edit"
                                                                    >
                                                                        <FaEdit />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteCharge(charge._id)}
                                                                        className="text-red-600 hover:text-red-800"
                                                                        title="Remove"
                                                                    >
                                                                        <FaTrash />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr className="bg-gray-50 font-bold">
                                                    <td colSpan="3" className="p-2 text-right">Total Pending:</td>
                                                    <td className="p-2 text-right text-blue-800">
                                                        ${encounterCharges
                                                            .filter(c => c.charge?.type === 'nursing' && c.status === 'pending')
                                                            .reduce((sum, c) => sum + c.totalAmount, 0)
                                                            .toFixed(2)}
                                                    </td>
                                                    <td colSpan="3"></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Nursing Notes List */}
                            {nursingNotesList.length > 0 && (
                                <div className="mb-6 border rounded p-4 bg-blue-50">
                                    <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                        <FaNotesMedical className="text-blue-600" /> Nursing Notes
                                    </h4>
                                    <div className="overflow-x-auto">
                                        <table className="w-full border-collapse border text-sm bg-white">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                     <th className="p-2 text-left border">Category</th>
                                                    <th className="p-2 text-left border">Comment</th>
                                                    <th className="p-2 text-left border">Nurse</th>
                                                    <th className="p-2 text-left border">Time</th>
                                                    <th className="p-2 text-center border">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {nursingNotesList.map((note) => (
                                                    <tr key={note.id} className="border-b hover:bg-gray-50">
                                                         <td className="p-2 border font-semibold text-blue-700">{note.category || note.service?.name}</td>
                                                        <td className="p-2 border text-gray-700">{note.comment}</td>
                                                        <td className="p-2 border text-gray-600">{note.nurse?.name || 'Unknown'}</td>
                                                        <td className="p-2 border text-gray-600 text-xs">
                                                            {new Date(note.createdAt).toLocaleString()}
                                                        </td>
                                                        <td className="p-2 border text-center">
                                                            {!isReadOnly && (
                                                                <div className="flex justify-center gap-2">
                                                                    <button
                                                                        onClick={() => handleEditNote(note)}
                                                                        className="text-blue-600 hover:text-blue-800"
                                                                        title="Edit"
                                                                    >
                                                                        <FaEdit />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteNote(note.id)}
                                                                        className="text-red-600 hover:text-red-800"
                                                                        title="Delete"
                                                                    >
                                                                        <FaTrash />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col items-center mt-6 w-full">
                                <button
                                    onClick={async () => {
                                        if (isReadOnly || (!isReadOnly && (!existingVitals || existingVitals.length === 0))) return;
                                        await handleFinishTriage();
                                    }}
                                    disabled={isReadOnly || (!isReadOnly && (!existingVitals || existingVitals.length === 0))}
                                    className={`w-full px-6 py-3 rounded font-bold flex items-center justify-center gap-2 ${(isReadOnly || (!isReadOnly && (!existingVitals || existingVitals.length === 0))) ? 'bg-gray-300 text-gray-500 cursor-not-allowed border border-gray-200' : 'bg-green-600 hover:bg-green-700 text-white shadow-md'}`}
                                >
                                    <FaCheckCircle /> {isReadOnly ? 'Encounter Completed' : 'Finish Triage & Send to Doctor'}
                                </button>
                                {!isReadOnly && (!existingVitals || existingVitals.length === 0) && (
                                    <p className="text-red-600 text-xs font-semibold text-center mt-2 flex items-center gap-1.5 bg-red-50 p-2 rounded border border-red-100 w-full justify-center">
                                        ⚠️ You must record at least one vital sign before sending the patient to the doctor.
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )
            }

            {/* Nursing Charges Modal */}
            {
                showChargesModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            {/* Modal Header */}
                            <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <FaMoneyBillWave /> Add Nursing Service Charge
                                </h3>
                                <button
                                    onClick={() => {
                                        setShowChargesModal(false);
                                        setEditingChargeId(null);
                                        setChargeForm({ selectedChargeId: '', quantity: 1, notes: '' });
                                    }}
                                    className="text-white hover:text-gray-200 text-2xl"
                                >
                                    Ãƒâ€”
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6">
                                <div className="bg-gray-50 p-4 rounded mb-4 border">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                        <div className="md:col-span-2">
                                            <label className="block text-sm text-gray-700 mb-2 font-semibold">Service *</label>
                                            <select
                                                className="w-full border p-3 rounded"
                                                value={chargeForm.selectedChargeId}
                                                onChange={(e) => setChargeForm({ ...chargeForm, selectedChargeId: e.target.value })}
                                                disabled={!!editingChargeId}
                                            >
                                                <option value="">-- Select Service --</option>
                                                {nursingCharges.map(charge => (
                                                    <option key={charge._id} value={charge._id}>
                                                        {charge.name} - ${charge.basePrice.toFixed(2)}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-700 mb-2 font-semibold">Quantity *</label>
                                            <input
                                                type="number"
                                                min="1"
                                                className="w-full border p-3 rounded"
                                                value={chargeForm.quantity}
                                                onChange={(e) => setChargeForm({ ...chargeForm, quantity: parseInt(e.target.value) || 1 })}
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm text-gray-700 mb-2 font-semibold">Notes (Optional)</label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="3"
                                            value={chargeForm.notes}
                                            onChange={(e) => setChargeForm({ ...chargeForm, notes: e.target.value })}
                                            placeholder="Additional details..."
                                        ></textarea>
                                    </div>

                                    {/* Total Preview */}
                                    {chargeForm.selectedChargeId && (
                                        <div className="bg-blue-50 p-3 rounded">
                                            <div className="flex justify-between items-center">
                                                <span className="font-semibold">Total:</span>
                                                <span className="font-bold text-xl text-blue-700">
                                                    ${
                                                        (nursingCharges.find(c => c._id === chargeForm.selectedChargeId)?.basePrice || 0) * chargeForm.quantity
                                                    }.00
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-gray-50 p-4 rounded-b-lg flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowChargesModal(false);
                                        setEditingChargeId(null);
                                        setChargeForm({ selectedChargeId: '', quantity: 1, notes: '' });
                                    }}
                                    className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddCharge}
                                    className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2 font-semibold"
                                    disabled={!chargeForm.selectedChargeId}
                                >
                                    <FaMoneyBillWave /> {editingChargeId ? 'Update Charge' : 'Add Charge'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Discharge Note Modal */}
            {showDischargeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                                <FaNotesMedical className="text-lg" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold">Discharge Patient</h3>
                                <p className="text-red-200 text-sm">
                                    {encounterToDischarge?.patient?.name || 'Patient'} — A discharge note is required
                                </p>
                            </div>
                        </div>
                        {/* Body */}
                        <div className="p-6 space-y-4">
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
                                <span className="text-amber-500 font-bold text-base mt-0.5">⚠</span>
                                <span>Discharging will <strong>release the bed</strong> and close the encounter. This action cannot be undone.</span>
                            </div>
                            {encounterToDischarge?.bed && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                                    <span className="font-semibold">Bed to be released: </span>
                                    {typeof encounterToDischarge.ward === 'object' ? encounterToDischarge.ward?.name : 'Ward'} — {encounterToDischarge.bed}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Discharge Note / Summary <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={dischargeNote}
                                    onChange={e => setDischargeNote(e.target.value)}
                                    rows={6}
                                    placeholder="Write a discharge summary including: patient's condition at discharge, instructions given, medications on discharge, follow-up plan, etc."
                                    className="w-full border-2 border-gray-200 focus:border-red-400 rounded-lg p-3 text-sm resize-none outline-none transition"
                                />
                                <p className="text-xs text-gray-400 mt-1">{dischargeNote.length} characters</p>
                            </div>
                        </div>
                        {/* Footer */}
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                onClick={handleConfirmDischarge}
                                disabled={!dischargeNote.trim() || loading}
                                className={`flex-1 py-3 rounded-lg font-semibold text-sm transition ${!dischargeNote.trim() || loading ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                            >
                                {loading ? 'Discharging...' : 'Confirm Discharge & Release Bed'}
                            </button>
                            <button
                                onClick={() => { setShowDischargeModal(false); setDischargeNote(''); setEncounterToDischarge(null); }}
                                disabled={loading}
                                className="flex-1 py-3 rounded-lg font-semibold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Nursing Notes Modal */}
            {
                showNurseNoteModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            {/* Modal Header */}
                            <div className="bg-blue-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <FaNotesMedical /> Nursing Notes
                                </h3>
                                <button
                                    onClick={() => setShowNurseNoteModal(false)}
                                    className="text-white hover:text-gray-200 text-2xl"
                                >
                                    &times;
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6">
                                <div className="bg-gray-50 p-4 rounded mb-4 border">
                                    <div className="mb-4">
                                        <label className="block text-sm text-gray-700 mb-2 font-semibold">
                                            Category *
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full border p-3 rounded text-sm text-gray-800"
                                            placeholder="e.g. Handing Over note, Vital Signs, etc..."
                                            value={noteForm.category || ''}
                                            onChange={(e) => setNoteForm({ ...noteForm, category: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm text-gray-700 mb-2 font-semibold">
                                            Comment / Details *
                                        </label>
                                        <textarea
                                            className="w-full border p-3 rounded"
                                            rows="6"
                                            value={noteForm.comment}
                                            onChange={(e) => setNoteForm({ ...noteForm, comment: e.target.value })}
                                            placeholder="Describe what was done, observations, patient response, etc..."
                                        ></textarea>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="bg-gray-50 p-4 rounded-b-lg flex justify-end gap-3">
                                <button
                                    onClick={() => {
                                        setShowNurseNoteModal(false);
                                        handleCancelNoteEdit();
                                    }}
                                    className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleAddNote}
                                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2 font-semibold"
                                    disabled={!noteForm.category?.trim() || !noteForm.comment.trim()}
                                >
                                    <FaNotesMedical /> {noteForm.editingNoteId ? 'Update Note' : 'Add Note'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Inpatient Conversion Modal (Nurse) */}
            {showConvertModal && encounterToConvert && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
                        <div className="bg-purple-700 text-white p-4 rounded-t-lg flex justify-between items-center">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaCheckCircle /> Admit Patient
                            </h3>
                            <button onClick={() => setShowConvertModal(false)} className="text-white hover:text-gray-200">
                                <FaTrash size={16} />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="mb-4 bg-purple-50 p-3 rounded">
                                <p className="font-bold">{selectedPatient?.name}</p>
                                <p className="text-sm">Converting {encounterToConvert?.type} encounter to Inpatient admission.</p>
                            </div>

                            {/* Deposit Balance status */}
                            <div className="mb-4">
                                <label className="block text-gray-700 font-bold mb-1">Financial Deposit Balance</label>
                                <div className={`p-3 rounded border text-sm font-semibold flex flex-col gap-1 ${isBlocked
                                        ? 'bg-red-50 text-red-800 border-red-200'
                                        : 'bg-green-50 text-green-800 border-green-200'
                                    }`}>
                                    <div className="flex justify-between items-center">
                                        <span>Patient Deposit:</span>
                                        <span className="font-bold">₦{selectedPatient?.depositBalance?.toLocaleString() || '0'}</span>
                                    </div>
                                    {isRetainership && (
                                        <div className="flex justify-between items-center border-t border-dashed border-gray-300 pt-1 mt-1">
                                            <span>Retainership ({selectedPatient?.hmo}):</span>
                                            <span className="font-bold">{hasHmoDeposit ? '✅ Active Deposit' : '❌ No Deposit'}</span>
                                        </div>
                                    )}
                                </div>
                                {isBlocked && (
                                    <p className="text-xs text-red-600 mt-1 font-semibold">
                                        ⚠️ Patient has no deposit balance. Admission is blocked until a deposit is paid.
                                    </p>
                                )}
                            </div>

                            <div className="mb-4">
                                <label className="block text-gray-700 font-bold mb-2">Select Ward</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={selectedWard}
                                    onChange={(e) => setSelectedWard(e.target.value)}
                                    disabled={isBlocked}
                                >
                                    <option value="">-- Select Ward --</option>
                                    {wards.map(ward => (
                                        <option key={ward._id} value={ward._id}>
                                            {ward.name} ({ward.type})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-700 font-bold mb-2">Select Bed</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={selectedBed}
                                    onChange={(e) => setSelectedBed(e.target.value)}
                                    disabled={!selectedWard}
                                >
                                    <option value="">-- Select Bed --</option>
                                    {availableBeds.map(bed => (
                                        <option key={bed._id} value={bed.number}>
                                            {bed.number}
                                        </option>
                                    ))}
                                </select>
                                {selectedWard && availableBeds.length === 0 && (
                                    <p className="text-red-500 text-sm mt-1">No beds available in this ward.</p>
                                )}
                            </div>

                            {selectedWard && selectedPatient?.provider && (
                                <div className="mb-6 p-3 bg-blue-50 rounded text-sm text-blue-800 border border-blue-100">
                                    <p className="font-bold">Provider Scheme: {selectedPatient.provider}</p>
                                    <p>
                                        Daily Rate: ₦{wards.find(w => w._id === selectedWard)?.rates?.[selectedPatient.provider] ||
                                            wards.find(w => w._id === selectedWard)?.rates?.Standard ||
                                            wards.find(w => w._id === selectedWard)?.dailyRate || 0}
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-3">
                                <button
                                    onClick={() => setShowConvertModal(false)}
                                    className="bg-gray-300 text-gray-800 px-4 py-2 rounded hover:bg-gray-400"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConvertFromNurse}
                                    disabled={!selectedWard || !selectedBed || isBlocked}
                                    className={`px-4 py-2 rounded text-white ${(!selectedWard || !selectedBed || isBlocked) ? 'bg-purple-300 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700'}`}
                                >
                                    Admit Patient
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Vitals Modal */}
            {showVitalsModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full border-t-4 border-red-600 overflow-y-auto max-h-[90vh]">
                        <div className="p-4 border-b flex justify-between items-center bg-red-50 sticky top-0 z-10">
                            <h3 className="font-bold text-xl text-red-800 flex items-center gap-2">
                                <FaHeartbeat /> {editingVitalId ? 'Edit Vitals' : 'Record New Vitals'}
                            </h3>
                            <button onClick={handleCancelEdit} className="text-2xl text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="p-6">
                            <div className="grid grid-cols-2 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Temperature (Â°C)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full border p-3 rounded focus:ring-2 focus:ring-red-300 outline-none"
                                        value={vitals.temperature}
                                        onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })}
                                        placeholder="37.0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Blood Pressure (mmHg)</label>
                                    <input
                                        type="text"
                                        className="w-full border p-3 rounded focus:ring-2 focus:ring-red-300 outline-none"
                                        value={vitals.bloodPressure}
                                        onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })}
                                        placeholder="120/80"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Heart Rate (bpm)</label>
                                    <input
                                        type="number"
                                        className="w-full border p-3 rounded focus:ring-2 focus:ring-red-300 outline-none"
                                        value={vitals.heartRate}
                                        onChange={(e) => setVitals({ ...vitals, heartRate: e.target.value })}
                                        placeholder="72"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Respiratory Rate</label>
                                    <input
                                        type="number"
                                        className="w-full border p-3 rounded focus:ring-2 focus:ring-red-300 outline-none"
                                        value={vitals.respiratoryRate}
                                        onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })}
                                        placeholder="16"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">SpO2 (%)</label>
                                    <input
                                        type="number"
                                        className="w-full border p-3 rounded focus:ring-2 focus:ring-red-300 outline-none"
                                        value={vitals.spo2}
                                        onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })}
                                        placeholder="98"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Weight (kg)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full border p-3 rounded focus:ring-2 focus:ring-red-300 outline-none"
                                        value={vitals.weight}
                                        onChange={(e) => {
                                            const newWeight = e.target.value;
                                            setVitals({
                                                ...vitals,
                                                weight: newWeight,
                                                bmi: calculateBMI(newWeight, vitals.height)
                                            });
                                        }}
                                        placeholder="70.5"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Height (cm)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="w-full border p-3 rounded focus:ring-2 focus:ring-red-300 outline-none"
                                        value={vitals.height}
                                        onChange={(e) => {
                                            const newHeight = e.target.value;
                                            setVitals({
                                                ...vitals,
                                                height: newHeight,
                                                bmi: calculateBMI(vitals.weight, newHeight)
                                            });
                                        }}
                                        placeholder="175"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">BMI (kg/mÂ²)</label>
                                    <input
                                        type="text"
                                        className={`w-full border p-3 rounded font-bold ${vitals.bmi ? 'bg-gray-100' : ''}`}
                                        value={vitals.bmi || ''}
                                        placeholder="Auto-calculated"
                                        readOnly
                                        disabled
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 sticky bottom-0 z-10">
                            <button
                                onClick={handleCancelEdit}
                                className="px-6 py-2 text-gray-600 hover:bg-gray-200 rounded font-semibold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRecordVitals}
                                className="px-6 py-2 bg-red-600 text-white rounded font-bold hover:bg-red-700 shadow-md flex items-center gap-2 transition"
                            >
                                <FaHeartbeat /> {editingVitalId ? 'Update Vitals' : 'Save Vitals'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Drug Administration Modal */}
            {showDrugAdminModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-lg shadow-2xl max-w-md w-full border-t-4 border-green-600">
                        <div className="p-4 border-b flex justify-between items-center bg-green-50">
                            <h3 className="font-bold text-xl text-green-800 flex items-center gap-2">
                                <FaNotesMedical /> Record Administration
                            </h3>
                            <button onClick={() => setShowDrugAdminModal(false)} className="text-2xl text-gray-400 hover:text-gray-600">&times;</button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 p-3 rounded border border-blue-100">
                                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Medication</p>
                                <p className="font-bold text-lg text-blue-900">{adminForm.medicineName}</p>
                                <p className="text-sm text-blue-700">Dosage: {adminForm.dosage}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Date Given</label>
                                    <input
                                        type="date"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-300 outline-none"
                                        value={adminForm.date}
                                        onChange={(e) => setAdminForm({ ...adminForm, date: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Time Given</label>
                                    <input
                                        type="time"
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-300 outline-none"
                                        value={adminForm.time}
                                        onChange={(e) => setAdminForm({ ...adminForm, time: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">Observation Notes</label>
                                <textarea
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-300 outline-none"
                                    rows="3"
                                    placeholder="e.g. Patient took medicine without difficulty..."
                                    value={adminForm.remarks}
                                    onChange={(e) => setAdminForm({ ...adminForm, remarks: e.target.value })}
                                ></textarea>
                            </div>
                        </div>
                        <div className="p-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-lg">
                            <button
                                onClick={() => setShowDrugAdminModal(false)}
                                className="px-5 py-2 text-gray-600 hover:bg-gray-200 rounded font-semibold transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleRecordDrugAdmin}
                                className="px-5 py-2 bg-green-600 text-white rounded font-bold hover:bg-green-700 shadow-md flex items-center gap-2 transition"
                            >
                                <FaPlus /> Save Record
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout >
    );
};

export default NurseTriage;

