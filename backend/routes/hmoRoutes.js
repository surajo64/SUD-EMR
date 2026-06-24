const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, admin, adminOrReceptionist, checkNotReadOnly } = require('../middleware/authMiddleware');
const {
    getHMOs,
    getHMOById,
    getNextHMOCode,
    createHMO,
    updateHMO,
    deleteHMO,
    toggleHMOStatus,
    importHMOsFromExcel
} = require('../controllers/hmoController');

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel') {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'), false);
        }
    }
});

// Routes
router.route('/')
    .get(protect, getHMOs)
    .post(protect, adminOrReceptionist, checkNotReadOnly, createHMO);

router.post('/import-excel', protect, adminOrReceptionist, checkNotReadOnly, upload.single('file'), importHMOsFromExcel);
router.get('/next-code', protect, getNextHMOCode);

router.route('/:id')
    .get(protect, getHMOById)
    .put(protect, adminOrReceptionist, checkNotReadOnly, updateHMO)
    .delete(protect, adminOrReceptionist, checkNotReadOnly, deleteHMO);

router.patch('/:id/toggle-status', protect, adminOrReceptionist, checkNotReadOnly, toggleHMOStatus);

module.exports = router;
