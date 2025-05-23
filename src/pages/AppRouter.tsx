import { ROUTES } from 'constants/routes';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import HomePage from './HomePage';
import LoginPage from './LoginPage';

export const AppRouter = () => (
    <BrowserRouter>
        <Routes>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.LOG_IN} element={<LoginPage />} />
            {/* 404 fallback */}
            <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} />} />
        </Routes>
    </BrowserRouter>
);
