import { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import Layout from '../components/Layout';
import { FaXRay, FaPlus, FaEdit, FaSave, FaTimes, FaFileAlt } from 'react-icons/fa';
import { toast } from 'react-toastify';
import LoadingOverlay from '../components/loadingOverlay';

const RadiologyTestManagement = () => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [radiologyTests, setRadiologyTests] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingTest, setEditingTest] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [formData, setFormData] = useState({
        name: '',
        standardFee: '',
        retainershipFee: '',
        nhiaFee: '',
        kschmaFee: '',
        description: '',
        code: '',
        resultTemplate: ''
    });

    useEffect(() => {
        fetchRadiologyTests();
    }, []);

    const fetchRadiologyTests = async () => {
        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const { data } = await axios.get('http://localhost:5000/api/charges?type=radiology', config);
            setRadiologyTests(data);
        } catch (error) {
            console.error(error);
            toast.error('Error fetching radiology tests');
        } finally {
            setLoading(false);
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
            toast.error('Please fill in test name and standard fee');
            return;
        }

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            const payload = {
                name: formData.name,
                type: 'radiology',
                basePrice: parseFloat(formData.standardFee), // For backward compatibility
                standardFee: parseFloat(formData.standardFee),
                retainershipFee: parseFloat(formData.retainershipFee) || 0,
                nhiaFee: parseFloat(formData.nhiaFee) || 0,
                kschmaFee: parseFloat(formData.kschmaFee) || 0,
                department: 'Radiology',
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
                toast.success('Radiology test updated successfully!');
            } else {
                await axios.post('http://localhost:5000/api/charges', payload, config);
                toast.success('Radiology test created successfully!');
            }

            resetForm();
            fetchRadiologyTests();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Error saving radiology test');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (test) => {
        setEditingTest(test);
        setFormData({
            name: test.name,
            standardFee: (test.standardFee || test.basePrice || 0).toString(),
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
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.delete(`http://localhost:5000/api/charges/${testId}`, config);
            toast.success('Radiology test deactivated');
            fetchRadiologyTests();
        } catch (error) {
            console.error(error);
            toast.error('Error deactivating test');
        } finally {
            setLoading(false);
        }
    };

    const handleActivate = async (testId) => {
        if (!window.confirm('Are you sure you want to activate this test?')) return;

        try {
            setLoading(true);
            const config = { headers: { Authorization: `Bearer ${user.token}` } };
            await axios.put(`http://localhost:5000/api/charges/${testId}`, { active: true }, config);
            toast.success('Radiology test activated');
            fetchRadiologyTests();
        } catch (error) {
            console.error(error);
            toast.error('Error activating test');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
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
        xray_chest: `CHEST X-RAY

TECHNIQUE:
- PA and Lateral views obtained

FINDINGS:
- Heart Size: _____ (Normal/Enlarged)
- Cardiac Silhouette: _____
- Lung Fields: _____ (Clear/Infiltrates/Consolidation)
- Pleural Spaces: _____ (Clear/Effusion)
- Mediastinum: _____ (Normal/Widened)
- Bony Thorax: _____ (Normal/Abnormal)
- Diaphragm: _____ (Normal/Elevated)

IMPRESSION:
_____________________________________
`,
        xray_abdomen: `ABDOMINAL X-RAY

TECHNIQUE:
- Supine and erect views obtained

FINDINGS:
- Bowel Gas Pattern: _____ (Normal/Dilated)
- Free Air: _____ (Present/Absent)
- Fluid Levels: _____ (Present/Absent)
- Soft Tissue: _____ (Normal/Abnormal)
- Bony Structures: _____ (Normal/Abnormal)
- Calcifications: _____ (Present/Absent)

IMPRESSION:
_____________________________________
`,
        ct_head: `CT SCAN - HEAD (NON-CONTRAST)

TECHNIQUE:
- Axial images obtained without contrast

FINDINGS:
- Brain Parenchyma: _____ (Normal/Abnormal)
- Ventricles: _____ (Normal size/Dilated)
- Midline Shift: _____ (Present/Absent)
- Hemorrhage: _____ (Present/Absent)
- Mass Effect: _____ (Present/Absent)
- Skull: _____ (Intact/Fracture)
- Sinuses: _____ (Clear/Opacified)

IMPRESSION:
_____________________________________
`,
        ultrasound_abdomen: `ULTRASOUND - ABDOMEN

TECHNIQUE:
- Real-time ultrasound examination

FINDINGS:
- Liver: _____ (Normal size and echogenicity/Abnormal)
- Gallbladder: _____ (Normal/Stones/Wall thickening)
- Pancreas: _____ (Normal/Abnormal)
- Spleen: _____ (Normal size/Enlarged)
- Kidneys: _____ (Normal/Abnormal)
  - Right: _____ cm
  - Left: _____ cm
- Bladder: _____ (Normal/Abnormal)
- Free Fluid: _____ (Present/Absent)

IMPRESSION:
_____________________________________
`,
        ultrasound_pelvis: `ULTRASOUND - PELVIS

TECHNIQUE:
- Transabdominal/Transvaginal ultrasound

FINDINGS:
- Uterus: _____ (Normal size and position/Abnormal)
  - Size: _____ cm
  - Endometrium: _____ mm
- Ovaries:
  - Right: _____ (Normal/Cyst/Mass)
  - Left: _____ (Normal/Cyst/Mass)
- Adnexa: _____ (Normal/Abnormal)
- Free Fluid: _____ (Present/Absent)
- Bladder: _____ (Normal/Abnormal)

IMPRESSION:
_____________________________________
`,
        mri_brain: `MRI - BRAIN

TECHNIQUE:
- T1, T2, FLAIR sequences obtained

FINDINGS:
- Brain Parenchyma: _____ (Normal/Abnormal)
- White Matter: _____ (Normal/Lesions)
- Gray Matter: _____ (Normal/Abnormal)
- Ventricles: _____ (Normal/Dilated)
- Cerebellum: _____ (Normal/Abnormal)
- Brainstem: _____ (Normal/Abnormal)
- Vascular Structures: _____ (Normal/Abnormal)
- Extra-axial Spaces: _____ (Normal/Abnormal)

IMPRESSION:
_____________________________________
`,
        mammography: `MAMMOGRAPHY

TECHNIQUE:
- Bilateral CC and MLO views obtained

FINDINGS:
- Breast Composition: _____ (Fatty/Scattered/Heterogeneous/Dense)
- Masses: _____ (Present/Absent)
- Calcifications: _____ (Present/Absent)
- Architectural Distortion: _____ (Present/Absent)
- Asymmetry: _____ (Present/Absent)
- Skin/Nipple Changes: _____ (Present/Absent)

BI-RADS Category: _____

IMPRESSION:
_____________________________________
`,
        xray_spine: `SPINE X-RAY

TECHNIQUE:
- AP and Lateral views of _____ spine

FINDINGS:
- Alignment: _____ (Normal/Scoliosis/Kyphosis/Lordosis)
- Vertebral Bodies: _____ (Normal height/Compression)
- Disc Spaces: _____ (Preserved/Narrowed)
- Facet Joints: _____ (Normal/Degenerative changes)
- Soft Tissues: _____ (Normal/Abnormal)
- Bone Density: _____ (Normal/Osteopenia/Osteoporosis)

IMPRESSION:
_____________________________________
`,
        ct_chest: `CT SCAN - CHEST

TECHNIQUE:
- Axial images with/without contrast

FINDINGS:
- Lungs: _____ (Clear/Nodules/Masses/Infiltrates)
- Pleura: _____ (Normal/Effusion/Thickening)
- Mediastinum: _____ (Normal/Lymphadenopathy/Mass)
- Heart: _____ (Normal size/Cardiomegaly)
- Great Vessels: _____ (Normal/Abnormal)
- Chest Wall: _____ (Normal/Abnormal)
- Bones: _____ (Normal/Lesions)

IMPRESSION:
_____________________________________
`,
        barium_swallow: `BARIUM SWALLOW STUDY

TECHNIQUE:
- Fluoroscopic examination with barium contrast

FINDINGS:
- Swallowing Mechanism: _____ (Normal/Abnormal)
- Esophagus: _____ (Normal caliber/Stricture/Dilatation)
- Mucosal Pattern: _____ (Normal/Irregular)
- Peristalsis: _____ (Normal/Abnormal)
- GE Junction: _____ (Normal/Hiatal hernia)
- Reflux: _____ (Present/Absent)

IMPRESSION:
_____________________________________
`
    };

    const insertTemplate = (templateKey) => {
        setFormData(prev => ({
            ...prev,
            resultTemplate: defaultTemplates[templateKey]
        }));
    };

    const activeTests = radiologyTests
        .filter(t => t.active)
        .filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

    const inactiveTests = radiologyTests
        .filter(t => !t.active)
        .filter(t =>
            t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );

    return (
        <Layout>
            {loading && <LoadingOverlay />}
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <FaXRay className="text-blue-600" /> Radiology Test Management
                    </h2>
                    <p className="text-gray-600 text-sm">Manage radiology test catalog, prices, and result templates</p>
                </div>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
                >
                    {showForm ? <><FaTimes /> Cancel</> : <><FaPlus /> Add New Test</>}
                </button>
            </div>

            {/* Form */}
            {showForm && (
                <div className="bg-white p-6 rounded shadow mb-6">
                    <h3 className="text-xl font-bold mb-4">
                        {editingTest ? 'Edit Radiology Test' : 'Create New Radiology Test'}
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
                                    placeholder="e.g., Chest X-Ray (PA & Lateral)"
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
                                    placeholder="e.g., RAD-CXR-001"
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
                                    <button type="button" onClick={() => insertTemplate('xray_chest')} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200">Chest X-Ray</button>
                                    <button type="button" onClick={() => insertTemplate('xray_abdomen')} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">Abdomen X-Ray</button>
                                    <button type="button" onClick={() => insertTemplate('ct_head')} className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200">CT Head</button>
                                    <button type="button" onClick={() => insertTemplate('ct_chest')} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200">CT Chest</button>
                                    <button type="button" onClick={() => insertTemplate('ultrasound_abdomen')} className="text-xs bg-teal-100 text-teal-700 px-2 py-1 rounded hover:bg-teal-200">US Abdomen</button>
                                    <button type="button" onClick={() => insertTemplate('ultrasound_pelvis')} className="text-xs bg-pink-100 text-pink-700 px-2 py-1 rounded hover:bg-pink-200">US Pelvis</button>
                                    <button type="button" onClick={() => insertTemplate('mri_brain')} className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200">MRI Brain</button>
                                    <button type="button" onClick={() => insertTemplate('mammography')} className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded hover:bg-rose-200">Mammography</button>
                                    <button type="button" onClick={() => insertTemplate('xray_spine')} className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200">Spine X-Ray</button>
                                    <button type="button" onClick={() => insertTemplate('barium_swallow')} className="text-xs bg-cyan-100 text-cyan-700 px-2 py-1 rounded hover:bg-cyan-200">Barium Swallow</button>
                                </div>
                            </div>
                            <textarea
                                name="resultTemplate"
                                value={formData.resultTemplate}
                                onChange={handleInputChange}
                                className="w-full border p-3 rounded font-mono text-sm"
                                rows="12"
                                placeholder="Design how the result form will look. Use _____ for blank fields that radiologists will fill in.

Example:
CHEST X-RAY

TECHNIQUE:
- PA and Lateral views obtained

FINDINGS:
- Heart Size: _____ (Normal/Enlarged)
- Lung Fields: _____ (Clear/Infiltrates)

IMPRESSION:
_____________________________________"
                            ></textarea>
                            <p className="text-xs text-gray-500 mt-1">
                                This template will be pre-filled when radiologists enter results for this test.
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
                </div>
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
                <h3 className="text-xl font-bold mb-4">Active Radiology Tests ({activeTests.length})</h3>
                {activeTests.length === 0 ? (
                    <p className="text-gray-500">No active radiology tests. Create one to get started.</p>
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
                                                    <span className="font-semibold text-gray-800">${(test.standardFee || test.basePrice || 0).toFixed(2)}</span>
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
            {inactiveTests.length > 0 && (
                <div className="bg-gray-50 p-6 rounded shadow">
                    <h3 className="text-xl font-bold mb-4 text-gray-600">
                        Inactive Radiology Tests ({inactiveTests.length})
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
            )}
        </Layout>
    );
};

export default RadiologyTestManagement;
