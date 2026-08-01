import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { Box, Flex, Skeleton, Switch, Text } from '@radix-ui/themes';

import { getPreferredModeRoute } from 'helpers/routes';
import { selectIsSoloMode } from 'store/dashboardSelectors';
import { APP_MODES, useDashboardStore } from 'store/dashboardStore';
import { selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const ViewModeSwitch = () => {
    const { t } = useTranslation('common');
    const navigate = useNavigate();
    const isUserLoading = useLoadingStore(selectUserSelfLoading);
    const { isSoloMode, setAppMode } = useDashboardStore(
        useShallow(state => ({
            isSoloMode: selectIsSoloMode(state),
            setAppMode: state.setAppMode,
        })),
    );

    const onModeChange = (isGroup: boolean) => {
        const nextAppMode = isGroup ? APP_MODES.GROUP : APP_MODES.SOLO;

        setAppMode(nextAppMode);
        navigate(getPreferredModeRoute(nextAppMode === APP_MODES.SOLO));
    };

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

export default ViewModeSwitch;
