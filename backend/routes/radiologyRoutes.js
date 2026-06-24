const express = require('express');
const router = express.Router();
const {
    createRadiologyOrder,
    getRadiologyOrders,
    getRadiologyOrdersByVisit,
    updateRadiologyReport,
    uploadRadiologyImages,
    deleteRadiologyImage,
    deleteRadiologyOrder,
    processDirectSale
} = require('../controllers/radiologyController');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../config/multerConfig');

router.route('/')
    .post(protect, createRadiologyOrder)
    .get(protect, getRadiologyOrders);

router.get('/visit/:id', protect, getRadiologyOrdersByVisit);
router.put('/:id/report', protect, updateRadiologyReport);

// Image upload and deletion routes
router.post('/:id/upload-images', protect, upload.array('images', 10), uploadRadiologyImages);
router.delete('/:id/images/:imageId', protect, deleteRadiologyImage);

router.delete('/:id', protect, deleteRadiologyOrder);
router.post('/pos-sale', protect, processDirectSale);

module.exports = router;
