const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
    createReferral,
    getReferralsByVisit,
    getReferralById,
    updateReferral
} = require('../controllers/referralController');

router.post('/', protect, createReferral);
router.get('/visit/:id', protect, getReferralsByVisit);
router.get('/:id', protect, getReferralById);
router.put('/:id', protect, updateReferral);

module.exports = router;
