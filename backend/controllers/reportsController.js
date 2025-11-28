const LabOrder = require('../models/labOrderModel');
const RadiologyOrder = require('../models/radiologyOrderModel');
const Prescription = require('../models/prescriptionModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Visit = require('../models/visitModel');
const Patient = require('../models/patientModel');
const Receipt = require('../models/receiptModel');

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
            .populate('charge')
            .sort({ createdAt: -1 });

        const totalTests = labOrders.length;
        const completedTests = labOrders.filter(o => o.status === 'completed').length;
        const paidTests = labOrders.filter(o => o.charge?.status === 'paid').length;

        const totalRevenue = labOrders
            .filter(o => o.charge?.status === 'paid')
            .reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0);

        const pendingRevenue = labOrders
            .filter(o => o.charge?.status === 'pending')
            .reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0);

        // Group by test type
        const byTestType = {};
        labOrders.forEach(order => {
            const testName = order.testName;
            if (!byTestType[testName]) {
                byTestType[testName] = {
                    count: 0,
                    revenue: 0,
                    paid: 0,
                    pending: 0
                };
            }
            byTestType[testName].count++;
            if (order.charge?.status === 'paid') {
                byTestType[testName].revenue += order.charge.totalAmount;
                byTestType[testName].paid++;
            } else {
                byTestType[testName].pending++;
            }
        });

        res.json({
            summary: {
                totalTests,
                completedTests,
                paidTests,
                totalRevenue,
                pendingRevenue,
                dateRange: { start, end }
            },
            byTestType,
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
            .populate('charge')
            .sort({ createdAt: -1 });

        const totalScans = radOrders.length;
        const completedScans = radOrders.filter(o => o.status === 'completed').length;
        const paidScans = radOrders.filter(o => o.charge?.status === 'paid').length;

        const totalRevenue = radOrders
            .filter(o => o.charge?.status === 'paid')
            .reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0);

        const pendingRevenue = radOrders
            .filter(o => o.charge?.status === 'pending')
            .reduce((sum, o) => sum + (o.charge?.totalAmount || 0), 0);

        // Group by scan type
        const byScanType = {};
        radOrders.forEach(order => {
            const scanType = order.scanType;
            if (!byScanType[scanType]) {
                byScanType[scanType] = {
                    count: 0,
                    revenue: 0,
                    paid: 0,
                    pending: 0
                };
            }
            byScanType[scanType].count++;
            if (order.charge?.status === 'paid') {
                byScanType[scanType].revenue += order.charge.totalAmount;
                byScanType[scanType].paid++;
            } else {
                byScanType[scanType].pending++;
            }
        });

        res.json({
            summary: {
                totalScans,
                completedScans,
                paidScans,
                totalRevenue,
                pendingRevenue,
                dateRange: { start, end }
            },
            byScanType,
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
            .populate('charge')
            .sort({ createdAt: -1 });

        const totalPrescriptions = prescriptions.length;
        const dispensedPrescriptions = prescriptions.filter(p => p.status === 'dispensed').length;
        const paidPrescriptions = prescriptions.filter(p => p.charge?.status === 'paid').length;

        const totalRevenue = prescriptions
            .filter(p => p.charge?.status === 'paid')
            .reduce((sum, p) => sum + (p.charge?.totalAmount || 0), 0);

        const pendingRevenue = prescriptions
            .filter(p => p.charge?.status === 'pending')
            .reduce((sum, p) => sum + (p.charge?.totalAmount || 0), 0);

        // Group by drug
        const byDrug = {};
        prescriptions.forEach(prescription => {
            prescription.medicines.forEach(med => {
                if (!byDrug[med.name]) {
                    byDrug[med.name] = {
                        count: 0,
                        totalQuantity: 0
                    };
                }
                byDrug[med.name].count++;
                byDrug[med.name].totalQuantity += (med.quantity || 1);
            });
        });

        res.json({
            summary: {
                totalPrescriptions,
                dispensedPrescriptions,
                paidPrescriptions,
                totalRevenue,
                pendingRevenue,
                dateRange: { start, end }
            },
            byDrug,
            prescriptions
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

        const totalRevenue = consultationCharges
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + c.totalAmount, 0);

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
            .populate('patient', 'name');

        const totalCharges = charges.length;
        const paidCharges = charges.filter(c => c.status === 'paid').length;

        const totalRevenue = charges
            .filter(c => c.status === 'paid')
            .reduce((sum, c) => sum + c.totalAmount, 0);

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

        // Group by department
        const byDepartment = {
            lab: { revenue: 0, count: 0 },
            radiology: { revenue: 0, count: 0 },
            pharmacy: { revenue: 0, count: 0 },
            consultation: { revenue: 0, count: 0 },
            other: { revenue: 0, count: 0 }
        };

        charges.forEach(charge => {
            const type = charge.charge?.type || 'other';
            const dept = type === 'drugs' ? 'pharmacy' : type;

            if (byDepartment[dept]) {
                byDepartment[dept].count++;
                if (charge.status === 'paid') {
                    byDepartment[dept].revenue += charge.totalAmount;
                }
            } else {
                byDepartment.other.count++;
                if (charge.status === 'paid') {
                    byDepartment.other.revenue += charge.totalAmount;
                }
            }
        });

        res.json({
            summary: {
                totalCharges,
                paidCharges,
                totalRevenue,
                pendingRevenue,
                pendingInsuranceRevenue,
                pendingPatientRevenue,
                dateRange: { start, end }
            },
            byDepartment,
            charges
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

        // Revenue
        const revenueToday = await EncounterCharge.aggregate([
            { $match: { createdAt: { $gte: today }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        const revenueThisWeek = await EncounterCharge.aggregate([
            { $match: { createdAt: { $gte: thisWeek }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        const revenueThisMonth = await EncounterCharge.aggregate([
            { $match: { createdAt: { $gte: thisMonth }, status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

        const totalRevenue = await EncounterCharge.aggregate([
            { $match: { status: 'paid' } },
            { $group: { _id: null, total: { $sum: '$totalAmount' } } }
        ]);

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

        // Revenue by Department (All Time)
        const charges = await EncounterCharge.find({ status: 'paid' }).populate('charge', 'type');
        const revenueByDepartment = {};

        charges.forEach(c => {
            const type = c.charge?.type || 'other';
            const dept = type === 'drugs' ? 'pharmacy' : type; // Normalize 'drugs' to 'pharmacy'

            if (!revenueByDepartment[dept]) {
                revenueByDepartment[dept] = 0;
            }
            revenueByDepartment[dept] += c.totalAmount;
        });

        const revenueByDepartmentArray = Object.entries(revenueByDepartment).map(([name, value]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            revenue: value
        }));

        res.json({
            patients: {
                total: totalPatients,
                today: patientsToday,
                thisWeek: patientsThisWeek,
                thisMonth: patientsThisMonth
            },
            revenue: {
                today: revenueToday[0]?.total || 0,
                thisWeek: revenueThisWeek[0]?.total || 0,
                thisMonth: revenueThisMonth[0]?.total || 0,
                total: totalRevenue[0]?.total || 0
            },
            counts: {
                users: totalUsers,
                receipts: totalReceipts,
                charges: totalCharges
            },
            activeEncounters,
            activeEncounters,
            pendingPayments: pendingStats[0]?.total || 0,
            pendingInsurance: pendingStats[0]?.pendingInsurance || 0,
            pendingPatient: pendingStats[0]?.pendingPatient || 0,
            revenueByDepartment: revenueByDepartmentArray
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getLabRevenue,
    getRadiologyRevenue,
    getPharmacyRevenue,
    getConsultationRevenue,
    getOverallRevenue,
    getDashboardStats
};
