const express = require('express');
const router = express.Router();
const { protect, adminOrReceptionist } = require('../middleware/authMiddleware');
const {
    createFamilyFile,
    getFamilyFiles,
    getFamilyFileById,
    updateFamilyFile,
    deleteFamilyFile,
    getNextFamilyFileNumber
} = require('../controllers/familyFileController');

router.get('/next-number', protect, getNextFamilyFileNumber);

router.get('/', protect, getFamilyFiles);
router.post('/', protect, adminOrReceptionist, createFamilyFile);

router.get('/:id', protect, getFamilyFileById);
router.put('/:id', protect, adminOrReceptionist, updateFamilyFile);
router.delete('/:id', protect, adminOrReceptionist, deleteFamilyFile);

module.exports = router;
