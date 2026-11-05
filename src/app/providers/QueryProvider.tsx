import { useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { createQueryClient } from 'shared/api/queryClient';

interface QueryProviderProps {
    children: ReactNode;
}

/** One QueryClient per app instance, without persistence (spec 03 §1.5: per-user in 03-7b). */
export const QueryProvider = ({ children }: QueryProviderProps) => {
    const [client] = useState(createQueryClient);

    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};
