import { useState, useEffect } from "react";
import { StudyCycle, User, SyllabusSection, SyllabusItem } from "../types";
import { CheckSquare, Square, Target, Calendar, Lock, Unlock, HelpCircle, ChevronRight, PlayCircle, Award, Clock, Bell, Archive, Eye, EyeOff } from "lucide-react";
import { fetchStudyCycleFromFirestore, saveStudyCycleToFirestore } from "../lib/firebase";

interface WeeklyCycleProps {
  currentUser: User;
  onOpenPomodoro?: () => void;
}

export default function WeeklyCycle({ currentUser, onOpenPomodoro }: WeeklyCycleProps) {
  const [cycle, setCycle] = useState<StudyCycle | null>(null);
  const [showArchivedDays, setShowArchivedDays] = useState<boolean>(false);
  const [revisionAlerts, setRevisionAlerts] = useState<{
    sectionId: string;
    subject: string;
    topicId: string;
    topicTitle: string;
    stage: number;
    nextDate: string;
  }[]>([]);

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
    const allSubjectsCompleted = day.subjects.every((s) => s.completed);
    const questionsCompleted = day.questionSolved >= day.questionTarget;
    day.completed = allSubjectsCompleted && questionsCompleted;

    updatedDays[dayIndex] = day;

    // Recalculate global cycle completed status
    const allDaysCompleted = updatedDays.every((d) => d.completed);

    saveCycle({
      ...cycle,
      days: updatedDays,
      isCompleted: allDaysCompleted
    });
  };

  const handleUpdateQuestions = (dayIndex: number, amount: number) => {
    if (!cycle) return;

    const updatedDays = [...cycle.days];
    const day = { ...updatedDays[dayIndex] };

    const newVal = Math.max(0, day.questionSolved + amount);
    day.questionSolved = newVal;

    // Recalculate day completed status
    const allSubjectsCompleted = day.subjects.every((s) => s.completed);
    const questionsCompleted = newVal >= day.questionTarget;
    day.completed = allSubjectsCompleted && questionsCompleted;

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
        `Atenção Recruta! Você precisa concluir as metas de todos os 7 dias antes de destravar a continuidade do ciclo.\n\nFaltam ${incompleteDays.length} dia(s) com pendências.`
      );
      return;
    }

    // Create Week + 1 Cycle
    const nextWeekNumber = cycle.weekNumber + 1;
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
  const globalProgressPercent = cycle ? Math.round((completedDaysCount / 7) * 100) : 0;

  // Rule: When 2 or more days are completed, retire/archive the older completed days to keep the focus sharp
  const completedDaysList = cycle ? cycle.days.filter((d) => d.completed) : [];
  const maxCompletedDayNumber = completedDaysList.length > 0
    ? Math.max(...completedDaysList.map((d) => d.dayNumber))
    : 0;

  // A day is archived if it is completed and its dayNumber is strictly less than maxCompletedDayNumber
  const archivedDays = cycle
    ? cycle.days.filter((d) => d.completed && d.dayNumber < maxCompletedDayNumber)
    : [];
  
  // Active days are those that are NOT archived (meaning either not completed, or the most recently completed one)
  const activeDays = cycle
    ? cycle.days.filter((d) => !d.completed || d.dayNumber === maxCompletedDayNumber)
    : [];

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
                  {revisionAlerts.length} pendente{revisionAlerts.length > 1 ? "s" : ""}
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
                <span>Ciclo Semanal - Semana {cycle.weekNumber}</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">
                Bata 100% das suas metas diárias de questões e teorias para liberar a continuidade do ciclo.
              </p>
            </div>

            {/* Unlock Indicator or Lock Status */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Progresso Semanal</span>
                <span className="text-xl font-bold font-mono text-amber-400">{globalProgressPercent}% Concluído</span>
              </div>

              {cycle.isCompleted ? (
                <button
                  onClick={handleUnlockNextWeek}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-md hover:brightness-110 uppercase tracking-wider"
                >
                  <Unlock className="w-4 h-4 text-slate-950 animate-bounce" />
                  <span>Destravar Semana {cycle.weekNumber + 1}</span>
                </button>
              ) : (
                <div className="px-5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 text-xs font-semibold flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-600" />
                  <span>Semana {cycle.weekNumber + 1} Bloqueada</span>
                </div>
              )}
            </div>
          </div>

          {/* Active Days Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Andamento do Ciclo ({activeDays.length} dia{activeDays.length > 1 ? "s" : ""} ativo{activeDays.length > 1 ? "s" : ""})
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

            {/* Grid of Active Days */}
            <div className={`grid ${getGridColsClass(activeDays.length)} gap-4`}>
              {activeDays.map((day) => {
                const originalIdx = cycle.days.findIndex((d) => d.dayNumber === day.dayNumber);
                return (
                  <div
                    key={day.dayNumber}
                    className={`border rounded-xl p-4 flex flex-col justify-between transition ${
                      day.completed
                        ? "bg-emerald-950/25 border-emerald-500/30 text-emerald-100"
                        : "bg-slate-900/90 border-slate-800 text-white hover:border-slate-700"
                    }`}
                  >
                    {/* Day Title and Status */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                      <span className="font-extrabold text-xs font-mono tracking-wider uppercase">
                        Dia 0{day.dayNumber}
                      </span>
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          day.completed ? "bg-emerald-400 animate-pulse" : "bg-amber-500"
                        }`}
                        title={day.completed ? "Metas Concluídas" : "Pendências Pendentes"}
                      />
                    </div>

                    {/* Subjects to study */}
                    <div className="space-y-2 mb-4 flex-1">
                      {day.subjects.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => handleToggleSubject(originalIdx, sub.id)}
                          className="w-full text-left flex items-start gap-2 group cursor-pointer"
                        >
                          <div className="shrink-0 mt-0.5">
                            {sub.completed ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-500 group-hover:text-amber-400" />
                            )}
                          </div>
                          <span
                            className={`text-[11px] leading-snug font-medium break-all ${
                              sub.completed ? "line-through text-slate-500" : "text-slate-200"
                            }`}
                          >
                            {sub.name}
                          </span>
                        </button>
                      ))}

                      {day.subjects.length === 0 && (
                        <span className="text-[10px] text-slate-500 italic block">Descanso planejado</span>
                      )}
                    </div>

                    {/* Daily Questions Counter */}
                    <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850/60 mt-auto">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1.5 font-bold">
                        <span className="flex items-center gap-1">
                          <Target className="w-3 h-3 text-amber-500" />
                          Metas Questões
                        </span>
                        <span className="font-mono text-slate-300">
                          {day.questionSolved}/{day.questionTarget}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          onClick={() => handleUpdateQuestions(originalIdx, -5)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold py-0.5 px-1.5 transition cursor-pointer"
                          title="Remover 5"
                        >
                          -5
                        </button>
                        <button
                          onClick={() => handleUpdateQuestions(originalIdx, -1)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold py-0.5 px-1.5 transition cursor-pointer"
                          title="Remover 1"
                        >
                          -1
                        </button>
                        <button
                          onClick={() => handleUpdateQuestions(originalIdx, 1)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold py-0.5 px-1.5 transition cursor-pointer"
                          title="Adicionar 1"
                        >
                          +1
                        </button>
                        <button
                          onClick={() => handleUpdateQuestions(originalIdx, 5)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[10px] font-bold py-0.5 px-1.5 transition cursor-pointer"
                          title="Adicionar 5"
                        >
                          +5
                        </button>
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
                
                <div className={`grid ${getGridColsClass(archivedDays.length)} gap-4 opacity-75 hover:opacity-100 transition duration-300`}>
                  {archivedDays.map((day) => {
                    const originalIdx = cycle.days.findIndex((d) => d.dayNumber === day.dayNumber);
                    return (
                      <div
                        key={day.dayNumber}
                        className="border border-emerald-500/20 bg-emerald-950/10 rounded-xl p-4 flex flex-col justify-between text-emerald-100"
                      >
                        {/* Day Title and Status */}
                        <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2 mb-3">
                          <span className="font-extrabold text-xs font-mono tracking-wider uppercase">
                            Dia 0{day.dayNumber} (Arquivado)
                          </span>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                        </div>

                        {/* Subjects */}
                        <div className="space-y-2 mb-4 flex-1">
                          {day.subjects.map((sub) => (
                            <button
                              key={sub.id}
                              onClick={() => handleToggleSubject(originalIdx, sub.id)}
                              className="w-full text-left flex items-start gap-2 group cursor-pointer"
                            >
                              <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                              <span className="text-[11px] leading-snug font-medium line-through text-slate-500 break-all">
                                {sub.name}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* Questions count */}
                        <div className="bg-slate-950/80 p-2 rounded-lg border border-slate-850/60 mt-auto">
                          <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
                            <span>Metas Questões</span>
                            <span className="font-mono text-emerald-400">
                              {day.questionSolved}/{day.questionTarget}
                            </span>
                          </div>
                        </div>
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

    </div>
  );
}
