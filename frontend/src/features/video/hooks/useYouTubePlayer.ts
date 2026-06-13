import { useState, useEffect, useRef, useCallback } from 'react';

export interface YouTubePlayerStateType {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isReady: boolean;
  isFullscreen: boolean;
}

interface UseYouTubePlayerOptions {
  videoId: string;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onStateChange?: (state: number) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

let apiLoadPromise: Promise<void> | null = null;

const loadYouTubeApi = (): Promise<void> => {
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise((resolve, reject) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (existingScript) {
      window.onYouTubeIframeAPIReady = () => resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onload = () => {
      window.onYouTubeIframeAPIReady = () => resolve();
    };
    script.onerror = () => reject(new Error('YouTube API script failed to load'));
    document.head.appendChild(script);
    setTimeout(() => reject(new Error('YouTube API load timeout')), 10000);
  });
  return apiLoadPromise;
};

export function useYouTubePlayer(options: UseYouTubePlayerOptions) {
  const { videoId, onReady, onError, onStateChange } = options;
  const [state, setState] = useState<YouTubePlayerStateType>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 100,
    isMuted: false,
    isReady: false,
    isFullscreen: false,
  });
  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isSeekingRef = useRef(false);

  const updateTime = useCallback(() => {
    if (!playerRef.current || isSeekingRef.current) return;
    try {
      const current = playerRef.current.getCurrentTime();
      const duration = playerRef.current.getDuration();
      setState(prev => ({ ...prev, currentTime: current, duration: duration || prev.duration }));
    } catch (e) {}
  }, []);

  const startTimeUpdate = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(updateTime, 250);
  }, [updateTime]);

  const stopTimeUpdate = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const initializePlayer = useCallback(async (element: HTMLDivElement) => {
    if (!element) {
      onError?.(new Error('No container element'));
      return;
    }
    // Clear any existing content
    while (element.firstChild) element.removeChild(element.firstChild);
    
    try {
      await loadYouTubeApi();
      if (!window.YT || !window.YT.Player) throw new Error('YT not available');

      playerRef.current = new window.YT.Player(element, {
        videoId,
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 1,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          fs: 0,
          disablekb: 1,
          showinfo: 0,
        },
        events: {
          onReady: (event: any) => {
            setState(prev => ({ ...prev, isReady: true, duration: event.target.getDuration() }));
            onReady?.();
            startTimeUpdate();
          },
          onStateChange: (event: any) => {
            const ps = event.data;
            setState(prev => ({ ...prev, isPlaying: ps === 1 }));
            if (ps === 1) startTimeUpdate();
            else if (ps === 2 || ps === 0) stopTimeUpdate();
            onStateChange?.(ps);
          },
          onError: (err: any) => {
            console.error('YouTube player error:', err);
            onError?.(new Error(`Player error code ${err.data}`));
            setState(prev => ({ ...prev, isReady: false }));
          },
        },
      });
    } catch (err) {
      console.error('Failed to initialize YouTube player:', err);
      const error = err instanceof Error ? err : new Error('Player initialization failed');
      onError?.(error);
      setState(prev => ({ ...prev, isReady: false }));
    }
  }, [videoId, onReady, onError, onStateChange, startTimeUpdate, stopTimeUpdate]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const seekTo = useCallback((seconds: number) => {
    if (!playerRef.current) return;
    isSeekingRef.current = true;
    playerRef.current.seekTo(seconds, true);
    setTimeout(() => { isSeekingRef.current = false; updateTime(); }, 100);
  }, [updateTime]);
  const setVolume = useCallback((value: number) => {
    if (!playerRef.current) return;
    const vol = Math.min(100, Math.max(0, value));
    playerRef.current.setVolume(vol);
    setState(prev => ({ ...prev, volume: vol, isMuted: vol === 0 }));
  }, []);
  const toggleMute = useCallback(() => {
    if (!playerRef.current) return;
    if (state.isMuted) {
      playerRef.current.unMute();
      const vol = playerRef.current.getVolume();
      setState(prev => ({ ...prev, isMuted: false, volume: vol }));
    } else {
      playerRef.current.mute();
      setState(prev => ({ ...prev, isMuted: true, volume: 0 }));
    }
  }, [state.isMuted]);
  const togglePlayPause = useCallback(() => state.isPlaying ? pause() : play(), [state.isPlaying, play, pause]);

  // Modified fullscreen function – can target any element, defaults to containerRef.current
  const toggleFullscreen = useCallback((element?: HTMLElement | null) => {
    const target = element || containerRef.current;
    if (!target) return;
    if (!document.fullscreenElement) {
      target.requestFullscreen?.().catch(e => console.warn('Fullscreen request failed:', e));
      setState(prev => ({ ...prev, isFullscreen: true }));
    } else {
      document.exitFullscreen();
      setState(prev => ({ ...prev, isFullscreen: false }));
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setState(prev => ({ ...prev, isFullscreen: !!document.fullscreenElement }));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      if (intervalRef.current) clearInterval(intervalRef.current);
      playerRef.current?.destroy();
    };
  }, []);

  return { containerRef, initializePlayer, state, play, pause, seekTo, setVolume, toggleMute, togglePlayPause, toggleFullscreen };
}