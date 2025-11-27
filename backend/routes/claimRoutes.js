const express = require('express');
const router = express.Router();
const {
    generateClaimFromEncounter,
    getClaims,
    getClaimById,
    getClaimsByHMO,
    updateClaimStatus,
    exportClaimsToExcel,
    getClaimsSummary
} = require('../controllers/claimController');
const { protect, admin } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Generate claim from encounter
router.post('/generate/:encounterId', generateClaimFromEncounter);

// Get claims summary
router.get('/summary', getClaimsSummary);

// Export claims to Excel
router.get('/export', exportClaimsToExcel);

// Get all claims with filters
router.get('/', getClaims);

// Get claims by HMO
router.get('/hmo/:hmoId', getClaimsByHMO);

// Get single claim
router.get('/:id', getClaimById);

// Update claim status
router.put('/:id/status', updateClaimStatus);

module.exports = router;
