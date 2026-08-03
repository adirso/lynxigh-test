import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './auth/ProtectedRoute';
import SignupPage from './pages/SignupPage';
import LoginPage from './pages/LoginPage';
import CatalogPage from './pages/CatalogPage';
import ItemDetailPage from './pages/ItemDetailPage';
import NewListingPage from './pages/NewListingPage';

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route element={<Layout />}>
          <Route path="/" element={<CatalogPage />} />
          <Route path="/items/:id" element={<ItemDetailPage />} />
          <Route element={<ProtectedRoute role="CONTRIBUTOR" />}>
            <Route path="/listings/new" element={<NewListingPage />} />
          </Route>
          <Route element={<ProtectedRoute role="MODERATOR" />}>{/* moderator routes added in later tasks */}</Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
