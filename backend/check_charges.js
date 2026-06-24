const mongoose = require('mongoose');
const Charge = require('./models/chargeModel');
require('dotenv').config();

async function checkCharges() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/kuntau');
        const familyCharges = await Charge.find({ type: 'family', active: true });
        console.log('Family Charges:', JSON.stringify(familyCharges, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCharges();
