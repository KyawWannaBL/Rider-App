import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ProfileDrawer } from '@/components/ProfileDrawer';
import PickupDeliveryMobileForm from '@/components/shared/PickupDeliveryMobileForm';
export default function HelperPickupDeliveryFormPage() {
  const [o, setO] = useState(false);
  return (<><AppShell role="helper" onOpenProfile={() => setO(true)}><PickupDeliveryMobileForm sourcePortal="helper" /></AppShell><ProfileDrawer open={o} onClose={() => setO(false)} /></>);
}
