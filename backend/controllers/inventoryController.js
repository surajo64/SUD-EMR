const Inventory = require('../models/inventoryModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Prescription = require('../models/prescriptionModel');

// @desc Get all drugs
// @route GET /api/inventory
// @access Private
const getInventory = async (req, res) => {
    try {
        const { pharmacy } = req.query;
        const filter = {};

        if (pharmacy) {
            filter.pharmacy = pharmacy;
        }

        const items = await Inventory.find(filter)
            .populate('pharmacy', 'name')
            .sort({ createdAt: -1 });
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Add new drug
// @route POST /api/inventory
// @access Private
const addInventoryItem = async (req, res) => {
    const { name, quantity, price, standardFee, retainershipFee, nhiaFee, kschmaFee, purchasingPrice, expiryDate, supplier, batchNumber, barcode, reorderLevel, route, form, dosage, frequency, drugUnit, pharmacy } = req.body;

    if (!name || !quantity || (!price && !standardFee) || !expiryDate || !pharmacy) {
        return res.status(400).json({ message: "Please fill all required fields including pharmacy" });
    }

    const finalStandardFee = standardFee || price;
    const finalPrice = price || standardFee;

    const item = await Inventory.create({
        name,
        quantity,
        quantity,
        price: finalPrice,
        standardFee: finalStandardFee,
        retainershipFee: retainershipFee || 0,
        nhiaFee: nhiaFee || 0,
        kschmaFee: kschmaFee || 0,
        purchasingPrice,
        expiryDate,
        supplier,
        batchNumber,
        barcode,
        reorderLevel,
        route,
        form,
        dosage,
        frequency,
        drugUnit,
        pharmacy
    });

    res.status(201).json(item);
};

// @desc Update drug
// @route PUT /api/inventory/:id
// @access Private
const updateInventoryItem = async (req, res) => {
    const { name, quantity, price, standardFee, retainershipFee, nhiaFee, kschmaFee, purchasingPrice, expiryDate, supplier, batchNumber, barcode, reorderLevel, route, form, dosage, frequency, drugUnit, pharmacy } = req.body;

    const finalStandardFee = standardFee || price;
    const finalPrice = price || standardFee;

    const updatedItem = await Inventory.findByIdAndUpdate(
        req.params.id,
        {
            name,
            quantity,
            price: finalPrice,
            standardFee: finalStandardFee,
            retainershipFee: retainershipFee || 0,
            nhiaFee: nhiaFee || 0,
            kschmaFee: kschmaFee || 0,
            purchasingPrice,
            expiryDate,
            supplier,
            batchNumber,
            barcode,
            reorderLevel,
            route,
            form,
            dosage,
            frequency,
            drugUnit,
            pharmacy
        },
        { new: true }
    ).populate('pharmacy', 'name');

    if (!updatedItem) return res.status(404).json({ message: "Item not found" });

    res.json(updatedItem);
};

// @desc Delete drug
// @route DELETE /api/inventory/:id
// @access Private
const deleteInventoryItem = async (req, res) => {
    const item = await Inventory.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    await item.deleteOne();
    res.json({ message: "Item removed" });
};

// @desc Get inventory alerts (low stock, expiring, expired)
// @route GET /api/inventory/alerts
// @access Private
const getInventoryAlerts = async (req, res) => {
    try {
        const { pharmacy } = req.query;
        const today = new Date();
        const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

        // Build filter based on pharmacy parameter
        const filter = {};
        if (pharmacy) {
            filter.pharmacy = pharmacy;
        }

        const allItems = await Inventory.find(filter);

        const lowStock = allItems.filter(item => item.quantity < item.reorderLevel);
        const expiringSoon = allItems.filter(item => {
            const expiryDate = new Date(item.expiryDate);
            return expiryDate > today && expiryDate <= thirtyDaysFromNow;
        });
        const expired = allItems.filter(item => new Date(item.expiryDate) < today);

        res.json({
            lowStock,
            expiringSoon,
            expired,
            summary: {
                lowStockCount: lowStock.length,
                expiringSoonCount: expiringSoon.length,
                expiredCount: expired.length
            }
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get profit and loss report
// @route   GET /api/inventory/reports/profit-loss
// @access  Private
const getProfitLossReport = async (req, res) => {
    try {
        const { startDate, endDate, pharmacy } = req.query;

        // 1. Build date filter
        const dateFilter = {};
        if (startDate && endDate) {
            // Set time to start of day and end of day
            const start = new Date(startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);

            dateFilter.createdAt = {
                $gte: start,
                $lte: end
            };
        }

        // 2. Find EncounterCharges (Sales)
        // We need to populate 'charge' to check if it's a drug
        // And 'addedBy' to check pharmacy context
        let charges = await EncounterCharge.find(dateFilter)
            .populate('charge')
            .populate('addedBy')
            .sort({ createdAt: -1 });

        // Filter for drugs only (where charge.type is 'drugs')
        charges = charges.filter(c => c.charge && c.charge.type === 'drugs');

        // Fetch linked Prescriptions to get dispensedBy info
        const chargeIds = charges.map(c => c._id);
        const prescriptions = await Prescription.find({ charge: { $in: chargeIds } })
            .populate({
                path: 'dispensedBy',
                populate: { path: 'assignedPharmacy' }
            });

        const prescriptionMap = {}; // Map chargeId -> prescription
        prescriptions.forEach(p => {
            if (p.charge) prescriptionMap[p.charge.toString()] = p;
        });

        // Helper to get pharmacy for a charge
        const getChargePharmacy = (charge) => {
            // 1. Try dispensedBy from Prescription
            const prescription = prescriptionMap[charge._id.toString()];
            if (prescription && prescription.dispensedBy && prescription.dispensedBy.assignedPharmacy) {
                return prescription.dispensedBy.assignedPharmacy;
            }
            // 2. Fallback to addedBy (Doctor)
            if (charge.addedBy && charge.addedBy.assignedPharmacy) {
                return charge.addedBy.assignedPharmacy;
            }
            return null;
        };

        // 3. Apply Pharmacy Filter
        // If user is a pharmacist, restrict to their assigned pharmacy
        // If admin/main, allow filtering by query param
        let targetPharmacyId = pharmacy;

        // If user is a pharmacist, restrict to their assigned pharmacy ONLY if they are NOT Main Pharmacy
        if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
            const isMain = req.user.assignedPharmacy.isMainPharmacy;
            if (!isMain) {
                targetPharmacyId = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
            }
        }

        if (targetPharmacyId) {
            charges = charges.filter(c => {
                const salePharmacy = getChargePharmacy(c);
                const salePharmacyId = salePharmacy?._id || salePharmacy;

                return salePharmacyId && (salePharmacyId.toString() === targetPharmacyId.toString());
            });
        }

        // 4. Calculate P&L
        let totalRevenue = 0;
        let totalCost = 0;
        const breakdown = [];

        for (const sale of charges) {
            // Determine which pharmacy this sale belongs to
            const salePharmacy = getChargePharmacy(sale);
            const salePharmacyId = salePharmacy?._id || salePharmacy;

            // Find inventory item to get purchasing price
            // We try to find the item in the seller's pharmacy first
            let inventoryItem = null;

            if (salePharmacyId) {
                // Try exact match first
                inventoryItem = await Inventory.findOne({
                    name: sale.charge.name,
                    pharmacy: salePharmacyId
                });

                // Try case-insensitive regex if exact match fails
                if (!inventoryItem) {
                    inventoryItem = await Inventory.findOne({
                        name: { $regex: new RegExp(`^${sale.charge.name}$`, 'i') },
                        pharmacy: salePharmacyId
                    });
                }
            }

            // Fallback: if not found in specific pharmacy, find any match in the system
            if (!inventoryItem) {
                inventoryItem = await Inventory.findOne({
                    name: { $regex: new RegExp(`^${sale.charge.name}$`, 'i') }
                });
            }

            if (!inventoryItem) {
                console.log(`[P&L] Warning: Could not find inventory item for '${sale.charge.name}' to determine cost.`);
            }

            // Calculate metrics
            const revenue = sale.totalAmount || 0;
            const costPrice = inventoryItem ? (inventoryItem.purchasingPrice || 0) : 0;
            const cost = costPrice * (sale.quantity || 1);
            const profit = revenue - cost;

            totalRevenue += revenue;
            totalCost += cost;

            breakdown.push({
                _id: sale._id,
                date: sale.createdAt,
                itemName: sale.charge.name,
                quantity: sale.quantity || 1,
                sellingPrice: revenue / (sale.quantity || 1),
                costPrice: costPrice,
                totalRevenue: revenue,
                totalCost: cost,
                profit: profit,
                pharmacyId: salePharmacyId,
                status: sale.status
            });
        }

        res.json({
            period: { startDate, endDate },
            summary: {
                totalRevenue,
                totalCost,
                netProfit: totalRevenue - totalCost,
                itemCount: charges.length
            },
            breakdown
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getInventory,
    addInventoryItem,
    updateInventoryItem,
    deleteInventoryItem,
    getInventoryAlerts,
    getProfitLossReport,
};
