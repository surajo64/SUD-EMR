const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, admin } = require('../middleware/authMiddleware');
const {
    getHMOs,
    getHMOById,
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
    .post(protect, admin, createHMO);

router.post('/import-excel', protect, admin, upload.single('file'), importHMOsFromExcel);

router.route('/:id')
    .get(protect, getHMOById)
    .put(protect, admin, updateHMO)
    .delete(protect, admin, deleteHMO);

router.patch('/:id/toggle-status', protect, admin, toggleHMOStatus);

module.exports = router;
