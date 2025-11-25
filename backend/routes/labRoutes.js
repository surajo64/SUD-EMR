const express = require('express');
const router = express.Router();
const {
    createLabOrder,
    getLabOrders,
    getLabOrdersByVisit,
    updateLabResult,
    approveLabResult
} = require('../controllers/labController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createLabOrder)
    .get(protect, getLabOrders);

router.get('/visit/:id', protect, getLabOrdersByVisit);
router.put('/:id/result', protect, updateLabResult);
router.put('/:id/approve', protect, approveLabResult);

module.exports = router;
