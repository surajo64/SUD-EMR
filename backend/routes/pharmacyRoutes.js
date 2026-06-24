const express = require('express');
const router = express.Router();
const {
    getPharmacies,
    getPharmacyById,
    createPharmacy,
    updatePharmacy,
    deletePharmacy,
    getMainPharmacy,
    processDirectSale
} = require('../controllers/pharmacyController');
const { protect, admin, checkNotReadOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getPharmacies)
    .post(protect, admin, checkNotReadOnly, createPharmacy);

router.get('/main', protect, getMainPharmacy);

// POS direct sale endpoint (Allow for cashier/pharmacist, but checkNotReadOnly for admin role)
router.post('/pos-sale', protect, checkNotReadOnly, processDirectSale);

router.route('/:id')
    .get(protect, getPharmacyById)
    .put(protect, admin, checkNotReadOnly, updatePharmacy)
    .delete(protect, admin, checkNotReadOnly, deletePharmacy);

module.exports = router;
