const express = require('express');
const router = express.Router();
const { getDashboardSummary } = require('../controllers/financialController');
const { protect } = require('../middleware/authMiddleware');

router.get('/dashboard-summary', protect, getDashboardSummary);

module.exports = router;
