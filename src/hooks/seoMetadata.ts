import { getPublicCanonical, getPublicRoute } from 'constants/publicRoutes';
import { HOME_OPEN_GRAPH } from 'constants/seo';

const getOrCreateMeta = (attribute: 'name' | 'property', key: string): HTMLMetaElement => {
    let meta = document.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);

    if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attribute, key);
        document.head.appendChild(meta);
    }

    return meta;
};

export const updateSeoMetadata = (pathname: string, title: string, description: string): void => {
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    const publicRoute = getPublicRoute(pathname);
    if (!publicRoute) {
        canonical?.remove();

        document.querySelectorAll<HTMLMetaElement>('meta[property^="og:"]').forEach(meta => {
            meta.remove();
        });

        getOrCreateMeta('name', 'robots').setAttribute('content', 'noindex, nofollow');
        return;
    }

    document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.remove();

    if (!canonical) {
        canonical = document.createElement('link');
        canonical.setAttribute('rel', 'canonical');
        document.head.appendChild(canonical);
    }
    const canonicalUrl = getPublicCanonical(publicRoute);
    canonical.setAttribute('href', canonicalUrl);

    const homepageOpenGraph = {
        ...HOME_OPEN_GRAPH,
        'og:url': canonicalUrl,
        'og:title': title,
        'og:description': description,
    };

    for (const [property, content] of Object.entries(homepageOpenGraph)) {
        getOrCreateMeta('property', property).setAttribute('content', content);
    }
};
