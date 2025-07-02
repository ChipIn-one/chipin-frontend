// const apiChipInInstance = axios.create({
//     baseURL: getChipInApiUrl(),
//     headers: {
//         Accept: 'application/json',
//         'Content-Type': 'application/json',
//     },
// });

// export const fetchAllFiats = (): Promise<FiatCurrency[]> => {
//     return apiInstanceDisco.get(`/market/widget/v1/currency/`).then(result => result.data);
// };

// export const fetchFiatsForRegion = ({
//     regionId,
//     excludeFiats,
//     includeFiats,
// }: {
//     regionId: number;
//     excludeFiats?: string;
//     includeFiats?: string;
// }): Promise<FiatCurrency[]> => {
//     // exclude_currency
//     return apiInstanceDisco
//         .get(`/service-integration/regions/${regionId}/currencies/`, {
//             params: {
//                 ...(excludeFiats && { exclude_currency: excludeFiats }),
//                 ...(includeFiats && { include_currency: includeFiats }),
//             },
//         })
//         .then(result => result.data);
// };

// authService.js
// class AuthService {
//     constructor() {
//         this.API_BASE = 'https://api-dev.chipin.one';
//         this.token = localStorage.getItem('authToken');
//     }

//     // Initiate OAuth login
//     loginWithProvider(provider = 'google') {
//         window.location.href = `${this.API_BASE}/oauth2/authorization/${provider}`;
//     }

//     // Handle OAuth callback
//     handleOAuthCallback() {
//         const urlParams = new URLSearchParams(window.location.search);
//         const token = urlParams.get('token');
//         const error = urlParams.get('error');

//         if (token) {
//             this.setToken(token);
//             window.history.replaceState({}, '', window.location.pathname);
//             return { success: true, token };
//         } else if (error) {
//             return { success: false, error: decodeURIComponent(error) };
//         }

//         return null;
//     }

//     // Store token
//     setToken(token) {
//         this.token = token;
//         localStorage.setItem('authToken', token);
//     }

//     // Check if authenticated
//     isAuthenticated() {
//         const token = this.getToken();
//         if (!token) return false;

//         try {
//             const payload = JSON.parse(atob(token.split('.')[1]));
//             return payload.exp * 1000 > Date.now();
//         } catch {
//             return false;
//         }
//     }

//     // Make authenticated API calls
//     async apiCall(endpoint, options = {}) {
//         const token = this.getToken();
//         if (!token) {
//             throw new Error('No authentication token');
//         }

//         const config = {
//             ...options,
//             headers: {
//                 'Content-Type': 'application/json',
//                 Authorization: `Bearer ${token}`,
//                 ...options.headers,
//             },
//         };

//         const response = await fetch(`${this.API_BASE}${endpoint}`, config);

//         if (response.status === 401) {
//             this.logout();
//             throw new Error('Session expired');
//         }

//         return response.json();
//     }

//     // Get current user
//     async getCurrentUser() {
//         return this.apiCall('/auth/user');
//     }

//     // Logout
//     logout() {
//         this.token = null;
//         localStorage.removeItem('authToken');
//     }

//     getToken() {
//         return this.token || localStorage.getItem('authToken');
//     }
// }

// export default new AuthService();
