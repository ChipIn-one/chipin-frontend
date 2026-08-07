import i18n from 'i18n';
import { LucideRefreshCw } from 'lucide-react';
import { toast } from 'sonner';

import { Box, Button, Card, Flex, Text } from '@radix-ui/themes';

import { LS_KEY_SW_UPDATE_DISMISSED_AT } from 'constants/localstorage';
import { HOUR } from 'constants/time';
import { TOASTS_IDS } from 'constants/toasts';
import { LocalStorage } from 'helpers/localStorage';
import { activateServiceWorker, reloadCurrentPage } from 'helpers/serviceWorkerRecovery';
import { usePwaStore } from 'store/pwaStore';
const UPDATE_DISMISS_TTL_MS = 4 * HOUR;

// ─── Module-level state ──────────────────────────────────────────────────────

/** Prevents initServiceWorkerUpdates from running more than once. */
let isInitialized = false;

/** Prevents more than one update toast from appearing simultaneously. */
let isUpdateToastVisible = false;

/** Prevents multiple page reloads when the controller changes. */
let isReloading = false;

/** True when the user chose "Update"; suppresses TTL recording in onDismiss. */
let isUpdatingNow = false;

/** Most recent waiting worker — updated on every maybeShowUpdateToast call. */
let currentWaitingWorker: ServiceWorker | null = null;

// ─── TTL helpers ─────────────────────────────────────────────────────────────

const isUpdateTTLExpired = (): boolean => {
    const dismissedAt = LocalStorage.get(LS_KEY_SW_UPDATE_DISMISSED_AT, 0);
    return dismissedAt === 0 || Date.now() - dismissedAt >= UPDATE_DISMISS_TTL_MS;
};

const recordDismissTime = (): void => {
    LocalStorage.set(LS_KEY_SW_UPDATE_DISMISSED_AT, Date.now());
};

// ─── SW activation ───────────────────────────────────────────────────────────

/**
 * Activates the waiting worker through the shared service-worker boundary.
 * Activation failure still reloads safely so the user cannot get trapped.
 */
const activateWaitingWorker = (): void => {
    if (!currentWaitingWorker) {
        return;
    }

    usePwaStore.getState().setIsSwUpdateAvailable(false);

    void activateServiceWorker(currentWaitingWorker)
        .catch(() => undefined)
        .then(() => {
            if (isReloading) {
                return;
            }

            isReloading = true;
            reloadCurrentPage();
        });
};

// ─── Toast ────────────────────────────────────────────────────────────────────

/**
 * Directly activates the waiting worker without showing the toast.
 * Used by the Settings page as a fallback when the user deferred the toast.
 */
export const applySwUpdate = (): void => {
    isUpdatingNow = true;
    isUpdateToastVisible = false;
    toast.dismiss(TOASTS_IDS.swUpdate);
    activateWaitingWorker();
};

/**
 * Renders the update toast exactly once (deduplicated by isUpdateToastVisible
 * and the Sonner toast ID).
 *
 * Dismiss handling:
 *  - "Update" → activates the waiting SW; onDismiss must NOT record TTL.
 *  - "Later"  → explicitly records TTL via cancel.onClick.
 *  - Close-X  → falls through to onDismiss which records TTL as a fallback.
 */
export const showUpdateToast = (): void => {
    if (isUpdateToastVisible) {
        return;
    }

    isUpdateToastVisible = true;
    isUpdatingNow = false;

    toast.custom(
        toastId => (
            <Box minWidth="356px">
                <Card size="1">
                    <Flex align="center" gap="2" justify="between">
                        <Flex gap="2" align="center">
                            <Text size="1" weight="bold">
                                {i18n.t('toasts:pwa.updateAvailable')}
                            </Text>
                        </Flex>

                        <Flex gap="4" align="center">
                            <Button
                                variant="ghost"
                                color="gray"
                                size="1"
                                onClick={() => {
                                    recordDismissTime();
                                    toast.dismiss(toastId);
                                }}
                            >
                                {i18n.t('toasts:pwa.laterAction')}
                            </Button>

                            <Button
                                variant="soft"
                                color="jade"
                                size="1"
                                onClick={() => {
                                    isUpdatingNow = true;
                                    isUpdateToastVisible = false;
                                    toast.dismiss(toastId);
                                    activateWaitingWorker();
                                }}
                            >
                                <LucideRefreshCw size={14} />
                                {i18n.t('toasts:pwa.updateAction')}
                            </Button>
                        </Flex>
                    </Flex>
                </Card>
            </Box>
        ),
        {
            id: TOASTS_IDS.swUpdate,
            duration: Infinity,
            onDismiss: () => {
                isUpdateToastVisible = false;

                // Skip TTL when the Update action triggered this dismissal.
                if (!isUpdatingNow) {
                    recordDismissTime();
                }
            },
        },
    );
};

// ─── Detection helpers ────────────────────────────────────────────────────────

/**
 * Shows the toast only when all three conditions are met:
 *  1. A controller already exists → not a first-time install.
 *  2. A waiting worker is present → there is something to activate.
 *  3. The dismiss TTL has expired → user agreed to see the reminder again.
 */
const checkShowUpdateToast = (registration: ServiceWorkerRegistration): void => {
    // Guard: first install has no controller; showing an update toast would
    // be misleading because there is no "old version" being replaced.
    if (!navigator.serviceWorker.controller) {
        return;
    }

    if (!registration.waiting) {
        return;
    }

    if (!isUpdateTTLExpired()) {
        return;
    }

    // Always capture the freshest reference so activateWaitingWorker targets
    // the correct worker even when multiple rapid updates have occurred.
    currentWaitingWorker = registration.waiting;
    usePwaStore.getState().setIsSwUpdateAvailable(true);
    showUpdateToast();
};

/**
 * Watches an installing worker's state transitions and calls
 * checkShowUpdateToast once it enters the 'installed' (waiting) state.
 */
const observeInstalling = (
    installing: ServiceWorker,
    registration: ServiceWorkerRegistration,
): void => {
    installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
            checkShowUpdateToast(registration);
        }
    });
};

/** Bound visibilitychange handler — stored so it can be removed on cleanup. */
let visibilityHandler: (() => Promise<void>) | null = null;

/** Periodic poll interval id — stored so it can be cleared on cleanup. */
let periodicPollId: ReturnType<typeof setInterval> | null = null;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Registers /sw.js and initialises the full update notification pipeline.
 * Idempotent — safe to call multiple times; subsequent calls are no-ops.
 *
 * Lifecycle phases:
 *  1. Immediate check — catches workers that entered waiting state before
 *     this call (hard-refresh / tab-open-after-background-update).
 *  2. updatefound → installing → installed — detects updates that arrive
 *     while the app is actively running.
 *  3. visibilitychange — re-notifies users who deferred the update once
 *     they return to the tab after the 3-hour cooldown.
 *  4. Periodic poll (1 h) — discovers updates during long open sessions.
 */
export const initServiceWorkerUpdates = async (): Promise<void> => {
    if (isInitialized) {
        return;
    }

    isInitialized = true;

    if (!('serviceWorker' in navigator)) {
        return;
    }

    let registration: ServiceWorkerRegistration;

    try {
        // Calling register() when a SW is already active returns the existing
        // registration — this is idempotent and will not re-register the SW.
        registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    } catch {
        // HTTPS is required in production; fail silently in unsupported envs.
        return;
    }

    // Phase 1 — check for a worker that entered waiting state before init.
    checkShowUpdateToast(registration);

    // Phase 2 — watch for new SW versions discovered while the app is open.
    registration.addEventListener('updatefound', () => {
        const { installing } = registration;

        if (installing) {
            observeInstalling(installing, registration);
        }
    });

    // Phase 3 — re-check on tab focus after a potential cooldown expiry.
    visibilityHandler = async () => {
        if (document.visibilityState !== 'visible') {
            return;
        }

        try {
            // Trigger a fresh network request for the SW file so any pending
            // update enters the installing → installed pipeline.
            await registration.update();
        } catch {
            // Offline — the waiting state is unaffected; ignore.
        }

        checkShowUpdateToast(registration);
    };

    document.addEventListener('visibilitychange', visibilityHandler);

    // Phase 4 — hourly poll for apps left open across background sessions.
    periodicPollId = setInterval(async () => {
        if (!navigator.onLine) {
            return;
        }

        try {
            await registration.update();
        } catch {
            // Ignore network errors during periodic checks.
        }
    }, HOUR);
};

export const cleanupServiceWorkerUpdates = (): void => {
    if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
    }

    if (periodicPollId !== null) {
        clearInterval(periodicPollId);
        periodicPollId = null;
    }

    isInitialized = false;
};
