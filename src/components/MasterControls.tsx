import { Volume2, Music, VolumeX, Mic, MicOff, Headphones } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

interface MasterControlsProps {
  masterVolume: number;
  bpm: number;
  isClickActive: boolean;
  currentBeat: number;
  beatsPerBar: number;
  isFadingToClick: boolean;
  isFadeRestoring: boolean;
  fadeProgress: number;
  voiceEnabled: boolean;
  stereoSplit: number; // -1 = click left, 0 = center, 1 = click right
  onMasterVolumeChange: (volume: number) => void;
  onFadeToClickToggle: () => void;
  onVoiceToggle: () => void;
  onStereoSplitChange: (side: number) => void;
}

export function MasterControls({
  masterVolume,
  bpm,
  isClickActive,
  currentBeat,
  beatsPerBar,
  isFadingToClick,
  isFadeRestoring,
  fadeProgress,
  voiceEnabled,
  stereoSplit,
  onMasterVolumeChange,
  onFadeToClickToggle,
  onVoiceToggle,
  onStereoSplitChange,
}: MasterControlsProps) {
  // Cycle through stereo modes: center -> click left -> click right -> center
  const handleStereoClick = () => {
    if (stereoSplit === 0) {
      onStereoSplitChange(-1); // Click left
    } else if (stereoSplit === -1) {
      onStereoSplitChange(1); // Click right
    } else {
      onStereoSplitChange(0); // Center
    }
  };

  const getStereoLabel = () => {
    if (stereoSplit === -1) return "L|R";
    if (stereoSplit === 1) return "R|L";
    return "STEREO";
  };
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      {/* BPM Display */}
      <div className="flex items-center gap-2">
        <div className="text-center">
          <div className="text-xl font-mono font-bold text-primary text-glow-primary leading-none">
            {bpm}
          </div>
          <div className="text-[9px] text-muted-foreground uppercase tracking-wider">
            BPM
          </div>
        </div>

        {/* Beat indicators */}
        <div className="flex gap-1">
          {Array.from({ length: beatsPerBar }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all duration-100",
                currentBeat === i + 1 && isClickActive
                  ? i === 0
                    ? "bg-accent scale-125 shadow-[var(--glow-accent)]"
                    : "bg-primary scale-110 shadow-[var(--glow-primary)]"
                  : "bg-muted"
              )}
            />
          ))}
        </div>
      </div>

      {/* Fade to Click Button */}
      <button
        onClick={onFadeToClickToggle}
        className={cn(
          "relative flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-xs transition-all overflow-hidden",
          isFadeRestoring
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : isFadingToClick || fadeProgress > 0
              ? "bg-accent text-accent-foreground"
              : "bg-secondary hover:bg-secondary/80 text-secondary-foreground"
        )}
      >
        <div 
          className="absolute inset-0 transition-all duration-100"
          style={{ 
            width: `${fadeProgress}%`,
            opacity: fadeProgress > 0 ? 1 : 0,
            background: isFadeRestoring 
              ? 'linear-gradient(90deg, transparent, hsl(142 76% 36% / 0.3))' 
              : 'hsl(var(--accent) / 0.3)'
          }}
        />
        
        <span className="relative z-10 flex items-center gap-1.5">
          {isFadeRestoring ? (
            <>
              <Volume2 className="w-4 h-4 animate-pulse" />
              <span>RESTORE {Math.round(100 - fadeProgress)}%</span>
            </>
          ) : fadeProgress >= 100 ? (
            <>
              <VolumeX className="w-4 h-4" />
              <span>SÓ CLICK</span>
            </>
          ) : fadeProgress > 0 ? (
            <>
              <Music className="w-4 h-4 animate-pulse" />
              <span>FADE {Math.round(fadeProgress)}%</span>
            </>
          ) : (
            <>
              <Music className="w-4 h-4" />
              <span>FADE</span>
            </>
          )}
        </span>
      </button>

      {/* Stereo Split Button */}
      <button
        onClick={handleStereoClick}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-2 rounded-lg font-medium text-xs transition-all",
          stereoSplit !== 0
            ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
            : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
        )}
        title={stereoSplit === -1 ? "Click esquerda, Instrumentos direita" : stereoSplit === 1 ? "Click direita, Instrumentos esquerda" : "Separação estéreo desativada"}
      >
        <Headphones className="w-4 h-4" />
        <span className="hidden sm:inline">{getStereoLabel()}</span>
      </button>

      <button
        onClick={onVoiceToggle}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-2 rounded-lg font-medium text-xs transition-all",
          voiceEnabled
            ? "bg-green-500/20 text-green-400 border border-green-500/30"
            : "bg-secondary hover:bg-secondary/80 text-muted-foreground"
        )}
        title={voiceEnabled ? "Voz ativada" : "Voz desativada"}
      >
        {voiceEnabled ? (
          <Mic className="w-4 h-4" />
        ) : (
          <MicOff className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">VOZ</span>
      </button>

      {/* Master Volume */}
      <div className="flex items-center gap-1">
        <Volume2 className="w-4 h-4 text-muted-foreground" />
        <div className="flex items-center gap-1 w-[80px]">
          <Slider
            value={[masterVolume]}
            max={100}
            step={1}
            onValueChange={([value]) => onMasterVolumeChange(value)}
            className="flex-1"
          />
          <span className="text-[10px] font-mono text-muted-foreground w-6">
            {masterVolume}
          </span>
        </div>
      </div>
    </div>
  );
}
