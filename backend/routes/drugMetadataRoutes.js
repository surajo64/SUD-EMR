const express = require('express');
const router = express.Router();
const {
    getDrugMetadata,
    createDrugMetadata,
    updateDrugMetadata,
    deleteDrugMetadata
} = require('../controllers/drugMetadataController');
const { protect, admin, pharmacy, checkNotReadOnly } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getDrugMetadata)
    .post(protect, pharmacy, checkNotReadOnly, createDrugMetadata);

router.route('/:id')
    .put(protect, pharmacy, checkNotReadOnly, updateDrugMetadata)
    .delete(protect, pharmacy, checkNotReadOnly, deleteDrugMetadata);

module.exports = router;
