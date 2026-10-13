import { useTranslation } from 'react-i18next';

import { Box, Button, Flex, Link } from '@radix-ui/themes';

import LanguageSelector from 'components/LanguageSelector';

import { LANDING_NAV_LINKS } from './internal/constants';
import type { LandingLanguageProps } from './internal/types';

const LandingNav = ({ value, onChange }: LandingLanguageProps) => {
    const { t } = useTranslation('landing');

    return (
        <Box display={{ initial: 'none', md: 'block' }}>
            <Flex align="center" gap="6">
                {LANDING_NAV_LINKS.map(({ labelKey, href }) => (
                    <Button key={href} variant="ghost" color="gray" size="3" asChild>
                        <Link href={href} color="gray" underline="none">
                            {t(labelKey)}
                        </Link>
                    </Button>
                ))}
                <LanguageSelector value={value} variant="compact" onChange={onChange} />
            </Flex>
        </Box>
    );
};

export { LandingNav };
