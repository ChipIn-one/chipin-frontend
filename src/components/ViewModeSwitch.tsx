import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Flex, Skeleton, Switch, Text } from '@radix-ui/themes';

import { selectUserSelfLoading } from 'store/loadingSelectors';
import { useLoadingStore } from 'store/loadingStore';

const ViewModeSwitch: React.FC = () => {
    const { t } = useTranslation('common');
    const isUserLoading = useLoadingStore(selectUserSelfLoading);

    const [isGroupMode, setIsGroupMode] = useState(true);

    return (
        <Flex gap="2" direction="column" align="end">
            <Skeleton loading={isUserLoading}>
                <Switch
                    size={{ initial: '2', sm: '3' }}
                    disabled
                    checked={isGroupMode}
                    onCheckedChange={setIsGroupMode}
                />
            </Skeleton>
            <Skeleton loading={isUserLoading} width="80px">
                <Text
                    as="span"
                    size="2"
                    weight="medium"
                    align="right"
                    color={isGroupMode ? 'grass' : 'violet'}
                >
                    {isGroupMode ? t('modes.groupMode') : t('modes.soloMode')}
                </Text>
            </Skeleton>
        </Flex>
    );
};

export default ViewModeSwitch;
