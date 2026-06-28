const mongoose = require('mongoose');
const dotenv = require('dotenv');
const FamilyFile = require('./models/familyFileModel');
const Patient = require('./models/patientModel');

dotenv.config();

const recount = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB Connected');

        const familyFiles = await FamilyFile.find({});
        console.log(`Checking ${familyFiles.length} family files...`);

        for (const file of familyFiles) {
            const actualCount = await Patient.countDocuments({ familyFile: file._id });
            if (file.memberCount !== actualCount) {
                console.log(`Updating ${file.familyName} (${file.fileNumber}): count was ${file.memberCount}, now ${actualCount}`);
                file.memberCount = actualCount;
                await file.save();
            }
        }

        console.log('Recount complete');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

recount();
