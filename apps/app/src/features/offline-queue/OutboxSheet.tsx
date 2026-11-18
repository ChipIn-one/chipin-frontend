import { Callout, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import type { OutboxOverlay } from 'entities/ledger';
import { useOutboxSheetStore } from 'store/outboxSheetStore';

import { BaseModal } from 'components/modals';

import { OutboxItemRow } from './OutboxItemRow';

interface Props {
    overlay: OutboxOverlay;
}

/**
 * `OutboxSheet` (spec 03 §2.5): the ops saved on this device and not answered yet. Pending ones
 * with their status, failed ones with their reason and Retry/Cancel; an op being sent offers no
 * Cancel. The conflict drafts join it in 03-16b.
 */
export const OutboxSheet = ({ overlay }: Props) => {
    const { t } = useTranslation('common');
    const isOpen = useOutboxSheetStore(state => state.isOpen);
    const setIsOpen = useOutboxSheetStore(state => state.setIsOpen);
    const { pending, failed, unreadableCount, isStorageNotPersisted } = overlay;

    return (
        <BaseModal
            isOpened={isOpen}
            setIsOpened={setIsOpen}
            title={t('outbox.title')}
            accessibleDescription={t('outbox.description')}
            content={
                <Flex direction="column" gap="4">
                    {isStorageNotPersisted && (
                        <Callout.Root color="amber" size="1">
                            <Callout.Text>{t('outbox.storageNotPersisted')}</Callout.Text>
                        </Callout.Root>
                    )}
                    {unreadableCount > 0 && (
                        <Card size="1">
                            <Text size="1" color="gray">
                                {t('outbox.unreadable', { count: unreadableCount })}
                            </Text>
                        </Card>
                    )}
                    {pending.length === 0 && failed.length === 0 && unreadableCount === 0 && (
                        <Text color="gray">{t('outbox.empty')}</Text>
                    )}
                    {failed.length > 0 && (
                        <Flex direction="column" gap="2" asChild>
                            <section aria-label={t('outbox.failedTitle')}>
                                <Heading as="h3" size="3">
                                    {t('outbox.failedTitle')}
                                </Heading>
                                {failed.map(item => (
                                    <OutboxItemRow key={item.opId} item={item} />
                                ))}
                            </section>
                        </Flex>
                    )}
                    {pending.length > 0 && (
                        <Flex direction="column" gap="2" asChild>
                            <section aria-label={t('outbox.pendingTitle')}>
                                <Heading as="h3" size="3">
                                    {t('outbox.pendingTitle')}
                                </Heading>
                                {pending.map(item => (
                                    <OutboxItemRow key={item.opId} item={item} />
                                ))}
                            </section>
                        </Flex>
                    )}
                </Flex>
            }
        />
    );
};
