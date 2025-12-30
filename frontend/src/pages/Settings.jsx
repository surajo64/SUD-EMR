import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';
import { FaCogs, FaHospital, FaSave, FaImage, FaUndo, FaHashtag, FaEnvelope, FaPhone, FaMapMarkerAlt, FaGlobe } from 'react-icons/fa';
import { toast } from 'react-toastify';

const Settings = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [settings, setSettings] = useState({
        hospitalName: '',
        hospitalLogo: '',
        address: '',
        phone: '',
        email: '',
        website: '',
        systemVersion: '',
        reportHeader: '',
        reportFooter: '',
        currencySymbol: '₦'
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get('http://localhost:5000/api/settings');
            setSettings(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching settings');
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({ ...prev, [name]: value }));
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSettings(prev => ({ ...prev, hospitalLogo: reader.result }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put('http://localhost:5000/api/settings', settings, config);
            toast.success('Settings updated successfully!');
            // Optional: trigger a global state update or refresh if needed
        } catch (error) {
            console.error(error);
            toast.error('Error updating settings');
        } finally {
            setLoading(false);
        }
    };

    if (user?.role !== 'admin') {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access system settings.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-gray-800 to-gray-700 text-white p-6 rounded-lg shadow-lg">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <FaCogs /> System Settings
                    </h1>
                    <p className="text-gray-300">Global configurations for hospital details, branding, and system properties.</p>
                </div>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Basic Info */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-blue-600">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2">
                                <FaHospital className="text-blue-600" /> Hospital Identity
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Hospital Name</label>
                                    <input
                                        type="text"
                                        name="hospitalName"
                                        value={settings.hospitalName}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 font-bold text-lg"
                                        placeholder="Enter Hospital Name"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Phone Number</label>
                                    <div className="relative">
                                        <FaPhone className="absolute left-3 top-3 text-gray-400" />
                                        <input
                                            type="text"
                                            name="phone"
                                            value={settings.phone}
                                            onChange={handleInputChange}
                                            className="w-full border p-2 pl-9 rounded focus:ring-2 focus:ring-blue-500"
                                            placeholder="Contact Phone"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Email Address</label>
                                    <div className="relative">
                                        <FaEnvelope className="absolute left-3 top-3 text-gray-400" />
                                        <input
                                            type="email"
                                            name="email"
                                            value={settings.email}
                                            onChange={handleInputChange}
                                            className="w-full border p-2 pl-9 rounded focus:ring-2 focus:ring-blue-500"
                                            placeholder="hospital@example.com"
                                        />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Physical Address</label>
                                    <div className="relative">
                                        <FaMapMarkerAlt className="absolute left-3 top-3 text-gray-400" />
                                        <textarea
                                            name="address"
                                            value={settings.address}
                                            onChange={handleInputChange}
                                            className="w-full border p-2 pl-9 rounded focus:ring-2 focus:ring-blue-500"
                                            placeholder="Street, City, State, Country"
                                            rows="2"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Website URL</label>
                                    <div className="relative">
                                        <FaGlobe className="absolute left-3 top-3 text-gray-400" />
                                        <input
                                            type="text"
                                            name="website"
                                            value={settings.website}
                                            onChange={handleInputChange}
                                            className="w-full border p-2 pl-9 rounded focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://www.hospital.com"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Currency Symbol</label>
                                    <input
                                        type="text"
                                        name="currencySymbol"
                                        value={settings.currencySymbol}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500"
                                        placeholder="e.g. ₦, $, £"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-indigo-600">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2">
                                <FaSave className="text-indigo-600" /> Print & Report Branding
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Standard Report Header Text</label>
                                    <textarea
                                        name="reportHeader"
                                        value={settings.reportHeader}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="This text will appear at the top of printable referals and reports."
                                        rows="3"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold mb-1 text-gray-700">Standard Report Footer Text</label>
                                    <textarea
                                        name="reportFooter"
                                        value={settings.reportFooter}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded focus:ring-2 focus:ring-indigo-500"
                                        placeholder="Copyright info or contact tagline for the bottom of reports."
                                        rows="2"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Branding & Sidebar */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-green-600">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2">
                                <FaImage className="text-green-600" /> Branding
                            </h2>
                            <div className="space-y-4 text-center">
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center">
                                    {settings.hospitalLogo ? (
                                        <img src={settings.hospitalLogo} alt="Logo Preview" className="max-h-32 object-contain mb-4" />
                                    ) : (
                                        <div className="h-32 w-32 bg-gray-100 flex items-center justify-center text-gray-400 rounded-lg mb-4">
                                            No Logo
                                        </div>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                        className="hidden"
                                        id="logo-upload"
                                    />
                                    <label
                                        htmlFor="logo-upload"
                                        className="bg-green-600 text-white px-4 py-2 rounded cursor-pointer hover:bg-green-700 transition font-semibold"
                                    >
                                        Upload New Logo
                                    </label>
                                    <p className="text-xs text-gray-500 mt-2">Recommended: PNG with transparent background</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow border-t-4 border-orange-600">
                            <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b pb-2">
                                <FaHashtag className="text-orange-600" /> System Info
                            </h2>
                            <div>
                                <label className="block text-sm font-semibold mb-1 text-gray-700">System Version</label>
                                <input
                                    type="text"
                                    name="systemVersion"
                                    value={settings.systemVersion}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded bg-gray-50 font-mono"
                                    placeholder="1.0.0"
                                />
                            </div>
                            <div className="mt-6 flex flex-col gap-2">
                                <button
                                    type="submit"
                                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold hover:bg-blue-700 transition shadow flex items-center justify-center gap-2"
                                >
                                    <FaSave /> Save Changes
                                </button>
                                <button
                                    type="button"
                                    onClick={fetchSettings}
                                    className="w-full bg-gray-200 text-gray-700 py-3 rounded-lg font-bold hover:bg-gray-300 transition flex items-center justify-center gap-2"
                                >
                                    <FaUndo /> Reset To Last Saved
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </Layout>
    );
};

export default Settings;
