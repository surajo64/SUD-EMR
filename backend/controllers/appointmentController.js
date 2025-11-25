const Appointment = require('../models/appointmentModel');

// @desc    Book an appointment
// @route   POST /api/appointments
// @access  Private
const createAppointment = async (req, res) => {
    const { patientId, doctorId, date, time, type, reason } = req.body;

    // If doctorId is provided (by admin/receptionist), use it. Otherwise use logged-in user (if doctor).
    // Ideally add validation here to ensure only authorized roles can set doctorId.
    let assignedDoctor = req.user._id;
    if (doctorId && (req.user.role === 'admin' || req.user.role === 'receptionist' || req.user.role === 'nurse')) {
        assignedDoctor = doctorId;
    }

    const appointment = await Appointment.create({
        doctor: assignedDoctor,
        patient: patientId,
        date,
        time,
        type,
        reason
    });

    res.status(201).json(appointment);
};

// @desc    Get all appointments
// @route   GET /api/appointments
// @access  Private
const getAppointments = async (req, res) => {
    const { doctor, patient, date, status, upcoming } = req.query;

    // Auto-complete past appointments (dates before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await Appointment.updateMany(
        {
            status: 'Scheduled',
            date: { $lt: today }
        },
        { status: 'Completed' }
    );

    // Auto-complete today's appointments if time has passed
    const now = new Date();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const todaysAppointments = await Appointment.find({
        status: 'Scheduled',
        date: { $gte: startOfToday, $lte: endOfToday }
    });

    for (const app of todaysAppointments) {
        // Parse time (supports "HH:mm" 24h and "hh:mm AM/PM" 12h)
        const [timePart, modifier] = app.time.split(' ');
        let [hours, minutes] = timePart.split(':');

        if (modifier) {
            if (hours === '12') {
                hours = '00';
            }
            if (modifier === 'PM') {
                hours = parseInt(hours, 10) + 12;
            }
        }

        const appDate = new Date(app.date);
        appDate.setHours(hours, minutes, 0, 0);

        if (appDate < now) {
            app.status = 'Completed';
            await app.save();
        }
    }

    const query = {};

    if (doctor) query.doctor = doctor;
    if (patient) query.patient = patient;
    if (date) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        query.date = { $gte: startOfDay, $lte: endOfDay };
    } else if (upcoming === 'true') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        query.date = { $gte: startOfToday };
    }
    if (status) query.status = status;

    const appointments = await Appointment.find(query)
        .populate('patient', 'name contact')
        .populate('doctor', 'name')
        .sort({ date: 1, time: 1 }); // Sort by date and time
    res.json(appointments);
};

// @desc    Update appointment status
// @route   PUT /api/appointments/:id
// @access  Private
const updateAppointmentStatus = async (req, res) => {
    const { status } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (appointment) {
        appointment.status = status;
        const updatedAppointment = await appointment.save();
        res.json(updatedAppointment);
    } else {
        res.status(404).json({ message: 'Appointment not found' });
    }
};

module.exports = {
    createAppointment,
    getAppointments,
    updateAppointmentStatus,
};
