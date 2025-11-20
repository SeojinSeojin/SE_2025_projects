import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence?: number;
}

interface SpeechRecognitionResult extends ArrayLike<SpeechRecognitionAlternative> {
  isFinal: boolean;
}

interface SpeechRecognitionResultList extends ArrayLike<SpeechRecognitionResult> {}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognition;

interface UseSpeechToTextOptions {
  onFinalTranscript?: (text: string) => void;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const getRecognitionConstructor = (): SpeechRecognitionConstructor | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const useSpeechToText = ({ onFinalTranscript }: UseSpeechToTextOptions = {}) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const recognitionConstructorRef = useRef<SpeechRecognitionConstructor | null>(null);
  const finalTranscriptRef = useRef('');
  const hasDispatchedFinalRef = useRef(false);

  useEffect(() => {
    const SpeechRecognitionCtor = getRecognitionConstructor();
    recognitionConstructorRef.current = SpeechRecognitionCtor;
    setIsSupported(!!SpeechRecognitionCtor);

    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
    };
  }, []);

  const cleanupRecognition = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null as unknown as SpeechRecognition['onresult'];
      recognitionRef.current.onerror = null as unknown as SpeechRecognition['onerror'];
      recognitionRef.current.onend = null as unknown as SpeechRecognition['onend'];
      recognitionRef.current = null;
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor = recognitionConstructorRef.current;

    if (!SpeechRecognitionCtor) {
      setError('Speech recognition is not supported in this browser.');
      return;
    }

    cleanupRecognition();

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true;

    finalTranscriptRef.current = '';
    hasDispatchedFinalRef.current = false;
    setTranscript('');
    setInterimTranscript('');
    setError(null);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalChunk = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript || '';

        if (result.isFinal) {
          finalChunk += text;
        } else {
          interim += text;
        }
      }

      if (interim) {
        setInterimTranscript(interim);
      }

      if (finalChunk) {
        finalTranscriptRef.current = `${finalTranscriptRef.current} ${finalChunk}`.trim();
        setTranscript(finalTranscriptRef.current);
        setInterimTranscript('');

        if (!hasDispatchedFinalRef.current) {
          hasDispatchedFinalRef.current = true;
          onFinalTranscript?.(finalTranscriptRef.current);
          recognition.stop();
        }
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      setError(event.error === 'not-allowed' ? 'Microphone permission was denied.' : event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      cleanupRecognition();
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [cleanupRecognition, onFinalTranscript]);

  useEffect(() => () => stopListening(), [stopListening]);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
  };
};
