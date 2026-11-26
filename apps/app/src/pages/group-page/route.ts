import { validateUuidParam } from 'helpers/validateUuidParam';

export { GroupPage as Component } from './GroupPage';
export const loader = validateUuidParam('groupId');
