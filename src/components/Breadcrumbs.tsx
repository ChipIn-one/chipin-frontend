import { LucideChevronLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Box, Flex, IconButton, Text } from '@radix-ui/themes';

import { BREADCRUMBS } from 'constants/routes';

const Breadcrumbs = () => {
    const location = useLocation();
    const navigate = useNavigate();

    const { title, description } = BREADCRUMBS[location.pathname] || {
        title: 'No title',
        description: `Specify title for ${location.pathname}`,
    };

    return (
        <Box mb="6">
            <Flex align="center" gap="3" px="2">
                <IconButton variant="ghost" onClick={() => navigate(-1)} aria-label="Go back">
                    <LucideChevronLeft size={24} />
                </IconButton>
                <Flex direction="column" gap="1">
                    <Text size="6" weight="bold">
                        {title}
                    </Text>
                    <Text size="2" color="gray">
                        {description}
                    </Text>
                </Flex>
            </Flex>
        </Box>
    );
};

export default Breadcrumbs;
