import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { FaBell, FaUserClock, FaChevronRight } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { AppContext } from '../context/AppContext';

const DoctorNotification = () => {
    const [unseenVisits, setUnseenVisits] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const { user } = useContext(AuthContext);
    const { backendUrl } = useContext(AppContext);
    const navigate = useNavigate();

    // Close dropdown if clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (showDropdown && !event.target.closest('.doctor-notification')) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showDropdown]);

    const fetchUnseenPatients = async () => {
        if (!user || user.role !== 'doctor') return;
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            // Fetch today's visits (already filtered by backend doctor restrictions)
            const { data } = await axios.get(`${backendUrl}/api/visits?today=true`, config);

            // Filter for unseen visits only
            const unseen = data.filter(visit => !visit.seen);

            // Sort: first come (oldest check-in) at the top
            unseen.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

            setUnseenVisits(unseen);
        } catch (error) {
            console.error("Error fetching unseen patients for notification", error);
        }
    };

    useEffect(() => {
        fetchUnseenPatients();

        // Poll every 30 seconds to keep the bell badge up to date
        const interval = setInterval(fetchUnseenPatients, 30000);
        return () => clearInterval(interval);
    }, [user, backendUrl]);

    if (!user || user.role !== 'doctor') {
        return null;
    }

    return (
        <div className="relative doctor-notification">
            <button 
                className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full focus:outline-none focus:ring transition-colors flex items-center"
                onClick={() => {
                    fetchUnseenPatients();
                    setShowDropdown(!showDropdown);
                }}
                title="Unseen Patients Queue"
            >
                <FaBell size={20} className={unseenVisits.length > 0 ? "text-indigo-600 animate-pulse" : ""} />
                {unseenVisits.length > 0 && (
                    <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full border-2 border-white pointer-events-none transform translate-x-1/4 -translate-y-1/4">
                        {unseenVisits.length}
                    </span>
                )}
            </button>

            {showDropdown && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg py-1 z-50 border border-gray-100 max-h-96 overflow-y-auto">
                    <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                        <span className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                            <FaUserClock className="text-indigo-500" /> Unseen Patients Queue
                        </span>
                        <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                            {unseenVisits.length} Pending
                        </span>
                    </div>
                    {unseenVisits.length > 0 ? (
                        unseenVisits.map(visit => {
                            const checkInTime = new Date(visit.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                                <div 
                                    key={visit._id} 
                                    className="px-4 py-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center border-b border-gray-50 last:border-b-0 transition-colors"
                                    onClick={() => {
                                        setShowDropdown(false);
                                        navigate(`/patient/${visit.patient._id || visit.patient}`);
                                    }}
                                >
                                    <div>
                                        <p className="text-sm font-semibold text-gray-800">{visit.patient?.name || 'N/A'}</p>
                                        <p className="text-xs text-gray-500 font-mono">MRN: {visit.patient?.mrn || 'N/A'}</p>
                                    </div>
                                    <div className="text-right flex items-center gap-2">
                                        <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                            {checkInTime}
                                        </span>
                                        <FaChevronRight size={10} className="text-gray-400" />
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="px-4 py-6 text-center text-gray-500 text-sm">
                            No unseen patients in the queue today.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default DoctorNotification;
