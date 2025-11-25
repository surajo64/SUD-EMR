const express = require('express');
const router = express.Router();
const {
    registerPatient,
    getPatients,
    updatePatient,
    deletePatient,
    addDeposit,
    getDepositBalance,
    getRecentPatients
} = require('../controllers/patientController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/recent').get(protect, getRecentPatients);
router.route('/').post(protect, registerPatient).get(protect, getPatients);
router.route('/:id')
    .put(protect, updatePatient)
    .delete(protect, admin, deletePatient);

router.route('/:id/deposit')
    .post(protect, addDeposit)
    .get(protect, getDepositBalance);

module.exports = router;
