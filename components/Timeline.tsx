import React, { useRef, useCallback } from 'react';

interface TimelineProps {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  onSeek: (time: number) => void;
  onTrimChange: (start: number, end: number) => void;
}

const Timeline: React.FC<TimelineProps> = ({ 
  duration, 
  currentTime, 
  trimStart, 
  trimEnd, 
  onSeek,
  onTrimChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current || duration === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    onSeek(percentage * duration);
  }, [duration, onSeek]);

  // Calculate percentages for CSS
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const trimStartPercent = duration > 0 ? (trimStart / duration) * 100 : 0;
  const trimEndPercent = duration > 0 ? (trimEnd / duration) * 100 : 100;
  const trimWidthPercent = trimEndPercent - trimStartPercent;

  return (
    <div className="w-full flex flex-col space-y-2 select-none">
      <div className="flex justify-between text-xs text-gray-400 font-mono">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
      
      <div 
        ref={containerRef}
        className="relative h-12 bg-[#1a1a1a] rounded-lg cursor-pointer group overflow-hidden border border-[#333]"
        onClick={handleSeek}
      >
        {/* Background Ruler Lines (Simulated) */}
        <div className="absolute inset-0 flex justify-between px-2 opacity-20 pointer-events-none">
            {Array.from({ length: 20 }).map((_, i) => (
                <div key={i} className="w-[1px] h-full bg-gray-500 mt-4"></div>
            ))}
        </div>

        {/* Trim Active Area */}
        <div 
          className="absolute top-0 bottom-0 bg-blue-900/30 border-l-2 border-r-2 border-blue-500/50"
          style={{ 
            left: `${trimStartPercent}%`, 
            width: `${trimWidthPercent}%` 
          }}
        />

        {/* Playhead */}
        <div 
          className="absolute top-0 bottom-0 w-[2px] bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)] z-10 transition-all duration-75"
          style={{ left: `${progressPercent}%` }}
        >
            <div className="absolute -top-1 -left-[5px] w-3 h-3 bg-white rounded-full"></div>
        </div>

        {/* Start Handle (Mock functionality for UI demo) */}
        <div 
            className="absolute top-0 bottom-0 w-4 bg-blue-500 cursor-ew-resize flex items-center justify-center z-20 hover:bg-blue-400"
            style={{ left: `${trimStartPercent}%`, transform: 'translateX(-50%)' }}
            onClick={(e) => { e.stopPropagation(); }}
        >
            <div className="w-[2px] h-4 bg-white/50"></div>
        </div>

        {/* End Handle */}
         <div 
            className="absolute top-0 bottom-0 w-4 bg-blue-500 cursor-ew-resize flex items-center justify-center z-20 hover:bg-blue-400"
            style={{ left: `${trimEndPercent}%`, transform: 'translateX(-50%)' }}
            onClick={(e) => { e.stopPropagation(); }}
        >
             <div className="w-[2px] h-4 bg-white/50"></div>
        </div>

      </div>
      <div className="flex justify-between text-[10px] text-gray-500 uppercase tracking-wider">
        <span>Trim Start: {formatTime(trimStart)}</span>
        <span>Trim End: {formatTime(trimEnd)}</span>
      </div>
    </div>
  );
};

export default Timeline;