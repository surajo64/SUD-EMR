const express = require('express');
const router = express.Router();
const multer = require('multer');
const { createCharge, getCharges, updateCharge, deactivateCharge, importChargesFromExcel } = require('../controllers/chargeController');
const { protect, checkNotReadOnly } = require('../middleware/authMiddleware');

// Configure multer for Excel file uploads (memory storage)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'), false);
        }
    }
});

router.route('/').post(protect, checkNotReadOnly, createCharge).get(protect, getCharges);
router.post('/import-excel', protect, checkNotReadOnly, upload.single('file'), importChargesFromExcel);
router.route('/:id').put(protect, checkNotReadOnly, updateCharge).delete(protect, checkNotReadOnly, deactivateCharge);

module.exports = router;
