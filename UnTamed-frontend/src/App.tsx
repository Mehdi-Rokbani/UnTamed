import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./auth/auth.store";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";

import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { LandingPage } from "./pages/LandingPage";
import HomePage from "./pages/HomePage";
import CreateActivityPage from "./pages/CreateActivityPage";
import ActivityDetailsPage from "./pages/ActivityDetailsPage";

import { ProfilePage } from "./pages/ProfilePage";
import { ProfileEditPage } from "./pages/ProfileEditPage";
import { GuideProfileEditPage } from "./pages/GuideProfileEditPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";

import GuideLayout from "./components/GuideLayout";
import GuideActivitiesPage from "./pages/GuideActivitiesPage";
import EditActivityPage from "./pages/EditActivityPage";
import TemplateSessionsPage from "./pages/Templatesessionspage";
import MyBookingsPage from "./pages/MyBookingsPage";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import GuideCheckInPage from "./pages/GuideCheckInPage";
import GuestPassPage from "./pages/GuestPassPage";
import GuideSessionAttendancePage from "./pages/GuideSessionAttendancePage";
import GuideAttendanceHistoryPage from "./pages/GuideAttendanceHistoryPage";

function ForbiddenFallback() {
  return <div style={{ padding: 24 }}>403 — Forbidden</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/landing" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/passes/:token" element={<GuestPassPage />} />
        <Route path="/guide/check-in/:token" element={<GuideCheckInPage />} />

        {/* Authenticated */}
        <Route
          path="/home"
          element={
            <RequireAuth>
              <HomePage />
            </RequireAuth>
          }
        />

        <Route
          path="/activities/:id"
          element={
            <RequireAuth>
              <ActivityDetailsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/my-bookings"
          element={
            <RequireAuth>
              <MyBookingsPage />
            </RequireAuth>
          }
        />

        {/* Profile */}
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <RequireAuth>
              <ProfileEditPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/guide/edit"
          element={
            <RequireAuth>
              <RequireRole allow={["GUIDE", "ADMIN"]}>
                <GuideProfileEditPage />
              </RequireRole>
            </RequireAuth>
          }
        />

        {/* Guide: create template (outside sidebar layout — full page wizard) */}
        <Route
          path="/activities/create"
          element={
            <RequireAuth>
              <RequireRole allow={["GUIDE", "ADMIN"]}>
                <CreateActivityPage />
              </RequireRole>
            </RequireAuth>
          }
        />

        {/* Guide area — sidebar layout */}
        <Route
          path="/guide"
          element={
            <RequireAuth>
              <RequireRole allow={["GUIDE", "ADMIN"]}>
                <GuideLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="activities" replace />} />

          {/* Template list dashboard */}
          <Route path="activities" element={<GuideActivitiesPage />} />

          {/* Edit a template's details + photos */}
          <Route path="templates/:id/edit" element={<EditActivityPage />} />

          {/* Manage sessions (add / publish / unpublish / cancel) for a template */}
          <Route path="templates/:id/sessions" element={<TemplateSessionsPage />} />
          <Route path="sessions/:sessionId/attendance" element={<GuideSessionAttendancePage />} />
          <Route path="attendance-history" element={<GuideAttendanceHistoryPage />} />
        </Route>

        {/* Errors */}
        <Route path="/403" element={<ForbiddenFallback />} />

        {/* Stripe payment result pages */}
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-cancel" element={<PaymentCancel />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />









      </Routes>
    </AuthProvider>
  );
}
