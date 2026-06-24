const express = require('express');
const router = express.Router();
const {
    getClinics,
    getClinicById,
    createClinic,
    updateClinic,
    deleteClinic
} = require('../controllers/clinicController');
const { protect, checkNotReadOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getClinics)
    .post(protect, checkNotReadOnly, createClinic);

router.route('/:id')
    .get(protect, getClinicById)
    .put(protect, checkNotReadOnly, updateClinic)
    .delete(protect, checkNotReadOnly, deleteClinic);

module.exports = router;
