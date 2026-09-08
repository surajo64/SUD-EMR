const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const Inventory = require('./models/inventoryModel');

async function checkBatches() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const drugName = 'Tab Nipidipine';
        const items = await Inventory.find({
            name: { $regex: new RegExp(`^${drugName}$`, 'i') }
        }).populate('pharmacy', 'name');

        console.log(`Found ${items.length} records for "${drugName}":`);
        items.forEach((item, i) => {
            console.log(`${i + 1}. ID: ${item._id}, Qty: ${item.quantity}, Batch: ${item.batchNumber}, Expiry: ${item.expiryDate}, Pharmacy: ${item.pharmacy?.name}`);
        });

        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

checkBatches();
