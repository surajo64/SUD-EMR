const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const Prescription = require('./models/prescriptionModel');
const EncounterCharge = require('./models/encounterChargeModel');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const p = await Prescription.findById('6a411d4d574acf618e3835a0').populate('charge');
        if (p) {
            console.log('Prescription Created At:', p.createdAt);
            console.log('Charge Created At:', p.charge?.createdAt);
            console.log('Charge UnitPrice:', p.charge?.unitPrice);
        }
        await mongoose.connection.close();
    } catch (e) {
        console.error(e);
    }
};

run();
