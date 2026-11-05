import { Box, Flex, Skeleton } from '@radix-ui/themes';
import type { ReactNode } from 'react';

import { useRestoreReady } from 'shared/offline/restore';

interface RestoreGateProps {
    children: ReactNode;
}

/** Spec 03 §1.6: until the user's cache is restored (≤ 3 s), a skeleton instead of the routes. */
export const RestoreGate = ({ children }: RestoreGateProps) => {
    const ready = useRestoreReady();

    if (ready) {
        return children;
    }
    return (
        <Box px="4" py="4" aria-busy="true" data-testid="restore-skeleton">
            <Flex direction="column" gap="3">
                <Skeleton height="32px" width="40%" />
                <Skeleton height="96px" />
                <Skeleton height="96px" />
            </Flex>
        </Box>
    );
};
