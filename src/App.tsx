import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Investigation from './pages/Investigation';
import CustomerProfile from './pages/CustomerProfile';
import Rules from './pages/Rules';
import NotFound from './pages/NotFound';

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
