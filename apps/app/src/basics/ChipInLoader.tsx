import { useSyncExternalStore } from 'react';
import { Flex, VisuallyHidden } from '@radix-ui/themes';
import { useTranslation } from 'react-i18next';

interface LoaderProps {
    size?: number; // SVG size (px)
    strokeWidth?: number; // line thickness
    /**
     * Default `true`: the loader is a `role="status"` region announcing `common:loader.label`.
     * Pass `false` when a status line next to it already says what is loading; the loader is
     * then hidden from assistive technology, so only that line is announced.
     */
    announce?: boolean;
}

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// SSR, the SSG prerender and a test environment without `matchMedia` read "no preference".
const reducedMotionQuery = (): MediaQueryList | null =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia(REDUCED_MOTION_QUERY)
        : null;

const subscribeReducedMotion = (onChange: () => void): (() => void) => {
    const query = reducedMotionQuery();

    query?.addEventListener('change', onChange);
    return () => query?.removeEventListener('change', onChange);
};

const prefersReducedMotion = (): boolean => reducedMotionQuery()?.matches ?? false;

const noPreference = (): boolean => false;

/**
 * The brand loader. It is a `role="status"` region with a translated text, and the SVG is hidden
 * from assistive technology. The animation is SMIL, which CSS media queries do not stop, so under
 * `prefers-reduced-motion: reduce` it renders a static arc without the animate elements.
 */
const ChipInLoader = ({ size = 64, strokeWidth = 2, announce = true }: LoaderProps) => {
    const { t } = useTranslation('common');
    const isReducedMotion = useSyncExternalStore(
        subscribeReducedMotion,
        prefersReducedMotion,
        noPreference,
    );

    return (
        <Flex
            as="span"
            display="inline-flex"
            role={announce ? 'status' : undefined}
            aria-hidden={announce ? undefined : true}
        >
            <svg
                width={size}
                height={size}
                stroke="var(--cp-brand-loader)"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
            >
                {isReducedMotion ? (
                    <circle
                        cx="12"
                        cy="12"
                        r="9.5"
                        fill="none"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray="42 150"
                    />
                ) : (
                    <g>
                        <circle
                            cx="12"
                            cy="12"
                            r="9.5"
                            fill="none"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                        >
                            <animate
                                attributeName="stroke-dasharray"
                                dur="1.8s"
                                calcMode="spline"
                                values="0 150;42 150;42 150;42 150"
                                keyTimes="0;0.475;0.95;1"
                                keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="stroke-dashoffset"
                                dur="1.8s"
                                calcMode="spline"
                                values="0;-16;-59;-59"
                                keyTimes="0;0.475;0.95;1"
                                keySplines="0.42 0 0.58 1;0.42 0 0.58 1;0.42 0 0.58 1"
                                repeatCount="indefinite"
                            />
                        </circle>

                        <animateTransform
                            attributeName="transform"
                            type="rotate"
                            dur="2.4s"
                            values="0 12 12;360 12 12"
                            repeatCount="indefinite"
                        />
                    </g>
                )}
            </svg>
            {announce && <VisuallyHidden>{t('loader.label')}</VisuallyHidden>}
        </Flex>
    );
};

export { ChipInLoader };
