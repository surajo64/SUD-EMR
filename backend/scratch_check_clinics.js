const mongoose = require('mongoose');
const dotenv = require('dotenv');
const SpecialityClinic = require('./models/specialityClinicModel');

dotenv.config();

mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('Connected');
        const clinics = await SpecialityClinic.find();
        console.log('Speciality Clinics:');
        console.log(clinics);
        mongoose.disconnect();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
