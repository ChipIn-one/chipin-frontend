import { type ComponentProps, useState } from 'react';
import { Button, Tooltip } from '@radix-ui/themes';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { SECOND } from 'constants/time';
import { copyTextToClipboard } from 'helpers/clipboard';

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

    const onCopy = (): Promise<void> => {
        if (!value) {
            return Promise.resolve();
        }

        return copyTextToClipboard(value).then(result => {
            if (result !== 'copied') {
                return;
            }

            setIsCopied(true);
            setTimeout(() => setIsCopied(false), COPIED_RESET_DELAY_MS);
        });
    };

    const tooltipContent = isCopied ? t('copy.copied') : t('copy.copy', { what });

    return (
        <Tooltip content={tooltipContent}>
            <Button size={size} variant={variant} onClick={onCopy} disabled={disabled || !value}>
                {isCopied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
                {isCopied ? t('copy.copied') : children}
            </Button>
        </Tooltip>
    );
};

export default CopyButton;
