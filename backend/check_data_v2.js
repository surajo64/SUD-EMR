const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Patient = require('./models/patientModel');
const Charge = require('./models/chargeModel');
const Inventory = require('./models/inventoryModel');
const Prescription = require('./models/prescriptionModel');
const EncounterCharge = require('./models/encounterChargeModel');

dotenv.config({ path: path.join(__dirname, '.env') });

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        console.log('\n--- PATIENTS WITH RETAINERSHIP ---');
        const patients = await Patient.find({ provider: /Retainership/i });
        console.log(JSON.stringify(patients.map(p => ({ id: p._id, name: p.name, provider: p.provider, mrn: p.mrn })), null, 2));

        console.log('\n--- DRUG CHARGES IN CHARGES COLLECTION ---');
        const charges = await Charge.find({ type: 'drugs' });
        console.log(JSON.stringify(charges.map(c => ({
            name: c.name,
            standardFee: c.standardFee,
            retainershipFee: c.retainershipFee,
            familyRetainershipFee: c.familyRetainershipFee,
            basePrice: c.basePrice
        })), null, 2));

        console.log('\n--- LATEST PRESCRIPTIONS AND THEIR CHARGES ---');
        const prescriptions = await Prescription.find().sort({ createdAt: -1 }).limit(10).populate('patient').populate('charge');
        console.log(JSON.stringify(prescriptions.map(p => ({
            id: p._id,
            patientName: p.patient?.name,
            patientProvider: p.patient?.provider,
            medicines: p.medicines.map(m => m.name),
            charge: p.charge ? {
                id: p.charge._id,
                itemName: p.charge.itemName,
                unitPrice: p.charge.unitPrice,
                totalAmount: p.charge.totalAmount,
                patientPortion: p.charge.patientPortion,
                hmoPortion: p.charge.hmoPortion
            } : null
        })), null, 2));

        await mongoose.connection.close();
    } catch (err) {
        console.error(err);
    }
};

check();
