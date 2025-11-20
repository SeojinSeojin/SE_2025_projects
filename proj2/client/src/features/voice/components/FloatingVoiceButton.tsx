import React from 'react';
import './VoiceCommandStyles.css';

interface FloatingVoiceButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isListening: boolean;
  title?: string;
}

const FloatingVoiceButton: React.FC<FloatingVoiceButtonProps> = ({
  onClick,
  disabled = false,
  isListening,
  title,
}) => {
  const className = ['voice-floating-button'];
  if (isListening) {
    className.push('listening');
  }

  return (
    <button
      type="button"
      className={className.join(' ')}
      onClick={onClick}
      disabled={disabled}
      aria-label="Voice command"
      title={title}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d="M12 15c1.66 0 3-1.57 3-3.5v-5C15 5.12 13.66 3.5 12 3.5S9 5.12 9 6.5v5c0 1.93 1.34 3.5 3 3.5Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M5 11.5a7 7 0 0 0 14 0" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 22v-4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="voice-floating-button-label">{isListening ? 'Listening' : 'Voice'}</span>
    </button>
  );
};

export default FloatingVoiceButton;
