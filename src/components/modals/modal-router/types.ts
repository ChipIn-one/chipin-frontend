import type { ReactNode } from 'react';

export interface ModalNavigation<RouteId extends string> {
    currentRoute: RouteId;
    canGoBack: boolean;
    push: (route: RouteId) => void;
    replace: (route: RouteId) => void;
    back: () => void;
    close: () => void;
}

export interface ModalRoute<RouteId extends string> {
    title: string;
    accessibleDescription: string;
    render: (navigation: ModalNavigation<RouteId>) => ReactNode;
}
