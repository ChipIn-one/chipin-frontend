import type { SupportedLocale } from 'constants/locales';
import type { PUBLIC_PAGES, PUBLIC_ROUTE_ENTRIES } from 'constants/publicRouteManifest';

type PublicPage = (typeof PUBLIC_PAGES)[number]['id'];
type PublicLocale = SupportedLocale;
type PublicRoute = (typeof PUBLIC_ROUTE_ENTRIES)[number];

export type { PublicLocale, PublicPage, PublicRoute };
