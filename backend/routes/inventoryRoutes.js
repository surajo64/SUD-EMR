const express = require('express');
const router = express.Router();
const {
    getInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    getInventoryAlerts,
    getProfitLossReport
} = require('../controllers/inventoryController');
const { protect } = require('../middleware/authMiddleware');

router.get("/alerts", protect, getInventoryAlerts);
router.get("/reports/profit-loss", protect, getProfitLossReport);

router.route("/")
    .get(protect, getInventory)
    .post(protect, addInventoryItem);

router.route("/:id")
    .put(protect, updateInventoryItem)
    .delete(protect, deleteInventoryItem);

module.exports = router;
