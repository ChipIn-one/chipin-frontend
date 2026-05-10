import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Flex, Switch, Text } from '@radix-ui/themes';

const ViewModeSwitch: React.FC = () => {
    const { t } = useTranslation('common');
    const [isChecked, setIsChecked] = useState(true);

    return (
        <Flex gap="2" direction="column" align="end">
            <Switch size="2" disabled checked={isChecked} onCheckedChange={setIsChecked} />

            <Text as="span" size="2" color="gray" weight="medium" align="right">
                {isChecked ? t('modes.groupMode') : t('modes.soloMode')}
            </Text>
        </Flex>
    );
};

export default ViewModeSwitch;
