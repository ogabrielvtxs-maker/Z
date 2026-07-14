import { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Flame, Coffee, Check, Clock, Target, Maximize2, Minimize2 } from "lucide-react";
import { User } from "../types";
import { registerStudyDay } from "../lib/streak";

interface PomodoroProps {
  currentUser: User;
  sidebarMinimized?: boolean;
  setSidebarMinimized?: (minimized: boolean) => void;
}

export default function Pomodoro({ 
  currentUser,
  sidebarMinimized = false,
  setSidebarMinimized
}: PomodoroProps) {
  const [focusTime, setFocusTime] = useState<number>(25); // minutes
  const [breakTime, setBreakTime] = useState<number>(5); // minutes
  
  const [isFocusMode, setIsFocusMode] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60); // seconds
  const [sessionCount, setSessionCount] = useState<number>(0);

  const [dailyGoalHours, setDailyGoalHours] = useState<number>(4);
  const [studiedSecondsToday, setStudiedSecondsToday] = useState<number>(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync timeLeft when config changes and timer is not running
  useEffect(() => {
    if (!isPlaying) {
      setTimeLeft((isFocusMode ? focusTime : breakTime) * 60);
    }
  }, [focusTime, breakTime, isFocusMode]);

  // Load goal and daily study progress
  useEffect(() => {
    const loadGoalAndProgress = () => {
      const savedGoal = localStorage.getItem(`daily_study_goal_hours_${currentUser.id}`);
      if (savedGoal) {
        setDailyGoalHours(parseFloat(savedGoal));
      } else {
        setDailyGoalHours(4);
      }

      const todayStr = new Date().toLocaleDateString("sv-SE");
      const savedSecs = localStorage.getItem(`pomodoro_study_seconds_${currentUser.id}_${todayStr}`);
      if (savedSecs) {
        setStudiedSecondsToday(parseInt(savedSecs));
      } else {
        setStudiedSecondsToday(0);
      }
    };

    loadGoalAndProgress();
    window.addEventListener("storage", loadGoalAndProgress);
    return () => {
      window.removeEventListener("storage", loadGoalAndProgress);
    };
  }, [currentUser]);

  // Handle countdown
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            playBeep();
            setIsPlaying(false);
            if (isFocusMode) {
              setSessionCount((c) => c + 1);
              setIsFocusMode(false);
              registerStudyDay(currentUser.id);
              window.dispatchEvent(new Event("streak_updated"));
              return breakTime * 60;
            } else {
              setIsFocusMode(true);
              return focusTime * 60;
            }
          }

          // If in focus mode, increment studied seconds for the daily goal in real-time
          if (isFocusMode) {
            const todayStr = new Date().toLocaleDateString("sv-SE");
            const storageKey = `pomodoro_study_seconds_${currentUser.id}_${todayStr}`;
            const currentSeconds = parseInt(localStorage.getItem(storageKey) || "0") + 1;
            localStorage.setItem(storageKey, currentSeconds.toString());
            
            // Dispatch storage event so other components (like WeeklyCycle) update immediately
            window.dispatchEvent(new Event("storage"));
          }

          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, isFocusMode, focusTime, breakTime, currentUser]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const resetTimer = () => {
    setIsPlaying(false);
    setIsFocusMode(true);
    setTimeLeft(focusTime * 60);
  };

  const completeSessionEarly = () => {
    if (!isFocusMode) {
      // If we are in break mode, completing early just goes back to focus mode.
      setIsFocusMode(true);
      setTimeLeft(focusTime * 60);
      setIsPlaying(false);
      return;
    }

    const confirmComplete = window.confirm("Atenção Recruta! Deseja concluir esta sessão de foco imediatamente e creditar o tempo total para sua meta diária?");
    if (!confirmComplete) return;

    // Credit full focus block (focusTime * 60 seconds) to study progress
    const todayStr = new Date().toLocaleDateString("sv-SE");
    const storageKey = `pomodoro_study_seconds_${currentUser.id}_${todayStr}`;
    const previousSeconds = parseInt(localStorage.getItem(storageKey) || "0");
    const secondsToCredit = focusTime * 60; // credit full session length
    const currentSeconds = previousSeconds + secondsToCredit;
    localStorage.setItem(storageKey, currentSeconds.toString());
    setStudiedSecondsToday(currentSeconds);

    // Save cycle daily study stats as completed subject check
    // Trigger notification beep
    playBeep();
    setSessionCount((c) => c + 1);
    setIsFocusMode(false);
    setTimeLeft(breakTime * 60);
    setIsPlaying(false);

    registerStudyDay(currentUser.id);

    // Dispatch event to sync immediately
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new Event("streak_updated"));
  };

  // Web Audio API beep
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(660, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
      
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.8);
    } catch (e) {
      console.log("Audio contexts blocked or unsupported", e);
    }
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Progress percentage
  const totalSeconds = (isFocusMode ? focusTime : breakTime) * 60;
  const progressPercent = ((totalSeconds - timeLeft) / totalSeconds) * 100;

  return (
    <div 
      id="pomodoro-component" 
      className={`bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl transition-all duration-300 ${
        sidebarMinimized ? "max-w-xl p-8" : "max-w-md"
      } mx-auto`}
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-semibold text-lg flex items-center gap-2 text-amber-400">
          <Clock className="w-5 h-5" />
          Pomodoro Tático
        </h3>
        <div className="flex items-center gap-2">
          {setSidebarMinimized && (
            <button
              onClick={() => setSidebarMinimized(!sidebarMinimized)}
              className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 hover:text-amber-400 border border-slate-800 text-slate-300 transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer"
              title={sidebarMinimized ? "Sair da Tela Cheia" : "Modo Tela Cheia (Minimizar Distrações)"}
            >
              {sidebarMinimized ? (
                <>
                  <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Sair Foco</span>
                </>
              ) : (
                <>
                  <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                  <span className="hidden sm:inline">Tela Cheia</span>
                </>
              )}
            </button>
          )}
          <div className="flex items-center gap-1.5 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/50 text-xs">
            <Flame className="w-4 h-4 text-orange-500 animate-pulse" />
            <span>Focos: {sessionCount}</span>
          </div>
        </div>
      </div>

      {/* Circle / Radial Progress */}
      <div className="relative flex flex-col items-center justify-center my-6">
        <div 
          className={`rounded-full border-4 border-slate-800 flex flex-col items-center justify-center relative overflow-hidden bg-slate-950/50 transition-all duration-300 ${
            sidebarMinimized ? "w-56 h-56" : "w-48 h-48"
          }`}
        >
          {/* Wave Background indicator */}
          <div 
            className={`absolute bottom-0 left-0 right-0 transition-all duration-1000 opacity-15 ${
              isFocusMode ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ height: `${progressPercent}%` }}
          />

          <span className="text-xs tracking-wider uppercase font-mono text-slate-400">
            {isFocusMode ? "Modo Foco" : "Modo Pausa"}
          </span>
          <span 
            className={`font-extrabold font-mono tracking-tight my-1 text-slate-100 transition-all duration-300 ${
              sidebarMinimized ? "text-5xl" : "text-4xl"
            }`}
          >
            {formatTime(timeLeft)}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            {isFocusMode ? (
              <>
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span>Estudar</span>
              </>
            ) : (
              <>
                <Coffee className="w-3.5 h-3.5 text-emerald-400" />
                <span>Descansar</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={resetTimer}
          className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 transition border border-slate-700 hover:border-slate-600 cursor-pointer"
          title="Reiniciar"
        >
          <RotateCcw className="w-5 h-5 text-slate-300" />
        </button>
        
        <button
          onClick={togglePlay}
          className={`px-6 py-3 rounded-full flex items-center gap-2 font-semibold transition cursor-pointer text-slate-950 shadow-md ${
            isPlaying 
              ? "bg-amber-400 hover:bg-amber-500" 
              : "bg-emerald-400 hover:bg-emerald-500"
          }`}
        >
          {isPlaying ? (
            <>
              <Pause className="w-5 h-5" />
              Pausar
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Iniciar
            </>
          )}
        </button>

        <button
          onClick={completeSessionEarly}
          className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 transition border border-slate-700 hover:border-slate-600 cursor-pointer"
          title="Completar Sessão Agora"
        >
          <Check className="w-5 h-5 text-emerald-400" />
        </button>
      </div>

      {/* Daily Goal Progress Bar inside Pomodoro */}
      <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-2xl space-y-2 mb-6">
        <div className="flex items-center justify-between text-xs font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-amber-400" />
            Progresso da Meta Diária
          </span>
          <span className="font-mono text-amber-400 font-black">
            {(studiedSecondsToday / 3600).toFixed(2)}h / {dailyGoalHours}h
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-800">
          <div 
            className="bg-amber-400 h-full rounded-full transition-all duration-300"
            style={{ width: `${Math.min(100, (studiedSecondsToday / (dailyGoalHours * 3600)) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          <span>{Math.min(100, Math.round((studiedSecondsToday / (dailyGoalHours * 3600)) * 100))}% Concluído</span>
          <span>Objetivo: {dailyGoalHours} horas</span>
        </div>

        {/* Adjust Hour Goal Input */}
        <div className="flex items-center gap-2 mt-2 bg-slate-900 border border-slate-850 rounded-xl p-2 justify-between">
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Personalizar Meta Diária (h):</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0.5"
              step="0.5"
              max="24"
              value={dailyGoalHours}
              onChange={(e) => {
                const val = Math.max(0.5, parseFloat(e.target.value) || 4);
                setDailyGoalHours(val);
                localStorage.setItem(`daily_study_goal_hours_${currentUser.id}`, val.toString());
                window.dispatchEvent(new Event("storage"));
              }}
              className="w-16 bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-xs text-center text-amber-400 font-mono focus:outline-none"
            />
            <span className="text-[10px] text-slate-500">horas</span>
          </div>
        </div>
      </div>

      {/* Config Settings */}
      <div className="border-t border-slate-800/80 pt-5 space-y-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Personalizar Tempos (minutos)
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Tempo de Foco</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <input
                type="number"
                min="1"
                max="120"
                value={focusTime}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setFocusTime(val);
                }}
                disabled={isPlaying}
                className="w-full bg-transparent focus:outline-none text-sm font-mono text-amber-400"
              />
              <span className="text-xs text-slate-500 font-mono">min</span>
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Tempo de Pausa</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
              <input
                type="number"
                min="1"
                max="60"
                value={breakTime}
                onChange={(e) => {
                  const val = Math.max(1, parseInt(e.target.value) || 1);
                  setBreakTime(val);
                }}
                disabled={isPlaying}
                className="w-full bg-transparent focus:outline-none text-sm font-mono text-emerald-400"
              />
              <span className="text-xs text-slate-500 font-mono">min</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
