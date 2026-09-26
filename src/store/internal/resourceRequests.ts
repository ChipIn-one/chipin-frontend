interface ResourceRequestOptions {
    force?: boolean;
    identity?: string;
}

interface ResourceRequestHandle<T> {
    promise: Promise<T>;
    isCurrent: () => boolean;
}

interface ActiveRequest {
    controller: AbortController;
    identity: string;
    isPending: boolean;
    completion: Promise<unknown>;
    resolveCompletion: (value: unknown) => void;
    rejectCompletion: (reason?: unknown) => void;
    isReplaced: boolean;
}

interface RequestChannel {
    request: <T>(
        loader: (signal: AbortSignal) => Promise<T>,
        options?: ResourceRequestOptions,
    ) => ResourceRequestHandle<T>;
    abort: () => void;
}

const createRequestChannel = (): RequestChannel => {
    let activeRequest: ActiveRequest | undefined;

    const createHandle = <T>(
        request: ActiveRequest,
    ): ResourceRequestHandle<T> => ({
        promise: request.completion as Promise<T>,
        isCurrent: () => activeRequest === request && !request.isReplaced,
    });

    const createRequest = <T>(
        loader: (signal: AbortSignal) => Promise<T>,
        identity: string,
    ): ActiveRequest => {
        let resolveCompletion!: (value: unknown) => void;
        let rejectCompletion!: (reason?: unknown) => void;
        const completion = new Promise<unknown>((resolve, reject) => {
            resolveCompletion = resolve;
            rejectCompletion = reject;
        });
        const controller = new AbortController();
        const promise = loader(controller.signal);
        const request: ActiveRequest = {
            controller,
            identity,
            isPending: true,
            completion,
            resolveCompletion,
            rejectCompletion,
            isReplaced: false,
        };

        promise.then(
            value => {
                request.isPending = false;

                if (!request.isReplaced) {
                    request.resolveCompletion(value);
                }
            },
            error => {
                request.isPending = false;

                if (!request.isReplaced) {
                    request.rejectCompletion(error);
                }
            },
        );

        return request;
    };

    const abort = (): void => {
        if (!activeRequest) {
            return;
        }

        activeRequest.controller.abort();
        activeRequest = undefined;
    };

    return {
        request: <T>(
            loader: (signal: AbortSignal) => Promise<T>,
            options: ResourceRequestOptions = {},
        ): ResourceRequestHandle<T> => {
            const identity = options.identity ?? '';

            if (
                activeRequest?.isPending &&
                !options.force &&
                activeRequest.identity === identity
            ) {
                return createHandle<T>(activeRequest);
            }

            const previousRequest = activeRequest;

            if (previousRequest) {
                previousRequest.controller.abort();
            }

            const request = createRequest(loader, identity);
            activeRequest = request;

            if (previousRequest) {
                previousRequest.isReplaced = true;
                previousRequest.resolveCompletion(request.completion);
            }

            return createHandle<T>(request);
        },
        abort,
    };
};

export { createRequestChannel };
export type { RequestChannel, ResourceRequestHandle, ResourceRequestOptions };
