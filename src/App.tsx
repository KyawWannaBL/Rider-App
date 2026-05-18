import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { ROUTE_PATHS } from "@/lib/index";

import LoginPage from "@/pages/LoginPage";
import PendingApprovalPage from "@/pages/PendingApprovalPage";
import AdminPage from "@/pages/AdminPage";

// Rider
import RiderHomePage from "@/pages/RiderHomePage";
import RiderJobsPage from "@/pages/RiderJobsPage";
import RiderRoutePage from "@/pages/RiderRoutePage";
import RiderProofPage from "@/pages/RiderProofPage";
import RiderCodPage from "@/pages/RiderCodPage";
import RiderEarningsPage from "@/pages/RiderEarningsPage";
import RiderSyncPage from "@/pages/RiderSyncPage";
import RiderSupportPage from "@/pages/RiderSupportPage";
import RiderPickupVerificationPage from "@/pages/RiderPickupVerificationPage";
import RiderPickupDeliveryFormPage from "@/pages/RiderPickupDeliveryFormPage";

// Driver
import DriverHomePage from "@/pages/DriverHomePage";
import DriverJobsPage from "@/pages/DriverJobsPage";
import DriverRoutePage from "@/pages/DriverRoutePage";
import DriverProofPage from "@/pages/DriverProofPage";
import DriverCodPage from "@/pages/DriverCodPage";
import DriverEarningsPage from "@/pages/DriverEarningsPage";
import DriverSyncPage from "@/pages/DriverSyncPage";
import DriverSupportPage from "@/pages/DriverSupportPage";
import DriverPickupVerificationPage from "@/pages/DriverPickupVerificationPage";
import DriverPickupDeliveryFormPage from "@/pages/DriverPickupDeliveryFormPage";

// Helper
import HelperHomePage from "@/pages/HelperHomePage";
import HelperJobsPage from "@/pages/HelperJobsPage";
import HelperRoutePage from "@/pages/HelperRoutePage";
import HelperProofPage from "@/pages/HelperProofPage";
import HelperCodPage from "@/pages/HelperCodPage";
import HelperEarningsPage from "@/pages/HelperEarningsPage";
import HelperSyncPage from "@/pages/HelperSyncPage";
import HelperSupportPage from "@/pages/HelperSupportPage";
import HelperPickupVerificationPage from "@/pages/HelperPickupVerificationPage";
import HelperPickupDeliveryFormPage from "@/pages/HelperPickupDeliveryFormPage";

const routePath = (key: string, fallback: string) =>
  ((ROUTE_PATHS as Record<string, string | undefined>)[key] || fallback);

const R = {
  LOGIN: routePath("LOGIN", "/login"),
  PENDING: routePath("PENDING", "/pending"),
  ADMIN: routePath("ADMIN", "/admin"),

  RIDER: routePath("RIDER", "/rider"),
  RIDER_JOBS: routePath("RIDER_JOBS", "/rider/jobs"),
  RIDER_ROUTE: routePath("RIDER_ROUTE", "/rider/route"),
  RIDER_PROOF: routePath("RIDER_PROOF", "/rider/proof"),
  RIDER_COD: routePath("RIDER_COD", "/rider/cod"),
  RIDER_EARNINGS: routePath("RIDER_EARNINGS", "/rider/earnings"),
  RIDER_SYNC: routePath("RIDER_SYNC", "/rider/sync"),
  RIDER_SUPPORT: routePath("RIDER_SUPPORT", "/rider/support"),
  RIDER_PICKUP: routePath("RIDER_PICKUP", "/rider/pickup"),
  RIDER_PICKUP_FORM: routePath("RIDER_PICKUP_FORM", "/rider/pickup-form"),

  DRIVER: routePath("DRIVER", "/driver"),
  DRIVER_JOBS: routePath("DRIVER_JOBS", "/driver/jobs"),
  DRIVER_ROUTE: routePath("DRIVER_ROUTE", "/driver/route"),
  DRIVER_PROOF: routePath("DRIVER_PROOF", "/driver/proof"),
  DRIVER_COD: routePath("DRIVER_COD", "/driver/cod"),
  DRIVER_EARNINGS: routePath("DRIVER_EARNINGS", "/driver/earnings"),
  DRIVER_SYNC: routePath("DRIVER_SYNC", "/driver/sync"),
  DRIVER_SUPPORT: routePath("DRIVER_SUPPORT", "/driver/support"),
  DRIVER_PICKUP: routePath("DRIVER_PICKUP", "/driver/pickup"),
  DRIVER_PICKUP_FORM: routePath("DRIVER_PICKUP_FORM", "/driver/pickup-form"),

  HELPER: routePath("HELPER", "/helper"),
  HELPER_JOBS: routePath("HELPER_JOBS", "/helper/jobs"),
  HELPER_ROUTE: routePath("HELPER_ROUTE", "/helper/route"),
  HELPER_PROOF: routePath("HELPER_PROOF", "/helper/proof"),
  HELPER_COD: routePath("HELPER_COD", "/helper/cod"),
  HELPER_EARNINGS: routePath("HELPER_EARNINGS", "/helper/earnings"),
  HELPER_SYNC: routePath("HELPER_SYNC", "/helper/sync"),
  HELPER_SUPPORT: routePath("HELPER_SUPPORT", "/helper/support"),
  HELPER_PICKUP: routePath("HELPER_PICKUP", "/helper/pickup"),
  HELPER_PICKUP_FORM: routePath("HELPER_PICKUP_FORM", "/helper/pickup-form"),
};

export default function App() {
  return (
    <HashRouter>
      <Routes>
        {/* Auth */}
        <Route path="/" element={<Navigate to={R.LOGIN} replace />} />
        <Route path={R.LOGIN} element={<LoginPage />} />
        <Route path={R.PENDING} element={<PendingApprovalPage />} />
        <Route path={R.ADMIN} element={<AdminPage />} />

        {/* Rider go-live app */}
        <Route path={R.RIDER} element={<RiderHomePage />} />
        <Route path={R.RIDER_JOBS} element={<RiderJobsPage />} />
        <Route path={R.RIDER_ROUTE} element={<RiderRoutePage />} />
        <Route path={R.RIDER_PROOF} element={<RiderProofPage />} />
        <Route path={R.RIDER_COD} element={<RiderCodPage />} />
        <Route path={R.RIDER_EARNINGS} element={<RiderEarningsPage />} />
        <Route path={R.RIDER_SYNC} element={<RiderSyncPage />} />
        <Route path={R.RIDER_SUPPORT} element={<RiderSupportPage />} />
        <Route path={R.RIDER_PICKUP} element={<RiderPickupVerificationPage />} />
        <Route path={R.RIDER_PICKUP_FORM} element={<RiderPickupDeliveryFormPage />} />

        {/* Rider legacy aliases */}
        <Route path="/rider/dashboard" element={<Navigate to={R.RIDER} replace />} />
        <Route path="/rider/home" element={<Navigate to={R.RIDER} replace />} />
        <Route path="/rider/pickup-verification" element={<Navigate to={R.RIDER_PICKUP} replace />} />
        <Route path="/rider/pickup-delivery-form" element={<Navigate to={R.RIDER_PICKUP_FORM} replace />} />

        {/* Driver go-live app */}
        <Route path={R.DRIVER} element={<DriverHomePage />} />
        <Route path={R.DRIVER_JOBS} element={<DriverJobsPage />} />
        <Route path={R.DRIVER_ROUTE} element={<DriverRoutePage />} />
        <Route path={R.DRIVER_PROOF} element={<DriverProofPage />} />
        <Route path={R.DRIVER_COD} element={<DriverCodPage />} />
        <Route path={R.DRIVER_EARNINGS} element={<DriverEarningsPage />} />
        <Route path={R.DRIVER_SYNC} element={<DriverSyncPage />} />
        <Route path={R.DRIVER_SUPPORT} element={<DriverSupportPage />} />
        <Route path={R.DRIVER_PICKUP} element={<DriverPickupVerificationPage />} />
        <Route path={R.DRIVER_PICKUP_FORM} element={<DriverPickupDeliveryFormPage />} />

        {/* Driver legacy aliases */}
        <Route path="/driver/dashboard" element={<Navigate to={R.DRIVER} replace />} />
        <Route path="/driver/home" element={<Navigate to={R.DRIVER} replace />} />
        <Route path="/driver/pickup-verification" element={<Navigate to={R.DRIVER_PICKUP} replace />} />
        <Route path="/driver/pickup-delivery-form" element={<Navigate to={R.DRIVER_PICKUP_FORM} replace />} />

        {/* Helper go-live app */}
        <Route path={R.HELPER} element={<HelperHomePage />} />
        <Route path={R.HELPER_JOBS} element={<HelperJobsPage />} />
        <Route path={R.HELPER_ROUTE} element={<HelperRoutePage />} />
        <Route path={R.HELPER_PROOF} element={<HelperProofPage />} />
        <Route path={R.HELPER_COD} element={<HelperCodPage />} />
        <Route path={R.HELPER_EARNINGS} element={<HelperEarningsPage />} />
        <Route path={R.HELPER_SYNC} element={<HelperSyncPage />} />
        <Route path={R.HELPER_SUPPORT} element={<HelperSupportPage />} />
        <Route path={R.HELPER_PICKUP} element={<HelperPickupVerificationPage />} />
        <Route path={R.HELPER_PICKUP_FORM} element={<HelperPickupDeliveryFormPage />} />

        {/* Helper legacy aliases */}
        <Route path="/helper/dashboard" element={<Navigate to={R.HELPER} replace />} />
        <Route path="/helper/home" element={<Navigate to={R.HELPER} replace />} />
        <Route path="/helper/pickup-verification" element={<Navigate to={R.HELPER_PICKUP} replace />} />
        <Route path="/helper/pickup-delivery-form" element={<Navigate to={R.HELPER_PICKUP_FORM} replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to={R.LOGIN} replace />} />
      </Routes>

      <Toaster richColors position="top-center" />
    </HashRouter>
  );
}
