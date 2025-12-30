import { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaXRay, FaSearch, FaCheckCircle, FaUpload, FaSave, FaImage, FaEdit, FaTimes } from 'react-icons/fa';
import { toast } from 'react-toastify';

import LoadingOverlay from '../components/loadingOverlay';

const RadiologyDashboard = () => {
    const [loading, setLoading] = useState(false);
    const [radiologyOrders, setRadiologyOrders] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [completedSearchTerm, setCompletedSearchTerm] = useState('');
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [receiptNumber, setReceiptNumber] = useState('');
    const [receiptValidated, setReceiptValidated] = useState(false);
    const [notes, setNotes] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [systemSettings, setSystemSettings] = useState(null);
    const { user } = useContext(AuthContext);

    const [viewResultModal, setViewResultModal] = useState(null);
    const [editResultModal, setEditResultModal] = useState(null);
    const [editNotes, setEditNotes] = useState('');
    const [editImageUrl, setEditImageUrl] = useState('');
    const resultRef = useRef();

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
        fetchRadiologyOrders();
    }, []);

    const fetchRadiologyOrders = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/radiology', config);
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
        const filtered = radiologyOrders.filter(order =>
            order.patient?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.patient?.mrn?.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setRadiologyOrders(filtered);
    };

    const handleSelectOrder = (order) => {
        setSelectedOrder(order);
        setReceiptValidated(false);
        setReceiptNumber('');
        // Check for report in 'report' field (from backend) or 'notes' (legacy/frontend state)
        setNotes(order.report || order.notes || '');
        setImageUrl(order.resultImage || '');
    };

    const handleValidateReceipt = async () => {
        if (!receiptNumber.trim()) {
            toast.error('Please enter receipt number');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const response = await axios.post(
                'http://localhost:5000/api/receipts/validate',
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
                `http://localhost:5000/api/radiology/${selectedOrder._id}/report`,
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
                `http://localhost:5000/api/radiology/${editResultModal._id}/report`,
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
                        </div>
                        <div>
                            <p><strong>Imaging Type:</strong> ${order.scanType}</p>
                            <p><strong>Date Ordered:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                        </div>
                    </div>

                    <div class="results-section">
                        <h3>Findings & Impression:</h3>
                        <div class="results-content">${order.report || order.notes || 'No report available'}</div>
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

    const pendingOrders = radiologyOrders
        .filter(o => o.status === 'pending')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const completedOrders = radiologyOrders
        .filter(o => o.status === 'completed')
        .filter(o => {
            if (!completedSearchTerm) return true;
            const searchLower = completedSearchTerm.toLowerCase();
            return (
                o.scanType?.toLowerCase().includes(searchLower) ||
                o.patient?.name?.toLowerCase().includes(searchLower) ||
                o.patient?.mrn?.toLowerCase().includes(searchLower)
            );
        })
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <h2 className="text-2xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                <FaXRay className="text-indigo-600" /> Radiology Dashboard
            </h2>

            {/* Summary */}
            <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-yellow-50 p-6 rounded shadow">
                    <p className="text-yellow-700 text-sm font-semibold">Pending Studies</p>
                    <p className="text-3xl font-bold text-yellow-800">{pendingOrders.length}</p>
                </div>
                <div className="bg-green-50 p-6 rounded shadow">
                    <p className="text-green-700 text-sm font-semibold">Completed Today</p>
                    <p className="text-3xl font-bold text-green-800">
                        {completedOrders.filter(o => new Date(o.updatedAt).toDateString() === new Date().toDateString()).length}
                    </p>
                </div>
            </div>

            {/* Search */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Search Radiology Orders
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search by Patient Name or MRN..."
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

            {/* Pending Orders */}
            {!selectedOrder && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h3 className="text-xl font-bold mb-4">Pending Imaging Studies</h3>
                    {pendingOrders.length === 0 ? (
                        <p className="text-gray-500">No pending studies</p>
                    ) : (
                        <div className="space-y-2">
                            {pendingOrders.map(order => (
                                <div
                                    key={order._id}
                                    className="border p-4 rounded hover:bg-gray-50 cursor-pointer"
                                    onClick={() => handleSelectOrder(order)}
                                >
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <p className="font-bold text-lg">{order.scanType}</p>
                                            <p className="text-gray-600">
                                                Patient: {order.patient?.name} (MRN: {order.patient?.mrn})
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Ordered: {new Date(order.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded text-sm">
                                            {order.status}
                                        </span>
                                    </div>
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
                                    <FaImage /> Image URL (Optional)
                                </label>
                                <input
                                    type="text"
                                    className="w-full border p-3 rounded"
                                    value={imageUrl}
                                    onChange={(e) => setImageUrl(e.target.value)}
                                    placeholder="Enter image URL or path..."
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    In production, this would integrate with PACS or file upload system
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

            {/* Completed Studies */}
            {!selectedOrder && (
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-xl font-bold mb-4">Completed Studies</h3>

                    {/* Search Bar for Completed Studies */}
                    <div className="mb-4">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Search by Scan Type, Patient Name, or MRN..."
                                className="flex-1 border p-2 rounded"
                                value={completedSearchTerm}
                                onChange={(e) => setCompletedSearchTerm(e.target.value)}
                            />
                            {completedSearchTerm && (
                                <button
                                    onClick={() => setCompletedSearchTerm('')}
                                    className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {completedSearchTerm ? `Showing ${completedOrders.length} result(s)` : `Showing ${Math.min(5, completedOrders.length)} of ${completedOrders.length} completed studie(s)`}
                        </p>
                    </div>

                    {completedOrders.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No completed studies found</p>
                    ) : (
                        <div className="space-y-2">
                            {(completedSearchTerm ? completedOrders : completedOrders.slice(0, 5)).map(order => (
                                <div key={order._id} className="border p-3 rounded bg-green-50">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <p className="font-semibold">{order.scanType}</p>
                                            <p className="text-sm text-gray-600">
                                                Patient: {order.patient?.name} | Completed: {new Date(order.updatedAt).toLocaleString()}
                                            </p>
                                            {order.signedBy && (
                                                <p className="text-xs text-blue-700 mt-1">
                                                    Signed by: {order.signedBy.name}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <button
                                                onClick={() => setViewResultModal(order)}
                                                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm flex items-center gap-1"
                                            >
                                                <FaSearch /> View
                                            </button>
                                            <button
                                                onClick={() => handleUniversalPrint(order)}
                                                className="bg-purple-600 text-white px-3 py-1 rounded hover:bg-purple-700 text-sm flex items-center gap-1"
                                            >
                                                <FaSave /> Print
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setEditResultModal(order);
                                                    setEditNotes(order.report || '');
                                                    setEditImageUrl(order.resultImage || '');
                                                }}
                                                className="bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 text-sm flex items-center gap-1"
                                            >
                                                <FaEdit /> Edit
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
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
                                </div>
                                <div>
                                    <p><strong>Imaging Type:</strong> {viewResultModal.scanType}</p>
                                    <p><strong>Date Ordered:</strong> {new Date(viewResultModal.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>

                            <div className="border-t border-b border-gray-300 py-4 mb-6">
                                <h3 className="font-bold text-lg mb-3">Findings & Impression:</h3>
                                <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
                                    {viewResultModal.report || viewResultModal.notes || 'No report available'}
                                </pre>
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
