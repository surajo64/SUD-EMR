import { useState, useEffect, useContext } from "react";
import axios from "axios";
import AuthContext from "../context/AuthContext";
import Layout from "../components/Layout";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const Inventory = () => {
    const { user } = useContext(AuthContext);

    // States
    const [items, setItems] = useState([]);
    const [alerts, setAlerts] = useState({ lowStock: [], expiringSoon: [], expired: [], summary: {} });
    const [search, setSearch] = useState("");
    const [expiryFilter, setExpiryFilter] = useState("All");
    const [newItem, setNewItem] = useState({ name: "", quantity: "", price: "", supplier: "", expiryDate: "", batchNumber: "", barcode: "", reorderLevel: "10" });
    const [editItem, setEditItem] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Fetch inventory on load
    useEffect(() => {
        fetchInventory();
        fetchAlerts();
    }, [user]);

    const fetchInventory = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get("http://localhost:5000/api/inventory", config);
            setItems(data);
        } catch (error) {
            console.error(error);
        }
    };

    const fetchAlerts = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get("http://localhost:5000/api/inventory/alerts", config);
            setAlerts(data);
        } catch (error) {
            console.error(error);
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

    const dispenseDrug = async (id) => {
        const amount = Number(prompt("Enter quantity to dispense:"));
        if (!amount || amount <= 0) return;

        try {
            await axios.post("http://localhost:5000/api/drugs/dispense", { drugId: id, amount });
            alert("Dispensed successfully!");
            fetchInventory();
        } catch {
            alert("Not enough stock");
        }
    };

    const handleAddItem = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post("http://localhost:5000/api/inventory", newItem, config);
            setNewItem({ name: "", quantity: "", price: "", supplier: "", expiryDate: "", batchNumber: "", barcode: "", reorderLevel: "10" });
            fetchInventory();
            fetchAlerts();
        } catch {
            alert("Error adding item");
        }
    };

    const handleUpdateItem = async (e) => {
        e.preventDefault();
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/inventory/${editItem._id}`, editItem, config);
            setEditItem(null);
            fetchInventory();
            fetchAlerts();
        } catch {
            alert("Error updating item");
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

    return (
        <Layout>
            <h2 className="text-2xl font-bold mb-6">Pharmacy Inventory</h2>

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
                    Download Excel
                </button>
            </div>

            {/* Add New Item */}
            <div className="bg-white p-6 rounded shadow mb-8">
                <h3 className="font-semibold mb-4">Add New Item</h3>
                <form onSubmit={handleAddItem} className="grid grid-cols-1 md:grid-cols-8 gap-4">
                    <input placeholder="Name" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} className="border p-2 rounded" required />
                    <input type="number" placeholder="Quantity" value={newItem.quantity} onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })} className="border p-2 rounded" required />
                    <input type="number" placeholder="Price" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} className="border p-2 rounded" required />
                    <input placeholder="Supplier" value={newItem.supplier} onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })} className="border p-2 rounded" />
                    <input type="date" value={newItem.expiryDate} onChange={(e) => setNewItem({ ...newItem, expiryDate: e.target.value })} className="border p-2 rounded" required />
                    <input placeholder="Batch Number" value={newItem.batchNumber} onChange={(e) => setNewItem({ ...newItem, batchNumber: e.target.value })} className="border p-2 rounded" />
                    <input placeholder="Barcode" value={newItem.barcode} onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })} className="border p-2 rounded" />
                    <input type="number" placeholder="Reorder Level" value={newItem.reorderLevel} onChange={(e) => setNewItem({ ...newItem, reorderLevel: e.target.value })} className="border p-2 rounded" />
                    <button className="bg-green-600 text-white px-4 py-2 rounded md:col-span-8 font-bold">Add Item</button>
                </form>
            </div>

            {/* Inventory Table */}
            <div className="bg-white rounded shadow overflow-hidden">
                <table className="w-full border-collapse">
                    <thead className="bg-gray-100">
                        <tr>
                            <th className="p-4 border-b">Name</th>
                            <th className="p-4 border-b">Qty</th>
                            <th className="p-4 border-b">Reorder</th>
                            <th className="p-4 border-b">Price</th>
                            <th className="p-4 border-b">Supplier</th>
                            <th className="p-4 border-b">Expiry</th>
                            <th className="p-4 border-b">Status</th>
                            <th className="p-4 border-b">Batch</th>
                            <th className="p-4 border-b">Barcode</th>
                            <th className="p-4 border-b">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {currentItems.map((item) => (
                            <tr key={item._id} className={`hover:bg-gray-50 ${item.quantity < item.reorderLevel ? 'bg-red-50' : ''}`}>
                                <td className="p-4 border-b">{item.name}</td>
                                <td className={`p-4 border-b ${item.quantity < item.reorderLevel ? "text-red-600 font-bold" : ""}`}>
                                    {item.quantity}
                                    {item.quantity < item.reorderLevel && <span className="ml-2 text-xs bg-red-600 text-white px-2 py-1 rounded">LOW</span>}
                                </td>
                                <td className="p-4 border-b text-gray-600">{item.reorderLevel || 10}</td>
                                <td className="p-4 border-b">₦{item.price}</td>
                                <td className="p-4 border-b">{item.supplier}</td>
                                <td className="p-4 border-b">{new Date(item.expiryDate).toLocaleDateString()}</td>
                                <td className="p-4 border-b font-semibold">
                                    {checkExpiry(item.expiryDate) === "Expired" && <span className="text-red-600">Expired</span>}
                                    {checkExpiry(item.expiryDate) === "Expiring Soon" && <span className="text-orange-500">Expiring Soon</span>}
                                    {checkExpiry(item.expiryDate) === "Good" && <span className="text-green-600">Good</span>}
                                </td>
                                <td className="p-4 border-b">{item.batchNumber || "-"}</td>
                                <td className="p-4 border-b">{item.barcode || "-"}</td>
                                <td className="p-4 border-b space-x-2">
                                    <button onClick={() => setEditItem(item)} className="px-3 py-1 bg-blue-600 text-white rounded">Edit</button>
                                    <button onClick={() => deleteItem(item._id)} className="px-3 py-1 bg-red-600 text-white rounded">Delete</button>

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

            {/* Edit Modal */}
            {editItem && (
                <div className="fixed inset-0 bg-black/40 flex justify-center items-center p-4">
                    <div className="bg-white p-6 rounded shadow max-w-md w-full">
                        <h3 className="font-bold mb-4">Edit Item</h3>
                        <form onSubmit={handleUpdateItem} className="space-y-4">
                            <input className="border p-2 rounded w-full" value={editItem.name} onChange={(e) => setEditItem({ ...editItem, name: e.target.value })} />
                            <input type="number" className="border p-2 rounded w-full" value={editItem.quantity} onChange={(e) => setEditItem({ ...editItem, quantity: e.target.value })} />
                            <input type="number" className="border p-2 rounded w-full" placeholder="Reorder Level" value={editItem.reorderLevel || 10} onChange={(e) => setEditItem({ ...editItem, reorderLevel: e.target.value })} />
                            <input type="number" className="border p-2 rounded w-full" value={editItem.price} onChange={(e) => setEditItem({ ...editItem, price: e.target.value })} />
                            <input className="border p-2 rounded w-full" value={editItem.supplier} onChange={(e) => setEditItem({ ...editItem, supplier: e.target.value })} />
                            <input type="date" className="border p-2 rounded w-full" value={editItem.expiryDate?.substring(0, 10)} onChange={(e) => setEditItem({ ...editItem, expiryDate: e.target.value })} />
                            <input className="border p-2 rounded w-full" placeholder="Batch Number" value={editItem.batchNumber} onChange={(e) => setEditItem({ ...editItem, batchNumber: e.target.value })} />
                            <input className="border p-2 rounded w-full" placeholder="Barcode" value={editItem.barcode} onChange={(e) => setEditItem({ ...editItem, barcode: e.target.value })} />

                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 bg-gray-600 text-white rounded">Cancel</button>
                                <button className="px-4 py-2 bg-blue-600 text-white rounded">Update</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default Inventory;
