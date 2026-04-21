import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import PublicLandingPage from "./pages/PublicLandingPage";
import PublicEventPage from "./pages/PublicEventPage";
import DigitalTicketPage from "./pages/DigitalTicketPage";
import GuestInvitationPage from "./pages/GuestInvitationPage";

import AdminLayout from "./pages/admin/AdminLayout";
import DashboardPage from "./pages/admin/DashboardPage";
import GuestListPage from "./pages/admin/GuestListPage";
import ScannerPage from "./pages/admin/ScannerPage";
import AnalyticsPage from "./pages/admin/AnalyticsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import EventsPage from "./pages/admin/EventsPage";
import ScreenPage from "./pages/admin/ScreenPage";
import StaffManagementPage from "./pages/admin/StaffManagementPage";

import CompleteInvitePage from "./pages/CompleteInvitePage";
import MyEventsPage from "./pages/MyEventsPage";
import PostLoginRedirectPage from "./pages/PostLoginRedirectPage";

import LoginPage from "./pages/LoginPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFoundPage from "./pages/NotFoundPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";

import ScannerStandalonePage from "./pages/ScannerStandalonePage";

import RequireAuth from "./auth/RequireAuth";
import RequireRole from "./auth/RequireRole";
import RequireEventAccess from "./auth/RequireEventAccess";

export const router = createBrowserRouter([
  // Public
  { path: "/", element: <PublicLandingPage /> },
  { path: "/event/:slug", element: <PublicEventPage /> },
  { path: "/ticket/:id", element: <DigitalTicketPage /> },
  { path: "/u/:code", element: <GuestInvitationPage /> },

  // Auth
  { path: "/login", element: <LoginPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/reset-password", element: <ResetPasswordPage /> },
  { path: "/forbidden", element: <ForbiddenPage /> },
  { path: "/auth/complete-invite", element: <CompleteInvitePage /> },

  // Login redirect gateway
  {
    path: "/app",
    element: (
      <RequireAuth>
        <PostLoginRedirectPage />
      </RequireAuth>
    ),
  },

  // Multi-event staff selector
  {
    path: "/my-events",
    element: (
      <RequireAuth>
        <RequireRole allow={["staff", "owner"]}>
          <MyEventsPage />
        </RequireRole>
      </RequireAuth>
    ),
  },

  // Screen: owner atau admin event
  {
    path: "/screen/:eventId",
    element: (
      <RequireAuth>
        <RequireRole allow={["owner", "staff"]}>
          <RequireEventAccess allowStaff={["admin"]}>
            <ScreenPage />
          </RequireEventAccess>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // Scanner fullscreen: owner, admin event, atau scanner event
  {
    path: "/scanner/:eventId",
    element: (
      <RequireAuth>
        <RequireRole allow={["owner", "staff"]}>
          <RequireEventAccess allowStaff={["admin", "scanner"]}>
            <ScannerStandalonePage />
          </RequireEventAccess>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // Admin area
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <RequireRole allow={["owner", "staff"]}>
          <AdminLayout />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/app" replace /> },

      // Owner: list semua events
      // Staff: tetap bisa buka page ini kalau RLS mengizinkan, tapi flow utama staff tetap /my-events
      { path: "events", element: <EventsPage /> },

      // Event admin pages
      {
        path: "event/:eventId/dashboard",
        element: (
          <RequireEventAccess allowStaff={["admin"]}>
            <DashboardPage />
          </RequireEventAccess>
        ),
      },
      {
        path: "event/:eventId/guests",
        element: (
          <RequireEventAccess allowStaff={["admin"]}>
            <GuestListPage />
          </RequireEventAccess>
        ),
      },
      {
        path: "event/:eventId/scanner",
        element: (
          <RequireEventAccess allowStaff={["admin"]}>
            <ScannerPage />
          </RequireEventAccess>
        ),
      },
      {
        path: "event/:eventId/analytics",
        element: (
          <RequireEventAccess allowStaff={["admin"]}>
            <AnalyticsPage />
          </RequireEventAccess>
        ),
      },
      {
        path: "event/:eventId/staff",
        element: (
          <RequireEventAccess allowStaff={["admin"]}>
            <StaffManagementPage />
          </RequireEventAccess>
        ),
      },

      // Event settings: owner only
      {
        path: "event/:eventId/settings",
        element: (
          <RequireRole allow={["owner"]}>
            <SettingsPage />
          </RequireRole>
        ),
      },
    ],
  },

  { path: "*", element: <NotFoundPage /> },
]);