const express = require('express');
const router = express.Router();
const {
    getClinics,
    getClinicById,
    createClinic,
    updateClinic,
    deleteClinic
} = require('../controllers/clinicController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getClinics)
    .post(protect, createClinic);

router.route('/:id')
    .get(protect, getClinicById)
    .put(protect, updateClinic)
    .delete(protect, deleteClinic);

module.exports = router;
