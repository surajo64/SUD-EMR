const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config();

const Inventory = require('./models/inventoryModel');

async function testFEFO() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const drugName = 'Tab Nipidipine';
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // This matches the logic in pharmacyController.js and prescriptionController.js
        const batches = await Inventory.find({
            name: { $regex: new RegExp(`^${drugName}$`, 'i') },
            quantity: { $gt: 0 },
            expiryDate: { $gte: today }
        }).sort({ expiryDate: 1 });

        console.log(`Found ${batches.length} valid batches for "${drugName}":`);
        batches.forEach((b, i) => {
            console.log(`${i + 1}. Batch: ${b.batchNumber}, Expiry: ${b.expiryDate.toISOString().split('T')[0]}, Qty: ${b.quantity}`);
        });

        if (batches.length > 1) {
            const firstExpiry = batches[0].expiryDate;
            const secondExpiry = batches[1].expiryDate;
            if (firstExpiry <= secondExpiry) {
                console.log('✅ PASS: Earliest expiry batch is first in the list.');
            } else {
                console.log('❌ FAIL: Earliest expiry batch is NOT first.');
            }
        } else {
            console.log('Note: Only 1 or 0 batches found. Add more batches to verify sorting.');
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

testFEFO();
