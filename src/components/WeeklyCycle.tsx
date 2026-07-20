import React, { useState, useEffect } from "react";
import { StudyCycle, User, SyllabusSection, SyllabusItem } from "../types";
import { CheckSquare, Square, Target, Calendar, Lock, Unlock, HelpCircle, ChevronRight, PlayCircle, Award, Clock, Bell, Archive, Eye, EyeOff, Plus, Minus, FileText } from "lucide-react";
import { fetchStudyCycleFromFirestore, saveStudyCycleToFirestore } from "../lib/firebase";
import ConsistencyWidget from "./ConsistencyWidget";

interface WeeklyCycleProps {
  currentUser: User;
  onOpenPomodoro?: () => void;
}

export default function WeeklyCycle({ currentUser, onOpenPomodoro }: WeeklyCycleProps) {
  const [cycle, setCycle] = useState<StudyCycle | null>(null);
  const [showArchivedDays, setShowArchivedDays] = useState<boolean>(false);
  const [dailyGoalHours, setDailyGoalHours] = useState<number>(4);
  const [studiedSecondsToday, setStudiedSecondsToday] = useState<number>(0);
  const [revisionAlerts, setRevisionAlerts] = useState<{
    sectionId: string;
    subject: string;
    topicId: string;
    topicTitle: string;
    stage: number;
    nextDate: string;
  }[]>([]);
  const [syllabusProgress, setSyllabusProgress] = useState<SyllabusSection[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [editingNotesDay, setEditingNotesDay] = useState<number | null>(null);
  const [tempNotes, setTempNotes] = useState<string>("");
  const [lockWarning, setLockWarning] = useState<string | null>(null);

  const renderCycleDetailsMarkdown = (rawText: string) => {
    if (!rawText) return null;
    const lines = rawText.split("\n");
    const elements: React.ReactNode[] = [];
    
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = (key: string | number) => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={`list-${key}`} className="list-disc pl-5 my-2 space-y-1.5 text-slate-300">
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const parseBoldText = (text: string) => {
      const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i} className="text-amber-400 font-extrabold">{part}</strong>;
        }
        // Support italic *text*
        const italicParts = part.split(/\*([\s\S]*?)\*/g);
        return italicParts.map((subPart, j) => {
          if (j % 2 === 1) {
            return <em key={j} className="text-slate-100 italic">{subPart}</em>;
          }
          return subPart;
        });
      });
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("###")) {
        flushList(idx);
        elements.push(
          <h4 key={idx} className="text-xs font-bold text-amber-400 mt-4 mb-2 uppercase tracking-wide">
            {trimmed.replace("###", "").trim()}
          </h4>
        );
        return;
      }
      if (trimmed.startsWith("##")) {
        flushList(idx);
        elements.push(
          <h3 key={idx} className="text-sm font-black text-amber-300 border-b border-slate-800 pb-1 mt-5 mb-2.5 uppercase">
            {trimmed.replace("##", "").trim()}
          </h3>
        );
        return;
      }
      if (trimmed.startsWith("#")) {
        flushList(idx);
        elements.push(
          <h2 key={idx} className="text-base font-black text-white mt-6 mb-3 uppercase tracking-wider">
            {trimmed.replace("#", "").trim()}
          </h2>
        );
        return;
      }

      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const text = trimmed.substring(1).trim();
        if (text !== "") {
          listItems.push(
            <li key={`li-${idx}`} className="text-xs text-slate-300 mb-1 leading-relaxed">
              {parseBoldText(text)}
            </li>
          );
          inList = true;
          return;
        }
      }

      if (trimmed === "---") {
        flushList(idx);
        elements.push(<hr key={idx} className="my-4 border-slate-800" />);
        return;
      }

      if (trimmed === "") {
        flushList(idx);
        elements.push(<div key={idx} className="h-2" />);
        return;
      }

      flushList(idx);
      elements.push(
        <p key={idx} className="text-xs text-slate-300 leading-relaxed mb-1.5">
          {parseBoldText(trimmed)}
        </p>
      );
    });

    flushList("final");
    return elements;
  };

  // Checks if a week is unlocked (must complete 100% of the previous week)
  const isWeekUnlocked = (weekNum: number) => {
    if (weekNum === 1) return true;
    if (!cycle || !cycle.days) return false;

    const prevWeek = weekNum - 1;
    const startDayNum = (prevWeek - 1) * 7 + 1;
    const endDayNum = prevWeek * 7;
    const prevWeekDays = cycle.days.filter(
      (d) => d.dayNumber >= startDayNum && d.dayNumber <= endDayNum
    );

    return prevWeekDays.length > 0 && prevWeekDays.every((d) => !!d.completed);
  };

  // Automatically select the active week (the first week with an incomplete day)
  useEffect(() => {
    if (cycle && cycle.days && cycle.days.length > 0) {
      if (cycle.days.length <= 7) {
        setSelectedWeek(cycle.weekNumber || 1);
      } else {
        const firstIncompleteDay = cycle.days.find((d) => !d.completed);
        if (firstIncompleteDay) {
          const activeWeek = Math.floor((firstIncompleteDay.dayNumber - 1) / 7) + 1;
          setSelectedWeek(activeWeek);
        } else {
          setSelectedWeek(Math.ceil(cycle.days.length / 7));
        }
      }
    }
  }, [cycle]);

  // Load and sync daily study goal & studied time from Pomodoro
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

  const handleUpdateGoal = (newGoal: number) => {
    const val = Math.max(0.5, Math.min(24, Math.round(newGoal * 2) / 2)); // 0.5h steps, min 0.5h, max 24h
    setDailyGoalHours(val);
    localStorage.setItem(`daily_study_goal_hours_${currentUser.id}`, val.toString());
    
    // Dispatch storage event to alert all listening components
    window.dispatchEvent(new Event("storage"));
  };

  // Load study cycle from localStorage/Firestore for this student
  useEffect(() => {
    const loadCycle = async () => {
      const saved = localStorage.getItem(`study_cycle_${currentUser.id}`);
      if (saved) {
        try {
          setCycle(JSON.parse(saved));
        } catch (e) {
          setCycle(null);
        }
      } else {
        setCycle(null);
      }

      try {
        const fsCycle = await fetchStudyCycleFromFirestore(currentUser.id);
        if (fsCycle) {
          setCycle(fsCycle);
          localStorage.setItem(`study_cycle_${currentUser.id}`, JSON.stringify(fsCycle));
        } else {
          // Keep local cycle if it exists, and back it up to Firestore
          const savedLocal = localStorage.getItem(`study_cycle_${currentUser.id}`);
          if (savedLocal) {
            try {
              const parsed = JSON.parse(savedLocal);
              if (parsed) {
                setCycle(parsed);
                await saveStudyCycleToFirestore(currentUser.id, parsed);
                return;
              }
            } catch (e) {}
          }
          setCycle(null);
          localStorage.removeItem(`study_cycle_${currentUser.id}`);
        }
      } catch (err) {
        console.error("Error loading cycle from Firestore:", err);
      }
    };

    loadCycle();

    window.addEventListener("storage", loadCycle);
    return () => {
      window.removeEventListener("storage", loadCycle);
    };
  }, [currentUser]);

  // Load syllabus revisions for spaced repetition
  const loadRevisionAlerts = () => {
    const savedSyllabus = localStorage.getItem(`syllabus_progress_${currentUser.id}`);
    if (savedSyllabus) {
      try {
        const parsed: SyllabusSection[] = JSON.parse(savedSyllabus);
        setSyllabusProgress(parsed);
        const todayStr = new Date().toISOString().split("T")[0];
        const alerts: typeof revisionAlerts = [];
        
        parsed.forEach((section) => {
          section.topics.forEach((topic) => {
            if (topic.spacedRepetitionActive && topic.nextRevisionDate) {
              if (topic.nextRevisionDate <= todayStr) {
                alerts.push({
                  sectionId: section.id,
                  subject: section.subject,
                  topicId: topic.id,
                  topicTitle: topic.title,
                  stage: topic.revisionStage || 1,
                  nextDate: topic.nextRevisionDate
                });
              }
            }
          });
        });
        setRevisionAlerts(alerts);
      } catch (e) {
        console.error(e);
      }
    } else {
      setRevisionAlerts([]);
      setSyllabusProgress([]);
    }
  };



  useEffect(() => {
    loadRevisionAlerts();
  }, [currentUser]);

  // Update localStorage helper & sync to Firestore
  const saveCycle = async (updated: StudyCycle) => {
    setCycle(updated);
    localStorage.setItem(`study_cycle_${currentUser.id}`, JSON.stringify(updated));
    try {
      await saveStudyCycleToFirestore(currentUser.id, updated);
    } catch (e) {
      console.error("Error syncing cycle to Firestore:", e);
    }
  };

  const handleSaveNotes = (dayNumber: number, notesText: string) => {
    if (!cycle) return;

    const updatedDays = cycle.days.map((d) => {
      if (d.dayNumber === dayNumber) {
        return { ...d, notes: notesText };
      }
      return d;
    });

    saveCycle({
      ...cycle,
      days: updatedDays
    });
    setEditingNotesDay(null);
  };

  const handleToggleSubject = (dayIndex: number, subjectId: string) => {
    if (!cycle) return;

    const updatedDays = [...cycle.days];
    const day = { ...updatedDays[dayIndex] };
    
    day.subjects = day.subjects.map((s) => {
      if (s.id === subjectId) {
        return { ...s, completed: !s.completed };
      }
      return s;
    });

    // Recalculate day completed status
    day.completed = day.subjects.every((s) => s.completed);

    updatedDays[dayIndex] = day;

    // Recalculate global cycle completed status
    const allDaysCompleted = updatedDays.every((d) => d.completed);

    saveCycle({
      ...cycle,
      days: updatedDays,
      isCompleted: allDaysCompleted
    });
  };

  // Student unlocks next week after fully completing current week
  const handleUnlockNextWeek = () => {
    if (!cycle) return;

    // Verify all days are completed
    const incompleteDays = cycle.days.filter((d) => !d.completed);
    if (incompleteDays.length > 0) {
      alert(
        `Atenção Recruta! Você precisa concluir as metas de todos os dias do ciclo atual antes de destravar a continuidade.\n\nFaltam ${incompleteDays.length} dia(s) com pendências.`
      );
      return;
    }

    // Create Week + N Cycle
    const nextWeekOffset = cycle.days.length <= 7 ? 1 : Math.ceil(cycle.days.length / 7);
    const nextWeekNumber = cycle.weekNumber + nextWeekOffset;
    const nextWeekCycle: StudyCycle = {
      id: `cycle_w${nextWeekNumber}_${currentUser.id}`,
      studentId: currentUser.id,
      studentName: currentUser.name,
      weekNumber: nextWeekNumber,
      isCompleted: false,
      unlockedAt: new Date().toISOString(),
      days: cycle.days.map((d) => ({
        ...d,
        // Reset progress for the next week's content template
        questionSolved: 0,
        completed: false,
        subjects: d.subjects.map((s) => ({
          ...s,
          completed: false
        }))
      }))
    };

    saveCycle(nextWeekCycle);
    alert(`Parabéns! Semana ${nextWeekNumber} desbloqueada com sucesso! Continue mantendo a consistência militar!`);
  };

  const handleCompleteRevision = (sectionId: string, topicId: string) => {
    const savedSyllabus = localStorage.getItem(`syllabus_progress_${currentUser.id}`);
    if (!savedSyllabus) return;

    try {
      const parsed = JSON.parse(savedSyllabus);
      const todayStr = new Date().toISOString().split("T")[0];

      const updated = parsed.map((section: any) => {
        if (section.id === sectionId) {
          const updatedTopics = section.topics.map((topic: any) => {
            if (topic.id === topicId) {
              const currentStage = topic.revisionStage || 1;
              let nextStage = currentStage + 1;
              let daysToAdd = 7;

              if (currentStage === 1) {
                daysToAdd = 7; // Stage 1 -> Stage 2 (7 days)
              } else if (currentStage === 2) {
                daysToAdd = 15; // Stage 2 -> Stage 3 (15 days)
              } else if (currentStage === 3) {
                daysToAdd = 30; // Stage 3 -> Stage 4 (30 days)
              } else {
                nextStage = 5; // Stage 4 -> Stage 5 (Fully Memorized!)
                daysToAdd = 0;
              }

              const nextDate = new Date();
              let nextDateStr = "";
              if (nextStage < 5) {
                nextDate.setDate(nextDate.getDate() + daysToAdd);
                nextDateStr = nextDate.toISOString().split("T")[0];
              }

              return {
                ...topic,
                revisionStage: nextStage,
                nextRevisionDate: nextStage < 5 ? nextDateStr : undefined,
                spacedRepetitionActive: nextStage < 5,
                lastRevisionDate: todayStr,
                studyCount: (topic.studyCount || 0) + 1
              };
            }
            return topic;
          });
          return { ...section, topics: updatedTopics };
        }
        return section;
      });

      localStorage.setItem(`syllabus_progress_${currentUser.id}`, JSON.stringify(updated));
      loadRevisionAlerts();
      
      // Notify other views
      window.dispatchEvent(new Event("storage"));
      
      alert("Excelente! Revisão espaçada concluída. O conteúdo foi reagendado com sucesso!");
    } catch (e) {
      console.error(e);
    }
  };

  // Calculate stats for current cycle if available
  const completedDaysCount = cycle ? cycle.days.filter((d) => d.completed).length : 0;
  const globalProgressPercent = cycle && cycle.days.length > 0 ? Math.round((completedDaysCount / cycle.days.length) * 100) : 0;

  // Filter days for the selected week
  const isShortCycle = cycle && cycle.days.length <= 7;
  const startDayNum = isShortCycle ? 1 : (selectedWeek - 1) * 7 + 1;
  const endDayNum = isShortCycle ? 7 : selectedWeek * 7;
  const weekDays = cycle
    ? cycle.days.filter((d) => d.dayNumber >= startDayNum && d.dayNumber <= endDayNum)
    : [];

  const isSelectedWeekCompleted = weekDays.length > 0 && weekDays.every((d) => d.completed);

  // Rule within the selected week: When 2 or more days are completed, retire/archive the older completed days of the week to keep the focus sharp
  const completedWeekDaysList = weekDays.filter((d) => d.completed);
  const maxCompletedWeekDayNumber = completedWeekDaysList.length > 0
    ? Math.max(...completedWeekDaysList.map((d) => d.dayNumber))
    : 0;

  // A day of the selected week is archived if it is completed and its dayNumber is strictly less than maxCompletedWeekDayNumber
  const archivedDays = weekDays.filter((d) => d.completed && d.dayNumber < maxCompletedWeekDayNumber);
  
  // Active days of the selected week are those that are NOT archived (meaning either not completed, or the most recently completed one)
  const activeDays = weekDays.filter((d) => !d.completed || d.dayNumber === maxCompletedWeekDayNumber);

  const getGridColsClass = (count: number) => {
    switch (count) {
      case 1: return "grid-cols-1";
      case 2: return "grid-cols-1 sm:grid-cols-2";
      case 3: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3";
      case 4: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-4";
      case 5: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
      case 6: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
      default: return "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7";
    }
  };

  return (
    <div id="weekly-cycle-component" className="space-y-6">
      
      {/* Study Streak & Consistency Widget */}
      <ConsistencyWidget currentUser={currentUser} />
      
      {/* Spaced Repetition Revision Alerts Section */}
      {revisionAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/30 rounded-2xl p-5 text-white shadow-lg space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-400/10 text-amber-400">
              <Bell className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
                Revisão Espaçada Pendente
                <span className="bg-amber-400 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded-full">
                  {`${revisionAlerts.length} pendente${revisionAlerts.length > 1 ? "s" : ""}`}
                </span>
              </h3>
              <p className="text-slate-400 text-xs">
                Para consolidar seu aprendizado na memória de longo prazo, faça uma revisão rápida dos tópicos abaixo e marque como concluído.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {revisionAlerts.map((alert) => (
              <div 
                key={alert.topicId} 
                className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between gap-4 hover:border-slate-700 transition"
              >
                <div className="min-w-0">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-widest block mb-0.5">
                    {alert.subject}
                  </span>
                  <p className="text-xs font-semibold text-slate-200 truncate" title={alert.topicTitle}>
                    {alert.topicTitle}
                  </p>
                  <span className="text-[10px] text-slate-500 block mt-1 font-medium">
                    Fase de Revisão: <strong className="text-slate-400">{alert.stage}ª (24h/7d/15d/30d)</strong>
                  </span>
                </div>
                <button
                  onClick={() => handleCompleteRevision(alert.sectionId, alert.topicId)}
                  className="shrink-0 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-[10px] rounded-lg shadow-sm transition uppercase tracking-wider cursor-pointer"
                >
                  Revisado
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Cycle Panel */}
      {cycle ? (
        <>
          {/* Week Header */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
                <Calendar className="w-5 h-5 text-amber-500" />
                <span>{`Ciclo Semanal - Semana ${isShortCycle ? cycle.weekNumber : selectedWeek}`}</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Bata 100% das suas metas diárias de teorias para liberar a continuidade do ciclo.
              </p>
            </div>

            {/* Unlock Indicator or Lock Status */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Progresso do Ciclo</span>
                <span className="text-xl font-bold font-mono text-amber-400">{globalProgressPercent}% Concluído</span>
              </div>

              {cycle.isCompleted ? (
                <button
                  onClick={handleUnlockNextWeek}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-md hover:brightness-110 uppercase tracking-wider animate-bounce"
                >
                  <Unlock className="w-4 h-4 text-slate-950" />
                  <span>Destravar Próxima Semana</span>
                </button>
              ) : isSelectedWeekCompleted ? (
                <div className="px-5 py-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-2 shadow-md">
                  <Award className="w-4 h-4 text-emerald-400 animate-bounce" />
                  <span>{`Semana ${selectedWeek} Concluída!`}</span>
                </div>
              ) : (
                <div className="px-5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-amber-400 text-xs font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                  <span>{`${completedDaysCount} / ${cycle.days.length} Dias`}</span>
                </div>
              )}
            </div>
          </div>

          {/* Plano de Estudos / Detalhes do Ciclo Cadastrados pelo Coordenador */}
          {cycle.cycleDetails && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-3.5 border-l-4 border-l-amber-400 animate-fade-in">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm uppercase tracking-wider">
                <FileText className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Plano de Estudos & Detalhes do Período</span>
              </div>
              <div className="text-slate-200 text-xs leading-relaxed bg-slate-950/60 p-5 rounded-xl border border-slate-850/50 font-sans space-y-1">
                {renderCycleDetailsMarkdown(cycle.cycleDetails)}
              </div>
            </div>
          )}

          {/* Week Selector / Navigation Tabs */}
          {cycle && cycle.days && cycle.days.length > 7 && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Semanas Disponíveis no seu Ciclo de Alocação:</span>
                <span className="text-[10px] font-black text-amber-400 uppercase tracking-wider bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded">
                  {Math.ceil(cycle.days.length / 7)} Semanas Totais
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: Math.ceil(cycle.days.length / 7) }, (_, i) => i + 1).map((w) => {
                  // Check if all 7 days of this week are completed
                  const wStart = (w - 1) * 7 + 1;
                  const wEnd = w * 7;
                  const wDays = cycle.days.filter((d) => d.dayNumber >= wStart && d.dayNumber <= wEnd);
                  const isWeekCompleted = wDays.length > 0 && wDays.every((d) => d.completed);
                  const isCurrentActiveWeek = cycle.days.find((d) => !d.completed)
                    ? Math.floor((cycle.days.find((d) => !d.completed)!.dayNumber - 1) / 7) + 1 === w
                    : Math.ceil(cycle.days.length / 7) === w;

                  const unlocked = isWeekUnlocked(w);

                  return (
                    <button
                      key={w}
                      type="button"
                      onClick={() => {
                        if (unlocked) {
                          setSelectedWeek(w);
                          setLockWarning(null);
                        } else {
                          setLockWarning(`A Semana ${w} está bloqueada! Conclua 100% dos estudos da Semana ${w - 1} para liberá-la.`);
                        }
                      }}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                        selectedWeek === w
                          ? "bg-amber-400 text-slate-950 font-black shadow-lg"
                          : !unlocked
                          ? "bg-slate-950/45 border border-slate-950 text-slate-600 cursor-not-allowed opacity-50"
                          : isCurrentActiveWeek
                          ? "bg-slate-950 border border-amber-400/40 text-amber-400 hover:brightness-110"
                          : isWeekCompleted
                          ? "bg-emerald-950/20 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/40"
                          : "bg-slate-950 hover:bg-slate-850 border border-slate-850 text-slate-400"
                      }`}
                    >
                      <span>{`Semana ${w < 10 ? '0' + w : w}`}</span>
                      {!unlocked && <Lock className="w-3 h-3 text-slate-500 shrink-0" />}
                      {unlocked && isWeekCompleted && <CheckSquare className="w-3.5 h-3.5" />}
                      {unlocked && isCurrentActiveWeek && selectedWeek !== w && (
                        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Lock Warning Area */}
              {lockWarning && (
                <div className="bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between gap-2 animate-fade-in mt-2">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{lockWarning}</span>
                  </div>
                  <button
                    onClick={() => setLockWarning(null)}
                    className="text-[10px] uppercase font-black tracking-widest hover:text-white px-2 py-0.5 bg-amber-500/10 rounded"
                  >
                    Fechar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Daily Study Goal Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-400/10 text-amber-400">
                  <Target className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-100 uppercase tracking-wider">
                    Meta Diária de Estudos
                  </h3>
                  <p className="text-slate-400 text-xs">
                    Defina seu objetivo diário e veja seu progresso em tempo real conforme estuda usando o Pomodoro Tático.
                  </p>
                </div>
              </div>

              {/* Goal Adjuster Controls */}
              <div className="flex items-center gap-3 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-850 self-start sm:self-auto">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-extrabold">Objetivo:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleUpdateGoal(dailyGoalHours - 0.5)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition hover:text-white font-bold text-xs cursor-pointer"
                    title="Diminuir 30min"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-sm font-black text-amber-400 min-w-[45px] text-center">
                    {dailyGoalHours.toFixed(1)}h
                  </span>
                  <button
                    onClick={() => handleUpdateGoal(dailyGoalHours + 0.5)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition hover:text-white font-bold text-xs cursor-pointer"
                    title="Aumentar 30min"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress Status and Visualization */}
            {(() => {
              const studiedHours = studiedSecondsToday / 3600;
              const percent = Math.min(100, Math.round((studiedHours / dailyGoalHours) * 100));
              const isCompleted = studiedHours >= dailyGoalHours;

              return (
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300">Tempo estudado hoje no Pomodoro:</span>
                      <span className="font-mono text-sm font-black text-white bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-850">
                        {`${studiedHours.toFixed(2)}h`}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCompleted ? (
                        <span className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                          <Award className="w-3.5 h-3.5" />
                          Meta Cumprida! Excelente Soldado!
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold flex items-center gap-1">
                          <span>Faltam</span>
                          <span className="text-amber-400 font-mono">{`${(Math.max(0, dailyGoalHours - studiedHours)).toFixed(2)}h`}</span>
                          <span>para atingir a meta</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* High quality progress bar */}
                  <div className="relative">
                    <div className="w-full bg-slate-950 h-4 rounded-full overflow-hidden p-[2px] border border-slate-850">
                      <div
                        className={`h-full rounded-full transition-all duration-500 relative ${
                          isCompleted 
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400" 
                            : "bg-gradient-to-r from-amber-500 to-amber-300"
                        }`}
                        style={{ width: `${percent}%` }}
                      >
                        {/* Glow effect */}
                        <div className="absolute top-0 right-0 bottom-0 left-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.15)_0%,rgba(255,255,255,0)_100%)] animate-pulse" />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between text-[10px] text-slate-500 font-extrabold uppercase tracking-widest">
                    <span>{`${percent}% Completo`}</span>
                    <span>0.0h</span>
                    <span>{`${dailyGoalHours.toFixed(1)}h`}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Active Days Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {`Andamento do Ciclo (${activeDays.length} dia${activeDays.length > 1 ? "s" : ""} ativo${activeDays.length > 1 ? "s" : ""})`}
                </span>
              </div>
              
              {archivedDays.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowArchivedDays(!showArchivedDays)}
                  className="text-xs text-amber-400 hover:text-amber-300 font-extrabold flex items-center gap-1.5 transition cursor-pointer self-start sm:self-auto bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg"
                >
                  <Archive className="w-3.5 h-3.5 shrink-0" />
                  <span>{showArchivedDays ? "Esconder Arquivados" : `Ver ${archivedDays.length} Dia(s) Arquivado(s)`}</span>
                </button>
              )}
            </div>

            {archivedDays.length > 0 && !showArchivedDays && (
              <p className="text-[10px] text-slate-400 italic">
                ⚠️ Os dias antigos já concluídos foram arquivados para poupar espaço e manter seu foco absoluto nas próximas metas. Clique no botão acima caso deseje revisá-los.
              </p>
            )}

            {/* List of Active Days in horizontal rows */}
            <div className="flex flex-col gap-6 lg:gap-8">
              {activeDays.map((day) => {
                const originalIdx = cycle.days.findIndex((d) => d.dayNumber === day.dayNumber);
                const actualDayNum = ((cycle?.weekNumber || 1) - 1) * 7 + day.dayNumber;

                // Match revision alerts that belong to the subjects of this day
                const dayRevisions = revisionAlerts.filter(alert => {
                  return day.subjects.some(sub => {
                    const sName = sub.name.toLowerCase();
                    const aSub = alert.subject.toLowerCase();
                    return sName.includes(aSub) || aSub.includes(sName) ||
                           (aSub.includes("portuguesa") && sName.includes("portuguesa")) ||
                           (aSub.includes("constitucional") && sName.includes("constitucional")) ||
                           (aSub.includes("administrativo") && sName.includes("administrativo")) ||
                           (aSub.includes("penal") && sName.includes("penal")) ||
                           (aSub.includes("militar") && sName.includes("militar")) ||
                           (aSub.includes("humanos") && sName.includes("humanos")) ||
                           (aSub.includes("história") && sName.includes("histór")) ||
                           (aSub.includes("geografia") && sName.includes("geogr")) ||
                           (aSub.includes("informática") && sName.includes("informát")) ||
                           (aSub.includes("raciocínio") && sName.includes("raciocín")) ||
                           (aSub.includes("matemática") && sName.includes("matemát")) ||
                           (aSub.includes("inglês") && sName.includes("inglês")) ||
                           (aSub.includes("inglesa") && sName.includes("ingl"));
                  });
                });

                // Is this the first uncompleted active day?
                const firstUncompletedDay = activeDays.find(d => !d.completed);
                const isFirstUncompleted = firstUncompletedDay && firstUncompletedDay.dayNumber === day.dayNumber;
                
                // If it is the first uncompleted day, let's also find all revision alerts that don't match ANY of the active days' subjects, and show them here as general revisions so they aren't lost
                let generalRevisions: typeof revisionAlerts = [];
                if (isFirstUncompleted) {
                  generalRevisions = revisionAlerts.filter(alert => {
                    // check if it matches ANY day's subjects in the active list
                    const matchesAnyDay = activeDays.some(d => {
                      return d.subjects.some(sub => {
                        const sName = sub.name.toLowerCase();
                        const aSub = alert.subject.toLowerCase();
                        return sName.includes(aSub) || aSub.includes(sName) ||
                               (aSub.includes("portuguesa") && sName.includes("portuguesa")) ||
                               (aSub.includes("constitucional") && sName.includes("constitucional")) ||
                               (aSub.includes("administrativo") && sName.includes("administrativo")) ||
                               (aSub.includes("penal") && sName.includes("penal")) ||
                               (aSub.includes("militar") && sName.includes("militar")) ||
                               (aSub.includes("humanos") && sName.includes("humanos")) ||
                               (aSub.includes("história") && sName.includes("histór")) ||
                               (aSub.includes("geografia") && sName.includes("geogr")) ||
                               (aSub.includes("informática") && sName.includes("informát")) ||
                               (aSub.includes("raciocínio") && sName.includes("raciocín")) ||
                               (aSub.includes("matemática") && sName.includes("matemát")) ||
                               (aSub.includes("inglês") && sName.includes("inglês")) ||
                               (aSub.includes("inglesa") && sName.includes("ingl"));
                      });
                    });
                    return !matchesAnyDay;
                  });
                }

                const allRevisionsForDay = [...dayRevisions, ...generalRevisions];
                const completedSubjectsCount = day.subjects.filter(s => s.completed).length;
                const totalSubjectsCount = day.subjects.length;
                const progressPercent = totalSubjectsCount > 0 ? (completedSubjectsCount / totalSubjectsCount) * 100 : 0;

                return (
                  <div
                    key={day.dayNumber}
                    className={`border-2 rounded-2xl p-6 md:p-8 transition duration-350 shadow-2xl relative overflow-hidden ${
                      day.completed
                        ? "bg-gradient-to-br from-emerald-950/15 via-slate-900 to-slate-950 border-emerald-500/20 text-emerald-100"
                        : "bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 border-slate-800 text-white hover:border-slate-700/80"
                    }`}
                  >
                    {/* Top status bar highlighting active state */}
                    <div className={`absolute top-0 left-0 right-0 h-[3px] ${day.completed ? "bg-emerald-500" : "bg-slate-800"}`} />

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
                      
                      {/* COLUMN 1: DAY INFO & PROGRESS */}
                      <div className="lg:col-span-3 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 pb-5 lg:pb-0 lg:pr-6 md:pr-8 shrink-0">
                        <div className="space-y-4">
                          {/* Day Banner */}
                          <div className="flex items-center justify-between lg:block lg:space-y-2">
                            <div className="flex items-center gap-3">
                              <span className="text-4xl font-extrabold font-mono tracking-tighter text-slate-100">
                                {`DIA ${actualDayNum < 10 ? '0' + actualDayNum : actualDayNum}`}
                              </span>
                              <span
                                className={`w-3.5 h-3.5 rounded-full border-2 ${
                                  day.completed ? "bg-emerald-400 border-emerald-500 animate-pulse" : "bg-amber-500 border-amber-600"
                                }`}
                                title={day.completed ? "Metas Concluídas" : "Pendências Pendentes"}
                              />
                            </div>
                            
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {day.completed ? (
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 font-extrabold uppercase tracking-widest px-2.5 py-1 rounded border border-emerald-500/20">
                                  Meta Cumprida
                                </span>
                              ) : (
                                <span className="text-[10px] bg-amber-400/10 text-amber-400 font-extrabold uppercase tracking-widest px-2.5 py-1 rounded border border-amber-400/20 animate-pulse">
                                  Pendente
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Stats Metrics Grid */}
                          <div className="grid grid-cols-2 lg:grid-cols-1 gap-2 pt-2">
                            <div className="bg-slate-950/50 border border-slate-850 p-2.5 rounded-xl">
                              <span className="text-[9px] text-slate-500 font-extrabold uppercase block tracking-wider">Metas</span>
                              <span className="text-xs font-black text-slate-200">
                                {completedSubjectsCount} / {totalSubjectsCount} Matérias
                              </span>
                            </div>
                            <div className="bg-slate-950/50 border border-slate-850 p-2.5 rounded-xl">
                              <span className="text-[9px] text-slate-500 font-extrabold uppercase block tracking-wider">Meta Questões</span>
                              <span className="text-xs font-black text-amber-400 flex items-center gap-1">
                                <Target className="w-3 h-3 shrink-0 text-amber-500" />
                                {day.questionTarget || 15} Qs
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {totalSubjectsCount > 0 && (
                          <div className="mt-4 pt-3 lg:border-t border-slate-850/50">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                              <span>Progresso de Hoje</span>
                              <span className="font-mono text-amber-400">{Math.round(progressPercent)}%</span>
                            </div>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-850">
                              <div 
                                className={`h-full bg-gradient-to-r transition-all duration-300 ${
                                  day.completed ? "from-emerald-500 to-teal-400" : "from-amber-500 to-amber-300"
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* COLUMN 2: STUDY CONTENT (TEORIAS) */}
                      <div className="lg:col-span-5 flex flex-col justify-between space-y-3.5">
                        <div>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>Teorias & Matérias do Dia (Vertical)</span>
                          </div>
                          
                          <div className="space-y-2.5">
                            {day.subjects.map((sub) => (
                              <button
                                key={sub.id}
                                onClick={() => handleToggleSubject(originalIdx, sub.id)}
                                className={`w-full text-left flex items-start gap-3.5 p-3.5 rounded-xl border transition-all duration-200 group cursor-pointer ${
                                  sub.completed 
                                    ? "bg-emerald-950/20 border-emerald-500/20 text-slate-400 hover:bg-emerald-950/30" 
                                    : "bg-slate-950/50 border-slate-850 text-slate-200 hover:bg-slate-950 hover:border-amber-400/30"
                                }`}
                              >
                                <div className="shrink-0 mt-0.5">
                                  {sub.completed ? (
                                    <CheckSquare className="w-5 h-5 text-emerald-400" />
                                  ) : (
                                    <Square className="w-5 h-5 text-slate-600 group-hover:text-amber-400 transition" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span
                                    className={`text-xs md:text-sm font-semibold leading-relaxed break-words block ${
                                      sub.completed ? "line-through text-slate-500 font-normal" : "text-slate-100 font-bold"
                                    }`}
                                  >
                                    {sub.name}
                                  </span>
                                </div>
                              </button>
                            ))}

                            {day.subjects.length === 0 && (
                              <div className="p-4 bg-slate-950/30 border border-dashed border-slate-850 rounded-xl text-center">
                                <span className="text-xs text-slate-500 italic">Descanso planejado para recarga mental</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* COLUMN 3: REVISIONS & FEEDBACK */}
                      <div className="lg:col-span-4 flex flex-col justify-between border-t lg:border-t-0 lg:border-l border-slate-800/80 pt-5 lg:pt-0 lg:pl-6 md:pl-8 space-y-4">
                        {/* Revisions alerts block */}
                        <div>
                          <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                            <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Revisões Espaçadas Pendentes</span>
                          </div>

                          {allRevisionsForDay.length > 0 ? (
                            <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                              {allRevisionsForDay.map(rev => (
                                <button
                                  key={`day-rev-${rev.topicId}`}
                                  onClick={() => handleCompleteRevision(rev.sectionId, rev.topicId)}
                                  className="w-full text-left flex items-start gap-3 bg-gradient-to-br from-amber-500/10 to-amber-600/5 hover:from-amber-500/20 hover:to-amber-600/10 border border-amber-500/30 hover:border-amber-400/50 p-3 rounded-xl transition group cursor-pointer"
                                >
                                  <div className="shrink-0 mt-0.5">
                                    <CheckSquare className="w-4 h-4 text-amber-400 group-hover:scale-110 transition" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="text-[9px] font-extrabold text-amber-400 uppercase tracking-widest leading-none">
                                        Revisar {rev.subject}
                                      </span>
                                      <span className="text-[8px] bg-amber-400/20 text-amber-300 px-1 py-0.2 rounded uppercase font-black">
                                        Fase {rev.stage}
                                      </span>
                                    </div>
                                    <span className="text-xs text-slate-100 font-bold block mt-1 leading-snug break-words" title={rev.topicTitle}>
                                      {rev.topicTitle}
                                    </span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="p-3 bg-slate-950/20 border border-slate-850/40 rounded-xl text-center">
                              <span className="text-[10px] text-slate-500 italic block">Nenhuma revisão ativa pendente para hoje</span>
                            </div>
                          )}
                        </div>

                        {/* Coordination Feedback / Notes */}
                        {day.notes && (
                          <div className="pt-2 border-t border-slate-850/60 text-left">
                            <div className="bg-slate-950/40 border border-slate-850/40 p-3 rounded-xl space-y-1">
                              <div className="text-[9px] text-amber-400 font-extrabold uppercase tracking-wider flex items-center gap-1">
                                <span>📝 Observações da Coordenação</span>
                              </div>
                              <p className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-wrap break-words">{day.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>

            {/* Collapsible Archived Days Grid */}
            {showArchivedDays && archivedDays.length > 0 && (
              <div className="bg-slate-950/50 border border-slate-850/60 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Archive className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    🗃️ Baú de Dias Concluídos (Arquivados para Foco Máximo)
                  </span>
                </div>
                
                <div className="flex flex-col gap-4 opacity-75 hover:opacity-100 transition duration-300">
                  {archivedDays.map((day) => {
                    const originalIdx = cycle.days.findIndex((d) => d.dayNumber === day.dayNumber);
                    const actualDayNum = ((cycle?.weekNumber || 1) - 1) * 7 + day.dayNumber;
                    return (
                      <div
                        key={day.dayNumber}
                        className="border border-emerald-500/20 bg-emerald-950/10 rounded-xl p-5 md:p-6 flex flex-col md:flex-row gap-4 items-stretch text-emerald-100"
                      >
                        {/* Day Title and Status */}
                        <div className="md:w-1/4 flex flex-col justify-between border-b md:border-b-0 md:border-r border-emerald-500/10 pb-3 md:pb-0 md:pr-4">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-lg font-mono tracking-wider uppercase">
                              {`Dia ${actualDayNum < 10 ? '0' + actualDayNum : actualDayNum}`}
                            </span>
                            <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded uppercase font-black tracking-wider">
                              Arquivado
                            </span>
                          </div>
                          <span className="text-xs text-slate-500 mt-1">Concluído e arquivado para maior foco.</span>
                        </div>

                        {/* Subjects */}
                        <div className="md:w-2/4 space-y-2 flex flex-col justify-center">
                          <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-1">Matérias Estudadas:</div>
                          {day.subjects.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => handleToggleSubject(originalIdx, sub.id)}
                              className="w-full text-left flex items-start gap-2.5 group cursor-pointer"
                            >
                              <CheckSquare className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                              <span className="text-xs leading-snug font-semibold line-through text-slate-500 break-words">
                                {sub.name}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Notes / Observações */}
                        {day.notes && (
                          <div className="md:w-1/4 flex items-center border-t md:border-t-0 md:border-l border-emerald-500/10 pt-3 md:pt-0 md:pl-4">
                            <div className="bg-slate-950/40 border border-emerald-500/10 p-2.5 rounded-lg w-full">
                              <div className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-wider">
                                <span>📝 Observações</span>
                              </div>
                              <p className="text-[10px] text-slate-400 leading-relaxed max-h-[80px] overflow-y-auto whitespace-pre-wrap break-words">{day.notes}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-white shadow-xl">
          <HelpCircle className="w-12 h-12 mx-auto text-amber-500/80 mb-3" />
          <h3 className="font-bold text-lg text-slate-100">Nenhum Ciclo Ativo</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">
            Você ainda não possui um cronograma pessoal configurado pelo coordenador da plataforma. Peça a um administrador para iniciar o seu planejamento semanal na área administrativa.
          </p>
        </div>
      )}

      {/* Helper Tips Area & quick-access to Pomodoro */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-amber-400/10 text-amber-400">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-slate-200">Dica de Produtividade</h4>
            <p className="text-xs text-slate-400 max-w-xl mt-0.5">
              Utilize o Pomodoro Tático ao lado para fracionar seus estudos em blocos de foco de 25 minutos seguidos por 5 de pausa rápida. Isso aumenta a absorção teórica e acelera sua aprovação na PMBA!
            </p>
          </div>
        </div>
        {onOpenPomodoro && (
          <button
            onClick={onOpenPomodoro}
            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition"
          >
            <PlayCircle className="w-4 h-4 text-amber-400" />
            Abrir Pomodoro
          </button>
        )}
      </div>

      {/* Custom Revision Confirmation Modal */}


    </div>
  );
}
