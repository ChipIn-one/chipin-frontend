import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { BaseModal, type ModalSize } from '../base-modal';

import type { ModalNavigation, ModalRoute } from './types';

interface Props<RouteId extends string> {
    initialRoute: RouteId;
    routes: Record<RouteId, ModalRoute<RouteId>>;
    isOpened: boolean;
    onOpenChange: (isOpen: boolean) => void;
    triggerElement?: ReactNode;
    maxWidth?: ModalSize;
    isCloseDisabled?: boolean;
    isBackDisabled?: boolean;
}

interface NavigationState<RouteId extends string> {
    route: RouteId;
    history: RouteId[];
}

const ModalRouter = <RouteId extends string,>({
    initialRoute,
    routes,
    isOpened,
    onOpenChange,
    triggerElement,
    maxWidth,
    isCloseDisabled = false,
    isBackDisabled = false,
}: Props<RouteId>) => {
    const [navigationState, setNavigationState] = useState<NavigationState<RouteId>>({
        route: initialRoute,
        history: [],
    });
    const titleRef = useRef<HTMLHeadingElement>(null);
    const previousRouteRef = useRef(initialRoute);

    const onReset = useCallback(() => {
        setNavigationState(state => {
            if (state.route === initialRoute && state.history.length === 0) {
                return state;
            }
            return { route: initialRoute, history: [] };
        });
    }, [initialRoute]);

    const onDialogOpenChange = useCallback((nextIsOpen: boolean) => {
        if (!nextIsOpen) {
            onReset();
        }
        onOpenChange(nextIsOpen);
    }, [onOpenChange, onReset]);

    const onPush = useCallback((route: RouteId) => {
        setNavigationState(state =>
            state.route === route
                ? state
                : { route, history: [...state.history, state.route] },
        );
    }, []);

    const onReplace = useCallback((route: RouteId) => {
        setNavigationState(state => {
            if (state.route === route) {
                return state;
            }
            // Replacing with the previous screen should not leave a no-op Back step.
            if (state.history[state.history.length - 1] === route) {
                return { route, history: state.history.slice(0, -1) };
            }
            return { ...state, route };
        });
    }, []);

    const onBack = useCallback(() => {
        setNavigationState(state => {
            if (state.history.length === 0) {
                return state;
            }
            const history = state.history.slice(0, -1);
            return { route: state.history[state.history.length - 1], history };
        });
    }, []);

    useLayoutEffect(() => {
        if (isOpened && previousRouteRef.current !== navigationState.route) {
            titleRef.current?.focus({ preventScroll: true });
        }
        previousRouteRef.current = navigationState.route;
    }, [isOpened, navigationState.route]);

    const navigation: ModalNavigation<RouteId> = {
        currentRoute: navigationState.route,
        canGoBack: navigationState.history.length > 0,
        push: onPush,
        replace: onReplace,
        back: onBack,
        close: () => onDialogOpenChange(false),
    };
    const activeRoute = routes[navigationState.route];

    return (
        <BaseModal
            isOpened={isOpened}
            setIsOpened={onDialogOpenChange}
            triggerElement={triggerElement}
            maxWidth={maxWidth}
            title={activeRoute.title}
            accessibleDescription={activeRoute.accessibleDescription}
            content={activeRoute.render(navigation)}
            onBack={navigation.canGoBack ? onBack : undefined}
            isBackDisabled={isBackDisabled}
            isCloseDisabled={isCloseDisabled}
            titleRef={titleRef}
        />
    );
};

export default ModalRouter;
