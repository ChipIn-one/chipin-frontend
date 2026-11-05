// The single source of "the network is usable" (spec 03 §1.7): TanStack `onlineManager`. 03-6 adds
// only the read; 03-7a adds the bootstrap `setOnline(navigator.onLine)`, the `/health` probe with
// its 15 s re-check and `waitForOnline()`.
import { onlineManager } from '@tanstack/react-query';

export const isNetworkUsable = (): boolean => onlineManager.isOnline();
