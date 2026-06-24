import { useState, useContext, useEffect, useRef } from 'react';
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import {
    FaSearch, FaShoppingCart, FaPlus, FaMinus, FaTrash,
    FaCheckCircle, FaCashRegister, FaTimes, FaReceipt, FaPrint, FaFlask
} from 'react-icons/fa';
import { toast } from 'react-toastify';

const LabPOS = () => {
    const { backendUrl } = useContext(AppContext);
    const { user } = useContext(AuthContext);

    // Search
    const [testSearch, setTestSearch] = useState('');
    const [allCharges, setAllCharges] = useState([]);
    const [filteredCharges, setFilteredCharges] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);

    // Cart
    const [cart, setCart] = useState([]);

    // Checkout form
    const [customerName, setCustomerName] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('Male');
    const [paymentMethod, setPaymentMethod] = useState('cash');

    // Sale state
    const [loading, setLoading] = useState(false);
    const [systemSettings, setSystemSettings] = useState(null);

    // Transaction History State
    const [receipts, setReceipts] = useState([]);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        const fetchCharges = async () => {
            try {
                // Fetch all lab charges
                const { data } = await axios.get(`${backendUrl}/api/charges?type=lab&active=true`, {
                    headers: { Authorization: `Bearer ${user.token}` }
                });
                setAllCharges(data);
            } catch {
                toast.error('Failed to load lab tests');
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

        fetchCharges();
        fetchSystemSettings();
        fetchReceipts();
    }, [backendUrl, user.token]);

    const fetchReceipts = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/receipts/with-claim-status`, config);
            // Filter receipts for Lab
            const labReceipts = data.filter(r =>
                r.validatedBy?.some(v => v.department === 'Lab')
            );
            setReceipts(labReceipts);
        } catch (error) {
            console.error('Error fetching receipts:', error);
        }
    };

    // Filter based on search
    useEffect(() => {
        if (testSearch.trim()) {
            const q = testSearch.toLowerCase();
            const results = allCharges.filter(c =>
                c.name.toLowerCase().includes(q)
            );
            setFilteredCharges(results);
            setShowDropdown(true);
        } else {
            setFilteredCharges([]);
            setShowDropdown(false);
        }
    }, [testSearch, allCharges]);

    const handleAddToCart = (charge) => {
        setShowDropdown(false);
        setTestSearch('');

        const existing = cart.find(c => c.chargeId === charge._id);
        if (existing) {
            toast.info(`${charge.name} is already in the cart`);
            return;
        }

        setCart([...cart, {
            chargeId: charge._id,
            name: charge.name,
            price: charge.standardFee || charge.basePrice || 0,
            specialization: charge.labSpecialization || ''
        }]);
    };

    const handleRemoveFromCart = (chargeId) => {
        setCart(cart.filter(c => c.chargeId !== chargeId));
    };

    const total = cart.reduce((sum, c) => sum + c.price, 0);

    const handleCompleteSale = async () => {
        if (!customerName.trim()) {
            toast.error('Customer name is required');
            return;
        }
        if (!age || isNaN(age)) {
            toast.error('Valid age is required');
            return;
        }
        if (!gender) {
            toast.error('Gender is required');
            return;
        }
        if (cart.length === 0) {
            toast.error('Cart is empty');
            return;
        }

        try {
            setLoading(true);
            const payload = {
                customerName: customerName.trim(),
                age,
                gender,
                items: cart.map(c => ({
                    chargeId: c.chargeId,
                    name: c.name,
                    price: c.price,
                    specialization: c.specialization
                })),
                discount: 0,
                tax: 0,
                paymentMethod
            };

            const { data } = await axios.post(`${backendUrl}/api/lab/pos-sale`, payload, {
                headers: { Authorization: `Bearer ${user.token}` }
            });

            const receipt = data.receipt || data;
            toast.success(`Sale completed! Receipt: ${receipt.receiptNumber}`);
            handlePrintReceipt(receipt);

            // Reset
            setCart([]);
            setCustomerName('');
            setAge('');
            setGender('Male');
            setPaymentMethod('cash');
            fetchReceipts();

        } catch (error) {
            toast.error(error.response?.data?.message || 'Sale failed');
        } finally {
            setLoading(false);
        }
    };

    const handlePrintReceipt = (receiptToPrint) => {
        const receipt = receiptToPrint;
        if (!receipt) return;

        const printWindow = window.open('', '', 'width=600,height=600');
        if (!printWindow) {
            toast.error('Browser blocked the popup. Please allow popups to print receipts.');
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
                        <h3 style="margin-top: 15px; border: 1px solid #000; display: inline-block; padding: 2px 10px;">LABORATORY RECEIPT</h3>
                    </div>
                    <div class="info-row"><span>Receipt #:</span> <strong>${receipt.receiptNumber}</strong></div>
                    <div class="info-row"><span>Date:</span> <span>${new Date(receipt.createdAt || new Date()).toLocaleString()}</span></div>
                    <div class="info-row"><span>Customer:</span> <strong>${receipt.patient?.name || 'Walk-in'}</strong></div>
                    <div class="info-row"><span>MRN:</span> <strong>${receipt.patient?.mrn || ''}</strong></div>
                    <div class="info-row"><span>Staff:</span> <strong>${receipt.cashier?.name || user.name}</strong></div>
                    <div class="info-row"><span>Method:</span> <span style="text-transform: uppercase;">${receipt.paymentMethod}</span></div>

                    <table class="items-table">
                        <thead>
                            <tr>
                                <th>Test Name</th>
                                <th style="text-align: right;">Amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${receipt.charges?.map(c => `
                                <tr>
                                    <td>${c.itemName || c.name || 'Test'}</td>
                                    <td style="text-align: right;">₦${(c.totalAmount || c.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            `).join('') || ''}
                        </tbody>
                    </table>

                    <div class="total-row">
                        <span>TOTAL PAID:</span>
                        <span>₦${(receipt.amountPaid || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div class="footer">
                        <p>Thank you for choosing our laboratory!</p>
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <Layout>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaFlask className="text-purple-600" /> Lab Point of Sale
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">
                        Direct sales for walk-in laboratory tests
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <div className="lg:col-span-3 space-y-4">
                    <div className="bg-white rounded-lg shadow p-5">
                        <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <FaSearch className="text-blue-500" /> Search Tests
                        </h3>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by test name..."
                                className="w-full border border-gray-300 rounded-lg p-3 pl-10 focus:ring-2 focus:ring-blue-400 text-sm"
                                value={testSearch}
                                onChange={e => setTestSearch(e.target.value)}
                            />
                            <FaSearch className="absolute left-3 top-3.5 text-gray-400" />

                            {showDropdown && filteredCharges.length > 0 && (
                                <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-64 overflow-y-auto">
                                    {filteredCharges.map(charge => (
                                        <div
                                            key={charge._id}
                                            className="flex justify-between items-center p-3 hover:bg-blue-50 cursor-pointer border-b"
                                            onClick={() => handleAddToCart(charge)}
                                        >
                                            <div>
                                                <p className="font-semibold text-sm">{charge.name}</p>
                                                <p className="text-xs text-gray-500">{charge.labSpecialization || 'General'}</p>
                                            </div>
                                            <p className="font-bold text-green-600 text-sm">₦{(charge.standardFee || charge.basePrice || 0).toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow p-5">
                        <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                            <FaShoppingCart className="text-indigo-500" /> Cart
                        </h3>
                        {cart.length === 0 ? (
                            <p className="text-center py-10 text-gray-400 text-sm">Cart is empty</p>
                        ) : (
                            <div className="space-y-3">
                                {cart.map(item => (
                                    <div key={item.chargeId} className="flex items-center justify-between border rounded-lg p-3 bg-gray-50">
                                        <div className="flex-1">
                                            <p className="font-semibold">{item.name}</p>
                                            <p className="text-xs text-gray-500">₦{item.price.toLocaleString()}</p>
                                        </div>
                                        <button onClick={() => handleRemoveFromCart(item.chargeId)} className="text-red-400 hover:text-red-600">
                                            <FaTrash />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow p-5 sticky top-4">
                        <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <FaReceipt className="text-green-600" /> Checkout
                        </h3>
                        <div className="mb-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Customer Name *</label>
                            <input
                                type="text"
                                placeholder="Patient's full name"
                                className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-400"
                                value={customerName}
                                onChange={e => setCustomerName(e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Age *</label>
                                <input
                                    type="number"
                                    placeholder="Age"
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-400"
                                    value={age}
                                    onChange={e => setAge(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Gender *</label>
                                <select
                                    className="w-full border rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-green-400"
                                    value={gender}
                                    onChange={e => setGender(e.target.value)}
                                >
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </div>
                        </div>

                        <div className="border-t pt-4 space-y-2 text-sm">
                            <div className="flex justify-between text-lg font-bold text-green-600 pt-2">
                                <span>Total</span>
                                <span>₦{total.toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-semibold mb-1">Payment Method</label>
                            <select className="w-full border rounded-lg p-2.5 text-sm" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                                <option value="cash">Cash</option>
                                <option value="card">Card</option>
                                <option value="transfer">Transfer</option>
                            </select>
                        </div>

                        <button
                            onClick={handleCompleteSale}
                            disabled={loading || cart.length === 0 || !customerName.trim() || !age || !gender}
                            className="w-full mt-6 bg-green-600 text-white py-3 rounded-lg font-bold hover:bg-green-700 disabled:bg-gray-300 transition flex items-center justify-center gap-2"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FaCheckCircle />}
                            Complete Sale
                        </button>
                    </div>
                </div>
            </div>

            {/* Transaction History Table */}
            <div className="mt-12 bg-white p-6 rounded-lg shadow-lg">
                <div className="flex justify-between items-center mb-6 border-b pb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-gray-800">
                        <FaReceipt className="text-purple-600" /> Laboratory Transaction History
                    </h3>
                    <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-lg">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">From:</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border rounded p-1.5 text-sm focus:ring-2 focus:ring-purple-400"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-gray-500 uppercase">To:</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border rounded p-1.5 text-sm focus:ring-2 focus:ring-purple-400"
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
                                <th className="p-3 border-b">Scientist/Tech</th>
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
                                        <tr key={receipt._id} className="hover:bg-purple-50 transition-colors border-b last:border-0 text-gray-700">
                                            <td className="p-3 font-mono font-bold text-purple-600">{receipt.receiptNumber}</td>
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
                                                    className="text-purple-500 hover:text-purple-700 p-2 hover:bg-purple-100 rounded-full transition-all"
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

export default LabPOS;
