import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import DeliveryPage from '../../src/pages/DeliveryPage';
import RiderPickupPhotoQrPortal from '../../src/pages/RiderPickupPhotoQrPortal';
import { useAppState } from '../../src/hooks/useAppState';
useAppState.getState().setLanguage('en');
createRoot(document.getElementById('root')!).render(<MemoryRouter>{new URLSearchParams(location.search).get('screen') === 'delivery' ? <DeliveryPage /> : <RiderPickupPhotoQrPortal />}</MemoryRouter>);
