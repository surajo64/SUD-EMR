const express = require('express');
const router = express.Router();
const {
    createPrescription,
    getPrescriptions,
    getPatientPrescriptions,
    getPrescriptionsByVisit,
    dispensePrescription,
    dispenseWithInventory
} = require('../controllers/prescriptionController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createPrescription)
    .get(protect, getPrescriptions);

router.get('/patient/:id', protect, getPatientPrescriptions);
router.get('/visit/:id', protect, getPrescriptionsByVisit);
router.put('/:id/dispense', protect, dispensePrescription);
router.put('/:id/dispense-with-inventory', protect, dispenseWithInventory);

module.exports = router;
