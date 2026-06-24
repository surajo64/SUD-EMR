const express = require('express');
const router = express.Router();
const {
    recordAdministration,
    getAdministrationHistory
} = require('../controllers/drugAdministrationController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, recordAdministration);
router.get('/visit/:visitId', protect, getAdministrationHistory);

module.exports = router;
