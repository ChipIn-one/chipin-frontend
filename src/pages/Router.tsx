import { ROUTES } from 'constants/routes';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import HomePage from './HomePage';

export const AppRouter = () => (
    <BrowserRouter>
        <Routes>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            {/* 404 fallback */}
            <Route path="*" element={<Navigate to={ROUTES.HOME} />} />
        </Routes>
    </BrowserRouter>
);
