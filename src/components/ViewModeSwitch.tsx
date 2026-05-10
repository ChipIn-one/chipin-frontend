import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Flex, Switch, Text } from '@radix-ui/themes';

const ViewModeSwitch: React.FC = () => {
    const { t } = useTranslation('common');
    const [isGroupMode, setIsGroupMode] = useState(true);

    return (
        <Flex gap="2" direction="column" align="end">
            <Switch size="3" disabled checked={isGroupMode} onCheckedChange={setIsGroupMode} />

            <Text
                as="span"
                size="2"
                weight="medium"
                align="right"
                color={isGroupMode ? 'grass' : 'violet'}
            >
                {isGroupMode ? t('modes.groupMode') : t('modes.soloMode')}
            </Text>
        </Flex>
    );
};

export default ViewModeSwitch;
