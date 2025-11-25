const express = require('express');
const router = express.Router();
const {
    getDrugMetadata,
    createDrugMetadata,
    updateDrugMetadata,
    deleteDrugMetadata
} = require('../controllers/drugMetadataController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getDrugMetadata)
    .post(protect, admin, createDrugMetadata);

router.route('/:id')
    .put(protect, admin, updateDrugMetadata)
    .delete(protect, admin, deleteDrugMetadata);

module.exports = router;
