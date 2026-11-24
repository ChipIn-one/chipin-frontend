import { createPortal } from 'react-dom';
import { Spinner, Theme } from '@radix-ui/themes';
import { CircleCheckIcon, CircleXIcon, InfoIcon, TriangleAlertIcon } from 'lucide-react';
import { Toaster } from 'sonner';

import { UpdateRequiredScreen } from 'app/pwa/UpdateRequiredScreen';
import { useIsMobile } from 'hooks/common';
import { selectResolvedAppearance, useAppearanceStore } from 'store/ui-prefs';

import { OfflineStatus } from 'components/offline-status';

import styles from './TopLayer.module.css';

const ToastSuccessIcon = () => <CircleCheckIcon size={20} />;
const ToastInfoIcon = () => <InfoIcon size={20} />;
const ToastWarningIcon = () => <TriangleAlertIcon size={20} />;
const ToastErrorIcon = () => <CircleXIcon size={20} />;
const ToastLoadingIcon = () => <Spinner size="2" />;

/**
 * Notices above every dialog, sheet and the unavailable screen (NET-003, NET-004), and the
 * blocking update screen above them all. The root Radix
 * theme is a `z-index: 0` stacking context and the dialogs are portaled after it, so the layer is
 * portaled out of it: into the app root container (a sibling of the root theme, which the session
 * expiry of `AuthLayout` does not hide), or `<body>` when there is none. It is also outside the
 * content that `BackendUnavailableGate` makes inert. The nested `Theme` (not root: no stacking
 * context, no background) keeps the Radix variables and the appearance of the app for the icons.
 */
const TopLayer = () => {
    const appearance = useAppearanceStore(selectResolvedAppearance);
    const isMobile = useIsMobile();

    return createPortal(
        <Theme>
            <Toaster
                theme={appearance}
                className={styles.toaster}
                richColors
                closeButton
                position={isMobile ? 'top-center' : 'bottom-left'}
                offset={isMobile ? 12 : 16}
                mobileOffset={isMobile ? 12 : 16}
                icons={{
                    success: <ToastSuccessIcon />,
                    info: <ToastInfoIcon />,
                    warning: <ToastWarningIcon />,
                    error: <ToastErrorIcon />,
                    loading: <ToastLoadingIcon />,
                }}
            />
            <OfflineStatus />
            {/* Last and at z 2147483000: the blocking update screen covers the toasts too. */}
            <UpdateRequiredScreen />
        </Theme>,
        document.getElementById('root') ?? document.body,
    );
};

export { TopLayer };
