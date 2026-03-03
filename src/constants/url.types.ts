import type { URL_PARAMS } from './url';

export type UrlParams = (typeof URL_PARAMS)[keyof typeof URL_PARAMS];
