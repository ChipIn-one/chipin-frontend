import { useTranslation } from 'react-i18next';

import { Flex } from '@radix-ui/themes';

import { ParticipantText } from './styled';

interface Props {
    fromDisplayName: string;
    toDisplayName: string;
    isReversed: boolean;
}

const SettlementParticipants = ({
    fromDisplayName,
    toDisplayName,
    isReversed,
}: Props) => {
    const { t } = useTranslation('activity');

    return (
        <Flex align="center" gap="1" minWidth="0" wrap="wrap">
            <ParticipantText
                size="3"
                weight="medium"
                truncate
                $isReversed={isReversed}
            >
                {fromDisplayName}
            </ParticipantText>

            <ParticipantText
                size="2"
                color="gray"
                truncate
                $isReversed={isReversed}
            >
                {t('event.paidTo')}
            </ParticipantText>

            <ParticipantText
                size="3"
                weight="medium"
                truncate
                $isReversed={isReversed}
            >
                {toDisplayName}
            </ParticipantText>
        </Flex>
    );
};

export { SettlementParticipants };
