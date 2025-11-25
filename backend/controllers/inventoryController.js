const Inventory = require('../models/inventoryModel');

// @desc Get all drugs
// @route GET /api/inventory
// @access Private
const getInventory = async (req, res) => {
    const items = await Inventory.find().sort({ createdAt: -1 });
    res.json(items);
};

// @desc Add new drug
// @route POST /api/inventory
// @access Private
const addInventoryItem = async (req, res) => {
    const { name, quantity, price, expiryDate, supplier } = req.body;

    if (!name || !quantity || !price || !expiryDate) {
        return res.status(400).json({ message: "Please fill all required fields" });
    }

    const item = await Inventory.create({
        name,
        quantity,
        price,
        expiryDate,
        supplier,
    });

    res.status(201).json(item);
};

// @desc Update drug
// @route PUT /api/inventory/:id
// @access Private
const updateInventoryItem = async (req, res) => {
    const { name, quantity, price, expiryDate, supplier } = req.body;

    const updatedItem = await Inventory.findByIdAndUpdate(
        req.params.id,
        { name, quantity, price, expiryDate, supplier },
        { new: true }
    );

    if (!updatedItem) return res.status(404).json({ message: "Item not found" });

    res.json(updatedItem);
};

// @desc Delete drug
// @route DELETE /api/inventory/:id
// @access Private
const deleteInventoryItem = async (req, res) => {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    await item.deleteOne();
    res.json({ message: "Item removed" });
};

// @desc Get inventory alerts (low stock, expiring, expired)
// @route GET /api/inventory/alerts
// @access Private
const getInventoryAlerts = async (req, res) => {
    try {
        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        const allItems = await Inventory.find();

        const lowStock = allItems.filter(item => item.quantity < item.reorderLevel);
        const expiringSoon = allItems.filter(item => {
            const expiryDate = new Date(item.expiryDate);
            return expiryDate > today && expiryDate <= thirtyDaysFromNow;
        });
        const expired = allItems.filter(item => new Date(item.expiryDate) < today);

        res.json({
            lowStock,
            expiringSoon,
            expired,
            summary: {
                lowStockCount: lowStock.length,
                expiringSoonCount: expiringSoon.length,
                expiredCount: expired.length
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    getInventoryAlerts,
};
