const mongoose = require('mongoose');
const dotenv = require('dotenv');
const HMO = require('./models/hmoModel');
const HMOTransaction = require('./models/hmoTransactionModel');
const Patient = require('./models/patientModel');
const EncounterCharge = require('./models/encounterChargeModel');

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const allHMOs = await HMO.find({});
        console.log(`Total HMOs in DB: ${allHMOs.length}`);
        
        const retainershipHMOs = await HMO.find({ category: 'Retainership' });
        console.log(`Retainership HMOs: ${retainershipHMOs.length}`);
        retainershipHMOs.forEach(h => {
            console.log(`- ${h.name} (ID: ${h._id}, category: ${h.category}, active: ${h.active})`);
        });

        const hmoIds = retainershipHMOs.map(h => h._id);
        const hmoNames = retainershipHMOs.map(h => h.name);

        const deposits = await HMOTransaction.find({ hmo: { $in: hmoIds }, type: 'deposit' });
        console.log(`Deposits matching hmoIds: ${deposits.length}`);
        deposits.forEach(d => {
            console.log(`- Deposit of ${d.amount} for HMO ID ${d.hmo}`);
        });

        // Let's also check all HMO transactions in the DB to see if any exist and what HMO reference they have
        const allTx = await HMOTransaction.find({});
        console.log(`Total HMO Transactions in DB: ${allTx.length}`);
        allTx.forEach(t => {
            console.log(`- Tx: type=${t.type}, amount=${t.amount}, hmo=${t.hmo}`);
        });

        const patients = await Patient.find({ hmo: { $in: hmoNames } });
        console.log(`Patients with HMO matching hmoNames: ${patients.length}`);

        const patientIds = patients.map(p => p._id);
        const charges = await EncounterCharge.find({
            patient: { $in: patientIds },
            hmoPortion: { $gt: 0 }
        });
        console.log(`Charges: ${charges.length}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
