import { Flex, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import styles from './SettlementParticipants.module.css';

interface Props {
    fromDisplayName: string;
    toDisplayName: string;
    isReversed: boolean;
}

const SettlementParticipants = ({ fromDisplayName, toDisplayName, isReversed }: Props) => {
    const { t } = useTranslation('activity');
    const reversedClassName = isReversed ? styles.reversed : undefined;

    return (
        <Flex align="center" gap="1" minWidth="0" wrap="wrap">
            <Text size="3" weight="medium" truncate className={reversedClassName}>
                {fromDisplayName}
            </Text>

            <Text size="2" color="gray" truncate className={reversedClassName}>
                {t('event.paidTo')}
            </Text>

            <Text size="3" weight="medium" truncate className={reversedClassName}>
                {toDisplayName}
            </Text>
        </Flex>
    );
};

export { SettlementParticipants };
