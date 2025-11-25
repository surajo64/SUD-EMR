const express = require('express');
const router = express.Router();
const { createCharge, getCharges, updateCharge, deactivateCharge } = require('../controllers/chargeController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, createCharge).get(protect, getCharges);
router.route('/:id').put(protect, updateCharge).delete(protect, deactivateCharge);

module.exports = router;
