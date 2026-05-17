import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import PickupDeliveryMobileForm from '@/components/shared/PickupDeliveryMobileForm';
export default function DriverPickupDeliveryFormPage() {
  const [profileOpen, setProfileOpen] = useState(false);
  return (<><AppShell role="driver" onOpenProfile={() => setProfileOpen(true)}><PickupDeliveryMobileForm sourcePortal="driver" /></AppShell><ProfileDrawer open={profileOpen} onClose={() => setProfileOpen(false)} /></>);
}
