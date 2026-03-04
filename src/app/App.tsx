import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';

/**
 * EventPro Digital Invitation System
 * 
 * A modern, professional event digital invitation website and admin dashboard.
 * 
 * Features:
 * - Public Event Website (/)
 *   - Hero section with event information
 *   - About, Agenda, Speakers, Location, FAQ sections
 *   - RSVP modal with form validation
 *   - Success confirmation screen
 * 
 * - Digital Ticket Page (/ticket/:id)
 *   - Guest information display
 *   - QR code for check-in
 *   - Event details
 *   - Status badges (Confirmed/Checked-in)
 *   - Mobile-optimized design
 * 
 * - Admin Dashboard (/admin)
 *   - Overview with real-time statistics
 *   - Activity feed
 *   - Quick actions
 * 
 * - Guest List (/admin/guests)
 *   - Search and filter functionality
 *   - Guest table with status
 *   - CSV export
 * 
 * - Scanner (/admin/scanner)
 *   - QR code scanning interface
 *   - Manual code entry
 *   - Success/error states
 * 
 * - Analytics (/admin/analytics)
 *   - Charts (hourly check-ins, attendance distribution)
 *   - Key metrics
 *   - Top organizations
 * 
 * - Settings (/admin/settings)
 *   - Event configuration
 *   - Email template preview
 *   - QR code settings
 *   - Badge customization
 * 
 * Design System:
 * - Primary: Deep Navy #0F1C2E
 * - Accent: Gold #D6C6A5
 * - Secondary: Soft Gray #F5F7FA
 * - Success: Green #22C55E
 * - Warning: Orange #F59E0B
 * - Danger: Red #EF4444
 * - Typography: Inter font family
 * - Glassmorphism effects
 * - Responsive design (Desktop + Mobile)
 */
export default function App() {
  return (
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>
  );
}