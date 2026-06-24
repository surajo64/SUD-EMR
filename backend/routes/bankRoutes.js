const express = require('express');
const router = express.Router();
const {
    getBanks,
    getBankById,
    getDefaultBank,
    createBank,
    updateBank,
    deleteBank,
    setDefaultBank
} = require('../controllers/bankController');
const { protect, admin, checkNotReadOnly } = require('../middleware/authMiddleware');

// Get default bank (accessible to all authenticated users)
router.get('/default', protect, getDefaultBank);

// Get all banks
router.get('/', protect, getBanks);

// Get single bank
router.get('/:id', protect, getBankById);

// Create bank (admin only)
router.post('/', protect, admin, checkNotReadOnly, createBank);

// Update bank (admin only)
router.put('/:id', protect, admin, checkNotReadOnly, updateBank);

// Set default bank (admin only)
router.put('/:id/set-default', protect, admin, checkNotReadOnly, setDefaultBank);

// Delete bank (admin only)
router.delete('/:id', protect, admin, checkNotReadOnly, deleteBank);

module.exports = router;
