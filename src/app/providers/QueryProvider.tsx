import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createQueryClient } from 'shared/api/queryClient';

interface QueryProviderProps {
    children: ReactNode;
}

/**
 * One QueryClient without persistence: the landing (and its prerender) and the signed-out app.
 * It imports nothing of the persister, so the landing bundle stays without IndexedDB code.
 */
export const QueryProvider = ({ children }: QueryProviderProps) => {
    const [client] = useState(createQueryClient);

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
