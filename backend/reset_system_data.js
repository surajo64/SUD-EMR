const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Models
const Setting = require('./models/settingModel');
const Patient = require('./models/patientModel');
const Visit = require('./models/visitModel');
const VitalSign = require('./models/vitalSignModel');
const Appointment = require('./models/appointmentModel');
const Prescription = require('./models/prescriptionModel');
const Receipt = require('./models/receiptModel');
const Invoice = require('./models/invoiceModel');
const EncounterCharge = require('./models/encounterChargeModel');
const LabOrder = require('./models/labOrderModel');
const RadiologyOrder = require('./models/radiologyOrderModel');
const Claim = require('./models/claimModel');
const Referral = require('./models/referralModel');

dotenv.config();

const resetData = async () => {
    try {
        console.log('Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected successfully.');

        const collectionsToClear = [
            { name: 'Patients', model: Patient },
            { name: 'Visits', model: Visit },
            { name: 'Vital Signs', model: VitalSign },
            { name: 'Appointments', model: Appointment },
            { name: 'Prescriptions', model: Prescription },
            { name: 'Receipts', model: Receipt },
            { name: 'Invoices', model: Invoice },
            { name: 'Encounter Charges', model: EncounterCharge },
            { name: 'Lab Orders', model: LabOrder },
            { name: 'Radiology Orders', model: RadiologyOrder },
            { name: 'Claims', model: Claim },
            { name: 'Referrals', model: Referral }
        ];

        console.log('\n--- Clearing Trial Data ---');
        for (const item of collectionsToClear) {
            const count = await item.model.countDocuments();
            if (count > 0) {
                await item.model.deleteMany({});
                console.log(`Deleted ${count} records from ${item.name}`);
            } else {
                console.log(`${item.name} is already empty.`);
            }
        }

        console.log('\n--- Resetting MRN Counter ---');
        const settings = await Setting.findOne();
        if (settings) {
            const oldCounter = settings.mrnCounter;
            settings.mrnCounter = 0;
            await settings.save();
            console.log(`MRN Counter reset from ${oldCounter} to 0`);
            console.log(`Current ID Prefix: ${settings.idPrefix}`);
        } else {
            console.warn('Settings not found. Creating default settings...');
            await Setting.create({
                idPrefix: 'KSH',
                mrnCounter: 0
            });
            console.log('Default settings created with MRN Counter 0');
        }

        console.log('\n--- SUCCESS ---');
        console.log('System is now ready for real patient registration starting at 0001.');
        
        process.exit(0);
    } catch (error) {
        console.error('Error during reset:', error);
        process.exit(1);
    }
};

resetData();
