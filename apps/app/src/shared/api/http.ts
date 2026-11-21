// The configured Axios instance and its interceptors (spec 03 §5.2); `api()` reaches them only
// through this file. The legacy `src/api/*` modules reach the same instances through their
// re-exports in `src/api/`.
export { apiInstance, publicApiInstance } from './instance';
export {
    type ApiAuthSession,
    AuthRequestCancelledError,
    EXPECTED_TOKEN_SUBJECT_CONFIG_KEY,
    initChipInApiInterceptors,
} from './interceptors';
