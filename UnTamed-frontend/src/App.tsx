import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import { AuthProvider } from "./auth/auth.store";
import { RequireAuth } from "./auth/RequireAuth";
import { RequireRole } from "./auth/RequireRole";
import { NotificationsProvider } from "./hooks/useNotifications";

const LoginPage = lazy(() => import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import("./pages/RegisterPage").then((module) => ({ default: module.RegisterPage })));
const LandingPage = lazy(() => import("./pages/LandingPage").then((module) => ({ default: module.LandingPage })));
const LaunchPage = lazy(() => import("./pages/LaunchPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const CreateActivityPage = lazy(() => import("./pages/CreateActivityPage"));
const ActivityDetailsPage = lazy(() => import("./pages/ActivityDetailsPage"));

const ProfilePage = lazy(() => import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage })));
const ProfileEditPage = lazy(() => import("./pages/ProfileEditPage").then((module) => ({ default: module.ProfileEditPage })));
const GuideProfileEditPage = lazy(() =>
  import("./pages/GuideProfileEditPage").then((module) => ({ default: module.GuideProfileEditPage })),
);
const PublicUserProfilePage = lazy(() => import("./pages/PublicUserProfilePage"));
const VerifyEmailPage = lazy(() => import("./pages/VerifyEmailPage").then((module) => ({ default: module.VerifyEmailPage })));

const GuideLayout = lazy(() => import("./components/GuideLayout"));
const GuideActivitiesPage = lazy(() => import("./pages/GuideActivitiesPage"));
const EditActivityPage = lazy(() => import("./pages/EditActivityPage"));
const TemplateSessionsPage = lazy(() => import("./pages/Templatesessionspage"));
const MyBookingsPage = lazy(() => import("./pages/MyBookingsPage"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel"));
const UntamedCheckoutPage = lazy(() => import("./pages/UntamedCheckoutPage"));
const GuideCheckInPage = lazy(() => import("./pages/GuideCheckInPage"));
const GuestPassPage = lazy(() => import("./pages/GuestPassPage"));
const GuideSessionAttendancePage = lazy(() => import("./pages/GuideSessionAttendancePage"));
const GuideAttendanceHistoryPage = lazy(() => import("./pages/GuideAttendanceHistoryPage"));
const GuideEarningsPage = lazy(() => import("./pages/GuideEarningsPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const ChatRoomsPage = lazy(() => import("./pages/ChatRoomsPage"));
const ChatRoomPage = lazy(() => import("./pages/ChatRoomPage"));
const AdminTestPage = lazy(() => import("./pages/AdminTestPage"));
const AdminLayout = lazy(() => import("./layouts/AdminLayout"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminAlertsPage = lazy(() => import("./pages/admin/AdminAlertsPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminGuidesPage = lazy(() => import("./pages/admin/AdminGuidesPage"));
const AdminSessionsPage = lazy(() => import("./pages/admin/AdminSessionsPage"));
const AdminRefundsPage = lazy(() => import("./pages/admin/AdminRefundsPage"));
const AdminRevenuePage = lazy(() => import("./pages/admin/AdminRevenuePage"));
const AdminReportsPage = lazy(() => import("./pages/admin/AdminReportsPage"));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage"));
const AdminActivitiesPage = lazy(() => import("./pages/admin/AdminActivitiesPage"));

function ForbiddenFallback() {
  return <div style={{ padding: 24 }}>403 — Forbidden</div>;
}

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#fffaf1",
        color: "#173f2a",
        fontWeight: 800,
      }}
    >
      Loading page...
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationsProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
        {/* Public */}
        <Route path="/" element={<LaunchPage />} />
        <Route path="/landing" element={<Navigate to="/" replace />} />
        <Route path="/about" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/passes/:token" element={<GuestPassPage />} />
        <Route path="/users/:userId" element={<PublicUserProfilePage />} />
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

        <Route
          path="/checkout/:bookingId"
          element={
            <RequireAuth>
              <UntamedCheckoutPage />
            </RequireAuth>
          }
        />

        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <NotificationsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/chat"
          element={
            <RequireAuth>
              <ChatRoomsPage />
            </RequireAuth>
          }
        />

        <Route
          path="/chat/rooms/:roomId"
          element={
            <RequireAuth>
              <ChatRoomPage />
            </RequireAuth>
          }
        />

        <Route
          path="/admin-test"
          element={
            <RequireAuth>
              <RequireRole allow={["ADMIN"]}>
                <AdminTestPage />
              </RequireRole>
            </RequireAuth>
          }
        />

        <Route
          path="/admin"
          element={
            <RequireAuth>
              <RequireRole allow={["ADMIN"]}>
                <AdminLayout />
              </RequireRole>
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="alerts" element={<AdminAlertsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="guides" element={<AdminGuidesPage />} />
          <Route path="activities" element={<AdminActivitiesPage />} />
          <Route path="sessions" element={<AdminSessionsPage />} />
          <Route path="refunds" element={<AdminRefundsPage />} />
          <Route path="revenue" element={<AdminRevenuePage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
        </Route>

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
              <RequireRole allow={["GUIDE"]}>
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
              <RequireRole allow={["GUIDE"]}>
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
              <RequireRole allow={["GUIDE"]}>
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
          <Route path="earnings" element={<GuideEarningsPage />} />
        </Route>

        {/* Errors */}
        <Route path="/403" element={<ForbiddenFallback />} />

        {/* Stripe payment result pages */}
        <Route path="/payment-success" element={<PaymentSuccess />} />
        <Route path="/payment-cancel" element={<PaymentCancel />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/payment/cancel" element={<PaymentCancel />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />









          </Routes>
        </Suspense>
      </NotificationsProvider>
    </AuthProvider>
  );
}
