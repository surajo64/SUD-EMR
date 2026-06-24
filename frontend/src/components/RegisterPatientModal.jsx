import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import { FaTimes, FaUserPlus, FaUserFriends } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { nigeriaData } from '../data/nigeriaData';
import { formatAge } from '../utils/patientUtils';
import { FaIdCard, FaDownload, FaCheckCircle } from 'react-icons/fa';
import PatientIDCard from './PatientIDCard';
import useHospitalSettings from '../hooks/useHospitalSettings';

const RegisterPatientModal = ({ isOpen, onClose, onSuccess, userToken }) => {
    const { settings: hospitalSettings } = useHospitalSettings();
    const [registeredPatient, setRegisteredPatient] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        dateOfBirth: '',
        gender: 'male',
        contact: '',
        address: '',
        state: '',
        lga: '',
        provider: 'Standard',
        hmo: '',
        insuranceNumber: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        isFamilyMember: false,
        familyFileId: ''
    });
    const { backendUrl } = useContext(AppContext);
    const [loading, setLoading] = useState(false);
    const [hmos, setHmos] = useState([]);
    const [familyFiles, setFamilyFiles] = useState([]);
    const [availableLgas, setAvailableLgas] = useState([]);
    const [retainershipDepositStatus, setRetainershipDepositStatus] = useState([]);

    const calculateAge = (dob) => {
        if (!dob) return '';
        const today = new Date();
        const birthDate = new Date(dob);
        let years = today.getFullYear() - birthDate.getFullYear();
        let months = today.getMonth() - birthDate.getMonth();

        if (months < 0 || (months === 0 && today.getDate() < birthDate.getDate())) {
            years--;
            months += 12;
        }

        if (years > 0) {
            return years.toString();
        } else {
            return months > 0 ? `0.${months}` : '0'; // Represent months as decimal for Number field
        }
    };

    const calculateDOBFromAge = (age) => {
        if (!age) return '';
        const today = new Date();
        const birthYear = today.getFullYear() - parseInt(age);
        // Use current month and day as requested
        const dob = new Date(birthYear, today.getMonth(), today.getDate());
        return dob.toISOString().split('T')[0];
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;

        if (name === 'state') {
            const selectedState = nigeriaData.find(item => item.state === value);
            setAvailableLgas(selectedState ? selectedState.lgas : []);
            setFormData(prev => ({
                ...prev,
                state: value,
                lga: ''
            }));
        } else if (name === 'dateOfBirth') {
            const age = calculateAge(value);
            setFormData(prev => ({
                ...prev,
                dateOfBirth: value,
                age: age
            }));
        } else if (name === 'age') {
            const dob = calculateDOBFromAge(value);
            setFormData(prev => ({
                ...prev,
                age: value,
                dateOfBirth: dob
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: type === 'checkbox' ? checked : value
            }));
            // Reset hmo selection whenever provider changes
            if (name === 'provider') {
                setFormData(prev => ({ ...prev, provider: value, hmo: '', insuranceNumber: '' }));
            }
        }
    };

    // Fetch active HMOs and Family Files when component mounts
    useEffect(() => {
        if (userToken && isOpen) {
            fetchHMOs();
            fetchFamilyFiles();
            setRegisteredPatient(null);
        }
    }, [userToken, isOpen]);

    const handlePrintCard = () => {
        const frontContent = document.getElementById(`patient-card-front-${registeredPatient._id}`);
        const backContent = document.getElementById(`patient-card-back-${registeredPatient._id}`);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Patient ID Card - ${registeredPatient.name}</title>
                    <link rel="preconnect" href="https://fonts.googleapis.com">
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
                    <style>
                        body { 
                            margin: 0; 
                            padding: 20px; 
                            font-family: 'Inter', sans-serif; 
                            display: flex; 
                            flex-direction: column; 
                            align-items: center; 
                            gap: 20px; 
                        }
                        @media print {
                            @page { size: auto; margin: 0; }
                            body { margin: 20px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                            .no-print { display: none; }
                            div[id^="patient-card"] { 
                                margin-bottom: 20px !important; 
                                box-shadow: none !important; 
                                break-inside: avoid; 
                                border-top: 5px solid #2563eb !important; 
                                border-bottom: 5px solid #2563eb !important;
                                -webkit-print-color-adjust: exact !important;
                                print-color-adjust: exact !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div style="margin-bottom: 20px;">
                        ${frontContent.outerHTML}
                    </div>
                    <div style="margin-bottom: 20px;">
                        ${backContent.outerHTML}
                    </div>
                    <script>
                        window.onload = () => {
                            window.print();
                            window.onafterprint = () => window.close();
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
    };

    const fetchHMOs = async () => {
        if (!userToken) return;
        try {
            const config = { headers: { Authorization: `Bearer ${userToken}` } };
            const [hmosRes, depositStatusRes] = await Promise.all([
                axios.get(`${backendUrl}/api/hmos?active=true`, config),
                axios.get(`${backendUrl}/api/hmo-transactions/retainership-deposit-status`, config)
            ]);
            setHmos(hmosRes.data);
            setRetainershipDepositStatus(depositStatusRes.data);
        } catch (error) {
            console.error('Error fetching HMOs:', error);
        }
    };

    const fetchFamilyFiles = async () => {
        if (!userToken) return;
        try {
            const config = { headers: { Authorization: `Bearer ${userToken}` } };
            // Fetching all files to be sure
            const { data } = await axios.get(`${backendUrl}/api/family-files`, config);
            console.log('API Response (Family Files):', data);

            if (Array.isArray(data)) {
                // Filter active ones locally if needed
                const activeFiles = data.filter(f => f.active !== false);
                setFamilyFiles(activeFiles);
            } else {
                console.warn('Family File API did not return an array');
                setFamilyFiles([]);
            }
        } catch (error) {
            console.error('Error fetching family files:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate HMO field for Retainership, NHIA and KSCHMA
        if ((formData.provider === 'Retainership' || formData.provider === 'NHIA' || formData.provider === 'KSCHMA') && !formData.hmo) {
            toast.error('HMO is required for Retainership, NHIA and KSCHMA providers');
            return;
        }

        // Validate that the selected Retainership HMO has made an initial deposit
        if (formData.provider === 'Retainership' && formData.hmo) {
            const depositInfo = retainershipDepositStatus.find(s => s.name === formData.hmo);
            if (depositInfo && !depositInfo.hasDeposit) {
                toast.error(`"${formData.hmo}" has not made an initial deposit. Please record a deposit first before assigning patients.`);
                return;
            }
        }

        // Validate Family File if checked
        if (formData.isFamilyMember && !formData.familyFileId) {
            toast.error('Please select a Family File');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${userToken}` } };

            const dataToSend = { ...formData };
            if (formData.provider === 'Standard') {
                delete dataToSend.hmo;
            }

            const { data: newPatient } = await axios.post(`${backendUrl}/api/patients`, dataToSend, config);
            toast.success('Patient registered successfully!');

            // Reset form
            setFormData({
                name: '',
                age: '',
                dateOfBirth: '',
                gender: 'male',
                contact: '',
                address: '',
                state: '',
                lga: '',
                provider: 'Standard',
                hmo: '',
                insuranceNumber: '',
                emergencyContactName: '',
                emergencyContactPhone: '',
                isFamilyMember: false,
                familyFileId: ''
            });
            setAvailableLgas([]);

            if (onSuccess) onSuccess(newPatient);
            setRegisteredPatient(newPatient);
            // Don't close immediately if we want to show the card
            // onClose(); 
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error registering patient');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0 z-10">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <FaUserPlus /> Register New Patient
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-white hover:text-gray-200"
                        type="button"
                    >
                        <FaTimes size={24} />
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-6">
                    {registeredPatient ? (
                        <div className="flex flex-col items-center justify-center space-y-10 pt-16 pb-16 px-6">
                            <div className="text-center">
                                <FaCheckCircle className="text-green-500 text-6xl mx-auto mb-4" />
                                <h4 className="text-2xl font-bold text-gray-800">Registration Successful!</h4>
                                <p className="text-gray-600 mt-2">Patient: <span className="font-semibold text-blue-600">{registeredPatient.name}</span></p>
                                <p className="text-gray-600">MRN: <span className="font-semibold">{registeredPatient.mrn}</span></p>
                            </div>

                            <div className="flex flex-col gap-6 items-center w-full max-w-lg">
                                <div className="w-full flex flex-col items-center">
                                    <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-3 py-1 bg-gray-200 rounded-full">Front View</p>
                                    <div className="bg-white p-2 rounded-xl shadow-lg transform hover:scale-[1.02] transition-transform duration-300">
                                        <PatientIDCard patient={registeredPatient} settings={hospitalSettings} side="front" />
                                    </div>
                                </div>
                                <div className="w-full flex flex-col items-center">
                                    <p className="text-center text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-3 py-1 bg-gray-200 rounded-full">Back View</p>
                                    <div className="bg-white p-2 rounded-xl shadow-lg transform hover:scale-[1.02] transition-transform duration-300">
                                        <PatientIDCard patient={registeredPatient} settings={hospitalSettings} side="back" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={handlePrintCard}
                                    className="flex-1 bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <FaIdCard /> Print ID Card
                                </button>
                                <button
                                    onClick={onClose}
                                    className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg"
                                >
                                    Finish & Close
                                </button>
                            </div>

                            <p className="text-xs text-gray-500 italic">
                                Note: You can also print the card later from the Patient Management page.
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* ... existing form content ... */}
                            {/* Family File Section */}
                            <div className="bg-blue-50 p-4 rounded border border-blue-100">
                                <div className="flex items-center gap-2 mb-3">
                                    <input
                                        type="checkbox"
                                        name="isFamilyMember"
                                        id="isFamilyMemberModal"
                                        checked={formData.isFamilyMember}
                                        onChange={handleChange}
                                        className="w-5 h-5 text-blue-600"
                                    />
                                    <label htmlFor="isFamilyMemberModal" className="font-bold text-blue-800 cursor-pointer flex items-center gap-2">
                                        <FaUserFriends /> Belong to Family File?
                                    </label>
                                </div>

                                {formData.isFamilyMember && (
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-2 items-end">
                                        <div className="md:col-span-3">
                                            <label className="block text-sm font-semibold text-blue-700 mb-1">Select Family File *</label>
                                            <select
                                                name="familyFileId"
                                                required={formData.isFamilyMember}
                                                value={formData.familyFileId}
                                                onChange={handleChange}
                                                className="w-full border p-2 rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="">-- Choose Family --</option>
                                                {familyFiles.length === 0 ? (
                                                    <option disabled>No families found</option>
                                                ) : (
                                                    familyFiles.map(file => (
                                                        <option key={file._id} value={file._id} disabled={file.type === 'Family of 5' && file.memberCount >= 5}>
                                                            {file.familyName} ({file.fileNumber}) - {file.memberCount}/{file.type === 'Family of 5' ? '5' : '∞'}
                                                        </option>
                                                    ))
                                                )}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={fetchFamilyFiles}
                                            className="bg-blue-600 text-white p-2 rounded hover:bg-blue-700 text-sm h-[42px] flex items-center justify-center"
                                            title="Refresh List"
                                        >
                                            ↻ Refresh
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Name */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold mb-1">
                                        Full Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded"
                                        required
                                    />
                                </div>

                                {/* Age */}
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-semibold mb-1">
                                        Age <span className="text-red-500">*</span>
                                        {formData.age && (
                                            <span className="ml-2 text-xs text-blue-600 italic">
                                                {formatAge(formData.age)}
                                            </span>
                                        )}
                                    </label>
                                    <input
                                        type="number"
                                        name="age"
                                        value={formData.age}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500"
                                        required
                                        min="0"
                                        step="0.01"
                                    />
                                </div>

                                {/* Date of Birth */}
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-semibold mb-1">
                                        Date of Birth
                                    </label>
                                    <input
                                        type="date"
                                        name="dateOfBirth"
                                        value={formData.dateOfBirth}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500"
                                        max={new Date().toISOString().split('T')[0]}
                                    />
                                </div>

                                {/* Gender */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold mb-1">
                                        Gender <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="gender"
                                        value={formData.gender}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded"
                                    >
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>

                                {/* Contact */}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold mb-1">
                                        Contact Number <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="tel"
                                        name="contact"
                                        value={formData.contact}
                                        onChange={(e) => {
                                            const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                            setFormData(prev => ({ ...prev, contact: val }));
                                        }}
                                        className="w-full border p-2 rounded"
                                        placeholder="e.g. 08012345678"
                                        maxLength={11}
                                        pattern="[0-9]{11}"
                                        title="Phone number must be exactly 11 digits"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Address */}
                            <div>
                                <label className="block text-sm font-semibold mb-1">Address <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="w-full border p-2 rounded"
                                    required
                                />
                            </div>

                            {/* State and LGA */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1">State</label>
                                    <select
                                        name="state"
                                        value={formData.state}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded"
                                    >
                                        <option value="">Select State</option>
                                        {nigeriaData.map((item) => (
                                            <option key={item.state} value={item.state}>{item.state}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1">LGA</label>
                                    <select
                                        name="lga"
                                        value={formData.lga}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded"
                                        disabled={!formData.state}
                                    >
                                        <option value="">Select LGA</option>
                                        {availableLgas.map((lga) => (
                                            <option key={lga} value={lga}>{lga}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Provider & Insurance Section */}
                            <div className="border-t pt-4">
                                <h4 className="font-semibold text-gray-700 mb-3 border-b pb-1">Provider Information</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Provider */}
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Provider <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            name="provider"
                                            value={formData.provider}
                                            onChange={handleChange}
                                            className="w-full border p-2 rounded"
                                        >
                                            <option value="Standard">Standard</option>
                                            <option value="Retainership">Retainership</option>
                                            <option value="NHIA">NHIA</option>
                                            <option value="KSCHMA">KSCHMA</option>
                                        </select>
                                    </div>

                                    {/* HMO - Shown for Retainership, NHIA and KSCHMA */}
                                    {(formData.provider === 'Retainership' || formData.provider === 'NHIA' || formData.provider === 'KSCHMA') && (
                                        <div>
                                            <label className="block text-sm font-semibold mb-1">
                                                HMO <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                name="hmo"
                                                value={formData.hmo}
                                                onChange={handleChange}
                                                className="w-full border p-2 rounded"
                                                required={formData.provider === 'Retainership' || formData.provider === 'NHIA' || formData.provider === 'KSCHMA'}
                                            >
                                                <option value="">Select HMO *</option>
                                                {hmos
                                                    .filter(hmo => {
                                                        // Strict filtering based on category for NHIA and Retainership
                                                        if (formData.provider === 'NHIA' || formData.provider === 'Retainership') {
                                                            return hmo.category === formData.provider;
                                                        }
                                                        // For KSCHMA, show only KSCHMA HMO
                                                        if (formData.provider === 'KSCHMA') {
                                                            return hmo.name.toUpperCase() === 'KSCHMA';
                                                        }
                                                        return true;
                                                    })
                                                    .map(hmo => {
                                                        // For Retainership, check if deposit has been made
                                                        const depositInfo = formData.provider === 'Retainership'
                                                            ? retainershipDepositStatus.find(s => s.name === hmo.name)
                                                            : null;
                                                        const noDeposit = depositInfo && !depositInfo.hasDeposit;
                                                        return (
                                                            <option
                                                                key={hmo._id}
                                                                value={hmo.name}
                                                                disabled={noDeposit}
                                                                style={noDeposit ? { color: '#9ca3af' } : {}}
                                                            >
                                                                {hmo.name}{noDeposit ? ' — No deposit yet' : ''}
                                                            </option>
                                                        );
                                                    })}
                                            </select>
                                        </div>
                                    )}

                                    {/* Insurance Number - Visible & Required only for NHIA and KSCHMA */}
                                    {(formData.provider === 'NHIA' || formData.provider === 'KSCHMA') && (
                                        <div>
                                            <label className="block text-sm font-semibold mb-1">
                                                Insurance Number <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="insuranceNumber"
                                                value={formData.insuranceNumber}
                                                onChange={handleChange}
                                                className="w-full border p-2 rounded"
                                                required
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Emergency Contact Section */}
                            <div className="border-t pt-4">
                                <h4 className="font-semibold text-gray-700 mb-3 border-b pb-1">Emergency Contact</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Emergency Contact Name */}
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Emergency Contact Name
                                        </label>
                                        <input
                                            type="text"
                                            name="emergencyContactName"
                                            value={formData.emergencyContactName}
                                            onChange={handleChange}
                                            className="w-full border p-2 rounded"
                                        />
                                    </div>

                                    {/* Emergency Contact Phone */}
                                    <div>
                                        <label className="block text-sm font-semibold mb-1">
                                            Emergency Contact Phone
                                        </label>
                                        <input
                                            type="tel"
                                            name="emergencyContactPhone"
                                            value={formData.emergencyContactPhone}
                                            onChange={(e) => {
                                                const val = e.target.value.replace(/\D/g, '').slice(0, 11);
                                                setFormData(prev => ({ ...prev, emergencyContactPhone: val }));
                                            }}
                                            className="w-full border p-2 rounded"
                                            placeholder="e.g. 08012345678"
                                            maxLength={11}
                                            pattern="[0-9]{11}"
                                            title="Phone number must be exactly 11 digits"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Form Actions */}
                            <div className="flex gap-3 pt-4 sticky bottom-0 bg-white py-2 z-10 border-t">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2 font-bold shadow"
                                >
                                    <FaUserPlus /> {loading ? 'Registering...' : 'Register Patient'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500 font-bold"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegisterPatientModal;
