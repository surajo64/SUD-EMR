import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { FaBell, FaFlask, FaChevronRight, FaUserClock } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';

const LabNotification = () => {
    const [pendingOrders, setPendingOrders] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const navigate = useNavigate();

    // Close dropdown if clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && !event.target.closest('.lab-notification')) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    const fetchPendingOrders = async () => {
        if (!user || !['lab_technician', 'lab_scientist'].includes(user.role)) return;
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            // Fetch all lab orders
            const { data } = await axios.get(`${backendUrl}/api/lab`, config);

            // Filter for pending or rejected (which means no result entered)
            let pending = data.filter(order => order.status === 'pending' || order.status === 'rejected');

            // Apply specialization filter
            if (user.labSpecialization && user.labSpecialization !== 'All Lab Test') {
                pending = pending.filter(order => 
                    order.labSpecialization === user.labSpecialization || 
                    !order.labSpecialization
                );
            }

            // Sort: chronological (oldest order first)
            pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            setPendingOrders(pending);
        } catch (error) {
            console.error("Error fetching pending lab orders for notification", error);
        }
    };

    useEffect(() => {
        fetchPendingOrders();

        // Poll every 30 seconds
        const interval = setInterval(fetchPendingOrders, 30000);
        return () => clearInterval(interval);
    }, [user, backendUrl]);

    if (!user || !['lab_technician', 'lab_scientist'].includes(user.role)) {
        return null;
    }

    return (
        <div className="relative lab-notification">
            <button 
                className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full focus:outline-none focus:ring transition-colors flex items-center"
                onClick={() => {
                    fetchPendingOrders();
                    setShowDropdown(!showDropdown);
                }}
                title="Pending Lab Orders Queue"
            >
                <FaBell size={20} className={pendingOrders.length > 0 ? "text-purple-600 animate-pulse" : ""} />
                {pendingOrders.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                        {pendingOrders.length}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100 max-h-96 overflow-y-auto">
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <span className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                            <FaFlask className="text-purple-500" /> Pending Lab Orders
                        </span>
                        <span className="text-xs bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-full">
                            {pendingOrders.length} Pending
                        </span>
                    </div>
                    {pendingOrders.length > 0 ? (
                        pendingOrders.map(order => {
                            const orderTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const orderDate = new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
                            return (
                                <div 
                                    key={order._id} 
                                    className="px-4 py-3 hover:bg-purple-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-b-0 transition-colors"
                                    onClick={() => {
                                        setShowDropdown(false);
                                        navigate(`/lab?orderId=${order._id}`);
                                    }}
                                >
                                    <div className="flex-1 pr-2">
                                        <p className="text-sm font-semibold text-gray-800">{order.patient?.name || 'N/A'}</p>
                                        <p className="text-xs text-purple-600 font-medium">{order.testName}</p>
                                        <p className="text-[10px] text-gray-500 font-mono mt-0.5">MRN: {order.patient?.mrn || 'N/A'}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        <div className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded flex flex-col items-end">
                                            <span>{orderTime}</span>
                                            <span className="text-[8px] opacity-75">{orderDate}</span>
                                        </div>
                                        <FaChevronRight size={10} className="text-gray-400" />
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-4 py-6 text-center text-gray-500 text-sm">
                            No pending lab orders in the queue today.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default LabNotification;
