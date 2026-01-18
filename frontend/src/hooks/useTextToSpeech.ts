import { useState, useCallback, useRef } from 'react';

export function useTextToSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentText, setCurrentText] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const stop = useCallback(() => {
    // Increment request ID to invalidate any pending requests
    requestIdRef.current++;

    // Abort any pending fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }

    // Also stop browser speech synthesis as fallback
    window.speechSynthesis.cancel();

    setIsSpeaking(false);
    setCurrentText(null);
    setIsLoading(false);
  }, []);

  const speakWithGoogleTTS = useCallback(async (text: string, requestId: number): Promise<boolean> => {
    try {
      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
        signal: abortControllerRef.current.signal,
      });

      // Check if this request is still valid
      if (requestIdRef.current !== requestId) {
        return false;
      }

      if (!response.ok) {
        return false;
      }

      const data = await response.json();

      // Check again if request is still valid
      if (requestIdRef.current !== requestId) {
        return false;
      }

      if (!data.audioContent) {
        return false;
      }

      // Create audio from base64
      const audioBlob = await fetch(`data:audio/mp3;base64,${data.audioContent}`).then(r => r.blob());

      // Check again if request is still valid
      if (requestIdRef.current !== requestId) {
        return false;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        setIsLoading(false);
      };

      audio.onended = () => {
        setIsSpeaking(false);
        setCurrentText(null);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        setCurrentText(null);
        setIsLoading(false);
        URL.revokeObjectURL(audioUrl);
        audioRef.current = null;
      };

      // Final check before playing
      if (requestIdRef.current !== requestId) {
        URL.revokeObjectURL(audioUrl);
        return false;
      }

      await audio.play();
      return true;
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        return false;
      }
      console.error('Google TTS error:', error);
      return false;
    }
  }, []);

  const speakWithBrowserTTS = useCallback((text: string) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(
      (v) => v.lang.startsWith('en') && v.name.includes('Samantha')
    ) || voices.find(
      (v) => v.lang.startsWith('en-US')
    ) || voices.find(
      (v) => v.lang.startsWith('en')
    );

    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsLoading(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setCurrentText(null);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setCurrentText(null);
      setIsLoading(false);
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const speak = useCallback(async (text: string) => {
    // Stop any current audio first
    stop();

    if (!text.trim()) return;

    // Capture the current request ID for this speech request
    const currentRequestId = requestIdRef.current;

    setCurrentText(text);
    setIsLoading(true);

    // Try Google TTS first, fallback to browser TTS
    const success = await speakWithGoogleTTS(text, currentRequestId);

    // Check if this request is still valid (not superseded by another)
    if (requestIdRef.current !== currentRequestId) {
      return;
    }

    if (!success) {
      console.log('Falling back to browser TTS');
      speakWithBrowserTTS(text);
    }
  }, [stop, speakWithGoogleTTS, speakWithBrowserTTS]);

  const toggle = useCallback((text: string) => {
    if (isSpeaking || isLoading) {
      stop();
    } else {
      speak(text);
    }
  }, [isSpeaking, isLoading, speak, stop]);

  return {
    speak,
    stop,
    toggle,
    isSpeaking,
    isLoading,
    currentText,
  };
}
