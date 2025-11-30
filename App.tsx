import React, { useState, useRef, useEffect } from 'react';
import { VideoFile, EditorState, Filter, FILTERS, VideoMetadata } from './types';
import VideoPlayer from './components/VideoPlayer';
import Timeline from './components/Timeline';
import AIPanel from './components/AIPanel';
import Button from './components/Button';
import PricingModal, { ModalView } from './components/PricingModal';
import { Upload, Play, Pause, Download, Scissors, X, Wand2, Crown, Lock, CheckCircle2, AlertTriangle, Gauge, Mic2, Minus, Plus, Timer, History } from 'lucide-react';
import { analyzeVideoFrames } from './services/geminiService';

const App: React.FC = () => {
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null);
  const [state, setState] = useState<EditorState>(EditorState.IDLE);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [activeFilter, setActiveFilter] = useState<Filter>(FILTERS[0]);
  
  // Speed & Pitch
  const [playbackRate, setPlaybackRate] = useState(1.00);
  const [preservesPitch, setPreservesPitch] = useState(true);

  // User/Plan State
  // We now track the type of premium: 'none', 'subscription', 'pass'
  const [premiumType, setPremiumType] = useState<'subscription' | 'pass' | 'none'>(() => {
     return (localStorage.getItem('videocut_premium_type') as 'subscription' | 'pass' | 'none') || 'none';
  });
  
  // Pass Expiry (timestamp)
  const [passExpiry, setPassExpiry] = useState<number | null>(() => {
      const stored = localStorage.getItem('videocut_pass_expiry');
      return stored ? parseInt(stored) : null;
  });

  const [isPremium, setIsPremium] = useState(false); // Derived from premiumType + expiry logic

  const [showPricing, setShowPricing] = useState(false);
  const [pricingInitialView, setPricingInitialView] = useState<ModalView>('PLANS');
  const [isReviewing, setIsReviewing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLimitReached, setShowLimitReached] = useState(false);

  // Free Plan Limits State
  const [exportCount, setExportCount] = useState(() => {
     return parseInt(localStorage.getItem('videocut_export_count') || '0');
  });
  const [cycleStart, setCycleStart] = useState(() => {
     const stored = localStorage.getItem('videocut_cycle_start');
     return stored ? parseInt(stored) : Date.now();
  });

  // AI State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);

  // --- PREMIUM LOGIC & EFFECTS ---

  // Update isPremium based on type and timer
  useEffect(() => {
      const checkPremiumStatus = () => {
          if (premiumType === 'subscription') {
              setIsPremium(true);
          } else if (premiumType === 'pass' && passExpiry) {
              const now = Date.now();
              if (now < passExpiry) {
                  setIsPremium(true);
              } else {
                  // Expired
                  setIsPremium(false);
                  setPremiumType('none');
                  setPassExpiry(null);
                  localStorage.removeItem('videocut_pass_expiry');
                  localStorage.setItem('videocut_premium_type', 'none');
              }
          } else {
              setIsPremium(false);
          }
      };

      checkPremiumStatus();
      
      // If we have an active pass, check every second
      let interval: ReturnType<typeof setInterval> | undefined;
      if (premiumType === 'pass' && passExpiry) {
          interval = setInterval(checkPremiumStatus, 1000);
      }

      return () => { if (interval) clearInterval(interval); };
  }, [premiumType, passExpiry]);

  // Downgrade Timer Logic (Review process simulation)
  useEffect(() => {
    if (isReviewing) {
        const timer = setTimeout(() => {
            setPremiumType('none');
            setPassExpiry(null);
            localStorage.setItem('videocut_premium_type', 'none');
            setIsReviewing(false);
        }, 10000); 
        return () => clearTimeout(timer);
    }
  }, [isReviewing]);

  // --- EXPORT LIMIT LOGIC ---
  const checkExportLimit = (): boolean => {
      if (isPremium) return true; // No limits for premium

      const now = Date.now();
      const TWO_WEEKS = 14 * 24 * 60 * 60 * 1000;

      // Check if cycle needs reset
      if (now - cycleStart > TWO_WEEKS) {
          // Reset cycle
          setCycleStart(now);
          setExportCount(0);
          localStorage.setItem('videocut_cycle_start', now.toString());
          localStorage.setItem('videocut_export_count', '0');
          return true; // Count became 0, so valid
      }

      // Check count
      if (exportCount >= 2) {
          setShowLimitReached(true);
          return false;
      }

      return true;
  };

  const incrementExportCount = () => {
      if (isPremium) return;
      const newCount = exportCount + 1;
      setExportCount(newCount);
      localStorage.setItem('videocut_export_count', newCount.toString());
      if (exportCount === 0) {
          // ensure cycle start is set on first export if vague
          localStorage.setItem('videocut_cycle_start', cycleStart.toString());
      }
  };

  // --- RENDERING LOGIC ---
  const renderVideo = async (file: File, options: {
      filter: string;
      trimStart: number;
      trimEnd: number;
      playbackRate: number;
      preservesPitch: boolean;
      isPremium: boolean;
  }): Promise<Blob> => {
      return new Promise(async (resolve, reject) => {
          try {
              const video = document.createElement('video');
              video.src = URL.createObjectURL(file);
              video.crossOrigin = "anonymous";
              video.muted = false; // Need audio
              video.preload = "auto";
              
              // Wait for metadata
              await new Promise((r) => { video.onloadedmetadata = r; });

              // Audio Context for capturing audio
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const dest = audioCtx.createMediaStreamDestination();
              const source = audioCtx.createMediaElementSource(video);
              source.connect(dest);
              // Do not connect to audioCtx.destination to prevent hearing it during render

              const canvas = document.createElement('canvas');
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              const ctx = canvas.getContext('2d');
              
              if (!ctx) throw new Error("Could not create canvas context");

              const stream = canvas.captureStream(30); // 30 FPS
              const audioTrack = dest.stream.getAudioTracks()[0];
              if (audioTrack) stream.addTrack(audioTrack);

              const recorder = new MediaRecorder(stream, {
                  mimeType: 'video/webm;codecs=vp9'
              });

              const chunks: BlobPart[] = [];
              recorder.ondataavailable = (e) => {
                  if (e.data.size > 0) chunks.push(e.data);
              };

              recorder.onstop = () => {
                  const blob = new Blob(chunks, { type: 'video/webm' });
                  audioCtx.close();
                  URL.revokeObjectURL(video.src);
                  resolve(blob);
              };

              // Apply Settings
              video.currentTime = options.trimStart;
              video.playbackRate = options.playbackRate;
              if ((video as any).preservesPitch !== undefined) (video as any).preservesPitch = options.preservesPitch;
              else if ((video as any).mozPreservesPitch !== undefined) (video as any).mozPreservesPitch = options.preservesPitch;

              recorder.start();
              await video.play();

              const draw = () => {
                  if (video.paused || video.ended) return;
                  
                  // Apply Filter
                  ctx.filter = options.filter;
                  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                  
                  // Apply Watermark if free
                  if (!options.isPremium) {
                      ctx.filter = 'none'; // Reset filter for watermark
                      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
                      ctx.font = `bold ${canvas.height * 0.05}px sans-serif`;
                      const text = "VideoCut";
                      const metrics = ctx.measureText(text);
                      const padding = 20;
                      const x = canvas.width - metrics.width - padding;
                      const y = canvas.height - padding;
                      
                      // Background pill
                      ctx.beginPath();
                      ctx.roundRect(x - 10, y - (canvas.height * 0.05), metrics.width + 20, (canvas.height * 0.05) + 10, 10);
                      ctx.fill();

                      ctx.fillStyle = 'white';
                      ctx.fillText(text, x, y);
                  }

                  // Check Trim End
                  if (video.currentTime >= options.trimEnd) {
                      video.pause();
                      recorder.stop();
                  } else {
                      requestAnimationFrame(draw);
                  }
              };

              draw();

              // Fallback stop if video naturally ends before trimEnd (shouldn't happen if logic correct but safe)
              video.onended = () => {
                  if (recorder.state === 'recording') recorder.stop();
              };

          } catch (e) {
              reject(e);
          }
      });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoFile({
        file,
        url,
        duration: 0,
        name: file.name,
        type: file.type
      });
      setState(EditorState.EDITING);
      // Reset State
      setMetadata(null);
      setActiveFilter(FILTERS[0]);
      setIsPlaying(false);
      setCurrentTime(0);
      setPlaybackRate(1.00);
    }
  };

  const handleMetadataLoaded = (video: HTMLVideoElement) => {
    videoElementRef.current = video;
    setDuration(video.duration);
    setTrimEnd(video.duration);
    setTrimStart(0);
  };

  const togglePlay = () => setIsPlaying(!isPlaying);

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let val = parseFloat(e.target.value);
      if (isNaN(val)) return; 
      // Clamp strictly between 1.00 and 8.00 (min/max also set on input)
      if (val < 1.00) val = 1.00;
      if (val > 8.00) val = 8.00;
      setPlaybackRate(val);
  };

  const adjustSpeed = (amount: number) => {
      setPlaybackRate(prev => {
          const newVal = Math.min(8.00, Math.max(1.00, prev + amount));
          // Round to 2 decimals to avoid floating point errors
          return Math.round(newVal * 100) / 100;
      });
  };

  const captureFrames = async (): Promise<string[]> => {
    if (!videoElementRef.current) return [];
    
    const video = videoElementRef.current;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return [];

    canvas.width = video.videoWidth / 4; // Lower res for API efficiency
    canvas.height = video.videoHeight / 4;
    
    const frames: string[] = [];
    const timestamps = [0.1, video.duration * 0.5, video.duration * 0.9];
    const originalTime = video.currentTime;
    const wasPlaying = !video.paused;
    const originalRate = video.playbackRate;

    if (wasPlaying) video.pause();

    try {
        for (const time of timestamps) {
            video.currentTime = time;
            await new Promise(r => setTimeout(r, 200)); // Wait for seek
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            // Get base64 without prefix for Gemini API
            const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
            frames.push(base64);
        }
    } finally {
        video.currentTime = originalTime;
        video.playbackRate = originalRate;
        if (wasPlaying) video.play();
    }
    
    return frames;
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
        const frames = await captureFrames();
        if (frames.length > 0) {
            const result = await analyzeVideoFrames(frames);
            setMetadata(result);
        }
    } catch (error) {
        console.error("Analysis failed", error);
        alert("Failed to analyze video. Check console or API Key.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleExport = async () => {
    if (!videoFile) return;

    // CHECK LIMITS
    if (!checkExportLimit()) return;

    setState(EditorState.EXPORTING);
    
    // NOTE: In a real browser environment without cross-origin isolation (COOP/COEP),
    // processing large videos or videos from different origins can be restricted.
    // Since we use local file selection, it works.

    try {
      const processedBlob = await renderVideo(videoFile.file, {
          filter: activeFilter.class,
          trimStart,
          trimEnd: trimEnd || duration,
          playbackRate,
          preservesPitch,
          isPremium
      });

      // Create a download link for the Blob
      const url = URL.createObjectURL(processedBlob);
      const a = document.createElement('a');
      a.href = url;
      
      // Determine filename based on plan (simulating watermarking)
      const prefix = !isPremium ? 'watermarked_' : '';
      // WebM is the typical output of MediaRecorder in Chrome
      a.download = `${prefix}edited_${videoFile.name.split('.')[0]}.webm`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);

      // Increment limit count if successful and free
      incrementExportCount();

    } catch (e) {
      console.error("Export failed", e);
      alert("Failed to render video. Browser support for MediaRecorder required.");
    }

    setState(EditorState.EDITING);
  };

  const handleClose = () => {
      if(videoFile?.url) URL.revokeObjectURL(videoFile.url);
      setVideoFile(null);
      setState(EditorState.IDLE);
  };

  // Helper to handle filter click
  const handleFilterClick = (f: Filter, index: number) => {
      // Logic: If user is not premium, they can only access index 0, 1, 2.
      if (!isPremium && index > 2) {
          setPricingInitialView('PLANS');
          setShowPricing(true);
          return;
      }
      setActiveFilter(f);
  };

  const handleUpgrade = (type: 'subscription' | 'pass') => {
      if (type === 'pass') {
          const expiry = Date.now() + 5 * 60 * 1000; // 5 minutes from now
          setPremiumType('pass');
          setPassExpiry(expiry);
          localStorage.setItem('videocut_premium_type', 'pass');
          localStorage.setItem('videocut_pass_expiry', expiry.toString());
      } else {
          setPremiumType('subscription');
          setPassExpiry(null);
          localStorage.setItem('videocut_premium_type', 'subscription');
          localStorage.removeItem('videocut_pass_expiry');
      }
      
      setShowPricing(false);
      setShowWelcome(true);
  };

  const handleDowngradeSubmit = () => {
      // Close modal, start review process
      setShowPricing(false);
      setIsReviewing(true);
  };

  const openPricing = (view: ModalView = 'PLANS') => {
      setPricingInitialView(view);
      setShowPricing(true);
  };

  const getPassTimeRemaining = () => {
      if (!passExpiry) return '0:00';
      const diff = Math.max(0, passExpiry - Date.now());
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (state === EditorState.IDLE) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f0f0f] p-4 relative overflow-hidden">
        {/* Welcome Modal */}
        {showWelcome && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowWelcome(false)}>
                <div className="bg-[#141414] border border-[#333] rounded-3xl p-10 text-center max-w-lg shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 pointer-events-none"></div>
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/30">
                        <Crown className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4">Welcome to Premium!</h2>
                    <p className="text-gray-400 mb-8">You now have full access to all filters, AI analysis, and unlimited 4K exports. Create something amazing!</p>
                    <Button onClick={() => setShowWelcome(false)} className="w-full py-3 text-lg bg-gradient-to-r from-yellow-500 to-orange-600 border-none">
                        Get Started
                    </Button>
                </div>
            </div>
        )}

        {showPricing && (
            <PricingModal 
                onClose={() => setShowPricing(false)} 
                onUpgrade={handleUpgrade}
                onDowngradeSubmit={handleDowngradeSubmit}
                isPremium={isPremium}
                premiumType={premiumType}
                initialView={pricingInitialView}
            />
        )}
        
        {/* Top Right Controls */}
        <div className="absolute top-6 right-6 flex items-center space-x-4">
            {isReviewing && (
                <div className="flex items-center space-x-2 bg-yellow-900/30 border border-yellow-700/50 px-4 py-2 rounded-full animate-pulse">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <span className="text-xs font-bold text-yellow-500">Review In Progress</span>
                </div>
            )}

            {!isPremium ? (
                 <Button 
                    className="bg-gradient-to-r from-yellow-600 to-orange-600 border-none text-white font-bold"
                    icon={<Crown className="w-4 h-4" />}
                    onClick={() => openPricing('PLANS')}
                 >
                    Upgrade to Pro
                 </Button>
            ) : (
                <button 
                    onClick={() => openPricing('MANAGE')}
                    className="flex items-center space-x-2 px-4 py-2 bg-[#1a1a1a] rounded-full border border-yellow-600/30 hover:bg-[#222] transition-colors"
                >
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <div className="flex flex-col items-start">
                        <span className="text-sm font-bold text-yellow-500 leading-none">
                            {premiumType === 'pass' ? 'Pass Active' : 'Pro Active'}
                        </span>
                        {premiumType === 'pass' && (
                            <span className="text-[10px] font-mono text-yellow-300/70 leading-none mt-1">
                                {getPassTimeRemaining()}
                            </span>
                        )}
                    </div>
                </button>
            )}
        </div>

        <div className="text-center space-y-8 max-w-4xl w-full py-12 z-10">
            <div className="mb-8">
                <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 mb-4">
                    VideoCut
                </h1>
                <p className="text-gray-400 text-lg">
                    Professional browser-based editor powered by Gemini AI.
                </p>
            </div>
            
            <div 
                className="max-w-lg mx-auto border-2 border-dashed border-[#333] hover:border-blue-500 hover:bg-[#1a1a1a] rounded-3xl p-12 transition-all cursor-pointer group mb-16"
                onClick={() => fileInputRef.current?.click()}
            >
                <div className="w-20 h-20 bg-[#222] rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                    <Upload className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Upload Video</h3>
                <p className="text-gray-500 text-sm">Drag & Drop or Click to Browse</p>
                <p className="text-gray-600 text-xs mt-4">MP4, MOV, WebM supported</p>
            </div>

            {/* Pricing / Plan Comparison Section */}
            <div className="grid md:grid-cols-2 gap-6 text-left">
                {/* Free Plan Card */}
                <div className={`p-6 rounded-2xl border ${!isPremium ? 'border-green-500/50 bg-green-900/10' : 'border-[#333] bg-[#141414]'} transition-colors relative overflow-hidden`}>
                     {/* "Current Plan" Badge for Free users */}
                     {!isPremium && (
                        <div className="absolute top-0 right-0 bg-green-500 text-black text-xs font-bold px-3 py-1 rounded-bl-xl">
                            CURRENT PLAN
                        </div>
                     )}

                     <h3 className="text-xl font-bold text-white mb-2">Free Plan</h3>
                     <div className="text-3xl font-black text-white mb-4">$0 <span className="text-sm font-normal text-gray-400">/ forever</span></div>
                     
                     <ul className="space-y-3 mb-6">
                        <li className="flex items-center text-gray-300 text-sm"><History className="w-4 h-4 mr-2 text-green-500"/> 2 Exports per 2 weeks</li>
                        <li className="flex items-center text-gray-300 text-sm"><CheckCircle2 className="w-4 h-4 mr-2 text-green-500"/> Access to 3 Basic Filters</li>
                        <li className="flex items-center text-gray-500 text-sm"><Lock className="w-4 h-4 mr-2"/> No AI Analysis</li>
                        <li className="flex items-center text-gray-500 text-sm"><Lock className="w-4 h-4 mr-2"/> Watermarked Export</li>
                     </ul>

                     <button 
                        disabled={!isPremium} 
                        onClick={() => {
                            if (isPremium) openPricing('FEEDBACK');
                        }}
                        className={`w-full py-2 rounded-lg font-bold text-sm transition-colors ${
                            !isPremium 
                            ? 'bg-green-600/20 text-green-500 cursor-default' 
                            : 'bg-[#222] text-white hover:bg-[#333] cursor-pointer'
                        }`}
                     >
                         {!isPremium ? 'Active' : 'Switch to Free'}
                     </button>
                     {!isPremium && (
                        <div className="mt-4 pt-4 border-t border-green-900/30 text-xs text-gray-400 text-center">
                            Exports Used: <span className="text-white font-bold">{exportCount}/2</span>
                        </div>
                     )}
                </div>

                {/* Premium Plan Card */}
                <div className={`p-6 rounded-2xl border ${isPremium ? 'border-yellow-500/50 bg-yellow-900/10' : 'border-[#333] bg-[#141414]'} transition-colors relative overflow-hidden`}>
                     {isPremium && (
                        <div className="absolute top-0 right-0 bg-yellow-500 text-black text-xs font-bold px-3 py-1 rounded-bl-xl">
                            CURRENT PLAN
                        </div>
                     )}

                     <h3 className="text-xl font-bold text-white mb-2 flex items-center">
                        Premium Plan <Crown className="w-5 h-5 ml-2 text-yellow-500" />
                     </h3>
                     <div className="text-3xl font-black text-white mb-4">$25.00 <span className="text-sm font-normal text-gray-400">/ month</span></div>
                     
                     <ul className="space-y-3 mb-6">
                        <li className="flex items-center text-gray-300 text-sm"><CheckCircle2 className="w-4 h-4 mr-2 text-yellow-500"/> Unlock All 8+ Filters</li>
                        <li className="flex items-center text-gray-300 text-sm"><CheckCircle2 className="w-4 h-4 mr-2 text-yellow-500"/> Gemini AI Metadata Assistant</li>
                        <li className="flex items-center text-gray-300 text-sm"><CheckCircle2 className="w-4 h-4 mr-2 text-yellow-500"/> Priority 4K Export</li>
                        <li className="flex items-center text-gray-300 text-sm"><CheckCircle2 className="w-4 h-4 mr-2 text-yellow-500"/> No Watermark</li>
                     </ul>

                     {isPremium ? (
                         <button 
                            onClick={() => openPricing('MANAGE')}
                            className="w-full py-2 rounded-lg font-bold text-sm bg-yellow-600/20 text-yellow-500 border border-yellow-600/50 hover:bg-yellow-600/30 transition-colors"
                         >
                             Manage Subscription
                         </button>
                     ) : (
                         <button 
                            onClick={() => openPricing('PLANS')}
                            className="w-full py-2 rounded-lg font-bold text-sm bg-gradient-to-r from-yellow-600 to-orange-600 text-white hover:opacity-90 transition-opacity shadow-lg shadow-orange-900/20"
                         >
                             Upgrade Now
                         </button>
                     )}
                </div>
            </div>

            <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="video/*" 
                onChange={handleFileSelect}
            />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-gray-100 flex flex-col font-sans">
      {showWelcome && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in" onClick={() => setShowWelcome(false)}>
                <div className="bg-[#141414] border border-[#333] rounded-3xl p-10 text-center max-w-lg shadow-2xl relative overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 pointer-events-none"></div>
                    <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/30">
                        <Crown className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="text-3xl font-black text-white mb-4">Welcome to Premium!</h2>
                    <p className="text-gray-400 mb-8">You now have full access to all filters, AI analysis, and unlimited 4K exports.</p>
                    {premiumType === 'pass' && (
                        <p className="text-purple-400 font-bold mb-8 animate-pulse">Your 5 Minute Pass is active!</p>
                    )}
                    <Button onClick={() => setShowWelcome(false)} className="w-full py-3 text-lg bg-gradient-to-r from-yellow-500 to-orange-600 border-none">
                        Get Started
                    </Button>
                </div>
            </div>
      )}

      {showLimitReached && (
           <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#141414] border border-red-900/50 rounded-2xl p-8 text-center max-w-md shadow-2xl">
                  <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-900/50">
                      <Lock className="w-8 h-8 text-red-500" />
                  </div>
                  <h2 className="text-2xl font-bold text-white mb-2">Export Limit Reached</h2>
                  <p className="text-gray-400 mb-6 text-sm">
                      You have reached your limit of 2 exports per 2 weeks on the Free Plan. 
                      Upgrade to Pro for unlimited exports.
                  </p>
                  <div className="flex flex-col space-y-3">
                      <Button onClick={() => setShowLimitReached(false)} variant="secondary">
                          Close
                      </Button>
                      <Button 
                        onClick={() => {
                            setShowLimitReached(false);
                            openPricing('PLANS');
                        }} 
                        className="bg-gradient-to-r from-yellow-600 to-orange-600 border-none"
                    >
                          Upgrade to Unlimited
                      </Button>
                  </div>
              </div>
           </div>
      )}
      
      {showPricing && (
            <PricingModal 
                onClose={() => setShowPricing(false)} 
                onUpgrade={handleUpgrade}
                onDowngradeSubmit={handleDowngradeSubmit}
                isPremium={isPremium}
                premiumType={premiumType}
                initialView={pricingInitialView}
            />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 h-16 border-b border-[#222] bg-[#141414]/90 backdrop-blur flex items-center justify-between px-6 shadow-md">
        <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <Scissors className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">VideoCut</span>
        </div>

        {/* Review Banner for Editor View */}
        {isReviewing && (
             <div className="hidden md:flex items-center space-x-2 bg-yellow-900/20 border border-yellow-700/30 px-3 py-1 rounded-full">
                <AlertTriangle className="w-3 h-3 text-yellow-500" />
                <span className="text-xs text-yellow-500 font-medium">Account Review In Progress</span>
            </div>
        )}

        <div className="flex items-center space-x-4">
            {!isPremium ? (
                <button 
                    onClick={() => openPricing('PLANS')}
                    className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-yellow-600/20 to-orange-600/20 border border-orange-500/50 hover:bg-orange-500/20 transition-all group"
                >
                    <Crown className="w-4 h-4 text-orange-400 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-orange-400 uppercase tracking-wide">Get Pro</span>
                </button>
            ) : (
                <button 
                    onClick={() => openPricing('MANAGE')}
                    className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#1a1a1a] border border-yellow-600/30 hover:bg-[#222] transition-all"
                >
                    <Crown className="w-4 h-4 text-yellow-500" />
                    <div className="flex flex-col items-start">
                        <span className="text-xs font-bold text-yellow-500 uppercase tracking-wide leading-none">
                            {premiumType === 'pass' ? 'Pass Active' : 'Pro Active'}
                        </span>
                        {premiumType === 'pass' && (
                            <span className="text-[10px] font-mono text-yellow-300/70 leading-none mt-1">
                                {getPassTimeRemaining()}
                            </span>
                        )}
                    </div>
                </button>
            )}
            
            <span className="text-xs text-gray-500 font-mono hidden md:inline-block">
                {videoFile?.name} ({Math.round(duration)}s)
            </span>
             <Button 
                variant="ghost" 
                onClick={handleClose}
                className="text-red-400 hover:text-red-300"
            >
                <X className="w-5 h-5" />
            </Button>
            <Button 
                variant="primary" 
                icon={<Download className="w-4 h-4" />}
                onClick={handleExport}
                isLoading={state === EditorState.EXPORTING}
            >
                Export
            </Button>
        </div>
      </header>

      {/* Main Workspace - Scrollable */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Editor */}
        <div className="flex-1 flex flex-col min-w-0">
            {/* Viewport - Responsive Height */}
            <div className="bg-[#0a0a0a] p-4 lg:p-8 flex items-center justify-center relative border-b border-[#222]">
                {state === EditorState.EXPORTING && (
                    <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center">
                         <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                         <p className="text-blue-400 font-mono">Rendering Video...</p>
                         <p className="text-gray-500 text-xs mt-2">Please wait, this happens in real-time.</p>
                         {!isPremium && <p className="text-gray-500 text-xs mt-1">Free Plan: Adding Watermark...</p>}
                    </div>
                )}
                {/* Fixed aspect ratio container for the video */}
                <div className="w-full max-w-5xl aspect-video shadow-2xl bg-black rounded-xl overflow-hidden">
                    <VideoPlayer 
                        src={videoFile!.url}
                        filter={activeFilter}
                        onTimeUpdate={setCurrentTime}
                        onDurationChange={setDuration}
                        onLoadedMetadata={handleMetadataLoaded}
                        isPlaying={isPlaying}
                        currentTime={currentTime}
                        showWatermark={!isPremium}
                        playbackRate={playbackRate}
                        preservesPitch={preservesPitch}
                    />
                </div>
            </div>

            {/* Timeline & Tools Area - Scrollable */}
            <div className="bg-[#141414] p-6 flex flex-col space-y-8">
                {/* Controls Bar */}
                <div className="flex flex-col xl:flex-row items-center justify-between gap-6 bg-[#1a1a1a] p-4 rounded-xl border border-[#222]">
                     
                     {/* 1. Transport Controls */}
                     <div className="flex items-center space-x-4 w-full md:w-auto">
                        <Button 
                            variant="secondary" 
                            className="rounded-full w-12 h-12 p-0 flex items-center justify-center shrink-0"
                            onClick={togglePlay}
                        >
                            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                        </Button>
                        <div className="flex flex-col">
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold">Time</span>
                            <div className="font-mono text-xl text-white">
                                {currentTime.toFixed(2)}s <span className="text-gray-600">/ {duration.toFixed(2)}s</span>
                            </div>
                        </div>
                     </div>

                     {/* 2. Speed & Pitch Control (Updated with Slider & Buttons) */}
                     <div className="flex flex-col w-full md:w-80 bg-[#252525] p-3 rounded-lg border border-[#333] space-y-3">
                        {/* Header & Value Display */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs text-gray-500 uppercase tracking-wider font-bold flex items-center">
                                <Gauge className="w-3 h-3 mr-1" /> Speed
                            </span>
                            <div className="bg-[#1a1a1a] px-2 py-0.5 rounded border border-[#333]">
                                <span className="font-mono text-xs text-blue-400 font-bold">{playbackRate.toFixed(2)}x</span>
                            </div>
                        </div>

                        {/* Slider (Process Bar) with Buttons */}
                        <div className="flex items-center space-x-2">
                            <button 
                                onClick={() => adjustSpeed(-0.01)}
                                className="w-8 h-8 rounded-full bg-[#333] hover:bg-[#444] flex items-center justify-center text-white transition-colors"
                            >
                                <Minus className="w-4 h-4" />
                            </button>
                            
                            <div className="relative flex-1 flex items-center">
                                <input 
                                    type="range" 
                                    min="1.00" 
                                    max="8.00" 
                                    step="0.01" 
                                    value={playbackRate}
                                    onChange={handleSpeedChange}
                                    className="w-full h-1.5 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500"
                                />
                            </div>

                            <button 
                                onClick={() => adjustSpeed(0.01)}
                                className="w-8 h-8 rounded-full bg-[#333] hover:bg-[#444] flex items-center justify-center text-white transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-600 px-10">
                            <span>1x</span>
                            <span>8x</span>
                        </div>

                        {/* Pitch Toggle */}
                        <div className="pt-2 border-t border-[#333] flex justify-between items-center">
                            <span className="text-[10px] text-gray-500 uppercase font-bold flex items-center" title="Preserve audio pitch when changing speed">
                                <Mic2 className="w-3 h-3 mr-1"/> Pitch Correction
                            </span>
                            <label className="flex items-center cursor-pointer relative">
                                <input 
                                    type="checkbox" 
                                    checked={preservesPitch} 
                                    onChange={(e) => setPreservesPitch(e.target.checked)} 
                                    className="sr-only peer"
                                />
                                <div className="w-7 h-3.5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                        </div>
                     </div>
                     
                     {/* 3. Filter Selector */}
                     <div className="w-full xl:w-auto overflow-hidden">
                        <span className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2 flex justify-between">
                            <span>Filters</span>
                            {!isPremium && <span className="text-[10px] text-yellow-500 flex items-center"><Lock className="w-3 h-3 mr-1"/> 3/8 Unlocked</span>}
                        </span>
                        <div className="flex space-x-2 overflow-x-auto pb-2 scrollbar-hide">
                            {FILTERS.map((f, index) => {
                                const isLocked = !isPremium && index > 2;
                                return (
                                    <button 
                                    key={f.name}
                                    onClick={() => handleFilterClick(f, index)}
                                    className={`relative px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                                        activeFilter.name === f.name 
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 transform scale-105' 
                                        : 'bg-[#252525] text-gray-400 hover:bg-[#333] hover:text-white border border-[#333]'
                                    }`}
                                    >
                                    <span className={isLocked ? 'opacity-30' : ''}>{f.name}</span>
                                    {isLocked && (
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <Lock className="w-4 h-4 text-yellow-500" />
                                        </div>
                                    )}
                                    </button>
                                );
                            })}
                        </div>
                     </div>
                </div>

                {/* Timeline Component */}
                <div className="bg-[#1a1a1a] p-6 rounded-xl border border-[#222]">
                     <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center">
                        <Scissors className="w-4 h-4 mr-2" /> Timeline & Trim
                     </h3>
                    <Timeline 
                        duration={duration}
                        currentTime={currentTime}
                        trimStart={trimStart}
                        trimEnd={trimEnd}
                        onSeek={(time) => {
                            setCurrentTime(time);
                            setIsPlaying(false);
                        }}
                        onTrimChange={(s, e) => {
                            setTrimStart(s);
                            setTrimEnd(e);
                        }}
                    />
                </div>
            </div>
        </div>

        {/* Right: AI Panel (Sidebar on desktop, stacked on mobile) */}
        <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-[#222] bg-[#111] p-6">
            <AIPanel 
                metadata={metadata}
                isAnalyzing={isAnalyzing}
                onAnalyze={handleAnalyze}
                isPremium={isPremium}
                onUpgradeClick={() => openPricing('PLANS')}
            />
            
            {/* Additional Tips Section */}
            {!metadata && !isAnalyzing && (
                 <div className="mt-8 p-6 border border-dashed border-[#333] rounded-xl bg-[#161616]">
                    <h4 className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3 flex items-center">
                        <Wand2 className="w-3 h-3 mr-2" /> Pro Tip
                    </h4>
                    <p className="text-sm text-gray-500 leading-relaxed">
                        Scroll down to access the timeline and filters. 
                        {!isPremium && <span className="text-yellow-500 block mt-2">Upgrade to enable AI features.</span>}
                    </p>
                 </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;