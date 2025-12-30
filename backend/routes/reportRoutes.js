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
    getClinicalReport
} = require('../controllers/reportsController');
const { protect, admin } = require('../middleware/authMiddleware');

router.get('/lab-revenue', protect, admin, getLabRevenue);
router.get('/radiology-revenue', protect, admin, getRadiologyRevenue);
router.get('/pharmacy-revenue', protect, admin, getPharmacyRevenue);
router.get('/consultation-revenue', protect, admin, getConsultationRevenue);
router.get('/nurse-triage-revenue', protect, admin, getNurseTriageRevenue);
router.get('/overall-revenue', protect, admin, getOverallRevenue);
router.get('/dashboard-stats', protect, admin, getDashboardStats);
router.get('/clinical-report', protect, admin, getClinicalReport);

module.exports = router;
