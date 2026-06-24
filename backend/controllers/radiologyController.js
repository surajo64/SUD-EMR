const RadiologyOrder = require('../models/radiologyOrderModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Visit = require('../models/visitModel');
const Patient = require('../models/patientModel');
const Receipt = require('../models/receiptModel');
const Charge = require('../models/chargeModel');

// @desc    Create new radiology order
// @route   POST /api/radiology
// @access  Private (Doctor or Radiologist for External Investigation)
const createRadiologyOrder = async (req, res) => {
    const { patientId, visitId, chargeId, scanType } = req.body;

    // Check permissions
    if (req.user.role === 'radiologist') {
        const visit = await Visit.findById(visitId);
        if (!visit || visit.type !== 'External Investigation') {
            return res.status(403).json({ message: 'Radiologists can only order for External Investigations.' });
        }
    } else if (req.user.role !== 'doctor') {
        return res.status(403).json({ message: 'Not authorized to order radiology.' });
    }

    const order = await RadiologyOrder.create({
        doctor: req.user._id,
        patient: patientId,
        visit: visitId,
        charge: chargeId,
        scanType,
    });

    res.status(201).json(order);
};

// @desc    Get all radiology orders
// @route   GET /api/radiology
// @access  Private
const getRadiologyOrders = async (req, res) => {
    const orders = await RadiologyOrder.find({})
        .populate('patient', 'name mrn age gender contact')
        .populate('visit', 'type createdAt')
        .populate('charge', 'status')
        .populate('signedBy', 'name');
    res.json(orders);
};

// @desc    Get radiology orders by visit
// @route   GET /api/radiology/visit/:id
// @access  Private
const getRadiologyOrdersByVisit = async (req, res) => {
    const orders = await RadiologyOrder.find({ visit: req.params.id })
        .populate('doctor', 'name')
        .populate('charge', 'status');
    res.json(orders);
};

// @desc    Update radiology report
// @route   PUT /api/radiology/:id/report
// @access  Private (Radiologist)
const updateRadiologyReport = async (req, res) => {
    const { report, resultImage } = req.body;
    const order = await RadiologyOrder.findById(req.params.id);

    if (order) {
        order.report = report;
        order.resultImage = resultImage;
        order.status = 'completed';
        order.signedBy = req.user._id;
        order.reportDate = new Date();
        const updatedOrder = await order.save();
        await updatedOrder.populate('signedBy', 'name');
        res.json(updatedOrder);
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
};

// @desc    Upload radiology images
// @route   POST /api/radiology/:id/upload-images
// @access  Private (Radiologist)
const uploadRadiologyImages = async (req, res) => {
    try {
        const order = await RadiologyOrder.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // req.files contains the uploaded files from multer
        // req.body.imageNames contains JSON string of image names
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded' });
        }

        // Parse image names from request body
        let imageNames = [];
        try {
            imageNames = JSON.parse(req.body.imageNames || '[]');
        } catch (error) {
            return res.status(400).json({ message: 'Invalid image names format' });
        }

        // Create image objects
        const newImages = req.files.map((file, index) => ({
            name: imageNames[index] || `Image ${index + 1}`,
            filename: file.filename,
            originalName: file.originalname,
            path: file.path.replace(/\\/g, '/'), // Normalize path for cross-platform compatibility
            uploadedAt: new Date()
        }));

        // Add new images to existing images array
        order.images = order.images || [];
        order.images.push(...newImages);

        await order.save();
        await order.populate('signedBy', 'name');

        res.json({
            message: 'Images uploaded successfully',
            images: newImages,
            order: order
        });
    } catch (error) {
        console.error('Error uploading images:', error);
        res.status(500).json({ message: 'Error uploading images', error: error.message });
    }
};

// @desc    Delete radiology image
// @route   DELETE /api/radiology/:id/images/:imageId
// @access  Private (Radiologist)
const deleteRadiologyImage = async (req, res) => {
    try {
        const order = await RadiologyOrder.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const imageIndex = order.images.findIndex(img => img._id.toString() === req.params.imageId);

        if (imageIndex === -1) {
            return res.status(404).json({ message: 'Image not found' });
        }

        // Delete file from filesystem
        const fs = require('fs');
        const imagePath = order.images[imageIndex].path;
        if (fs.existsSync(imagePath)) {
            fs.unlinkSync(imagePath);
        }

        // Remove from array
        order.images.splice(imageIndex, 1);
        await order.save();

        res.json({ message: 'Image deleted successfully', order });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({ message: 'Error deleting image', error: error.message });
    }
};

// @desc    Delete radiology order
// @route   DELETE /api/radiology/:id
// @access  Private (Doctor or Admin)
const deleteRadiologyOrder = async (req, res) => {
    const order = await RadiologyOrder.findById(req.params.id);

    if (!order) {
        return res.status(404).json({ message: 'Order not found' });
    }

    // Verify permissions: Only Admin or the Doctor who created the order
    if (req.user.role !== 'admin' && order.doctor.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to delete this order.' });
    }

    // Check if there's an associated charge
    if (order.charge) {
        const encounterCharge = await EncounterCharge.findById(order.charge);
        if (encounterCharge) {
            if (encounterCharge.status !== 'pending') {
                return res.status(400).json({ message: 'Cannot delete order because the charge has already been processed (paid or cancelled).' });
            }
            // Delete the encounter charge
            await encounterCharge.deleteOne();
        }
    }

    // Delete associated images from filesystem if any
    if (order.images && order.images.length > 0) {
        const fs = require('fs');
        order.images.forEach(img => {
            if (fs.existsSync(img.path)) {
                fs.unlinkSync(img.path);
            }
        });
    }

    await order.deleteOne();
    res.json({ message: 'Radiology order and associated pending charge deleted.' });
};

// @desc    Process a direct/walk-in POS sale at Radiology
// @route   POST /api/radiology/pos-sale
// @access  Private (Radiologist)
const processDirectSale = async (req, res) => {
    try {
        const { customerName, age, gender, items, discount, tax, paymentMethod } = req.body;
        // items: [{ chargeId, name, price }]

        if (!customerName || !customerName.trim()) {
            return res.status(400).json({ message: 'Customer name is required.' });
        }

        if (!age || isNaN(age)) {
            return res.status(400).json({ message: 'Age is required and must be a number.' });
        }

        if (!gender) {
            return res.status(400).json({ message: 'Gender is required.' });
        }

        if (!items || items.length === 0) {
            return res.status(400).json({ message: 'No items selected.' });
        }

        // ── 1. Create walk-in patient ──────────────────────────────
        const currentYear = new Date().getFullYear();
        const prefix = `RAD-${currentYear}-`;

        // Find the latest patient with similar MRN prefix
        const lastPatient = await Patient.findOne({ mrn: new RegExp(`^${prefix}`) })
            .sort({ mrn: -1 })
            .limit(1);

        let sequence = 1;
        if (lastPatient) {
            const parts = lastPatient.mrn.split('-');
            if (parts.length === 3) {
                const lastSequence = parseInt(parts[2]);
                if (!isNaN(lastSequence)) {
                    sequence = lastSequence + 1;
                }
            }
        }

        const walkInMrn = `${prefix}${sequence.toString().padStart(4, '0')}`;
        const walkInPatient = await Patient.create({
            mrn: walkInMrn,
            name: customerName.trim(),
            age: Number(age),
            gender: gender,
            contact: 'Walk-in',
            provider: 'Standard',
            depositBalance: 0
        });

        // ── 2. Create Visit ──────────────────────────────────────────
        const walkInVisit = await Visit.create({
            patient: walkInPatient._id,
            doctor: req.user._id,
            type: 'External Radiology',
            status: 'Discharged',
            encounterStatus: 'completed',
            paymentValidated: true,
            reasonForVisit: 'Direct Radiology Purchase (POS)'
        });

        const createdChargeIds = [];
        let subtotal = 0;

        // ── 3. Create Charges & Radiology Orders ──────────────────────────
        for (const item of items) {
            const { chargeId, name, price } = item;
            const totalItemAmount = parseFloat(price);
            subtotal += totalItemAmount;

            const encounterCharge = await EncounterCharge.create({
                encounter: walkInVisit._id,
                patient: walkInPatient._id,
                charge: chargeId,
                quantity: 1,
                unitPrice: price,
                totalAmount: totalItemAmount,
                patientPortion: totalItemAmount,
                hmoPortion: 0,
                status: 'paid',
                addedBy: req.user._id,
                itemType: 'Radiology',
                itemName: name,
                department: 'Radiology'
            });

            createdChargeIds.push(encounterCharge._id);

            // Create Radiology Order
            await RadiologyOrder.create({
                doctor: req.user._id,
                patient: walkInPatient._id,
                visit: walkInVisit._id,
                charge: encounterCharge._id,
                scanType: name,
                status: 'pending'
            });
        }

        // ── 4. Apply discount and tax ──────────────────────────────────────────
        const discountAmt = parseFloat(discount) || 0;
        const taxAmt = parseFloat(tax) || 0;
        const totalAmount = subtotal - discountAmt + taxAmt;

        // ── 5. Create Receipt ─────────────────────────────────────────
        const receiptNumber = `POS-RAD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const receipt = await Receipt.create({
            patient: walkInPatient._id,
            encounter: walkInVisit._id,
            charges: createdChargeIds,
            amountPaid: totalAmount < 0 ? 0 : totalAmount,
            paymentMethod: paymentMethod || 'cash',
            cashier: req.user._id,
            receiptNumber,
            validated: true,
            validatedBy: [{
                user: req.user._id,
                department: 'Radiology',
                timestamp: new Date()
            }]
        });

        // ── 6. Link receipt on charges ─────────────────────────────────────────
        await EncounterCharge.updateMany(
            { _id: { $in: createdChargeIds } },
            { receipt: receipt._id }
        );

        const populatedReceipt = await Receipt.findById(receipt._id)
            .populate('patient', 'name mrn')
            .populate('cashier', 'name')
            .populate({
                path: 'charges',
                select: 'itemName quantity unitPrice totalAmount'
            });

        res.status(201).json({
            message: 'Sale completed successfully',
            receipt: populatedReceipt,
            receiptNumber,
            totalAmount: totalAmount < 0 ? 0 : totalAmount
        });

    } catch (error) {
        console.error('Radiology POS Sale Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createRadiologyOrder,
    getRadiologyOrders,
    getRadiologyOrdersByVisit,
    updateRadiologyReport,
    uploadRadiologyImages,
    deleteRadiologyImage,
    deleteRadiologyOrder,
    processDirectSale,
};
