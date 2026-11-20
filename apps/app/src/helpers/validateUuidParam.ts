import { data, type LoaderFunctionArgs } from 'react-router-dom';

// Any version: the format check only keeps garbage out of the page queries (spec 04 §2.4).
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: string | undefined): value is string =>
    typeof value === 'string' && UUID_PATTERN.test(value);

/**
 * A synchronous route loader (spec 04 §2.4, D31): no data, no network, no cache read, so it does
 * not wait for `restoreReady`. A route parameter that is not a UUID throws `data(null, 404)`, which
 * `RouteErrorView` renders as NotFound, and no page query starts with the bad id.
 */
const validateUuidParam =
    (name: string) =>
    ({ params }: LoaderFunctionArgs): null => {
        if (!isUuid(params[name])) {
            throw data(null, { status: 404 });
        }

        return null;
    };

export { isUuid, validateUuidParam };
