const express = require('express');
const router = express.Router();
const {
    getPharmacies,
    getPharmacyById,
    createPharmacy,
    updatePharmacy,
    deletePharmacy,
    getMainPharmacy
} = require('../controllers/pharmacyController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getPharmacies)
    .post(protect, admin, createPharmacy);

router.get('/main', protect, getMainPharmacy);

router.route('/:id')
    .get(protect, getPharmacyById)
    .put(protect, admin, updatePharmacy)
    .delete(protect, admin, deletePharmacy);

module.exports = router;
