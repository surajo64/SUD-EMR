const jwt = require('jsonwebtoken');
const User = require('../models/userModel');

const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];

            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id)
                .select('-password')
                .populate('assignedPharmacy')
                .populate('assignedSpecialityClinic');

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({ message: 'Not authorized, token failed' });
        }
    }

    if (!token) {
        res.status(401).json({ message: 'Not authorized, no token' });
    }
};

const admin = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'readonly_admin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as an admin' });
    }
};

const checkNotReadOnly = (req, res, next) => {
    if (req.user && req.user.role === 'readonly_admin') {
        return res.status(403).json({ message: 'Action not allowed for Read-only Admin' });
    }
    next();
};

const superAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized. Super Admin access required.' });
    }
};

const pharmacy = (req, res, next) => {
    if (req.user && (req.user.role === 'pharmacist' || req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'readonly_admin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a pharmacist' });
    }
};

const adminOrReceptionist = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'readonly_admin' || req.user.role === 'receptionist')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized. Admin or Receptionist access required.' });
    }
};

const scientist = (req, res, next) => {
    if (req.user && (req.user.role === 'lab_scientist' || req.user.role === 'admin' || req.user.role === 'super_admin' || req.user.role === 'readonly_admin')) {
        next();
    } else {
        res.status(401).json({ message: 'Not authorized as a lab scientist' });
    }
};

module.exports = { protect, admin, superAdmin, pharmacy, adminOrReceptionist, scientist, checkNotReadOnly };
