import Logotype from '@chipin/tokens/assets/logo.svg?react';
import { PROP_COLOR } from '@chipin/tokens/theme';
import { Badge, Box, Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { PROJECT_NAME } from 'constants/chipin';

import styles from './ModeLogotype.module.css';

interface Props {
    isSoloMode: boolean;
    isModeBadgeVisible?: boolean;
}

const ModeLogotype = ({ isSoloMode, isModeBadgeVisible = true }: Props) => {
    const { t } = useTranslation('common');
    const activeColor = isSoloMode ? PROP_COLOR.solo : PROP_COLOR.accent;
    const modeBadgeKey = isSoloMode ? 'modes.solo' : 'modes.group';

    return (
        <Flex gap="4" align="center">
            <Logotype className={styles.root} data-mode={isSoloMode ? 'solo' : 'group'} />
            {/* Below `sm` only the name hides: the mode badge stays next to the logo (#971). */}
            <Flex align="center" gap="2">
                <Box display={{ initial: 'none', sm: 'block' }}>
                    <Text size="6" weight="bold" color={activeColor}>
                        {PROJECT_NAME}
                    </Text>
                </Box>
                {isModeBadgeVisible && (
                    <Badge size="1" variant="soft" color={activeColor}>
                        {t(modeBadgeKey)}
                    </Badge>
                )}
            </Flex>
        </Flex>
    );
};

export { ModeLogotype };
