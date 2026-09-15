import { useCallback } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppNavigationHandler } from '@/os/hooks/useAppNavigationHandler';
import { manifest } from './manifest';
import { useScrollLabGestures } from './hooks/useScrollLabGestures';
import { ScrollLabListPage } from './pages/ScrollLabListPage';
import { ScrollLabDetailPage } from './pages/ScrollLabDetailPage';

function ScrollLabNavigationHandler() {
  const location = useLocation();
  const { back } = useScrollLabGestures();

  const handleBackPress = useCallback((): boolean => {
    if (location.pathname === '/') return false;
    back();
    return true;
  }, [back, location.pathname]);

  useAppNavigationHandler(manifest.id, { onBack: handleBackPress });
  return null;
}

function ScrollLabRoutes() {
  return (
    <>
      <ScrollLabNavigationHandler />
      <Routes>
        <Route path="/" element={<ScrollLabListPage />} />
        <Route path="/item/:itemId" element={<ScrollLabDetailPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function ScrollLabApp() {
  return (
    <MemoryRouter>
      <ScrollLabRoutes />
    </MemoryRouter>
  );
}
