const express = require('express');
const router = express.Router();
const {
    createRadiologyOrder,
    getRadiologyOrders,
    getRadiologyOrdersByVisit,
    updateRadiologyReport
} = require('../controllers/radiologyController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createRadiologyOrder)
    .get(protect, getRadiologyOrders);

router.get('/visit/:id', protect, getRadiologyOrdersByVisit);
router.put('/:id/report', protect, updateRadiologyReport);

module.exports = router;
