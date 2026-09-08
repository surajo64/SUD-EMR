const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const checkData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        const db = mongoose.connection.db;

        const start = new Date();
        start.setHours(0, 0, 0, 0);

        console.log(`Checking charges since ${start.toISOString()}`);

        const charges = await db.collection('encountercharges').find({
            createdAt: { $gte: start }
        }).toArray();

        console.log(`Found ${charges.length} charges for today.`);

        for (const c of charges) {
            console.log(`Charge ID: ${c._id}`);
            console.log(`  ItemName: ${c.itemName}, ItemType: ${c.itemType}, Dept: ${c.department}, Amount: ${c.totalAmount}, Status: ${c.status}`);
            if (c.encounter) {
                const visit = await db.collection('visits').findOne({ _id: c.encounter });
                if (visit) {
                    console.log(`  Visit ID: ${visit._id}, Type: ${visit.type}, EncType: ${visit.encounterType}`);
                } else {
                    console.log(`  Visit ID: ${c.encounter} (Not found in visits collection)`);
                }
            } else {
                console.log(`  No encounter ID`);
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

checkData();
