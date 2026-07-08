const LabOrder = require('../models/labOrderModel');
const RadiologyOrder = require('../models/radiologyOrderModel');
const Prescription = require('../models/prescriptionModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Visit = require('../models/visitModel');
const Patient = require('../models/patientModel');
const Receipt = require('../models/receiptModel');
const User = require('../models/userModel');
const VitalSign = require('../models/vitalSignModel');
const Clinic = require('../models/clinicModel');
const Ward = require('../models/wardModel');

// @desc    Get lab revenue report by date range
// @route   GET /api/reports/lab-revenue?startDate=&endDate=
// @access  Private (Admin)
const getLabRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const labOrders = await LabOrder.find({
            createdAt: { $gte: start, $lte: end }
        })
            .populate('patient', 'name mrn')
            .populate({
                path: 'charge',
                populate: [
                    { path: 'receipt' },
                    { path: 'addedBy', select: 'name role' }
                ]
            })
            .populate('visit', 'type')
            .sort({ createdAt: -1 });

        // --- NEW: Include Standalone Lab Charges (if any) ---
        const standaloneCharges = await EncounterCharge.find({
            $or: [
                { department: 'Lab' },
                { itemType: 'Lab' }
            ],
            createdAt: { $gte: start, $lte: end },
            _id: { $nin: labOrders.map(o => o.charge?._id).filter(id => id) }
        })
            .populate('patient', 'name mrn')
            .populate('receipt')
            .populate('addedBy', 'name role');

        const totalTests = labOrders.length + standaloneCharges.length;
        const completedTests = labOrders.filter(o => o.status === 'completed').length;
        const paidTests = labOrders.filter(o => o.charge?.status === 'paid').length + standaloneCharges.filter(c => c.status === 'paid').length;

        const orderRevenue = labOrders
            .filter(o => o.charge?.status === 'paid')
            .reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0);

        const standaloneRevenue = standaloneCharges
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        const totalRevenue = orderRevenue + standaloneRevenue;

        const pendingRevenue = labOrders
            .filter(o => o.charge?.status === 'pending')
            .reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0) +
            standaloneCharges.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        // Identify External Revenue
        const isExternal = (o_or_c) => {
            const visitType = o_or_c.visit?.type || (o_or_c.encounter?.type);
            return ['External Lab', 'External Investigation', 'External Lab/Radiology'].includes(visitType) ||
                o_or_c.patient?.name?.startsWith('LAB-') ||
                !o_or_c.visit; // Standalone charges might not have a visit in some contexts
        };

        const externalOrders = labOrders.filter(o => isExternal(o) && o.charge?.status === 'paid');
        const externalStandalone = standaloneCharges.filter(c => c.status === 'paid'); // Most standalone are external POS

        const externalRevenue = externalOrders.reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0) +
            externalStandalone.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        const externalDetails = [
            ...externalOrders.map(o => ({
                id: o._id,
                createdAt: o.createdAt,
                patient: o.patient || { name: 'Walk-in' },
                testName: o.testName,
                amount: o.charge?.totalAmount || 0,
                cashier: o.charge?.addedBy || { name: 'System', role: 'cashier' },
                status: o.charge?.status || 'paid'
            })),
            ...externalStandalone.map(c => ({
                id: c._id,
                createdAt: c.createdAt,
                patient: c.patient || { name: 'Walk-in' },
                testName: c.itemName || 'Lab Test',
                amount: c.totalAmount || 0,
                cashier: c.addedBy || { name: 'System', role: 'cashier' },
                status: c.status || 'paid'
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Calculate pending revenue breakdown
        let pendingInsuranceRevenue = 0;
        let pendingPatientRevenue = 0;

        [...labOrders, ...standaloneCharges].forEach(item => {
            const c = item.charge || item; // o.charge or the standalone charge itself
            if (c?.status === 'pending') {
                if (c.hmoPortion !== undefined || c.patientPortion !== undefined) {
                    pendingInsuranceRevenue += (c.hmoPortion || 0);
                    pendingPatientRevenue += (c.patientPortion || 0);
                } else {
                    pendingPatientRevenue += (c.totalAmount || 0);
                }
            }
        });

        // Calculate Pending HMO Amount
        let pendingHMOAmount = 0;
        const paidInsuranceCharges = [...labOrders.map(o => o.charge), ...standaloneCharges]
            .filter(c => c?.status === 'paid' && c?.receipt?.paymentMethod === 'insurance');

        if (paidInsuranceCharges.length > 0) {
            const Claim = require('../models/claimModel');
            const insuranceEncIds = [...new Set(paidInsuranceCharges.map(c =>
                (c.encounter?._id || c.encounter)?.toString()
            ).filter(id => id))];

            if (insuranceEncIds.length > 0) {
                const unpaidClaims = await Claim.find({
                    encounter: { $in: insuranceEncIds },
                    status: { $ne: 'paid' }
                });

                const unpaidClaimEncounters = new Set(unpaidClaims.map(c => c.encounter.toString()));

                pendingHMOAmount = paidInsuranceCharges
                    .filter(c => {
                        const encId = (c.encounter?._id || c.encounter)?.toString();
                        return encId && unpaidClaimEncounters.has(encId);
                    })
                    .reduce((sum, c) => sum + (c.hmoPortion || 0), 0);
            }
        }

        // Group by test type
        const byTestType = {};
        labOrders.forEach(order => {
            const testName = order.testName;
            if (!byTestType[testName]) {
                byTestType[testName] = { count: 0, revenue: 0, paid: 0, pending: 0 };
            }
            byTestType[testName].count++;
            if (order.charge?.status === 'paid') {
                byTestType[testName].revenue += order.charge.totalAmount;
                byTestType[testName].paid++;
            } else {
                byTestType[testName].pending++;
            }
        });
        standaloneCharges.forEach(c => {
            const name = c.itemName || 'Lab Test';
            if (!byTestType[name]) byTestType[name] = { count: 0, revenue: 0, paid: 0, pending: 0 };
            byTestType[name].count++;
            if (c.status === 'paid') {
                byTestType[name].revenue += c.totalAmount;
                byTestType[name].paid++;
            } else {
                byTestType[name].pending++;
            }
        });

        res.json({
            summary: {
                totalTests,
                completedTests,
                paidTests,
                totalRevenue,
                externalRevenue,
                pendingRevenue,
                pendingInsuranceRevenue,
                pendingPatientRevenue,
                pendingHMOAmount,
                dateRange: { start, end }
            },
            byTestType,
            externalDetails,
            orders: labOrders
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get radiology revenue report by date range
// @route   GET /api/reports/radiology-revenue?startDate=&endDate=
// @access  Private (Admin)
const getRadiologyRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const radOrders = await RadiologyOrder.find({
            createdAt: { $gte: start, $lte: end }
        })
            .populate('patient', 'name mrn')
            .populate({
                path: 'charge',
                populate: [
                    { path: 'receipt' },
                    { path: 'addedBy', select: 'name role' }
                ]
            })
            .populate('visit', 'type')
            .sort({ createdAt: -1 });

        // --- NEW: Include Standalone Radiology Charges (if any) ---
        const standaloneCharges = await EncounterCharge.find({
            $or: [
                { department: 'Radiology' },
                { itemType: 'Radiology' }
            ],
            createdAt: { $gte: start, $lte: end },
            _id: { $nin: radOrders.map(o => o.charge?._id).filter(id => id) }
        })
            .populate('patient', 'name mrn')
            .populate('receipt')
            .populate('addedBy', 'name role');

        const totalScans = radOrders.length + standaloneCharges.length;
        const completedScans = radOrders.filter(o => o.status === 'completed').length;
        const paidScans = radOrders.filter(o => o.charge?.status === 'paid').length + standaloneCharges.filter(c => c.status === 'paid').length;

        const orderRevenue = radOrders
            .filter(o => o.charge?.status === 'paid')
            .reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0);

        const standaloneRevenue = standaloneCharges
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        const totalRevenue = orderRevenue + standaloneRevenue;

        const pendingRevenue = radOrders
            .filter(o => o.charge?.status === 'pending')
            .reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0) +
            standaloneCharges.filter(c => c.status === 'pending').reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        // Identify External Revenue
        const isExternal = (o_or_c) => {
            const visitType = o_or_c.visit?.type || (o_or_c.encounter?.type);
            return ['External Radiology', 'External Investigation', 'External Lab/Radiology'].includes(visitType) ||
                o_or_c.patient?.name?.startsWith('RAD-') ||
                !o_or_c.visit;
        };

        const externalOrders = radOrders.filter(o => isExternal(o) && o.charge?.status === 'paid');
        const externalStandalone = standaloneCharges.filter(c => c.status === 'paid');

        const externalRevenue = externalOrders.reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0) +
            externalStandalone.reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        const externalDetails = [
            ...externalOrders.map(o => ({
                id: o._id,
                createdAt: o.createdAt,
                patient: o.patient || { name: 'Walk-in' },
                testName: o.testName || o.scanType,
                amount: o.charge?.totalAmount || 0,
                cashier: o.charge?.addedBy || { name: 'System', role: 'cashier' },
                status: o.charge?.status || 'paid'
            })),
            ...externalStandalone.map(c => ({
                id: c._id,
                createdAt: c.createdAt,
                patient: c.patient || { name: 'Walk-in' },
                testName: c.itemName || 'Scan',
                amount: c.totalAmount || 0,
                cashier: c.addedBy || { name: 'System', role: 'cashier' },
                status: c.status || 'paid'
            }))
        ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Calculate pending revenue breakdown
        let pendingInsuranceRevenue = 0;
        let pendingPatientRevenue = 0;

        [...radOrders, ...standaloneCharges].forEach(item => {
            const c = item.charge || item;
            if (c?.status === 'pending') {
                if (c.hmoPortion !== undefined || c.patientPortion !== undefined) {
                    pendingInsuranceRevenue += (c.hmoPortion || 0);
                    pendingPatientRevenue += (c.patientPortion || 0);
                } else {
                    pendingPatientRevenue += (c.totalAmount || 0);
                }
            }
        });

        // Calculate Pending HMO Amount
        let pendingHMOAmount = 0;
        const paidInsuranceCharges = [...radOrders.map(o => o.charge), ...standaloneCharges]
            .filter(c => c?.status === 'paid' && c?.receipt?.paymentMethod === 'insurance');

        if (paidInsuranceCharges.length > 0) {
            const Claim = require('../models/claimModel');
            const insuranceEncIds = [...new Set(paidInsuranceCharges.map(c =>
                (c.encounter?._id || c.encounter)?.toString()
            ).filter(id => id))];

            if (insuranceEncIds.length > 0) {
                const unpaidClaims = await Claim.find({
                    encounter: { $in: insuranceEncIds },
                    status: { $ne: 'paid' }
                });

                const unpaidClaimEncounters = new Set(unpaidClaims.map(c => c.encounter.toString()));

                pendingHMOAmount = paidInsuranceCharges
                    .filter(c => {
                        const encId = (c.encounter?._id || c.encounter)?.toString();
                        return encId && unpaidClaimEncounters.has(encId);
                    })
                    .reduce((sum, c) => sum + (c.hmoPortion || 0), 0);
            }
        }

        // Group by scan type
        const byScanType = {};
        radOrders.forEach(order => {
            const scanType = order.scanType;
            if (!byScanType[scanType]) {
                byScanType[scanType] = { count: 0, revenue: 0, paid: 0, pending: 0 };
            }
            byScanType[scanType].count++;
            if (order.charge?.status === 'paid') {
                byScanType[scanType].revenue += order.charge.totalAmount;
                byScanType[scanType].paid++;
            } else {
                byScanType[scanType].pending++;
            }
        });
        standaloneCharges.forEach(c => {
            const name = c.itemName || 'Scan';
            if (!byScanType[name]) byScanType[name] = { count: 0, revenue: 0, paid: 0, pending: 0 };
            byScanType[name].count++;
            if (c.status === 'paid') {
                byScanType[name].revenue += c.totalAmount;
                byScanType[name].paid++;
            } else {
                byScanType[name].pending++;
            }
        });

        res.json({
            summary: {
                totalScans,
                completedScans,
                paidScans,
                totalRevenue,
                externalRevenue,
                pendingRevenue,
                pendingInsuranceRevenue,
                pendingPatientRevenue,
                pendingHMOAmount,
                dateRange: { start, end }
            },
            byScanType,
            externalDetails,
            orders: radOrders
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get pharmacy revenue report by date range
// @route   GET /api/reports/pharmacy-revenue?startDate=&endDate=
// @access  Private (Admin)
const getPharmacyRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const prescriptions = await Prescription.find({
            createdAt: { $gte: start, $lte: end }
        })
            .populate('patient', 'name mrn')
            .populate('doctor', 'name')
            .populate({
                path: 'charge',
                populate: [
                    { path: 'receipt' },
                    { path: 'addedBy', select: 'name role' }
                ]
            })
            .sort({ createdAt: -1 });

        // --- NEW: Include Standalone Pharmacy Charges (POS sales) ---
        const standaloneCharges = await EncounterCharge.find({
            $or: [
                { itemType: 'Pharmacy' },
                { itemType: 'Drug', visit: { $exists: true } }, // Standalone drugs
                { department: 'Pharmacy' }
            ],
            createdAt: { $gte: start, $lte: end }
        })
            .populate('patient', 'name mrn')
            .populate('addedBy', 'name role')
            .populate('receipt');

        const totalPrescriptions = prescriptions.length;
        const dispensedPrescriptions = prescriptions.filter(p => p.status === 'dispensed').length;

        // Combine revenue from prescriptions and standalone charges
        const prescriptionRevenue = prescriptions
            .filter(p => p.charge?.status === 'paid')
            .reduce((sum, p) => sum + (p.charge?.totalAmount || 0), 0);

        const standaloneRevenue = standaloneCharges
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        const totalRevenue = prescriptionRevenue + standaloneRevenue;

        // External Revenue is usually all standalone POS sales
        const externalRevenue = standaloneRevenue;
        const externalDetails = standaloneCharges
            .filter(c => c.status === 'paid')
            .map(c => ({
                id: c._id,
                createdAt: c.createdAt,
                patient: c.patient || { name: 'Walk-in' },
                testName: c.itemName || 'Drug',
                amount: c.totalAmount || 0,
                cashier: c.addedBy || { name: 'System', role: 'cashier' },
                status: c.status || 'paid'
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Pending revenue from both
        const pendingPrescriptionRevenue = prescriptions
            .filter(p => p.charge?.status === 'pending')
            .reduce((sum, p) => sum + (p.charge?.totalAmount || 0), 0);

        const pendingStandaloneRevenue = standaloneCharges
            .filter(c => c.status === 'pending')
            .reduce((sum, c) => sum + (c.totalAmount || 0), 0);

        const pendingRevenue = pendingPrescriptionRevenue + pendingStandaloneRevenue;

        // Group by drug from both sources
        const byDrug = {};
        prescriptions.forEach(prescription => {
            prescription.medicines.forEach(med => {
                if (!byDrug[med.name]) byDrug[med.name] = { count: 0, totalQuantity: 0 };
                byDrug[med.name].count++;
                byDrug[med.name].totalQuantity += (med.quantity || 1);
            });
        });

        standaloneCharges.forEach(charge => {
            const drugName = charge.itemName || 'Drug';
            if (!byDrug[drugName]) byDrug[drugName] = { count: 0, totalQuantity: 0 };
            byDrug[drugName].count++;
            byDrug[drugName].totalQuantity += (charge.quantity || 1);
        });

        // Convert standalone charges to a Prescription-like format for frontend display compatibility
        const virtualPrescriptions = standaloneCharges.map(c => ({
            _id: c._id,
            patient: c.patient,
            status: 'dispensed',
            createdAt: c.createdAt,
            charge: c,
            medicines: [{ name: c.itemName, quantity: c.quantity }],
            doctor: { name: 'Direct Sale' },
            isStandalonePOS: true
        }));

        res.json({
            summary: {
                totalPrescriptions: totalPrescriptions + standaloneCharges.length,
                dispensedPrescriptions: dispensedPrescriptions + standaloneCharges.length,
                paidPrescriptions: (prescriptions.filter(p => p.charge?.status === 'paid').length) + (standaloneCharges.filter(c => c.status === 'paid').length),
                totalRevenue,
                externalRevenue,
                pendingRevenue,
                dateRange: { start, end }
            },
            byDrug,
            externalDetails,
            prescriptions: [...prescriptions, ...virtualPrescriptions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get consultation revenue report by date range
// @route   GET /api/reports/consultation-revenue?startDate=&endDate=
// @access  Private (Admin)
const getConsultationRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        // Find all charges first, then filter for consultation
        // Note: In a larger system, we should use aggregate with lookup to filter at DB level
        const allCharges = await EncounterCharge.find({
            createdAt: { $gte: start, $lte: end }
        })
            .populate('charge')
            .populate('patient', 'name mrn')
            .populate('encounter')
            .populate('receipt')
            .sort({ createdAt: -1 });

        // Filter for consultation charges
        const consultationCharges = allCharges.filter(c => c.charge?.type === 'consultation');

        const totalConsultations = consultationCharges.length;
        const paidConsultations = consultationCharges.filter(c => c.status === 'paid').length;

        // Calculate revenue using cash basis for HMO portions
        const paidCharges = consultationCharges.filter(c => c.status === 'paid');



        // Separate insurance vs non-insurance payments

        const insuranceCharges = paidCharges.filter(c => c.receipt?.paymentMethod === 'insurance');
        const nonInsuranceCharges = paidCharges.filter(c =>
            c.receipt && c.receipt.paymentMethod !== 'insurance'
        );



        // Non-insurance revenue (full amount counted immediately)
        const nonInsuranceRevenue = nonInsuranceCharges.reduce((sum, c) => sum + c.totalAmount, 0);

        // Insurance revenue - patient portion only initially (and only if > 0)
        const insurancePatientRevenue = insuranceCharges
            .filter(c => (c.patientPortion || 0) > 0)
            .reduce((sum, c) => sum + c.patientPortion, 0);

        // Find charges with paid claims to add HMO portion
        const insuranceEncounterIds = [...new Set(insuranceCharges.map(c => c.encounter?._id || c.encounter).filter(id => id))];
        let insuranceHMORevenue = 0;

        if (insuranceEncounterIds.length > 0) {
            const Claim = require('../models/claimModel');
            const paidClaims = await Claim.find({
                encounter: { $in: insuranceEncounterIds },
                status: 'paid'
            });

            const paidClaimsMap = new Map(paidClaims.map(c => [c.encounter.toString(), c]));

            // Add HMO portion for charges with paid claims
            // Only include charges created BEFORE the claim was paid
            insuranceHMORevenue = insuranceCharges
                .filter(c => {
                    const encId = (c.encounter?._id || c.encounter)?.toString();
                    const claim = paidClaimsMap.get(encId);

                    if (!claim) return false;

                    // Only include if claim has been paid AND charge was created before payment
                    if (!claim.paidDate) return false;
                    if (new Date(c.createdAt) > new Date(claim.paidDate)) return false;

                    return true;
                })
                .reduce((sum, c) => sum + (c.hmoPortion || 0), 0);
        }

        const totalRevenue = nonInsuranceRevenue + insurancePatientRevenue + insuranceHMORevenue;

        const pendingRevenue = consultationCharges
            .filter(c => c.status === 'pending')
            .reduce((sum, c) => sum + c.totalAmount, 0);

        // Group by service name (e.g., General Consultation, Specialist Consultation)
        const byService = {};
        consultationCharges.forEach(c => {
            const serviceName = c.charge?.name || 'Unknown';
            if (!byService[serviceName]) {
                byService[serviceName] = {
                    count: 0,
                    revenue: 0,
                    paid: 0,
                    pending: 0
                };
            }
            byService[serviceName].count++;
            if (c.status === 'paid') {
                byService[serviceName].revenue += c.totalAmount;
                byService[serviceName].paid++;
            } else {
                byService[serviceName].pending++;
            }
        });

        // Calculate pending revenue breakdown
        let pendingInsuranceRevenue = 0;
        let pendingPatientRevenue = 0;

        consultationCharges.forEach(c => {
            if (c.status === 'pending') {
                if (c.hmoPortion !== undefined || c.patientPortion !== undefined) {
                    pendingInsuranceRevenue += (c.hmoPortion || 0);
                    pendingPatientRevenue += (c.patientPortion || 0);
                } else {
                    pendingPatientRevenue += (c.totalAmount || 0);
                }
            }
        });

        // Calculate Pending HMO Amount
        const paidInsuranceCharges = consultationCharges.filter(c =>
            c.status === 'paid' &&
            c.receipt?.paymentMethod === 'insurance'
        );
        const receiptIds = [...new Set(paidInsuranceCharges.map(c => c.receipt._id).filter(id => id))];

        let pendingHMOAmount = 0;
        if (receiptIds.length > 0) {
            const pendingHMOReceipts = await Receipt.aggregate([
                { $match: { _id: { $in: receiptIds } } },
                {
                    $lookup: {
                        from: 'claims',
                        localField: 'encounter',
                        foreignField: 'encounter',
                        as: 'claim'
                    }
                },
                { $unwind: '$claim' },
                { $match: { 'claim.status': { $ne: 'paid' } } },
                { $group: { _id: null, total: { $sum: '$amountPaid' } } }
            ]);
            pendingHMOAmount = pendingHMOReceipts[0]?.total || 0;
        }

        res.json({
            summary: {
                totalConsultations,
                paidConsultations,
                totalRevenue,
                pendingRevenue,
                pendingInsuranceRevenue,
                pendingPatientRevenue,
                pendingHMOAmount,
                dateRange: { start, end }
            },
            byService,
            charges: consultationCharges
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get overall hospital revenue
// @route   GET /api/reports/overall-revenue?startDate=&endDate=
// @access  Private (Admin)
const getOverallRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const charges = await EncounterCharge.find({
            createdAt: { $gte: start, $lte: end }
        })
            .populate('charge', 'type name')
            .populate('patient', 'name')
            .populate('receipt'); // Populate receipt for payment method

        const totalCharges = charges.length;
        const paidCharges = charges.filter(c => c.status === 'paid');
        const paidChargesCount = paidCharges.length;

        // Calculate revenue using cash basis for HMO portions
        const insuranceCharges = paidCharges.filter(c => c.receipt?.paymentMethod === 'insurance');

        const nonInsuranceCharges = paidCharges.filter(c =>
            c.receipt && c.receipt.paymentMethod !== 'insurance'
        );



        const nonInsuranceRevenue = nonInsuranceCharges.reduce((sum, c) => sum + c.totalAmount, 0);
        const insurancePatientRevenue = insuranceCharges
            .filter(c => (c.patientPortion || 0) > 0)
            .reduce((sum, c) => sum + c.patientPortion, 0);

        const insuranceEncounterIds = [...new Set(insuranceCharges.map(c => c.encounter?._id || c.encounter).filter(id => id))];
        let insuranceHMORevenue = 0;

        if (insuranceEncounterIds.length > 0) {
            const Claim = require('../models/claimModel');
            const paidClaims = await Claim.find({
                encounter: { $in: insuranceEncounterIds },
                status: 'paid'
            });

            const paidClaimsMap = new Map(paidClaims.map(c => [c.encounter.toString(), c]));

            // Add HMO portion for charges with paid claims
            // Only include charges created BEFORE the claim was paid
            insuranceHMORevenue = insuranceCharges
                .filter(c => {
                    const encId = (c.encounter?._id || c.encounter)?.toString();
                    const claim = paidClaimsMap.get(encId);

                    if (!claim) return false;

                    // Only include if claim has been paid AND charge was created before payment
                    if (!claim.paidDate) return false;
                    if (new Date(c.createdAt) > new Date(claim.paidDate)) return false;

                    return true;
                })
                .reduce((sum, c) => sum + (c.hmoPortion || 0), 0);
        }

        const totalRevenue = nonInsuranceRevenue + insurancePatientRevenue + insuranceHMORevenue;



        // Calculate pending revenue breakdown
        let pendingInsuranceRevenue = 0;
        let pendingPatientRevenue = 0;

        charges.filter(c => c.status === 'pending').forEach(c => {
            // If portions are defined, use them
            if (c.hmoPortion !== undefined || c.patientPortion !== undefined) {
                pendingInsuranceRevenue += (c.hmoPortion || 0);
                pendingPatientRevenue += (c.patientPortion || 0);
            } else {
                // Fallback for old records - assume all is patient pending if not specified
                pendingPatientRevenue += c.totalAmount;
            }
        });

        const pendingRevenue = pendingInsuranceRevenue + pendingPatientRevenue;

        // Calculate Pending HMO Amount - sum HMO portions where claim is not paid
        let pendingHMOAmount = 0;

        // Get all insurance charges
        const paidInsuranceCharges = paidCharges.filter(c =>
            c.receipt?.paymentMethod === 'insurance'
        );

        if (paidInsuranceCharges.length > 0) {
            // Get unique encounter IDs
            const insuranceEncIds = [...new Set(paidInsuranceCharges.map(c =>
                (c.encounter?._id || c.encounter)?.toString()
            ).filter(id => id))];

            if (insuranceEncIds.length > 0) {
                const Claim = require('../models/claimModel');
                // Find claims that are NOT paid
                const unpaidClaims = await Claim.find({
                    encounter: { $in: insuranceEncIds },
                    status: { $ne: 'paid' } // pending, submitted, approved, rejected
                });

                const unpaidClaimEncounters = new Set(unpaidClaims.map(c => c.encounter.toString()));

                // Sum HMO portions for charges with unpaid claims
                pendingHMOAmount = paidInsuranceCharges
                    .filter(c => {
                        const encId = (c.encounter?._id || c.encounter)?.toString();
                        return encId && unpaidClaimEncounters.has(encId);
                    })
                    .reduce((sum, c) => sum + (c.hmoPortion || 0), 0);
            }
        }

        // Group by department - use same revenue logic as totalRevenue
        const byDepartment = {};

        // Create a set of encounter IDs with paid claims for quick lookup
        const paidClaimEncounterSet = new Set();
        if (insuranceEncounterIds.length > 0) {
            const Claim = require('../models/claimModel');
            const paidClaims = await Claim.find({
                encounter: { $in: insuranceEncounterIds },
                status: 'paid'
            });
            const paidClaimsMap = new Map(paidClaims.map(c => [c.encounter.toString(), c]));

            paidCharges.forEach(charge => {
                const encId = (charge.encounter?._id || charge.encounter)?.toString();
                const claim = paidClaimsMap.get(encId);
                if (claim && claim.paidDate && new Date(charge.createdAt) <= new Date(claim.paidDate)) {
                    paidClaimEncounterSet.add(encId);
                }
            });
        }

        paidCharges.forEach(charge => {
            let dept = 'other';
            const type = charge.charge?.type;
            const itemType = charge.itemType;
            const department = charge.department;

            if (type === 'drugs' || itemType === 'Pharmacy' || itemType === 'Drug' || department === 'Pharmacy') {
                dept = 'pharmacy';
            } else if (type) {
                dept = type;
            } else if (itemType) {
                dept = itemType.toLowerCase();
            } else if (department) {
                dept = department.toLowerCase();
            }

            if (!byDepartment[dept]) {
                byDepartment[dept] = { revenue: 0, count: 0 };
            }

            byDepartment[dept].count++;

            // Calculate revenue based on payment method
            let chargeRevenue = 0;
            if (charge.receipt?.paymentMethod === 'insurance') {
                // Insurance: add patient portion (if any)
                chargeRevenue += (charge.patientPortion || 0);

                // Insurance: add HMO portion only if claim is paid
                const encId = (charge.encounter?._id || charge.encounter)?.toString();
                if (encId && paidClaimEncounterSet.has(encId)) {
                    chargeRevenue += (charge.hmoPortion || 0);
                }
            } else if (charge.receipt) {
                // Non-insurance: add full amount
                chargeRevenue = charge.totalAmount;
            }

            byDepartment[dept].revenue += chargeRevenue;
        });

        // --- NEW: Include Family Registration Receipts ---
        const familyReceipts = await Receipt.find({
            familyFile: { $exists: true },
            createdAt: { $gte: start, $lte: end }
        });

        if (familyReceipts.length > 0) {
            if (!byDepartment['family']) {
                byDepartment['family'] = { revenue: 0, count: 0 };
            }

            familyReceipts.forEach(r => {
                byDepartment['family'].count++;
                byDepartment['family'].revenue += r.amountPaid;
            });
        }

        const totalFamilyRevenue = familyReceipts.reduce((sum, r) => sum + r.amountPaid, 0);

        // --- NEW: Include Retainership Registration Receipts ---
        const retainershipReceipts = await Receipt.find({
            hmo: { $exists: true },
            createdAt: { $gte: start, $lte: end }
        });

        if (retainershipReceipts.length > 0) {
            if (!byDepartment['retainership']) {
                byDepartment['retainership'] = { revenue: 0, count: 0 };
            }

            retainershipReceipts.forEach(r => {
                byDepartment['retainership'].count++;
                byDepartment['retainership'].revenue += r.amountPaid;
            });
        }

        const totalRetainershipRevenue = retainershipReceipts.reduce((sum, r) => sum + r.amountPaid, 0);
        const finalTotalRevenue = totalRevenue + totalFamilyRevenue + totalRetainershipRevenue;

        res.json({
            summary: {
                totalCharges,
                paidCharges: paidChargesCount,
                totalRevenue: finalTotalRevenue,
                pendingRevenue,
                pendingInsuranceRevenue,
                pendingPatientRevenue,
                pendingHMOAmount,
                dateRange: { start, end }
            },
            byDepartment,
            charges
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Get nurse triage revenue report by date range
// @route   GET /api/reports/nurse-triage-revenue?startDate=&endDate=
// @access  Private (Admin)
const getNurseTriageRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        // Find all charges first, then filter for nursing
        const allCharges = await EncounterCharge.find({
            createdAt: { $gte: start, $lte: end }
        })
            .populate('charge')
            .populate('patient', 'name mrn')
            .populate('encounter')
            .populate('receipt')
            .sort({ createdAt: -1 });

        // Filter for nursing charges
        const nursingCharges = allCharges.filter(c => c.charge?.type === 'nursing');

        const totalNursingServices = nursingCharges.length;
        const paidNursingServices = nursingCharges.filter(c => c.status === 'paid').length;

        // Calculate revenue using cash basis for HMO portions
        const paidCharges = nursingCharges.filter(c => c.status === 'paid');


        const insuranceCharges = paidCharges.filter(c => c.receipt?.paymentMethod === 'insurance');
        const nonInsuranceCharges = paidCharges.filter(c =>
            c.receipt && c.receipt.paymentMethod !== 'insurance'
        );

        const nonInsuranceRevenue = nonInsuranceCharges.reduce((sum, c) => sum + c.totalAmount, 0);
        const insurancePatientRevenue = insuranceCharges
            .filter(c => (c.patientPortion || 0) > 0)
            .reduce((sum, c) => sum + c.patientPortion, 0);

        const insuranceEncounterIds = [...new Set(insuranceCharges.map(c => c.encounter?._id || c.encounter).filter(id => id))];
        let insuranceHMORevenue = 0;

        if (insuranceEncounterIds.length > 0) {
            const Claim = require('../models/claimModel');
            const paidClaims = await Claim.find({
                encounter: { $in: insuranceEncounterIds },
                status: 'paid'
            });

            const paidClaimsMap = new Map(paidClaims.map(c => [c.encounter.toString(), c]));

            // Add HMO portion for charges with paid claims
            // Only include charges created BEFORE the claim was paid
            insuranceHMORevenue = insuranceCharges
                .filter(c => {
                    const encId = (c.encounter?._id || c.encounter)?.toString();
                    const claim = paidClaimsMap.get(encId);

                    if (!claim) return false;

                    // Only include if claim has been paid AND charge was created before payment
                    if (!claim.paidDate) return false;
                    if (new Date(c.createdAt) > new Date(claim.paidDate)) return false;

                    return true;
                })
                .reduce((sum, c) => sum + (c.hmoPortion || 0), 0);
        }

        const totalRevenue = nonInsuranceRevenue + insurancePatientRevenue + insuranceHMORevenue;



        const pendingRevenue = nursingCharges
            .filter(c => c.status === 'pending')
            .reduce((sum, c) => sum + c.totalAmount, 0);

        // Group by service name
        const byService = {};
        nursingCharges.forEach(c => {
            const serviceName = c.charge?.name || 'Unknown';
            if (!byService[serviceName]) {
                byService[serviceName] = {
                    count: 0,
                    revenue: 0,
                    paid: 0,
                    pending: 0
                };
            }
            byService[serviceName].count++;
            if (c.status === 'paid') {
                byService[serviceName].revenue += c.totalAmount;
                byService[serviceName].paid++;
            } else {
                byService[serviceName].pending++;
            }
        });

        // Calculate pending revenue breakdown
        let pendingInsuranceRevenue = 0;
        let pendingPatientRevenue = 0;

        nursingCharges.forEach(c => {
            if (c.status === 'pending') {
                if (c.hmoPortion !== undefined || c.patientPortion !== undefined) {
                    pendingInsuranceRevenue += (c.hmoPortion || 0);
                    pendingPatientRevenue += (c.patientPortion || 0);
                } else {
                    pendingPatientRevenue += (c.totalAmount || 0);
                }
            }
        });

        // Calculate Pending HMO Amount
        const paidInsuranceCharges = nursingCharges.filter(c =>
            c.status === 'paid' &&
            c.receipt?.paymentMethod === 'insurance'
        );
        const receiptIds = [...new Set(paidInsuranceCharges.map(c => c.receipt._id).filter(id => id))];

        let pendingHMOAmount = 0;
        if (receiptIds.length > 0) {
            const pendingHMOReceipts = await Receipt.aggregate([
                { $match: { _id: { $in: receiptIds } } },
                {
                    $lookup: {
                        from: 'claims',
                        localField: 'encounter',
                        foreignField: 'encounter',
                        as: 'claim'
                    }
                },
                { $unwind: '$claim' },
                { $match: { 'claim.status': { $ne: 'paid' } } },
                { $group: { _id: null, total: { $sum: '$amountPaid' } } }
            ]);
            pendingHMOAmount = pendingHMOReceipts[0]?.total || 0;
        }

        res.json({
            summary: {
                totalNursingServices,
                paidNursingServices,
                totalRevenue,
                pendingRevenue,
                pendingInsuranceRevenue,
                pendingPatientRevenue,
                pendingHMOAmount,
                dateRange: { start, end }
            },
            byService,
            charges: nursingCharges
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard-stats
// @access  Private (Admin)
const getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thisWeek = new Date();
        thisWeek.setDate(thisWeek.getDate() - 7);

        const thisMonth = new Date();
        thisMonth.setDate(1);

        // Total counts
        const totalPatients = await Patient.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalReceipts = await Receipt.countDocuments();
        // We'll use EncounterCharge count as "Total Invoices/Charges" for now if Invoices aren't used
        const totalCharges = await EncounterCharge.countDocuments();

        const patientsToday = await Visit.countDocuments({ createdAt: { $gte: today } });
        const patientsThisWeek = await Visit.countDocuments({ createdAt: { $gte: thisWeek } });
        const patientsThisMonth = await Visit.countDocuments({ createdAt: { $gte: thisMonth } });

        // --- REVENUE CALCULATION (CASH BASIS) ---
        // Fetch all paid charges for refined calculation
        const allPaidCharges = await EncounterCharge.find({ status: 'paid' })
            .populate('charge', 'type name')
            .populate('receipt');

        // Fetch all paid claims to identify collected HMO portions
        const Claim = require('../models/claimModel');
        const paidClaims = await Claim.find({ status: 'paid' });
        const paidClaimsMap = new Map(paidClaims.map(c => [c.encounter.toString(), c]));

        // Fetch other revenue sources
        const familyReceipts = await Receipt.find({ familyFile: { $exists: true } });
        const retainershipReceipts = await Receipt.find({ hmo: { $exists: true } });

        // Helper to check if a date is within a range
        const isToday = (d) => d >= today;
        const isThisWeek = (d) => d >= thisWeek;
        const isThisMonth = (d) => d >= thisMonth;

        // Process each charge to calculate its "collected" revenue
        const processedCharges = allPaidCharges.map(charge => {
            let collectedRevenue = 0;
            if (charge.receipt?.paymentMethod === 'insurance') {
                // Insurance: add patient portion
                collectedRevenue += (charge.patientPortion || 0);

                // Insurance: add HMO portion ONLY if claim is paid
                const encId = (charge.encounter?._id || charge.encounter)?.toString();
                const claim = paidClaimsMap.get(encId);
                if (claim && claim.paidDate && new Date(charge.createdAt) <= new Date(claim.paidDate)) {
                    collectedRevenue += (charge.hmoPortion || 0);
                }
            } else if (charge.receipt) {
                // Non-insurance: add full amount
                collectedRevenue = charge.totalAmount;
            }

            return {
                ...charge.toObject(),
                collectedRevenue,
                date: new Date(charge.createdAt)
            };
        });

        // Sum up totals
        const revenue = {
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
            total: 0
        };

        const revenueByDept = {};

        processedCharges.forEach(c => {
            const rev = c.collectedRevenue;
            const date = c.date;

            revenue.total += rev;
            if (isToday(date)) revenue.today += rev;
            if (isThisWeek(date)) revenue.thisWeek += rev;
            if (isThisMonth(date)) revenue.thisMonth += rev;

            // Dept breakdown (All Time)
            const type = c.charge?.type || 'other';
            const dept = type === 'drugs' ? 'pharmacy' : type;
            if (!revenueByDept[dept]) revenueByDept[dept] = 0;
            revenueByDept[dept] += rev;
        });

        // Add Family & Retainership revenue
        familyReceipts.forEach(r => {
            const rev = r.amountPaid;
            const date = new Date(r.createdAt);
            revenue.total += rev;
            if (isToday(date)) revenue.today += rev;
            if (isThisWeek(date)) revenue.thisWeek += rev;
            if (isThisMonth(date)) revenue.thisMonth += rev;

            if (!revenueByDept['family']) revenueByDept['family'] = 0;
            revenueByDept['family'] += rev;
        });

        retainershipReceipts.forEach(r => {
            const rev = r.amountPaid;
            const date = new Date(r.createdAt);
            revenue.total += rev;
            if (isToday(date)) revenue.today += rev;
            if (isThisWeek(date)) revenue.thisWeek += rev;
            if (isThisMonth(date)) revenue.thisMonth += rev;

            if (!revenueByDept['retainership']) revenueByDept['retainership'] = 0;
            revenueByDept['retainership'] += rev;
        });

        const revenueByDepartmentArray = Object.entries(revenueByDept).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            revenue: value
        }));

        // Active encounters
        const activeEncounters = await Visit.countDocuments({ encounterStatus: 'active' });

        // Pending payments breakdown
        const pendingStats = await EncounterCharge.aggregate([
            { $match: { status: 'pending' } },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$totalAmount' },
                    pendingInsurance: { $sum: { $ifNull: ['$hmoPortion', 0] } },
                    pendingPatient: {
                        $sum: {
                            $cond: [
                                { $ifNull: ['$patientPortion', false] }, // Check if patientPortion exists
                                '$patientPortion',
                                '$totalAmount' // Fallback if patientPortion doesn't exist (assume all patient)
                            ]
                        }
                    }
                }
            }
        ]);

        // Calculate Pending HMO Amount correctly
        // 1. Pending charges (not yet paid by patient or HMO)
        const pendingChargesHMO = pendingStats[0]?.pendingInsurance || 0;

        // 2. Paid charges (patient paid their portion) but HMO claim is pending
        // Find receipts with paymentMethod 'insurance' and claimStatus != 'paid'
        // Receipt model is already imported at the top
        const pendingHMOReceipts = await Receipt.aggregate([
            { $match: { paymentMethod: 'insurance' } },
            {
                $lookup: {
                    from: 'claims',
                    localField: 'encounter',
                    foreignField: 'encounter',
                    as: 'claim'
                }
            },
            { $unwind: { path: '$claim', preserveNullAndEmptyArrays: true } },
            // Filter where claim exists and is NOT paid
            {
                $match: {
                    $or: [
                        { 'claim.status': { $ne: 'paid' } },
                        { 'claim': { $exists: false } } // Or if claim doesn't exist yet but it's insurance
                    ]
                }
            },
            // Lookup charges for these receipts to sum hmoPortion
            {
                $lookup: {
                    from: 'encountercharges',
                    localField: 'charges',
                    foreignField: '_id',
                    as: 'chargeDocs'
                }
            },
            { $unwind: '$chargeDocs' },
            {
                $group: {
                    _id: null,
                    totalHMO: { $sum: '$chargeDocs.hmoPortion' }
                }
            }
        ]);

        const pendingClaimHMO = pendingHMOReceipts[0]?.totalHMO || 0;
        const totalPendingHMO = pendingChargesHMO + pendingClaimHMO;

        res.json({
            patients: {
                total: totalPatients,
                today: patientsToday,
                thisWeek: patientsThisWeek,
                thisMonth: patientsThisMonth
            },
            revenue: {
                today: revenue.today,
                thisWeek: revenue.thisWeek,
                thisMonth: revenue.thisMonth,
                total: revenue.total
            },
            counts: {
                users: totalUsers,
                receipts: totalReceipts,
                charges: totalCharges
            },
            activeEncounters,
            pendingPayments: pendingStats[0]?.total || 0,
            pendingHMOAmount: totalPendingHMO,
            pendingPatient: pendingStats[0]?.pendingPatient || 0,
            revenueByDepartment: revenueByDepartmentArray
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get clinical reports (Diagnosis, Gender, Age distribution)
// @route   GET /api/reports/clinical-report?diagnosis=&gender=&minAge=&maxAge=&startDate=&endDate=
// @access  Private (Admin)
const getClinicalReport = async (req, res) => {
    try {
        const { reportType = 'diagnosis', searchTerm, gender, minAge, maxAge, startDate, endDate } = req.query;

        let dateQuery = {};
        if (startDate || endDate) {
            dateQuery.createdAt = {};
            if (startDate) dateQuery.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                dateQuery.createdAt.$lte = end;
            }
        }

        let results = [];
        let grouped = {};

        if (reportType === 'diagnosis') {
            let visitQuery = { ...dateQuery };
            if (searchTerm) {
                visitQuery.$or = [
                    { 'diagnosis.code': { $regex: searchTerm, $options: 'i' } },
                    { 'diagnosis.description': { $regex: searchTerm, $options: 'i' } },
                    { 'assessment': { $regex: searchTerm, $options: 'i' } }
                ];
            }
            results = await Visit.find(visitQuery)
                .populate('patient')
                .populate('doctor', 'name role')
                .populate('consultingPhysician', 'name role')
                .populate('clinicalNotes.doctor', 'name role')
                .sort({ createdAt: -1 });

            results = results.filter(v => v.patient &&
                (gender === 'All' || !gender || v.patient.gender?.toLowerCase() === gender.toLowerCase()) &&
                (!minAge || v.patient.age >= parseInt(minAge)) &&
                (!maxAge || v.patient.age <= parseInt(maxAge))
            );

            results.forEach(v => {
                // Find first doctor who wrote a clinical note
                let clinicalDoctor = null;
                if (v.clinicalNotes && v.clinicalNotes.length > 0) {
                    const sortedNotes = [...v.clinicalNotes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                    const firstNote = sortedNotes[0];
                    if (firstNote && firstNote.doctor) {
                        clinicalDoctor = firstNote.doctor;
                    }
                }

                if (!clinicalDoctor) {
                    clinicalDoctor = v.consultingPhysician;
                }

                // Fallback to doctor if not a receptionist
                if (!clinicalDoctor || clinicalDoctor.role === 'receptionist') {
                    if (v.doctor && v.doctor.role !== 'receptionist') {
                        clinicalDoctor = v.doctor;
                    } else {
                        clinicalDoctor = null;
                    }
                }

                // If the check-in person (receptionist) is still showing, try finding a doctor in notes
                if ((!clinicalDoctor || clinicalDoctor.role === 'receptionist') && v.notes && v.notes.length > 0) {
                    const drNote = [...v.notes].reverse().find(n => n.role?.toLowerCase() === 'doctor');
                    if (drNote) clinicalDoctor = { name: drNote.author };
                }

                const diags = v.diagnosis && v.diagnosis.length > 0 ? v.diagnosis : [{ code: 'N/A', description: v.assessment || 'Unspecified clinical finding' }];
                diags.forEach(d => {
                    const key = d.code !== 'N/A' ? `${d.code} - ${d.description}` : d.description;
                    if (searchTerm && !key.toLowerCase().includes(searchTerm.toLowerCase())) return;
                    if (!grouped[key]) grouped[key] = [];
                    grouped[key].push({
                        patient: v.patient,
                        doctor: clinicalDoctor,
                        date: v.createdAt,
                        details: d.code !== 'N/A' ? d.description : 'Clinical Assessment',
                        _id: v._id
                    });
                });
            });
        }
        else if (reportType === 'medication') {
            let rxQuery = { ...dateQuery };
            if (searchTerm) {
                rxQuery['medicines.name'] = { $regex: searchTerm, $options: 'i' };
            }
            results = await Prescription.find(rxQuery).populate('patient').populate('doctor', 'name').sort({ createdAt: -1 });

            results = results.filter(r => r.patient &&
                (gender === 'All' || !gender || r.patient.gender?.toLowerCase() === gender.toLowerCase()) &&
                (!minAge || r.patient.age >= parseInt(minAge)) &&
                (!maxAge || r.patient.age <= parseInt(maxAge))
            );

            results.forEach(r => {
                r.medicines.forEach(m => {
                    if (searchTerm && !m.name.toLowerCase().includes(searchTerm.toLowerCase())) return;
                    if (!grouped[m.name]) grouped[m.name] = [];
                    grouped[m.name].push({
                        patient: r.patient,
                        doctor: r.doctor,
                        date: r.createdAt,
                        details: `${m.dosage} ${m.frequency} x ${m.duration}`,
                        _id: r._id
                    });
                });
            });
        }
        else if (reportType === 'lab') {
            let labQuery = { ...dateQuery };
            if (searchTerm) {
                labQuery.testName = { $regex: searchTerm, $options: 'i' };
            }
            results = await LabOrder.find(labQuery).populate('patient').populate('doctor', 'name').sort({ createdAt: -1 });

            results = results.filter(l => l.patient &&
                (gender === 'All' || !gender || l.patient.gender?.toLowerCase() === gender.toLowerCase()) &&
                (!minAge || l.patient.age >= parseInt(minAge)) &&
                (!maxAge || l.patient.age <= parseInt(maxAge))
            );

            results.forEach(l => {
                if (!grouped[l.testName]) grouped[l.testName] = [];
                grouped[l.testName].push({
                    patient: l.patient,
                    doctor: l.doctor,
                    date: l.createdAt,
                    details: l.result || 'Pending Result',
                    _id: l._id
                });
            });
        }
        else if (reportType === 'radiology') {
            let radQuery = { ...dateQuery };
            if (searchTerm) {
                radQuery.scanType = { $regex: searchTerm, $options: 'i' };
            }
            results = await RadiologyOrder.find(radQuery).populate('patient').populate('doctor', 'name').sort({ createdAt: -1 });

            results = results.filter(r => r.patient &&
                (gender === 'All' || !gender || r.patient.gender?.toLowerCase() === gender.toLowerCase()) &&
                (!minAge || r.patient.age >= parseInt(minAge)) &&
                (!maxAge || r.patient.age <= parseInt(maxAge))
            );

            results.forEach(r => {
                if (!grouped[r.scanType]) grouped[r.scanType] = [];
                grouped[r.scanType].push({
                    patient: r.patient,
                    doctor: r.doctor,
                    date: r.createdAt,
                    details: r.report || 'Pending Report',
                    _id: r._id
                });
            });
        }

        const categorizedData = Object.entries(grouped).map(([category, records]) => ({
            category,
            count: records.length,
            records
        })).sort((a, b) => b.count - a.count);

        const uniquePatients = new Map();
        categorizedData.forEach(cat => {
            cat.records.forEach(rec => {
                if (rec.patient && !uniquePatients.has(rec.patient._id.toString())) {
                    uniquePatients.set(rec.patient._id.toString(), rec.patient);
                }
            });
        });

        let maleCount = 0;
        let femaleCount = 0;
        uniquePatients.forEach(p => {
            const g = p.gender?.toString().toLowerCase().trim();
            if (g === 'male') maleCount++;
            else if (g === 'female') femaleCount++;
        });

        res.json({
            summary: {
                totalVisits: results.length,
                totalPatients: uniquePatients.size,
                maleCount,
                femaleCount,
            },
            categorizedData
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get theatre revenue report by date range
// @route   GET /api/reports/theatre-revenue?startDate=&endDate=
// @access  Private (Admin)
const getTheatreRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const allCharges = await EncounterCharge.find({
            createdAt: { $gte: start, $lte: end }
        })
            .populate('charge')
            .populate('patient', 'name mrn')
            .populate('encounter')
            .populate('receipt')
            .sort({ createdAt: -1 });

        const theatreCharges = allCharges.filter(c => c.charge?.type === 'theatre');
        const totalCharges = theatreCharges.length;
        const paidChargesCount = theatreCharges.filter(c => c.status === 'paid').length;

        const paidCharges = theatreCharges.filter(c => c.status === 'paid');
        const insuranceCharges = paidCharges.filter(c => c.receipt?.paymentMethod === 'insurance');
        const nonInsuranceCharges = paidCharges.filter(c => c.receipt && c.receipt.paymentMethod !== 'insurance');

        const nonInsuranceRevenue = nonInsuranceCharges.reduce((sum, c) => sum + c.totalAmount, 0);
        const insurancePatientRevenue = insuranceCharges
            .filter(c => (c.patientPortion || 0) > 0)
            .reduce((sum, c) => sum + c.patientPortion, 0);

        const totalRevenue = nonInsuranceRevenue + insurancePatientRevenue; // simplified for theatre

        res.json({
            summary: {
                totalCharges,
                paidCharges: paidChargesCount,
                totalRevenue,
                pendingRevenue: theatreCharges.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.totalAmount, 0),
                dateRange: { start, end }
            },
            charges: theatreCharges
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get family registration revenue report
// @route   GET /api/reports/family-revenue?startDate=&endDate=
// @access  Private (Admin)
const getFamilyRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const familyReceipts = await Receipt.find({
            familyFile: { $exists: true },
            createdAt: { $gte: start, $lte: end }
        }).populate({ path: 'familyFile', model: 'FamilyFile' });

        const totalRevenue = familyReceipts.reduce((sum, r) => sum + r.amountPaid, 0);

        res.json({
            summary: {
                totalCharges: familyReceipts.length,
                paidCharges: familyReceipts.length,
                totalRevenue,
                pendingRevenue: 0,
                dateRange: { start, end }
            },
            charges: familyReceipts.map(r => ({
                _id: r._id,
                createdAt: r.createdAt,
                amountPaid: r.amountPaid,
                totalAmount: r.amountPaid,
                status: 'paid',
                paymentMethod: r.paymentMethod,
                receiptNumber: r.receiptNumber,
                patient: { name: r.familyFile?.familyName || 'Family File' },
                charge: { name: 'Family Registration', type: 'family' }
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get retainership registration revenue report
// @route   GET /api/reports/retainership-revenue?startDate=&endDate=
// @access  Private (Admin)
const getRetainershipRevenue = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const start = startDate ? new Date(startDate) : new Date(0);
        const end = endDate ? new Date(endDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const retainershipReceipts = await Receipt.find({
            hmo: { $exists: true },
            createdAt: { $gte: start, $lte: end }
        }).populate({ path: 'hmo', model: 'HMO' });

        const totalRevenue = retainershipReceipts.reduce((sum, r) => sum + r.amountPaid, 0);

        res.json({
            summary: {
                totalCharges: retainershipReceipts.length,
                paidCharges: retainershipReceipts.length,
                totalRevenue,
                pendingRevenue: 0,
                dateRange: { start, end }
            },
            charges: retainershipReceipts.map(r => ({
                _id: r._id,
                createdAt: r.createdAt,
                amountPaid: r.amountPaid,
                totalAmount: r.amountPaid,
                status: 'paid',
                paymentMethod: r.paymentMethod,
                receiptNumber: r.receiptNumber,
                patient: { name: r.hmo?.name || 'Retainership Entity' },
                charge: { name: 'Retainership Registration', type: 'retainership' }
            }))
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};



// @desc    Get detailed visit history report
// @route   GET /api/reports/visit-report?startDate=&endDate=&searchTerm=
// @access  Private (Admin)
const getVisitReport = async (req, res) => {
    try {
        const { startDate, endDate, searchTerm } = req.query;

        let query = {};
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                query.createdAt.$lte = end;
            }
        }

        let visits = await Visit.find(query)
            .populate('patient')
            .populate('doctor', 'name role')
            .populate('consultingPhysician', 'name role')
            .populate('clinicalNotes.doctor', 'name role')
            .populate('clinic', 'name')
            .populate('ward', 'name')
            .sort({ createdAt: -1 });

        if (searchTerm) {
            const regex = new RegExp(searchTerm, 'i');
            visits = visits.filter(v =>
                (v.patient && (regex.test(v.patient.name) || regex.test(v.patient.mrn))) ||
                regex.test(v._id.toString())
            );
        }

        const visitIds = visits.map(v => v._id);

        // Fetch related data in bulk
        const [vitals, labs, rads, scripts] = await Promise.all([
            VitalSign.find({ visit: { $in: visitIds } }).populate('nurse', 'name'),
            LabOrder.find({ visit: { $in: visitIds } }).populate('signedBy', 'name').populate('approvedBy', 'name'),
            RadiologyOrder.find({ visit: { $in: visitIds } }).populate('signedBy', 'name'),
            Prescription.find({ visit: { $in: visitIds } }).populate('dispensedBy', 'name').populate('doctor', 'name')
        ]);

        // Map related data to visits
        const consolidatedData = visits.map(v => {
            const visitIdStr = v._id.toString();
            
            // Resolve consultingPhysician based on first clinical note
            let firstDoctor = null;
            if (v.clinicalNotes && v.clinicalNotes.length > 0) {
                const sortedNotes = [...v.clinicalNotes].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                const firstNote = sortedNotes[0];
                if (firstNote && firstNote.doctor) {
                    firstDoctor = firstNote.doctor;
                }
            }
            
            const visitObj = v.toObject();
            if (firstDoctor) {
                visitObj.consultingPhysician = firstDoctor;
            } else if (!visitObj.consultingPhysician) {
                visitObj.consultingPhysician = null;
            }

            return {
                ...visitObj,
                vitalSigns: vitals.filter(s => s.visit?.toString() === visitIdStr),
                labOrders: labs.filter(l => l.visit?.toString() === visitIdStr),
                radiologyOrders: rads.filter(r => r.visit?.toString() === visitIdStr),
                prescriptions: scripts.filter(p => p.visit?.toString() === visitIdStr)
            };
        });

        res.json(consolidatedData);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get user-specific dashboard stats
// @route   GET /api/reports/user-stats
// @access  Private
const getUserDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const role = req.user.role;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let stats = {};

        if (role === 'receptionist') {
            const registeredToday = await Patient.countDocuments({
                registeredBy: userId,
                createdAt: { $gte: today }
            });
            const totalRegistered = await Patient.countDocuments({ registeredBy: userId });
            const encountersCreated = await Visit.countDocuments({
                doctor: userId, // Assuming receptionist might create visits where doctor is assigned later, but tracking by creator is better if we had createdBy. For now following previous logic.
                createdAt: { $gte: today }
            });
            const totalEncounters = await Visit.countDocuments({ doctor: userId });
            stats = { registeredToday, totalRegistered, encountersCreated, totalEncounters };
        } else if (role === 'nurse') {
            const vitalsToday = await VitalSign.countDocuments({
                nurse: userId,
                createdAt: { $gte: today }
            });
            const totalVitals = await VitalSign.countDocuments({ nurse: userId });
            stats = { vitalsToday, totalVitals };
        } else if (role === 'doctor') {
            const patientsSeen = await Visit.countDocuments({
                $or: [{ doctor: userId }, { consultingPhysician: userId }],
                updatedAt: { $gte: today },
                encounterStatus: { $in: ['completed', 'with_doctor', 'awaiting_services', 'in_pharmacy', 'checkout', 'discharged'] }
            });
            const totalPatientsSeen = await Visit.countDocuments({
                $or: [{ doctor: userId }, { consultingPhysician: userId }],
                encounterStatus: { $in: ['completed', 'with_doctor', 'awaiting_services', 'in_pharmacy', 'checkout', 'discharged'] }
            });
            const prescriptionsWritten = await Prescription.countDocuments({
                doctor: userId,
                createdAt: { $gte: today }
            });
            const totalPrescriptions = await Prescription.countDocuments({ doctor: userId });
            stats = { patientsSeen, totalPatientsSeen, prescriptionsWritten, totalPrescriptions };
        } else if (role === 'cashier') {
            const receiptsIssued = await Receipt.countDocuments({
                cashier: userId,
                createdAt: { $gte: today }
            });
            const totalReceipts = await Receipt.countDocuments({ cashier: userId });
            const paymentsCollected = await Receipt.aggregate([
                { $match: { cashier: userId, createdAt: { $gte: today } } },
                { $group: { _id: null, total: { $sum: '$amountPaid' } } }
            ]);
            const lifetimeRevenue = await Receipt.aggregate([
                { $match: { cashier: userId } },
                { $group: { _id: null, total: { $sum: '$amountPaid' } } }
            ]);
            stats = {
                receiptsIssued,
                totalReceipts,
                paymentsCollected: paymentsCollected[0]?.total || 0,
                lifetimeRevenue: lifetimeRevenue[0]?.total || 0
            };
        } else if (role === 'pharmacist') {
            const dispensedToday = await Prescription.countDocuments({
                dispensedBy: userId,
                dispensedAt: { $gte: today }
            });
            const totalDispensed = await Prescription.countDocuments({ dispensedBy: userId });

            // Pharmacy revenue for this specific pharmacist (based on their validations)
            const revenueToday = await Receipt.aggregate([
                { $match: { "validatedBy.user": userId, "validatedBy.department": 'Pharmacy', createdAt: { $gte: today } } },
                { $group: { _id: null, total: { $sum: '$amountPaid' } } }
            ]);
            const lifetimeRevenue = await Receipt.aggregate([
                { $match: { "validatedBy.user": userId, "validatedBy.department": 'Pharmacy' } },
                { $group: { _id: null, total: { $sum: '$amountPaid' } } }
            ]);

            stats = { dispensedToday, totalDispensed, revenueToday: revenueToday[0]?.total || 0, lifetimeRevenue: lifetimeRevenue[0]?.total || 0 };
        } else if (role === 'lab_technician') {
            const testsToday = await LabOrder.countDocuments({
                signedBy: userId,
                status: 'completed',
                updatedAt: { $gte: today }
            });
            const totalTestsSigned = await LabOrder.countDocuments({
                signedBy: userId,
                status: 'completed'
            });
            stats = { testsToday, totalTestsSigned };
        } else if (role === 'radiologist') {
            const scansToday = await RadiologyOrder.countDocuments({
                signedBy: userId,
                status: 'completed',
                updatedAt: { $gte: today }
            });
            const totalScansSigned = await RadiologyOrder.countDocuments({
                signedBy: userId,
                status: 'completed'
            });
            stats = { scansToday, totalScansSigned };
        }

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


module.exports = {
    getLabRevenue,
    getRadiologyRevenue,
    getPharmacyRevenue,
    getConsultationRevenue,
    getNurseTriageRevenue,
    getOverallRevenue,
    getDashboardStats,
    getClinicalReport,
    getTheatreRevenue,
    getFamilyRevenue,
    getRetainershipRevenue,
    getVisitReport,
    getUserDashboardStats
};
