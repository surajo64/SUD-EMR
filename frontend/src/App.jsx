import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';


import PatientList from './pages/PatientList';
import RegisterPatient from './pages/RegisterPatient';

import PatientDetails from './pages/PatientDetails';

import PharmacyPrescriptions from './pages/PharmacyPrescriptions';
import Inventory from './pages/Inventory';

import Appointments from './pages/Appointments';
import NurseTriage from './pages/NurseTriage';
import NursingServiceManagement from './pages/NursingServiceManagement';
import LabDashboard from './pages/LabDashboard';
import LabTestManagement from './pages/LabTestManagement';
import ExternalInvestigations from './pages/ExternalInvestigations';
import ExternalRadiology from './pages/ExternalRadiology';
import ExternalPharmacy from './pages/ExternalPharmacy';
import RadiologyDashboard from './pages/RadiologyDashboard';
import RadiologyTestManagement from './pages/RadiologyTestManagement';
import BillingDashboard from './pages/BillingDashboard';
import FrontDeskDashboard from './pages/FrontDeskDashboard';
import CashierDashboard from './pages/CashierDashboard';

// Admin Pages
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import RevenueReports from './pages/RevenueReports';
import PatientManagement from './pages/PatientManagement';
import ClinicManagement from './pages/ClinicManagement';
import FrontDeskChargeManagement from './pages/FrontDeskChargeManagement';
import WardManagement from './pages/WardManagement';
import DrugMetadataManagement from './pages/DrugMetadataManagement';
import PharmacyManagement from './pages/PharmacyManagement';
import DrugTransfer from './pages/DrugTransfer';
import DrugDisposal from './pages/DrugDisposal';
import HMOManagement from './pages/HMOManagement';
import ClaimsManagement from './pages/ClaimsManagement';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/patients" element={<PatientList />} />
          <Route path="/patient/:id" element={<PatientDetails />} />
          <Route path="/register-patient" element={<RegisterPatient />} />
          <Route path="/pharmacy/prescriptions" element={<PharmacyPrescriptions />} />
          <Route path="/pharmacy/inventory" element={<Inventory />} />
          <Route path="/lab" element={<LabDashboard />} />
          <Route path="/lab/manage-tests" element={<LabTestManagement />} />
          <Route path="/lab/external-investigations" element={<ExternalInvestigations />} />
          <Route path="/radiology" element={<RadiologyDashboard />} />
          <Route path="/radiology/manage-tests" element={<RadiologyTestManagement />} />
          <Route path="/radiology/external-investigations" element={<ExternalRadiology />} />
          <Route path="/pharmacy/external-investigations" element={<ExternalPharmacy />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/nurse/triage" element={<NurseTriage />} />
          <Route path="/nurse/services" element={<NursingServiceManagement />} />
          <Route path="/billing" element={<BillingDashboard />} />
          <Route path="/front-desk" element={<FrontDeskDashboard />} />
          <Route path="/front-desk/patients" element={<PatientManagement />} />
          <Route path="/cashier" element={<CashierDashboard />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/reports" element={<RevenueReports />} />
          <Route path="/admin/patients" element={<PatientManagement />} />
          <Route path="/admin/clinics" element={<ClinicManagement />} />
          <Route path="/admin/front-desk-charges" element={<FrontDeskChargeManagement />} />
          <Route path="/admin/wards" element={<WardManagement />} />
          <Route path="/admin/drug-metadata" element={<DrugMetadataManagement />} />
          <Route path="/admin/pharmacies" element={<PharmacyManagement />} />
          <Route path="/pharmacy/transfers" element={<DrugTransfer />} />
          <Route path="/pharmacy/disposal" element={<DrugDisposal />} />
          <Route path="/admin/hmo-management" element={<HMOManagement />} />
          <Route path="/admin/claims-management" element={<ClaimsManagement />} />

          <Route path="/" element={<Navigate to="/dashboard" />} />
          {/* Add other routes here */}
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
