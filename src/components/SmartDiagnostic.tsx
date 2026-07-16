import React, { useEffect, useState } from "react";
import { User, StudyCycle, SyllabusSection, PerformanceLog } from "../types";
import { getStreakStats, StreakStats } from "../lib/streak";
import { saveStudyCycleToFirestore } from "../lib/firebase";
import { 
  Brain, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  ArrowRight, 
  Sparkles, 
  RefreshCw, 
  FileText, 
  Calendar, 
  ChevronRight, 
  TrendingUp, 
  TrendingDown, 
  XCircle, 
  Zap, 
  CheckSquare, 
  Square, 
  Activity,
  Trophy,
  AlertCircle
} from "lucide-react";

interface SmartDiagnosticProps {
  studentId: string;
  studentName: string;
}

interface DiagnosticItem {
  type: string;
  title: string;
  icon: React.ReactNode;
  severity: "high" | "medium" | "low";
  reason: string;
  impact: string;
  recommendation: string;
}

export default function SmartDiagnostic({ studentId, studentName }: SmartDiagnosticProps) {
  const [cycle, setCycle] = useState<StudyCycle | null>(null);
  const [syllabus, setSyllabus] = useState<SyllabusSection[]>([]);
  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [streak, setStreak] = useState<StreakStats>({
    currentStreak: 0,
    longestStreak: 0,
    totalDaysStudied: 0,
    studiedDates: []
  });
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [reorganizing, setReorganizing] = useState(false);
  const [activeTab, setActiveTab] = useState<"diagnostico" | "relatorio">("diagnostico");
  const [showConfirm, setShowConfirm] = useState(false);
  const [customAlert, setCustomAlert] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // Load all necessary user state
  const loadData = () => {
    // 1. Cycle
    const savedCycle = localStorage.getItem(`study_cycle_${studentId}`);
    if (savedCycle) {
      try { setCycle(JSON.parse(savedCycle)); } catch (e) { console.error(e); }
    } else {
      setCycle(null);
    }

    // 2. Syllabus
    const savedSyllabus = localStorage.getItem(`syllabus_progress_${studentId}`);
    if (savedSyllabus) {
      try { setSyllabus(JSON.parse(savedSyllabus)); } catch (e) { console.error(e); }
    }

    // 3. Performance logs
    const savedLogs = localStorage.getItem(`performance_logs_${studentId}`);
    if (savedLogs) {
      try { setLogs(JSON.parse(savedLogs)); } catch (e) { console.error(e); }
    }

    // 4. Streak Stats
    setStreak(getStreakStats(studentId));
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      loadData();
    };

    window.addEventListener("storage", handleUpdate);
    window.addEventListener("streak_updated", handleUpdate);
    return () => {
      window.removeEventListener("storage", handleUpdate);
      window.removeEventListener("streak_updated", handleUpdate);
    };
  }, [studentId]);

  // Run diagnostic analysis whenever data changes
  useEffect(() => {
    runAnalysis();
  }, [cycle, syllabus, logs, streak]);

  const runAnalysis = () => {
    const items: DiagnosticItem[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    // Find first incomplete day in cycle
    const activeDay = cycle?.days.find(d => !d.completed);
    const activeDaySubjects = activeDay ? activeDay.subjects.filter(s => !s.completed).map(s => s.name) : [];

    // 1. Situation: Não estudar matérias previstas no ciclo do dia
    if (activeDay && activeDaySubjects.length > 0 && logs.length > 0) {
      // Check today's logs
      const todayLogs = logs.filter(log => log.date === todayStr);
      if (todayLogs.length > 0) {
        const studiedSubjects = todayLogs.map(l => l.subject.trim().toUpperCase());
        const hasStudiedScheduled = activeDaySubjects.some(sub => 
          studiedSubjects.some(studied => studied.includes(sub.toUpperCase()) || sub.toUpperCase().includes(studied))
        );

        if (!hasStudiedScheduled) {
          items.push({
            type: "mismatch_subject",
            title: "Desvio do Ciclo de Hoje",
            icon: <AlertTriangle className="w-5 h-5 text-rose-400" />,
            severity: "high",
            reason: `Você realizou questões ou registrou atividades de matérias que não estavam previstas para o dia de hoje no seu ciclo ativo (Previstas: ${activeDaySubjects.join(", ")}).`,
            impact: "Quebrar o ciclo de estudos reduz o efeito do estudo intercalado, gerando negligência com matérias críticas e super-exposição a matérias de conforto.",
            recommendation: `Retorne imediatamente ao planejamento estratégico militar. Dedique seu próximo bloco de estudos para cobrir as seguintes matérias pendentes: ${activeDaySubjects.join(", ")}.`
          });
        }
      }
    }

    // 2. Situation: Baixa constância
    if (streak.currentStreak === 0 || streak.currentStreak < 3) {
      items.push({
        type: "low_consistency",
        title: "Alerta de Consistência Baixa",
        icon: <Activity className="w-5 h-5 text-amber-400" />,
        severity: "medium",
        reason: streak.currentStreak === 0 
          ? "Você não possui nenhuma sequência ativa de dias seguidos de estudos no momento."
          : `Sua sequência atual é de apenas ${streak.currentStreak} dia(s), abaixo da meta mínima de constância militar de 3 dias.`,
        impact: "Estudos esporádicos quebram a curva de esquecimento do cérebro, forçando você a re-estudar conteúdos antigos ao invés de avançar na matéria.",
        recommendation: "Estabeleça uma meta não-negociável de estudar pelo menos 20 minutos hoje para ativar e proteger seu multiplicador de constância."
      });
    }

    // 3. Situation: Sequência de faltas (Absences)
    if (streak.studiedDates.length > 0) {
      const sortedDates = [...streak.studiedDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      const lastStudyDate = new Date(sortedDates[0]);
      const diffTime = Math.abs(new Date(todayStr).getTime() - lastStudyDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 2) {
        items.push({
          type: "absence_streak",
          title: "Sequência Crítica de Faltas Detectada",
          icon: <XCircle className="w-5 h-5 text-red-400 animate-pulse" />,
          severity: "high",
          reason: `Faz mais de ${diffDays} dias desde o seu último registro de estudo na plataforma.`,
          impact: "Ausência prolongada destrói o ritmo de estudos e compromete a memorização de curto e médio prazo necessária para a prova da PMBA.",
          recommendation: "Não espere o dia ideal. Abra seu ciclo de hoje e estude apenas a primeira matéria prevista, mesmo que resolva poucas questões. O importante é quebrar a inércia."
        });
      }
    }

    // 4. Situation: Queda no aproveitamento
    if (logs.length >= 4) {
      const allRates = logs.map(l => (l.questionsCorrect / l.questionsAttempted) * 100);
      const overallAvg = allRates.reduce((a, b) => a + b, 0) / allRates.length;
      
      const latestLogs = [...logs].slice(0, 3);
      const latestAvg = latestLogs.reduce((acc, l) => acc + ((l.questionsCorrect / l.questionsAttempted) * 100), 0) / 3;

      if (latestAvg < overallAvg - 12) {
        items.push({
          type: "drop_performance",
          title: "Queda Recente de Aproveitamento",
          icon: <TrendingDown className="w-5 h-5 text-rose-400" />,
          severity: "high",
          reason: `Seu aproveitamento médio nas últimas 3 sessões de questões foi de ${Math.round(latestAvg)}%, significativamente abaixo da sua média histórica de ${Math.round(overallAvg)}%.`,
          impact: "Uma queda brusca indica cansaço mental acumulado, pressa na execução das questões ou falta de revisão da teoria antes da prática.",
          recommendation: "Reduza o ritmo de novos conteúdos. Nas próximas sessões, faça sessões curtas de apenas 5 a 10 questões, com consulta direta aos resumos para recuperar a confiança e ajustar os erros táticos."
        });
      }
    }

    // 5. Situation: Revisões atrasadas
    const overdueRevisions: string[] = [];
    syllabus.forEach((section) => {
      section.topics.forEach((topic) => {
        if (topic.spacedRepetitionActive && topic.nextRevisionDate && topic.nextRevisionDate < todayStr) {
          overdueRevisions.push(topic.title);
        }
      });
    });

    if (overdueRevisions.length > 0) {
      items.push({
        type: "overdue_revisions",
        title: `${overdueRevisions.length} Revisões Espaçadas Atrasadas`,
        icon: <Clock className="w-5 h-5 text-amber-400" />,
        severity: "medium",
        reason: `Existem ${overdueRevisions.length} tópicos do edital com alertas de revisão espaçada vencidos e pendentes de execução.`,
        impact: "Ignorar revisões programadas faz com que a matéria caia na zona de esquecimento profundo, anulando todo o esforço anterior de estudo teórico.",
        recommendation: `Substitua a próxima matéria nova do ciclo por uma rodada de revisão rápida das matérias vencidas: ${overdueRevisions.slice(0, 3).join(", ")}${overdueRevisions.length > 3 ? "..." : ""}.`
      });
    }

    // 6. Situation: Meta semanal em risco
    if (cycle && !cycle.isCompleted) {
      const unlockedDate = new Date(cycle.unlockedAt);
      const daysSinceUnlock = Math.ceil(Math.abs(new Date(todayStr).getTime() - unlockedDate.getTime()) / (1000 * 60 * 60 * 24));
      const completedDays = cycle.days.filter(d => d.completed).length;

      if (daysSinceUnlock >= 4 && completedDays < 3) {
        items.push({
          type: "weekly_goal_risk",
          title: "Meta Semanal em Risco Crítico",
          icon: <AlertCircle className="w-5 h-5 text-rose-400 animate-bounce" />,
          severity: "high",
          reason: `Seu ciclo semanal foi liberado há ${daysSinceUnlock} dias, mas você concluiu apenas ${completedDays} dos 7 dias previstos.`,
          impact: "O acúmulo de metas atrasadas gera ansiedade, sobrecarga nas semanas seguintes e atraso no cronograma final pré-prova.",
          recommendation: "Use a nossa ferramenta de 'Reorganizar Rotina' abaixo para recalcular e suavizar suas metas, permitindo que você retome as metas diárias de forma realista."
        });
      }
    }

    // 7. Situation: Muitas questões erradas (Subjects with < 60% rate)
    const subjectStats: { [key: string]: { attempted: number; correct: number } } = {};
    logs.forEach(log => {
      const sub = log.subject.trim().toUpperCase();
      if (!subjectStats[sub]) {
        subjectStats[sub] = { attempted: 0, correct: 0 };
      }
      subjectStats[sub].attempted += log.questionsAttempted;
      subjectStats[sub].correct += log.questionsCorrect;
    });

    const criticalSubjects = Object.keys(subjectStats).filter(sub => {
      const stats = subjectStats[sub];
      return stats.attempted >= 15 && (stats.correct / stats.attempted) < 0.60;
    });

    if (criticalSubjects.length > 0) {
      items.push({
        type: "high_error_subject",
        title: "Ponto Cego no Edital Detectado",
        icon: <TrendingDown className="w-5 h-5 text-rose-500" />,
        severity: "high",
        reason: `Você está apresentando um aproveitamento crítico (abaixo de 60%) nas matérias: ${criticalSubjects.map(s => s.toLowerCase()).join(", ")}.`,
        impact: "Insistir em resolver questões sem sanar as lacunas teóricas básicas dessas disciplinas continuará gerando frustração e perda de pontos fáceis na prova.",
        recommendation: "Suspenda temporariamente a resolução cega de questões dessas matérias. Volte na teoria do edital verticalizado, assista às videoaulas recomendadas e elabore um mapa mental simples antes de praticar novamente."
      });
    }

    // 8. Situation: Excesso de tempo/foco em uma disciplina
    if (logs.length >= 6) {
      const totalLogsCount = logs.length;
      const counts: { [key: string]: number } = {};
      logs.forEach(log => {
        counts[log.subject] = (counts[log.subject] || 0) + 1;
      });

      const overfocusedSubject = Object.keys(counts).find(sub => (counts[sub] / totalLogsCount) > 0.60);
      if (overfocusedSubject) {
        items.push({
          type: "overfocus_subject",
          title: "Monopólio de Disciplina",
          icon: <Brain className="w-5 h-5 text-amber-500" />,
          severity: "medium",
          reason: `A disciplina "${overfocusedSubject}" monopoliza mais de 60% dos seus registros de estudo recentes, enquanto outras disciplinas importantes do ciclo estão paralisadas.`,
          impact: "A prova da PMBA exige nota mínima e equilíbrio entre disciplinas. Dominar apenas uma matéria enquanto zera ou tira notas pífias em outras causará sua eliminação.",
          recommendation: `Força policial exige equilíbrio! Coloque "${overfocusedSubject}" em modo de manutenção curta e priorize as outras matérias do seu ciclo de estudos hoje.`
        });
      }
    }

    // Default encouragement if everything looks spectacular
    if (items.length === 0) {
      items.push({
        type: "perfect_flow",
        title: "Desempenho de Elite Detectado",
        icon: <Trophy className="w-5 h-5 text-amber-400 animate-bounce" />,
        severity: "low",
        reason: "Nenhuma inconsistência, desvio ou atraso foi detectado no seu perfil de estudos atual. Você está mantendo a disciplina de forma exemplar.",
        impact: "Manter este padrão de regularidade e aproveitamento coloca você no topo do percentual de aprovados do próximo concurso PMBA.",
        recommendation: "Continue executando o ciclo atual com foco extremo. Não altere nada em sua rotina, o plano tático está funcionando com precisão militar."
      });
    }

    setDiagnostics(items);
  };

  // Reorganizar Rotina Automática:
  // Re-balances upcoming incomplete days of study cycle: distributes uncompleted subjects,
  // resets target questions to a realistic level (e.g. 10-15 per day) to avoid overwhelm.
  const triggerReorganize = () => {
    if (!cycle) {
      setCustomAlert({
        show: true,
        title: "Aviso",
        message: "Nenhum ciclo ativo encontrado para reorganizar.",
        type: "warning"
      });
      return;
    }
    setShowConfirm(true);
  };

  const executeReorganize = async () => {
    if (!cycle) return;
    setReorganizing(true);

    try {
      // 1. Gather all pending subjects from the entire cycle
      const allPendingSubjects: string[] = [];
      cycle.days.forEach(day => {
        day.subjects.forEach(sub => {
          if (!sub.completed && !allPendingSubjects.includes(sub.name)) {
            allPendingSubjects.push(sub.name);
          }
        });
      });

      if (allPendingSubjects.length === 0) {
        setCustomAlert({
          show: true,
          title: "Sem Pendências",
          message: "Excelente notícia: você não possui nenhuma matéria pendente no ciclo ativo para redistribuir!",
          type: "success"
        });
        setReorganizing(false);
        return;
      }

      // 2. Re-create days. Keep completed days intact, reorganize incomplete days
      const updatedDays = cycle.days.map((day, idx) => {
        if (day.completed) {
          return day; // Leave completed days as is
        }

        // For incomplete days, distribute pending subjects
        // We take up to 2 subjects from the pending pool for each remaining day
        const daySubjects = [];
        const subIndex1 = (idx * 2) % allPendingSubjects.length;
        const subIndex2 = (idx * 2 + 1) % allPendingSubjects.length;

        daySubjects.push({
          id: `sub_${idx}_1_${Date.now()}`,
          name: allPendingSubjects[subIndex1],
          completed: false
        });

        if (allPendingSubjects.length > 1 && allPendingSubjects[subIndex1] !== allPendingSubjects[subIndex2]) {
          daySubjects.push({
            id: `sub_${idx}_2_${Date.now()}`,
            name: allPendingSubjects[subIndex2],
            completed: false
          });
        }

        return {
          ...day,
          questionTarget: 12, // Standard realistic military target
          questionSolved: 0,
          completed: false,
          subjects: daySubjects
        };
      });

      const updatedCycle: StudyCycle = {
        ...cycle,
        days: updatedDays,
        isCompleted: false
      };

      // Save locally
      localStorage.setItem(`study_cycle_${studentId}`, JSON.stringify(updatedCycle));
      setCycle(updatedCycle);

      // Save to Firestore
      await saveStudyCycleToFirestore(studentId, updatedCycle);

      // Trigger dispatch event
      window.dispatchEvent(new Event("storage"));

      setCustomAlert({
        show: true,
        title: "Rotina Reorganizada",
        message: "Ordem de serviço atualizada! Sua rotina foi reorganizada com sucesso. As metas diárias de questões foram reajustadas para 12 acertos e as matérias pendentes foram redistribuídas de forma equilibrada. Volte aos estudos com força total!",
        type: "success"
      });
    } catch (e) {
      console.error("Error reorganizing study cycle:", e);
      setCustomAlert({
        show: true,
        title: "Erro de Reorganização",
        message: "Houve um erro técnico ao re-balancear seu ciclo no servidor. Tente novamente mais tarde.",
        type: "error"
      });
    } finally {
      setReorganizing(false);
    }
  };

  // Generate Cumprido vs Pendente Report Data
  const getReportSummary = () => {
    if (!cycle) return { fulfilled: [], pending: [], totalQuestionsSolved: 0, targetQuestions: 0 };

    const fulfilled: string[] = [];
    const pending: string[] = [];
    let totalQuestionsSolved = 0;
    let targetQuestions = 0;

    cycle.days.forEach(day => {
      totalQuestionsSolved += day.questionSolved;
      targetQuestions += day.questionTarget;

      const actualDayNum = ((cycle?.weekNumber || 1) - 1) * 7 + day.dayNumber;

      day.subjects.forEach(sub => {
        if (sub.completed) {
          fulfilled.push(`Dia ${actualDayNum < 10 ? '0' + actualDayNum : actualDayNum}: ${sub.name}`);
        } else {
          pending.push(`Dia ${actualDayNum < 10 ? '0' + actualDayNum : actualDayNum}: ${sub.name}`);
        }
      });
    });

    return {
      fulfilled,
      pending,
      totalQuestionsSolved,
      targetQuestions
    };
  };

  const reportData = getReportSummary();

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-6 shadow-xl relative overflow-hidden">
      
      {/* Decorative gradient blur background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-400/20 to-amber-600/10 border border-amber-400/30 rounded-2xl text-amber-400 shadow-inner">
            <Brain className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest block">Inteligência Operacional</span>
            <h2 className="text-base font-black text-white uppercase tracking-wider">Diagnóstico Inteligente PMBA</h2>
          </div>
        </div>

        {/* Tab selector */}
        <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-850 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("diagnostico")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "diagnostico"
                ? "bg-amber-400 text-slate-950 font-black shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Análise de Rendimento
          </button>
          <button
            onClick={() => setActiveTab("relatorio")}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
              activeTab === "relatorio"
                ? "bg-amber-400 text-slate-950 font-black shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Painel Cumprido vs Pendente
          </button>
        </div>
      </div>

      {activeTab === "diagnostico" ? (
        <div className="space-y-6">
          
          {/* Action Call to automatically reorganize */}
          {cycle && (
            <div className="bg-gradient-to-r from-amber-500/10 via-slate-950/40 to-slate-950/20 border border-amber-500/25 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow">
              <div className="space-y-1">
                <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
                  Gargalo ou Atraso no Ciclo?
                </h4>
                <p className="text-[11px] text-slate-300 max-w-2xl leading-relaxed">
                  Não deixe o acúmulo de metas congelar seu progresso. Nosso algoritmo tático redistribui automaticamente suas tarefas pendentes de forma equilibrada em metas diárias mais confortáveis.
                </p>
              </div>
              <button
                onClick={triggerReorganize}
                disabled={reorganizing}
                className="w-full md:w-auto px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider shadow shadow-amber-950/30 shrink-0"
              >
                {reorganizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Reorganizando...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Reorganizar Rotina</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Diagnostic Cards List */}
          <div className="space-y-4">
            {diagnostics.map((diag, index) => (
              <div 
                key={index} 
                className={`border rounded-2xl p-5 space-y-4 transition-all relative overflow-hidden ${
                  diag.severity === "high"
                    ? "bg-rose-950/10 border-rose-900/30"
                    : diag.severity === "medium"
                    ? "bg-amber-950/10 border-amber-900/20"
                    : "bg-emerald-950/10 border-emerald-900/20"
                }`}
              >
                {/* Lateral high contrast visual line */}
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  diag.severity === "high"
                    ? "bg-rose-500"
                    : diag.severity === "medium"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`} />

                {/* Card Title */}
                <div className="flex items-center gap-2.5 pl-1.5">
                  <div className={`p-1.5 rounded-lg ${
                    diag.severity === "high"
                      ? "bg-rose-500/10 text-rose-400"
                      : diag.severity === "medium"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-emerald-500/10 text-emerald-400"
                  }`}>
                    {diag.icon}
                  </div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    {diag.title}
                  </h3>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ml-auto ${
                    diag.severity === "high"
                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/20"
                      : diag.severity === "medium"
                      ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                  }`}>
                    {diag.severity === "high" ? "Alta Prioridade" : diag.severity === "medium" ? "Aviso Médio" : "Normal"}
                  </span>
                </div>

                {/* 3 Columns structure as mandated */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1 pl-1.5">
                  {/* MOTIVO */}
                  <div className="space-y-1 bg-slate-950/30 p-3 rounded-xl border border-slate-850/40">
                    <span className="text-[9px] text-rose-400 font-extrabold uppercase tracking-widest block">MOTIVO DO ALERTA</span>
                    <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                      {diag.reason}
                    </p>
                  </div>

                  {/* IMPACTO */}
                  <div className="space-y-1 bg-slate-950/30 p-3 rounded-xl border border-slate-850/40">
                    <span className="text-[9px] text-amber-400 font-extrabold uppercase tracking-widest block">IMPACTO NA APROVAÇÃO</span>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      {diag.impact}
                    </p>
                  </div>

                  {/* RECOMENDAÇÃO */}
                  <div className="space-y-1 bg-amber-400/5 p-3 rounded-xl border border-amber-400/10">
                    <span className="text-[9px] text-emerald-400 font-extrabold uppercase tracking-widest block flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      RECOMENDAÇÃO TÁTICA
                    </span>
                    <p className="text-[11px] text-slate-100 leading-relaxed font-bold">
                      {diag.recommendation}
                    </p>
                  </div>
                </div>

              </div>
            ))}
          </div>

        </div>
      ) : (
        <div className="space-y-6">
          {/* Cumprido vs Pendente Summary Report */}
          <div className="bg-slate-950/50 rounded-2xl border border-slate-850 p-5 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-amber-400" />
                  Relatório do Cumprimento do Ciclo
                </h3>
                <p className="text-[10px] text-slate-400">Detalhamento tático de todas as tarefas planejadas para a semana atual do recruta.</p>
              </div>

              {/* Weekly progress micro-stats */}
              <div className="flex items-center gap-3 bg-slate-900 px-4 py-2 border border-slate-800 rounded-xl">
                <div className="text-center">
                  <span className="text-xs font-black text-amber-400 font-mono block">
                    {reportData.totalQuestionsSolved} / {reportData.targetQuestions}
                  </span>
                  <span className="text-[8px] text-slate-400 uppercase font-bold">Questões do Ciclo</span>
                </div>
                <div className="w-px h-6 bg-slate-850" />
                <div className="text-center">
                  <span className="text-xs font-black text-emerald-400 font-mono block">
                    {cycle ? Math.round((reportData.fulfilled.length / (reportData.fulfilled.length + reportData.pending.length || 1)) * 100) : 0}%
                  </span>
                  <span className="text-[8px] text-slate-400 uppercase font-bold">Matérias Concluídas</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* O que foi cumprido (Fulfilled) */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-emerald-950 pb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400 fill-emerald-400/10" />
                  O que foi Cumprido
                </h4>
                
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {reportData.fulfilled.map((item, idx) => (
                    <div key={idx} className="bg-emerald-950/15 border border-emerald-900/20 px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-slate-200 text-xs">
                      <CheckSquare className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span className="font-semibold">{item}</span>
                    </div>
                  ))}

                  {reportData.fulfilled.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs font-mono">
                      Nenhuma matéria concluída no ciclo atual até o momento.
                    </div>
                  )}
                </div>
              </div>

              {/* O que ficou pendente (Pending) */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-rose-950 pb-2">
                  <XCircle className="w-4 h-4 text-rose-400 fill-rose-400/10" />
                  O que ficou Pendente
                </h4>
                
                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                  {reportData.pending.map((item, idx) => (
                    <div key={idx} className="bg-rose-950/10 border border-rose-900/15 px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-slate-300 text-xs">
                      <Square className="w-4 h-4 text-rose-500/50 shrink-0" />
                      <span className="font-medium">{item}</span>
                    </div>
                  ))}

                  {reportData.pending.length === 0 && (
                    <div className="text-center py-8 text-emerald-400 text-xs font-bold font-mono">
                      Parabéns! Nenhuma matéria pendente. Ciclo 100% cumprido! 🎖️
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400">
              <Zap className="w-6 h-6 fill-amber-400 animate-pulse text-amber-400" />
              <h3 className="text-base font-black uppercase tracking-wider">Atenção Recruta!</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Deseja que o algoritmo tático reorganize seu ciclo de estudos automaticamente?
            </p>
            <div className="bg-slate-950/50 border border-slate-850 p-3 rounded-xl text-[11px] text-slate-400 space-y-1">
              <p>• Agrupa as matérias pendentes da semana.</p>
              <p>• Redistribui as matérias de forma equilibrada nos dias restantes.</p>
              <p>• Ajusta a meta de questões para 12 por dia (volume saudável).</p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-slate-850 hover:bg-slate-800 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  executeReorganize();
                }}
                className="flex-1 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert && customAlert.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-white space-y-4 shadow-2xl">
            <div className="flex items-center gap-2">
              {customAlert.type === "success" ? (
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              ) : customAlert.type === "warning" ? (
                <AlertCircle className="w-6 h-6 text-amber-400" />
              ) : (
                <XCircle className="w-6 h-6 text-rose-500" />
              )}
              <h3 className="text-base font-black uppercase tracking-wider">{customAlert.title}</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{customAlert.message}</p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="w-full px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-xs font-bold rounded-xl transition cursor-pointer"
              >
                OK, Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
