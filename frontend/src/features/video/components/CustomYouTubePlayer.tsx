'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { FiPlay, FiPause, FiVolume2, FiVolumeX, FiMaximize, FiMinimize } from 'react-icons/fi';
import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import styles from './CustomYouTubePlayer.module.css';

interface CustomYouTubePlayerProps {
  videoId: string;
  thumbnailSrc: string;
  title?: string;
  className?: string;
}

const CustomYouTubePlayer: React.FC<CustomYouTubePlayerProps> = ({
  videoId,
  thumbnailSrc,
  title,
  className,
}) => {
  const [hasStarted, setHasStarted] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  const {
    containerRef,
    initializePlayer,
    state,
    seekTo,
    setVolume,
    toggleMute,
    togglePlayPause,
    toggleFullscreen,
  } = useYouTubePlayer({
    videoId,
    onError: (err) => {
      console.error('YouTube error:', err);
      setPlayerError(err.message);
      setIsLoading(false);
    },
    onReady: () => {
      console.log('YouTube player ready');
      setPlayerError(null);
      setIsLoading(false);
    },
  });

  const { isPlaying, currentTime, duration, volume, isMuted, isReady, isFullscreen } = state;

  const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Update thumb position without React re-render (for smooth dragging)
  const updateThumbPosition = useCallback((percent: number) => {
    if (thumbRef.current) {
      thumbRef.current.style.left = `${percent}%`;
    }
  }, []);

  // Seek from mouse/touch position
  const handleSeekDrag = useCallback((clientX: number) => {
    if (!progressBarRef.current || !isReady || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = Math.min(Math.max(0, clientX - rect.left), rect.width);
    const percent = x / rect.width;
    const newTime = percent * duration;
    // Update thumb instantly for visual feedback
    updateThumbPosition(percent * 100);
    // Seek the video (this will eventually update React state and move thumb again)
    seekTo(newTime);
  }, [isReady, duration, seekTo, updateThumbPosition]);

  // --- Global drag listeners (attached once) ---
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        handleSeekDrag(e.clientX);
      }
    };
    const onMouseUp = () => {
      isDraggingRef.current = false;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isDraggingRef.current) {
        e.preventDefault();
        const touch = e.touches[0];
        if (touch) handleSeekDrag(touch.clientX);
      }
    };
    const onTouchEnd = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [handleSeekDrag]);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    handleSeekDrag(e.clientX);
  };

  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    isDraggingRef.current = true;
    const touch = e.touches[0];
    handleSeekDrag(touch.clientX);
  };

  const handlePlayClick = async () => {
    if (!hasStarted) {
      setHasStarted(true);
      setIsLoading(true);
      setPlayerError(null);
      await new Promise(r => setTimeout(r, 50));
      if (containerRef.current) {
        await initializePlayer(containerRef.current);
      } else {
        setPlayerError('Container not ready');
        setIsLoading(false);
      }
    } else {
      togglePlayPause();
    }
  };

  const startControlsTimer = () => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (!isMobile && isPlaying && !isFullscreen) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2000);
    }
  };

  const handleMouseMove = () => {
    if (!isMobile && isPlaying && !isFullscreen) {
      setShowControls(true);
      startControlsTimer();
    }
  };

  useEffect(() => {
    if (hasStarted && isReady && isPlaying && !isMobile && !isFullscreen) {
      startControlsTimer();
    } else if (isFullscreen || isMobile) {
      setShowControls(true);
    }
    return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); };
  }, [hasStarted, isReady, isPlaying, isMobile, isFullscreen]);

  // Sync thumb position when progress changes (from seek or time update)
  useEffect(() => {
    if (!isDraggingRef.current) {
      updateThumbPosition(progressPercent);
    }
  }, [progressPercent, updateThumbPosition]);

  const showThumbnail = !hasStarted && !playerError;
  const shouldShowControls = hasStarted && isReady && !playerError;

  const handleThumbnailError = () => setThumbnailError(true);
  const handleRetry = () => {
    setPlayerError(null);
    setHasStarted(false);
    setIsLoading(false);
    setThumbnailError(false);
  };

  // Fullscreen: use the outer wrapper (videoWrapperRef)
  const handleFullscreen = () => {
    toggleFullscreen(videoWrapperRef.current);
  };

  return (
    <div className={`${styles.playerContainer} ${className || ''}`}>
      <div
        ref={videoWrapperRef}
        className={styles.videoWrapper}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => !isMobile && isPlaying && !isFullscreen && setShowControls(false)}
      >
        <div ref={containerRef} className={styles.videoInner} />

        {showThumbnail && (
          <div className={styles.thumbnailOverlay}>
            {!thumbnailError ? (
              <img
                src={thumbnailSrc}
                alt={title || 'Video'}
                className={styles.thumbnail}
                onError={handleThumbnailError}
              />
            ) : (
              <div className={styles.thumbnailPlaceholder}>🎬</div>
            )}
            <button className={styles.playButton} onClick={handlePlayClick} disabled={isLoading}>
              {isLoading ? <div className={styles.spinnerSmall} /> : <FiPlay />}
            </button>
          </div>
        )}

        {playerError && (
          <div className={styles.errorOverlay}>
            <div className={styles.errorMessage}>
              <p>{playerError}</p>
              <button onClick={handleRetry} className={styles.retryButton}>Retry</button>
            </div>
          </div>
        )}
      </div>

      {shouldShowControls && (
        <div className={`${styles.controlsBar} ${showControls || !isPlaying || isFullscreen ? styles.visible : ''}`}>
          <button className={styles.controlButton} onClick={togglePlayPause}>
            {isPlaying ? <FiPause /> : <FiPlay />}
          </button>
          <div className={styles.timeDisplay}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
          <div
            className={styles.progressBar}
            ref={progressBarRef}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
          >
            <div className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
            <div className={styles.progressThumb} ref={thumbRef} style={{ left: `${progressPercent}%` }} />
          </div>
          <div className={styles.volumeControl}>
            <button className={styles.controlButton} onClick={toggleMute}>
              {isMuted || volume === 0 ? <FiVolumeX /> : <FiVolume2 />}
            </button>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseInt(e.target.value, 10))}
              className={styles.volumeSlider}
            />
          </div>
          <button className={styles.controlButton} onClick={handleFullscreen}>
            {isFullscreen ? <FiMinimize /> : <FiMaximize />}
          </button>
        </div>
      )}

      {title && <h3 className={styles.videoTitle}>{title}</h3>}
    </div>
  );
};

export default dynamic(() => Promise.resolve(CustomYouTubePlayer), { ssr: false });