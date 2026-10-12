import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { matchPath, useLocation } from 'react-router-dom';

import { ROUTES, ROUTE_META } from 'constants/routes';
import { selectSelectedGroup } from 'store/groupsSelectors';
import { useGroupsStore } from 'store/groupsStore';

const HOME_CANONICAL_URL = 'https://chipin.one/';

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

        let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
        let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');

        if (location.pathname !== ROUTES.HOME) {
            canonical?.remove();

            document.querySelectorAll<HTMLMetaElement>('meta[property^="og:"]').forEach(meta => {
                meta.remove();
            });

            if (!robots) {
                robots = document.createElement('meta');
                robots.setAttribute('name', 'robots');
                document.head.appendChild(robots);
            }
            robots.setAttribute('content', 'noindex, nofollow');
            return;
        }

        robots?.remove();

        if (!canonical) {
            canonical = document.createElement('link');
            canonical.setAttribute('rel', 'canonical');
            document.head.appendChild(canonical);
        }
        canonical.setAttribute('href', HOME_CANONICAL_URL);

        const homepageOpenGraph = {
            'og:type': 'website',
            'og:site_name': 'ChipIn',
            'og:title': title,
            'og:description': description,
            'og:url': HOME_CANONICAL_URL,
            'og:image': `${HOME_CANONICAL_URL}pwa-512x512.png`,
            'og:image:width': '512',
            'og:image:height': '512',
        };

        for (const [property, content] of Object.entries(homepageOpenGraph)) {
            let meta = document.querySelector<HTMLMetaElement>(
                `meta[property="${property}"]`,
            );
            if (!meta) {
                meta = document.createElement('meta');
                meta.setAttribute('property', property);
                document.head.appendChild(meta);
            }
            meta.setAttribute('content', content);
        }
    }, [i18n.resolvedLanguage, location.pathname, selectedGroup, t]);
};
