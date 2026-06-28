const mongoose = require('mongoose');
const dotenv = require('dotenv');
const FamilyFile = require('./models/familyFileModel');

dotenv.config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
    const files = await FamilyFile.find({});
    for (const f of files) {
        console.log(`${f.familyName} (${f.fileNumber}): count = ${f.memberCount}, type = ${f.type}`);
    }
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
