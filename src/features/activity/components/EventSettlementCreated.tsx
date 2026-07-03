import { Amount, RelativeTime } from 'basics';
import { LucideArrowLeftRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Avatar, Card, Flex, Text } from '@radix-ui/themes';

import type { AppEvent } from 'api/activity.types';
import type { SettlementCreatedAction } from 'constants/activity';

interface Props {
    event: Extract<AppEvent, { action: SettlementCreatedAction }>;
}

const EventSettlementCreated = ({ event }: Props) => {
    const { t } = useTranslation('activity');
    const { amount, currency, fromDisplayName, groupName, toDisplayName } = event.metadata;

    return (
        <Card size="1" mb="2">
            <Flex justify="between" align="center" gap="3">
                <Flex gap="4" align="center">
                    <Avatar
                        size="3"
                        variant="soft"
                        color="green"
                        fallback={<LucideArrowLeftRight size={20} />}
                    />
                    <Flex direction="column" gap="1" minWidth="0">
                        <Text size="3" weight="medium" as="p">
                            <Amount value={amount} tokenCode={currency} />
                        </Text>
                        <Text size="2" color="gray" as="p">
                            {t('event.settlementCreatedDescription', {
                                from: fromDisplayName,
                                to: toDisplayName,
                                group: groupName,
                            })}
                        </Text>
                    </Flex>
                </Flex>

                <RelativeTime createdAt={event.createdAt} />
            </Flex>
        </Card>
    );
};

export default EventSettlementCreated;
