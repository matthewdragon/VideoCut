import React, { useRef, useEffect } from 'react';
import { Filter } from '../types';
import { Scissors } from 'lucide-react';

interface VideoPlayerProps {
  src: string;
  filter: Filter;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (duration: number) => void;
  onLoadedMetadata: (video: HTMLVideoElement) => void;
  isPlaying: boolean;
  currentTime: number;
  showWatermark?: boolean;
  playbackRate?: number;
  preservesPitch?: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  src, 
  filter, 
  onTimeUpdate, 
  onDurationChange, 
  onLoadedMetadata,
  isPlaying,
  currentTime,
  showWatermark = false,
  playbackRate = 1.0,
  preservesPitch = true
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(e => console.error("Play error:", e));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  // Sync playback rate and pitch preservation
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
      // Use type assertion for browser-specific or newer properties
      const videoEl = videoRef.current as any;
      if (videoEl.preservesPitch !== undefined) videoEl.preservesPitch = preservesPitch;
      else if (videoEl.mozPreservesPitch !== undefined) videoEl.mozPreservesPitch = preservesPitch;
      else if (videoEl.webkitPreservesPitch !== undefined) videoEl.webkitPreservesPitch = preservesPitch;
    }
  }, [playbackRate, preservesPitch]);

  // Sync external current time changes (seeking) to video element
  useEffect(() => {
    if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.5) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black rounded-xl overflow-hidden shadow-2xl border border-[#222]">
      <video
        ref={videoRef}
        src={src}
        className="max-w-full max-h-full object-contain"
        style={{ filter: filter.class }}
        onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
        onDurationChange={(e) => onDurationChange(e.currentTarget.duration)}
        onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget)}
        playsInline
      />
      
      {/* Watermark Overlay for Free Plan */}
      {showWatermark && (
        <div className="absolute bottom-6 right-6 z-20 pointer-events-none select-none opacity-60">
            <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded p-1">
                    <Scissors className="w-4 h-4 text-white" />
                </div>
                <span className="text-white font-black text-sm tracking-tight drop-shadow-md">VideoCut</span>
            </div>
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;