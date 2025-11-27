const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { addDeposit, getHMOStatement } = require('../controllers/hmoTransactionController');

router.post('/deposit', protect, addDeposit);
router.get('/statement/:hmoId', protect, getHMOStatement);

module.exports = router;
