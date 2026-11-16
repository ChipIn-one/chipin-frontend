// The configured Axios instance and its interceptors (spec 03 §5.2). They stay in `src/api/`,
// which the legacy modules still use unchanged; `api()` reaches them only through this file.
export { apiInstance, publicApiInstance } from 'api/chipin.instance';
export { initChipInApiInterceptors } from 'api/chipin.interceptors';
