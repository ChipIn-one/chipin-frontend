import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { clientFor } from 'shared/offline/restore';

import { QueryProvider } from './QueryProvider';

interface UserQueryProviderProps {
    /** The signed-in user (`LocalUser.id`); without one the client has no persistence. */
    userId?: string;
    children: ReactNode;
}

/**
 * Spec 03 §1.5: no user → the client without persistence; a user → that user's persisted client
 * (`clientFor`: memoized, its restore + save subscription started on first use), keyed by the
 * user so that two users never share a client or a mounted tree.
 */
export const UserQueryProvider = ({ userId, children }: UserQueryProviderProps) => {
    if (!userId) {
        return <QueryProvider>{children}</QueryProvider>;
    }
    return (
        <QueryClientProvider key={userId} client={clientFor(userId)}>
            {children}
        </QueryClientProvider>
    );
};
