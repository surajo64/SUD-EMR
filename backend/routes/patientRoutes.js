const express = require('express');
const router = express.Router();
const {
    registerPatient,
    getPatients,
    updatePatient,
    deletePatient,
    addDeposit,
    refundDeposit,
    getDepositBalance,
    getRecentPatients,
    getPatientById
} = require('../controllers/patientController');
const { protect, admin, checkNotReadOnly } = require('../middleware/authMiddleware');

router.route('/recent').get(protect, getRecentPatients);
router.route('/').post(protect, checkNotReadOnly, registerPatient).get(protect, getPatients);
router.route('/:id')
    .get(protect, getPatientById)
    .put(protect, checkNotReadOnly, updatePatient)
    .delete(protect, admin, checkNotReadOnly, deletePatient);

router.route('/:id/deposit')
    .post(protect, checkNotReadOnly, addDeposit)
    .get(protect, getDepositBalance);

router.route('/:id/refund').post(protect, admin, checkNotReadOnly, refundDeposit);

module.exports = router;
