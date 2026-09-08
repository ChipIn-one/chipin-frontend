import { LucideChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink, useLocation } from 'react-router-dom';

import { Box, Flex, IconButton, Text } from '@radix-ui/themes';

import { getBreadcrumbParentPath } from 'helpers/routes';

interface Props {
    title: ReactNode;
    subtitle?: ReactNode;
    action?: ReactNode;
}

const PageBreadcrumb = ({ title, subtitle, action }: Props) => {
    const { t } = useTranslation('common');
    const { pathname } = useLocation();
    const parentPath = getBreadcrumbParentPath(pathname);

    if (!parentPath) {
        return null;
    }

    return (
        <Flex align="center" gap="2" width="100%" minWidth="0">
            <Box flexShrink="0">
                <IconButton
                    asChild
                    variant="soft"
                    color="gray"
                    size="2"
                    aria-label={t('buttons.back')}
                >
                    <RouterLink to={parentPath}>
                        <LucideChevronLeft size={18} />
                    </RouterLink>
                </IconButton>
            </Box>

            <Flex direction="column" flexGrow="1" minWidth="0">
                <Text size="3" weight="medium" truncate>
                    {title}
                </Text>
                {subtitle !== undefined && subtitle !== null ? (
                    <Text size="2" color="gray" truncate>
                        {subtitle}
                    </Text>
                ) : null}
            </Flex>

            {action !== undefined && action !== null ? (
                <Box flexShrink="0">{action}</Box>
            ) : null}
        </Flex>
    );
};

export { PageBreadcrumb };
