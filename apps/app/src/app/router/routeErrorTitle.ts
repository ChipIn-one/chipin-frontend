// While `RouteErrorView` is mounted it owns `document.title`; `useDocumentTitle` (above or beside the
// boundary) must not overwrite it with the title of the route that failed, and must set the route
// title again once the view is gone. A tiny external store, so both react to the change.
let shownCount = 0;
const listeners = new Set<() => void>();

const notify = (): void => {
    listeners.forEach(listener => listener());
};

const markRouteErrorShown = (): (() => void) => {
    shownCount += 1;
    notify();

    return () => {
        shownCount -= 1;
        notify();
    };
};

const isRouteErrorShown = (): boolean => shownCount > 0;

const subscribeRouteErrorShown = (listener: () => void): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

export { isRouteErrorShown, markRouteErrorShown, subscribeRouteErrorShown };
