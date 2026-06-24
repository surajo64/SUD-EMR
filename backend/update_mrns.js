const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Patient = require('./models/patientModel');

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to DB');

        const patients = await Patient.find({ mrn: { $regex: '-' } });
        console.log(`Found ${patients.length} patients with dashes in MRN`);

        let updatedCount = 0;
        for (const patient of patients) {
            const oldMrn = patient.mrn;
            const newMrn = oldMrn.replace(/-/g, '');
            
            patient.mrn = newMrn;
            await patient.save();
            updatedCount++;
            console.log(`Updated MRN: ${oldMrn} -> ${newMrn}`);
        }

        console.log(`Successfully updated ${updatedCount} patients.`);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
};

run();
