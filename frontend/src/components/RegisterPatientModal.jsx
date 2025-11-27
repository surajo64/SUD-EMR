import { useState, useEffect } from 'react';
import axios from 'axios';
import { FaTimes, FaUserPlus } from 'react-icons/fa';
import { toast } from 'react-toastify';

const RegisterPatientModal = ({ isOpen, onClose, onSuccess, userToken }) => {
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        gender: 'male',
        contact: '',
        address: '',
        provider: 'Standard',
        hmo: '',
        insuranceNumber: '',
        emergencyContactName: '',
        emergencyContactPhone: ''
    });
    const [loading, setLoading] = useState(false);
    const [hmos, setHmos] = useState([]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // Fetch active HMOs when component mounts
    useEffect(() => {
        if (userToken) {
            fetchHMOs();
        }
    }, [userToken]);

    const fetchHMOs = async () => {
        if (!userToken) return;

        try {
            const config = { headers: { Authorization: `Bearer ${userToken}` } };
            const { data } = await axios.get('http://localhost:5000/api/hmos?active=true', config);
            setHmos(data);
        } catch (error) {
            console.error('Error fetching HMOs:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate HMO field for Retainership, NHIA and KSCHMA
        if ((formData.provider === 'Retainership' || formData.provider === 'NHIA' || formData.provider === 'KSCHMA') && !formData.hmo) {
            toast.error('HMO is required for Retainership, NHIA and KSCHMA providers');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${userToken}` } };

            // Don't send hmo if provider is Standard only
            const dataToSend = { ...formData };
            if (formData.provider === 'Standard') {
                delete dataToSend.hmo;
            }

            await axios.post('http://localhost:5000/api/patients', dataToSend, config);
            toast.success('Patient registered successfully!');

            // Reset form
            setFormData({
                name: '',
                age: '',
                gender: 'male',
                contact: '',
                address: '',
                provider: 'Standard',
                hmo: '',
                insuranceNumber: '',
                emergencyContactName: '',
                emergencyContactPhone: ''
            });

            if (onSuccess) onSuccess();
            onClose();
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
                <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center sticky top-0">
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
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Name */}
                            <div>
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
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Age <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="age"
                                    value={formData.age}
                                    onChange={handleChange}
                                    className="w-full border p-2 rounded"
                                    required
                                    min="0"
                                />
                            </div>

                            {/* Gender */}
                            <div>
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
                            <div>
                                <label className="block text-sm font-semibold mb-1">
                                    Contact Number <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="contact"
                                    value={formData.contact}
                                    onChange={handleChange}
                                    className="w-full border p-2 rounded"
                                    required
                                />
                            </div>
                        </div>

                        {/* Address */}
                        <div>
                            <label className="block text-sm font-semibold mb-1">Address</label>
                            <input
                                type="text"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                className="w-full border p-2 rounded"
                            />
                        </div>

                        {/* Provider & Insurance Section */}
                        <div className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3">Provider Information</h4>
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
                                                    // For NHIA and Retainership, show all HMOs except KSCHMA
                                                    if (formData.provider === 'NHIA' || formData.provider === 'Retainership') {
                                                        return hmo.name.toUpperCase() !== 'KSCHMA';
                                                    }
                                                    // For KSCHMA, show only KSCHMA HMO
                                                    if (formData.provider === 'KSCHMA') {
                                                        return hmo.name.toUpperCase() === 'KSCHMA';
                                                    }
                                                    return true;
                                                })
                                                .map(hmo => (
                                                    <option key={hmo._id} value={hmo.name}>
                                                        {hmo.name}
                                                    </option>
                                                ))}
                                        </select>
                                    </div>
                                )}

                                {/* Insurance Number */}
                                <div>
                                    <label className="block text-sm font-semibold mb-1">
                                        Insurance Number
                                    </label>
                                    <input
                                        type="text"
                                        name="insuranceNumber"
                                        value={formData.insuranceNumber}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact Section */}
                        <div className="border-t pt-4">
                            <h4 className="font-semibold text-gray-700 mb-3">Emergency Contact</h4>
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
                                        type="text"
                                        name="emergencyContactPhone"
                                        value={formData.emergencyContactPhone}
                                        onChange={handleChange}
                                        className="w-full border p-2 rounded"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex gap-3 pt-4">
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                            >
                                <FaUserPlus /> {loading ? 'Registering...' : 'Register Patient'}
                            </button>
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RegisterPatientModal;
