const MODAL_SIZES = {
    default: '420px',
    desktop: '680px',
} as const;

type ModalSize = (typeof MODAL_SIZES)[keyof typeof MODAL_SIZES];

export { MODAL_SIZES };
export type { ModalSize };
