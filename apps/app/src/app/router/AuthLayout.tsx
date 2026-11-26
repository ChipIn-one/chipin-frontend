import { type RefObject, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';

import { readSessionEnvironment, sessionAccess } from 'app/auth/requireSession';
import { readSession } from 'app/auth/session';
import { GuardLoader, OfflineLoadError } from 'features/routing';
import { loginPathFor } from 'helpers/url';
import { useTabUserId } from 'hooks/useTabUserId';
import { isNetworkUsable } from 'shared/offline/network';
import { AUTH_STATUS } from 'store/authConstants';
import { useAuthStore } from 'store/authStore';

import { AuthModal } from 'components/modals/auth-modal';

import styles from './AuthLayout.module.css';

// Marks the overlays the page opened (Radix dialogs and sheets are portaled to `<body>`, outside the
// container above) while `useHidePagePortals` hides them.
const HIDDEN_PORTAL_ATTRIBUTE = 'data-auth-hidden-portal';

/**
 * While the page is hidden, every other child of `<body>` that exists at that moment (the portals
 * of the dialogs, sheets and popovers the page opened, outside the app root) is made `inert` and
 * invisible (inline `visibility: hidden !important`); they come back with the page. Runs in a
 * layout effect of the commit that hides the page: `AuthModal`'s own portal is added only in the
 * next commit (the Radix `Portal` mounts its container from its own layout effect), so the modal is
 * never marked. The app root (with the toaster) is left alone.
 *
 * Limits. Overlays opened while the page is hidden are not marked: the page is inert, but
 * app-level overlays can open themselves (`BackendUnavailablePage` on an outage, the add-expense
 * draft reopened after a reload), and Back/Forward can remount another page under the expired
 * session, whose new overlays are not marked either. Conversely, an outage dialog already open
 * at expiry time is marked too and stays hidden behind `AuthModal` (known limitation). A page never
 * shown (a cold start whose startup refresh fails) has nothing hidden: the modal stands alone, and
 * an overlay that reopens itself then (the add-expense draft after a reload) can list the user's
 * cached friends and groups next to `AuthModal` (AUTH-077: the hooks select the cache while
 * expired); the draft already holds that data.
 */
const useHidePagePortals = (isHidden: boolean, pageRef: RefObject<HTMLElement | null>): void => {
    useLayoutEffect(() => {
        const page = pageRef.current;

        if (!isHidden || page === null) {
            return undefined;
        }
        const hidden = Array.from(document.body.children).filter(
            (element): element is HTMLElement =>
                element instanceof HTMLElement &&
                !element.contains(page) &&
                !['SCRIPT', 'STYLE', 'LINK', 'TEMPLATE'].includes(element.tagName),
        );
        const before = hidden.map(element => ({
            inert: element.hasAttribute('inert'),
            visibility: element.style.getPropertyValue('visibility'),
            priority: element.style.getPropertyPriority('visibility'),
        }));

        hidden.forEach(element => {
            element.setAttribute(HIDDEN_PORTAL_ATTRIBUTE, '');
            element.setAttribute('inert', '');
            element.style.setProperty('visibility', 'hidden', 'important');
        });
        return () => {
            hidden.forEach((element, index) => {
                const previous = before[index];

                element.removeAttribute(HIDDEN_PORTAL_ATTRIBUTE);
                if (!previous?.inert) {
                    element.removeAttribute('inert');
                }
                if (previous?.visibility) {
                    element.style.setProperty('visibility', previous.visibility, previous.priority);
                } else {
                    element.style.removeProperty('visibility');
                }
            });
        };
    }, [isHidden, pageRef]);
};

const subscribeNetwork = (listener: () => void): (() => void) => onlineManager.subscribe(listener);

/**
 * The layout of every protected route (spec 04 §2.3), after its loader `requireSession`. It follows
 * the live session, as `ProtectedRoute` did: a later expiry, a remote logout of another tab (→
 * `/login?returnTo=`), or a session that resolves after the loader's 5 s timeout. The page is
 * rendered only once the session lets it through; after that an expiry keeps it mounted and hidden
 * under `AuthModal`. Before that (a session that expired before the page was shown, or a session
 * error) the modal stands alone, as before: there is no page state to keep, and no page query
 * starts signed out.
 */
const AuthLayout = () => {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    // Signed out, or the modal closed: `/login` returns here, the invite token of a join route kept.
    const loginPath = loginPathFor(pathname + search);
    // Re-rendered on a session change; `sessionAccess` reads the same live session.
    const { status } = useAuthStore(
        useShallow(state => ({ status: state.status, unauthReason: state.unauthReason })),
    );
    // Re-rendered on a network change: the offline rows depend on it.
    useSyncExternalStore(subscribeNetwork, isNetworkUsable);
    // Re-rendered when this tab's saved user changes: the offline rows depend on it (NET-008).
    useTabUserId();
    const [wasPageShown, setWasPageShown] = useState(false);
    const pageRef = useRef<HTMLDivElement>(null);
    const access = sessionAccess(readSession(), readSessionEnvironment());
    const isPageHidden = status !== AUTH_STATUS.UNKNOWN && access !== 'pass';

    useHidePagePortals(isPageHidden, pageRef);

    // NET-008: offline with nothing saved on this device there is no page to show, whether the
    // check is still unanswered or ended in an error: the load error with Retry, never the page.
    // When the network is usable again this falls back to the loader and the check goes on.
    if (access === 'offlineNoData') {
        return <OfflineLoadError />;
    }
    // Still unknown after the loader's timeout: the loader as before, until the check answers.
    if (status === AUTH_STATUS.UNKNOWN) {
        return <GuardLoader />;
    }

    if (access === 'pass' && !wasPageShown) {
        setWasPageShown(true);
    }
    if (access === 'login') {
        return <Navigate to={loginPath} replace />;
    }
    // This tab signed out and is leaving for the landing (full navigation): show nothing of the page.
    if (access === 'leaving') {
        return <GuardLoader />;
    }

    const authModal = (
        <AuthModal
            isOpened
            onOpenChange={isOpen => {
                if (!isOpen) {
                    void navigate(loginPath, { replace: true });
                }
            }}
        />
    );

    if (isPageHidden && !wasPageShown) {
        return authModal;
    }

    return (
        <>
            <div
                className={styles.root}
                ref={pageRef}
                data-hidden={isPageHidden}
                inert={isPageHidden}
                aria-hidden={isPageHidden || undefined}
            >
                <Outlet />
            </div>
            {isPageHidden && authModal}
        </>
    );
};

export { AuthLayout };
