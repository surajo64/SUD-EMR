const EncounterCharge = require('../models/encounterChargeModel');
const Receipt = require('../models/receiptModel');
const Claim = require('../models/claimModel');

// @desc    Get dashboard financial summary
// @route   GET /api/financials/dashboard-summary
// @access  Private (Cashier/Admin)
const getDashboardSummary = async (req, res) => {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        // 1. Collected Today
        // Only count cash, card, and deposit payments (actual money in hand or used)
        const receiptsToday = await Receipt.find({
            createdAt: { $gte: startOfDay, $lte: endOfDay },
            paymentMethod: { $in: ['cash', 'card', 'deposit', 'retainership'] }
        });
        const collectedToday = receiptsToday.reduce((sum, r) => sum + r.amountPaid, 0);

        // 2. Pending HMO
        // A. hmoPortion from all pending charges (not yet in receipts)
        const pendingCharges = await EncounterCharge.find({ status: 'pending' });
        const pendingHmoFromCharges = pendingCharges.reduce((sum, c) => sum + (c.hmoPortion || 0), 0);

        // B. totalClaimAmount from all unpaid insurance claims
        // (These are receipts already processed but money not yet received from HMO)
        const unpaidClaims = await Claim.find({ status: { $ne: 'paid' } });
        const pendingHmoFromClaims = unpaidClaims.reduce((sum, c) => sum + (c.totalClaimAmount || 0), 0);

        const totalPendingHMO = pendingHmoFromCharges + pendingHmoFromClaims;

        // 3. Outstanding Patient Fees
        // patientPortion from all pending charges
        const pendingPatientFees = pendingCharges.reduce((sum, c) => sum + (c.patientPortion !== undefined ? c.patientPortion : c.totalAmount), 0);

        // 4. Total Receipts Today
        const totalReceiptsCountToday = await Receipt.countDocuments({
            createdAt: { $gte: startOfDay, $lte: endOfDay }
        });

        res.json({
            collectedToday,
            totalPendingHMO,
            pendingPatientFees,
            totalReceiptsToday: totalReceiptsCountToday,
            details: {
                fromCharges: pendingHmoFromCharges,
                fromClaims: pendingHmoFromClaims
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getDashboardSummary
};
