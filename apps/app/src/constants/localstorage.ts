import { PROJECT_NAME } from './chipin';

export const LS_KEY_USER = `${PROJECT_NAME}_user` as const;
export const LS_KEY_LOCALE = `${PROJECT_NAME}_locale` as const;
export const LS_KEY_SW_UPDATE_DISMISSED_AT = `${PROJECT_NAME}_swUpdateDismissedAt` as const;
/** Spec 04 §2.11 item 3: when a waiting service worker was first detected (forced after 24 h). */
export const LS_KEY_SW_WAITING_SINCE = `${PROJECT_NAME}_swWaitingSince` as const;
export const LS_KEY_THEME = `${PROJECT_NAME}_theme` as const;
export const LS_KEY_AUTH_SESSION_HINT = `${PROJECT_NAME}_authSessionHint` as const;
/** Spec 03 §1.5 (03-16a part C): users whose unsent outbox a refresh switch kept on this device. */
export const LS_KEY_KEPT_OUTBOX_USERS = `${PROJECT_NAME}_keptOutboxUsers` as const;

/**
 * sessionStorage (spec 04 §2.11 item 4, 04-2d): the open expense draft saved before an app reload
 * and restored once at startup. Versioned: another version is dropped on read.
 */
export const SS_KEY_EXPENSE_DRAFT = `${PROJECT_NAME}_expenseDraft_v1` as const;
