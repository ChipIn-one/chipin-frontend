import { validateUuidParam } from 'helpers/validateUuidParam';

export { default as Component } from './GroupPage';
export const loader = validateUuidParam('groupId');
