const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Charge = require('./models/chargeModel');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const sampleCharges = [
    // Consultation Charges
    { name: 'General Consultation', type: 'consultation', basePrice: 50, department: 'Front Desk', description: 'Standard outpatient consultation fee' },
    { name: 'Specialist Consultation', type: 'consultation', basePrice: 100, department: 'Front Desk', description: 'Specialist physician consultation' },
    { name: 'Emergency Consultation', type: 'consultation', basePrice: 150, department: 'Front Desk', description: 'Emergency department consultation' },

    // Lab Tests
    { name: 'Complete Blood Count (CBC)', type: 'lab', basePrice: 30, department: 'Laboratory', description: 'Full blood count analysis', code: 'LAB001' },
    { name: 'Lipid Profile', type: 'lab', basePrice: 40, department: 'Laboratory', description: 'Cholesterol and triglycerides test', code: 'LAB002' },
    { name: 'Blood Glucose (Fasting)', type: 'lab', basePrice: 15, department: 'Laboratory', description: 'Fasting blood sugar test', code: 'LAB003' },
    { name: 'Urinalysis', type: 'lab', basePrice: 20, department: 'Laboratory', description: 'Complete urine analysis', code: 'LAB004' },
    { name: 'Liver Function Test (LFT)', type: 'lab', basePrice: 50, department: 'Laboratory', description: 'Comprehensive liver panel', code: 'LAB005' },
    { name: 'Kidney Function Test (RFT)', type: 'lab', basePrice: 50, department: 'Laboratory', description: 'Renal function panel', code: 'LAB006' },
    { name: 'Malaria Test', type: 'lab', basePrice: 10, department: 'Laboratory', description: 'Malaria parasite test', code: 'LAB007' },
    { name: 'HIV Screening', type: 'lab', basePrice: 25, department: 'Laboratory', description: 'HIV antibody test', code: 'LAB008' },

    // Radiology/Imaging
    { name: 'X-Ray (Chest)', type: 'radiology', basePrice: 60, department: 'Radiology', description: 'Chest X-ray PA view', code: 'RAD001' },
    { name: 'X-Ray (Abdomen)', type: 'radiology', basePrice: 70, department: 'Radiology', description: 'Abdominal X-ray', code: 'RAD002' },
    { name: 'Ultrasound (Abdomen)', type: 'radiology', basePrice: 100, department: 'Radiology', description: 'Abdominal ultrasound scan', code: 'RAD003' },
    { name: 'Ultrasound (Obstetric)', type: 'radiology', basePrice: 80, department: 'Radiology', description: 'Pregnancy ultrasound', code: 'RAD004' },
    { name: 'CT Scan (Head)', type: 'radiology', basePrice: 300, department: 'Radiology', description: 'Cranial CT scan', code: 'RAD005' },
    { name: 'MRI Scan (Brain)', type: 'radiology', basePrice: 500, department: 'Radiology', description: 'Brain MRI scan', code: 'RAD006' },

    // Common Drugs
    { name: 'Paracetamol 500mg (Tab)', type: 'drugs', basePrice: 0.5, department: 'Pharmacy', description: 'Pain and fever relief', code: 'DRG001' },
    { name: 'Amoxicillin 500mg (Cap)', type: 'drugs', basePrice: 1.5, department: 'Pharmacy', description: 'Antibiotic', code: 'DRG002' },
    { name: 'Metformin 500mg (Tab)', type: 'drugs', basePrice: 1.0, department: 'Pharmacy', description: 'Diabetes medication', code: 'DRG003' },
    { name: 'Amlodipine 5mg (Tab)', type: 'drugs', basePrice: 0.8, department: 'Pharmacy', description: 'Blood pressure medication', code: 'DRG004' },
    { name: 'Omeprazole 20mg (Cap)', type: 'drugs', basePrice: 1.2, department: 'Pharmacy', description: 'Stomach acid reducer', code: 'DRG005' },
    { name: 'Ciprofloxacin 500mg (Tab)', type: 'drugs', basePrice: 2.0, department: 'Pharmacy', description: 'Antibiotic', code: 'DRG006' },
    { name: 'Ibuprofen 400mg (Tab)', type: 'drugs', basePrice: 0.6, department: 'Pharmacy', description: 'Anti-inflammatory', code: 'DRG007' },
    { name: 'Vitamin B Complex (Tab)', type: 'drugs', basePrice: 0.3, department: 'Pharmacy', description: 'Multivitamin supplement', code: 'DRG008' },

    // Nursing Procedures
    { name: 'IV Insertion', type: 'nursing', basePrice: 20, department: 'Nursing', description: 'Intravenous catheter insertion', code: 'NRS001' },
    { name: 'Wound Dressing', type: 'nursing', basePrice: 15, department: 'Nursing', description: 'Wound cleaning and dressing', code: 'NRS002' },
    { name: 'Injection (IM/IV)', type: 'nursing', basePrice: 5, department: 'Nursing', description: 'Intramuscular or intravenous injection', code: 'NRS003' },
    { name: 'Catheterization', type: 'nursing', basePrice: 25, department: 'Nursing', description: 'Urinary catheter insertion', code: 'NRS004' },
];

const importData = async () => {
    try {
        await Charge.deleteMany();
        await Charge.insertMany(sampleCharges);

        console.log('Charge Master Data Imported!');
        console.log(`${sampleCharges.length} charges added to the system`);
        process.exit();
    } catch (error) {
        console.error(`Error: ${error}`);
        process.exit(1);
    }
};

importData();
