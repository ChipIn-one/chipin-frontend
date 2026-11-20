import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { useMatches } from 'react-router-dom';

import { isUuid } from 'helpers/validateUuidParam';
import { useGroupDetail } from 'hooks/useGroupDetail';

import { isRouteErrorShown, subscribeRouteErrorShown } from './routeErrorTitle';
import type { AppRouteDef } from './routeManifest';

const getRouteMeta = (handle: unknown): AppRouteDef['meta'] | undefined => {
    if (typeof handle !== 'object' || handle === null || !('meta' in handle)) {
        return undefined;
    }
    const { meta } = handle;

    if (typeof meta !== 'object' || meta === null || !('titleKey' in meta)) {
        return undefined;
    }

    return typeof meta.titleKey === 'string'
        ? {
              titleKey: meta.titleKey,
              entityTitleKey:
                  'entityTitleKey' in meta && typeof meta.entityTitleKey === 'string'
                      ? meta.entityTitleKey
                      : undefined,
          }
        : undefined;
};

/**
 * `document.title` of the app routes (spec 04 §2.6): the last match with `handle.meta`, its
 * `titleKey`, or `entityTitleKey` with the group name once the group is known. Routes without
 * `handle.meta` (the transitional public ones) are left to `useRoutesMeta`. The description is not
 * set: the whole app host is served noindex.
 */
const useDocumentTitle = (): void => {
    const matches = useMatches();
    const { i18n, t } = useTranslation('meta');
    const match = [...matches]
        .reverse()
        .find(candidate => getRouteMeta(candidate.handle) !== undefined);
    const routeMeta = getRouteMeta(match?.handle);
    const titleKey = routeMeta?.titleKey;
    const entityTitleKey = routeMeta?.entityTitleKey;
    const routeGroupId = match?.params.groupId;
    // An invalid id is a 404 (`validateUuidParam`): no group query for it.
    const groupId = entityTitleKey && isUuid(routeGroupId) ? routeGroupId : undefined;
    const isErrorShown = useSyncExternalStore(subscribeRouteErrorShown, isRouteErrorShown);
    const groupName = useGroupDetail(groupId).group?.name;

    useEffect(() => {
        if (titleKey === undefined || isErrorShown) {
            return;
        }

        document.title =
            entityTitleKey !== undefined && groupName !== undefined
                ? t(entityTitleKey, { groupName })
                : t(titleKey);
    }, [titleKey, entityTitleKey, groupName, isErrorShown, t, i18n.resolvedLanguage]);
};

export { useDocumentTitle };
