const express = require('express');
const router = express.Router();
const {
    getLabRevenue,
    getRadiologyRevenue,
    getPharmacyRevenue,
    getConsultationRevenue,
    getNurseTriageRevenue,
    getOverallRevenue,
    getDashboardStats,
    getClinicalReport,
    getVisitReport,
    getTheatreRevenue,
    getFamilyRevenue,
    getRetainershipRevenue,
    getUserDashboardStats
} = require('../controllers/reportsController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/lab-revenue', protect, admin, getLabRevenue);
router.get('/radiology-revenue', protect, admin, getRadiologyRevenue);
router.get('/pharmacy-revenue', protect, admin, getPharmacyRevenue);
router.get('/consultation-revenue', protect, admin, getConsultationRevenue);
router.get('/nurse-triage-revenue', protect, admin, getNurseTriageRevenue);
router.get('/theatre-revenue', protect, admin, getTheatreRevenue);
router.get('/family-revenue', protect, admin, getFamilyRevenue);
router.get('/retainership-revenue', protect, admin, getRetainershipRevenue);
router.get('/overall-revenue', protect, admin, getOverallRevenue);
router.get('/dashboard-stats', protect, admin, getDashboardStats);
router.get('/clinical-report', protect, admin, getClinicalReport);
router.get('/visit-report', protect, admin, getVisitReport);
router.get('/user-stats', protect, getUserDashboardStats);

module.exports = router;
