const express = require('express');
const router = express.Router();
const { createVisit, getVisits, updateVisit, getVisitById, deleteVisit, getVisitsByPatient } = require('../controllers/visitController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .post(protect, createVisit)
    .get(protect, getVisits);

router.route('/patient/:patientId')
    .get(protect, getVisitsByPatient);

router.route('/:id')
    .put(protect, updateVisit)
    .get(protect, getVisitById)
    .delete(protect, admin, deleteVisit);

router.route('/:id/notes').post(protect, require('../controllers/visitController').addNote);
router.route('/:id/ward-round-notes').post(protect, require('../controllers/visitController').addWardRoundNote);
router.route('/:id/theatre-notes').post(protect, require('../controllers/visitController').saveTheatreNote);
router.route('/:id/theatre-notes/:noteId/consent').post(protect, require('../config/consentMulterConfig').single('consentFile'), require('../controllers/visitController').saveConsentNote);
router.route('/:id/consents').post(protect, require('../config/consentMulterConfig').single('consentFile'), require('../controllers/visitController').saveConsentNote);
router.route('/:id/checklists').post(protect, require('../controllers/visitController').saveChecklist);
router.route('/:id/pre-anaesthesia-checklists').post(protect, require('../controllers/visitController').savePreAnaesthesiaChecklist);
router.route('/:id/postoperative-handover-checklists').post(protect, require('../controllers/visitController').savePostoperativeHandoverChecklist);
router.route('/:id/clinical-notes').post(protect, require('../controllers/visitController').saveClinicalNote);
router.route('/:id/convert-to-inpatient').put(protect, require('../controllers/visitController').convertToInpatient);
router.route('/:id/change-type').put(protect, require('../controllers/visitController').changeEncounterType);

module.exports = router;
