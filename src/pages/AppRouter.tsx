import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { ROUTES } from 'constants/routes';

import HomePage from './HomePage';
import Page404 from './Page404';

export const AppRouter = () => (
    <BrowserRouter>
        <Routes>
            <Route path={ROUTES.HOME} element={<HomePage />} />
            <Route path={ROUTES.NOT_FOUND_404} element={<Page404 />} />
            {/* 404 fallback */}
            <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND_404} />} />
        </Routes>
    </BrowserRouter>
);
