import React from 'react';
import { VideoMetadata } from '../types';
import { Sparkles, Tag, Film, AlignLeft, Info, Lock } from 'lucide-react';
import Button from './Button';

interface AIPanelProps {
  metadata: VideoMetadata | null;
  isAnalyzing: boolean;
  onAnalyze: () => void;
  isPremium: boolean;
  onUpgradeClick: () => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ metadata, isAnalyzing, onAnalyze, isPremium, onUpgradeClick }) => {
  return (
    <div className="bg-[#1a1a1a] rounded-xl border border-[#333] p-6 h-full flex flex-col relative overflow-hidden">
      <div className="flex items-center space-x-2 mb-6">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <h2 className="text-lg font-semibold text-white">Gemini AI Assistant</h2>
      </div>

      {/* Premium Lock Overlay */}
      {!isPremium && (
        <div className="absolute inset-0 z-20 bg-[#1a1a1a]/60 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center border border-[#333] rounded-xl">
             <div className="w-16 h-16 bg-[#222] rounded-full flex items-center justify-center mb-4 border border-[#333] shadow-xl">
                <Lock className="w-8 h-8 text-yellow-500" />
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Pro Feature</h3>
             <p className="text-sm text-gray-400 mb-6 max-w-xs">
                Upgrade to Premium to unlock AI analysis, smart tagging, and automated descriptions.
             </p>
             <Button onClick={onUpgradeClick} className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 border-none text-black font-bold">
                Unlock Now
             </Button>
        </div>
      )}

      {/* Actual Content (Blurred/Disabled visually if behind overlay) */}
      <div className={!isPremium ? 'filter blur-sm pointer-events-none select-none opacity-50' : ''}>
          {!metadata && !isAnalyzing && (
            <div className="flex flex-col items-center justify-center text-center space-y-4 opacity-60 mt-10">
                <Film className="w-12 h-12 text-gray-500" />
                <p className="text-sm text-gray-400">Generate metadata, smart tags, and mood analysis for your video.</p>
                <button 
                    onClick={onAnalyze}
                    className="mt-4 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full text-white font-medium hover:opacity-90 transition-opacity flex items-center space-x-2"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>Analyze Video</span>
                </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center space-y-4 mt-10">
                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                <p className="text-sm text-purple-300 animate-pulse">Gemini is watching your video...</p>
            </div>
          )}

          {metadata && !isAnalyzing && (
            <div className="space-y-6 animate-fade-in">
              
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                    <Film className="w-3 h-3 mr-1" /> Title Suggestion
                </label>
                <div className="bg-[#252525] p-3 rounded-lg border border-[#333] text-gray-100 font-medium">
                    {metadata.title}
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                    <AlignLeft className="w-3 h-3 mr-1" /> Description
                </label>
                <div className="bg-[#252525] p-3 rounded-lg border border-[#333] text-gray-300 text-sm leading-relaxed">
                    {metadata.description}
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                    <Info className="w-3 h-3 mr-1" /> Mood
                </label>
                <div className="flex items-center space-x-2">
                     <span className="px-3 py-1 rounded-full bg-purple-900/30 text-purple-300 text-xs border border-purple-800">
                        {metadata.mood}
                     </span>
                </div>
              </div>

              <div className="space-y-2">
                 <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center">
                    <Tag className="w-3 h-3 mr-1" /> Smart Tags
                </label>
                <div className="flex flex-wrap gap-2">
                    {metadata.tags?.map((tag, i) => (
                        <span key={i} className="px-2 py-1 bg-[#2a2a2a] border border-[#444] rounded text-xs text-gray-300 hover:bg-[#333] cursor-default transition-colors">
                            #{tag}
                        </span>
                    ))}
                </div>
              </div>
              
              <button 
                    onClick={onAnalyze}
                    className="w-full mt-4 py-2 text-xs text-gray-500 hover:text-white transition-colors flex items-center justify-center space-x-1"
                >
                    <Sparkles className="w-3 h-3" />
                    <span>Regenerate Analysis</span>
                </button>
            </div>
          )}
      </div>
    </div>
  );
};

export default AIPanel;