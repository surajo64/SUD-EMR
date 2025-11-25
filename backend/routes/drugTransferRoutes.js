const express = require('express');
const router = express.Router();
const {
    getTransfers,
    createTransferRequest,
    approveTransfer,
    rejectTransfer
} = require('../controllers/drugTransferController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getTransfers)
    .post(protect, createTransferRequest);

router.put('/:id/approve', protect, approveTransfer);
router.put('/:id/reject', protect, rejectTransfer);

module.exports = router;
