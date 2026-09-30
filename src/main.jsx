import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardPage from './pages/DashboardPage.jsx'
import LandingRoute from './pages/LandingRoute.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RoleSelectionPage from './pages/RoleSelectionPage.jsx'
import AuthorityPage from './pages/AuthorityPage.jsx'
import AuthProvider from './auth/AuthProvider.jsx'
import ProtectedRoute from './auth/ProtectedRoute.jsx'
import EmailConfirmationPage from './pages/EmailConfirmationPage.jsx'
import AuthorityApplicationPage from './pages/AuthorityApplicationPage.jsx'
import VerificationPage from './pages/VerificationPage.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingRoute />} />
        <Route path="/dashboard" element={<ProtectedRoute path="/dashboard"><DashboardPage /></ProtectedRoute>} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/select-role" element={<RoleSelectionPage />} />
        <Route path="/authority" element={<ProtectedRoute path="/authority"><AuthorityPage /></ProtectedRoute>} />
        <Route path="/confirm-email" element={<EmailConfirmationPage />} />
        <Route path="/authority-application" element={<ProtectedRoute path="/authority-application"><AuthorityApplicationPage /></ProtectedRoute>} />
        <Route path="/verification-pending" element={<ProtectedRoute path="/verification-pending"><VerificationPage /></ProtectedRoute>} />
        <Route path="/verification-status" element={<ProtectedRoute path="/verification-status"><VerificationPage rejected /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
