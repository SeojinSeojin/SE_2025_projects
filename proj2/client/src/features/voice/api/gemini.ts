import api from '../../../services/api';
import { VoiceActionId, getActionById } from '../utils/actions';

export async function classifyWithGemini(userText: string): Promise<VoiceActionId> {
  if (!userText?.trim()) {
    throw new Error('Cannot classify empty text.');
  }

  try {
    const response = await api.post('/voice/classify', { userText });
    const actionId = response.data?.actionId;

    if (!actionId) {
      throw new Error('Voice API returned an empty action.');
    }

    const normalizedActionId = actionId.trim() as VoiceActionId;

    if (!getActionById(normalizedActionId)) {
      throw new Error(`Voice API responded with unsupported action: ${actionId}`);
    }

    return normalizedActionId;
  } catch (error: any) {
    const message = error.response?.data?.error || error.message || 'Gemini classification failed.';
    throw new Error(message);
  }
}
