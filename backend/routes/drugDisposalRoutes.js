const express = require('express');
const router = express.Router();
const {
    getDisposals,
    createDisposal,
    returnToMainPharmacy,
    getDisposalStats
} = require('../controllers/drugDisposalController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getDisposals)
    .post(protect, createDisposal);

router.post('/return', protect, returnToMainPharmacy);
router.get('/stats', protect, getDisposalStats);

module.exports = router;
