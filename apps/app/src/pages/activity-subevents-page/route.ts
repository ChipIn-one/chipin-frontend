import { validateUuidParam } from 'helpers/validateUuidParam';

export { default as Component } from './ActivitySubeventsPage';
export const loader = validateUuidParam('parentActivityId');
