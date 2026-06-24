const express = require('express');
const router = express.Router();
const {
    createWard,
    getWards,
    updateWard,
    deleteWard
} = require('../controllers/wardController');
const { protect, admin, checkNotReadOnly } = require('../middleware/authMiddleware');

router.route('/').post(protect, admin, checkNotReadOnly, createWard).get(protect, getWards);
router.route('/:id').put(protect, admin, checkNotReadOnly, updateWard).delete(protect, admin, checkNotReadOnly, deleteWard);

module.exports = router;
