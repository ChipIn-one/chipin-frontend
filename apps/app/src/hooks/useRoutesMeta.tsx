import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation } from 'react-router-dom';

import { ROUTE_META, ROUTES } from 'constants/routes';

import { updateSeoMetadata } from './seoMetadata';
import { useGroupDetail } from './useGroupDetail';

export const useRoutesMeta = () => {
    const location = useLocation();
    const routeGroupId = matchPath(
        { path: `${ROUTES.GROUP}/:groupId`, end: true },
        location.pathname,
    )?.params.groupId;
    const selectedGroup = useGroupDetail(routeGroupId).group;
    const { i18n, t } = useTranslation('meta');

    useEffect(() => {
        const matchedRouteMeta = ROUTE_META.map(routeMeta => ({
            routeMeta,
            match: matchPath({ path: routeMeta.path, end: true }, location.pathname),
        })).find(({ match }) => Boolean(match));

        const routeMeta = matchedRouteMeta?.routeMeta;
        const params = matchedRouteMeta?.match?.params;
        let groupName: string | undefined;

        if (routeMeta?.groupTitleKey && selectedGroup && selectedGroup.id === params?.groupId) {
            groupName = selectedGroup.name;
        }

        const hasSelectedGroupMeta = groupName !== undefined;
        const titleKey =
            hasSelectedGroupMeta && routeMeta?.groupTitleKey
                ? routeMeta.groupTitleKey
                : routeMeta?.titleKey || 'notFound.title';
        const descriptionKey =
            hasSelectedGroupMeta && routeMeta?.groupDescriptionKey
                ? routeMeta.groupDescriptionKey
                : routeMeta?.descriptionKey || 'notFound.description';
        const options = hasSelectedGroupMeta ? { groupName } : undefined;

        const title = t(titleKey, options);
        const description = t(descriptionKey, options);
        document.title = title;

        let element = document.querySelector<HTMLMetaElement>('meta[name="description"]');

        if (!element) {
            element = document.createElement('meta');
            element.setAttribute('name', 'description');
            document.head.appendChild(element);
        }

        element.setAttribute('content', description);

        updateSeoMetadata(location.pathname, title, description);
    }, [i18n.resolvedLanguage, location.pathname, selectedGroup, t]);
};
