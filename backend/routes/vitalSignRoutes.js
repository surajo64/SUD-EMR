const express = require('express');
const router = express.Router();
const { createVitalSign, getVitalsByVisit, updateVitalSign } = require('../controllers/vitalSignController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, createVitalSign);
router.get('/visit/:id', protect, getVitalsByVisit);
router.put('/:id', protect, updateVitalSign);

module.exports = router;
