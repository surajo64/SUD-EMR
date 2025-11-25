const mongoose = require('mongoose');

const inventorySchema = mongoose.Schema({
    name: { type: String, required: true },
    quantity: { type: Number, required: true, default: 0 },
    price: { type: Number, required: true },
    expiryDate: { type: Date, required: true },
    supplier: { type: String },
    batchNumber: { type: String },
    barcode: { type: String },
    reorderLevel: { type: Number, default: 10 }, // Alert when stock falls below this
}, {
    timestamps: true,
});

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;
