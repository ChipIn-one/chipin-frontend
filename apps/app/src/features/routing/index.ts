// The guards composed by the app router (`app/router/createAppRouter.tsx`). `AppRouter.tsx`,
// `ProtectedRoute` and `SoloRouteGuard` are no longer mounted (replaced by `AuthLayout` and
// `SoloGuardLayout`); 04-2a4 removes them with the guards' old wiring.
export { default as HomeRouteGuard } from './HomeRouteGuard';
export { GuardLoader } from './internal';
export { ProtectedRoute } from './ProtectedRoute';
export { PublicLocaleRoute } from './PublicLocaleRoute';
export { default as SoloRouteGuard } from './SoloRouteGuard';
