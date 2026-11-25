import {
    cloneElement,
    type ComponentPropsWithRef,
    type CSSProperties,
    type ReactElement,
} from 'react';
import { Slot, Tooltip } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

import type { OnlineOnlyAction } from 'constants/onlineOnlyActions';
import { useRequiresOnline } from 'hooks/useRequiresOnline';

/** What a blocked child gets: a button, or an `asChild` wrapper of one. */
interface BlockableProps {
    disabled?: boolean;
    'aria-disabled'?: boolean | 'true' | 'false';
    style?: CSSProperties;
}

type Props = Omit<ComponentPropsWithRef<typeof Slot>, 'children'> & {
    action: OnlineOnlyAction;
    children: ReactElement<BlockableProps>;
    /** The blocked wrapper takes the full width (a full-width child). */
    isFullWidth?: boolean;
    /** An expense write the outbox can take now: not blocked offline (`useRequiresOnline`). */
    canQueueOffline?: boolean;
};

const INLINE: CSSProperties = { display: 'inline-flex' };
const FULL_WIDTH: CSSProperties = { display: 'flex', width: '100%' };

/**
 * `<OnlineOnly>` of spec 03 §2.9 (03-16a part C) around the button of an online-only action. Not
 * blocked (online with a confirmed sign-in, or an expense write the outbox can take: NET-006,
 * NET-007): the child as it is; the props of a Radix trigger
 * (`asChild`) that renders this wrapper reach the child through `Slot`. Blocked: the child is
 * disabled (`disabled`, `aria-disabled`) and the trigger's props are dropped, so it opens nothing;
 * the tooltip "An internet connection is required" sits on a focusable span, because a disabled
 * button gets no pointer events.
 */
export const OnlineOnly = ({
    action,
    children,
    isFullWidth = false,
    canQueueOffline = false,
    ...slotProps
}: Props) => {
    const { t } = useTranslation('common');
    const isBlocked = useRequiresOnline(action, { canQueueOffline });

    if (!isBlocked) {
        return Object.keys(slotProps).length === 0 ? (
            children
        ) : (
            <Slot {...slotProps}>{children}</Slot>
        );
    }
    return (
        <Tooltip content={t('outbox.onlineRequired')}>
            <span tabIndex={0} data-online-only={action} style={isFullWidth ? FULL_WIDTH : INLINE}>
                {cloneElement(children, {
                    disabled: true,
                    'aria-disabled': true,
                    style: { ...children.props.style, pointerEvents: 'none' },
                })}
            </span>
        </Tooltip>
    );
};
