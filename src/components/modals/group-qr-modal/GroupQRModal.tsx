import { LucideQrCode } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Button, Card, Dialog, Flex, Text } from '@radix-ui/themes';

import OfflineQRCode from 'components/OfflineQRCode';

import { BaseModal } from '../base-modal';
import { OverlayBody, OverlayFooter } from '../components';

interface Props {
    qrLink: string;
    groupName: string;
    children?: ReactNode;
}

const GroupQRModal = ({ qrLink, groupName, children }: Props) => {
    const { t } = useTranslation(['group', 'common']);

    return (
        <BaseModal
            title={t('group:qr.title')}
            accessibleDescription={t('group:qr.description')}
            triggerElement={children ?? (
                <Box width="100%" asChild>
                    <Button variant="soft" size="3">
                        <LucideQrCode />
                        {t('common:buttons.showQRCode')}
                    </Button>
                </Box>
            )}
            content={
                <>
                    <OverlayBody>
                        <Flex direction="column" gap="4">
                            <Card size="1" variant="surface">
                                <Text size="2" color="gray">
                                    {t('group:qr.joinDescription', { groupName })}
                                </Text>
                            </Card>

                            <Flex justify="center">
                                <OfflineQRCode url={qrLink} size="large" />
                            </Flex>
                        </Flex>
                    </OverlayBody>

                    <OverlayFooter
                        cancelAction={
                            <Dialog.Close>
                                <Button
                                    type="button"
                                    size="3"
                                    variant="soft"
                                    color="gray"
                                >
                                    {t('common:buttons.close')}
                                </Button>
                            </Dialog.Close>
                        }
                        primaryAction={null}
                    />
                </>
            }
        />
    );
};

export default GroupQRModal;
