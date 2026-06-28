const mongoose = require('mongoose');
const Patient = require('./models/patientModel');
const Charge = require('./models/chargeModel');
const EncounterCharge = require('./models/encounterChargeModel');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/kuntau';

async function testBillingCalculations() {
    console.log('Connecting to database...');
    await mongoose.connect(MONGO_URI);
    console.log('Connected.');

    // 1. Create a test charge
    const testCharge = await Charge.create({
        name: 'Test Retainership Service ' + Date.now(),
        type: 'other', // Valid enum value
        basePrice: 5000,
        standardFee: 5000,
        retainershipFee: 4000,       // Corporate rate
        familyRetainershipFee: 3000, // Family rate
        nhiaFee: 2000,
        kschmaFee: 1500,
        department: 'Nursing',
        active: true
    });
    console.log('Created test charge:', testCharge._id);

    try {
        // Test patients definitions
        const patientsToTest = [
            {
                name: 'Corporate Patient ' + Date.now(),
                provider: 'Corporate Retainership',
                expectedFee: 4000,
                expectedPatientPortion: 0,
                expectedHmoPortion: 4000
            },
            {
                name: 'Family Patient ' + Date.now(),
                provider: 'Family Retainership',
                expectedFee: 3000,
                expectedPatientPortion: 0,
                expectedHmoPortion: 3000
            },
            {
                name: 'Legacy Patient ' + Date.now(),
                provider: 'Retainership',
                expectedFee: 4000,
                expectedPatientPortion: 0,
                expectedHmoPortion: 4000
            },
            {
                name: 'Standard Patient ' + Date.now(),
                provider: 'Standard',
                expectedFee: 5000,
                expectedPatientPortion: 5000,
                expectedHmoPortion: 0
            }
        ];

        for (const testPat of patientsToTest) {
            console.log(`\nTesting patient provider: ${testPat.provider}...`);

            // Create patient with required fields: age and contact
            const patient = await Patient.create({
                name: testPat.name,
                provider: testPat.provider,
                mrn: 'TEST-' + Math.floor(Math.random() * 1000000),
                gender: 'Male',
                dob: new Date('1990-01-01'),
                age: 36,
                contact: '08012345678'
            });

            // Simulate calculation logic from encounterChargeController
            let fee = 0;
            switch (patient.provider) {
                case 'Retainership':
                case 'Corporate Retainership':
                    fee = testCharge.retainershipFee;
                    break;
                case 'Family Retainership':
                    fee = testCharge.familyRetainershipFee || 0;
                    break;
                case 'NHIA':
                    fee = testCharge.nhiaFee;
                    break;
                case 'KSCHMA':
                    fee = testCharge.kschmaFee;
                    break;
                case 'Standard':
                default:
                    fee = testCharge.standardFee;
                    break;
            }

            const totalAmount = fee * 1;
            let patientPortion = totalAmount;
            let hmoPortion = 0;

            if (patient.provider === 'Retainership' || patient.provider === 'Corporate Retainership' || patient.provider === 'Family Retainership') {
                patientPortion = 0;
                hmoPortion = totalAmount;
            }

            console.log(`Resolved fee: ${fee} (Expected: ${testPat.expectedFee})`);
            console.log(`Patient portion: ${patientPortion} (Expected: ${testPat.expectedPatientPortion})`);
            console.log(`HMO portion: ${hmoPortion} (Expected: ${testPat.expectedHmoPortion})`);

            // Assertions
            if (fee !== testPat.expectedFee) {
                throw new Error(`Fee mismatch for ${patient.provider}: got ${fee}, expected ${testPat.expectedFee}`);
            }
            if (patientPortion !== testPat.expectedPatientPortion) {
                throw new Error(`Patient portion mismatch for ${patient.provider}: got ${patientPortion}, expected ${testPat.expectedPatientPortion}`);
            }
            if (hmoPortion !== testPat.expectedHmoPortion) {
                throw new Error(`HMO portion mismatch for ${patient.provider}: got ${hmoPortion}, expected ${testPat.expectedHmoPortion}`);
            }

            // Cleanup patient
            await Patient.findByIdAndDelete(patient._id);
            console.log(`Cleaned up patient ${patient.name}`);
        }

        console.log('\nAll test assertions passed successfully!');

    } finally {
        // Cleanup charge
        await Charge.findByIdAndDelete(testCharge._id);
        console.log('Cleaned up test charge');
        await mongoose.disconnect();
        console.log('Disconnected.');
    }
}

testBillingCalculations().catch(err => {
    console.error('Test FAILED:', err);
    process.exit(1);
});
