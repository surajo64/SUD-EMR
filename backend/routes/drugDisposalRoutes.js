const express = require('express');
const router = express.Router();
const {
    getDisposals,
    createDisposal,
    getDisposalStats
} = require('../controllers/drugDisposalController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getDisposals)
    .post(protect, createDisposal);

router.get('/stats', protect, getDisposalStats);

module.exports = router;
