import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaFlask, FaPlus, FaEdit, FaSave, FaTimes, FaFileAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';

const LabTestManagement = () => {
    const { user } = useContext(AuthContext);
    const [labTests, setLabTests] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingTest, setEditingTest] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        basePrice: '',
        standardFee: '',
        retainershipFee: '',
        nhiaFee: '',
        kschmaFee: '',
        description: '',
        code: '',
        resultTemplate: ''
    });

    useEffect(() => {
        fetchLabTests();
    }, []);

    const fetchLabTests = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/charges?type=lab', config);
            setLabTests(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching lab tests');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name || !formData.standardFee) {
            toast.error('Please fill in test name and price');
            return;
        }

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = {
                name: formData.name,
                type: 'lab',
                basePrice: parseFloat(formData.standardFee) || 0, // Set basePrice to standardFee for schema compatibility
                standardFee: parseFloat(formData.standardFee) || 0,
                retainershipFee: parseFloat(formData.retainershipFee) || 0,
                nhiaFee: parseFloat(formData.nhiaFee) || 0,
                kschmaFee: parseFloat(formData.kschmaFee) || 0,
                department: 'Laboratory',
                description: formData.description,
                code: formData.code,
                resultTemplate: formData.resultTemplate
            };

            if (editingTest) {
                await axios.put(
                    `http://localhost:5000/api/charges/${editingTest._id}`,
                    payload,
                    config
                );
                toast.success('Lab test updated successfully!');
            } else {
                await axios.post('http://localhost:5000/api/charges', payload, config);
                toast.success('Lab test created successfully!');
            }

            resetForm();
            fetchLabTests();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving lab test');
        }
    };

    const handleEdit = (test) => {
        setEditingTest(test);
        setFormData({
            name: test.name,
            basePrice: test.basePrice.toString(),
            standardFee: (test.standardFee || 0).toString(),
            retainershipFee: (test.retainershipFee || 0).toString(),
            nhiaFee: (test.nhiaFee || 0).toString(),
            kschmaFee: (test.kschmaFee || 0).toString(),
            description: test.description || '',
            code: test.code || '',
            resultTemplate: test.resultTemplate || ''
        });
        setShowForm(true);
    };

    const handleDeactivate = async (testId) => {
        if (!window.confirm('Are you sure you want to deactivate this test?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/charges/${testId}`, config);
            toast.success('Lab test deactivated');
            fetchLabTests();
        } catch (error) {
            console.error(error);
            toast.error('Error deactivating test');
        }
    };

    const handleActivate = async (testId) => {
        if (!window.confirm('Are you sure you want to activate this test?')) return;

        try {
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/charges/${testId}`, { active: true }, config);
            toast.success('Lab test activated');
            fetchLabTests();
        } catch (error) {
            console.error(error);
            toast.error('Error activating test');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            basePrice: '',
            standardFee: '',
            retainershipFee: '',
            nhiaFee: '',
            kschmaFee: '',
            description: '',
            code: '',
            resultTemplate: ''
        });
        setEditingTest(null);
        setShowForm(false);
    };

    const defaultTemplates = {
        cbc: `COMPLETE BLOOD COUNT (CBC)

RESULTS:
- WBC (White Blood Cells): _____ x10^3/μL (Normal: 4.0-11.0)
- RBC (Red Blood Cells): _____ x10^6/μL (Normal: 4.2-5.4 M, 3.8-5.2 F)
- Hemoglobin: _____ g/dL (Normal: 13.0-17.0 M, 12.0-15.0 F)
- Hematocrit: _____ % (Normal: 38-48 M, 36-44 F)
- MCV (Mean Corpuscular Volume): _____ fL (Normal: 80-100)
- MCH (Mean Corpuscular Hemoglobin): _____ pg (Normal: 27-33)
- MCHC: _____ g/dL (Normal: 32-36)
- Platelets: _____ x10^3/μL (Normal: 150-400)
- Neutrophils: _____ % (Normal: 40-70)
- Lymphocytes: _____ % (Normal: 20-40)
- Monocytes: _____ % (Normal: 2-8)
- Eosinophils: _____ % (Normal: 1-4)
- Basophils: _____ % (Normal: 0.5-1)

INTERPRETATION:
_____________________________________
`,
        urinalysis: `URINALYSIS

PHYSICAL EXAMINATION:
- Color: _____ (Normal: Yellow to amber)
- Appearance: _____ (Normal: Clear)
- Specific Gravity: _____ (Normal: 1.005-1.030)

CHEMICAL EXAMINATION:
- pH: _____ (Normal: 5.0-8.0)
- Protein: _____ (Normal: Negative)
- Glucose: _____ (Normal: Negative)
- Ketones: _____ (Normal: Negative)
- Blood: _____ (Normal: Negative)
- Bilirubin: _____ (Normal: Negative)
- Urobilinogen: _____ (Normal: 0.1-1.0 mg/dL)
- Nitrite: _____ (Normal: Negative)
- Leukocyte Esterase: _____ (Normal: Negative)

MICROSCOPIC EXAMINATION:
- WBC: _____ /hpf (Normal: 0-5)
- RBC: _____ /hpf (Normal: 0-2)
- Epithelial Cells: _____ /hpf (Normal: Few)
- Bacteria: _____ (Normal: None/Few)
- Crystals: _____ (Normal: None)
- Casts: _____ (Normal: None)
`,
        lipid: `LIPID PROFILE

RESULTS:
- Total Cholesterol: _____ mg/dL (Normal: <200)
- HDL Cholesterol: _____ mg/dL (Normal: >40 M, >50 F)
- LDL Cholesterol: _____ mg/dL (Normal: <100)
- Triglycerides: _____ mg/dL (Normal: <150)
- VLDL: _____ mg/dL (Normal: 2-30)

RISK ASSESSMENT:
_____________________________________
`,
        liver: `LIVER FUNCTION TEST (LFT)

RESULTS:
- ALT (SGPT): _____ U/L (Normal: 7-56)
- AST (SGOT): _____ U/L (Normal: 5-40)
- ALP (Alkaline Phosphatase): _____ U/L (Normal: 44-147)
- Total Bilirubin: _____ mg/dL (Normal: 0.1-1.2)
- Direct Bilirubin: _____ mg/dL (Normal: <0.3)
- Total Protein: _____ g/dL (Normal: 6.0-8.3)
- Albumin: _____ g/dL (Normal: 3.5-5.5)
- Globulin: _____ g/dL (Normal: 2.0-3.5)
- A/G Ratio: _____ (Normal: 0.8-2.0)
`,
        kidney: `RENAL FUNCTION TEST (RFT)

RESULTS:
- Urea: _____ mg/dL (Normal: 7-20)
- Creatinine: _____ mg/dL (Normal: 0.6-1.2 M, 0.5-1.1 F)
- Uric Acid: _____ mg/dL (Normal: 3.5-7.2 M, 2.6-6.0 F)
- Sodium (Na+): _____ mEq/L (Normal: 135-145)
- Potassium (K+): _____ mEq/L (Normal: 3.5-5.0)
- Chloride (Cl-): _____ mEq/L (Normal: 98-107)
`,
        thyroid: `THYROID FUNCTION TEST

RESULTS:
- TSH: _____ mIU/L (Normal: 0.4-4.0)
- Free T4: _____ ng/dL (Normal: 0.8-1.8)
- Free T3: _____ pg/mL (Normal: 2.3-4.2)
`,
        glucose: `GLUCOSE TEST

RESULTS:
- Fasting Blood Sugar (FBS): _____ mg/dL (Normal: 70-99)
- Random Blood Sugar (RBS): _____ mg/dL (Normal: <140)
- 2hr Post-Prandial (PPBS): _____ mg/dL (Normal: <140)
`,
        electrolytes: `ELECTROLYTES PANEL

RESULTS:
- Sodium (Na+): _____ mEq/L (Normal: 135-145)
- Potassium (K+): _____ mEq/L (Normal: 3.5-5.0)
- Chloride (Cl-): _____ mEq/L (Normal: 98-107)
- Bicarbonate (HCO3-): _____ mEq/L (Normal: 22-29)
- Calcium (Ca++): _____ mg/dL (Normal: 8.5-10.5)
- Magnesium (Mg++): _____ mg/dL (Normal: 1.7-2.2)
- Phosphate (PO4-): _____ mg/dL (Normal: 2.5-4.5)
`,
        coagulation: `COAGULATION PROFILE

RESULTS:
- PT (Prothrombin Time): _____ sec (Normal: 11-13.5)
- INR: _____ (Normal: 0.8-1.1)
- APTT: _____ sec (Normal: 30-40)
- Bleeding Time: _____ min (Normal: 2-7)
- Clotting Time: _____ min (Normal: 8-15)
`,
        cardiac: `CARDIAC ENZYMES

RESULTS:
- Troponin I: _____ ng/mL (Normal: <0.04)
- Troponin T: _____ ng/mL (Normal: <0.01)
- CK-MB: _____ ng/mL (Normal: <5)
- CPK (Total): _____ U/L (Normal: 10-120)
- LDH: _____ U/L (Normal: 140-280)
- AST (SGOT): _____ U/L (Normal: 5-40)
`,
        stool: `STOOL EXAMINATION

MACROSCOPIC:
- Color: _____ (Normal: Brown)
- Consistency: _____ (Normal: Formed/Semi-formed)
- Mucus: _____ (Normal: Absent)
- Blood: _____ (Normal: Absent)

MICROSCOPIC:
- Pus Cells: _____ /hpf (Normal: 0-2)
- RBCs: _____ /hpf (Normal: Nil)
- Ova/Parasites: _____ (Normal: None seen)
- Cysts: _____ (Normal: None seen)
- Undigested Food: _____ (Normal: Absent)
`,
        hba1c: `HbA1c (GLYCOSYLATED HEMOGLOBIN)

RESULT:
- HbA1c: _____ %

INTERPRETATION:
- Normal: < 5.7%
- Prediabetes: 5.7% - 6.4%
- Diabetes: >= 6.5%
`,
        esr: `ERYTHROCYTE SEDIMENTATION RATE (ESR)

RESULT:
- ESR (Westergren): _____ mm/1st hr

NORMAL RANGES:
- Male <50 yrs: 0-15
- Male >50 yrs: 0-20
- Female <50 yrs: 0-20
- Female >50 yrs: 0-30
`,
        mal: `MALARIA TEST

RESULT:
- Malaria: _____ Positive/Negative


`
    };

    const insertTemplate = (templateKey) => {
        setFormData(prev => ({
            ...prev,
            resultTemplate: defaultTemplates[templateKey]
        }));
    };

    const activeTests = labTests
        .filter(t => t.active)
        .filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

    const inactiveTests = labTests
        .filter(t => !t.active)
        .filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

    return (
        <Layout>
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaFlask className="text-purple-600" /> Lab Test Management
                    </h2>
                    <p className="text-gray-600 text-sm">Manage lab test catalog, prices, and result templates</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-purple-600 text-white px-6 py-2 rounded hover:bg-purple-700 flex items-center gap-2"
                >
                    {showForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Add New Test</>}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h3 className="text-xl font-bold mb-4">
                        {editingTest ? 'Edit Lab Test' : 'Create New Lab Test'}
                    </h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Test Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., Complete Blood Count (CBC)"
                                    required
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 mb-2 font-semibold">Pricing Configuration</label>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 p-4 rounded border">
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-blue-600">Standard Fee <span className="text-red-500">*</span></label>
                                    <input
                                        type="number"
                                        name="standardFee"
                                        value={formData.standardFee}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded text-sm border-blue-200 focus:border-blue-500"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-purple-600">Retainership</label>
                                    <input
                                        type="number"
                                        name="retainershipFee"
                                        value={formData.retainershipFee}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded text-sm border-purple-200 focus:border-purple-500"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-green-600">NHIA Fee</label>
                                    <input
                                        type="number"
                                        name="nhiaFee"
                                        value={formData.nhiaFee}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded text-sm border-green-200 focus:border-green-500"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold mb-1 text-orange-600">KSCHMA Fee</label>
                                    <input
                                        type="number"
                                        name="kschmaFee"
                                        value={formData.kschmaFee}
                                        onChange={handleInputChange}
                                        className="w-full border p-2 rounded text-sm border-orange-200 focus:border-orange-500"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Test Code (Optional)
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="e.g., LAB-CBC-001"
                                />
                            </div>
                            <div>
                                <label className="block text-gray-700 mb-2 font-semibold">
                                    Description (Optional)
                                </label>
                                <input
                                    type="text"
                                    name="description"
                                    value={formData.description}
                                    onChange={handleInputChange}
                                    className="w-full border p-2 rounded"
                                    placeholder="Brief description of the test"
                                />
                            </div>
                        </div>

                        <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-gray-700 font-semibold flex items-center gap-2">
                                    <FaFileAlt /> Result Template (Optional)
                                </label>
                                <div className="flex gap-2 flex-wrap">
                                    <button type="button" onClick={() => insertTemplate('cbc')} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">CBC</button>
                                    <button type="button" onClick={() => insertTemplate('urinalysis')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">Urinalysis</button>
                                    <button type="button" onClick={() => insertTemplate('lipid')} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200">Lipid Profile</button>
                                    <button type="button" onClick={() => insertTemplate('liver')} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200">Liver Function</button>
                                    <button type="button" onClick={() => insertTemplate('kidney')} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">Kidney Function</button>
                                    <button type="button" onClick={() => insertTemplate('thyroid')} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200">Thyroid</button>
                                    <button type="button" onClick={() => insertTemplate('glucose')} className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded hover:bg-pink-200">Glucose</button>
                                    <button type="button" onClick={() => insertTemplate('electrolytes')} className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded hover:bg-teal-200">Electrolytes</button>
                                    <button type="button" onClick={() => insertTemplate('coagulation')} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200">Coagulation</button>
                                    <button type="button" onClick={() => insertTemplate('cardiac')} className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded hover:bg-rose-200">Cardiac Enzymes</button>
                                    <button type="button" onClick={() => insertTemplate('stool')} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200">Stool Exam</button>
                                    <button type="button" onClick={() => insertTemplate('hba1c')} className="text-xs bg-lime-100 text-lime-700 px-2 py-1 rounded hover:bg-lime-200">HbA1c</button>
                                    <button type="button" onClick={() => insertTemplate('esr')} className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded hover:bg-cyan-200">ESR</button>
                                    <button type="button" onClick={() => insertTemplate('mal')} className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded hover:bg-cyan-200">Malaria</button>
                                </div>
                            </div>
                            <textarea
                                name="resultTemplate"
                                value={formData.resultTemplate}
                                onChange={handleInputChange}
                                className="w-full border p-3 rounded font-mono text-sm"
                                rows="12"
                                placeholder="Design how the result form will look. Use _____ for blank fields that lab technicians will fill in.

Example:
COMPLETE BLOOD COUNT (CBC)

RESULTS:
- WBC: _____ x10^3/μL (Normal: 4.0-11.0)
- RBC: _____ x10^6/μL (Normal: 4.2-5.4)
- Hemoglobin: _____ g/dL (Normal: 13.0-17.0)

INTERPRETATION:
_____________________________________"
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-1">
                                This template will be pre-filled when lab technicians enter results for this test.
                            </p>
                        </div>

                        <div className="flex gap-2">
                            <button
                                type="submit"
                                className="bg-green-600 text-white px-6 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                            >
                                <FaSave /> {editingTest ? 'Update Test' : 'Create Test'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="bg-gray-400 text-white px-6 py-2 rounded hover:bg-gray-500"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div >
            )}

            {/* Active Tests List */}
            <div className="mb-4">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full border p-2 rounded"
                    placeholder="Search test by name or code..."
                />
            </div>

            <div className="bg-white p-6 rounded shadow mb-6">
                <h3 className="text-xl font-bold mb-4">Active Lab Tests ({activeTests.length})</h3>
                {activeTests.length === 0 ? (
                    <p className="text-gray-500">No active lab tests. Create one to get started.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="text-left p-3 font-semibold">Test Name</th>
                                    <th className="text-left p-3 font-semibold">Code</th>
                                    <th className="text-left p-3 font-semibold">Price</th>
                                    <th className="text-left p-3 font-semibold">Template</th>
                                    <th className="text-left p-3 font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {activeTests.map(test => (
                                    <tr key={test._id} className="border-b hover:bg-gray-50">
                                        <td className="p-3">
                                            <p className="font-semibold">{test.name}</p>
                                            {test.description && (
                                                <p className="text-xs text-gray-600">{test.description}</p>
                                            )}
                                        </td>
                                        <td className="p-3 text-sm text-gray-600">
                                            {test.code || '-'}
                                        </td>
                                        <td className="p-3">
                                            <div className="text-sm">
                                                <div className="flex justify-between gap-2 border-b border-gray-100 pb-1 mb-1">
                                                    <span className="text-gray-500">Standard:</span>
                                                    <span className="font-semibold text-gray-800">${(test.standardFee || 0).toFixed(2)}</span>
                                                </div>
                                                {(test.standardFee > 0 || test.retainershipFee > 0 || test.nhiaFee > 0 || test.kschmaFee > 0) && (
                                                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                                                        {test.standardFee > 0 && (
                                                            <div className="flex justify-between gap-1">
                                                                <span className="text-blue-600">Std:</span>
                                                                <span>${test.standardFee.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {test.retainershipFee > 0 && (
                                                            <div className="flex justify-between gap-1">
                                                                <span className="text-purple-600">Ret:</span>
                                                                <span>${test.retainershipFee.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {test.nhiaFee > 0 && (
                                                            <div className="flex justify-between gap-1">
                                                                <span className="text-green-600">NHIA:</span>
                                                                <span>${test.nhiaFee.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {test.kschmaFee > 0 && (
                                                            <div className="flex justify-between gap-1">
                                                                <span className="text-orange-600">KSC:</span>
                                                                <span>${test.kschmaFee.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            {test.resultTemplate ? (
                                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                    ✓ Template Set
                                                </span>
                                            ) : (
                                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                                                    No Template
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleEdit(test)}
                                                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
                                                >
                                                    <FaEdit /> Edit
                                                </button>
                                                <button
                                                    onClick={() => handleDeactivate(test._id)}
                                                    className="text-red-600 hover:text-red-800 text-sm"
                                                >
                                                    Deactivate
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Inactive Tests */}
            {
                inactiveTests.length > 0 && (
                    <div className="bg-gray-50 p-6 rounded shadow">
                        <h3 className="text-xl font-bold mb-4 text-gray-600">
                            Inactive Lab Tests ({inactiveTests.length})
                        </h3>
                        <div className="space-y-2">
                            {inactiveTests.map(test => (
                                <div key={test._id} className="bg-white p-3 rounded border flex justify-between items-center">
                                    <div>
                                        <p className="font-semibold text-gray-600">{test.name}</p>
                                        <p className="text-sm text-gray-500">${test.basePrice.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs bg-red-100 text-red-700 px-3 py-1 rounded">
                                            Inactive
                                        </span>
                                        <button
                                            onClick={() => handleActivate(test._id)}
                                            className="text-green-600 hover:text-green-800 text-sm font-semibold"
                                        >
                                            Activate
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }
        </Layout >
    );
};

export default LabTestManagement;
