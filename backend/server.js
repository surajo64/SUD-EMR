const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const setupCronJobs = require('./cronJobs');

dotenv.config();

connectDB();
setupCronJobs();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/patients', require('./routes/patientRoutes'));
app.use('/api/prescriptions', require('./routes/prescriptionRoutes'));
app.use('/api/inventory', require('./routes/inventoryRoutes'));
app.use('/api/lab', require('./routes/labRoutes'));
app.use('/api/radiology', require('./routes/radiologyRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/receipts', require('./routes/receiptRoutes'));
app.use('/api/charges', require('./routes/chargeRoutes'));
app.use('/api/encounter-charges', require('./routes/encounterChargeRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
app.use('/api/visits', require('./routes/visitRoutes'));
app.use('/api/vitals', require('./routes/vitalSignRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/clinics', require('./routes/clinicRoutes'));
app.use('/api/wards', require('./routes/wardRoutes'));
app.use('/api/drug-metadata', require('./routes/drugMetadataRoutes'));
app.use('/api/pharmacies', require('./routes/pharmacyRoutes'));
app.use('/api/drug-transfers', require('./routes/drugTransferRoutes'));
app.use('/api/drug-disposals', require('./routes/drugDisposalRoutes'));
app.use('/api/referrals', require('./routes/referralRoutes'));
app.use('/api/hmos', require('./routes/hmoRoutes'));
app.use('/api/claims', require('./routes/claimRoutes'));
app.use('/api/hmo-transactions', require('./routes/hmoTransactionRoutes'));




app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
