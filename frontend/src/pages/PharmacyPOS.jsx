import { useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import {
    FaSearch, FaShoppingCart, FaPlus, FaMinus, FaTrash,
    FaCheckCircle, FaCashRegister, FaUpload, FaTimes, FaReceipt, FaPrint
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const PharmacyPOS = () => {
    const { backendUrl } = useContext(AppContext);
    const { user } = useContext(AuthContext);
    const prescriptionInputRef = useRef();

    // Inventory search
    const [drugSearch, setDrugSearch] = useState('');
    const [inventoryDrugs, setInventoryDrugs] = useState([]);
    const [filteredDrugs, setFilteredDrugs] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // Cart
    const [cart, setCart] = useState([]);

    // Checkout form
    const [customerName, setCustomerName] = useState('');
    const [discount, setDiscount] = useState(0);
    const [taxPct, setTaxPct] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [prescriptionFile, setPrescriptionFile] = useState(null);
    const [prescriptionPreview, setPrescriptionPreview] = useState(null);

    // Sale state
    const [loading, setLoading] = useState(false);
    const [systemSettings, setSystemSettings] = useState(null);

    // Transaction History State
    const [receipts, setReceipts] = useState([]);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    // Fetch inventory and settings on mount
    useEffect(() => {
        const fetchInventory = async () => {
            try {
                let url = `${backendUrl}/api/inventory`;
                if (user.assignedPharmacy) {
                    url += `?pharmacy=${user.assignedPharmacy._id || user.assignedPharmacy}`;
                }
                const { data } = await axios.get(url, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setInventoryDrugs(data);
            } catch {
                toast.error('Failed to load inventory');
            }
        };

        const fetchSystemSettings = async () => {
            try {
                const { data } = await axios.get(`${backendUrl}/api/settings`);
                setSystemSettings(data);
            } catch (error) {
                console.error('Error fetching system settings:', error);
            }
        };

        fetchInventory();
        fetchSystemSettings();
        fetchReceipts();
    }, [backendUrl, user.token]);

    const fetchReceipts = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/receipts/with-claim-status`, config);
            // Filter receipts for Pharmacy
            const pharmacyReceipts = data.filter(r =>
                r.validatedBy?.some(v => v.department === 'Pharmacy')
            );
            setReceipts(pharmacyReceipts);
        } catch (error) {
            console.error('Error fetching receipts:', error);
        }
    };

    // Filter drugs based on search - Aggregate by name
    useEffect(() => {
        if (drugSearch.trim()) {
            const q = drugSearch.toLowerCase();
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const filtered = inventoryDrugs.filter(d =>
                d.name.toLowerCase().includes(q) &&
                d.quantity > 0 &&
                (!d.expiryDate || new Date(d.expiryDate) >= today)
            );

            // Group by name
            const grouped = filtered.reduce((acc, drug) => {
                const key = drug.name.toLowerCase();
                if (!acc[key]) {
                    acc[key] = {
                        ...drug,
                        quantity: 0,
                        batches: []
                    };
                }
                acc[key].quantity += drug.quantity;
                acc[key].batches.push(drug);
                return acc;
            }, {});

            // Sort batches within each group by expiryDate (earliest first)
            Object.values(grouped).forEach(drugGroup => {
                drugGroup.batches.sort((a, b) => {
                    if (!a.expiryDate) return 1;
                    if (!b.expiryDate) return -1;
                    return new Date(a.expiryDate) - new Date(b.expiryDate);
                });
                // Update primary drug info to use the earliest active batch
                const earliestActive = drugGroup.batches.find(b => b.quantity > 0) || drugGroup.batches[0];
                if (earliestActive) {
                    drugGroup._id = earliestActive._id;
                    // Prioritize standardFee to match Inventory.jsx logic
                    drugGroup.price = earliestActive.standardFee || earliestActive.price || 0;
                    drugGroup.standardFee = earliestActive.standardFee;
                    drugGroup.retainershipFee = earliestActive.retainershipFee;
                    drugGroup.familyRetainershipFee = earliestActive.familyRetainershipFee;
                    drugGroup.nhiaFee = earliestActive.nhiaFee;
                    drugGroup.kschmaFee = earliestActive.kschmaFee;
                }
            });

            setFilteredDrugs(Object.values(grouped));
            setShowDropdown(true);
        } else {
            setFilteredDrugs([]);
            setShowDropdown(false);
        }
    }, [drugSearch, inventoryDrugs]);

    const handleAddToCart = (drug) => {
        setShowDropdown(false);
        setDrugSearch('');

        const existing = cart.find(c => c.name.toLowerCase() === drug.name.toLowerCase());
        if (existing) {
            if (existing.quantity >= drug.quantity) {
                toast.warning(`Only ${drug.quantity} units available`);
                return;
            }
            setCart(cart.map(c =>
                c.name.toLowerCase() === drug.name.toLowerCase() ? { ...c, quantity: c.quantity + 1 } : c
            ));
        } else {
            setCart([...cart, {
                inventoryId: drug._id,
                name: drug.name,
                unitPrice: drug.standardFee || drug.price || 0,
                quantity: 1,
                maxQty: drug.quantity,
                form: drug.form || '',
                dosage: drug.dosage || '',
                batches: drug.batches
            }]);
        }
    };

    const handleQtyChange = (inventoryId, delta) => {
        setCart(cart.map(c => {
            if (c.inventoryId !== inventoryId) return c;
            const newQty = c.quantity + delta;
            if (newQty < 1) return c;
            if (newQty > c.maxQty) {
                toast.warning(`Only ${c.maxQty} units available`);
                return c;
            }
            return { ...c, quantity: newQty };
        }));
    };

    const handleRemoveFromCart = (inventoryId) => {
        setCart(cart.filter(c => c.inventoryId !== inventoryId));
    };

    const handlePrescriptionChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setPrescriptionFile(file);
        setPrescriptionPreview(URL.createObjectURL(file));
    };

    const subtotal = cart.reduce((sum, c) => sum + c.unitPrice * c.quantity, 0);
    const discountAmt = parseFloat(discount) || 0;
    const taxAmt = (subtotal - discountAmt) * (parseFloat(taxPct) / 100) || 0;
    const total = subtotal - discountAmt + taxAmt;

    const handleCompleteSale = async () => {
        if (!customerName.trim()) {
            toast.error('Customer name is required');
            return;
        }
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        try {
            setLoading(true);

            // Upload prescription image if provided
            let prescriptionImageUrl = null;
            if (prescriptionFile) {
                const formData = new FormData();
                formData.append('prescription', prescriptionFile);
                try {
                    // Try to upload; if no dedicated endpoint, skip gracefully
                    const uploadRes = await axios.post(`${backendUrl}/api/upload/prescription`, formData, {
                        headers: {
                            Authorization: `Bearer ${user.token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    });
                    prescriptionImageUrl = uploadRes.data?.url || null;
                } catch {
                    // Upload endpoint may not exist – just store the filename as note
                    prescriptionImageUrl = `[Attached: ${prescriptionFile.name}]`;
                }
            }

            const payload = {
                customerName: customerName.trim(),
                items: cart.map(c => ({
                    inventoryId: c.inventoryId,
                    name: c.name,
                    quantity: c.quantity,
                    unitPrice: c.unitPrice,
                    standardFee: c.unitPrice // Ensure standardFee is passed for reporting
                })),
                discount: discountAmt,
                tax: taxAmt,
                paymentMethod,
                prescriptionImageUrl
            };

            const { data } = await axios.post(`${backendUrl}/api/pharmacies/pos-sale`, payload, {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            // Automatically trigger receipt print
            if (data.receipt) {
                handlePrintReceipt(data.receipt);
            }

            // Reset form
            setCart([]);
            setCustomerName('');
            setDiscount(0);
            setTaxPct(0);
            setPaymentMethod('cash');
            setPrescriptionFile(null);
            setPrescriptionPreview(null);
            fetchReceipts();

            // Re-fetch inventory to reflect deductions
            const { data: inv } = await axios.get(`${backendUrl}/api/inventory`, {
                headers: { Authorization: `Bearer ${user.token}` }
            });
            setInventoryDrugs(inv);

        } catch (error) {
            toast.error(error.response?.data?.message || 'Sale failed');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReceipt = (receiptToPrint) => {
        const receipt = receiptToPrint || completedReceipt?.receipt;
        if (!receipt) return;

        const printWindow = window.open('', '', 'width=600,height=600');
        if (!printWindow) {
            toast.error('Browser blocked the popup. Please allow popups for this site to print receipts.');
            return;
        }

        printWindow.document.write(`
            <html>
                <head>
                    <title>Receipt ${receipt.receiptNumber}</title>
                    <style>
                        body { font-family: 'Courier New', monospace; padding: 20px; max-width: 400px; margin: 0 auto; }
                        .header { text-align: center; margin-bottom: 20px; border-bottom: 2px dashed #000; padding-bottom: 10px; }
                        .info-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 14px; }
                        .items-table { width: 100%; margin-top: 15px; border-collapse: collapse; }
                        .items-table th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 5px; }
                        .items-table td { padding: 5px 0; }
                        .total-row { border-top: 2px dashed #000; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 18px; display: flex; justify-content: space-between; }
                        .footer { text-align: center; margin-top: 30px; font-size: 12px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        ${systemSettings?.hospitalLogo ? `<img src="${systemSettings.hospitalLogo}" style="height: 150px; max-width: 250px; object-fit: contain; margin-bottom: 0;" />` : ''}
                        <h2 style="margin: 0 0 5px 0;">${systemSettings?.reportHeader || 'ALJOUD HOSPITAL'}</h2>
                        <p style="margin: 5px 0; font-size: 12px;">${systemSettings?.address || ''}</p>
                        <p style="margin: 2px 0; font-size: 12px;">
                            ${systemSettings?.phone ? `Phone: ${systemSettings.phone}` : ''}
                            ${systemSettings?.phone && systemSettings?.email ? ' | ' : ''}
                            ${systemSettings?.email ? `Email: ${systemSettings.email}` : ''}
                        </p>
                        <h3 style="margin-top: 15px; border: 1px solid #000; display: inline-block; padding: 2px 10px;">PHARMACY RECEIPT</h3>
                    </div>
                    <div class="info-row"><span>Receipt #:</span> <strong>${receipt.receiptNumber}</strong></div>
                    <div class="info-row"><span>Date:</span> <span>${new Date(receipt.createdAt || new Date()).toLocaleString()}</span></div>
                    <div class="info-row"><span>Customer:</span> <strong>${receipt.patient?.name || 'Walk-in'}</strong></div>
                    <div class="info-row"><span>Pharmacist:</span> <strong>${receipt.cashier?.name || user.name}</strong></div>
                    <div class="info-row"><span>Method:</span> <span style="text-transform: uppercase;">${receipt.paymentMethod}</span></div>

                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Drug Name</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${receipt.charges?.map(c => `
                                <tr>
                                    <td>
                                        ${c.itemName || c.name || 'Drug'} 
                                        ${c.quantity > 1 ? `(x${c.quantity})` : ''}
                                    </td>
                                    <td style="text-align: right;">₦${(c.totalAmount || c.unitPrice * c.quantity || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            `).join('') || ''}
                        </tbody>
                    </table>

                    <div class="total-row">
                        <span>TOTAL PAID:</span>
                        <span>₦${(receipt.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div class="footer">
                        <p>Thank you for your purchase!</p>
                        <p>Drugs sold are not returnable.</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    const handleClearCart = () => {
        setCart([]);
        setCustomerName('');
        setDiscount(0);
        setTaxPct(0);
        setPrescriptionFile(null);
        setPrescriptionPreview(null);
    };

    return (
        <Layout>
            {/* Page Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaCashRegister className="text-green-600" /> Point of Sale
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Sell drugs directly to walk-in customers — no receptionist or cashier required
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Left: Drug Search + Cart */}
                <div className="lg:col-span-3 space-y-4">

                    {/* Drug Search */}
                    <div className="bg-white rounded-lg shadow p-5">
                        <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <FaSearch className="text-blue-500" /> Search Drug / Product
                        </h3>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search product by name or scan barcode..."
                                className="w-full border border-gray-300 rounded-lg p-3 pl-10 focus:outline-none focus:ring-2 focus:ring-blue-400 text-sm"
                                value={drugSearch}
                                onChange={e => setDrugSearch(e.target.value)}
                                onFocus={() => drugSearch && setShowDropdown(true)}
                            />
                            <FaSearch className="absolute left-3 top-3.5 text-gray-400" />

                            {showDropdown && filteredDrugs.length > 0 && (
                                <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                                    {filteredDrugs.map(drug => (
                                        <div
                                            key={drug._id}
                                            className="flex justify-between items-center p-3 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
                                            onClick={() => handleAddToCart(drug)}
                                        >
                                            <div>
                                                <p className="font-semibold text-gray-800 text-sm">{drug.name}</p>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {drug.form && <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{drug.form}</span>}
                                                    {drug.dosage && <span className="text-[10px] bg-blue-50 px-1.5 py-0.5 rounded text-blue-600">{drug.dosage}</span>}
                                                    {drug.expiryDate && (
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${new Date(drug.expiryDate) < new Date() ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-600'}`}>
                                                            Exp: {new Date(drug.expiryDate).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-gray-500 mt-1">
                                                    Stock: <span className="font-bold text-gray-700">{drug.quantity}</span> {drug.drugUnit || 'units'}
                                                    {drug.batches.length > 1 && <span className="ml-1 italic">({drug.batches.length} batches)</span>}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-green-600 text-base">₦{(drug.standardFee || drug.price || 0).toLocaleString()}</p>
                                                <div className="flex flex-col items-end gap-0.5 mt-0.5">
                                                    <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">In Stock</span>
                                                    {drug.retainershipFee > 0 && <span className="text-[9px] text-purple-500 font-medium tracking-tight">Corp: ₦{drug.retainershipFee.toLocaleString()}</span>}
                                                    {drug.familyRetainershipFee > 0 && <span className="text-[9px] text-pink-500 font-medium tracking-tight">Fam: ₦{drug.familyRetainershipFee.toLocaleString()}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            {showDropdown && drugSearch && filteredDrugs.length === 0 && (
                                <div className="absolute z-20 w-full bg-white border rounded-lg shadow mt-1 p-4 text-center text-gray-500 text-sm">
                                    No matching drugs in inventory
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cart Items */}
                    <div className="bg-white rounded-lg shadow p-5">
                        <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <FaShoppingCart className="text-indigo-500" />
                            Cart Items {cart.length > 0 && <span className="bg-indigo-100 text-indigo-700 text-xs px-2 py-0.5 rounded-full">{cart.length}</span>}
                        </h3>

                        {cart.length === 0 ? (
                            <div className="text-center py-10 text-gray-400">
                                <FaShoppingCart className="text-5xl mx-auto mb-3 opacity-30" />
                                <p>Cart is empty. Search and add drugs above.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.map(item => (
                                    <div
                                        key={item.inventoryId}
                                        className="flex items-center justify-between border border-gray-100 rounded-lg p-3 bg-gray-50 hover:bg-white transition"
                                    >
                                        <div className="flex-1">
                                            <p className="font-semibold text-gray-800">{item.name}</p>
                                            <p className="text-xs text-gray-500">₦{item.unitPrice.toLocaleString()} each</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleQtyChange(item.inventoryId, -1)}
                                                className="w-7 h-7 rounded-full bg-gray-200 hover:bg-red-100 flex items-center justify-center text-gray-700"
                                            >
                                                <FaMinus size={10} />
                                            </button>
                                            <span className="w-8 text-center font-bold">{item.quantity}</span>
                                            <button
                                                onClick={() => handleQtyChange(item.inventoryId, 1)}
                                                className="w-7 h-7 rounded-full bg-gray-200 hover:bg-green-100 flex items-center justify-center text-gray-700"
                                            >
                                                <FaPlus size={10} />
                                            </button>
                                        </div>
                                        <div className="w-28 text-right">
                                            <p className="font-bold text-gray-800">₦{(item.unitPrice * item.quantity).toLocaleString()}</p>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveFromCart(item.inventoryId)}
                                            className="ml-3 text-red-400 hover:text-red-600"
                                        >
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Checkout Panel */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow p-5 sticky top-4">
                        <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <FaReceipt className="text-green-600" /> Checkout
                        </h3>

                        {/* Customer Name - REQUIRED */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Customer Name <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Patient's full name"
                                className={`w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 ${!customerName && 'border-gray-300'} ${customerName ? 'border-green-400' : ''}`}
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                            />
                            {!customerName && (
                                <p className="text-xs text-red-400 mt-1">Customer name is required</p>
                            )}
                        </div>

                        {/* Prescription Image Upload - OPTIONAL */}
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Prescription Image <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <div
                                className="border-2 border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-blue-400 transition"
                                onClick={() => prescriptionInputRef.current?.click()}
                            >
                                {prescriptionPreview ? (
                                    <div className="relative">
                                        <img src={prescriptionPreview} alt="Prescription" className="max-h-28 mx-auto rounded" />
                                        <button
                                            onClick={e => { e.stopPropagation(); setPrescriptionFile(null); setPrescriptionPreview(null); }}
                                            className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <FaUpload className="text-gray-400 text-2xl mx-auto mb-1" />
                                        <p className="text-xs text-gray-500">Click to upload prescription image</p>
                                        <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={prescriptionInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handlePrescriptionChange}
                            />
                        </div>

                        {/* Pricing */}
                        <div className="border-t pt-4 space-y-2.5 text-sm">
                            <div className="flex justify-between text-gray-600">
                                <span>Subtotal</span>
                                <span className="font-semibold">₦{subtotal.toLocaleString()}</span>
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-gray-600 w-24 flex-shrink-0">Discount (₦)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="flex-1 border rounded p-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                                    value={discount}
                                    onChange={e => setDiscount(e.target.value)}
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <label className="text-gray-600 w-24 flex-shrink-0">Tax (%)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    className="flex-1 border rounded p-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-300"
                                    value={taxPct}
                                    onChange={e => setTaxPct(e.target.value)}
                                />
                            </div>

                            {taxAmt > 0 && (
                                <div className="flex justify-between text-gray-500 text-xs">
                                    <span>Tax Amount</span>
                                    <span>₦{taxAmt.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-lg font-bold text-green-600 pt-2 border-t">
                                <span>Total</span>
                                <span>₦{Math.max(0, total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="mt-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Method</label>
                            <select
                                className="w-full border rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                                value={paymentMethod}
                                onChange={e => setPaymentMethod(e.target.value)}
                            >
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="deposit">Deposit</option>
                                <option value="insurance">Insurance</option>
                            </select>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-5 space-y-2">
                            <button
                                onClick={handleCompleteSale}
                                disabled={loading || cart.length === 0 || !customerName.trim()}
                                className="w-full bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <FaCheckCircle />
                                        Complete Sale
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleClearCart}
                                disabled={loading}
                                className="w-full bg-red-500 text-white py-2 rounded-lg font-semibold hover:bg-red-600 disabled:opacity-50 transition text-sm"
                            >
                                Clear Cart
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction History Table */}
            <div className="mt-12 bg-white p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <FaReceipt className="text-blue-600" /> Pharmacy Transaction History
                    </h3>
                    <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border rounded p-1.5 text-sm focus:ring-2 focus:ring-blue-400"
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100 text-gray-600 text-xs uppercase font-bold">
                                <th className="p-3 border-b">Receipt #</th>
                                <th className="p-3 border-b">Customer</th>
                                <th className="p-3 border-b">Amount</th>
                                <th className="p-3 border-b">Method</th>
                                <th className="p-3 border-b">Pharmacist</th>
                                <th className="p-3 border-b">Time</th>
                                <th className="p-3 border-b text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {receipts
                                .filter(r => {
                                    const receiptDate = new Date(r.createdAt).toISOString().split('T')[0];
                                    return receiptDate >= startDate && receiptDate <= endDate;
                                })
                                .length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-10 text-center text-gray-400 italic">
                                        No transactions found for the selected period.
                                    </td>
                                </tr>
                            ) : (
                                receipts
                                    .filter(r => {
                                        const receiptDate = new Date(r.createdAt).toISOString().split('T')[0];
                                        return receiptDate >= startDate && receiptDate <= endDate;
                                    })
                                    .map((receipt) => (
                                        <tr key={receipt._id} className="hover:bg-blue-50 transition-colors border-b last:border-0 text-gray-700">
                                            <td className="p-3 font-mono font-bold text-blue-600">{receipt.receiptNumber}</td>
                                            <td className="p-3 font-semibold">
                                                {receipt.patient?.name || 'Walk-in'}
                                            </td>
                                            <td className="p-3 text-green-600 font-bold">
                                                ₦{(receipt.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="p-3">
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${receipt.paymentMethod === 'cash' ? 'bg-green-100 text-green-800' :
                                                    receipt.paymentMethod === 'card' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-purple-100 text-purple-800'
                                                    }`}>
                                                    {receipt.paymentMethod}
                                                </span>
                                            </td>
                                            <td className="p-3 font-medium text-gray-600">{receipt.cashier?.name}</td>
                                            <td className="p-3 text-xs text-gray-400">{new Date(receipt.createdAt).toLocaleString()}</td>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => handlePrintReceipt(receipt)}
                                                    className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-100 rounded-full transition-all"
                                                    title="Print Receipt"
                                                >
                                                    <FaPrint />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                        {receipts.filter(r => {
                            const receiptDate = new Date(r.createdAt).toISOString().split('T')[0];
                            return receiptDate >= startDate && receiptDate <= endDate;
                        }).length > 0 && (
                                <tfoot>
                                    <tr className="bg-gray-50 font-bold text-gray-800">
                                        <td colSpan="2" className="p-4 text-right uppercase text-xs tracking-wider">Total Revenue:</td>
                                        <td className="p-4 text-green-700 text-lg">
                                            ₦{receipts
                                                .filter(r => {
                                                    const receiptDate = new Date(r.createdAt).toISOString().split('T')[0];
                                                    return receiptDate >= startDate && receiptDate <= endDate;
                                                })
                                                .reduce((sum, r) => sum + (r.amountPaid || 0), 0)
                                                .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td colSpan="4"></td>
                                    </tr>
                                </tfoot>
                            )}
                    </table>
                </div>
            </div>
        </Layout>
    );
};

export default PharmacyPOS;
