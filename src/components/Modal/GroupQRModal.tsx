import { LucideQrCode } from 'lucide-react';

import { Button } from '@radix-ui/themes';

import OfflineQRCode from 'components/OfflineQRCode';

import BaseModal from './BaseModal';

interface Props {
    qrLink: string;
}

const GroupQRModal = ({ qrLink }: Props) => {
    return (
        <BaseModal
            title="Group QR code"
            description="Scan this QR to open the invite link"
            triggerElement={
                <Button variant="soft" size="3" style={{ width: '100%' }}>
                    <LucideQrCode />
                    Show QR
                </Button>
            }
            content={<OfflineQRCode url={qrLink} size="large" />}
        />
    );
};

export default GroupQRModal;
