import { LucideActivity, LucideUser, LucideUsers } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { Box, Button, TabNav } from '@radix-ui/themes';

import { ROUTES } from 'constants/routes';

const BottomNavMobile = () => {
    const location = useLocation();

    const isActive = (path: string) =>
        location.pathname === path || location.pathname.startsWith(`${path}/`);

    return (
        <Box
            position="fixed"
            bottom="0"
            left="0"
            right="0"
            display={{ initial: 'block', sm: 'none' }}
        >
            <TabNav.Root justify="center">
                <TabNav.Link asChild active={isActive(ROUTES.GROUPS)}>
                    <Link to={ROUTES.GROUPS}>
                        <Button variant="ghost" radius="none">
                            <LucideUsers size={24} /> Groups
                        </Button>
                    </Link>
                </TabNav.Link>

                <TabNav.Link asChild active={isActive(ROUTES.ACTIVITY)}>
                    <Link to={ROUTES.ACTIVITY}>
                        <Button variant="ghost" radius="none">
                            <LucideActivity size={24} /> Activity
                        </Button>
                    </Link>
                </TabNav.Link>

                <TabNav.Link asChild active={isActive(ROUTES.SETTINGS)}>
                    <Link to={ROUTES.SETTINGS}>
                        <Button variant="ghost" radius="none">
                            <LucideUser size={24} /> Account
                        </Button>
                    </Link>
                </TabNav.Link>
            </TabNav.Root>
        </Box>
    );
};

export default BottomNavMobile;
