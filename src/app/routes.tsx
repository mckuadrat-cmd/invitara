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

import LoginPage from "./pages/LoginPage";
import ForbiddenPage from "./pages/ForbiddenPage";
import NotFoundPage from "./pages/NotFoundPage";

import ScannerStandalonePage from "./pages/ScannerStandalonePage";

import RequireAuth from "./auth/RequireAuth";
import RequireRole from "./auth/RequireRole";
import RequireEventAccess from "./auth/RequireEventAccess";

import PostLoginRedirectPage from "./pages/PostLoginRedirectPage";

export const router = createBrowserRouter([
  // Public
  { path: "/", element: <PublicLandingPage /> },
  { path: "/event/:slug", element: <PublicEventPage /> },
  { path: "/ticket/:id", element: <DigitalTicketPage /> },
  { path: "/u/:code", element: <GuestInvitationPage /> },

  // Auth
  { path: "/login", element: <LoginPage /> },
  { path: "/forbidden", element: <ForbiddenPage /> },

  // After login redirect gateway
  {
    path: "/app",
    element: (
      <RequireAuth>
        <PostLoginRedirectPage />
      </RequireAuth>
    ),
  },

  // Screen (owner + per-event admin)
  {
    path: "/screen/:eventId",
    element: (
      <RequireAuth>
        <RequireRole allow={["owner", "admin"]}>
          <RequireEventAccess allowStaff={["admin"]}>
            <ScreenPage />
          </RequireEventAccess>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // Scanner fullscreen tanpa sidebar (owner + per-event admin + per-event scanner)
  {
    path: "/scanner/:eventId",
    element: (
      <RequireAuth>
        <RequireRole allow={["owner", "admin", "scanner"]}>
          <RequireEventAccess allowStaff={["admin", "scanner"]}>
            <ScannerStandalonePage />
          </RequireEventAccess>
        </RequireRole>
      </RequireAuth>
    ),
  },

  // Admin area (sidebar layout) - owner + admin (scanner gak boleh masuk)
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <RequireRole allow={["owner", "admin"]}>
          <AdminLayout />
        </RequireRole>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/admin/events" replace /> },

      // LIST EVENTS:
      // - owner: lihat semua + create event
      // - admin: tetap boleh lihat "events yg dia terdaftar" (karena RLS), tapi di UI kita sembunyiin menu & tombol create
      { path: "events", element: <EventsPage /> },

      // Per-event pages (owner bypass staff check, admin harus terdaftar sebagai admin)
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

      // SETTINGS khusus owner
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