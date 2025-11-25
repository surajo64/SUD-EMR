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

module.exports = router;
