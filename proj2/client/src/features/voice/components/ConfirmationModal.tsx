import React from 'react';
import { VoiceAction } from '../utils/actions';
import './VoiceCommandStyles.css';

interface ConfirmationModalProps {
  isOpen: boolean;
  action: VoiceAction | null;
  onCancel: () => void;
  onConfirm: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, action, onCancel, onConfirm }) => {
  if (!isOpen || !action) {
    return null;
  }

  return (
    <div className="voice-confirmation-overlay" role="dialog" aria-modal="true">
      <div className="voice-confirmation-content">
        <h3>Confirm Action</h3>
        <p>Do you want to execute the following action?</p>
        <strong>{action.description}</strong>

        <div className="voice-confirmation-actions">
          <button type="button" className="voice-button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="voice-button-primary" onClick={onConfirm}>
            Execute
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
