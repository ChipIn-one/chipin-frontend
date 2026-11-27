import { Box, Flex, Skeleton, Switch, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import { useCanAccessSolo, useSelfUserState } from 'hooks/useSelfUser';
import { useSwitchAppMode } from 'hooks/useSwitchAppMode';
import { APP_MODES, selectIsSoloMode, useUiPrefsStore } from 'store/ui-prefs';

const ViewModeSwitch = () => {
    const { t } = useTranslation('common');
    const switchAppMode = useSwitchAppMode();
    const isUserLoading = useSelfUserState().isLoading;
    const canAccessSolo = useCanAccessSolo();
    const isSoloMode = useUiPrefsStore(selectIsSoloMode);

    const onModeChange = (isGroup: boolean) => {
        switchAppMode(isGroup ? APP_MODES.GROUP : APP_MODES.SOLO);
    };

    if (!canAccessSolo) {
        return null;
    }

    return (
        <Flex
            width={{ lg: '100%' }}
            gap="2"
            direction={{ initial: 'column', lg: 'row' }}
            align={{ initial: 'end', lg: 'center' }}
            justify={{ lg: 'between' }}
        >
            <Box>
                <Text
                    as="span"
                    size="2"
                    weight="medium"
                    align={{ initial: 'right', lg: 'left' }}
                    color={!isSoloMode ? 'green' : 'violet'}
                >
                    <Skeleton loading={isUserLoading}>
                        {!isSoloMode ? t('modes.groupMode') : t('modes.soloMode')}
                    </Skeleton>
                </Text>
            </Box>

            <Box>
                <Skeleton loading={isUserLoading}>
                    <Switch
                        size={{ initial: '2', sm: '3' }}
                        color={!isSoloMode ? 'green' : 'violet'}
                        checked={!isSoloMode}
                        onCheckedChange={onModeChange}
                        aria-label={t('modes.groupMode')}
                    />
                </Skeleton>
            </Box>
        </Flex>
    );
};

export { ViewModeSwitch };
