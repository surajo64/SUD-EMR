const express = require('express');
const router = express.Router();
const {
    addDeposit,
    getHMOStatement,
    getTotalRetainershipBalance,
    getRetainershipDepositStatus,
    updateHMOTransaction,
    deleteHMOTransaction
} = require('../controllers/hmoTransactionController');
const { protect, admin } = require('../middleware/authMiddleware');

router.post('/deposit', protect, addDeposit);
router.get('/retainership-deposit-status', protect, getRetainershipDepositStatus);
router.get('/total-retainership-balance', protect, getTotalRetainershipBalance);
router.get('/statement/:hmoId', protect, getHMOStatement);
router.put('/:id', protect, admin, updateHMOTransaction);
router.delete('/:id', protect, admin, deleteHMOTransaction);

module.exports = router;
