import { useState, useEffect, useContext } from "react";
import axios from "axios";
import AuthContext from "../context/AuthContext";
import Layout from "../components/Layout";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import { FaPlus, FaEdit, FaTrash, FaTimes } from 'react-icons/fa';

const Inventory = () => {
    const { user } = useContext(AuthContext);

    // States
    const [items, setItems] = useState([]);
    const [alerts, setAlerts] = useState({ lowStock: [], expiringSoon: [], expired: [], summary: {} });
    const [search, setSearch] = useState("");
    const [expiryFilter, setExpiryFilter] = useState("All");
    const [pharmacies, setPharmacies] = useState([]);
    const [selectedPharmacy, setSelectedPharmacy] = useState("");
    const [mainPharmacy, setMainPharmacy] = useState(null);

    // Metadata State
    const [metadata, setMetadata] = useState({
        routes: [],
        forms: [],
        dosages: [],
        frequencies: []
    });

    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [currentItem, setCurrentItem] = useState({
        name: "",
        quantity: "",
        price: "",
        supplier: "",
        expiryDate: "",
        batchNumber: "",
        barcode: "",
        reorderLevel: "10",
        route: "",
        form: "",
        dosage: "",
        frequency: "",
        drugUnit: "unit",
        pharmacy: ""
    });

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Fetch inventory on load
    useEffect(() => {
        fetchPharmacies();
        fetchMetadata();
    }, [user]);

    useEffect(() => {
        if (selectedPharmacy) {
            fetchInventory();
            fetchAlerts();
        }
    }, [selectedPharmacy]);

    const fetchPharmacies = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get("http://localhost:5000/api/pharmacies", config);
            setPharmacies(data);

            // For pharmacists, default to their assigned pharmacy
            if (user.role === 'pharmacist' && user.assignedPharmacy) {
                setSelectedPharmacy(user.assignedPharmacy._id || user.assignedPharmacy);
            } else {
                // For admin and others, default to main pharmacy
                const main = data.find(p => p.isMainPharmacy);
                if (main) {
                    setMainPharmacy(main);
                    setSelectedPharmacy(main._id);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const fetchInventory = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const url = selectedPharmacy
                ? `http://localhost:5000/api/inventory?pharmacy=${selectedPharmacy}`
                : "http://localhost:5000/api/inventory";
            const { data } = await axios.get(url, config);
            setItems(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchAlerts = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            // For pharmacists, only get alerts for their pharmacy
            const pharmacyParam = user.role === 'pharmacist' && user.assignedPharmacy
                ? `?pharmacy=${user.assignedPharmacy._id || user.assignedPharmacy}`
                : selectedPharmacy ? `?pharmacy=${selectedPharmacy}` : '';

            const { data } = await axios.get(`http://localhost:5000/api/inventory/alerts${pharmacyParam}`, config);
            setAlerts(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchMetadata = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const [routes, forms, dosages, frequencies] = await Promise.all([
                axios.get("http://localhost:5000/api/drug-metadata?type=route", config),
                axios.get("http://localhost:5000/api/drug-metadata?type=form", config),
                axios.get("http://localhost:5000/api/drug-metadata?type=dosage", config),
                axios.get("http://localhost:5000/api/drug-metadata?type=frequency", config)
            ]);

            setMetadata({
                routes: routes.data,
                forms: forms.data,
                dosages: dosages.data,
                frequencies: frequencies.data
            });
        } catch (error) {
            console.error("Error fetching metadata:", error);
        }
    };

    const checkExpiry = (date) => {
        const today = new Date();
        const exp = new Date(date);
        const diffDays = (exp - today) / (1000 * 60 * 60 * 24);

        if (diffDays < 0) return "Expired";
        if (diffDays <= 30) return "Expiring Soon";
        return "Good";
    };

    const exportExcel = () => {
        const ws = XLSX.utils.json_to_sheet(items);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        saveAs(new Blob([buffer], { type: "application/octet-stream" }), "inventory.xlsx");
    };

    const handleOpenAddModal = () => {
        setIsEditMode(false);

        // Set default pharmacy based on user role
        let defaultPharmacy = "";
        if (user.role === 'pharmacist' && user.assignedPharmacy) {
            // Branch pharmacist: default to their assigned pharmacy
            defaultPharmacy = user.assignedPharmacy._id || user.assignedPharmacy;
        } else if (user.role === 'admin' || (user.role === 'pharmacist' && user.assignedPharmacy?.isMainPharmacy)) {
            // Admin or main pharmacist: default to Main Pharmacy
            defaultPharmacy = mainPharmacy?._id || selectedPharmacy || "";
        } else {
            defaultPharmacy = selectedPharmacy || "";
        }

        setCurrentItem({
            name: "",
            quantity: "",
            price: "",
            purchasingPrice: "",
            supplier: "",
            expiryDate: "",
            batchNumber: "",
            barcode: "",
            reorderLevel: "10",
            route: "",
            form: "",
            dosage: "",
            frequency: "",
            drugUnit: "unit",
            pharmacy: defaultPharmacy
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (item) => {
        setIsEditMode(true);
        setCurrentItem({
            ...item,
            expiryDate: item.expiryDate ? item.expiryDate.substring(0, 10) : "",
            pharmacy: item.pharmacy?._id || item.pharmacy || selectedPharmacy
        });
        setShowModal(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            if (isEditMode) {
                await axios.put(`http://localhost:5000/api/inventory/${currentItem._id}`, currentItem, config);
            } else {
                await axios.post("http://localhost:5000/api/inventory", currentItem, config);
            }
            setShowModal(false);
            fetchInventory();
            fetchAlerts();
        } catch (error) {
            alert("Error saving item");
            console.error(error);
        }
    };

    const deleteItem = async (id) => {
        if (!window.confirm("Delete this item?")) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/inventory/${id}`, config);
            fetchInventory();
        } catch {
            alert("Error deleting item");
        }
    };

    // Filtered & searched items
    const filteredItems = items
        .filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
        .filter((item) => expiryFilter === "All" || checkExpiry(item.expiryDate) === expiryFilter);

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredItems.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredItems.length / itemsPerPage);

    // Handler for pharmacy selection with restriction
    const handlePharmacyChange = (e) => {
        const newPharmacyId = e.target.value;

        // Restrict pharmacists to their assigned pharmacy only
        if (user.role === 'pharmacist' && user.assignedPharmacy) {
            const assignedId = user.assignedPharmacy._id || user.assignedPharmacy;
            if (newPharmacyId !== assignedId) {
                alert('⚠️ Access Denied: You do not have authorization to view this pharmacy inventory. You can only view your assigned pharmacy.');
                return;
            }
        }

        setSelectedPharmacy(newPharmacyId);
    };

    return (
        <Layout>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-2xl font-bold">Pharmacy Inventory</h2>
                    <div className="mt-2">
                        <label className="text-sm text-gray-600 mr-2">Pharmacy:</label>
                        <select
                            value={selectedPharmacy}
                            onChange={handlePharmacyChange}
                            className="border p-2 rounded text-sm"
                            disabled={user.role === 'pharmacist'}
                        >
                            <option value="">-- All Pharmacies --</option>
                            {pharmacies.map(p => (
                                <option key={p._id} value={p._id}>
                                    {p.name} {p.isMainPharmacy && '⭐'}
                                </option>
                            ))}
                        </select>
                        {user.role === 'pharmacist' && (
                            <span className="ml-2 text-xs text-gray-500">(Locked to your pharmacy)</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={handleOpenAddModal}
                    className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-green-700"
                >
                    <FaPlus /> Add Drug
                </button>
            </div>

            {/* Alerts Dashboard */}
            {(alerts.summary.lowStockCount > 0 || alerts.summary.expiringSoonCount > 0 || alerts.summary.expiredCount > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {alerts.summary.lowStockCount > 0 && (
                        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded shadow">
                            <p className="text-red-800 font-bold text-lg">{alerts.summary.lowStockCount} Low Stock Items</p>
                            <p className="text-sm text-red-600 mt-2">Items below reorder level:</p>
                            <ul className="text-sm text-red-700 mt-1 max-h-32 overflow-y-auto">
                                {alerts.lowStock.slice(0, 5).map(item => (
                                    <li key={item._id}>• {item.name} ({item.quantity} left, reorder at {item.reorderLevel})</li>
                                ))}
                                {alerts.lowStock.length > 5 && <li className="font-semibold">...and {alerts.lowStock.length - 5} more</li>}
                            </ul>
                        </div>
                    )}
                    {alerts.summary.expiringSoonCount > 0 && (
                        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded shadow">
                            <p className="text-yellow-800 font-bold text-lg">{alerts.summary.expiringSoonCount} Expiring Soon</p>
                            <p className="text-sm text-yellow-600 mt-2">Expires within 30 days:</p>
                            <ul className="text-sm text-yellow-700 mt-1 max-h-32 overflow-y-auto">
                                {alerts.expiringSoon.slice(0, 5).map(item => (
                                    <li key={item._id}>• {item.name} (Exp: {new Date(item.expiryDate).toLocaleDateString()})</li>
                                ))}
                                {alerts.expiringSoon.length > 5 && <li className="font-semibold">...and {alerts.expiringSoon.length - 5} more</li>}
                            </ul>
                        </div>
                    )}
                    {alerts.summary.expiredCount > 0 && (
                        <div className="bg-gray-50 border-l-4 border-gray-500 p-4 rounded shadow">
                            <p className="text-gray-800 font-bold text-lg">{alerts.summary.expiredCount} Expired Items</p>
                            <p className="text-sm text-gray-600 mt-2">Remove from inventory:</p>
                            <ul className="text-sm text-gray-700 mt-1 max-h-32 overflow-y-auto">
                                {alerts.expired.slice(0, 5).map(item => (
                                    <li key={item._id}>• {item.name} (Expired: {new Date(item.expiryDate).toLocaleDateString()})</li>
                                ))}
                                {alerts.expired.length > 5 && <li className="font-semibold">...and {alerts.expired.length - 5} more</li>}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Search, Filter, Download */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search drug..."
                    className="border p-2 rounded w-full"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    value={expiryFilter}
                    onChange={(e) => setExpiryFilter(e.target.value)}
                    className="border p-2 rounded w-full md:w-40"
                >
                    <option value="All">All</option>
                    <option value="Good">Good</option>
                    <option value="Expiring Soon">Expiring Soon</option>
                    <option value="Expired">Expired</option>
                </select>
                <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded">
                    Download
                </button>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">Name</th>
                            <th className="p-4 border-b">Qty</th>
                            <th className="p-4 border-b">Unit</th>
                            <th className="p-4 border-b">Price</th>
                            <th className="p-4 border-b">Expiry</th>
                            <th className="p-4 border-b">Status</th>
                            <th className="p-4 border-b">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.map((item) => (
                            <tr key={item._id} className={`hover:bg-gray-50 ${item.quantity < item.reorderLevel ? 'bg-red-50' : ''}`}>
                                <td className="p-4 border-b">
                                    <div className="font-semibold">{item.name}</div>
                                    <div className="text-xs text-gray-500">
                                        {item.form} - {item.dosage} ({item.route})
                                    </div>
                                </td>
                                <td className={`p-4 border-b ${item.quantity < item.reorderLevel ? "text-red-600 font-bold" : ""}`}>
                                    {item.quantity}
                                    {item.quantity < item.reorderLevel && <span className="ml-2 text-xs bg-red-600 text-white px-2 py-1 rounded">LOW</span>}
                                </td>
                                <td className="p-4 border-b capitalize">{item.drugUnit}</td>
                                <td className="p-4 border-b">₦{item.price}</td>
                                <td className="p-4 border-b">{new Date(item.expiryDate).toLocaleDateString()}</td>
                                <td className="p-4 border-b font-semibold">
                                    {checkExpiry(item.expiryDate) === "Expired" && <span className="text-red-600">Expired</span>}
                                    {checkExpiry(item.expiryDate) === "Expiring Soon" && <span className="text-orange-500">Expiring Soon</span>}
                                    {checkExpiry(item.expiryDate) === "Good" && <span className="text-green-600">Good</span>}
                                </td>
                                <td className="p-4 border-b space-x-2">
                                    <button onClick={() => handleOpenEditModal(item)} className="text-blue-600 hover:text-blue-800">
                                        <FaEdit />
                                    </button>
                                    <button onClick={() => deleteItem(item._id)} className="text-red-600 hover:text-red-800">
                                        <FaTrash />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 p-4">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                                key={page}
                                className={`px-3 py-1 rounded ${currentPage === page ? "bg-blue-600 text-white" : "bg-gray-200"}`}
                                onClick={() => setCurrentPage(page)}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                )}

                {currentItems.length === 0 && <p className="p-4 text-center text-gray-500">No matching items.</p>}
            </div>

            {/* Add/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
                    <div className="bg-white rounded-lg p-6 w-full max-w-2xl my-8">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold">{isEditMode ? 'Edit Drug' : 'Add New Drug'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-gray-500 hover:text-gray-700">
                                <FaTimes size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Drug Name</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    value={currentItem.name}
                                    onChange={(e) => setCurrentItem({ ...currentItem, name: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="md:col-span-3">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Pharmacy Location</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={currentItem.pharmacy}
                                    onChange={(e) => setCurrentItem({ ...currentItem, pharmacy: e.target.value })}
                                    disabled={user.role === 'pharmacist'}
                                    required
                                >
                                    <option value="">-- Select Pharmacy --</option>
                                    {pharmacies.map(p => (
                                        <option key={p._id} value={p._id}>
                                            {p.name} {p.isMainPharmacy && '(Main)'}
                                        </option>
                                    ))}
                                </select>
                                {user.role === 'pharmacist' && (
                                    <p className="text-xs text-gray-500 mt-1">Locked to your assigned pharmacy</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                <input
                                    type="number"
                                    className="w-full border p-2 rounded"
                                    value={currentItem.quantity}
                                    onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price (₦)</label>
                                <input
                                    type="number"
                                    className="w-full border p-2 rounded"
                                    value={currentItem.price}
                                    onChange={(e) => setCurrentItem({ ...currentItem, price: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Purchasing Price (₦)</label>
                                <input
                                    type="number"
                                    className="w-full border p-2 rounded"
                                    value={currentItem.purchasingPrice}
                                    onChange={(e) => setCurrentItem({ ...currentItem, purchasingPrice: e.target.value })}
                                    placeholder="Cost price for refunds"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Drug Unit</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={currentItem.drugUnit}
                                    onChange={(e) => setCurrentItem({ ...currentItem, drugUnit: e.target.value })}
                                >
                                    <option value="unit">Unit</option>
                                    <option value="sachet">Sachet</option>
                                    <option value="packet">Packet</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                                <input
                                    type="date"
                                    className="w-full border p-2 rounded"
                                    value={currentItem.expiryDate}
                                    onChange={(e) => setCurrentItem({ ...currentItem, expiryDate: e.target.value })}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Route</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={currentItem.route}
                                    onChange={(e) => setCurrentItem({ ...currentItem, route: e.target.value })}
                                >
                                    <option value="">-- Select Route --</option>
                                    {metadata.routes.map(item => (
                                        <option key={item._id} value={item.value}>{item.value}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Form</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={currentItem.form}
                                    onChange={(e) => setCurrentItem({ ...currentItem, form: e.target.value })}
                                >
                                    <option value="">-- Select Form --</option>
                                    {metadata.forms.map(item => (
                                        <option key={item._id} value={item.value}>{item.value}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={currentItem.dosage}
                                    onChange={(e) => setCurrentItem({ ...currentItem, dosage: e.target.value })}
                                >
                                    <option value="">-- Select Dosage --</option>
                                    {metadata.dosages.map(item => (
                                        <option key={item._id} value={item.value}>{item.value}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                                <select
                                    className="w-full border p-2 rounded"
                                    value={currentItem.frequency}
                                    onChange={(e) => setCurrentItem({ ...currentItem, frequency: e.target.value })}
                                >
                                    <option value="">-- Select Frequency --</option>
                                    {metadata.frequencies.map(item => (
                                        <option key={item._id} value={item.value}>{item.value}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    value={currentItem.supplier}
                                    onChange={(e) => setCurrentItem({ ...currentItem, supplier: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    value={currentItem.batchNumber}
                                    onChange={(e) => setCurrentItem({ ...currentItem, batchNumber: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
                                <input
                                    className="w-full border p-2 rounded"
                                    value={currentItem.barcode}
                                    onChange={(e) => setCurrentItem({ ...currentItem, barcode: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Level</label>
                                <input
                                    type="number"
                                    className="w-full border p-2 rounded"
                                    value={currentItem.reorderLevel}
                                    onChange={(e) => setCurrentItem({ ...currentItem, reorderLevel: e.target.value })}
                                />
                            </div>

                            <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400 text-gray-800"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-bold"
                                >
                                    {isEditMode ? 'Update Drug' : 'Add Drug'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Inventory;
