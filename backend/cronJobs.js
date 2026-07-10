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
            $or: [
                { type: 'Inpatient' },
                { encounterType: 'Inpatient' }
            ],
            encounterStatus: { $nin: ['discharged', 'cancelled', 'completed'] },
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

const mongoose = require('mongoose');

const setupCronJobs = () => {
    // Run once on startup when database is connected to avoid buffering timeouts
    const runJobIfConnected = () => {
        if (mongoose.connection.readyState === 1) {
            runDailyWardChargesJob().catch(err => console.error('Startup daily ward charges job failed:', err));
        } else {
            mongoose.connection.once('connected', () => {
                runDailyWardChargesJob().catch(err => console.error('Startup daily ward charges job failed:', err));
            });
        }
    };

    runJobIfConnected();

    // Run every hour
    cron.schedule('0 * * * *', async () => {
        await runDailyWardChargesJob();
    });
};

module.exports = setupCronJobs;
