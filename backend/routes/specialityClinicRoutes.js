const express = require('express');
const router = express.Router();
const {
    getSpecialityClinics,
    getSpecialityClinicById,
    createSpecialityClinic,
    updateSpecialityClinic,
    deleteSpecialityClinic
} = require('../controllers/specialityClinicController');
const { protect, adminOrReceptionist, checkNotReadOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getSpecialityClinics)
    .post(protect, adminOrReceptionist, checkNotReadOnly, createSpecialityClinic);

router.route('/:id')
    .get(protect, getSpecialityClinicById)
    .put(protect, adminOrReceptionist, checkNotReadOnly, updateSpecialityClinic)
    .delete(protect, adminOrReceptionist, checkNotReadOnly, deleteSpecialityClinic);

module.exports = router;
