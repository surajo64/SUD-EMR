const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Patient = require('./models/patientModel');
const Charge = require('./models/chargeModel');
const Inventory = require('./models/inventoryModel');
const Prescription = require('./models/prescriptionModel');

dotenv.config({ path: path.join(__dirname, '.env') });

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        console.log('\n--- PATIENTS WITH RETAINERSHIP ---');
        const patients = await Patient.find({ provider: /Retainership/i });
        console.log(patients.map(p => ({ id: p._id, name: p.name, provider: p.provider, mrn: p.mrn })));

        console.log('\n--- SAMPLE PRESCRIPTIONS ---');
        const prescriptions = await Prescription.find().limit(5).populate('patient');
        console.log(prescriptions.map(p => ({
            id: p._id,
            patientName: p.patient?.name,
            patientProvider: p.patient?.provider,
            medicines: p.medicines,
            charge: p.charge
        })));

        console.log('\n--- INVENTORY DRUGS WITH FEES ---');
        const inventory = await Inventory.find({ familyRetainershipFee: { $gt: 0 } }).limit(5);
        console.log(inventory.map(i => ({
            name: i.name,
            price: i.price,
            standardFee: i.standardFee,
            retainershipFee: i.retainershipFee,
            familyRetainershipFee: i.familyRetainershipFee
        })));

        console.log('\n--- DRUG CHARGES WITH FEES ---');
        const charges = await Charge.find({ type: 'drugs', familyRetainershipFee: { $gt: 0 } }).limit(5);
        console.log(charges.map(c => ({
            name: c.name,
            standardFee: c.standardFee,
            retainershipFee: c.retainershipFee,
            familyRetainershipFee: c.familyRetainershipFee
        })));

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

check();
