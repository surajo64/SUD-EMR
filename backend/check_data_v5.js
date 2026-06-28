const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const Inventory = require('./models/inventoryModel');

const check = async () => {
    let out = '';
    const log = (msg) => {
        out += msg + '\n';
        console.log(msg);
    };

    try {
        await mongoose.connect(process.env.MONGO_URI);
        log('Connected to DB');

        log('\n--- ALL INVENTORY ITEMS ---');
        try {
            const items = await Inventory.find({});
            for (const i of items) {
                log(`Drug: ${i.name}, price/basePrice: ${i.price}, Std: ${i.standardFee}, Corp: ${i.retainershipFee}, Fam: ${i.familyRetainershipFee}, Qty: ${i.quantity}`);
            }
        } catch (e) {
            log(`Error fetching inventory: ${e.message}`);
        }

        await mongoose.connection.close();
    } catch (err) {
        log(`Connection error: ${err.message}`);
    }

    fs.writeFileSync('output_inventory.txt', out, 'utf-8');
};

check();
