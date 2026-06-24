const express = require('express');
const router = express.Router();
const {
    createLabOrder,
    getLabOrders,
    getLabOrdersByVisit,
    updateLabResult,
    approveLabResult,
    rejectLabResult,
    deleteLabOrder,
    processDirectSale
} = require('../controllers/labController');
const { protect, scientist } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createLabOrder)
    .get(protect, getLabOrders);

router.get('/visit/:id', protect, getLabOrdersByVisit);
router.put('/:id/result', protect, updateLabResult);
router.put('/:id/approve', protect, approveLabResult);
router.put('/:id/reject', protect, scientist, rejectLabResult);
router.delete('/:id', protect, deleteLabOrder);
router.post('/pos-sale', protect, processDirectSale);

module.exports = router;
