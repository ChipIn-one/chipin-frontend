import { VisuallyHidden } from '@radix-ui/themes';
import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import type { OnlineOnlyAction } from 'constants/onlineOnlyActions';
import { useRequiresOnline } from 'hooks/useRequiresOnline';

interface Props {
    action: OnlineOnlyAction;
    children: ReactNode;
}

const RESET: CSSProperties = { border: 0, margin: 0, padding: 0, minWidth: 0 };

/**
 * The controls of one online-only action that are not one button (a settings card, §2.9): not
 * blocked, the children as they are; blocked, inside a disabled `fieldset` (its native buttons and
 * inputs are disabled) whose legend says why.
 */
export const OnlineOnlyGroup = ({ action, children }: Props) => {
    const { t } = useTranslation('common');
    const isBlocked = useRequiresOnline(action);

    if (!isBlocked) {
        return children;
    }
    return (
        <fieldset disabled data-online-only={action} style={RESET}>
            <VisuallyHidden asChild>
                <legend>{t('outbox.onlineRequired')}</legend>
            </VisuallyHidden>
            {children}
        </fieldset>
    );
};
