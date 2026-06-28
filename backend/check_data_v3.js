const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patientModel');
const Charge = require('./models/chargeModel');
const Inventory = require('./models/inventoryModel');
const Prescription = require('./models/prescriptionModel');
const EncounterCharge = require('./models/encounterChargeModel');

const check = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        console.log('\n--- PATIENTS WITH RETAINERSHIP ---');
        try {
            const patients = await Patient.find({ provider: /Retainership/i });
            for (const p of patients) {
                console.log(`Patient: ${p.name}, Provider: ${p.provider}, MRN: ${p.mrn}`);
            }
        } catch (e) {
            console.error('Error fetching patients:', e.message);
        }

        console.log('\n--- DRUG CHARGES IN CHARGES COLLECTION ---');
        try {
            const charges = await Charge.find({ type: 'drugs' });
            for (const c of charges) {
                console.log(`DrugCharge: ${c.name}, Std: ${c.standardFee}, Corp: ${c.retainershipFee}, Fam: ${c.familyRetainershipFee}`);
            }
        } catch (e) {
            console.error('Error fetching charges:', e.message);
        }

        console.log('\n--- LATEST PRESCRIPTIONS ---');
        try {
            const prescriptions = await Prescription.find().sort({ createdAt: -1 }).limit(5).populate('patient').populate('charge');
            for (const p of prescriptions) {
                console.log(`Prescription: ID: ${p._id}, Patient: ${p.patient?.name}, Provider: ${p.patient?.provider}, Medicines: ${p.medicines.map(m => m.name).join(', ')}, Status: ${p.status}`);
                if (p.charge) {
                    console.log(`  -> Charge: ${p.charge.itemName}, UnitPrice: ${p.charge.unitPrice}, Total: ${p.charge.totalAmount}, PatPortion: ${p.charge.patientPortion}, HmoPortion: ${p.charge.hmoPortion}`);
                } else {
                    console.log('  -> No charge generated yet');
                }
            }
        } catch (e) {
            console.error('Error fetching prescriptions:', e.message);
            console.error(e.stack);
        }

        await mongoose.connection.close();
    } catch (err) {
        console.error('Connection error:', err);
    }
};

check();
