import { useState, useEffect, useCallback, useRef } from "react";
import { Menu, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import { TransportControls } from "@/components/TransportControls";
import { SongViewer } from "@/components/SongViewer";
import { MasterControls } from "@/components/MasterControls";
import { TimeDisplay } from "@/components/TimeDisplay";
import { SongList, Song } from "@/components/SongList";
import { SetlistCarousel } from "@/components/SetlistCarousel";
import { MusicLibrary } from "@/components/MusicLibrary";
import { ImportMusic } from "@/components/ImportMusic";
import { SettingsMenu } from "@/components/SettingsMenu";
import { SectionEditor } from "@/components/SectionEditor";
import { FaderTrack } from "@/components/HorizontalFaders";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useSections } from "@/hooks/useSections";
import { Song as AudioSong } from "@/lib/audioEngine";


const initialTracks: FaderTrack[] = [
  { id: "1", name: "Click", icon: "🥁", color: "hsl(38, 95%, 55%)", volume: 80, isClickTrack: true },
  { id: "2", name: "Drums", icon: "🪘", color: "hsl(0, 72%, 55%)", volume: 85 },
  { id: "3", name: "Bass", icon: "🎸", color: "hsl(280, 70%, 55%)", volume: 75 },
  { id: "4", name: "Keys", icon: "🎹", color: "hsl(200, 70%, 45%)", volume: 70 },
  { id: "5", name: "Guitar", icon: "🎵", color: "hsl(145, 70%, 45%)", volume: 65 },
  { id: "6", name: "Vocals", icon: "🎤", color: "hsl(320, 60%, 50%)", volume: 90 },
];

// Biblioteca começa vazia — músicas adicionadas via Importar ou Biblioteca
const demoSongs: Song[] = [];



// Convert AudioEngine Song to UI Song format
function audioSongToUISong(audioSong: AudioSong): Song {
  return {
    id: audioSong.id,
    title: audioSong.songName,
    duration: audioSong.duration,
    bpm: audioSong.bpm,
    trackCount: audioSong.tracks.length,
  };
}

export default function Index() {
  const [tracks, setTracks] = useState<FaderTrack[]>(initialTracks);
  const [masterVolume, setMasterVolume] = useState(80);
  
  
  
  // Demo playback state (for songs without audio)
  const [demoIsPlaying, setDemoIsPlaying] = useState(false);
  const [demoCurrentTime, setDemoCurrentTime] = useState(0);
  
  // Audio Engine integration
  const { 
    songs: audioEngineSongs, 
    currentSongId: audioCurrentSongId,
    currentFaderTracks,
    handleTrackVolumeChange,
    handleTrackMuteToggle,
    handleTrackSoloToggle,
    splitClickAndInstruments,
    resetPans,
    toggleInstrumentsFade,
    areInstrumentsFaded,
    instrumentsFaded: engineInstrumentsFaded,
    setMasterVolume: setEngineMasterVolume,
    setCurrentSong: setEngineCurrentSong,
    // Playback controls from audio engine
    isPlaying: engineIsPlaying,
    currentTime: engineCurrentTime,
    play: enginePlay,
    pause: enginePause,
    stop: engineStop,
    seek: engineSeek,
    togglePlayPause: engineTogglePlayPause,
  } = useAudioEngine();

  // Track split mode: "off" | "clickLeft" | "clickRight"
  type SplitMode = "off" | "clickLeft" | "clickRight";
  const [splitMode, setSplitMode] = useState<SplitMode>("off");
  const [instrumentsFaded, setInstrumentsFaded] = useState(false);
  
  // Library & Setlist state
  const [librarySongs, setLibrarySongs] = useState<Song[]>(demoSongs);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [currentSongId, setCurrentSongId] = useState<string>("");

  // Modal states
  const [showSettings, setShowSettings] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSectionEditor, setShowSectionEditor] = useState(false);

  // Sections hook
  const { getSectionsForSong, addSection, updateSection, deleteSection } = useSections();

  // Merge demo songs with imported audio engine songs
  const allLibrarySongs: Song[] = [
    ...librarySongs,
    ...audioEngineSongs.map(audioSongToUISong),
  ];

  // Derived state
  const setlistSongs = allLibrarySongs.filter((s) => selectedSongIds.includes(s.id));
  const currentSong = allLibrarySongs.find((s) => s.id === currentSongId) || setlistSongs[0];
  
  // Check if current song is from audio engine (has real audio tracks)
  const isImportedSong = audioEngineSongs.some(s => s.id === currentSongId);
  
  // Use audio engine state for imported songs, demo state otherwise
  const isPlaying = isImportedSong ? engineIsPlaying : demoIsPlaying;
  const currentTime = isImportedSong ? engineCurrentTime : demoCurrentTime;
  
  
  // Use audio engine tracks if available, otherwise use demo tracks
  const activeTracks = isImportedSong && currentFaderTracks.length > 0 
    ? currentFaderTracks 
    : tracks;

  // Simulate playback for demo songs only
  useEffect(() => {
    if (isImportedSong || !demoIsPlaying || !currentSong) return;

    const interval = setInterval(() => {
      setDemoCurrentTime((prev) => {
        if (prev >= currentSong.duration) {
          setDemoIsPlaying(false);
          return 0;
        }
        return prev + 0.1;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [demoIsPlaying, currentSong, isImportedSong]);

  // ===== Section loop state =====
  const [loopSectionId, setLoopSectionId] = useState<string | null>(null);
  const currentSections = getSectionsForSong(currentSongId);
  const activeLoopSection = currentSections.find((s) => s.id === loopSectionId) || null;

  const handleToggleLoop = useCallback((sectionId: string) => {
    setLoopSectionId((prev) => (prev === sectionId ? null : sectionId));
  }, []);

  const handleFooterLoopToggle = useCallback(() => {
    if (loopSectionId) {
      setLoopSectionId(null);
    } else {
      const section = currentSections.find(
        (s) => currentTime >= s.startTime && currentTime < s.endTime
      );
      if (section) {
        setLoopSectionId(section.id);
      }
    }
  }, [loopSectionId, currentSections, currentTime]);

  // Clear loop when changing song
  useEffect(() => {
    setLoopSectionId(null);
  }, [currentSongId]);

  // ===== Agendamento de Pulo no Fim da Seção (End of Section) =====
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const scheduledFromEndTimeRef = useRef<number | null>(null);

  // Limpar agendamento se o áudio pausar ou se trocar de música
  useEffect(() => {
    if (!isPlaying) {
      setPendingSectionId(null);
      scheduledFromEndTimeRef.current = null;
    }
  }, [isPlaying]);

  useEffect(() => {
    setPendingSectionId(null);
    scheduledFromEndTimeRef.current = null;
  }, [currentSongId]);

  // Loop enforcement: when currentTime passes endTime, seek back to startTime (se não houver transição agendada)
  useEffect(() => {
    if (!activeLoopSection || !isPlaying || pendingSectionId) return;
    if (currentTime >= activeLoopSection.endTime) {
      if (isImportedSong) {
        engineSeek(activeLoopSection.startTime);
      } else {
        setDemoCurrentTime(activeLoopSection.startTime);
      }
    }
  }, [currentTime, activeLoopSection, isPlaying, isImportedSong, engineSeek, pendingSectionId]);

  const handlePlayPause = useCallback(() => {
    if (isImportedSong) {
      engineTogglePlayPause();
    } else {
      setDemoIsPlaying((prev) => !prev);
    }
  }, [isImportedSong, engineTogglePlayPause]);

  const handleStop = useCallback(() => {
    if (isImportedSong) {
      engineStop();
    } else {
      setDemoIsPlaying(false);
      setDemoCurrentTime(0);
    }
  }, [isImportedSong, engineStop]);

  const handlePrev = useCallback(() => {
    const newTime = Math.max(0, currentTime - 10);
    if (isImportedSong) {
      engineSeek(newTime);
    } else {
      setDemoCurrentTime(newTime);
    }
  }, [isImportedSong, currentTime, engineSeek]);

  const handleNext = useCallback(() => {
    if (currentSong) {
      const newTime = Math.min(currentSong.duration, currentTime + 10);
      if (isImportedSong) {
        engineSeek(newTime);
      } else {
        setDemoCurrentTime(newTime);
      }
    }
  }, [currentSong, isImportedSong, currentTime, engineSeek]);

  const handleSeek = useCallback((time: number) => {
    if (isImportedSong) {
      engineSeek(time);
    } else {
      setDemoCurrentTime(time);
    }
  }, [isImportedSong, engineSeek]);

  // CLIQUE EM OUTRA SEÇÃO DURANTE O PLAYBACK:
  // Se o áudio estiver tocando e o usuário clicar no bloco de uma seção diferente da atual,
  // não pula de imediato; guarda como destino agendado (pendingSectionId).
  const handleSectionSelect = useCallback(
    (sectionId: string, sectionStartTime: number) => {
      if (!isPlaying) {
        setPendingSectionId(null);
        scheduledFromEndTimeRef.current = null;
        handleSeek(sectionStartTime);
        return;
      }

      // Identifica a seção que está tocando no momento
      const currentActiveSection = currentSections.find(
        (s) => currentTime >= s.startTime && currentTime < s.endTime
      );

      if (currentActiveSection && currentActiveSection.id !== sectionId) {
        // Se clicar novamente na seção já agendada, cancela o agendamento
        if (pendingSectionId === sectionId) {
          setPendingSectionId(null);
          scheduledFromEndTimeRef.current = null;
        } else {
          // Agenda o pulo para o final da seção atual
          setPendingSectionId(sectionId);
          scheduledFromEndTimeRef.current = currentActiveSection.endTime;
        }
      } else {
        // Se clicou na mesma seção atual ou fora de seções: pula imediatamente
        setPendingSectionId(null);
        scheduledFromEndTimeRef.current = null;
        handleSeek(sectionStartTime);
      }
    },
    [isPlaying, currentSections, currentTime, pendingSectionId, handleSeek]
  );

  // DISPARO NO FIM DA SEÇÃO ATUAL (End of Section):
  // Deixa a música continuar tocando até atingir o fim (endTime) da seção atual.
  // No instante exato em que atingir o final, limpa a marcação pendente e salta para a seção agendada.
  useEffect(() => {
    if (!pendingSectionId || !isPlaying) return;

    const targetSection = currentSections.find((s) => s.id === pendingSectionId);
    if (!targetSection) {
      setPendingSectionId(null);
      scheduledFromEndTimeRef.current = null;
      return;
    }

    const triggerEndTime = scheduledFromEndTimeRef.current;
    // Dispara no instante em que atingir o final da seção atual
    if (triggerEndTime !== null && currentTime >= triggerEndTime - 0.06) {
      setPendingSectionId(null);
      scheduledFromEndTimeRef.current = null;
      if (loopSectionId) {
        setLoopSectionId(null);
      }
      handleSeek(targetSection.startTime);
    }
  }, [currentTime, pendingSectionId, isPlaying, currentSections, loopSectionId, handleSeek]);

  // Handle volume change - route to appropriate handler
  const handleVolumeChange = useCallback((trackId: string, volume: number) => {
    if (isImportedSong) {
      // Use audio engine for imported songs
      handleTrackVolumeChange(trackId, volume);
    } else {
      // Use local state for demo songs
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, volume } : t))
      );
    }
  }, [isImportedSong, handleTrackVolumeChange]);

  // Handle mute toggle
  const handleMuteToggle = useCallback((trackId: string) => {
    if (isImportedSong) {
      handleTrackMuteToggle(trackId);
    }
  }, [isImportedSong, handleTrackMuteToggle]);

  // Handle solo toggle
  const handleSoloToggle = useCallback((trackId: string) => {
    if (isImportedSong) {
      handleTrackSoloToggle(trackId);
    }
  }, [isImportedSong, handleTrackSoloToggle]);

  // Handle split mode change
  const handleSplitModeChange = useCallback((mode: SplitMode) => {
    setSplitMode(mode);
    if (mode === "off") {
      resetPans();
    } else {
      splitClickAndInstruments(mode === "clickLeft");
    }
  }, [splitClickAndInstruments, resetPans]);

  // Current fade out state (from engine for imported songs, local state for demo)
  const isFadingOut = isImportedSong ? engineInstrumentsFaded : instrumentsFaded;

  // Handle instrument fade toggle (4.5s gradual fade-out, keeping click/guide)
  const handleInstrumentsFadeToggle = useCallback(() => {
    if (isImportedSong) {
      toggleInstrumentsFade();
    } else {
      setInstrumentsFaded(prev => !prev);
    }
  }, [isImportedSong, toggleInstrumentsFade]);

  const handleSongSelect = useCallback((song: Song) => {
    setCurrentSongId(song.id);
    setInstrumentsFaded(false);
    
    // Stop current playback
    if (audioEngineSongs.some(s => s.id === currentSongId)) {
      engineStop();
    }
    setDemoIsPlaying(false);
    setDemoCurrentTime(0);
    
    // Update audio engine if it's an imported song
    if (audioEngineSongs.some(s => s.id === song.id)) {
      setEngineCurrentSong(song.id);
    }
  }, [audioEngineSongs, setEngineCurrentSong, currentSongId, engineStop]);

  const handleToggleLibrarySong = useCallback((songId: string) => {
    setSelectedSongIds((prev) =>
      prev.includes(songId)
        ? prev.filter((id) => id !== songId)
        : [...prev, songId]
    );
  }, []);

  const handleImportSongs = useCallback((newSongs: AudioSong[]) => {
    // Auto-select imported songs
    setSelectedSongIds((prev) => [...prev, ...newSongs.map((s) => s.id)]);
    
    // Select the first imported song
    if (newSongs.length > 0) {
      setCurrentSongId(newSongs[0].id);
      setEngineCurrentSong(newSongs[0].id);
    }
  }, [setEngineCurrentSong]);

  // Update master volume in audio engine
  useEffect(() => {
    setEngineMasterVolume(masterVolume);
  }, [masterVolume, setEngineMasterVolume]);

  // Placeholder quando nenhuma música está carregada
  const emptyPlaceholder: Song = { id: "", title: "Nenhuma música carregada", duration: 0 };
  const displaySong = currentSong || emptyPlaceholder;

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden relative">
      {/* Header com TimeDisplay e Botão Menu à direita */}
      <header className="flex items-center justify-end px-3 py-1.5 border-b border-border bg-card/50 min-h-[44px]">
        <div className="flex items-center gap-2">
          <TimeDisplay currentTime={currentTime} totalDuration={displaySong.duration} />
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="transport-btn min-w-[36px] min-h-[36px]"
            title="Menu / Configurações"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onOpenLibrary={() => setShowLibrary(true)}
        onOpenImport={() => setShowImport(true)}
      />

      {/* Setlist Carousel — barra horizontal abaixo do header */}
      <SetlistCarousel
        songs={setlistSongs}
        currentSongId={currentSongId}
        onSongSelect={handleSongSelect}
      />

      {/* Main Content — waveform ocupa largura total */}
      <main className="flex-1 px-2 py-1 overflow-hidden min-h-0">
        <SongViewer
          currentTime={currentTime}
          totalDuration={displaySong.duration}
          isPlaying={isPlaying}
          onSeek={handleSeek}
          tracks={activeTracks}
          onVolumeChange={handleVolumeChange}
          onMuteToggle={isImportedSong ? handleMuteToggle : undefined}
          onSoloToggle={isImportedSong ? handleSoloToggle : undefined}
          sections={currentSections}
          onOpenSectionEditor={() => setShowSectionEditor(true)}
          loopSectionId={loopSectionId}
          onToggleLoop={handleToggleLoop}
          onDeleteSection={(sectionId) => deleteSection(currentSongId, sectionId)}
          pendingSectionId={pendingSectionId}
          onSectionSelect={handleSectionSelect}
        />
      </main>

      {/* Footer Controls - Horizontal Layout */}
      <footer className="border-t border-border bg-card/80 backdrop-blur-sm px-3 py-1 flex items-center justify-between gap-4">
        <MasterControls
          masterVolume={masterVolume}
          onMasterVolumeChange={setMasterVolume}
          splitMode={splitMode}
          onSplitModeChange={handleSplitModeChange}
          showSplitControl={isImportedSong}
          instrumentsFaded={isFadingOut}
          onInstrumentsFadeToggle={handleInstrumentsFadeToggle}
        />

        <div className="flex items-center gap-2">
          <button
            onClick={handleFooterLoopToggle}
            className={cn(
              "transport-btn min-w-[40px] min-h-[40px]",
              loopSectionId
                ? "text-primary bg-primary/20 ring-1 ring-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            title={loopSectionId ? "Desativar loop" : "Repetir seção atual"}
          >
            <Repeat className="w-4 h-4" />
          </button>

          <TransportControls
            isPlaying={isPlaying}
            onPlayPause={handlePlayPause}
            onStop={handleStop}
            onPrev={handlePrev}
            onNext={handleNext}
            isFadingOut={isFadingOut}
            onToggleFadeOut={handleInstrumentsFadeToggle}
          />
        </div>
      </footer>

      {/* Library Modal */}
      {showLibrary && (
        <MusicLibrary
          songs={allLibrarySongs}
          selectedIds={selectedSongIds}
          onToggleSelect={handleToggleLibrarySong}
          onClose={() => setShowLibrary(false)}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <ImportMusic
          onImport={handleImportSongs}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Section Editor Modal */}
      {showSectionEditor && (
        <SectionEditor
          isOpen={showSectionEditor}
          onClose={() => setShowSectionEditor(false)}
          sections={currentSections}
          totalDuration={displaySong.duration}
          currentTime={currentTime}
          loopSectionId={loopSectionId}
          onAddSection={(type, startTime, endTime) => addSection(currentSongId, type, startTime, endTime)}
          onUpdateSection={(sectionId, updates) => updateSection(currentSongId, sectionId, updates)}
          onDeleteSection={(sectionId) => deleteSection(currentSongId, sectionId)}
          onSeekToSection={handleSeek}
          onToggleLoop={handleToggleLoop}
        />
      )}
    </div>
  );
}
