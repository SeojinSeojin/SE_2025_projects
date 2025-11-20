export type VoiceActionId = 'logout' | 'openProfile' | 'goHome';

export interface VoiceAction {
  id: VoiceActionId;
  description: string;
}

export const ACTIONS: VoiceAction[] = [
  { id: 'logout', description: 'Log the user out' },
  { id: 'openProfile', description: 'Open the profile page' },
  { id: 'goHome', description: 'Go to the home screen' },
];

export const ACTION_LIST_STRING = ACTIONS.map((action) => action.id).join(', ');

export function getActionById(actionId: string): VoiceAction | undefined {
  return ACTIONS.find((action) => action.id === actionId);
}
