import { LucideQrCode } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Box, Button } from '@radix-ui/themes';

import OfflineQRCode from 'components/OfflineQRCode';

import BaseModal from './BaseModal';

interface Props {
    qrLink: string;
    groupName: string;
}

const GroupQRModal = ({ qrLink }: Props) => {
    const { t } = useTranslation('group');

    return (
        <BaseModal
            title={t('qr.title')}
            description=""
            triggerElement={
                <Box width="100%" asChild>
                    <Button variant="soft" size="3">
                        <LucideQrCode />
                        {t('common:buttons.showQRCode')}
                    </Button>
                </Box>
            }
            content={<OfflineQRCode url={qrLink} size="large" />}
        />
    );
};

export default GroupQRModal;
