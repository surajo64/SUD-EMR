const cron = require('node-cron');
const Visit = require('./models/visitModel');
const { checkAndGenerateBedFeesForVisit } = require('./utils/bedFeeBilling');

const runDailyWardChargesJob = async () => {
    console.log('========================================');
    console.log('Running auto bed fee billing job at:', new Date().toLocaleString());
    console.log('========================================');
    try {
        // Find all currently admitted patients
        const admittedVisits = await Visit.find({
            encounterStatus: { $in: ['admitted', 'in_ward'] },
            ward: { $exists: true, $ne: null }
        });

        console.log(`Found ${admittedVisits.length} admitted/in-ward visits for billing checks.`);

        for (const visit of admittedVisits) {
            await checkAndGenerateBedFeesForVisit(visit._id, new Date());
        }
        console.log('Auto bed fee billing job completed.');
    } catch (error) {
        console.error('Error running daily ward charges job:', error);
    }
};

const setupCronJobs = () => {
    // Run once on startup after a small delay to ensure DB connects
    setTimeout(() => {
        runDailyWardChargesJob().catch(err => console.error('Startup daily ward charges job failed:', err));
    }, 5000);

    // Run every hour
    cron.schedule('0 * * * *', async () => {
        await runDailyWardChargesJob();
    });
};

module.exports = setupCronJobs;
