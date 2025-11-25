const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/userModel');
const connectDB = require('./config/db');

dotenv.config();

connectDB();

const importData = async () => {
    try {
        await User.deleteMany();

        const adminUser = await User.create({
            name: 'Admin User',
            email: 'admin@example.com',
            password: 'password123',
            role: 'admin',
        });

        const doctorUser = await User.create({
            name: 'Dr. Smith',
            email: 'doctor@example.com',
            password: 'password123',
            role: 'doctor',
        });

        const pharmacistUser = await User.create({
            name: 'Pharmacist John',
            email: 'pharmacist@example.com',
            password: 'password123',
            role: 'pharmacist',
        });

        const labUser = await User.create({
            name: 'Lab Tech Sarah',
            email: 'lab@example.com',
            password: 'password123',
            role: 'lab_technician',
        });

        const radioUser = await User.create({
            name: 'Radiologist Mike',
            email: 'radio@example.com',
            password: 'password123',
            role: 'radiologist',
        });

        const nurseUser = await User.create({
            name: 'Nurse Mary',
            email: 'nurse@example.com',
            password: 'password123',
            role: 'nurse',
        });

        const receptionistUser = await User.create({
            name: 'Receptionist Jane',
            email: 'receptionist@example.com',
            password: 'password123',
            role: 'receptionist',
        });

        const cashierUser = await User.create({
            name: 'Cashier David',
            email: 'cashier@example.com',
            password: 'password123',
            role: 'cashier',
        });

        console.log('Data Imported!');
        process.exit();
    } catch (error) {
        console.error(`${error}`);
        process.exit(1);
    }
};

importData();
