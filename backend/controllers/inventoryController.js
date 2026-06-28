const Inventory = require('../models/inventoryModel');
const EncounterCharge = require('../models/encounterChargeModel');
const Prescription = require('../models/prescriptionModel');
const Pharmacy = require('../models/pharmacyModel');
const xlsx = require('xlsx');

// @desc Get all drugs
// @route GET /api/inventory
// @access Private
const getInventory = async (req, res) => {
    try {
        const { pharmacy } = req.query;
        let filter = {};

        const userRole = req.user.role ? req.user.role.toLowerCase() : '';
        const userPharmacyId = req.user.assignedPharmacy?._id || req.user.assignedPharmacy;

        // Apply access control
        if (userRole === 'pharmacist') {
            if (req.user.assignedPharmacy) {
                const isMain = req.user.assignedPharmacy.isMainPharmacy;

                if (!isMain) {
                    // Branch pharmacist
                    if (pharmacy && pharmacy !== userPharmacyId.toString()) {
                        const targetPharmacy = await Pharmacy.findById(pharmacy);
                        if (targetPharmacy && targetPharmacy.isMainPharmacy) {
                            filter.pharmacy = pharmacy;
                        } else {
                            filter.pharmacy = userPharmacyId;
                        }
                    } else {
                        filter.pharmacy = userPharmacyId;
                    }
                } else if (pharmacy) {
                    filter.pharmacy = pharmacy;
                }
            } else {
                return res.json([]);
            }
        } else if (userRole === 'admin') {
            if (pharmacy) {
                filter.pharmacy = pharmacy;
            }
        } else if (pharmacy) {
            filter.pharmacy = pharmacy;
        }

        const items = await Inventory.find(filter)
            .populate('pharmacy', 'name')
            .sort({ name: 1, expiryDate: 1 }); // FEFO: same drug batches sorted by earliest expiry first

        res.json(items);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Add new drug
// @route POST /api/inventory
// @access Private
const addInventoryItem = async (req, res) => {
    const userRole = req.user.role ? req.user.role.toLowerCase() : '';
    const isMainPharmacist = userRole === 'pharmacist' && req.user.assignedPharmacy?.isMainPharmacy === true;

    // Only admin, super_admin, or MAIN pharmacy pharmacists can add drugs
    if (!['admin', 'super_admin'].includes(userRole) && !isMainPharmacist) {
        return res.status(403).json({ message: "Access denied. Only main pharmacy pharmacists can add drugs." });
    }

    const { name, quantity, price, standardFee, retainershipFee, familyRetainershipFee, nhiaFee, kschmaFee, purchasingPrice, expiryDate, supplier, batchNumber, barcode, reorderLevel, route, form, dosage, frequency, drugUnit, pharmacy } = req.body;

    if (!name || !quantity || (!price && !standardFee) || !expiryDate || !pharmacy) {
        return res.status(400).json({ message: "Please fill all required fields including pharmacy" });
    }

    // Branch Protection: Pharmacists can only add to their own pharmacy unless they are Main Pharmacy
    if (userRole === 'pharmacist' && req.user.assignedPharmacy) {
        if (!req.user.assignedPharmacy.isMainPharmacy && pharmacy.toString() !== req.user.assignedPharmacy._id.toString()) {
            return res.status(403).json({ message: "Access denied. You can only add drugs to your own pharmacy." });
        }
    }

    // For backward compatibility, keep price and standardFee in sync
    // Prioritize standardFee if provided, otherwise use price
    const finalStandardFee = standardFee ? parseFloat(standardFee) : (price ? parseFloat(price) : 0);
    const finalPrice = finalStandardFee;

    const item = await Inventory.create({
        name,
        quantity,
        quantity,
        price: finalPrice,
        standardFee: finalStandardFee,
        retainershipFee: retainershipFee || 0,
        familyRetainershipFee: familyRetainershipFee || 0,
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
    const userRole = req.user.role ? req.user.role.toLowerCase() : '';
    const isMainPharmacist = userRole === 'pharmacist' && req.user.assignedPharmacy?.isMainPharmacy === true;

    // Only admin, super_admin, or MAIN pharmacy pharmacists can update drugs
    if (!['admin', 'super_admin'].includes(userRole) && !isMainPharmacist) {
        return res.status(403).json({ message: "Access denied. Only main pharmacy pharmacists can edit drugs." });
    }

    // Additional check for branch pharmacists (they can only edit their own items)
    // The specific logic to check if they are editing an item in their pharmacy 
    // can be added here if needed, but usually is protected by the pharmacy field in currentItem.

    const { name, quantity, price, standardFee, retainershipFee, familyRetainershipFee, nhiaFee, kschmaFee, purchasingPrice, expiryDate, supplier, batchNumber, barcode, reorderLevel, route, form, dosage, frequency, drugUnit, pharmacy } = req.body;

    // For backward compatibility, keep price and standardFee in sync
    // Prioritize standardFee if provided, otherwise use price
    const finalStandardFee = standardFee ? parseFloat(standardFee) : (price ? parseFloat(price) : 0);
    const finalPrice = finalStandardFee;

    const updatedItem = await Inventory.findByIdAndUpdate(
        req.params.id,
        {
            name,
            quantity,
            price: finalPrice,
            standardFee: finalStandardFee,
            retainershipFee: retainershipFee || 0,
            familyRetainershipFee: familyRetainershipFee || 0,
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

    // Branch Protection: Pharmacists can only update items in their own pharmacy
    if (userRole === 'pharmacist' && req.user.assignedPharmacy) {
        if (!req.user.assignedPharmacy.isMainPharmacy && updatedItem.pharmacy?._id.toString() !== req.user.assignedPharmacy._id.toString()) {
            return res.status(403).json({ message: "Access denied. You can only update drugs in your own pharmacy." });
        }
    }

    res.json(updatedItem);
};

// @desc Delete drug
// @route DELETE /api/inventory/:id
// @access Private
const deleteInventoryItem = async (req, res) => {
    const userRole = req.user.role ? req.user.role.toLowerCase() : '';
    const isMainPharmacist = userRole === 'pharmacist' && req.user.assignedPharmacy?.isMainPharmacy === true;

    // Only admin, super_admin, or MAIN pharmacy pharmacists can delete drugs
    if (!['admin', 'super_admin'].includes(userRole) && !isMainPharmacist) {
        return res.status(403).json({ message: "Access denied. Only main pharmacy pharmacists can remove drugs." });
    }

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

        const userRole = req.user.role ? req.user.role.toLowerCase() : '';
        const userPharmacyId = req.user.assignedPharmacy?._id || req.user.assignedPharmacy;

        // Apply access control for alerts
        let filter = {};
        if (userRole === 'pharmacist') {
            if (req.user.assignedPharmacy) {
                const isMain = req.user.assignedPharmacy.isMainPharmacy;
                if (!isMain) {
                    filter.pharmacy = userPharmacyId;
                } else if (pharmacy) {
                    filter.pharmacy = pharmacy;
                }
            } else {
                return res.json({ lowStock: [], expiringSoon: [], expired: [], summary: { lowStockCount: 0, expiringSoonCount: 0, expiredCount: 0 } });
            }
        } else if (userRole === 'admin') {
            if (pharmacy) {
                filter.pharmacy = pharmacy;
            }
        } else if (pharmacy) {
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

// @desc    Import Inventory from Excel
// @route   POST /api/inventory/import-excel
// @access  Private
const importInventoryFromExcel = async (req, res) => {
    try {
        const userRole = req.user.role ? req.user.role.toLowerCase() : '';
        const isMainPharmacist = userRole === 'pharmacist' && req.user.assignedPharmacy?.isMainPharmacy === true;

        // Only admin, super_admin, or MAIN pharmacy pharmacists can import inventory
        if (!['admin', 'super_admin'].includes(userRole) && !isMainPharmacist) {
            return res.status(403).json({ message: "Access denied. Only main pharmacy pharmacists can import inventory." });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { pharmacy } = req.query;
        let targetPharmacyId = pharmacy;

        // For main pharmacy pharmacist, they can import into any pharmacy if provided, 
        // but if not provided, we need to ensure they have a target.
        // If branch pharmacist reached here (though blocked by check above), they'd be locked to their pharmacy.

        if (req.user.role === 'pharmacist' && req.user.assignedPharmacy) {
            const isMain = req.user.assignedPharmacy.isMainPharmacy;
            if (!isMain) {
                targetPharmacyId = req.user.assignedPharmacy._id || req.user.assignedPharmacy;
            }
        }

        if (!targetPharmacyId) {
            return res.status(400).json({ message: 'Pharmacy ID is required' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        const results = { success: [], failed: [] };

        for (const row of data) {
            try {
                const name = row['Drug Name'] || row['name'];
                if (!name) {
                    results.failed.push({ row, error: 'Drug Name is required' });
                    continue;
                }

                const quantity = parseInt(row['Quantity'] || row['quantity'] || 0);
                const standardFee = parseFloat(row['Standard Fee'] || row['standardFee'] || 0);
                const purchasingPrice = parseFloat(row['Purchasing Price'] || row['purchasingPrice'] || 0);

                let expiryDate = row['Expiry Date'] || row['expiryDate'];
                if (expiryDate && typeof expiryDate === 'number') {
                    // Handle Excel dates
                    expiryDate = new Date((expiryDate - (25567 + 1)) * 86400 * 1000);
                } else if (expiryDate) {
                    expiryDate = new Date(expiryDate);
                }

                if (!expiryDate || isNaN(expiryDate.getTime())) {
                    results.failed.push({ row, error: 'Valid Expiry Date is required' });
                    continue;
                }

                const item = await Inventory.create({
                    name,
                    quantity,
                    price: standardFee,
                    standardFee,
                    retainershipFee: parseFloat(row['Retainership Fee'] || row['retainershipFee'] || 0),
                    familyRetainershipFee: parseFloat(row['Family Retainership Fee'] || row['familyRetainershipFee'] || 0),
                    nhiaFee: parseFloat(row['NHIA Fee'] || row['nhiaFee'] || 0),
                    kschmaFee: parseFloat(row['KSCHMA Fee'] || row['kschmaFee'] || 0),
                    purchasingPrice,
                    expiryDate,
                    supplier: row['Supplier'] || row['supplier'] || '',
                    batchNumber: row['Batch Number'] || row['batchNumber'] || '',
                    reorderLevel: parseInt(row['Reorder Level'] || row['reorderLevel'] || 10),
                    route: row['Route'] || row['route'] || '',
                    form: row['Form'] || row['form'] || '',
                    dosage: row['Dosage'] || row['dosage'] || '',
                    frequency: row['Frequency'] || row['frequency'] || '',
                    drugUnit: (row['Drug Unit'] || row['drugUnit'] || 'unit').toLowerCase(),
                    pharmacy: targetPharmacyId
                });

                results.success.push(item);
            } catch (error) {
                results.failed.push({ row, error: error.message });
            }
        }

        res.json({
            message: `Imported ${results.success.length} drug(s) successfully. ${results.failed.length} failed.`,
            results
        });
    } catch (error) {
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
    importInventoryFromExcel,
};
