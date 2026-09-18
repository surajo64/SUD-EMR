import React, { useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';
import Layout from '../components/Layout';
import { toast } from 'react-toastify';
import { checkRange } from '../utils/labUtils';
import {
    FaFlask,
    FaMicroscope,
    FaSearch,
    FaPrint,
    FaEye,
    FaTimes,
    FaCalendarAlt,
    FaFilter,
    FaSync,
    FaUser,
    FaCheckCircle,
    FaIdCard,
    FaHospital,
    FaClock,
    FaFileAlt,
    FaExternalLinkAlt
} from 'react-icons/fa';

const InvestigationResults = () => {
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);

    const [loading, setLoading] = useState(true);
    const [labOrders, setLabOrders] = useState([]);
    const [radiologyOrders, setRadiologyOrders] = useState([]);
    const [systemSettings, setSystemSettings] = useState(null);

    // Filters state
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'lab', 'radiology'
    const [sourceFilter, setSourceFilter] = useState('all');     // 'all', 'internal', 'external'
    const [datePreset, setDatePreset] = useState('all');         // 'all', 'today', 'yesterday', 'week', 'month', 'custom'
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Modal state for viewing report
    const [selectedItem, setSelectedItem] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    // Helper: Parse text template into rows when lab result is not JSON
    const parseTextTemplate = (template) => {
        if (!template) return [];
        const lines = template.split('\n');
        const params = [];

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Section headers
            if (!trimmed.startsWith('-') && trimmed.endsWith(':')) {
                const sectionName = trimmed.slice(0, -1).trim();
                if (sectionName.length > 0) {
                    params.push({ type: 'section', name: sectionName, value: '', unit: '', normalRange: '' });
                    continue;
                }
            }

            const match = trimmed.match(/^-\s*([^:]+):\s*(.*?)(?:\s*\(?(?:Normal:\s*)?([^)]*)\)?)?$/);
            if (match) {
                const name = match[1].trim();
                let fullValue = match[2].trim();
                const normalRange = (match[3] || '').trim();

                const valueMatch = fullValue.match(/^_*([^_]*)_*$/);
                const value = valueMatch ? valueMatch[1].trim() : fullValue;

                params.push({
                    name,
                    value: value === '_____' ? '' : value,
                    unit: '',
                    normalRange
                });
            }
        }
        return params;
    };

    // Helper to check if an investigation is external
    const isExternalOrder = (order) => {
        const visitType = order.visit?.type || '';
        return (
            visitType.toLowerCase().includes('external') ||
            order.patient?.isWalkIn === true ||
            visitType === 'External Lab' ||
            visitType === 'External Radiology' ||
            visitType === 'External Investigation' ||
            visitType === 'External Lab/Radiology'
        );
    };

    // Fetch system settings
    const fetchSettings = async () => {
        try {
            const { data } = await axios.get(`${backendUrl}/api/settings`);
            setSystemSettings(data);
        } catch (error) {
            console.error('Error fetching settings:', error);
        }
    };

    // Fetch orders
    const fetchOrders = async () => {
        if (!user?.token) return;
        setLoading(true);
        const config = { headers: { Authorization: `Bearer ${user.token}` } };

        try {
            const [labRes, radRes] = await Promise.all([
                axios.get(`${backendUrl}/api/lab`, config),
                axios.get(`${backendUrl}/api/radiology`, config)
            ]);

            // Keep only completed orders
            const completedLabs = (labRes.data || []).filter(o => o.status === 'completed');
            const completedRads = (radRes.data || []).filter(o => o.status === 'completed');

            setLabOrders(completedLabs);
            setRadiologyOrders(completedRads);
        } catch (error) {
            console.error('Error fetching investigation orders:', error);
            toast.error('Failed to load investigation results');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
        fetchOrders();
    }, [user?.token, backendUrl]);

    // Unify orders into standard format
    const unifiedOrders = useMemo(() => {
        const labItems = labOrders.map(order => ({
            id: order._id,
            category: 'lab',
            categoryLabel: 'Laboratory',
            testName: order.testName,
            patient: order.patient,
            doctor: order.doctor,
            visit: order.visit,
            charge: order.charge,
            createdAt: order.createdAt,
            completedAt: order.approvedAt || order.signedAt || order.updatedAt || order.createdAt,
            signedBy: order.signedBy,
            approvedBy: order.approvedBy,
            status: order.status,
            clinicalDetails: order.clinicalDetails,
            notes: order.notes,
            result: order.result,
            isExternal: isExternalOrder(order),
            sourceLabel: isExternalOrder(order) ? 'External' : 'Internal',
            raw: order
        }));

        const radItems = radiologyOrders.map(order => ({
            id: order._id,
            category: 'radiology',
            categoryLabel: 'Radiology',
            testName: order.scanType,
            patient: order.patient,
            doctor: order.doctor,
            visit: order.visit,
            charge: order.charge,
            createdAt: order.createdAt,
            completedAt: order.reportDate || order.updatedAt || order.createdAt,
            signedBy: order.signedBy,
            approvedBy: null,
            status: order.status,
            clinicalDetails: order.notes,
            report: order.report || order.notes,
            images: order.images || [],
            resultImage: order.resultImage,
            isExternal: isExternalOrder(order),
            sourceLabel: isExternalOrder(order) ? 'External' : 'Internal',
            raw: order
        }));

        return [...labItems, ...radItems].sort(
            (a, b) => new Date(b.completedAt) - new Date(a.completedAt)
        );
    }, [labOrders, radiologyOrders]);

    // Apply filtering
    const filteredOrders = useMemo(() => {
        return unifiedOrders.filter(item => {
            // Category filter
            if (categoryFilter !== 'all' && item.category !== categoryFilter) {
                return false;
            }

            // Source filter
            if (sourceFilter === 'internal' && item.isExternal) return false;
            if (sourceFilter === 'external' && !item.isExternal) return false;

            // Date filter
            if (datePreset !== 'all') {
                const itemDate = new Date(item.completedAt || item.createdAt);
                const now = new Date();

                if (datePreset === 'today') {
                    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (itemDate < todayStart) return false;
                } else if (datePreset === 'yesterday') {
                    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
                    const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    if (itemDate < yesterdayStart || itemDate >= yesterdayEnd) return false;
                } else if (datePreset === 'week') {
                    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    if (itemDate < weekAgo) return false;
                } else if (datePreset === 'month') {
                    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    if (itemDate < monthAgo) return false;
                } else if (datePreset === 'custom') {
                    if (startDate) {
                        const start = new Date(startDate);
                        start.setHours(0, 0, 0, 0);
                        if (itemDate < start) return false;
                    }
                    if (endDate) {
                        const end = new Date(endDate);
                        end.setHours(23, 59, 59, 999);
                        if (itemDate > end) return false;
                    }
                }
            }

            // Text search
            if (searchTerm.trim()) {
                const s = searchTerm.toLowerCase().trim();
                const patientName = (item.patient?.name || '').toLowerCase();
                const mrn = String(item.patient?.mrn || '').toLowerCase();
                const contact = (item.patient?.contact || '').toLowerCase();
                const testName = (item.testName || '').toLowerCase();
                const doctorName = (item.doctor?.name || '').toLowerCase();
                const signedByName = (item.signedBy?.name || '').toLowerCase();
                const approvedByName = (item.approvedBy?.name || '').toLowerCase();

                const matches =
                    patientName.includes(s) ||
                    mrn.includes(s) ||
                    contact.includes(s) ||
                    testName.includes(s) ||
                    doctorName.includes(s) ||
                    signedByName.includes(s) ||
                    approvedByName.includes(s);

                if (!matches) return false;
            }

            return true;
        });
    }, [unifiedOrders, categoryFilter, sourceFilter, datePreset, startDate, endDate, searchTerm]);

    // Statistics counts
    const stats = useMemo(() => {
        const total = unifiedOrders.length;
        const labs = unifiedOrders.filter(o => o.category === 'lab').length;
        const rads = unifiedOrders.filter(o => o.category === 'radiology').length;
        const internal = unifiedOrders.filter(o => !o.isExternal).length;
        const external = unifiedOrders.filter(o => o.isExternal).length;

        return { total, labs, rads, internal, external };
    }, [unifiedOrders]);

    // Universal Print Method
    const handlePrint = (item) => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            toast.error('Please allow popups in your browser to print the report.');
            return;
        }

        const isLab = item.category === 'lab';
        const title = isLab
            ? `Laboratory Report - ${item.testName}`
            : `Radiology Report - ${item.testName}`;

        const logoHtml = systemSettings?.hospitalLogo
            ? `<img src="${systemSettings.hospitalLogo}" style="height: 120px; max-width: 240px; object-fit: contain; margin-bottom: 5px;" />`
            : '';

        let resultsBodyHtml = '';

        if (isLab) {
            // Lab result parsing
            let renderedLabContent = '';
            try {
                const parsed = JSON.parse(item.result);
                if (parsed.format === 'table' && Array.isArray(parsed.parameters)) {
                    renderedLabContent = `
                        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
                            <thead>
                                <tr style="background: #f3f4f6;">
                                    <th style="text-align: left; padding: 10px; border: 1px solid #d1d5db; font-weight: 600;">Parameter</th>
                                    <th style="text-align: left; padding: 10px; border: 1px solid #d1d5db; font-weight: 600; width: 130px;">Result</th>
                                    <th style="text-align: left; padding: 10px; border: 1px solid #d1d5db; font-weight: 600; width: 100px;">Unit</th>
                                    <th style="text-align: left; padding: 10px; border: 1px solid #d1d5db; font-weight: 600; width: 150px;">Reference Range</th>
                                    <th style="text-align: center; padding: 10px; border: 1px solid #d1d5db; font-weight: 600; width: 85px;">Flag</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${parsed.parameters.map(param => {
                                    if (param.type === 'section') {
                                        return `
                                            <tr>
                                                <td colspan="5" style="padding: 8px 10px; background: #ede9fe; font-weight: bold; color: #5b21b6; text-transform: uppercase; letter-spacing: 0.05em; font-size: 11px; border: 1px solid #d1d5db;">
                                                    ${param.name}
                                                </td>
                                            </tr>
                                        `;
                                    }

                                    const rangeStatus = checkRange(param.value, param.normalRange);
                                    let bgColor = '#ffffff';
                                    let statusText = '';
                                    let statusColor = '#374151';

                                    if (param.value) {
                                        if (rangeStatus === 'low') {
                                            bgColor = '#fff7ed';
                                            statusText = '↓ LOW';
                                            statusColor = '#c2410c';
                                        } else if (rangeStatus === 'high') {
                                            bgColor = '#fef2f2';
                                            statusText = '↑ HIGH';
                                            statusColor = '#b91c1c';
                                        } else {
                                            bgColor = '#f0fdf4';
                                            statusText = 'Normal';
                                            statusColor = '#15803d';
                                        }
                                    }

                                    return `
                                        <tr style="background: ${bgColor};">
                                            <td style="padding: 8px 10px; border: 1px solid #d1d5db; font-weight: 500;">${param.name}</td>
                                            <td style="padding: 8px 10px; border: 1px solid #d1d5db; font-weight: 600;">${param.value || '-'}</td>
                                            <td style="padding: 8px 10px; border: 1px solid #d1d5db; color: #6b7280;">${param.unit || ''}</td>
                                            <td style="padding: 8px 10px; border: 1px solid #d1d5db; color: #6b7280;">${param.normalRange || ''}</td>
                                            <td style="padding: 8px 10px; border: 1px solid #d1d5db; text-align: center; font-weight: 700; font-size: 11px; color: ${statusColor};">
                                                ${param.value ? statusText : ''}
                                            </td>
                                        </tr>
                                    `;
                                }).join('')}
                            </tbody>
                        </table>
                    `;
                } else {
                    renderedLabContent = `<div style="background: #f9fafb; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-family: monospace; font-size: 13px; border: 1px solid #e5e7eb;">${item.result}</div>`;
                }
            } catch (e) {
                // Not JSON, parse text template
                const parsedParams = parseTextTemplate(item.result);
                if (parsedParams.length > 0) {
                    renderedLabContent = `
                        <table style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px;">
                            <thead>
                                <tr style="background: #f3f4f6;">
                                    <th style="text-align: left; padding: 10px; border: 1px solid #d1d5db; font-weight: 600;">Parameter</th>
                                    <th style="text-align: left; padding: 10px; border: 1px solid #d1d5db; font-weight: 600; width: 220px;">Result</th>
                                    <th style="text-align: left; padding: 10px; border: 1px solid #d1d5db; font-weight: 600; width: 180px;">Reference Range</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${parsedParams.map(param => `
                                    <tr>
                                        <td style="padding: 8px 10px; border: 1px solid #d1d5db; font-weight: 500;">${param.name}</td>
                                        <td style="padding: 8px 10px; border: 1px solid #d1d5db; font-weight: 600;">${param.value || '-'}</td>
                                        <td style="padding: 8px 10px; border: 1px solid #d1d5db; color: #6b7280;">${param.normalRange || ''}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `;
                } else {
                    renderedLabContent = `<div style="background: #f9fafb; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-family: monospace; font-size: 13px; border: 1px solid #e5e7eb;">${item.result || 'No test results documented.'}</div>`;
                }
            }

            resultsBodyHtml = `
                <div class="results-section">
                    <h3 style="font-size: 16px; margin: 0 0 10px 0; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">Laboratory Test Results</h3>
                    ${renderedLabContent}
                </div>
            `;
        } else {
            // Radiology result
            resultsBodyHtml = `
                <div class="results-section">
                    <h3 style="font-size: 16px; margin: 0 0 10px 0; color: #1f2937; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px;">Findings & Clinical Impression</h3>
                    <div style="background: #f9fafb; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; line-height: 1.6; border: 1px solid #e5e7eb; color: #1f2937;">
                        ${item.report || 'No formal report text documented.'}
                    </div>

                    ${item.images && item.images.length > 0 ? `
                        <div style="margin-top: 25px;">
                            <h4 style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em;">Attached Diagnostic Images</h4>
                            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px;">
                                ${item.images.map(img => `
                                    <div style="border: 1px solid #d1d5db; padding: 8px; border-radius: 6px; background: #fafafa; text-align: center;">
                                        <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: bold; color: #1d4ed8;">${img.name || 'Imaging View'}</p>
                                        <img src="${backendUrl}/${img.path}" alt="${img.name}" style="width: 100%; max-height: 260px; object-fit: contain; background: #000; border-radius: 4px;" />
                                        <p style="margin: 4px 0 0 0; font-size: 10px; color: #6b7280;">Uploaded: ${new Date(img.uploadedAt).toLocaleString()}</p>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}

                    ${item.resultImage ? `
                        <div style="margin-top: 15px; font-size: 12px; color: #4b5563;">
                            <strong>Image Reference:</strong> ${item.resultImage}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        const printContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>${title}</title>
                    <meta charset="utf-8" />
                    <style>
                        @page {
                            margin: 15mm 20mm;
                            size: auto;
                        }
                        body {
                            font-family: 'Segoe UI', Arial, sans-serif;
                            margin: 0;
                            padding: 20px;
                            color: #111827;
                            font-size: 13px;
                            line-height: 1.5;
                        }
                        .header {
                            text-align: center;
                            border-bottom: 2px solid #1f2937;
                            padding-bottom: 12px;
                            margin-bottom: 20px;
                        }
                        .header h1 {
                            margin: 0 0 4px 0;
                            font-size: 24px;
                            color: #111827;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                        }
                        .header p {
                            margin: 2px 0;
                            font-size: 12px;
                            color: #4b5563;
                        }
                        .report-title-badge {
                            margin-top: 10px;
                            display: inline-block;
                            padding: 4px 16px;
                            background: #f3f4f6;
                            border: 1px solid #d1d5db;
                            border-radius: 20px;
                            font-weight: 700;
                            font-size: 13px;
                            letter-spacing: 0.05em;
                            text-transform: uppercase;
                        }
                        .info-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 15px;
                            background: #f9fafb;
                            padding: 12px 16px;
                            border: 1px solid #e5e7eb;
                            border-radius: 6px;
                            margin-bottom: 20px;
                        }
                        .info-col p {
                            margin: 4px 0;
                            font-size: 12px;
                        }
                        .info-col p strong {
                            display: inline-block;
                            width: 110px;
                            color: #374151;
                        }
                        .clinical-details {
                            margin-bottom: 20px;
                            padding: 10px 14px;
                            background: #fffbeb;
                            border-left: 4px solid #f59e0b;
                            font-size: 12px;
                            border-radius: 0 6px 6px 0;
                        }
                        .clinical-details p {
                            margin: 0;
                        }
                        .signature-section {
                            margin-top: 30px;
                            padding-top: 15px;
                            border-top: 1px solid #d1d5db;
                            page-break-inside: avoid;
                        }
                        .signature-grid {
                            display: grid;
                            grid-template-columns: repeat(2, 1fr);
                            gap: 15px;
                        }
                        .signature-box {
                            padding: 10px;
                            border: 1px solid #e5e7eb;
                            border-radius: 6px;
                            background: #fafafa;
                        }
                        .footer {
                            margin-top: 30px;
                            text-align: center;
                            font-size: 10px;
                            color: #9ca3af;
                            border-top: 1px dashed #e5e7eb;
                            padding-top: 10px;
                        }
                        @media print {
                            body {
                                padding: 0;
                            }
                            .no-print {
                                display: none !important;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${logoHtml}
                        <h1>${systemSettings?.reportHeader || 'HOSPITAL MEDICAL INVESTIGATION REPORT'}</h1>
                        <p>${systemSettings?.address || ''}</p>
                        <p>
                            ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                            ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                            ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                        </p>
                        <div class="report-title-badge">
                            ${isLab ? 'Laboratory Investigation Report' : 'Radiology & Imaging Report'}
                        </div>
                    </div>

                    <div class="info-grid">
                        <div class="info-col">
                            <p><strong>Patient Name:</strong> ${item.patient?.name || 'Walk-in Customer'}</p>
                            <p><strong>MRN:</strong> ${item.patient?.mrn || 'N/A'}</p>
                            <p><strong>Age / Gender:</strong> ${(item.patient?.age || 'N/A')} / ${(item.patient?.gender || 'N/A')}</p>
                            <p><strong>Contact:</strong> ${item.patient?.contact || 'N/A'}</p>
                        </div>
                        <div class="info-col">
                            <p><strong>Investigation:</strong> ${item.testName}</p>
                            <p><strong>Source:</strong> ${item.sourceLabel} Investigation</p>
                            <p><strong>Date Ordered:</strong> ${new Date(item.createdAt).toLocaleDateString()}</p>
                            <p><strong>Referring Doctor:</strong> ${item.doctor?.name || 'Direct Order / Self'}</p>
                        </div>
                    </div>

                    ${item.clinicalDetails ? `
                        <div class="clinical-details">
                            <p><strong>Clinical Notes / Indications:</strong> ${item.clinicalDetails}</p>
                        </div>
                    ` : ''}

                    ${resultsBodyHtml}

                    <div class="signature-section">
                        <h4 style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: #4b5563;">Verification & Audit Trail</h4>
                        <div class="signature-grid">
                            ${item.signedBy ? `
                                <div class="signature-box">
                                    <p style="margin: 0; font-size: 10px; font-weight: bold; color: #6b7280; text-transform: uppercase;">
                                        ${isLab ? 'Performed By (Technician / Scientist)' : 'Reporting Radiologist'}
                                    </p>
                                    <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #111827;">${item.signedBy.name}</p>
                                    <p style="margin: 2px 0 0 0; font-size: 10px; color: #9ca3af;">${new Date(item.completedAt).toLocaleString()}</p>
                                </div>
                            ` : ''}

                            ${item.approvedBy ? `
                                <div class="signature-box" style="border-color: #86efac; background: #f0fdf4;">
                                    <p style="margin: 0; font-size: 10px; font-weight: bold; color: #166534; text-transform: uppercase;">Verified & Authorized By</p>
                                    <p style="margin: 4px 0 0 0; font-size: 13px; font-weight: 600; color: #14532d;">${item.approvedBy.name}</p>
                                    <p style="margin: 2px 0 0 0; font-size: 10px; color: #22c55e;">Approved: ${new Date(item.raw.approvedAt || item.completedAt).toLocaleString()}</p>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="footer">
                        <p>This is an authentic computer-generated diagnostic document issued by the hospital laboratory & diagnostic imaging department.</p>
                        <p>Printed on ${new Date().toLocaleString()} by ${user?.name || 'Reception Desk'}</p>
                    </div>

                    <script>
                        window.onload = function() {
                            window.focus();
                            setTimeout(function() {
                                window.print();
                            }, 300);
                        };
                    </script>
                </body>
            </html>
        `;

        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();
    };

    return (
        <Layout>
            <div className="space-y-6">
                {/* Top Banner */}
                <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-green-700 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -mr-20 -mt-20 pointer-events-none"></div>
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="p-2 bg-white/20 backdrop-blur-sm rounded-lg">
                                    <FaFileAlt className="text-white text-xl" />
                                </span>
                                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Investigation Results</h1>
                            </div>
                            <p className="text-emerald-100 text-sm max-w-2xl">
                                Search, view, and print completed Laboratory and Radiology test reports for both internal hospital patients and external walk-in investigations.
                            </p>
                            <p className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-semibold backdrop-blur-sm border border-white/20">
                                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse"></span>
                                Read-Only Access • Official Print Authorization
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={fetchOrders}
                                disabled={loading}
                                className="px-4 py-2.5 bg-white text-emerald-800 rounded-xl hover:bg-emerald-50 transition shadow-sm flex items-center gap-2 text-sm font-bold disabled:opacity-50"
                            >
                                <FaSync className={loading ? 'animate-spin' : ''} />
                                Refresh Results
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Highlights */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">All Completed</p>
                        <h3 className="text-2xl font-black text-gray-800 mt-1">{stats.total}</h3>
                        <p className="text-[11px] text-gray-500 mt-1">Ready for print</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-purple-500">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-purple-600 uppercase tracking-wider">Laboratory</p>
                            <FaFlask className="text-purple-400" />
                        </div>
                        <h3 className="text-2xl font-black text-purple-900 mt-1">{stats.labs}</h3>
                        <p className="text-[11px] text-gray-500 mt-1">Completed tests</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-blue-500">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Radiology</p>
                            <FaMicroscope className="text-blue-400" />
                        </div>
                        <h3 className="text-2xl font-black text-blue-900 mt-1">{stats.rads}</h3>
                        <p className="text-[11px] text-gray-500 mt-1">Scans & reports</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-green-500">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-green-600 uppercase tracking-wider">Internal</p>
                            <FaHospital className="text-green-400" />
                        </div>
                        <h3 className="text-2xl font-black text-green-900 mt-1">{stats.internal}</h3>
                        <p className="text-[11px] text-gray-500 mt-1">In-house patients</p>
                    </div>
                    <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm border-l-4 border-l-amber-500 col-span-2 md:col-span-1">
                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">External</p>
                            <FaExternalLinkAlt className="text-amber-400" />
                        </div>
                        <h3 className="text-2xl font-black text-amber-900 mt-1">{stats.external}</h3>
                        <p className="text-[11px] text-gray-500 mt-1">Walk-in / Outside</p>
                    </div>
                </div>

                {/* Filter and Search Card */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-200 space-y-4">
                    {/* Top Row: Search Input */}
                    <div className="flex flex-col md:flex-row items-center gap-3">
                        <div className="relative flex-1 w-full">
                            <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by patient name, MRN, phone, test/scan name, doctor or technician..."
                                className="w-full pl-11 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm transition"
                            />
                            {searchTerm && (
                                <button
                                    onClick={() => setSearchTerm('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                >
                                    <FaTimes />
                                </button>
                            )}
                        </div>

                        {/* Preset Date Filter */}
                        <div className="flex items-center gap-1 w-full md:w-auto bg-gray-50 p-1 rounded-xl border border-gray-200 overflow-x-auto">
                            {[
                                { id: 'all', label: 'All Dates' },
                                { id: 'today', label: 'Today' },
                                { id: 'yesterday', label: 'Yesterday' },
                                { id: 'week', label: 'Last 7 Days' },
                                { id: 'month', label: 'Last 30 Days' },
                                { id: 'custom', label: 'Custom' }
                            ].map(preset => (
                                <button
                                    key={preset.id}
                                    onClick={() => setDatePreset(preset.id)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                                        datePreset === preset.id
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-gray-600 hover:bg-gray-200/60'
                                    }`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Custom Date Range Row (if selected) */}
                    {datePreset === 'custom' && (
                        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
                            <span className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
                                <FaCalendarAlt /> Date Range:
                            </span>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                                <span className="text-xs text-gray-400">to</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>
                            {(startDate || endDate) && (
                                <button
                                    onClick={() => { setStartDate(''); setEndDate(''); }}
                                    className="text-xs text-red-500 hover:underline"
                                >
                                    Clear dates
                                </button>
                            )}
                        </div>
                    )}

                    {/* Filter Pills Row: Category & Source */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                        {/* Investigation Type (Category) */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Type:</span>
                            <button
                                onClick={() => setCategoryFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                    categoryFilter === 'all'
                                        ? 'bg-gray-800 text-white shadow-sm'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                All Investigations ({unifiedOrders.length})
                            </button>
                            <button
                                onClick={() => setCategoryFilter('lab')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                    categoryFilter === 'lab'
                                        ? 'bg-purple-600 text-white shadow-sm'
                                        : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                                }`}
                            >
                                <FaFlask size={11} /> Laboratory ({stats.labs})
                            </button>
                            <button
                                onClick={() => setCategoryFilter('radiology')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                    categoryFilter === 'radiology'
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                }`}
                            >
                                <FaMicroscope size={11} /> Radiology ({stats.rads})
                            </button>
                        </div>

                        {/* Investigation Source: Internal vs External */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Source:</span>
                            <button
                                onClick={() => setSourceFilter('all')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                                    sourceFilter === 'all'
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                Both Sources
                            </button>
                            <button
                                onClick={() => setSourceFilter('internal')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                    sourceFilter === 'internal'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-green-50 text-green-700 hover:bg-green-100'
                                }`}
                            >
                                <FaHospital size={11} /> Internal ({stats.internal})
                            </button>
                            <button
                                onClick={() => setSourceFilter('external')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                                    sourceFilter === 'external'
                                        ? 'bg-amber-600 text-white'
                                        : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                }`}
                            >
                                <FaExternalLinkAlt size={10} /> External ({stats.external})
                            </button>
                        </div>
                    </div>
                </div>

                {/* Results Table Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
                        <div className="flex items-center gap-2">
                            <h2 className="font-bold text-gray-800 text-base">Completed Results List</h2>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                {filteredOrders.length} {filteredOrders.length === 1 ? 'Result' : 'Results'}
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 hidden sm:block">
                            Select <strong>View</strong> to preview report on screen or <strong>Print</strong> for official printed paper.
                        </p>
                    </div>

                    {loading ? (
                        <div className="p-16 text-center">
                            <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent mb-3"></div>
                            <p className="text-gray-500 font-medium">Loading completed results...</p>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="p-16 text-center">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                                <FaSearch size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-gray-700 mb-1">No Completed Results Found</h3>
                            <p className="text-sm text-gray-500 max-w-md mx-auto">
                                No completed investigations match your search or filter parameters. Try clearing the search query or adjusting the date range.
                            </p>
                            {(searchTerm || categoryFilter !== 'all' || sourceFilter !== 'all' || datePreset !== 'all') && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setCategoryFilter('all');
                                        setSourceFilter('all');
                                        setDatePreset('all');
                                    }}
                                    className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition"
                                >
                                    Reset All Filters
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-xs uppercase font-bold border-b border-gray-200">
                                        <th className="py-3.5 px-4">Patient Demographics</th>
                                        <th className="py-3.5 px-4">Investigation Details</th>
                                        <th className="py-3.5 px-4">Source</th>
                                        <th className="py-3.5 px-4">Completed Date</th>
                                        <th className="py-3.5 px-4">Signer / Approver</th>
                                        <th className="py-3.5 px-4 text-right">Actions (Print Only)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 text-sm">
                                    {filteredOrders.map((item) => {
                                        const isLab = item.category === 'lab';
                                        return (
                                            <tr
                                                key={item.id}
                                                className="hover:bg-emerald-50/40 transition group cursor-pointer"
                                                onClick={() => setSelectedItem(item)}
                                            >
                                                {/* Patient Info */}
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                                                            isLab ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                            {item.patient?.name ? item.patient.name.charAt(0).toUpperCase() : 'W'}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 group-hover:text-emerald-700 transition">
                                                                {item.patient?.name || 'Walk-in Customer'}
                                                            </p>
                                                            <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                                                                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[11px] font-semibold text-gray-700">
                                                                    {item.patient?.mrn || 'WALK-IN'}
                                                                </span>
                                                                <span>•</span>
                                                                <span>{item.patient?.gender || 'N/A'}</span>
                                                                {item.patient?.age ? (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span>{item.patient.age} yrs</span>
                                                                    </>
                                                                ) : null}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Investigation Details */}
                                                <td className="py-3.5 px-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wide ${
                                                            isLab
                                                                ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                                                : 'bg-blue-100 text-blue-800 border border-blue-200'
                                                        }`}>
                                                            {isLab ? 'Lab' : 'Radiology'}
                                                        </span>
                                                        <span className="font-bold text-gray-800 text-sm">
                                                            {item.testName}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Ordered by: <span className="text-gray-600 font-medium">{item.doctor?.name || 'Direct / Walk-in'}</span>
                                                    </p>
                                                </td>

                                                {/* Source */}
                                                <td className="py-3.5 px-4">
                                                    {item.isExternal ? (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                                            <FaExternalLinkAlt size={10} />
                                                            External
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200">
                                                            <FaHospital size={11} />
                                                            Internal
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Completed Date */}
                                                <td className="py-3.5 px-4">
                                                    <p className="text-gray-900 font-semibold text-xs">
                                                        {new Date(item.completedAt).toLocaleDateString(undefined, {
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric'
                                                        })}
                                                    </p>
                                                    <p className="text-gray-400 text-[11px] mt-0.5">
                                                        {new Date(item.completedAt).toLocaleTimeString([], {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </p>
                                                </td>

                                                {/* Signer / Approver */}
                                                <td className="py-3.5 px-4">
                                                    {item.approvedBy ? (
                                                        <div>
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                                                                <FaCheckCircle className="text-emerald-500" size={12} />
                                                                {item.approvedBy.name}
                                                            </span>
                                                            <p className="text-[10px] text-gray-400">Approved & Verified</p>
                                                        </div>
                                                    ) : item.signedBy ? (
                                                        <div>
                                                            <p className="text-xs font-medium text-gray-800">{item.signedBy.name}</p>
                                                            <p className="text-[10px] text-gray-400">Performed / Signed</p>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-gray-400 italic">Signed</span>
                                                    )}
                                                </td>

                                                {/* Actions: View & Print */}
                                                <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setSelectedItem(item)}
                                                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
                                                            title="Preview report on screen"
                                                        >
                                                            <FaEye size={12} />
                                                            View
                                                        </button>
                                                        <button
                                                            onClick={() => handlePrint(item)}
                                                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                                                            title="Print official report"
                                                        >
                                                            <FaPrint size={12} />
                                                            Print
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* View Result Modal (On-Screen Preview) */}
                {selectedItem && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-150">
                            {/* Modal Header */}
                            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-emerald-50/40">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                        selectedItem.category === 'lab'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-blue-100 text-blue-700'
                                    }`}>
                                        {selectedItem.category === 'lab' ? <FaFlask size={18} /> : <FaMicroscope size={18} />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-gray-900">
                                                {selectedItem.testName}
                                            </h3>
                                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                                selectedItem.isExternal
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-green-100 text-green-800'
                                            }`}>
                                                {selectedItem.sourceLabel}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500">
                                            Patient: <strong>{selectedItem.patient?.name || 'Walk-in'}</strong> • MRN: <strong>{selectedItem.patient?.mrn || 'N/A'}</strong>
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handlePrint(selectedItem)}
                                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
                                    >
                                        <FaPrint /> Print Report
                                    </button>
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
                                    >
                                        <FaTimes size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Modal Body */}
                            <div className="p-6 overflow-y-auto space-y-6">
                                {/* Demographics Card */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200/80 text-xs">
                                    <div>
                                        <span className="text-gray-400 block font-medium">Patient Name</span>
                                        <span className="font-bold text-gray-800 mt-0.5 block">{selectedItem.patient?.name || 'Walk-in'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block font-medium">Hospital MRN</span>
                                        <span className="font-bold font-mono text-gray-800 mt-0.5 block">{selectedItem.patient?.mrn || 'N/A'}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block font-medium">Age / Gender</span>
                                        <span className="font-bold text-gray-800 mt-0.5 block">
                                            {(selectedItem.patient?.age || 'N/A')} / {(selectedItem.patient?.gender || 'N/A')}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 block font-medium">Date Completed</span>
                                        <span className="font-bold text-gray-800 mt-0.5 block">
                                            {new Date(selectedItem.completedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Clinical Details if present */}
                                {selectedItem.clinicalDetails && (
                                    <div className="p-3 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg text-xs text-amber-900">
                                        <strong>Clinical Notes:</strong> {selectedItem.clinicalDetails}
                                    </div>
                                )}

                                {/* Results View */}
                                {selectedItem.category === 'lab' ? (
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                                            Laboratory Results
                                        </h4>
                                        {(() => {
                                            try {
                                                const parsed = JSON.parse(selectedItem.result);
                                                if (parsed.format === 'table' && Array.isArray(parsed.parameters)) {
                                                    return (
                                                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                                            <table className="w-full text-xs text-left">
                                                                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                                                                    <tr>
                                                                        <th className="py-2.5 px-3">Parameter</th>
                                                                        <th className="py-2.5 px-3">Value</th>
                                                                        <th className="py-2.5 px-3">Unit</th>
                                                                        <th className="py-2.5 px-3">Normal Range</th>
                                                                        <th className="py-2.5 px-3 text-center">Status</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {parsed.parameters.map((p, idx) => {
                                                                        if (p.type === 'section') {
                                                                            return (
                                                                                <tr key={idx} className="bg-purple-50">
                                                                                    <td colSpan={5} className="py-2 px-3 font-bold text-purple-800 uppercase tracking-wider text-[11px]">
                                                                                        {p.name}
                                                                                    </td>
                                                                                </tr>
                                                                            );
                                                                        }
                                                                        const rangeStatus = checkRange(p.value, p.normalRange);
                                                                        return (
                                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                                <td className="py-2.5 px-3 font-medium text-gray-800">{p.name}</td>
                                                                                <td className="py-2.5 px-3 font-bold text-gray-900">{p.value || '-'}</td>
                                                                                <td className="py-2.5 px-3 text-gray-500">{p.unit || '-'}</td>
                                                                                <td className="py-2.5 px-3 text-gray-500">{p.normalRange || '-'}</td>
                                                                                <td className="py-2.5 px-3 text-center">
                                                                                    {p.value && (
                                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                                            rangeStatus === 'low'
                                                                                                ? 'bg-orange-100 text-orange-800'
                                                                                                : rangeStatus === 'high'
                                                                                                ? 'bg-red-100 text-red-800'
                                                                                                : 'bg-green-100 text-green-800'
                                                                                        }`}>
                                                                                            {rangeStatus === 'low' ? 'Low' : rangeStatus === 'high' ? 'High' : 'Normal'}
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
                                                // Try text parsing
                                                const parsedParams = parseTextTemplate(selectedItem.result);
                                                if (parsedParams.length > 0) {
                                                    return (
                                                        <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                                            <table className="w-full text-xs text-left">
                                                                <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                                                                    <tr>
                                                                        <th className="py-2.5 px-3">Parameter</th>
                                                                        <th className="py-2.5 px-3">Result</th>
                                                                        <th className="py-2.5 px-3">Reference Range</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {parsedParams.map((p, idx) => (
                                                                        <tr key={idx} className="hover:bg-gray-50">
                                                                            <td className="py-2.5 px-3 font-medium text-gray-800">{p.name}</td>
                                                                            <td className="py-2.5 px-3 font-bold text-gray-900">{p.value || '-'}</td>
                                                                            <td className="py-2.5 px-3 text-gray-500">{p.normalRange || '-'}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    );
                                                }
                                            }
                                            return (
                                                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 font-mono text-xs whitespace-pre-wrap text-gray-800">
                                                    {selectedItem.result || 'No structured results found.'}
                                                </div>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                Radiology Report Findings
                                            </h4>
                                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-sm whitespace-pre-wrap leading-relaxed text-gray-800">
                                                {selectedItem.report || 'No report notes available.'}
                                            </div>
                                        </div>

                                        {selectedItem.images && selectedItem.images.length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                    Attached Scans & Imaging ({selectedItem.images.length})
                                                </h4>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                                    {selectedItem.images.map((img, i) => (
                                                        <div
                                                            key={i}
                                                            className="border border-gray-200 rounded-xl p-2 bg-gray-50 cursor-pointer hover:shadow-md transition"
                                                            onClick={() => setPreviewImage(`${backendUrl}/${img.path}`)}
                                                        >
                                                            <p className="text-xs font-bold text-blue-700 truncate mb-1">{img.name || 'View'}</p>
                                                            <img
                                                                src={`${backendUrl}/${img.path}`}
                                                                alt={img.name}
                                                                className="w-full h-32 object-contain bg-black rounded-lg"
                                                            />
                                                            <p className="text-[10px] text-gray-400 mt-1 text-center">Click to expand</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Signatures / Approvals */}
                                <div className="border-t border-gray-200 pt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-gray-600 bg-gray-50/50 p-3 rounded-xl">
                                    <div>
                                        <span className="text-gray-400 block font-medium">Performed / Reported By</span>
                                        <span className="font-bold text-gray-800">{selectedItem.signedBy?.name || 'Laboratory Staff'}</span>
                                    </div>
                                    {selectedItem.approvedBy && (
                                        <div>
                                            <span className="text-emerald-600 block font-medium">Verified & Approved By</span>
                                            <span className="font-bold text-emerald-800">{selectedItem.approvedBy.name}</span>
                                        </div>
                                    )}
                                    <div className="text-right">
                                        <span className="text-gray-400 block font-medium">Security Notice</span>
                                        <span className="text-gray-500 italic">Official Diagnostic Document</span>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                                <p className="text-xs text-gray-400">
                                    Receptionist Access: Print-only permission
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedItem(null)}
                                        className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-100 transition"
                                    >
                                        Close
                                    </button>
                                    <button
                                        onClick={() => handlePrint(selectedItem)}
                                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-sm"
                                    >
                                        <FaPrint /> Print Official Report
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Full-Screen Image Lightbox Preview */}
                {previewImage && (
                    <div
                        className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4"
                        onClick={() => setPreviewImage(null)}
                    >
                        <div className="relative max-w-4xl max-h-[90vh] flex items-center justify-center">
                            <button
                                onClick={() => setPreviewImage(null)}
                                className="absolute -top-10 right-0 text-white hover:text-gray-300 text-xl font-bold"
                            >
                                <FaTimes />
                            </button>
                            <img
                                src={previewImage}
                                alt="Diagnostic scan"
                                className="max-w-full max-h-[85vh] object-contain rounded shadow-2xl"
                            />
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
};

export default InvestigationResults;
