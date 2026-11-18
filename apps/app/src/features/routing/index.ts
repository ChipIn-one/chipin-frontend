// The guards composed by the app router (`app/router/createAppRouter.tsx`). `AppRouter.tsx` is no
// longer mounted; 04-2a4 removes it with the guards' old wiring.
export { default as HomeRouteGuard } from './HomeRouteGuard';
export { ProtectedRoute } from './ProtectedRoute';
export { PublicLocaleRoute } from './PublicLocaleRoute';
export { default as SoloRouteGuard } from './SoloRouteGuard';
