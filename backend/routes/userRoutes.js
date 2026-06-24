const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, getAllUsers, updateUser, deleteUser, activateUser, resetUserPassword, getDoctors, changePassword } = require('../controllers/userController');
const { protect, admin, checkNotReadOnly } = require('../middleware/authMiddleware');

router.get('/all', protect, admin, getAllUsers);
router.get('/doctors', protect, getDoctors);
router.post('/', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/:id', protect, admin, checkNotReadOnly, updateUser);
router.put('/:id/activate', protect, admin, checkNotReadOnly, activateUser);
router.delete('/:id', protect, admin, checkNotReadOnly, deleteUser);
router.post('/:id/reset-password', protect, admin, checkNotReadOnly, resetUserPassword);
router.put('/profile/password', protect, changePassword);

module.exports = router;
