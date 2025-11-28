const express = require('express');
const router = express.Router();
const {
    createReceipt,
    getReceipts,
    getReceiptById,
    createReceiptForCharges,
    validateReceipt,
    getReceiptByNumber,
    reverseReceipt,
    getReceiptsWithClaimStatus
} = require('../controllers/receiptController');
const { protect } = require('../middleware/authMiddleware');

router.route('/with-claim-status').get(protect, getReceiptsWithClaimStatus);
router.route('/').post(protect, createReceipt).get(protect, getReceipts);
router.route('/encounter').post(protect, createReceiptForCharges);
router.route('/validate').post(protect, validateReceipt);
router.route('/number/:receiptNumber').get(protect, getReceiptByNumber);
router.route('/:id/reverse').post(protect, reverseReceipt);
router.route('/:id').get(protect, getReceiptById);

module.exports = router;
