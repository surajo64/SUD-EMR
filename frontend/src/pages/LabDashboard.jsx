import { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { toast } from 'react-toastify';
import { parseRange, checkRange, getRangeColorClass } from '../utils/labUtils';
import { formatCompactNumber } from '../utils/formatters';
import { FaFlask, FaSearch, FaCheckCircle, FaEdit, FaSave, FaTimes, FaFileAlt, FaCog, FaChevronDown, FaChevronUp, FaTimesCircle, FaVials } from 'react-icons/fa';

const LabDashboard = () => {
    const resultRef = useRef();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const orderIdParam = searchParams.get('orderId');
    const [labOrders, setLabOrders] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'waiting_approval', 'completed'
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [results, setResults] = useState('');
    const [tableResults, setTableResults] = useState([]);
    const [isTableFormat, setIsTableFormat] = useState(false);
    const [viewResultModal, setViewResultModal] = useState(null);
    const [editResultModal, setEditResultModal] = useState(null);
    const [editResults, setEditResults] = useState('');
    const [editTableResults, setEditTableResults] = useState([]);
    const [isEditTableFormat, setIsEditTableFormat] = useState(false);
    const [systemSettings, setSystemSettings] = useState(null);
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const [expandedEncounter, setExpandedEncounter] = useState(null);
    const [userStats, setUserStats] = useState({ testsToday: 0 });

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
        if (orderIdParam && labOrders.length > 0) {
            const targetOrder = labOrders.find(o => o._id === orderIdParam);
            if (targetOrder) {
                const visitId = targetOrder.visit?._id || 'external-' + (targetOrder.patient?._id || 'unknown');
                setExpandedEncounter(visitId);
                handleSelectOrder(targetOrder);
                setSearchParams({});
            }
        }
    }, [orderIdParam, labOrders, setSearchParams]);



    // Parse text-based template or saved result into table format
    const parseTextTemplate = (template) => {
        if (!template) return [];

        const lines = template.split('\n');
        const params = [];

        for (const line of lines) {
            // Match patterns like "- WBC: _____ x10^3/μL (Normal: 4.0-11.0)"
            // OR "- Malaria: ++ Positive/Negative"
            const match = line.match(/^\s*-\s*([^:]+):\s*(.*?)(?:\s*\(?(?:Normal:\s*)?([^)]*)\)?)?$/);
            if (match) {
                const name = match[1].trim();
                let fullValue = match[2].trim();
                const normalRange = (match[3] || '').trim();

                // Extract value from underscores if present (e.g., "__yes__")
                const valueMatch = fullValue.match(/^_*([^_]*)_*$/);
                const value = valueMatch ? valueMatch[1].trim() : fullValue;

                params.push({
                    name,
                    value: value === '_____' ? '' : value,
                    unit: '', // Text templates usually don't have separate unit column
                    normalRange
                });
            }
        }

        return params;
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
        if (user && user.token) {
            fetchLabOrders();
        }
    }, [user, backendUrl]);

    const fetchLabOrders = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/lab`, config);
            setLabOrders(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching lab orders');
        }
    };

    const searchPatients = () => {
        fetchLabOrders(); // Refresh data from server on search
    };

    const handleSelectOrder = async (order) => {
        setSelectedOrder(order);

        if (order.result) {
            // Check if result is in table format (JSON) or text format
            try {
                const parsedResult = JSON.parse(order.result);
                if (parsedResult.format === 'table' && Array.isArray(parsedResult.parameters)) {
                    setIsTableFormat(true);
                    setTableResults(parsedResult.parameters);
                    setResults('');
                } else {
                    setIsTableFormat(false);
                    setResults(order.result);
                    setTableResults([]);
                }
            } catch (e) {
                // Not JSON, treat as text
                setIsTableFormat(false);
                setResults(order.result);
                setTableResults([]);
            }
        } else {
            try {
                const config = { headers: { Authorization: `Bearer ${user.token}` } };
                const { data } = await axios.get(`${backendUrl}/api/charges?type=lab&active=true`, config);
                const matchingCharge = data.find(c => c.name === order.testName);
                const template = matchingCharge?.resultTemplate || '';

                // Try to parse as JSON table format
                try {
                    const parsedTemplate = JSON.parse(template);
                    if (parsedTemplate.format === 'table' && Array.isArray(parsedTemplate.parameters)) {
                        setIsTableFormat(true);
                        setTableResults(parsedTemplate.parameters.map(p => ({ ...p, value: '' })));
                        setResults('');
                    } else {
                        throw new Error('Not table format');
                    }
                } catch (e) {
                    // Text-based template - try to parse it into table format
                    const parsedParams = parseTextTemplate(template);
                    if (parsedParams.length > 0) {
                        setIsTableFormat(true);
                        setTableResults(parsedParams);
                        setResults('');
                    } else {
                        setIsTableFormat(false);
                        setResults(template);
                        setTableResults([]);
                    }
                }
            } catch (error) {
                console.error('Error fetching template:', error);
                setIsTableFormat(false);
                setResults('');
                setTableResults([]);
            }
        }
    };

    const handleSaveResults = async () => {
        let resultData;

        if (isTableFormat) {
            // Validate that at least one value is entered
            const hasValues = tableResults.some(param => param.value && param.value.trim());
            if (!hasValues) {
                toast.error('Please enter at least one lab result value');
                return;
            }

            // Save as JSON
            resultData = JSON.stringify({
                format: 'table',
                parameters: tableResults
            });
        } else {
            if (!results.trim()) {
                toast.error('Please enter lab results');
                return;
            }
            resultData = results;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/lab/${selectedOrder._id}/result`,
                {
                    status: 'completed',
                    result: resultData,
                    signedBy: user._id,
                    resultDate: new Date()
                },
                config
            );

            toast.success('Lab results saved and signed!');
            setSelectedOrder(null);
            setResults('');
            setTableResults([]);
            setIsTableFormat(false);
            fetchLabOrders();
        } catch (error) {
            console.error(error);
            toast.error('Error saving results');
        }
    };

    const handleApproveResult = async (orderId) => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/lab/${orderId}/approve`,
                {},
                config
            );

            toast.success('Lab result approved!');
            fetchLabOrders();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error approving result');
        }
    };

    const handleRejectResult = async (id) => {
        const reason = window.prompt('Please enter the reason for rejecting these results:');
        if (!reason) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.put(`${backendUrl}/api/lab/${id}/reject`, { reason }, config);
            toast.success('Result rejected and sent back for correction');

            // Sync with current selection if applicable
            if (selectedOrder && selectedOrder._id === id) {
                setSelectedOrder(data);
            }
            fetchLabOrders();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error rejecting result');
        }
    };

    const handleEditResult = async () => {
        let resultData;

        if (isEditTableFormat) {
            const hasValues = editTableResults.some(param => param.value && param.value.trim());
            if (!hasValues) {
                toast.error('Please enter at least one lab result value');
                return;
            }
            resultData = JSON.stringify({
                format: 'table',
                parameters: editTableResults
            });
        } else {
            if (!editResults.trim()) {
                toast.error('Please enter lab results');
                return;
            }
            resultData = editResults;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(
                `${backendUrl}/api/lab/${editResultModal._id}/result`,
                {
                    status: 'completed',
                    result: resultData,
                    signedBy: user._id,
                    resultDate: new Date()
                },
                config
            );

            toast.success('Lab results updated and re-signed!');
            setEditResultModal(null);
            setEditResults('');
            setEditTableResults([]);
            setIsEditTableFormat(false);
            fetchLabOrders();
        } catch (error) {
            console.error(error);
            toast.error('Error updating results');
        }
    };

    const handleUniversalPrint = (order) => {
        const printWindow = window.open("", "_blank");

        const printContent = `
            <html>
                <head>
                    <title>Laboratory Report - ${order.testName}</title>
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
                        <h1 style="margin: 0 0 5px 0;">${systemSettings?.reportHeader || 'LABORATORY REPORT'}</h1>
                        <p style="margin: 5px 0; font-size: 14px;">${systemSettings?.address || ''}</p>
                        <p style="margin: 2px 0; font-size: 12px;">
                            ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                            ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                            ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                        </p>
                        <h2 style="font-size: 20px; border-top: 1px solid #eee; pt-2; mt-2;">Laboratory Report</h2>
                    </div>

                    <div class="info-grid">
                        <div>
                            <p><strong>Patient Name:</strong> ${order.patient?.name}</p>
                            <p><strong>MRN:</strong> ${order.patient?.mrn}</p>
                            <p><strong>Age:</strong> ${order.patient?.age || 'N/A'}</p>
                        </div>
                        <div>
                            <p><strong>Test Name:</strong> ${order.testName}</p>
                            <p><strong>Date Ordered:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
                            <p><strong>Gender:</strong> ${order.patient?.gender || 'N/A'}</p>
                        </div>
                    </div>

                    ${order.clinicalDetails ? `
                    <div style="margin-bottom: 20px; padding: 10px; background: #f9fafb; border-left: 4px solid #9ca3af; font-style: italic;">
                        <p style="margin: 0; font-weight: bold; font-style: normal; color: #374151; font-size: 14px;">Clinical Detail:</p>
                        <p style="margin: 5px 0 0 0; font-size: 13px; color: #4b5563;">${order.clinicalDetails}</p>
                    </div>
                    ` : ''}

                    <div class="results-section">
                        <h3>Test Results:</h3>
                        ${(() => {
                try {
                    const parsed = JSON.parse(order.result);
                    if (parsed.format === 'table' && Array.isArray(parsed.parameters)) {
                        return `
                                        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                            <thead>
                                                <tr style="background: #f3f4f6;">
                                                    <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600;">Parameter</th>
                                                    <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 120px;">Value</th>
                                                    <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 100px;">Unit</th>
                                                    <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 150px;">Normal Range</th>
                                                    <th style="text-align: center; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 80px;">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${parsed.parameters.map(param => {
                            const rangeStatus = checkRange(param.value, param.normalRange);
                            let bgColor = '#f9fafb';
                            let statusText = '';
                            let statusColor = '';

                            if (param.value) {
                                if (rangeStatus === 'low') {
                                    bgColor = '#fed7aa';
                                    statusText = '↓ LOW';
                                    statusColor = '#9a3412';
                                } else if (rangeStatus === 'high') {
                                    bgColor = '#fecaca';
                                    statusText = '↑ HIGH';
                                    statusColor = '#991b1b';
                                } else {
                                    bgColor = '#d1fae5';
                                    statusText = '✓ Normal';
                                    statusColor = '#065f46';
                                }
                            }

                            return `
                                                        <tr style="background: ${bgColor};">
                                                            <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: 500;">${param.name}</td>
                                                            <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: 600;">${param.value || '-'}</td>
                                                            <td style="padding: 10px; border: 1px solid #d1d5db; color: #6b7280;">${param.unit || ''}</td>
                                                            <td style="padding: 10px; border: 1px solid #d1d5db; color: #6b7280;">${param.normalRange || ''}</td>
                                                            <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">
                                                                ${(param.value && !param.name.toLowerCase().trim().includes('blood group') && !param.name.toLowerCase().trim().includes('genotype')) ? `<span style="color: ${statusColor}; font-weight: 600; font-size: 11px;">${statusText}</span>` : ''}
                                                            </td>
                                                        </tr>
                                                    `;
                        }).join('')}
                                            </tbody>
                                        </table>
                                    `;
                    }
                } catch (e) {
                    // Not JSON - try to parse as text-to-table
                    const parsedParams = parseTextTemplate(order.result);
                    if (parsedParams.length > 0) {
                        return `
                            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                                <thead>
                                    <tr style="background: #f3f4f6;">
                                        <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600;">Parameter</th>
                                        <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 250px;">Result</th>
                                        <th style="text-align: left; padding: 12px; border: 1px solid #d1d5db; font-weight: 600; width: 200px;">Normal Range</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${parsedParams.map(param => `
                                        <tr>
                                            <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: 500;">${param.name}</td>
                                            <td style="padding: 10px; border: 1px solid #d1d5db; font-weight: 600;">${param.value || '-'}</td>
                                            <td style="padding: 10px; border: 1px solid #d1d5db; color: #6b7280;">${param.normalRange || ''}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        `;
                    }
                }
                return `<div class="results-content">${order.result}</div>`;
            })()}
                    </div>

                    <div class="signature-section" style="margin-top: 30px; padding-top: 15px; border-top: 2px solid #333;">
                        <h4 style="margin: 0 0 15px 0; text-transform: uppercase; font-size: 12px; letter-spacing: 1px; color: #374151;">Audit Trail & Signatures</h4>
                        <div class="signature-grid" style="display: grid; grid-template-cols: repeat(2, 1fr); gap: 20px;">
                            ${order.signedBy ? `
                                <div style="padding: 10px; border: 1px solid #e5e7eb; border-radius: 6px;">
                                    <p style="margin: 0; font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">Performed By</p>
                                    <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">${order.signedBy.name}</p>
                                    <p style="margin: 2px 0 0 0; font-size: 11px; color: #9ca3af;">${new Date(order.signedAt).toLocaleString()}</p>
                                </div>
                            ` : ''}

                            ${order.rejectedBy ? `
                                <div style="padding: 10px; border: 1px solid #fee2e2; border-radius: 6px; background-color: #fef2f2;">
                                    <p style="margin: 0; font-size: 10px; font-weight: bold; color: #b91c1c; text-transform: uppercase;">Rejected By</p>
                                    <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">${order.rejectedBy.name}</p>
                                    <p style="margin: 2px 0 0 0; font-size: 11px; color: #f87171;">Reason: ${order.rejectionReason}</p>
                                    <p style="margin: 2px 0 0 0; font-size: 11px; color: #f87171;">${new Date(order.rejectedAt).toLocaleString()}</p>
                                </div>
                            ` : ''}

                            ${order.lastModifiedBy ? `
                                <div style="padding: 10px; border: 1px solid #fef3c7; border-radius: 6px; background-color: #fffbeb;">
                                    <p style="margin: 0; font-size: 10px; font-weight: bold; color: #92400e; text-transform: uppercase;">Last Edited By</p>
                                    <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">${order.lastModifiedBy.name}</p>
                                    <p style="margin: 2px 0 0 0; font-size: 11px; color: #d97706;">${new Date(order.lastModifiedAt).toLocaleString()}</p>
                                </div>
                            ` : ''}

                            ${order.approvedBy ? `
                                <div style="padding: 10px; border: 1px solid #dcfce7; border-radius: 6px; background-color: #f0fdf4;">
                                    <p style="margin: 0; font-size: 10px; font-weight: bold; color: #166534; text-transform: uppercase;">Verified & Approved By</p>
                                    <p style="margin: 5px 0 0 0; font-size: 13px; font-weight: 600;">${order.approvedBy.name}</p>
                                    <p style="margin: 2px 0 0 0; font-size: 11px; color: #22c55e;">${new Date(order.approvedAt).toLocaleString()}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="footer">
                        <p>This is an electronically signed document. No handwritten signature is required.</p>
                    </div>
                </body>
            </html>
        `;

        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
        }, 250);
    };

    const filteredLabOrders = labOrders.filter(order => {
        // Search filter
        if (searchTerm) {
            const s = searchTerm.toLowerCase();
            const matchesSearch = (
                (order.patient?.name?.toLowerCase() || '').includes(s) ||
                (String(order.patient?.mrn || '').toLowerCase()).includes(s) ||
                (order.patient?.contact?.toLowerCase() || '').includes(s) ||
                (order.testName?.toLowerCase() || '').includes(s)
            );
            if (!matchesSearch) return false;
        }

        // Specialization check - Technician or scientist should only see their specialization's tests
        if (user.role === 'lab_technician' || user.role === 'lab_scientist') {
            if (user.labSpecialization && user.labSpecialization !== 'All Lab Test') {
                if (order.labSpecialization && order.labSpecialization !== user.labSpecialization) {
                    return false;
                }
            }
        }

        // Status filter
        if (statusFilter === 'pending') {
            return order.status === 'pending' || order.status === 'rejected';
        } else if (statusFilter === 'waiting_approval') {
            return order.status === 'completed' && !order.approvedBy;
        } else if (statusFilter === 'completed') {
            return order.status === 'completed' && order.approvedBy;
        }
        return true;
    });

    const pendingOrders = labOrders
        .filter(o => o.status === 'pending');

    const completedOrders = labOrders
        .filter(o => o.status === 'completed');

    // Group orders for display
    const groupedEncounters = Object.values(
        filteredLabOrders
            .reduce((acc, order) => {
                // Modified grouping to handle visits more robustly
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
            // Handle groups with no orders or invalid dates
            const validDates = orderDates.filter(d => !isNaN(d));
            const maxOrderDate = validDates.length > 0 ? Math.max(...validDates) : 0;
            return Math.max(visitDate, maxOrderDate);
        };
        return getLatest(b) - getLatest(a);
    });

    return (
        <Layout>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaFlask className="text-purple-600" /> Laboratory Dashboard
                </h2>
                <button
                    onClick={() => navigate('/lab/manage-tests')}
                    className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
                >
                    <FaCog /> Manage Lab Tests
                </button>
            </div>

            {/* Status Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-2 rounded text-sm font-semibold transition ${
                        statusFilter === 'all'
                            ? 'bg-purple-600 text-white shadow'
                            : 'bg-white text-gray-600 border hover:bg-gray-50'
                    }`}
                >
                    All Orders ({labOrders.length})
                </button>
                <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-4 py-2 rounded text-sm font-semibold transition ${
                        statusFilter === 'pending'
                            ? 'bg-yellow-600 text-white shadow'
                            : 'bg-white text-gray-600 border hover:bg-gray-50'
                    }`}
                >
                    Pending ({labOrders.filter(o => o.status === 'pending' || o.status === 'rejected').length})
                </button>
                <button
                    onClick={() => setStatusFilter('waiting_approval')}
                    className={`px-4 py-2 rounded text-sm font-semibold transition ${
                        statusFilter === 'waiting_approval'
                            ? 'bg-indigo-600 text-white shadow'
                            : 'bg-white text-gray-600 border hover:bg-gray-50'
                    }`}
                >
                    Waiting Review & Approval ({labOrders.filter(o => o.status === 'completed' && !o.approvedBy).length})
                </button>
                <button
                    onClick={() => setStatusFilter('completed')}
                    className={`px-4 py-2 rounded text-sm font-semibold transition ${
                        statusFilter === 'completed'
                            ? 'bg-green-600 text-white shadow'
                            : 'bg-white text-gray-600 border hover:bg-gray-50'
                    }`}
                >
                    Completed ({labOrders.filter(o => o.status === 'completed' && o.approvedBy).length})
                </button>
            </div>

            {/* Search */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Search Lab Orders
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Search by Patient Name, MRN, Phone or Test Name..."
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
                    {searchTerm && (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                fetchLabOrders();
                            }}
                            className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                        >
                            Clear
                        </button>
                    )}
                </div>
            </div>

            {/* Grouped Search Results */}
            {
                !selectedOrder && (
                    <div className="mb-6">
                        <div className="space-y-4">
                            {groupedEncounters.length === 0 ? (
                                <div className="bg-white p-12 rounded shadow text-center text-gray-500">
                                    <p className="text-lg font-semibold">No results found</p>
                                    <p className="text-sm">Try searching with a different name or MRN.</p>
                                </div>
                            ) : (
                                groupedEncounters.map(group => (
                                    <div key={group.id} className="bg-white rounded shadow overflow-hidden border border-purple-100">
                                        {/* Encounter Header */}
                                        <div
                                            className="p-4 cursor-pointer hover:bg-purple-50 flex justify-between items-center transition-colors"
                                            onClick={() => setExpandedEncounter(expandedEncounter === group.id ? null : group.id)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="bg-purple-100 p-3 rounded-full text-purple-600">
                                                    <FaFlask size={20} />
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
                                                                <span className="text-purple-600 font-medium">{group.visit.type}</span>
                                                                <span className="mx-2 text-gray-300">•</span>
                                                                {new Date(group.visit.createdAt).toLocaleDateString()}
                                                            </>
                                                        ) : (
                                                            <span className="text-blue-600 font-medium italic flex items-center gap-1">
                                                                <FaFlask size={10} /> Lab Direct / Walk-in
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right mr-4">
                                                    <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                                                        {group.orders.length} {group.orders.length === 1 ? 'Test' : 'Tests'}
                                                    </span>
                                                    <div className="flex flex-col items-end mt-1">
                                                        {group.orders.some(o => o.status === 'pending') && (
                                                            <p className="text-[10px] text-amber-500 uppercase tracking-wider font-bold">
                                                                {group.orders.filter(o => o.status === 'pending').length} Pending
                                                            </p>
                                                        )}
                                                        {group.orders.some(o => o.status === 'rejected') && (
                                                            <p className="text-[10px] text-red-500 uppercase tracking-wider font-bold">
                                                                {group.orders.filter(o => o.status === 'rejected').length} Rejected
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

                                        {/* Tests List (Expanded) */}
                                        {expandedEncounter === group.id && (
                                            <div className="bg-gray-50 border-t divide-y">
                                                {group.orders.map(order => (
                                                    <div
                                                        key={order._id}
                                                        className={`p-4 flex justify-between items-center ${order.status === 'completed' && order.approvedBy
                                                            ? 'bg-gray-50 opacity-75'
                                                            : 'bg-white'
                                                            }`}
                                                    >
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <p className="font-bold text-gray-800">{order.testName}</p>
                                                                {order.labSpecialization && (
                                                                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-bold uppercase">
                                                                        {order.labSpecialization}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-xs text-gray-500">
                                                                Ordered: {new Date(order.createdAt).toLocaleString()}
                                                            </p>
                                                            {order.clinicalDetails && (
                                                                <div className="mt-2 p-2 bg-blue-50 border-l-4 border-blue-400 text-xs italic">
                                                                    <p className="font-bold text-blue-800 not-italic uppercase text-[9px] mb-1">Clinical context:</p>
                                                                    <p className="text-gray-700">{order.clinicalDetails}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${order.status === 'completed'
                                                                ? (order.approvedBy ? 'bg-green-600 text-white' : 'bg-green-100 text-green-800')
                                                                : order.status === 'rejected'
                                                                    ? 'bg-red-100 text-red-800'
                                                                    : 'bg-yellow-100 text-yellow-800'
                                                                }`}>
                                                                {order.status === 'completed' ? (order.approvedBy ? 'Reviewed and Approved' : 'Completed') : order.status === 'rejected' ? 'REJECTED' : 'Pending'}
                                                            </span>
                                                            <div className="flex gap-1">
                                                                {order.status === 'completed' ? (
                                                                    <>
                                                                        <button
                                                                            onClick={() => setViewResultModal(order)}
                                                                            className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                                                                            title="View Results"
                                                                        >
                                                                            <FaFileAlt size={12} />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleUniversalPrint(order)}
                                                                            className="p-1.5 bg-purple-50 text-purple-600 rounded hover:bg-purple-100 transition-colors"
                                                                            title="Print Results"
                                                                        >
                                                                            <FaFileAlt size={12} />
                                                                        </button>
                                                                        {((user.role === 'lab_technician' && !order.approvedBy) || user.role === 'lab_scientist') && (
                                                                            <button
                                                                                onClick={() => {
                                                                                    setEditResultModal(order);
                                                                                    try {
                                                                                        const parsed = JSON.parse(order.result);
                                                                                        if (parsed.format === 'table' && Array.isArray(parsed.parameters)) {
                                                                                            setIsEditTableFormat(true);
                                                                                            setEditTableResults(parsed.parameters);
                                                                                            setEditResults('');
                                                                                        } else {
                                                                                            setIsEditTableFormat(false);
                                                                                            setEditResults(order.result);
                                                                                            setEditTableResults([]);
                                                                                        }
                                                                                    } catch (err) {
                                                                                        const parsedParams = parseTextTemplate(order.result);
                                                                                        if (parsedParams.length > 0) {
                                                                                            setIsEditTableFormat(true);
                                                                                            setEditTableResults(parsedParams);
                                                                                            setEditResults('');
                                                                                        } else {
                                                                                            setIsEditTableFormat(false);
                                                                                            setEditResults(order.result);
                                                                                            setEditTableResults([]);
                                                                                        }
                                                                                    }
                                                                                }}
                                                                                className="p-1.5 bg-orange-50 text-orange-600 rounded hover:bg-orange-100 transition-colors"
                                                                                title="Edit"
                                                                            >
                                                                                <FaEdit size={12} />
                                                                            </button>
                                                                        )}
                                                                        {user.role === 'lab_scientist' && !order.approvedBy && (
                                                                            <>
                                                                                {order.signedBy?._id !== user._id && (
                                                                                    <button
                                                                                        onClick={() => handleApproveResult(order._id)}
                                                                                        className="p-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                                                                                        title="Approve"
                                                                                    >
                                                                                        <FaCheckCircle size={12} />
                                                                                    </button>
                                                                                )}
                                                                                {order.signedBy?._id !== user._id && (
                                                                                    <button
                                                                                        onClick={() => handleRejectResult(order._id)}
                                                                                        className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                                                                                        title="Reject Result"
                                                                                    >
                                                                                        <FaTimesCircle size={12} />
                                                                                    </button>
                                                                                )}
                                                                            </>
                                                                        )}
                                                                    </>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => handleSelectOrder(order)}
                                                                        className={`p-1.5 rounded transition-colors ${order.status === 'rejected' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                                                                        title={order.status === 'rejected' ? 'Revise Rejected Result' : 'Enter Results'}
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
                                ))
                            )}
                        </div>
                    </div>
                )
            }

            {/* Selected Order - Results Entry */}
            {
                selectedOrder && (
                    <div className="bg-white p-6 rounded shadow">
                        <div className="bg-purple-50 p-4 rounded mb-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="font-bold text-lg">{selectedOrder.testName}</p>
                                    <p className="text-gray-700">Patient: {selectedOrder.patient?.name}</p>
                                    <p className="text-sm text-gray-600">MRN: {selectedOrder.patient?.mrn}</p>
                                    {selectedOrder.clinicalDetails && (
                                        <div className="mt-3 p-3 bg-white bg-opacity-60 border-l-4 border-purple-400 text-sm">
                                            <p className="font-semibold text-purple-900">Clinical Detail:</p>
                                            <p className="text-gray-800 italic">{selectedOrder.clinicalDetails}</p>
                                        </div>
                                    )}
                                    {selectedOrder.rejectionReason && (
                                        <div className="mt-3 p-3 bg-red-100 border-l-4 border-red-500 text-sm animate-pulse">
                                            <p className="font-bold text-red-800 uppercase text-[10px] mb-1">Rejection Feedback (Action Required):</p>
                                            <p className="text-red-900 font-semibold">{selectedOrder.rejectionReason}</p>
                                            <p className="text-xs text-red-700 mt-2 italic">Please review the previous entries, correct any errors, and sign again.</p>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setSelectedOrder(null);
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
                                    This test has not been paid for yet. Please ask the patient to pay at the cashier.
                                </p>
                                <div className="flex gap-2 items-center">
                                    <span className="font-bold text-red-600">Status: Unpaid</span>
                                    <button
                                        onClick={fetchLabOrders}
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

                                <div className="mb-6">
                                    <label className="block text-gray-700 mb-2 font-semibold flex items-center gap-2">
                                        <FaEdit /> Lab Results
                                    </label>

                                    {isTableFormat ? (
                                        <div className="border rounded overflow-hidden">
                                            <table className="w-full">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="text-left p-3 font-semibold border-b">Parameter</th>
                                                        <th className="text-left p-3 font-semibold border-b w-32">Value</th>
                                                        <th className="text-left p-3 font-semibold border-b w-24">Unit</th>
                                                        <th className="text-left p-3 font-semibold border-b w-40">Normal Range</th>
                                                        <th className="text-left p-3 font-semibold border-b w-24">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {tableResults.map((param, index) => {
                                                        const rangeStatus = checkRange(param.value, param.normalRange);
                                                        const colorClass = getRangeColorClass(rangeStatus);

                                                        return (
                                                            <tr key={index} className={`border-b ${param.value ? colorClass : ''}`}>
                                                                <td className="p-3 font-medium">{param.name}</td>
                                                                <td className="p-2">
                                                                    <input
                                                                        type="text"
                                                                        value={param.value}
                                                                        onChange={(e) => {
                                                                            const newResults = [...tableResults];
                                                                            newResults[index].value = e.target.value;
                                                                            setTableResults(newResults);
                                                                        }}
                                                                        className="w-full border p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                                        placeholder="Enter value"
                                                                    />
                                                                </td>
                                                                <td className="p-3 text-sm text-gray-600">{param.unit}</td>
                                                                <td className="p-3 text-sm text-gray-600">{param.normalRange}</td>
                                                                <td className="p-3">
                                                                    {param.value && (
                                                                        <span className={`text-xs px-2 py-1 rounded font-semibold ${rangeStatus === 'low' ? 'bg-orange-200 text-orange-900' :
                                                                            rangeStatus === 'high' ? 'bg-red-200 text-red-900' :
                                                                                'bg-green-200 text-green-900'
                                                                            }`}>
                                                                            {rangeStatus === 'low' ? '↓ LOW' :
                                                                                rangeStatus === 'high' ? '↑ HIGH' :
                                                                                    (param.name.toLowerCase().trim().includes('blood group') || param.name.toLowerCase().trim().includes('genotype')) ? '' : '✓ Normal'}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <textarea
                                            className="w-full border p-3 rounded font-mono text-sm"
                                            rows="20"
                                            value={results}
                                            onChange={(e) => setResults(e.target.value)}
                                            placeholder="Enter lab test results here..."
                                        ></textarea>
                                    )}

                                    {/* Signature and Rejection History */}
                                    <div className="mt-4 grid grid-cols-2 gap-4">
                                        {selectedOrder.signedBy && (
                                            <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                                                <p className="text-[10px] uppercase font-bold text-blue-800 mb-1">Originally Performed By:</p>
                                                <p className="text-sm font-semibold text-blue-900">
                                                    {selectedOrder.signedBy.name}
                                                </p>
                                                <p className="text-[10px] text-blue-700">
                                                    {new Date(selectedOrder.signedAt).toLocaleString()}
                                                </p>
                                            </div>
                                        )}
                                        {selectedOrder.status === 'rejected' && selectedOrder.rejectedBy && (
                                            <div className="p-3 bg-red-50 border border-red-200 rounded">
                                                <p className="text-[10px] uppercase font-bold text-red-800 mb-1">Rejected By:</p>
                                                <p className="text-sm font-semibold text-red-900">
                                                    {typeof selectedOrder.rejectedBy === 'object' && selectedOrder.rejectedBy?.name
                                                        ? selectedOrder.rejectedBy.name
                                                        : (selectedOrder.rejectedBy === user._id ? user.name : 'Abubakar Nuhu')}
                                                </p>
                                                <p className="text-[10px] text-red-700">
                                                    {selectedOrder.rejectedAt ? new Date(selectedOrder.rejectedAt).toLocaleString() : ''}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                    {selectedOrder.lastModifiedBy && (
                                        <p className="text-xs text-orange-700 mt-2 text-center">
                                            Last modified by: {selectedOrder.lastModifiedBy.name} on {new Date(selectedOrder.lastModifiedAt).toLocaleString()}
                                        </p>
                                    )}
                                </div>

                                {selectedOrder.result && (
                                    <div className="flex gap-2 mb-4">
                                        <button
                                            onClick={() => setViewResultModal(selectedOrder)}
                                            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center gap-2"
                                        >
                                            <FaFileAlt /> View Result
                                        </button>
                                        <button
                                            onClick={() => handleUniversalPrint(selectedOrder)}
                                            className="flex-1 bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center justify-center gap-2"
                                        >
                                            <FaFileAlt /> Print Result
                                        </button>
                                    </div>
                                )}

                                <button
                                    onClick={handleSaveResults}
                                    className="w-full bg-green-600 text-white px-6 py-3 rounded hover:bg-green-700 font-bold flex items-center justify-center gap-2"
                                >
                                    <FaSave /> {selectedOrder.result ? 'Update & Re-sign Results' : 'Save & Sign Results'}
                                </button>
                                <p className="text-xs text-gray-600 mt-2 text-center">
                                    {selectedOrder.result ? (
                                        <span className="text-orange-600 font-semibold">⚠️ Editing will update the signature timestamp</span>
                                    ) : (
                                        <span>By saving, you are electronically signing these results as {user.name}</span>
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                )
            }


            {/* View Result Modal */}
            {
                viewResultModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
                        <div className="bg-white rounded-lg p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold">Lab Result</h3>
                                <button onClick={() => setViewResultModal(null)} className="text-gray-500 hover:text-gray-700">
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            {/* PRINT AREA START */}
                            <div ref={resultRef} className="print-area">
                                <div className="text-center mb-6">
                                    {systemSettings?.hospitalLogo && (
                                        <img src={systemSettings.hospitalLogo} alt="Logo" className="h-32 mx-auto mb-0 object-contain" />
                                    )}
                                    <h1 className="text-3xl font-bold text-gray-800 m-0">{systemSettings?.reportHeader || 'Laboratory Report'}</h1>
                                    <p className="text-sm text-gray-600 mt-2">{systemSettings?.address || 'Hospital Name'}</p>
                                    <p className="text-sm text-gray-600">
                                        {systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                                        {systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                                        {systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                                    </p>
                                    <h2 className="text-xl font-semibold mt-4 border-t pt-2">LABORATORY REPORT</h2>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                                    <div>
                                        <p><strong>Patient Name:</strong> {viewResultModal.patient?.name}</p>
                                        <p><strong>MRN:</strong> {viewResultModal.patient?.mrn}</p>
                                        <p><strong>Age:</strong> {viewResultModal.patient?.age || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p><strong>Test Name:</strong> {viewResultModal.testName}</p>
                                        <p><strong>Date Ordered:</strong> {new Date(viewResultModal.createdAt).toLocaleDateString()}</p>
                                        <p><strong>Gender:</strong> {viewResultModal.patient?.gender || 'N/A'}</p>
                                    </div>
                                </div>

                                {viewResultModal.clinicalDetails && (
                                    <div className="mb-6 p-4 bg-gray-50 border-l-4 border-gray-400 text-sm italic">
                                        <p className="font-bold text-gray-700 not-italic mb-1">Clinical Detail:</p>
                                        <p>{viewResultModal.clinicalDetails}</p>
                                    </div>
                                )}

                                <div className="border-t border-b border-gray-300 py-4 mb-6">
                                    <h3 className="font-bold text-lg mb-3">Test Results:</h3>
                                    {(() => {
                                        try {
                                            const parsed = JSON.parse(viewResultModal.result);
                                            if (parsed.format === 'table' && Array.isArray(parsed.parameters)) {
                                                return (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full border-collapse">
                                                            <thead className="bg-gray-100">
                                                                <tr>
                                                                    <th className="text-left p-3 font-semibold border">Parameter</th>
                                                                    <th className="text-left p-3 font-semibold border w-32">Value</th>
                                                                    <th className="text-left p-3 font-semibold border w-24">Unit</th>
                                                                    <th className="text-left p-3 font-semibold border w-40">Normal Range</th>
                                                                    <th className="text-center p-3 font-semibold border w-24">Status</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {parsed.parameters.map((param, index) => {
                                                                    const rangeStatus = checkRange(param.value, param.normalRange);
                                                                    const colorClass = getRangeColorClass(rangeStatus);

                                                                    return (
                                                                        <tr key={index} className={`${param.value ? colorClass : ''} border`}>
                                                                            <td className="p-3 font-medium border">{param.name}</td>
                                                                            <td className="p-3 font-semibold border">{param.value || '-'}</td>
                                                                            <td className="p-3 text-gray-600 border">{param.unit}</td>
                                                                            <td className="p-3 text-gray-600 border">{param.normalRange}</td>
                                                                            <td className="p-3 text-center border">
                                                                                {param.value && (
                                                                                    <span className={`text-xs px-2 py-1 rounded font-semibold ${rangeStatus === 'low' ? 'bg-orange-200 text-orange-900' :
                                                                                        rangeStatus === 'high' ? 'bg-red-200 text-red-900' :
                                                                                            'bg-green-200 text-green-900'
                                                                                        }`}>
                                                                                        {rangeStatus === 'low' ? '↓ LOW' :
                                                                                            rangeStatus === 'high' ? '↑ HIGH' :
                                                                                                (param.name.toLowerCase().trim().includes('blood group') || param.name.toLowerCase().trim().includes('genotype')) ? '' : '✓ Normal'}
                                                                                    </span>
                                                                                )}
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            }
                                        } catch (e) {
                                            // Not JSON - try to parse as text-to-table
                                            const parsedParams = parseTextTemplate(viewResultModal.result);
                                            if (parsedParams.length > 0) {
                                                return (
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full border-collapse">
                                                            <thead className="bg-gray-100">
                                                                <tr>
                                                                    <th className="text-left p-3 font-semibold border">Parameter</th>
                                                                    <th className="text-left p-3 font-semibold border w-48">Result</th>
                                                                    <th className="text-left p-3 font-semibold border w-48">Normal Range</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {parsedParams.map((param, index) => (
                                                                    <tr key={index} className="border hover:bg-gray-50">
                                                                        <td className="p-3 font-medium border">{param.name}</td>
                                                                        <td className="p-3 font-semibold border">{param.value || '-'}</td>
                                                                        <td className="p-3 text-gray-600 border">{param.normalRange}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                );
                                            }
                                        }
                                        return (
                                            <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 p-4 rounded">
                                                {viewResultModal.result}
                                            </pre>
                                        );
                                    })()}
                                </div>

                                <div className="mt-8 pt-6 border-t-2 border-gray-800">
                                    <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Audit Trail & Electronic Signatures</h4>
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {viewResultModal.signedBy && (
                                            <div className="p-3 bg-blue-50 border border-blue-100 rounded">
                                                <p className="text-[9px] font-bold text-blue-700 uppercase mb-1">Performed By</p>
                                                <p className="text-sm font-semibold">{viewResultModal.signedBy.name}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(viewResultModal.signedAt).toLocaleString()}</p>
                                            </div>
                                        )}
                                        {viewResultModal.rejectedBy && (
                                            <div className="p-3 bg-red-50 border border-red-100 rounded">
                                                <p className="text-[9px] font-bold text-red-700 uppercase mb-1">Rejected By</p>
                                                <p className="text-sm font-semibold">
                                                    {viewResultModal.rejectedBy?.name || (viewResultModal.rejectedBy === user._id ? user.name : 'Abubakar Nuhu')}
                                                </p>
                                                <p className="text-[10px] text-red-500 italic mb-1">Reason: {viewResultModal.rejectionReason}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(viewResultModal.rejectedAt).toLocaleString()}</p>
                                            </div>
                                        )}
                                        {viewResultModal.lastModifiedBy && (
                                            <div className="p-3 bg-amber-50 border border-amber-100 rounded">
                                                <p className="text-[9px] font-bold text-amber-700 uppercase mb-1">Last Edited By</p>
                                                <p className="text-sm font-semibold">{viewResultModal.lastModifiedBy.name}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(viewResultModal.lastModifiedAt).toLocaleString()}</p>
                                            </div>
                                        )}
                                        {viewResultModal.approvedBy && (
                                            <div className="p-3 bg-green-50 border border-green-100 rounded">
                                                <p className="text-[9px] font-bold text-green-700 uppercase mb-1">Verified & Approved By</p>
                                                <p className="text-sm font-semibold">{viewResultModal.approvedBy.name}</p>
                                                <p className="text-[10px] text-gray-500">{new Date(viewResultModal.approvedAt).toLocaleString()}</p>
                                            </div>
                                        )}
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
                                    Print
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
                )
            }

            {/* Edit Result Modal */}
            {
                editResultModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-bold">Edit Lab Result</h3>
                                <button onClick={() => setEditResultModal(null)} className="text-gray-500 hover:text-gray-700">
                                    <FaTimes size={24} />
                                </button>
                            </div>

                            <div className="mb-4">
                                <p className="text-sm text-gray-600 mb-2">
                                    <strong>Test:</strong> {editResultModal.testName}
                                </p>
                                <p className="text-sm text-gray-600 mb-2">
                                    <strong>Patient:</strong> {editResultModal.patient?.name} (MRN: {editResultModal.patient?.mrn})
                                </p>
                                {editResultModal.approvedBy && (
                                    <div className="bg-yellow-50 border border-yellow-200 p-3 rounded mb-4">
                                        <p className="text-sm text-yellow-800">
                                            ⚠️ <strong>Warning:</strong> This result has been approved by {editResultModal.approvedBy.name}.
                                            Editing will require re-approval.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="mb-6">
                                <label className="block text-gray-700 mb-2 font-semibold flex items-center gap-2">
                                    <FaEdit /> Lab Results
                                </label>

                                {isEditTableFormat ? (
                                    <div className="border rounded overflow-hidden">
                                        <table className="w-full">
                                            <thead className="bg-gray-100">
                                                <tr>
                                                    <th className="text-left p-3 font-semibold border-b">Parameter</th>
                                                    <th className="text-left p-3 font-semibold border-b w-32">Value</th>
                                                    <th className="text-left p-3 font-semibold border-b w-24">Unit</th>
                                                    <th className="text-left p-3 font-semibold border-b w-40">Normal Range</th>
                                                    <th className="text-left p-3 font-semibold border-b w-24">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {editTableResults.map((param, index) => {
                                                    const rangeStatus = checkRange(param.value, param.normalRange);
                                                    const colorClass = getRangeColorClass(rangeStatus);

                                                    return (
                                                        <tr key={index} className={`border-b ${param.value ? colorClass : ''}`}>
                                                            <td className="p-3 font-medium">{param.name}</td>
                                                            <td className="p-2">
                                                                <input
                                                                    type="text"
                                                                    value={param.value}
                                                                    onChange={(e) => {
                                                                        const newResults = [...editTableResults];
                                                                        newResults[index].value = e.target.value;
                                                                        setEditTableResults(newResults);
                                                                    }}
                                                                    className="w-full border p-2 rounded text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                                    placeholder="Enter value"
                                                                />
                                                            </td>
                                                            <td className="p-3 text-sm text-gray-600">{param.unit}</td>
                                                            <td className="p-3 text-sm text-gray-600">{param.normalRange}</td>
                                                            <td className="p-3">
                                                                {param.value && (
                                                                    <span className={`text-xs px-2 py-1 rounded font-semibold ${rangeStatus === 'low' ? 'bg-orange-200 text-orange-900' :
                                                                        rangeStatus === 'high' ? 'bg-red-200 text-red-900' :
                                                                            'bg-green-200 text-green-900'
                                                                        }`}>
                                                                        {rangeStatus === 'low' ? '↓ LOW' :
                                                                            rangeStatus === 'high' ? 'High' :
                                                                                (param.name.toLowerCase().trim().includes('blood group') || param.name.toLowerCase().trim().includes('genotype')) ? '' : '✓ Normal'}
                                                                    </span>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <textarea
                                        className="w-full border p-3 rounded font-mono text-sm"
                                        rows="20"
                                        value={editResults}
                                        onChange={(e) => setEditResults(e.target.value)}
                                        placeholder="Enter lab test results here..."
                                    ></textarea>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleEditResult}
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
                                <span className="text-orange-600 font-semibold">⚠️ Editing will update the signature timestamp and reset approval status</span>
                            </p>
                        </div>
                    </div>
                )
            }

        </Layout >
    );
};

export default LabDashboard;
