import { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { FaXRay, FaSearch, FaCheckCircle, FaUpload, FaSave, FaImage, FaEdit, FaTimes, FaTrash, FaChevronUp, FaChevronDown, FaFileAlt, FaClock, FaMicroscope } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { formatCompactNumber } from '../utils/formatters';

import LoadingOverlay from '../components/loadingOverlay';

const RadiologyDashboard = () => {
    const [loading, setLoading] = useState(false);
    const [radiologyOrders, setRadiologyOrders] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [receiptNumber, setReceiptNumber] = useState('');
    const [receiptValidated, setReceiptValidated] = useState(false);
    const [notes, setNotes] = useState('');
    const [imageUrl, setImageUrl] = useState(''); // Keep for backward compatibility
    const [uploadedImages, setUploadedImages] = useState([]); // New: Array of {file, name, preview}
    const [systemSettings, setSystemSettings] = useState(null);
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    const [viewResultModal, setViewResultModal] = useState(null);
    const [editResultModal, setEditResultModal] = useState(null);
    const [editNotes, setEditNotes] = useState('');
    const [editImageUrl, setEditImageUrl] = useState('');
    const [expandedEncounter, setExpandedEncounter] = useState(null);
    const resultRef = useRef();

    const [userStats, setUserStats] = useState({ scansToday: 0 });

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
        fetchRadiologyOrders();
    }, []);

    const fetchRadiologyOrders = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/radiology`, config);
            setRadiologyOrders(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching radiology orders');
        } finally {
            setLoading(false);
        }
    };

    const searchPatients = () => {
        if (!searchTerm) {
            fetchRadiologyOrders();
            return;
        }
        // Grouping logic handles filtering now
    };

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setReceiptValidated(false);
        setReceiptNumber('');
        // Check for report in 'report' field (from backend) or 'notes' (legacy/frontend state)
        setNotes(order.report || order.notes || '');
        setImageUrl(order.resultImage || '');
        // Load existing images if any
        setUploadedImages(order.images || []);
    };

    const handleValidateReceipt = async () => {
        if (!receiptNumber.trim()) {
            toast.error('Please enter receipt number');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const response = await axios.post(
                `${backendUrl}/api/receipts/validate`,
                { receiptNumber: receiptNumber.trim(), department: 'Radiology' },
                config
            );

            if (response.data.valid) {
                setReceiptValidated(true);
                toast.success('Receipt validated! You can now perform the imaging.');
            }
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Invalid receipt number');
            setReceiptValidated(false);
        }
    };

    const handleSaveReport = async () => {
        if (!notes.trim()) {
            toast.error('Please enter radiology notes/findings');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/radiology/${selectedOrder._id}/report`,
                {
                    status: 'completed',
                    report: notes,
                    resultImage: imageUrl,
                    signedBy: user._id,
                    reportDate: new Date()
                },
                config
            );

            toast.success('Radiology report saved and signed!');
            setSelectedOrder(null);
            setReceiptValidated(false);
            setReceiptNumber('');
            setNotes('');
            setImageUrl('');
            fetchRadiologyOrders();
        } catch (error) {
            console.error(error);
            toast.error('Error saving report');
        } finally {
            setLoading(false);
        }
    };

    const handleEditReport = async () => {
        if (!editNotes.trim()) {
            toast.error('Please enter radiology notes/findings');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/radiology/${editResultModal._id}/report`,
                {
                    status: 'completed',
                    report: editNotes,
                    resultImage: editImageUrl,
                    signedBy: user._id,
                    reportDate: new Date()
                },
                config
            );

            toast.success('Radiology report updated and re-signed!');
            setEditResultModal(null);
            setEditNotes('');
            setEditImageUrl('');
            fetchRadiologyOrders();
        } catch (error) {
            console.error(error);
            toast.error('Error updating report');
        } finally {
            setLoading(false);
        }
    };

    const handleUniversalPrint = (order) => {
        const printWindow = window.open("", "_blank");

        const printContent = `
            <html>
                <head>
                    <title>Radiology Report - ${order.scanType}</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
                        .header h1 { font-size: 28px; margin: 0; }
                        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; font-size: 14px; }
                        .info-grid p { margin: 5px 0; }
                        .results-section { border-top: 1px solid #333; border-bottom: 1px solid #333; padding: 20px 0; margin-bottom: 30px; }
                        .results-section h3 { font-size: 18px; margin-bottom: 15px; }
                        .results-content { background: #f9f9f9; padding: 15px; white-space: pre-wrap; font-family: monospace; font-size: 13px; }
                        .signature-section { margin-top: 40px; padding-top: 20px; border-top: 1px solid #333; }
                        .signature-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
                        .signature-grid p { margin: 5px 0; font-size: 13px; }
                        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; }
                        @media print {
                            body { padding: 0; }
                            .results-content { background: none; }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                        <h1 style="margin: 0 0 5px 0;">${systemSettings?.reportHeader || 'RADIOLOGY REPORT'}</h1>
                        <p style="margin: 5px 0; font-size: 14px;">${systemSettings?.address || ''}</p>
                        <p style="margin: 2px 0; font-size: 12px;">
                            ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                            ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                            ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                        </p>
                        <h2 style="font-size: 20px; border-top: 1px solid #eee; pt-2; mt-2;">Radiology Report</h2>
                    </div>
                    
                    <div class="info-grid">
                        <div>
                            <p><strong>Patient Name:</strong> ${order.patient?.name || 'N/A'}</p>
                            <p><strong>MRN:</strong> ${order.patient?.mrn || 'N/A'}</p>
                            <p><strong>Age:</strong> ${order.patient?.age || 'N/A'}</p>
                        </div>
                        <div>
                            <p><strong>Imaging Type:</strong> ${order.scanType}</p>
                            <p><strong>Date Ordered:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                            <p><strong>Gender:</strong> ${order.patient?.gender || 'N/A'}</p>
                        </div>
                    </div>

                    <div class="results-section">
                        <h3>Findings & Impression:</h3>
                        <div class="results-content">${order.report || order.notes || 'No report available'}</div>
                        
                        ${order.images && order.images.length > 0 ? `
                            <div style="margin-top: 30px;">
                                <h4 style="font-weight: bold; margin-bottom: 15px;">Attached Images:</h4>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                                    ${order.images.map(img => `
                                        <div style="border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
                                            <p style="font-weight: bold; color: #2563eb; margin-bottom: 8px;">${img.name}</p>
                                            <img src="${backendUrl}/${img.path}" alt="${img.name}" style="width: 100%; max-height: 300px; object-fit: contain; background: #f3f4f6; border-radius: 4px;" />
                                            <p style="font-size: 11px; color: #666; margin-top: 5px;">Uploaded: ${new Date(img.uploadedAt).toLocaleString()}</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        ` : ''}
                        
                        ${order.resultImage ? `<div style="margin-top: 20px;"><p><strong>Image Reference:</strong> ${order.resultImage}</p></div>` : ''}
                    </div>
                    
                    <div class="signature-section">
                        <div class="signature-grid">
                            <div>
                                ${order.signedBy ? `
                                    <p><strong>Radiologist:</strong> ${order.signedBy.name}</p>
                                    <p><strong>Date:</strong> ${new Date(order.reportDate || order.updatedAt).toLocaleString()}</p>
                                ` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="footer">
                        <p>This is an electronically signed document. No handwritten signature is required.</p>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
    };

    const pendingOrders = radiologyOrders.filter(o => o.status === 'pending');

    // Group orders for display
    const groupedEncounters = Object.values(
        radiologyOrders
            .filter(order => {
                if (!searchTerm) return true;
                const s = searchTerm.toLowerCase();
                return (
                    (order.patient?.name?.toLowerCase() || '').includes(s) ||
                    (String(order.patient?.mrn || '').toLowerCase()).includes(s) ||
                    (order.patient?.contact?.toLowerCase() || '').includes(s) ||
                    (order.scanType?.toLowerCase() || '').includes(s)
                );
            })
            .reduce((acc, order) => {
                const visitId = order.visit?._id || 'external-' + (order.patient?._id || 'unknown');
                if (!acc[visitId]) {
                    acc[visitId] = {
                        id: visitId,
                        patient: order.patient,
                        visit: order.visit,
                        orders: []
                    };
                }
                acc[visitId].orders.push(order);
                return acc;
            }, {})
    ).sort((a, b) => {
        const getLatest = (group) => {
            const orderDates = group.orders.map(o => new Date(o.createdAt).getTime());
            const visitDate = group.visit?.createdAt ? new Date(group.visit.createdAt).getTime() : 0;
            return Math.max(...orderDates, visitDate);
        };
        return getLatest(b) - getLatest(a);
    });

    const completedOrders = radiologyOrders.filter(o => o.status === 'completed');

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FaXRay className="text-indigo-600" /> Radiology Dashboard
            </h2>

            {/* Search */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Search Radiology Orders
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search by Patient Name, MRN or Phone..."
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
            </div>

            {/* Imaging Encounters & Orders */}
            {!selectedOrder && (
                <div className="bg-white rounded shadow p-6 mb-6">
                    <h3 className="text-xl font-bold mb-6 text-gray-800 border-b pb-4">
                        Patient Encounters & Imaging Orders
                    </h3>
                    {groupedEncounters.length === 0 ? (
                        <div className="text-center py-12 bg-gray-50 rounded border-2 border-dashed border-gray-200">
                            <FaXRay className="mx-auto text-gray-300 mb-4" size={48} />
                            <p className="text-gray-500 text-lg">No imaging orders found matching your search</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groupedEncounters.map(group => (
                                <div key={group.id} className="bg-white rounded shadow overflow-hidden border border-indigo-100">
                                    {/* Encounter Header */}
                                    <div
                                        className="p-4 cursor-pointer hover:bg-indigo-50 flex justify-between items-center transition-colors"
                                        onClick={() => setExpandedEncounter(expandedEncounter === group.id ? null : group.id)}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-indigo-100 p-3 rounded-full text-indigo-600">
                                                <FaXRay size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-800 text-lg">
                                                    {group.patient?.name || 'Unknown Patient'}
                                                </h4>
                                                <p className="text-sm text-gray-600">
                                                    {group.patient?.mrn && (
                                                        <>
                                                            MRN: <span className="font-semibold">{group.patient.mrn}</span>
                                                            <span className="mx-2 text-gray-300">|</span>
                                                        </>
                                                    )}
                                                    {group.patient?.contact && (
                                                        <>
                                                            Phone: <span className="font-semibold">{group.patient.contact}</span>
                                                            <span className="mx-2 text-gray-300">|</span>
                                                        </>
                                                    )}
                                                    {group.visit ? (
                                                        <>
                                                            <span className="text-indigo-600 font-medium">{group.visit.type}</span>
                                                            <span className="mx-2 text-gray-300">•</span>
                                                            {new Date(group.visit.createdAt).toLocaleDateString()}
                                                        </>
                                                    ) : (
                                                        <span className="text-blue-600 font-medium italic flex items-center gap-1">
                                                            Radiology Direct / Walk-in
                                                        </span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right mr-4">
                                                <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                                                    {group.orders.length} {group.orders.length === 1 ? 'Study' : 'Studies'}
                                                </span>
                                                <div className="flex flex-col items-end mt-1">
                                                    {group.orders.some(o => o.status === 'pending') && (
                                                        <p className="text-[10px] text-amber-500 uppercase tracking-wider font-bold">
                                                            {group.orders.filter(o => o.status === 'pending').length} Pending
                                                        </p>
                                                    )}
                                                    {group.orders.some(o => o.status === 'completed') && (
                                                        <p className="text-[10px] text-green-500 uppercase tracking-wider font-bold">
                                                            {group.orders.filter(o => o.status === 'completed').length} Completed
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            {expandedEncounter === group.id ? <FaChevronUp className="text-gray-400" /> : <FaChevronDown className="text-gray-400" />}
                                        </div>
                                    </div>

                                    {/* Studies List (Expanded) */}
                                    {expandedEncounter === group.id && (
                                        <div className="bg-gray-50 border-t divide-y">
                                            {group.orders.map(order => (
                                                <div
                                                    key={order._id}
                                                    className={`p-4 flex justify-between items-center ${order.status === 'completed'
                                                        ? 'bg-gray-50 opacity-75'
                                                        : 'bg-white'
                                                        }`}
                                                >
                                                    <div className="flex-1 text-sm">
                                                        <p className="font-bold text-indigo-900 mb-1">{order.scanType}</p>
                                                        <p className="text-xs text-gray-500">Ordered: {new Date(order.createdAt).toLocaleString()}</p>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${order.status === 'completed'
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                            }`}>
                                                            {order.status}
                                                        </span>
                                                        <div className="flex gap-1">
                                                            {order.status === 'completed' ? (
                                                                <>
                                                                    <button
                                                                        onClick={() => setViewResultModal(order)}
                                                                        className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                                                        title="View Study/Report"
                                                                    >
                                                                        <FaFileAlt size={12} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditResultModal(order);
                                                                            setEditNotes(order.report || order.notes || '');
                                                                            setEditImageUrl(order.resultImage || '');
                                                                        }}
                                                                        className="p-1.5 bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors"
                                                                        title="Edit"
                                                                    >
                                                                        <FaEdit size={12} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleSelectOrder(order)}
                                                                    className="p-1.5 bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors"
                                                                    title="Open Study"
                                                                >
                                                                    <FaEdit size={12} />
                                                                </button>
                                                            )}
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
                </div>
            )}

            {/* Selected Order - Receipt Validation & Report */}
            {selectedOrder && (
                <div className="bg-white p-6 rounded shadow">
                    <div className="bg-indigo-50 p-4 rounded mb-6">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="font-bold text-lg">{selectedOrder.scanType}</p>
                                <p className="text-gray-700">Patient: {selectedOrder.patient?.name}</p>
                                <p className="text-sm text-gray-600">MRN: {selectedOrder.patient?.mrn}</p>
                            </div>
                            <button
                                onClick={() => {
                                    setSelectedOrder(null);
                                    setReceiptValidated(false);
                                    setReceiptNumber('');
                                }}
                                className="text-blue-600 hover:underline text-sm"
                            >
                                ← Back to List
                            </button>
                        </div>
                    </div>

                    {/* Payment Status Check */}
                    {selectedOrder.charge?.status !== 'paid' ? (
                        <div className="border-2 border-red-300 bg-red-50 p-6 rounded mb-6">
                            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-800">
                                <FaCheckCircle /> Payment Pending
                            </h3>
                            <p className="text-sm text-gray-700 mb-4">
                                This imaging study has not been paid for yet. Please ask the patient to pay at the cashier.
                            </p>
                            <div className="flex gap-2 items-center">
                                <span className="font-bold text-red-600">Status: Unpaid</span>
                                <button
                                    onClick={fetchRadiologyOrders}
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
                                    <FaCheckCircle /> Payment Verified
                                </p>
                            </div>

                            {/* Image Upload */}
                            <div className="mb-6">
                                <label className="block text-gray-700 mb-2 font-semibold flex items-center gap-2">
                                    <FaImage /> Upload Images
                                </label>

                                {/* File Input */}
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files);
                                        const newImages = files.map(file => ({
                                            file,
                                            name: '',
                                            preview: URL.createObjectURL(file)
                                        }));
                                        setUploadedImages([...uploadedImages, ...newImages]);
                                    }}
                                    className="w-full border p-2 rounded mb-3"
                                />

                                {/* Image Previews with Custom Names */}
                                {uploadedImages.length > 0 && (
                                    <div className="space-y-3 mt-3">
                                        {uploadedImages.map((img, index) => (
                                            <div key={index} className="flex items-center gap-3 p-3 border rounded bg-gray-50">
                                                {/* Preview Thumbnail */}
                                                {img.preview ? (
                                                    <img
                                                        src={img.preview}
                                                        alt={img.name || 'Preview'}
                                                        className="w-16 h-16 object-cover rounded"
                                                    />
                                                ) : img.path ? (
                                                    <img
                                                        src={`${backendUrl}/${img.path}`}
                                                        alt={img.name}
                                                        className="w-16 h-16 object-cover rounded"
                                                    />
                                                ) : null}

                                                {/* Custom Name Input */}
                                                <input
                                                    type="text"
                                                    placeholder={`Image name (e.g., "AP View", "Lateral View")`}
                                                    value={img.name}
                                                    onChange={(e) => {
                                                        const updated = [...uploadedImages];
                                                        updated[index].name = e.target.value;
                                                        setUploadedImages(updated);
                                                    }}
                                                    className="flex-1 border p-2 rounded"
                                                    disabled={!img.file} // Disable for already uploaded images
                                                />

                                                {/* Remove Button */}
                                                <button
                                                    onClick={async () => {
                                                        if (img._id) {
                                                            // Delete from server
                                                            try {
                                                                const config = { headers: { Authorization: `Bearer ${user.token}` } };
                                                                await axios.delete(
                                                                    `${backendUrl}/api/radiology/${selectedOrder._id}/images/${img._id}`,
                                                                    config
                                                                );
                                                                toast.success('Image deleted');
                                                            } catch (error) {
                                                                toast.error('Error deleting image');
                                                                return;
                                                            }
                                                        }
                                                        // Remove from state
                                                        const updated = uploadedImages.filter((_, i) => i !== index);
                                                        setUploadedImages(updated);
                                                    }}
                                                    className="bg-red-500 text-white px-3 py-2 rounded hover:bg-red-600"
                                                >
                                                    <FaTrash />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Upload Button for new images */}
                                {uploadedImages.some(img => img.file) && (
                                    <button
                                        onClick={async () => {
                                            try {
                                                setLoading(true);
                                                const config = { headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'multipart/form-data' } };

                                                const formData = new FormData();
                                                const imageNames = [];

                                                uploadedImages.forEach((img, index) => {
                                                    if (img.file) {
                                                        formData.append('images', img.file);
                                                        imageNames.push(img.name || `Image ${index + 1}`);
                                                    }
                                                });

                                                formData.append('imageNames', JSON.stringify(imageNames));

                                                const { data } = await axios.post(
                                                    `${backendUrl}/api/radiology/${selectedOrder._id}/upload-images`,
                                                    formData,
                                                    config
                                                );

                                                toast.success('Images uploaded successfully!');
                                                // Update with server response
                                                setUploadedImages(data.order.images || []);
                                            } catch (error) {
                                                console.error(error);
                                                toast.error('Error uploading images');
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="mt-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                                    >
                                        <FaUpload /> Upload Images
                                    </button>
                                )}

                                <p className="text-xs text-gray-500 mt-2">
                                    Upload multiple images and assign custom names for better organization
                                </p>
                            </div>

                            {/* Radiology Notes */}
                            <div className="mb-6">
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Radiology Findings / Report
                                </label>
                                <textarea
                                    className="w-full border p-3 rounded"
                                    rows="8"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Enter radiology findings and impression...

Example:
CHEST X-RAY PA VIEW

FINDINGS:
- Heart size is normal
- Lung fields are clear bilaterally
- No pleural effusion
- No pneumothorax
- Bony thorax is intact

IMPRESSION:
Normal chest X-ray. No acute cardiopulmonary disease.
                                    "
                                ></textarea>

                                {/* Signature Display */}
                                {selectedOrder.signedBy && (
                                    <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                                        <p className="text-sm font-semibold text-blue-900">
                                            Signed by: {selectedOrder.signedBy.name}
                                        </p>
                                        <p className="text-xs text-blue-700">
                                            Date: {new Date(selectedOrder.updatedAt).toLocaleString()}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            {(selectedOrder.report || selectedOrder.notes) && (
                                <div className="flex gap-2 mb-4">
                                    <button
                                        onClick={() => setViewResultModal(selectedOrder)}
                                        className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
                                    >
                                        <FaSearch /> View Report
                                    </button>
                                    <button
                                        onClick={() => handleUniversalPrint(selectedOrder)}
                                        className="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center justify-center gap-2"
                                    >
                                        <FaSave /> Print Report
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={handleSaveReport}
                                className="w-full bg-indigo-600 text-white px-6 py-3 rounded hover:bg-indigo-700 font-bold flex items-center justify-center gap-2"
                            >
                                <FaSave /> {(selectedOrder.report || selectedOrder.notes) ? 'Update & Re-sign Report' : 'Save & Sign Report'}
                            </button>
                            <p className="text-xs text-gray-600 mt-2 text-center">
                                By saving, you are electronically signing this report as {user.name}
                            </p>
                        </div>
                    )}
                </div>
            )}


            {/* View Result Modal */}
            {viewResultModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
                    <div className="bg-white rounded-lg p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold">Radiology Report</h3>
                            <button onClick={() => setViewResultModal(null)} className="text-gray-500 hover:text-gray-700">
                                <span className="text-2xl">×</span>
                            </button>
                        </div>

                        {/* PRINT AREA START */}
                        <div ref={resultRef} className="print-area">
                            <div className="text-center mb-6">
                                {systemSettings?.hospitalLogo && (
                                    <img src={systemSettings.hospitalLogo} alt="Logo" className="h-32 mx-auto mb-0 object-contain" />
                                )}
                                <h1 className="text-3xl font-bold text-gray-800 m-0">{systemSettings?.reportHeader || 'Radiology Report'}</h1>
                                <p className="text-sm text-gray-600 mt-2">{systemSettings?.address || 'Hospital Name'}</p>
                                <p className="text-sm text-gray-600">
                                    {systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                                    {systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                                    {systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                                </p>
                                <h2 className="text-xl font-semibold mt-4 border-t pt-2">RADIOLOGY REPORT</h2>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                <div>
                                    <p><strong>Patient Name:</strong> {viewResultModal.patient?.name}</p>
                                    <p><strong>MRN:</strong> {viewResultModal.patient?.mrn}</p>
                                    <p><strong>Age:</strong> {viewResultModal.patient?.age || 'N/A'}</p>
                                </div>
                                <div>
                                    <p><strong>Imaging Type:</strong> {viewResultModal.scanType}</p>
                                    <p><strong>Date Ordered:</strong> {new Date(viewResultModal.createdAt).toLocaleDateString()}</p>
                                    <p><strong>Gender:</strong> {viewResultModal.patient?.gender || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="border-t border-b border-gray-300 py-4 mb-6">
                                <h3 className="font-bold text-lg mb-3">Findings & Impression:</h3>
                                <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
                                    {viewResultModal.report || viewResultModal.notes || 'No report available'}
                                </pre>

                                {/* Display uploaded images */}
                                {viewResultModal.images && viewResultModal.images.length > 0 && (
                                    <div className="mt-6">
                                        <h4 className="font-bold text-md mb-3">Attached Images:</h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            {viewResultModal.images.map((img, index) => (
                                                <div key={index} className="border rounded p-2">
                                                    <p className="font-semibold text-sm mb-2 text-blue-700">{img.name}</p>
                                                    <img
                                                        src={`${backendUrl}/${img.path}`}
                                                        alt={img.name}
                                                        className="w-full h-48 object-contain bg-gray-100 rounded cursor-pointer hover:opacity-80"
                                                        onClick={() => window.open(`${backendUrl}/${img.path}`, '_blank')}
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Uploaded: {new Date(img.uploadedAt).toLocaleString()}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Legacy image URL support */}
                                {viewResultModal.resultImage && (
                                    <div className="mt-4">
                                        <p className="font-bold text-sm mb-2">Image Reference:</p>
                                        <div className="bg-gray-100 p-2 rounded text-xs break-all">
                                            {viewResultModal.resultImage}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-8 pt-4 border-t border-gray-300">
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        {viewResultModal.signedBy && (
                                            <>
                                                <p className="text-sm mb-1">
                                                    <strong>Radiologist:</strong> {viewResultModal.signedBy.name}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    <strong>Date:</strong> {new Date(viewResultModal.reportDate || viewResultModal.updatedAt).toLocaleString()}
                                                </p>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 text-xs text-gray-500 text-center">
                                <p>This is an electronically signed document. No handwritten signature is required.</p>
                            </div>
                        </div>
                        {/* PRINT AREA END */}

                        <div className="flex gap-2 mt-6 no-print">
                            <button
                                onClick={() => handleUniversalPrint(viewResultModal)}
                                className="flex-1 bg-purple-600 text-white px-6 py-3 rounded hover:bg-purple-700 font-semibold"
                            >
                                Print Report
                            </button>
                            <button
                                onClick={() => setViewResultModal(null)}
                                className="flex-1 bg-gray-400 text-white px-6 py-3 rounded hover:bg-gray-500 font-semibold"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Result Modal */}
            {editResultModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-bold">Edit Radiology Report</h3>
                            <button onClick={() => setEditResultModal(null)} className="text-gray-500 hover:text-gray-700">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>Scan Type:</strong> {editResultModal.scanType}
                            </p>
                            <p className="text-sm text-gray-600 mb-2">
                                <strong>Patient:</strong> {editResultModal.patient?.name} (MRN: {editResultModal.patient?.mrn})
                            </p>
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 mb-2 font-semibold">Report/Findings</label>
                            <textarea
                                className="w-full border p-3 rounded font-mono text-sm"
                                rows="15"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Enter radiology findings and impressions..."
                            ></textarea>
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 mb-2 font-semibold">Image URL (Optional)</label>
                            <input
                                type="text"
                                className="w-full border p-3 rounded"
                                value={editImageUrl}
                                onChange={(e) => setEditImageUrl(e.target.value)}
                                placeholder="Enter image URL (e.g., https://example.com/image.jpg)"
                            />
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={handleEditReport}
                                className="flex-1 bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-semibold flex items-center justify-center gap-2"
                            >
                                <FaSave /> Save & Re-sign
                            </button>
                            <button
                                onClick={() => setEditResultModal(null)}
                                className="flex-1 bg-gray-400 text-white px-6 py-3 rounded hover:bg-gray-500 font-semibold"
                            >
                                Cancel
                            </button>
                        </div>

                        <p className="text-xs text-gray-600 mt-2 text-center">
                            <span className="text-orange-600 font-semibold">⚠️ Editing will update the signature timestamp</span>
                        </p>
                    </div>
                </div>
            )}

        </Layout>
    );
};

export default RadiologyDashboard;
