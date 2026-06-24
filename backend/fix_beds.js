const mongoose = require('mongoose');
const Ward = require('./models/wardModel');

const MONGO_URI = 'mongodb+srv://kirct:kirct2025@employee.qzdf90r.mongodb.net/KUNTAU-EMR?retryWrites=true&w=majority&appName=employee';

const fixBeds = async () => {
    try {
        await mongoose.connect(MONGO_URI);
        console.log('Connected to MongoDB');

        const wards = await Ward.find({});
        console.log(`Found ${wards.length} wards. Starting bed reset...`);

        for (const ward of wards) {
            console.log(`Resetting ${ward.name}... Current beds: ${ward.beds.length}`);
            
            // Create exactly 10 beds
            const newBeds = [];
            for (let i = 1; i <= 10; i++) {
                newBeds.push({
                    number: `Bed ${i}`,
                    isOccupied: false
                });
            }

            ward.beds = newBeds;
            // Also ensure dailyRate is set if it was 0 for some reason, 
            // though we primarily want to fix the beds.
            
            await ward.save();
            console.log(`Successfully reset ${ward.name} to 10 beds.`);
        }

        console.log('All wards have been reset successfully.');
        process.exit(0);
    } catch (error) {
        console.error('Error during bed reset:', error);
        process.exit(1);
    }
};

fixBeds();
