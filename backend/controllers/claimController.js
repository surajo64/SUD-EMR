const Claim = require('../models/claimModel');
const Encounter = require('../models/visitModel');
const Patient = require('../models/patientModel');
const HMO = require('../models/hmoModel');
const EncounterCharge = require('../models/encounterChargeModel');
const XLSX = require('xlsx');

// @desc    Generate claim from encounter
// @route   POST /api/claims/generate/:encounterId
// @access  Private
const generateClaimFromEncounter = async (req, res) => {
    try {
        const encounter = await Encounter.findById(req.params.encounterId)
            .populate('patient')
            .populate('charges.charge');

        if (!encounter) {
            return res.status(404).json({ message: 'Encounter not found' });
        }

        const patient = await Patient.findById(encounter.patient._id).populate('hmo');

        // Only generate claims for Retainership, NHIA and KSCHMA patients
        if (patient.provider !== 'Retainership' && patient.provider !== 'NHIA' && patient.provider !== 'KSCHMA') {
            return res.status(400).json({ message: 'Claims can only be generated for Retainership, NHIA or KSCHMA patients' });
        }

        if (!patient.hmo) {
            return res.status(400).json({ message: 'Patient does not have an HMO assigned' });
        }

        // Check if claim already exists for this encounter
        const existingClaim = await Claim.findOne({ encounter: encounter._id });
        if (existingClaim) {
            return res.status(400).json({ message: 'Claim already exists for this encounter' });
        }

        // Get all charges for this encounter
        const encounterCharges = await EncounterCharge.find({ encounter: encounter._id })
            .populate('charge');

        const claimItems = [];
        let totalClaimAmount = 0;

        for (const ec of encounterCharges) {
            const totalAmount = ec.totalAmount;
            let patientPortion = 0;
            let hmoPortion = 0;
            let chargeName = '';
            let chargeType = '';
            let chargeId = null;

            // Get charge details from reference or from stored snapshot
            if (ec.charge) {
                chargeName = ec.charge.name;
                chargeType = ec.charge.type;
                chargeId = ec.charge._id;
            } else {
                // Use snapshot data if charge reference is missing
                chargeName = ec.itemName || 'Service';
                chargeType = ec.itemType || 'service';
                chargeId = null; // No charge reference
            }

            // Use stored portions if available (preferred), otherwise calculate
            if (ec.hmoPortion !== undefined && ec.patientPortion !== undefined) {
                hmoPortion = ec.hmoPortion;
                patientPortion = ec.patientPortion;
            } else {
                // Fallback calculation for old records
                if (patient.provider === 'Retainership') {
                    // Retainership: HMO covers 100% of ALL charges (including drugs)
                    patientPortion = 0;
                    hmoPortion = totalAmount;
                } else if (patient.provider === 'NHIA' || patient.provider === 'KSCHMA') {
                    // NHIA/KSCHMA: Patient pays 10% for drugs, HMO covers 90% for drugs
                    // HMO covers 100% for other services
                    if (chargeType === 'drugs' || chargeType === 'drug') {
                        patientPortion = totalAmount * 0.1;
                        hmoPortion = totalAmount * 0.9;
                    } else {
                        patientPortion = 0;
                        hmoPortion = totalAmount;
                    }
                }
            }

            claimItems.push({
                charge: chargeId,
                chargeType: chargeType,
                description: chargeName,
                quantity: ec.quantity || 1,
                unitPrice: ec.unitPrice || totalAmount,
                totalAmount: totalAmount,
                patientPortion: patientPortion,
                hmoPortion: hmoPortion
            });

            totalClaimAmount += hmoPortion;
        }

        // Create the claim
        const claim = await Claim.create({
            patient: patient._id,
            hmo: patient.hmo._id,
            encounter: encounter._id,
            claimItems: claimItems,
            totalClaimAmount: totalClaimAmount,
            status: 'pending'
        });

        const populatedClaim = await Claim.findById(claim._id)
            .populate('patient', 'firstName lastName patientId')
            .populate('hmo', 'name code')
            .populate('encounter')
            .populate('claimItems.charge');

        res.status(201).json(populatedClaim);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all claims with filters
// @route   GET /api/claims
// @access  Private
const getClaims = async (req, res) => {
    try {
        const { hmo, status, startDate, endDate } = req.query;

        const filter = {};

        if (hmo) {
            filter.hmo = hmo;
        }

        if (status) {
            filter.status = status;
        }

        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const claims = await Claim.find(filter)
            .populate('patient', 'name mrn')
            .populate('hmo', 'name code')
            .populate('encounter', 'createdAt type')
            .sort({ createdAt: -1 });

        res.json(claims);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single claim by ID
// @route   GET /api/claims/:id
// @access  Private
const getClaimById = async (req, res) => {
    try {
        const claim = await Claim.findById(req.params.id)
            .populate('patient')
            .populate('hmo')
            .populate('encounter')
            .populate('claimItems.charge');

        if (!claim) {
            return res.status(404).json({ message: 'Claim not found' });
        }

        res.json(claim);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get claims by HMO
// @route   GET /api/claims/hmo/:hmoId
// @access  Private
const getClaimsByHMO = async (req, res) => {
    try {
        const claims = await Claim.find({ hmo: req.params.hmoId })
            .populate('patient', 'firstName lastName patientId')
            .populate('hmo', 'name code')
            .populate('encounter', 'encounterDate')
            .sort({ createdAt: -1 });

        res.json(claims);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update claim status
// @route   PUT /api/claims/:id/status
// @access  Private
const updateClaimStatus = async (req, res) => {
    try {
        const { status, rejectionReason, notes } = req.body;

        const claim = await Claim.findById(req.params.id);

        if (!claim) {
            return res.status(404).json({ message: 'Claim not found' });
        }

        claim.status = status;

        if (status === 'submitted' && !claim.submittedDate) {
            claim.submittedDate = new Date();
        }

        if (status === 'approved' && !claim.approvedDate) {
            claim.approvedDate = new Date();
        }

        if (status === 'paid' && !claim.paidDate) {
            claim.paidDate = new Date();
        }

        if (status === 'rejected') {
            claim.rejectionReason = rejectionReason;
        }

        if (notes) {
            claim.notes = notes;
        }

        await claim.save();

        const updatedClaim = await Claim.findById(claim._id)
            .populate('patient', 'firstName lastName patientId')
            .populate('hmo', 'name code')
            .populate('encounter', 'encounterDate');

        res.json(updatedClaim);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Export claims to Excel
// @route   GET /api/claims/export
// @access  Private
const exportClaimsToExcel = async (req, res) => {
    try {
        const { hmo, status, startDate, endDate } = req.query;

        const filter = {};

        if (hmo) {
            filter.hmo = hmo;
        }

        if (status) {
            filter.status = status;
        }

        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const claims = await Claim.find(filter)
            .populate('patient', 'firstName lastName patientId')
            .populate('hmo', 'name code')
            .populate('encounter', 'encounterDate')
            .populate('claimItems.charge');

        // Prepare data for Excel
        const excelData = [];

        claims.forEach(claim => {
            claim.claimItems.forEach(item => {
                excelData.push({
                    'Claim Number': claim.claimNumber,
                    'Patient ID': claim.patient.patientId,
                    'Patient Name': `${claim.patient.firstName} ${claim.patient.lastName}`,
                    'HMO': claim.hmo.name,
                    'HMO Code': claim.hmo.code,
                    'Encounter Date': new Date(claim.encounter.encounterDate).toLocaleDateString(),
                    'Service Type': item.chargeType,
                    'Service Description': item.description,
                    'Quantity': item.quantity,
                    'Unit Price': item.unitPrice.toFixed(2),
                    'Total Amount': item.totalAmount.toFixed(2),
                    'Patient Portion': item.patientPortion.toFixed(2),
                    'HMO Portion': item.hmoPortion.toFixed(2),
                    'Claim Status': claim.status,
                    'Submitted Date': claim.submittedDate ? new Date(claim.submittedDate).toLocaleDateString() : '',
                    'Approved Date': claim.approvedDate ? new Date(claim.approvedDate).toLocaleDateString() : ''
                });
            });
        });

        // Create workbook and worksheet
        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Claims');

        // Generate buffer
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for file download
        res.setHeader('Content-Disposition', 'attachment; filename=hmo-claims.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        res.send(buffer);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get claims summary/statistics
// @route   GET /api/claims/summary
// @access  Private
const getClaimsSummary = async (req, res) => {
    try {
        const { hmo, status, startDate, endDate } = req.query;

        const filter = {};

        if (hmo) {
            filter.hmo = hmo;
        }

        if (status) {
            filter.status = status;
        }

        if (startDate && endDate) {
            filter.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const claims = await Claim.find(filter).populate('hmo', 'name');

        // Calculate summary
        const summary = {
            totalClaims: claims.length,
            totalClaimAmount: claims.reduce((sum, claim) => sum + claim.totalClaimAmount, 0),
            byStatus: {
                pending: 0,
                submitted: 0,
                approved: 0,
                rejected: 0,
                paid: 0
            },
            byHMO: {}
        };

        claims.forEach(claim => {
            // Count by status
            summary.byStatus[claim.status]++;

            // Sum by HMO
            const hmoName = claim.hmo.name;
            if (!summary.byHMO[hmoName]) {
                summary.byHMO[hmoName] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            summary.byHMO[hmoName].count++;
            summary.byHMO[hmoName].totalAmount += claim.totalClaimAmount;
        });

        res.json(summary);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generateClaimFromEncounter,
    getClaims,
    getClaimById,
    getClaimsByHMO,
    updateClaimStatus,
    exportClaimsToExcel,
    getClaimsSummary
};
