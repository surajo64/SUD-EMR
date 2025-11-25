const express = require('express');
const router = express.Router();
const {
    createInvoice,
    getInvoices,
    updateInvoiceStatus,
    reverseInvoice,
    bulkPayInsurance
} = require('../controllers/invoiceController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, createInvoice).get(protect, getInvoices);
router.route('/:id/pay').put(protect, updateInvoiceStatus);
router.route('/:id/reverse').put(protect, reverseInvoice);
router.post('/bulk-pay-insurance', protect, bulkPayInsurance);

module.exports = router;
