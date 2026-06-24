import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaUserFriends, FaPlus, FaEdit, FaTrash, FaSearch, FaEye, FaIdCard, FaDownload } from 'react-icons/fa';
import EntityIDCard from '../components/EntityIDCard';
import useHospitalSettings from '../hooks/useHospitalSettings';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

const FamilyFileManagement = () => {
    const [loading, setLoading] = useState(false);
    const [familyFiles, setFamilyFiles] = useState([]);
    const [filteredFiles, setFilteredFiles] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [familyCharges, setFamilyCharges] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewFamilyPatients, setViewFamilyPatients] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [currentFile, setCurrentFile] = useState({
        familyName: '',
        fileNumber: '',
        type: 'Family of 5',
        registrationCharge: 0,
        familyCharge: '',
        description: ''
    });

    // Card Modal State
    const [showCardModal, setShowCardModal] = useState(false);
    const [cardEntity, setCardEntity] = useState(null);
    const { settings: hospitalSettings } = useHospitalSettings();
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    useEffect(() => {
        if (user && (user.role === 'admin' || user.role === 'super_admin' || user.role === 'receptionist' || user.role === 'readonly_admin')) {
            fetchFamilyFiles();
            fetchFamilyCharges();
        }
    }, [user]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = familyFiles.filter(file =>
                file.familyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                file.fileNumber.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredFiles(filtered);
        } else {
            setFilteredFiles(familyFiles);
        }
    }, [searchTerm, familyFiles]);

    // Remove the automatic charge update useEffect as it's now dynamic
    /*
    useEffect(() => {
        if (!editMode) {
            const charge = currentFile.type === 'Family of 5' ? 7000 : 10000;
            setCurrentFile(prev => ({ ...prev, registrationCharge: charge }));
        }
    }, [currentFile.type, editMode]);
    */

    const handlePrintCard = () => {
        const frontContent = document.getElementById(`entity-card-front-${cardEntity._id}`);
        const backContent = document.getElementById(`entity-card-back-${cardEntity._id}`);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Family File Card - ${cardEntity.familyName}</title>
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
                            div[id^="entity-card"] { 
                                margin-bottom: 20px !important; 
                                box-shadow: none !important; 
                                break-inside: avoid;
                                border: none !important;
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

    const fetchFamilyCharges = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/charges`, config);
            const filtered = data.filter(c => c.type === 'family' && c.active);
            setFamilyCharges(filtered);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching family charges');
        }
    };

    const fetchFamilyFiles = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/family-files`, config);
            setFamilyFiles(data);
            setFilteredFiles(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching family files');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenViewModal = async (file) => {
        if (!file || !file._id) {
            toast.error('Invalid family file selected');
            return;
        }
        setCurrentFile(file);
        setShowViewModal(true);
        setViewFamilyPatients([]); // Clear previous data
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/patients?familyFile=${file._id}`, config);
            console.log(`Fetched ${data.length} patients for family: ${file._id}`);
            setViewFamilyPatients(data);
        } catch (error) {
            console.error('Error fetching family patients:', error);
            toast.error('Error fetching family patients');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = async (file = null) => {
        if (file) {
            setEditMode(true);
            setCurrentFile(file);
        } else {
            setEditMode(false);
            try {
                setLoading(true);
                const config = { headers: { Authorization: `Bearer ${user.token}` } };
                const { data } = await axios.get(`${backendUrl}/api/family-files/next-number`, config);
                setCurrentFile({
                    familyName: '',
                    fileNumber: data.nextNumber,
                    type: 'Family of 5',
                    registrationCharge: 0,
                    familyCharge: '',
                    description: ''
                });
            } catch (error) {
                console.error('Error fetching next file number:', error);
                setCurrentFile({
                    familyName: '',
                    fileNumber: 'AUTO-GENERATED',
                    type: 'Family of 5',
                    registrationCharge: 0,
                    familyCharge: '',
                    description: ''
                });
            } finally {
                setLoading(false);
            }
        }
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditMode(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentFile.familyCharge) {
            toast.error('Please select a registration charge');
            return;
        }
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            const payload = { ...currentFile };
            // If in create mode, the backend will regenerate to ensure atomicity, 
            // but we send the current one as a placeholder or remove it to let backend handle it
            if (!editMode) {
                delete payload.fileNumber;
            }

            if (editMode) {
                await axios.put(`${backendUrl}/api/family-files/${currentFile._id}`, payload, config);
                toast.success('Family File updated successfully');
            } else {
                await axios.post(`${backendUrl}/api/family-files`, payload, config);
                toast.success('Family File created successfully');
            }

            handleCloseModal();
            fetchFamilyFiles();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving family file');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this Family File?')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`${backendUrl}/api/family-files/${id}`, config);
            toast.success('Family File deleted successfully');
            fetchFamilyFiles();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error deleting family file');
        } finally {
            setLoading(false);
        }
    };

    if (!user || (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'receptionist' && user.role !== 'readonly_admin')) {
        return (
            <Layout>
                <div className="bg-red-50 border border-red-200 p-6 rounded">
                    <h2 className="text-xl font-bold text-red-800">Access Denied</h2>
                    <p className="text-red-600">You do not have permission to access Family File management.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-600 to-teal-600 text-white p-6 rounded-lg shadow-lg">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                        <FaUserFriends /> Family File Management
                    </h1>
                    <p className="text-green-100">Create and manage family files for patient registration</p>
                </div>

                {/* Actions Bar */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <div className="flex flex-wrap gap-4 items-center justify-between">
                        <div className="flex-1 min-w-[300px]">
                            <div className="relative">
                                <FaSearch className="absolute left-3 top-3 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search by Family Name or File Number..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        {user.role !== 'readonly_admin' && (
                            <button
                                onClick={() => handleOpenModal()}
                                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <FaPlus /> Create Family File
                            </button>
                        )}
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Family Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File Number</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Members</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reg. Charge</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredFiles.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="px-6 py-4 text-center text-gray-500">No family files found</td>
                                    </tr>
                                ) : (
                                    filteredFiles.map((file) => (
                                        <tr key={file._id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900">{file.familyName}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{file.fileNumber}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${file.type === 'Family of 5' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                                    {file.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {file.memberCount} / {file.type === 'Family of 5' ? '5' : '∞'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                                                <div>₦{file.registrationCharge.toLocaleString()}</div>
                                                <div className="text-[10px] text-gray-500 truncate max-w-[120px]">{file.familyCharge?.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${file.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {file.paymentStatus === 'paid' ? 'Paid' : 'Pending'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleOpenViewModal(file)}
                                                        className="text-indigo-600 hover:text-indigo-900 border border-indigo-200 p-1.5 rounded bg-indigo-50"
                                                        title="View Details"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setCardEntity(file);
                                                            setShowCardModal(true);
                                                        }}
                                                        className="text-orange-600 hover:text-orange-900 border border-orange-200 p-1.5 rounded bg-orange-50"
                                                        title="Print Card"
                                                    >
                                                        <FaIdCard />
                                                    </button>
                                                    {user.role !== 'readonly_admin' && (
                                                        <>
                                                            <button
                                                                onClick={() => handleOpenModal(file)}
                                                                className="text-blue-600 hover:text-blue-900 border border-blue-200 p-1.5 rounded bg-blue-50"
                                                                title="Edit"
                                                            >
                                                                <FaEdit />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDelete(file._id)}
                                                                className="text-red-600 hover:text-red-900 border border-red-200 p-1.5 rounded bg-red-50"
                                                                title="Delete"
                                                            >
                                                                <FaTrash />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
                        <div className="bg-green-600 text-white p-4 rounded-t-lg flex justify-between items-center">
                            <h3 className="text-xl font-bold">{editMode ? 'Edit Family File' : 'New Family File'}</h3>
                            <button onClick={handleCloseModal} className="text-white text-2xl">×</button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold mb-1">Family Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500"
                                    value={currentFile.familyName}
                                    onChange={(e) => setCurrentFile({ ...currentFile, familyName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">File Number (Auto-generated)</label>
                                <input
                                    type="text"
                                    disabled
                                    className="w-full border p-2 rounded bg-gray-100 font-mono text-blue-700 font-bold"
                                    value={currentFile.fileNumber}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-2">Family Type *</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="type"
                                            value="Family of 5"
                                            checked={currentFile.type === 'Family of 5'}
                                            onChange={(e) => setCurrentFile({ ...currentFile, type: e.target.value })}
                                        />
                                        Family of 5
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            name="type"
                                            value="Family Above 5"
                                            checked={currentFile.type === 'Family Above 5'}
                                            onChange={(e) => setCurrentFile({ ...currentFile, type: e.target.value })}
                                        />
                                        Above 5
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Registration Charge Plan *</label>
                                <select
                                    required
                                    className="w-full border p-2 rounded focus:ring-2 focus:ring-green-500"
                                    value={currentFile.familyCharge?._id || currentFile.familyCharge || ''}
                                    onChange={(e) => {
                                        const selectedCharge = familyCharges.find(c => c._id === e.target.value);
                                        if (selectedCharge) {
                                            setCurrentFile({
                                                ...currentFile,
                                                familyCharge: selectedCharge._id,
                                                registrationCharge: selectedCharge.standardFee || selectedCharge.basePrice
                                            });
                                        } else {
                                            setCurrentFile({ ...currentFile, familyCharge: '', registrationCharge: 0 });
                                        }
                                    }}
                                >
                                    <option value="">-- Select a Plan --</option>
                                    {familyCharges.map(charge => (
                                        <option key={charge._id} value={charge._id}>
                                            {charge.name} (₦{(charge.standardFee || charge.basePrice).toLocaleString()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold mb-1">Description</label>
                                <textarea
                                    className="w-full border p-2 rounded"
                                    rows="3"
                                    value={currentFile.description}
                                    onChange={(e) => setCurrentFile({ ...currentFile, description: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 font-bold">
                                    {editMode ? 'Update' : 'Create'}
                                </button>
                                <button type="button" onClick={handleCloseModal} className="flex-1 bg-gray-400 text-white py-2 rounded hover:bg-gray-500 font-bold">
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* View Details Modal */}
            {showViewModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                        <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold">Family Details</h3>
                                <p className="text-indigo-100 text-sm">{currentFile.familyName} | {currentFile.fileNumber}</p>
                            </div>
                            <button onClick={() => setShowViewModal(false)} className="text-white text-2xl hover:bg-indigo-700 px-2 rounded">×</button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {/* Family Info Summary */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Plan Type</p>
                                    <p className="font-semibold text-gray-800">{currentFile.type}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Current Members</p>
                                    <p className="font-semibold text-gray-800">{currentFile.memberCount} / {currentFile.type === 'Family of 5' ? '5' : '∞'}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold">Reg. Charge</p>
                                    <p className="font-semibold text-green-600">₦{currentFile.registrationCharge.toLocaleString()}</p>
                                </div>
                            </div>

                            <h4 className="font-bold text-gray-700 mb-3 border-b pb-2 flex items-center gap-2">
                                <FaUserFriends className="text-indigo-600" /> Attached Patients
                            </h4>

                            {loading ? (
                                <div className="py-10 text-center text-gray-500 italic">Loading patient list...</div>
                            ) : viewFamilyPatients.length === 0 ? (
                                <div className="py-10 text-center text-gray-500 bg-gray-50 rounded italic">
                                    No patients are currently linked to this family file.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {viewFamilyPatients.map((patient, index) => (
                                        <div key={patient._id} className="flex items-center justify-between p-3 border rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer" onClick={() => window.location.href = `/patient/${patient._id}`}>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-sm">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800">{patient.name}</p>
                                                    <p className="text-xs text-indigo-600 font-semibold">{patient.mrn}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-gray-500">Registered on</p>
                                                <p className="text-sm font-medium">{new Date(patient.createdAt).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-gray-50 p-4 border-t flex justify-end">
                            <button
                                onClick={() => setShowViewModal(false)}
                                className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ID Card Modal */}
            {showCardModal && cardEntity && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg p-6 w-full max-w-xl shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                <FaIdCard className="text-orange-600" /> Family File Card Preview
                            </h3>
                            <button
                                onClick={() => {
                                    setShowCardModal(false);
                                    setCardEntity(null);
                                }}
                                className="text-gray-500 hover:text-gray-700 text-3xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="p-4 bg-gray-100 rounded-xl mb-6 flex flex-col items-center gap-4 overflow-y-auto max-h-[60vh]">
                            <EntityIDCard entity={cardEntity} settings={hospitalSettings} side="front" />
                            <EntityIDCard entity={cardEntity} settings={hospitalSettings} side="back" />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={handlePrintCard}
                                className="flex-1 bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-bold flex items-center justify-center gap-2"
                            >
                                <FaDownload /> Print Card
                            </button>
                            <button
                                onClick={() => {
                                    setShowCardModal(false);
                                    setCardEntity(null);
                                }}
                                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg hover:bg-gray-300 font-bold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default FamilyFileManagement;
