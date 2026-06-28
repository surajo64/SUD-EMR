const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patientModel');
const Charge = require('./models/chargeModel');
const Inventory = require('./models/inventoryModel');
const Prescription = require('./models/prescriptionModel');

const simulate = async () => {
    let out = '';
    const log = (msg) => {
        out += msg + '\n';
        console.log(msg);
    };

    try {
        await mongoose.connect(process.env.MONGO_URI);
        log('Connected to DB');

        const prescriptionId = '6a411d4d574acf618e3835a0';
        const prescription = await Prescription.findById(prescriptionId).populate('patient');
        if (!prescription) {
            log('Prescription not found');
            return;
        }

        log('\n--- SIMULATING FOR PRESCRIPTION ---');
        log('Prescription ID: ' + prescription._id);
        log('Patient Name: ' + prescription.patient?.name);
        log('Patient Provider: ' + prescription.patient?.provider);
        log('Medicines: ' + JSON.stringify(prescription.medicines));

        const medicine = prescription.medicines[0];
        log('Target Medicine Name: ' + medicine.name);

        let drugCharge = await Charge.findOne({
            type: 'drugs',
            name: medicine.name,
            active: true
        });
        log('Found Drug Charge in DB: ' + (drugCharge ? JSON.stringify({
            _id: drugCharge._id,
            name: drugCharge.name,
            standardFee: drugCharge.standardFee,
            retainershipFee: drugCharge.retainershipFee,
            familyRetainershipFee: drugCharge.familyRetainershipFee,
            basePrice: drugCharge.basePrice
        }) : 'null'));

        const inventoryItem = await Inventory.findOne({
            name: medicine.name,
            quantity: { $gt: 0 }
        }).sort({ createdAt: -1 });

        log('Found Inventory Item in DB: ' + (inventoryItem ? JSON.stringify({
            _id: inventoryItem._id,
            name: inventoryItem.name,
            price: inventoryItem.price,
            standardFee: inventoryItem.standardFee,
            retainershipFee: inventoryItem.retainershipFee,
            familyRetainershipFee: inventoryItem.familyRetainershipFee,
            quantity: inventoryItem.quantity
        }) : 'null'));

        const patient = prescription.patient;
        let fee = 0;

        if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership') {
            fee = drugCharge.retainershipFee || 0;
            if (!fee && inventoryItem) fee = inventoryItem.retainershipFee || 0;
        } else if (patient.provider === 'Family Retainership') {
            fee = drugCharge?.familyRetainershipFee || 0;
            if (!fee && inventoryItem) fee = inventoryItem.familyRetainershipFee || 0;
        }

        log('Calculated Step 1 Fee: ' + fee);

        if (fee === 0) {
            fee = drugCharge?.standardFee || drugCharge?.basePrice || (inventoryItem ? inventoryItem.standardFee || inventoryItem.price : 0);
        }
        log('Calculated Final Fee: ' + fee);

        await mongoose.connection.close();
    } catch (e) {
        log('Error: ' + e.message);
    }

    fs.writeFileSync('out_sim_utf8.txt', out, 'utf-8');
};

simulate();
