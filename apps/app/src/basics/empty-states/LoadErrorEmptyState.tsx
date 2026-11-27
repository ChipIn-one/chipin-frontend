import { Button } from '@radix-ui/themes';
import { RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import EmptyState from './EmptyState';

interface Props {
    /** The block's own error texts (i18n), e.g. "Couldn't load your friends". */
    title: string;
    description: string;
    onRetry: () => void;
}

/** A failed first load with nothing to show: in place of the content, with one Retry (states.md). */
const LoadErrorEmptyState = ({ title, description, onRetry }: Props) => {
    const { t } = useTranslation('activity');

    return (
        <EmptyState
            icon={<RefreshCwIcon size={20} />}
            title={title}
            description={description}
            action={
                <Button type="button" variant="soft" onClick={onRetry}>
                    <RefreshCwIcon size={14} />
                    {t('retryAction')}
                </Button>
            }
        />
    );
};

export { LoadErrorEmptyState };
