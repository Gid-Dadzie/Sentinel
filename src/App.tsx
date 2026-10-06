import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import NotFound from './pages/NotFound';

// Pages load on demand so the charting library only ships with the dashboard.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Investigation = lazy(() => import('./pages/Investigation'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const Rules = lazy(() => import('./pages/Rules'));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="tx/:id" element={<Investigation />} />
        <Route path="customer/:accountId" element={<CustomerProfile />} />
        <Route path="rules" element={<Rules />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
