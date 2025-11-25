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
    route: { type: String },
    form: { type: String },
    dosage: { type: String },
    frequency: { type: String },
    drugUnit: { type: String, enum: ['unit', 'sachet', 'packet'], default: 'unit' },
    pharmacy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pharmacy',
        required: true
    }
}, {
    timestamps: true,
});

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;
