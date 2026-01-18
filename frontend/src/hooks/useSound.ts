import { useCallback, useRef } from 'react';

// Sound effect URLs - using free sound effects
// These are placeholder URLs - in production, use local files in /public/sounds/
const SOUNDS = {
  correct: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3', // Success chime
  wrong: 'https://assets.mixkit.co/active_storage/sfx/2001/2001-preview.mp3', // Error tone
  xp: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3', // Coin sound
  complete: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3', // Level complete
  click: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3', // UI click
  achievement: 'https://assets.mixkit.co/active_storage/sfx/2020/2020-preview.mp3', // Achievement unlock
} as const;

type SoundName = keyof typeof SOUNDS;

export function useSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback((name: SoundName, volume = 0.5) => {
    try {
      // Stop previous sound if playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const audio = new Audio(SOUNDS[name]);
      audio.volume = volume;
      audioRef.current = audio;

      // Play the sound
      audio.play().catch((err) => {
        // Ignore autoplay errors (user hasn't interacted yet)
        console.debug('Sound play failed:', err);
      });
    } catch (error) {
      console.debug('Sound error:', error);
    }
  }, []);

  const playWordAudio = useCallback((audioUrl: string) => {
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      const audio = new Audio(audioUrl);
      audio.volume = 0.7;
      audioRef.current = audio;

      audio.play().catch((err) => {
        console.debug('Word audio play failed:', err);
      });
    } catch (error) {
      console.debug('Word audio error:', error);
    }
  }, []);

  return { play, playWordAudio };
}

export type { SoundName };
