import React from 'react';
import './VoiceCommandStyles.css';

interface VoiceModalProps {
  isOpen: boolean;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isListening: boolean;
  isClassifying: boolean;
  onStart: () => void;
  onStop: () => void;
  onClose: () => void;
}

const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  transcript,
  interimTranscript,
  error,
  isListening,
  isClassifying,
  onStart,
  onStop,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="voice-modal-overlay" role="dialog" aria-modal="true">
      <div className="voice-modal-content">
        <div className="voice-modal-header">
          <h3>Voice Command</h3>
          <button
            type="button"
            className="voice-button-secondary"
            onClick={onClose}
            aria-label="Close voice command modal"
          >
            ✕
          </button>
        </div>

        <div className="voice-modal-status">
          {isClassifying ? 'Analyzing command…' : isListening ? 'Listening…' : 'Ready'}
        </div>

        <div className="voice-modal-text">
          {transcript || (isListening ? 'Please speak…' : 'Press the button to start recording.')}
        </div>

        {interimTranscript && (
          <div className="voice-modal-interim">{interimTranscript}</div>
        )}

        {error && <div className="voice-modal-error">{error}</div>}

        <div className="voice-modal-actions">
          <button type="button" className="voice-button-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={`voice-button-primary ${isListening ? 'voice-button-danger' : ''}`}
            onClick={isListening ? onStop : onStart}
            disabled={isClassifying}
          >
            {isListening ? 'Stop Recording' : 'Start Recording'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VoiceModal;
