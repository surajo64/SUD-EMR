const cron = require('node-cron');
const Visit = require('./models/visitModel');
const Ward = require('./models/wardModel');
const EncounterCharge = require('./models/encounterChargeModel');

const setupCronJobs = () => {
    // Run every day at midnight (00:00)
    cron.schedule('0 0 * * *', async () => {
        console.log('Running daily ward charges job...');
        try {
            // Find all currently admitted patients
            const admittedVisits = await Visit.find({ encounterStatus: 'admitted' }).populate('ward');

            for (const visit of admittedVisits) {
                if (visit.ward && visit.ward.dailyRate > 0) {
                    // Check if a charge was already created today (e.g. initial charge on admission)
                    const startOfDay = new Date();
                    startOfDay.setHours(0, 0, 0, 0);
                    const endOfDay = new Date();
                    endOfDay.setHours(23, 59, 59, 999);

                    const existingCharge = await EncounterCharge.findOne({
                        encounter: visit._id,
                        itemName: { $regex: /Ward Charge/i }, // Match "Initial Ward Charge" or "Daily Ward Charge"
                        createdAt: { $gte: startOfDay, $lte: endOfDay }
                    });

                    if (!existingCharge) {
                        // Create a charge for the day
                        await EncounterCharge.create({
                            encounter: visit._id,
                            patient: visit.patient,
                            itemType: 'Daily Bed Fee',
                            itemName: `Daily Ward Charge - ${visit.ward.name}`,
                            cost: visit.ward.dailyRate,
                            quantity: 1,
                            totalAmount: visit.ward.dailyRate,
                            status: 'pending'
                        });
                        console.log(`Charged ${visit.ward.dailyRate} to visit ${visit._id}`);
                    } else {
                        console.log(`Skipping charge for visit ${visit._id} - already charged today.`);
                    }
                }
            }
            console.log('Daily ward charges job completed.');
        } catch (error) {
            console.error('Error running daily ward charges job:', error);
        }
    });
};

module.exports = setupCronJobs;
