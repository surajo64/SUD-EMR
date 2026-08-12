const express = require('express');
const router = express.Router();
const {
    addChargeToEncounter,
    getEncounterCharges,
    getPatientCharges,
    markChargePaid,
    updateEncounterCharge,
    deleteEncounterCharge,
    reverseAllPatientCharges,
    reverseSelectedCharges,
    triggerDailyWardCharges
} = require('../controllers/encounterChargeController');
const { protect, admin, checkNotReadOnly } = require('../middleware/authMiddleware');

router.route('/').post(protect, addChargeToEncounter);
router.route('/trigger-daily-charges').post(protect, triggerDailyWardCharges);
router.route('/encounter/:encounterId').get(protect, getEncounterCharges);
router.route('/patient/:patientId').get(protect, getPatientCharges);
router.route('/patient/:patientId/reverse-all').post(protect, admin, checkNotReadOnly, reverseAllPatientCharges);
router.route('/reverse-selected').post(protect, admin, checkNotReadOnly, reverseSelectedCharges);
router.route('/:id/pay').put(protect, markChargePaid);
router.route('/:id').put(protect, updateEncounterCharge).delete(protect, admin, checkNotReadOnly, deleteEncounterCharge);

module.exports = router;



