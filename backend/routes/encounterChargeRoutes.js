const express = require('express');
const router = express.Router();
const {
    addChargeToEncounter,
    getEncounterCharges,
    getPatientCharges,
    markChargePaid,
    updateEncounterCharge,
    deleteEncounterCharge,
    triggerDailyWardCharges
} = require('../controllers/encounterChargeController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').post(protect, addChargeToEncounter);
router.route('/trigger-daily-charges').post(protect, triggerDailyWardCharges);
router.route('/encounter/:encounterId').get(protect, getEncounterCharges);
router.route('/patient/:patientId').get(protect, getPatientCharges);
router.route('/:id/pay').put(protect, markChargePaid);
router.route('/:id').put(protect, updateEncounterCharge).delete(protect, admin, deleteEncounterCharge);

module.exports = router;
