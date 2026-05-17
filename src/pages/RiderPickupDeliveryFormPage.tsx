import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import PickupDeliveryMobileForm from '@/components/shared/PickupDeliveryMobileForm';
export default function RiderPickupDeliveryFormPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="rider" onOpenProfile={() => setProfileOpen(true)}><PickupDeliveryMobileForm sourcePortal="rider" /></AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
