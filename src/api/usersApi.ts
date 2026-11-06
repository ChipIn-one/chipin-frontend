import { apiInstance } from './chipin.instance';
import type { ApiSelfUserResponse } from './chipin.raw.types';

const fetchUser = (signal?: AbortSignal): Promise<ApiSelfUserResponse> => {
    return apiInstance
        .get<ApiSelfUserResponse>('/users/self', { signal })
        .then(response => response.data);
};

export { fetchUser };
