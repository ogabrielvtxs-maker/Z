import { useEffect, useState } from "react";
import { User } from "../types";
import { getStreakStats, StreakStats, registerStudyDay } from "../lib/streak";
import { 
  Flame, 
  Award, 
  Calendar, 
  Trophy, 
  CheckCircle, 
  Sparkles,
  Zap,
  Star,
  Compass,
  Lock
} from "lucide-react";

interface ConsistencyWidgetProps {
  currentUser: User;
  onRefresh?: () => void;
}

const BADGES = [
  {
    id: "recruta",
    name: "Recruta Constante",
    description: "Estude por 3 dias seguidos",
    minStreak: 3,
    color: "from-blue-500 to-sky-400 font-bold",
    bg: "bg-blue-500/10 border-blue-500/30",
    iconColor: "text-blue-400"
  },
  {
    id: "soldado",
    name: "Soldado Disciplinado",
    description: "Estude por 7 dias seguidos",
    minStreak: 7,
    color: "from-emerald-500 to-teal-400 font-bold",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    iconColor: "text-emerald-400"
  },
  {
    id: "oficial",
    name: "Oficial de Elite",
    description: "Estude por 15 dias seguidos",
    minStreak: 15,
    color: "from-amber-500 to-orange-400 font-bold",
    bg: "bg-amber-500/10 border-amber-500/30",
    iconColor: "text-amber-400"
  },
  {
    id: "inabalavel",
    name: "Guerreiro Inabalável",
    description: "Estude por 30 dias seguidos",
    minStreak: 30,
    color: "from-fuchsia-500 to-purple-400 font-bold",
    bg: "bg-fuchsia-500/10 border-fuchsia-500/30",
    iconColor: "text-fuchsia-400"
  }
];

export default function ConsistencyWidget({ currentUser }: ConsistencyWidgetProps) {
  const [stats, setStats] = useState<StreakStats>({
    currentStreak: 0,
    longestStreak: 0,
    totalDaysStudied: 0,
    studiedDates: []
  });

  const loadStats = () => {
    const s = getStreakStats(currentUser.id);
    setStats(s);
  };

  useEffect(() => {
    loadStats();

    // Set up a listener for local changes to stats
    const handleStorageChange = () => {
      loadStats();
    };

    window.addEventListener("storage", handleStorageChange);
    // Custom trigger for same-page updates
    window.addEventListener("streak_updated", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("streak_updated", handleStorageChange);
    };
  }, [currentUser]);

  // Handle manually claiming study session as test
  const handleSimulateStudyDay = () => {
    const updated = registerStudyDay(currentUser.id);
    setStats(updated);
    // Dispatch custom event to notify other components
    window.dispatchEvent(new Event("streak_updated"));
  };

  // Generate 7 days of the current week (Sunday to Saturday) with studied indicators
  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    
    // Get start of the week (Sunday)
    const sunday = new Date(today);
    const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon, etc.
    sunday.setDate(today.getDate() - dayOfWeek);

    const weekNamesShort = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

    for (let i = 0; i < 7; i++) {
      const current = new Date(sunday);
      current.setDate(sunday.getDate() + i);

      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, "0");
      const day = String(current.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${day}`;

      const isToday = current.toDateString() === today.toDateString();
      const studied = stats.studiedDates.includes(dateStr);

      days.push({
        name: weekNamesShort[i],
        dateStr,
        isToday,
        studied
      });
    }

    return days;
  };

  const weekDays = getWeekDays();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6">
      
      {/* Title & Streak Counter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-400/10 border border-amber-400/20 rounded-2xl text-amber-400">
            <Flame className={`w-6 h-6 ${stats.currentStreak > 0 ? "animate-bounce fill-amber-400" : ""}`} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Controle de Constância</span>
            <h3 className="text-sm font-black text-white uppercase tracking-wider">Sequência de Estudos Militar</h3>
          </div>
        </div>

        {/* Big Streak Number */}
        <div className="flex items-center gap-4 bg-slate-950 border border-slate-850 px-5 py-3 rounded-2xl">
          <div className="text-center">
            <span className="text-2xl font-black text-amber-400 font-mono block">
              {stats.currentStreak}
            </span>
            <span className="text-[9px] text-slate-400 uppercase font-black">Dias Seguidos</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="text-center">
            <span className="text-xs font-bold text-slate-300 font-mono block">
              {stats.longestStreak}
            </span>
            <span className="text-[9px] text-slate-500 uppercase font-bold">Recorde</span>
          </div>
          <div className="w-px h-8 bg-slate-800" />
          <div className="text-center">
            <span className="text-xs font-bold text-slate-300 font-mono block">
              {stats.totalDaysStudied}
            </span>
            <span className="text-[9px] text-slate-500 uppercase font-bold">Total</span>
          </div>
        </div>
      </div>

      {/* Week Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-amber-400" />
            Progresso da Semana Atual
          </label>
          <button
            onClick={handleSimulateStudyDay}
            className="text-[9px] text-amber-400 font-extrabold uppercase hover:underline cursor-pointer bg-amber-400/10 border border-amber-400/20 px-2 py-1 rounded-lg transition"
            title="Registrar manualmente o dia de hoje como estudado"
          >
            Registrar Hoje Manualmente ⚡
          </button>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div 
              key={day.dateStr}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                day.studied
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : day.isToday
                  ? "bg-slate-950 border-amber-400/50 text-slate-200"
                  : "bg-slate-950 border-slate-850 text-slate-500"
              }`}
            >
              <span className={`text-[10px] font-black tracking-wider mb-1.5 block ${day.isToday ? "text-amber-400 font-black" : ""}`}>
                {day.name}
              </span>
              <div className="relative">
                {day.studied ? (
                  <CheckCircle className="w-5 h-5 text-emerald-400 fill-emerald-500/20" />
                ) : (
                  <div className={`w-5 h-5 rounded-full border-2 ${day.isToday ? "border-amber-400 border-dashed" : "border-slate-800"} flex items-center justify-center`}>
                    {day.isToday && <div className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements / Ranks */}
      <div className="space-y-3 pt-2">
        <label className="text-[10px] text-slate-400 font-black uppercase tracking-wider flex items-center gap-1.5">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          Medalhas de Consistência
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {BADGES.map((badge) => {
            const isUnlocked = stats.longestStreak >= badge.minStreak;
            return (
              <div 
                key={badge.id}
                className={`p-3 rounded-2xl border flex items-center gap-3 transition ${
                  isUnlocked 
                    ? `${badge.bg} text-white` 
                    : "bg-slate-950/40 border-slate-950 text-slate-600"
                }`}
              >
                <div className={`p-2 rounded-xl bg-slate-900 border border-slate-800 ${isUnlocked ? badge.iconColor : "text-slate-700"}`}>
                  {isUnlocked ? (
                    <Star className="w-4 h-4 fill-current" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <span className={`text-xs font-black uppercase tracking-wide block ${isUnlocked ? "text-white" : "text-slate-500"}`}>
                    {badge.name}
                  </span>
                  <span className="text-[9px] text-slate-400 block leading-tight">
                    {badge.description}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
