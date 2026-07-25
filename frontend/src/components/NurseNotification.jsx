import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { FaBell, FaClipboardList, FaChevronRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';

const NurseNotification = () => {
    const [pendingOrderTasks, setPendingOrderTasks] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const navigate = useNavigate();

    // Close dropdown if clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && !event.target.closest('.nurse-notification')) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    const fetchPendingOrderTasks = async () => {
        if (!user || user.role !== 'nurse') return;
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get(`${backendUrl}/api/visits`, config);

            const pending = [];
            if (Array.isArray(data)) {
                data.forEach(visit => {
                    if (visit.orderTasks && visit.orderTasks.length > 0) {
                        visit.orderTasks.forEach(task => {
                            if (task.status !== 'Completed') {
                                pending.push({
                                    ...task,
                                    visitId: visit._id,
                                    patientId: visit.patient?._id || visit.patient,
                                    patientName: visit.patient?.name || 'Unknown Patient',
                                    mrn: visit.patient?.mrn || ''
                                });
                            }
                        });
                    }
                });
            }

            // Sort: newest first
            pending.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setPendingOrderTasks(pending);
        } catch (error) {
            console.error("Error fetching pending order tasks for nurse notification", error);
        }
    };

    useEffect(() => {
        fetchPendingOrderTasks();

        // Poll every 15 seconds so count stays accurate in real-time
        const interval = setInterval(fetchPendingOrderTasks, 15000);
        return () => clearInterval(interval);
    }, [user, backendUrl]);

    if (!user || user.role !== 'nurse') {
        return null;
    }

    return (
        <div className="relative nurse-notification">
            <button 
                className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full focus:outline-none focus:ring transition-colors flex items-center"
                onClick={() => {
                    fetchPendingOrderTasks();
                    setShowDropdown(!showDropdown);
                }}
                title="Doctor Order Tasks Pending"
            >
                <FaBell size={20} className={pendingOrderTasks.length > 0 ? "text-blue-600 animate-pulse" : ""} />
                {pendingOrderTasks.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                        {pendingOrderTasks.length}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl py-1 z-50 border border-gray-200 max-h-96 overflow-y-auto">
                    <div className="px-4 py-2.5 border-b border-gray-100 bg-indigo-50 flex justify-between items-center">
                        <span className="font-semibold text-indigo-900 text-xs flex items-center gap-2">
                            <FaClipboardList className="text-indigo-600" /> Doctor Order Tasks
                        </span>
                        <span className="text-[11px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full">
                            {pendingOrderTasks.length} Pending
                        </span>
                    </div>
                    {pendingOrderTasks.length > 0 ? (
                        pendingOrderTasks.map((task, idx) => (
                            <div 
                                key={task._id || idx} 
                                className="px-4 py-3 hover:bg-blue-50/60 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors"
                                onClick={() => {
                                    setShowDropdown(false);
                                    navigate(`/patient/${task.patientId}`);
                                }}
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <p className="text-xs font-bold text-gray-900">{task.patientName}</p>
                                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                        {task.orderType === 'Others' ? (task.customOrderTask || 'Custom') : task.orderType}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-700 font-medium line-clamp-2 bg-gray-50 p-1.5 rounded border border-gray-100 my-1">
                                    {task.instructions}
                                </p>
                                <div className="flex justify-between items-center text-[10px] text-gray-500 mt-1">
                                    <span>Dr. {task.doctorName || 'Doctor'}</span>
                                    <span className="text-blue-600 font-medium flex items-center gap-1">
                                        View Patient <FaChevronRight size={8} />
                                    </span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="px-4 py-6 text-center text-xs text-gray-500 italic">
                            No pending order tasks from doctor.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NurseNotification;
