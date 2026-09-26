import { useTranslation } from 'react-i18next';

import { Badge, Box, Flex, Text } from '@radix-ui/themes';

import { PROJECT_NAME } from 'constants/chipin';

import { StyledModeLogotype } from './styled';

interface Props {
    isSoloMode: boolean;
    isModeBadgeVisible?: boolean;
}

const ModeLogotype = ({ isSoloMode, isModeBadgeVisible = true }: Props) => {
    const { t } = useTranslation('common');
    const activeColor = isSoloMode ? 'violet' : 'green';
    const modeBadgeKey = isSoloMode ? 'modes.solo' : 'modes.group';

    return (
        <Flex gap="4" align="center">
            <StyledModeLogotype $isSoloMode={isSoloMode} />
            <Box display={{ initial: 'none', sm: 'block' }}>
                <Flex align="center" gap="2">
                    <Text size="6" weight="bold" color={activeColor}>
                        {PROJECT_NAME}
                    </Text>
                    {isModeBadgeVisible && (
                        <Badge size="1" variant="soft" color={activeColor}>
                            {t(modeBadgeKey)}
                        </Badge>
                    )}
                </Flex>
            </Box>
        </Flex>
    );
};

export default ModeLogotype;
