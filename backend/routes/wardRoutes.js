const express = require('express');
const router = express.Router();
const {
    createWard,
    getWards,
    updateWard,
    deleteWard
} = require('../controllers/wardController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').post(protect, admin, createWard).get(protect, getWards);
router.route('/:id').put(protect, admin, updateWard).delete(protect, admin, deleteWard);

module.exports = router;
