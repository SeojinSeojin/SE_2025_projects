import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { classifyWithGemini } from '../api/gemini';
import { useSpeechToText } from '../hooks/useSpeechToText';
import { VoiceAction, getActionById } from '../utils/actions';
import { performAction } from '../utils/performAction';
import ConfirmationModal from './ConfirmationModal';
import FloatingVoiceButton from './FloatingVoiceButton';
import VoiceModal from './VoiceModal';

const VoiceCommandManager: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [isVoiceModalOpen, setVoiceModalOpen] = useState(false);
  const [isConfirmationOpen, setConfirmationOpen] = useState(false);
  const [selectedAction, setSelectedAction] = useState<VoiceAction | null>(null);
  const [isClassifying, setIsClassifying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
  }, []);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timeout = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  const handleOpenProfile = useCallback(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const basePath =
      user.role === 'restaurant'
        ? '/restaurant'
        : user.role === 'delivery'
        ? '/delivery'
        : '/customer';

    navigate(`${basePath}/profile`);
  }, [navigate, user]);

  const handleGoHome = useCallback(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const dashboardPath =
      user.role === 'restaurant'
        ? '/restaurant'
        : user.role === 'delivery'
        ? '/delivery'
        : '/customer';

    navigate(dashboardPath);
  }, [navigate, user]);

  const actionDeps = useMemo(
    () => ({
      logout: handleLogout,
      openProfile: handleOpenProfile,
      goHome: handleGoHome,
    }),
    [handleLogout, handleOpenProfile, handleGoHome]
  );

  const handleClassification = useCallback(
    async (finalText: string) => {
      const cleaned = finalText.trim();

      if (!cleaned) {
        showToast('Could not recognize the command. Please try again.');
        return;
      }

      setIsClassifying(true);

      try {
        const actionId = await classifyWithGemini(cleaned);
        const action = getActionById(actionId);

        if (action) {
          setSelectedAction(action);
          setConfirmationOpen(true);
          setVoiceModalOpen(false);
        }
      } catch (error) {
        console.error('Gemini classification failed', error);
        const message = error instanceof Error ? error.message : 'Failed to classify voice command.';
        showToast(message);
      } finally {
        setIsClassifying(false);
      }
    },
    [showToast]
  );

  const { isSupported, isListening, transcript, interimTranscript, error, startListening, stopListening } =
    useSpeechToText({
      onFinalTranscript: handleClassification,
    });

  const beginListening = useCallback(() => {
    if (!isSupported) {
      showToast('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening || isClassifying) {
      return;
    }

    startListening();
  }, [isSupported, isListening, isClassifying, showToast, startListening]);

  const endListening = useCallback(() => {
    setIsClassifying(false);
    stopListening();
  }, [stopListening]);

  const handleToggleModal = useCallback(() => {
    if (!isSupported) {
      showToast('Speech recognition is not supported in this browser.');
      return;
    }

    setVoiceModalOpen(true);
    if (!isListening) {
      beginListening();
    }
  }, [isSupported, beginListening, isListening, showToast]);

  const handleCloseVoiceModal = useCallback(() => {
    setVoiceModalOpen(false);
    endListening();
  }, [endListening]);

  const handleCancelConfirmation = useCallback(() => {
    setConfirmationOpen(false);
    setSelectedAction(null);
  }, []);

  const handleExecuteAction = useCallback(() => {
    if (!selectedAction) {
      return;
    }

    try {
      performAction(selectedAction.id, actionDeps);
      showToast(`Executed action: ${selectedAction.description}`);
    } catch (error) {
      console.error('Failed to execute action', error);
      showToast('Failed to execute the action.');
    } finally {
      setConfirmationOpen(false);
      setSelectedAction(null);
    }
  }, [actionDeps, selectedAction, showToast]);

  return (
    <>
      <FloatingVoiceButton
        onClick={handleToggleModal}
        disabled={isClassifying}
        isListening={isListening}
        title="Activate voice command"
      />

      <VoiceModal
        isOpen={isVoiceModalOpen}
        transcript={transcript}
        interimTranscript={interimTranscript}
        error={error}
        isListening={isListening}
        isClassifying={isClassifying}
        onStart={beginListening}
        onStop={endListening}
        onClose={handleCloseVoiceModal}
      />

      <ConfirmationModal
        isOpen={isConfirmationOpen}
        action={selectedAction}
        onCancel={handleCancelConfirmation}
        onConfirm={handleExecuteAction}
      />

      {toastMessage && <div className="voice-toast">{toastMessage}</div>}
    </>
  );
};

export default VoiceCommandManager;
