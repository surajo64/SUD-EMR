const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

const Patient = require('./models/patientModel');
const Charge = require('./models/chargeModel');
const Inventory = require('./models/inventoryModel');
const Prescription = require('./models/prescriptionModel');
const EncounterCharge = require('./models/encounterChargeModel');

const check = async () => {
    let out = '';
    const log = (msg) => {
        out += msg + '\n';
        console.log(msg);
    };

    try {
        await mongoose.connect(process.env.MONGO_URI);
        log('Connected to DB');

        log('\n--- PATIENTS WITH RETAINERSHIP ---');
        try {
            const patients = await Patient.find({ provider: /Retainership/i });
            for (const p of patients) {
                log(`Patient: ${p.name}, Provider: ${p.provider}, MRN: ${p.mrn}`);
            }
        } catch (e) {
            log(`Error fetching patients: ${e.message}`);
        }

        log('\n--- DRUG CHARGES IN CHARGES COLLECTION ---');
        try {
            const charges = await Charge.find({ type: 'drugs' });
            for (const c of charges) {
                log(`DrugCharge: ${c.name}, Std: ${c.standardFee}, Corp: ${c.retainershipFee}, Fam: ${c.familyRetainershipFee}`);
            }
        } catch (e) {
            log(`Error fetching charges: ${e.message}`);
        }

        log('\n--- LATEST PRESCRIPTIONS ---');
        try {
            const prescriptions = await Prescription.find().sort({ createdAt: -1 }).limit(10).populate('patient').populate('charge');
            for (const p of prescriptions) {
                log(`Prescription: ID: ${p._id}, Patient: ${p.patient?.name}, Provider: ${p.patient?.provider}, Medicines: ${p.medicines.map(m => m.name).join(', ')}, Status: ${p.status}`);
                if (p.charge) {
                    log(`  -> Charge: ${p.charge.itemName}, UnitPrice: ${p.charge.unitPrice}, Total: ${p.charge.totalAmount}, PatPortion: ${p.charge.patientPortion}, HmoPortion: ${p.charge.hmoPortion}`);
                } else {
                    log('  -> No charge generated yet');
                }
            }
        } catch (e) {
            log(`Error fetching prescriptions: ${e.message}`);
        }

        await mongoose.connection.close();
    } catch (err) {
        log(`Connection error: ${err.message}`);
    }

    fs.writeFileSync('output_utf8.txt', out, 'utf-8');
};

check();
