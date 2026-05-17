import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { ROUTE_PATHS } from '@/lib/index';

import LoginPage from '@/pages/LoginPage';
import PendingApprovalPage from '@/pages/PendingApprovalPage';
import AdminPage from '@/pages/AdminPage';

// Rider
import RiderHomePage from '@/pages/RiderHomePage';
import RiderJobsPage from '@/pages/RiderJobsPage';
import RiderRoutePage from '@/pages/RiderRoutePage';
import RiderProofPage from '@/pages/RiderProofPage';
import RiderCodPage from '@/pages/RiderCodPage';
import RiderEarningsPage from '@/pages/RiderEarningsPage';
import RiderSyncPage from '@/pages/RiderSyncPage';
import RiderSupportPage from '@/pages/RiderSupportPage';
import RiderPickupVerificationPage from '@/pages/RiderPickupVerificationPage';
import RiderPickupDeliveryFormPage from '@/pages/RiderPickupDeliveryFormPage';

// Driver
import DriverHomePage from '@/pages/DriverHomePage';
import DriverJobsPage from '@/pages/DriverJobsPage';
import DriverRoutePage from '@/pages/DriverRoutePage';
import DriverProofPage from '@/pages/DriverProofPage';
import DriverCodPage from '@/pages/DriverCodPage';
import DriverEarningsPage from '@/pages/DriverEarningsPage';
import DriverSyncPage from '@/pages/DriverSyncPage';
import DriverSupportPage from '@/pages/DriverSupportPage';
import DriverPickupVerificationPage from '@/pages/DriverPickupVerificationPage';
import DriverPickupDeliveryFormPage from '@/pages/DriverPickupDeliveryFormPage';

// Helper
import HelperHomePage from '@/pages/HelperHomePage';
import HelperJobsPage from '@/pages/HelperJobsPage';
import HelperRoutePage from '@/pages/HelperRoutePage';
import HelperProofPage from '@/pages/HelperProofPage';
import HelperCodPage from '@/pages/HelperCodPage';
import HelperEarningsPage from '@/pages/HelperEarningsPage';
import HelperSyncPage from '@/pages/HelperSyncPage';
import HelperSupportPage from '@/pages/HelperSupportPage';
import HelperPickupVerificationPage from '@/pages/HelperPickupVerificationPage';
import HelperPickupDeliveryFormPage from '@/pages/HelperPickupDeliveryFormPage';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Auth */}
        <Route path={ROUTE_PATHS.LOGIN}   element={<LoginPage />} />
        <Route path={ROUTE_PATHS.PENDING} element={<PendingApprovalPage />} />
        <Route path={ROUTE_PATHS.ADMIN}   element={<AdminPage />} />

        {/* ── Rider ── */}
        <Route path={ROUTE_PATHS.RIDER}              element={<RiderHomePage />} />
        <Route path={ROUTE_PATHS.RIDER_JOBS}         element={<RiderJobsPage />} />
        <Route path={ROUTE_PATHS.RIDER_ROUTE}        element={<RiderRoutePage />} />
        <Route path={ROUTE_PATHS.RIDER_PROOF}        element={<RiderProofPage />} />
        <Route path={ROUTE_PATHS.RIDER_COD}          element={<RiderCodPage />} />
        <Route path={ROUTE_PATHS.RIDER_EARNINGS}     element={<RiderEarningsPage />} />
        <Route path={ROUTE_PATHS.RIDER_SYNC}         element={<RiderSyncPage />} />
        <Route path={ROUTE_PATHS.RIDER_SUPPORT}      element={<RiderSupportPage />} />
        <Route path={ROUTE_PATHS.RIDER_PICKUP}       element={<RiderPickupVerificationPage />} />
        <Route path={ROUTE_PATHS.RIDER_PICKUP_FORM}  element={<RiderPickupDeliveryFormPage />} />

        {/* ── Driver ── */}
        <Route path={ROUTE_PATHS.DRIVER}              element={<DriverHomePage />} />
        <Route path={ROUTE_PATHS.DRIVER_JOBS}         element={<DriverJobsPage />} />
        <Route path={ROUTE_PATHS.DRIVER_ROUTE}        element={<DriverRoutePage />} />
        <Route path={ROUTE_PATHS.DRIVER_PROOF}        element={<DriverProofPage />} />
        <Route path={ROUTE_PATHS.DRIVER_COD}          element={<DriverCodPage />} />
        <Route path={ROUTE_PATHS.DRIVER_EARNINGS}     element={<DriverEarningsPage />} />
        <Route path={ROUTE_PATHS.DRIVER_SYNC}         element={<DriverSyncPage />} />
        <Route path={ROUTE_PATHS.DRIVER_SUPPORT}      element={<DriverSupportPage />} />
        <Route path={ROUTE_PATHS.DRIVER_PICKUP}       element={<DriverPickupVerificationPage />} />
        <Route path={ROUTE_PATHS.DRIVER_PICKUP_FORM}  element={<DriverPickupDeliveryFormPage />} />

        {/* ── Helper ── */}
        <Route path={ROUTE_PATHS.HELPER}              element={<HelperHomePage />} />
        <Route path={ROUTE_PATHS.HELPER_JOBS}         element={<HelperJobsPage />} />
        <Route path={ROUTE_PATHS.HELPER_ROUTE}        element={<HelperRoutePage />} />
        <Route path={ROUTE_PATHS.HELPER_PROOF}        element={<HelperProofPage />} />
        <Route path={ROUTE_PATHS.HELPER_COD}          element={<HelperCodPage />} />
        <Route path={ROUTE_PATHS.HELPER_EARNINGS}     element={<HelperEarningsPage />} />
        <Route path={ROUTE_PATHS.HELPER_SYNC}         element={<HelperSyncPage />} />
        <Route path={ROUTE_PATHS.HELPER_SUPPORT}      element={<HelperSupportPage />} />
        <Route path={ROUTE_PATHS.HELPER_PICKUP}       element={<HelperPickupVerificationPage />} />
        <Route path={ROUTE_PATHS.HELPER_PICKUP_FORM}  element={<HelperPickupDeliveryFormPage />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROUTE_PATHS.LOGIN} replace />} />
      </Routes>
      <Toaster />
    </HashRouter>
  );
}
