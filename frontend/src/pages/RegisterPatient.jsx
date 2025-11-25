import { useState, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import LoadingOverlay from '../components/loadingOverlay';

const RegisterPatient = () => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        age: '',
        gender: 'male',
        contact: '',
        address: '',
        medicalHistory: ''
    });
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.post('http://localhost:5000/api/patients', {
                ...formData,
                medicalHistory: formData.medicalHistory.split(',')
            }, config);
            alert('Patient Registered Successfully');
            navigate('/patients');
        } catch (error) {
            console.error(error);
            alert('Error registering patient');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="max-w-2xl mx-auto bg-white p-8 rounded shadow">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Register New Patient</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-gray-700">Name</label>
                        <input type="text" name="name" onChange={handleChange} className="w-full border p-2 rounded" required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700">Age</label>
                            <input type="number" name="age" onChange={handleChange} className="w-full border p-2 rounded" required />
                        </div>
                        <div>
                            <label className="block text-gray-700">Gender</label>
                            <select name="gender" onChange={handleChange} className="w-full border p-2 rounded">
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-gray-700">Contact</label>
                        <input type="text" name="contact" onChange={handleChange} className="w-full border p-2 rounded" required />
                    </div>
                    <div>
                        <label className="block text-gray-700">Address</label>
                        <textarea name="address" onChange={handleChange} className="w-full border p-2 rounded"></textarea>
                    </div>
                    <div>
                        <label className="block text-gray-700">Medical History (comma separated)</label>
                        <input type="text" name="medicalHistory" onChange={handleChange} className="w-full border p-2 rounded" />
                    </div>
                    <button type="submit" className="w-full bg-green-600 text-white p-2 rounded hover:bg-green-700 font-bold">Register</button>
                </form>
            </div>
        </Layout>
    );
};

export default RegisterPatient;
