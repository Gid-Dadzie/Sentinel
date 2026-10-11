import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { API_MODE } from './api/client';
import Layout from './components/Layout';
import RequireRole from './components/RequireRole';
import NotFound from './pages/NotFound';

// Pages load on demand so each one ships only what it needs.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Investigation = lazy(() => import('./pages/Investigation'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const Rules = lazy(() => import('./pages/Rules'));
const Import = lazy(() => import('./pages/Import'));
const AuditLog = lazy(() => import('./pages/AuditLog'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tx/:id" element={<Investigation />} />
        <Route path="customer/:accountId" element={<CustomerProfile />} />
        <Route path="rules" element={<Rules />} />
        {API_MODE && (
          <>
            <Route
              path="import"
              element={
                <RequireRole role="admin">
                  <Import />
                </RequireRole>
              }
            />
            <Route
              path="audit"
              element={
                <RequireRole role="admin">
                  <AuditLog />
                </RequireRole>
              }
            />
          </>
        )}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
