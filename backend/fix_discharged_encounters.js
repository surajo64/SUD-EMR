const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const Visit = require('./models/visitModel');
const Ward = require('./models/wardModel');

const fixDischargedEncounters = async () => {
    try {
        const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/kuntau';
        await mongoose.connect(mongoUri);
        console.log('Connected to MongoDB');

        // Find encounters where status is 'Discharged' or dischargeNotes exists or dischargeDate exists, but encounterStatus != 'discharged'
        const candidateVisits = await Visit.find({
            $or: [
                { status: 'Discharged' },
                { status: 'discharged' },
                { dischargeNotes: { $exists: true, $ne: '' } },
                { dischargeDate: { $exists: true, $ne: null } }
            ],
            encounterStatus: { $ne: 'discharged' }
        });

        console.log(`Found ${candidateVisits.length} visits with status/discharge mismatch.`);

        for (const visit of candidateVisits) {
            console.log(`Updating visit ${visit._id} (Patient: ${visit.patient}, Type: ${visit.type}, Old encounterStatus: ${visit.encounterStatus})...`);
            visit.encounterStatus = 'discharged';
            visit.status = 'Discharged';
            visit.isActive = false;

            if (!visit.dischargeDate) {
                visit.dischargeDate = visit.updatedAt || new Date();
            }

            // Release ward bed if assigned
            if (visit.ward && visit.bed) {
                const wardDoc = await Ward.findById(visit.ward);
                if (wardDoc) {
                    const bedIndex = wardDoc.beds.findIndex(b => b.number === visit.bed);
                    if (bedIndex !== -1) {
                        wardDoc.beds[bedIndex].isOccupied = false;
                        wardDoc.beds[bedIndex].occupiedBy = null;
                        await wardDoc.save();
                        console.log(`Released bed ${visit.bed} in ward ${wardDoc.name}`);
                    }
                }
            }

            await visit.save();
            console.log(`Successfully updated visit ${visit._id} to discharged.`);
        }

        console.log('Discharge encounter sync script completed successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error running fix script:', error);
        process.exit(1);
    }
};

fixDischargedEncounters();
