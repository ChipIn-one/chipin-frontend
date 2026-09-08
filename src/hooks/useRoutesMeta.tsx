import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation } from 'react-router-dom';

import { ROUTE_META } from 'constants/routes';
import { selectSelectedGroup } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';

export const useRoutesMeta = () => {
    const location = useLocation();
    const selectedGroup = useGroupsStore(selectSelectedGroup);
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

        document.title = t(titleKey, options);

        let element = document.querySelector<HTMLMetaElement>('meta[name="description"]');

        if (!element) {
            element = document.createElement('meta');
            element.setAttribute('name', 'description');
            document.head.appendChild(element);
        }

        element.setAttribute('content', t(descriptionKey, options));
    }, [i18n.resolvedLanguage, location.pathname, selectedGroup, t]);
};
