import { ComponentProps, useState } from 'react';
import { LucideCheck, LucideCopy } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button, Tooltip } from '@radix-ui/themes';
import { useCopyToClipboard } from '@uidotdev/usehooks';

import { SECOND } from 'constants/time';

const COPIED_RESET_DELAY_MS = 2 * SECOND;

interface Props {
    value: string | null;
    /** Shown in the tooltip: "Copy {{what}}" */
    what: string;
    children: React.ReactNode;
    size?: ComponentProps<typeof Button>['size'];
    variant?: ComponentProps<typeof Button>['variant'];
    disabled?: boolean;
}

const CopyButton = ({ value, what, children, size = '3', variant = 'solid', disabled }: Props) => {
    const { t } = useTranslation('common');
    const [isCopied, setIsCopied] = useState(false);
    const [, copyToClipboard] = useCopyToClipboard();

    const handleCopy = async () => {
        if (!value) {
            return;
        }
        await copyToClipboard(value);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), COPIED_RESET_DELAY_MS);
    };

    const tooltipContent = isCopied ? t('copy.copied') : t('copy.copy', { what });

    return (
        <Tooltip content={tooltipContent}>
            <Button
                size={size}
                variant={variant}
                onClick={handleCopy}
                disabled={disabled || !value}
            >
                {isCopied ? <LucideCheck size={16} /> : <LucideCopy size={16} />}
                {isCopied ? t('copy.copied') : children}
            </Button>
        </Tooltip>
    );
};

export default CopyButton;
