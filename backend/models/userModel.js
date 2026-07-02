const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
    },
    role: {
        type: String,
        required: true,
        enum: ['super_admin', 'admin', 'readonly_admin', 'doctor', 'nurse', 'pharmacist', 'lab_technician', 'lab_scientist', 'radiologist', 'receptionist', 'cashier'],
    },
    assignedPharmacy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Pharmacy'
    },
    assignedSpecialityClinic: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SpecialityClinic'
    },
    labSpecialization: {
        type: String,
        enum: ['', 'All Lab Test', 'Hematology', 'Chemical Pathology', 'Microbiology', 'Histopathology', 'Immunology / Serology', 'Blood Transfusion Science']
    },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, {
    timestamps: true,
});

userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;
