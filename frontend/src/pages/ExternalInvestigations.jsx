import { useState, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaSearch, FaFlask, FaPlus } from 'react-icons/fa';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

const ExternalInvestigations = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [encounters, setEncounters] = useState([]);
    const [loading, setLoading] = useState(false);
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const searchEncounters = async () => {
        if (!searchTerm.trim()) {
            toast.error('Please enter a patient name or MRN');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };

            // Search for the specific patient
            const { data: patients } = await axios.get(
                `http://localhost:5000/api/patients?search=${searchTerm}`,
                config
            );

            if (patients.length === 0) {
                toast.info('No patients found');
                setEncounters([]);
                return;
            }

            // If multiple patients found, use the first match
            const patient = patients[0];

            if (patients.length > 1) {
                toast.info(`Found ${patients.length} patients. Showing results for: ${patient.name}`);
            }

            // Get External Investigation encounters for this specific patient only
            const { data: visits } = await axios.get(
                `http://localhost:5000/api/visits/patient/${patient._id}`,
                config
            );

            // Filter for External Investigation type and sort by date (latest first)
            const externalInvestigations = visits
                .filter(v => v.type === 'External Investigation')
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .map(enc => ({
                    ...enc,
                    patientInfo: patient
                }));

            setEncounters(externalInvestigations);

            if (externalInvestigations.length === 0) {
                toast.info(`No External Investigation encounters found for ${patient.name}`);
            } else {
                toast.success(`Found ${externalInvestigations.length} External Investigation encounter(s) for ${patient.name}`);
            }
        } catch (error) {
            console.error(error);
            toast.error('Error searching encounters');
        } finally {
            setLoading(false);
        }
    };

    const handleViewEncounter = (encounter) => {
        navigate(`/patient/${encounter.patientInfo._id}`, {
            state: { selectedEncounterId: encounter._id }
        });
    };

    return (
        <Layout>
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                    <FaFlask className="text-purple-600" /> External Investigations
                </h2>
                <p className="text-gray-600 text-sm mt-1">
                    Search for patients with External Investigation encounters to order lab tests
                </p>
            </div>

            {/* Search Section */}
            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <FaSearch /> Search Patient
                </h3>
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder="Enter Patient Name or MRN..."
                        className="flex-1 border p-3 rounded"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchEncounters()}
                    />
                    <button
                        onClick={searchEncounters}
                        disabled={loading}
                        className="bg-blue-600 text-white px-8 py-3 rounded hover:bg-blue-700 disabled:bg-gray-400 font-semibold"
                    >
                        {loading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </div>

            {/* Results Section */}
            {encounters.length > 0 && (
                <div className="bg-white p-6 rounded shadow">
                    <h3 className="text-xl font-bold mb-4">
                        External Investigation Encounters ({encounters.length})
                    </h3>
                    <div className="space-y-3">
                        {encounters.map(encounter => (
                            <div
                                key={encounter._id}
                                className="border border-purple-200 p-4 rounded hover:bg-purple-50 transition"
                            >
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h4 className="font-bold text-lg text-gray-800">
                                                {encounter.patientInfo.name}
                                            </h4>
                                            <span className="text-sm text-gray-600">
                                                MRN: {encounter.patientInfo.mrn}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
                                            <div>
                                                <p><strong>Encounter Type:</strong> {encounter.type}</p>
                                                <p><strong>Date:</strong> {new Date(encounter.createdAt).toLocaleDateString()}</p>
                                            </div>
                                            <div>
                                                <p><strong>Status:</strong>
                                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${encounter.encounterStatus === 'completed' ? 'bg-green-100 text-green-800' :
                                                        encounter.encounterStatus === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                                            'bg-yellow-100 text-yellow-800'
                                                        }`}>
                                                        {encounter.encounterStatus?.replace('_', ' ').toUpperCase()}
                                                    </span>
                                                </p>
                                                <p><strong>Payment:</strong>
                                                    <span className={`ml-2 px-2 py-1 rounded text-xs ${encounter.paymentValidated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                        }`}>
                                                        {encounter.paymentValidated ? 'Validated' : 'Pending'}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        {encounter.chiefComplaint && (
                                            <p className="text-sm text-gray-600 mt-2">
                                                <strong>Chief Complaint:</strong> {encounter.chiefComplaint}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleViewEncounter(encounter)}
                                        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 flex items-center gap-2 ml-4"
                                    >
                                        <FaPlus /> Order Lab Tests
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Empty State */}
            {!loading && encounters.length === 0 && searchTerm && (
                <div className="bg-white p-12 rounded shadow text-center">
                    <FaSearch className="text-gray-400 text-5xl mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No External Investigation encounters found</p>
                    <p className="text-gray-500 text-sm mt-2">
                        Try searching with a different patient name or MRN
                    </p>
                </div>
            )}
        </Layout>
    );
};

export default ExternalInvestigations;
