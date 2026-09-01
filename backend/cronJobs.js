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
            status: { $ne: 'Discharged' },
            dischargeDate: { $exists: false },
            isActive: { $ne: false },
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

const autoCloseExpiredVisitsJob = async () => {
    console.log('========================================');
    console.log('Running auto-close expired outpatient visits job at:', new Date().toLocaleString());
    console.log('========================================');
    try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const result = await Visit.updateMany(
            {
                type: { $ne: 'Inpatient' },
                encounterType: { $ne: 'Inpatient' },
                encounterStatus: { $nin: ['completed', 'discharged', 'cancelled'] },
                createdAt: { $lt: twentyFourHoursAgo }
            },
            {
                $set: {
                    encounterStatus: 'completed',
                    isActive: false
                }
            }
        );
        console.log(`Auto-closed ${result.modifiedCount} expired non-inpatient visits.`);
    } catch (error) {
        console.error('Error running auto-close expired visits job:', error);
    }
};

const mongoose = require('mongoose');

const setupCronJobs = () => {
    // Run once on startup when database is connected to avoid buffering timeouts
    const runJobIfConnected = () => {
        if (mongoose.connection.readyState === 1) {
            runDailyWardChargesJob().catch(err => console.error('Startup daily ward charges job failed:', err));
            autoCloseExpiredVisitsJob().catch(err => console.error('Startup auto-close expired visits job failed:', err));
        } else {
            mongoose.connection.once('connected', () => {
                runDailyWardChargesJob().catch(err => console.error('Startup daily ward charges job failed:', err));
                autoCloseExpiredVisitsJob().catch(err => console.error('Startup auto-close expired visits job failed:', err));
            });
        }
    };

    runJobIfConnected();

    // Run every hour
    cron.schedule('0 * * * *', async () => {
        await runDailyWardChargesJob();
        await autoCloseExpiredVisitsJob();
    });
};

module.exports = setupCronJobs;
