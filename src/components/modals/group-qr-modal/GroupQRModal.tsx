import { LucideQrCode } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Box, Button } from '@radix-ui/themes';

import OfflineQRCode from 'components/OfflineQRCode';

import { BaseModal } from '../base-modal';
import { OverlayBody } from '../components';

interface Props {
    qrLink: string;
    children?: ReactNode;
}

const GroupQRModal = ({ qrLink, children }: Props) => {
    const { t } = useTranslation('group');

    return (
        <BaseModal
            title={t('qr.title')}
            accessibleDescription={t('qr.description')}
            triggerElement={children ?? (
                <Box width="100%" asChild>
                    <Button variant="soft" size="3">
                        <LucideQrCode />
                        {t('common:buttons.showQRCode')}
                    </Button>
                </Box>
            )}
            content={
                <OverlayBody>
                    <OfflineQRCode url={qrLink} size="large" />
                </OverlayBody>
            }
        />
    );
};

export default GroupQRModal;
