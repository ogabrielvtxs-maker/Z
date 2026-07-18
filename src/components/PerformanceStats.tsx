import React, { useState, useEffect } from "react";
import { PerformanceLog, User, SyllabusSection } from "../types";
import { AlertCircle, Plus, Filter, Trash2, TrendingUp, BarChart2, ShieldAlert, Award, Clock, Layers, BookOpen } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from "recharts";
import { 
  fetchPerformanceLogsFromFirestore, 
  savePerformanceLogToFirestore, 
  deletePerformanceLogFromFirestore,
  fetchSyllabusProgressFromFirestore
} from "../lib/firebase";
import { initialSyllabusData } from "../data/syllabusData";
import ConsistencyWidget from "./ConsistencyWidget";
import SmartDiagnostic from "./SmartDiagnostic";

interface PerformanceStatsProps {
  currentUser: User;
  overrideStudentId?: string; // Admin can override to view a student's stats
}

const ERROR_REASONS = [
  "Falta de Atenção / Distração",
  "Não sabia a teoria / Conteúdo não estudado",
  "Pegadinha / Casca de Banana",
  "Esquecimento da matéria / Falta de revisão",
  "Interpretação incorreta do enunciado",
  "Dificuldade com cálculo / matemática",
  "Outro motivo"
];

const PRE_SEEDED_SUBJECTS = [
  "Língua Portuguesa",
  "Língua Inglesa",
  "Matemática",
  "Informática",
  "História do Brasil",
  "Geografia do Brasil",
  "Direito Constitucional",
  "Direitos Humanos",
  "Direito Administrativo",
  "Direito Penal",
  "Direito Penal Militar",
  "Igualdade Racial e de Gênero"
];

export default function PerformanceStats({ currentUser, overrideStudentId }: PerformanceStatsProps) {
  const targetStudentId = overrideStudentId || currentUser.id;
  const isViewingAsAdmin = !!overrideStudentId;

  const [logs, setLogs] = useState<PerformanceLog[]>([]);
  const [subject, setSubject] = useState<string>("");
  const [topic, setTopic] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [attempted, setAttempted] = useState<number>(10);
  const [correct, setCorrect] = useState<number>(8);

  const [filterSubject, setFilterSubject] = useState<string>("Todos");
  const [filterReason, setFilterReason] = useState<string>("Todos");
  const [timeFilter, setTimeFilter] = useState<"1" | "7" | "30" | "all">("all");

  const [cycle, setCycle] = useState<any>(null);

  const [syllabus, setSyllabus] = useState<SyllabusSection[]>([]);
  const [syllabusTab, setSyllabusTab] = useState<"cfo" | "soldado">("soldado");

  // Custom modals to bypass iframe window.confirm & alert blocks
  const [customConfirm, setCustomConfirm] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const [customAlert, setCustomAlert] = useState<{
    show: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);

  // Determine initial syllabus tab based on user access
  useEffect(() => {
    if (currentUser.accessCFO && !currentUser.accessSoldado) {
      setSyllabusTab("cfo");
    } else {
      setSyllabusTab("soldado");
    }
  }, [currentUser]);

  // Load syllabus progress
  useEffect(() => {
    const loadSyllabus = async () => {
      const saved = localStorage.getItem(`syllabus_progress_${targetStudentId}`);
      if (saved) {
        try {
          setSyllabus(JSON.parse(saved));
        } catch (e) {
          setSyllabus(initialSyllabusData);
        }
      } else {
        setSyllabus(initialSyllabusData);
      }

      try {
        const fsSyllabus = await fetchSyllabusProgressFromFirestore(targetStudentId);
        if (fsSyllabus && fsSyllabus.length > 0) {
          setSyllabus(fsSyllabus);
          localStorage.setItem(`syllabus_progress_${targetStudentId}`, JSON.stringify(fsSyllabus));
        }
      } catch (err) {
        console.error("Error loading syllabus from Firestore in stats:", err);
      }
    };

    loadSyllabus();
  }, [targetStudentId]);

  // Handle wiping performance logs
  const handleClearAllData = async () => {
    setCustomConfirm({
      show: true,
      title: "Confirmar Exclusão de Histórico",
      message: "Atenção Recruta! Você tem certeza absoluta de que deseja APAGAR TODOS os seus dados de desempenho? Esta ação é irreversível e limpará todo o seu histórico de questões lançadas.",
      onConfirm: async () => {
        setCustomConfirm(null);
        try {
          // Clear local storage and state immediately so UI updates instantly
          localStorage.setItem(`performance_logs_${targetStudentId}`, JSON.stringify([]));
          setLogs([]);

          // Clear Firestore logs in parallel
          const deletePromises = logs.map(log => 
            deletePerformanceLogFromFirestore(targetStudentId, log.id).catch(err => {
              console.warn(`Error deleting log ${log.id} from Firestore, continuing:`, err);
            })
          );
          
          await Promise.all(deletePromises);
          
          setCustomAlert({
            show: true,
            title: "Histórico Apagado",
            message: "Sucesso! Todo o histórico de desempenho foi apagado com sucesso.",
            type: "success"
          });
        } catch (err) {
          console.error("Error clearing logs:", err);
          setCustomAlert({
            show: true,
            title: "Erro na Limpeza",
            message: "O histórico foi limpo localmente, mas houve uma instabilidade ao sincronizar com o banco de dados.",
            type: "warning"
          });
        }
      }
    });
  };

  // Calculations for edital coverage
  const currentSyllabusSections = syllabus.length > 0 ? syllabus : initialSyllabusData;
  const filteredSyllabusSections = currentSyllabusSections.filter((s) => s.category === syllabusTab);
  
  const totalSyllabusTopicsCount = filteredSyllabusSections.reduce((acc, curr) => acc + curr.topics.length, 0);
  const completedSyllabusTopicsCount = filteredSyllabusSections.reduce((acc, curr) => acc + curr.topics.filter((t) => t.isCompleted).length, 0);
  
  const syllabusCompletionPct = totalSyllabusTopicsCount > 0 
    ? Math.round((completedSyllabusTopicsCount / totalSyllabusTopicsCount) * 100) 
    : 0;

  // New aggregate coverage calculations: averages read, summaries and solved questions per topic
  const totalReadCount = filteredSyllabusSections.reduce((acc, curr) => acc + curr.topics.filter((t) => t.isCompleted).length, 0);
  const totalSummaryCount = filteredSyllabusSections.reduce((acc, curr) => acc + curr.topics.filter((t) => t.hasSummary).length, 0);
  const totalQuestionsCount = filteredSyllabusSections.reduce((acc, curr) => acc + curr.topics.filter((t) => t.hasQuestions).length, 0);

  const totalCheckpoints = totalSyllabusTopicsCount * 3;
  const completedCheckpoints = totalReadCount + totalSummaryCount + totalQuestionsCount;
  
  const aggregateSyllabusCompletionPct = totalCheckpoints > 0
    ? Math.min(100, Math.round((completedCheckpoints / totalCheckpoints) * 100))
    : 0;

  // Subject-wise breakdown for active category
  const subjectProgressList = filteredSyllabusSections.map((section) => {
    const total = section.topics.length;
    const completed = section.topics.filter((t) => t.isCompleted).length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
    return {
      subject: section.subject,
      completed,
      total,
      pct
    };
  }).sort((a, b) => b.pct - a.pct || a.subject.localeCompare(b.subject));

  // Pie/Donut Chart data (Using Aggregate Progress now for rich visualization)
  const donutData = totalSyllabusTopicsCount > 0 ? [
    { name: "Concluído", value: completedCheckpoints, color: "#fbbf24" }, // amber-400
    { name: "Pendente", value: Math.max(0, totalCheckpoints - completedCheckpoints), color: "#1e293b" } // slate-800
  ] : [
    { name: "Pendente", value: 1, color: "#1e293b" }
  ];

  // Load cycle to compute daily study hours
  useEffect(() => {
    const loadCycle = () => {
      const saved = localStorage.getItem(`study_cycle_${targetStudentId}`);
      if (saved) {
        try {
          setCycle(JSON.parse(saved));
        } catch (e) {
          setCycle(null);
        }
      } else {
        setCycle(null);
      }
    };
    loadCycle();
    window.addEventListener("storage", loadCycle);
    return () => window.removeEventListener("storage", loadCycle);
  }, [targetStudentId]);

  // Load logs
  useEffect(() => {
    const loadLogs = async () => {
      const saved = localStorage.getItem(`performance_logs_${targetStudentId}`);
      if (saved) {
        try {
          setLogs(JSON.parse(saved));
        } catch (e) {
          setLogs([]);
        }
      } else {
        setLogs([]);
      }

      try {
        const fsLogs = await fetchPerformanceLogsFromFirestore(targetStudentId);
        if (fsLogs.length > 0) {
          setLogs(fsLogs.sort((a, b) => b.id.localeCompare(a.id)));
          localStorage.setItem(`performance_logs_${targetStudentId}`, JSON.stringify(fsLogs));
        }
      } catch (err) {
        console.error("Error loading performance logs from Firestore:", err);
      }
    };

    loadLogs();
  }, [targetStudentId]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject || !topic || !reason) {
      setCustomAlert({
        show: true,
        title: "Campo Obrigatório",
        message: "Por favor, preencha todos os campos obrigatórios para salvar o seu desempenho.",
        type: "warning"
      });
      return;
    }

    if (correct > attempted) {
      setCustomAlert({
        show: true,
        title: "Valores Incompatíveis",
        message: "O número de acertos não pode ser maior que o número de questões respondidas. Verifique seus lançamentos.",
        type: "warning"
      });
      return;
    }

    const newLog: PerformanceLog = {
      id: "log_" + Date.now(),
      studentId: targetStudentId,
      date: new Date().toISOString().split("T")[0],
      subject,
      topic,
      reasonForError: reason,
      questionsAttempted: attempted,
      questionsCorrect: correct
    };

    const updated = [newLog, ...logs];
    setLogs(updated);
    localStorage.setItem(`performance_logs_${targetStudentId}`, JSON.stringify(updated));

    // Clear inputs
    setTopic("");
    setAttempted(10);
    setCorrect(8);

    try {
      await savePerformanceLogToFirestore(targetStudentId, newLog);
    } catch (e) {
      console.error("Error saving log to Firestore:", e);
    }
  };

  const handleDeleteLog = async (id: string) => {
    setCustomConfirm({
      show: true,
      title: "Excluir Registro",
      message: "Deseja realmente excluir este registro de desempenho?",
      onConfirm: async () => {
        setCustomConfirm(null);
        const updated = logs.filter((log) => log.id !== id);
        setLogs(updated);
        localStorage.setItem(`performance_logs_${targetStudentId}`, JSON.stringify(updated));
        try {
          await deletePerformanceLogFromFirestore(targetStudentId, id);
        } catch (e) {
          console.error("Error deleting log from Firestore:", e);
        }
      }
    });
  };

  // Apply time filters first
  const timeFilteredLogs = (() => {
    if (timeFilter === "all") return logs;
    const now = new Date();
    const filterDate = new Date();
    if (timeFilter === "1") {
      filterDate.setDate(now.getDate() - 1);
    } else if (timeFilter === "7") {
      filterDate.setDate(now.getDate() - 7);
    } else if (timeFilter === "30") {
      filterDate.setDate(now.getDate() - 30);
    }
    const filterDateStr = filterDate.toISOString().split("T")[0];
    return logs.filter((log) => log.date >= filterDateStr);
  })();

  // Metrics calculators
  const filteredLogs = timeFilteredLogs.filter((log) => {
    const matchesSub = filterSubject === "Todos" || log.subject === filterSubject;
    const matchesReason = filterReason === "Todos" || log.reasonForError === filterReason;
    return matchesSub && matchesReason;
  });

  const totalAttempted = filteredLogs.reduce((sum, log) => sum + log.questionsAttempted, 0);
  const totalCorrect = filteredLogs.reduce((sum, log) => sum + log.questionsCorrect, 0);
  const totalIncorrect = totalAttempted - totalCorrect;
  const overallRate = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0;

  // Mistakes group by Subject
  const subjectMistakesMap: Record<string, number> = {};
  timeFilteredLogs.forEach((log) => {
    const missed = log.questionsAttempted - log.questionsCorrect;
    if (missed > 0) {
      subjectMistakesMap[log.subject] = (subjectMistakesMap[log.subject] || 0) + missed;
    }
  });

  const sortedSubjectMistakes = Object.entries(subjectMistakesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const maxSubjectMistakes = sortedSubjectMistakes.length > 0 ? Math.max(...sortedSubjectMistakes.map((s) => s.count)) : 1;

  // Mistakes group by Reason
  const reasonMistakesMap: Record<string, number> = {};
  timeFilteredLogs.forEach((log) => {
    const missed = log.questionsAttempted - log.questionsCorrect;
    if (missed > 0) {
      reasonMistakesMap[log.reasonForError] = (reasonMistakesMap[log.reasonForError] || 0) + missed;
    }
  });

  const sortedReasonMistakes = Object.entries(reasonMistakesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const maxReasonMistakes = sortedReasonMistakes.length > 0 ? Math.max(...sortedReasonMistakes.map((r) => r.count)) : 1;

  // Group logs by topic for Ranking of Errors
  const topicErrorsMap: Record<string, { topic: string; subject: string; mistakesCount: number; correctRate: number; attempted: number; correct: number; reasons: Record<string, number> }> = {};
  
  timeFilteredLogs.forEach((log) => {
    const missed = log.questionsAttempted - log.questionsCorrect;
    if (missed >= 0) {
      if (!topicErrorsMap[log.topic]) {
        topicErrorsMap[log.topic] = {
          topic: log.topic,
          subject: log.subject,
          mistakesCount: 0,
          correctRate: 0,
          attempted: 0,
          correct: 0,
          reasons: {}
        };
      }
      topicErrorsMap[log.topic].mistakesCount += missed;
      topicErrorsMap[log.topic].attempted += log.questionsAttempted;
      topicErrorsMap[log.topic].correct += log.questionsCorrect;
      topicErrorsMap[log.topic].reasons[log.reasonForError] = (topicErrorsMap[log.topic].reasons[log.reasonForError] || 0) + 1;
    }
  });

  const errorRankingList = Object.values(topicErrorsMap)
    .map((item) => {
      // Find most common reason
      let mostCommonReason = "Não especificado";
      let maxCount = 0;
      Object.entries(item.reasons).forEach(([reason, count]) => {
        if (count > maxCount) {
          maxCount = count;
          mostCommonReason = reason;
        }
      });

      // Map common reasons to actionable tactical advice
      let improvementAdvice = "Retornar ao material teórico e revisar os tópicos pendentes.";
      if (mostCommonReason.includes("Atenção") || mostCommonReason.includes("Distração")) {
        improvementAdvice = "Sublinhar verbos de comando ('EXCETO', 'INCORRETO') e ler o enunciado duas vezes.";
      } else if (mostCommonReason.includes("teoria") || mostCommonReason.includes("estudado")) {
        improvementAdvice = "Interromper as questões e ler a doutrina básica e resumos teóricos deste assunto.";
      } else if (mostCommonReason.includes("Pegadinha") || mostCommonReason.includes("Casca")) {
        improvementAdvice = "Mapear as sutilezas da banca e destacar pegadinhas em um Caderno de Erros dedicado.";
      } else if (mostCommonReason.includes("Esquecimento") || mostCommonReason.includes("revisão")) {
        improvementAdvice = "Ativar imediatamente a revisão espaçada (24h/7d/15d) deste assunto no Edital Verticalizado.";
      } else if (mostCommonReason.includes("Interpretação")) {
        improvementAdvice = "Ler questões resolvidas comentadas detalhadamente e focar na jurisprudência clássica.";
      } else if (mostCommonReason.includes("cálculo") || mostCommonReason.includes("matemática")) {
        improvementAdvice = "Praticar exaustivamente as fórmulas básicas e realizar exercícios de fixação passo-a-passo.";
      }

      const accRate = item.attempted > 0 ? Math.round((item.correct / item.attempted) * 100) : 0;

      return {
        ...item,
        correctRate: accRate,
        mostCommonReason,
        improvementAdvice
      };
    })
    .sort((a, b) => b.mistakesCount - a.mistakesCount)
    .slice(0, 5); // top 5 ranked errors

  // Group logs by subject + topic for high precision feedback
  const subjectTopicStatsMap: Record<string, { attempted: number; correct: number; subject: string; topic: string }> = {};
  logs.forEach((log) => {
    const key = `${log.subject} - ${log.topic}`;
    if (!subjectTopicStatsMap[key]) {
      subjectTopicStatsMap[key] = { attempted: 0, correct: 0, subject: log.subject, topic: log.topic };
    }
    subjectTopicStatsMap[key].attempted += log.questionsAttempted;
    subjectTopicStatsMap[key].correct += log.questionsCorrect;
  });

  const subjectTopicTacticalFeedback = Object.entries(subjectTopicStatsMap).map(([key, data]) => {
    const pct = data.attempted > 0 ? Math.round((data.correct / data.attempted) * 100) : 0;
    let badgeClass = "";
    let textClass = "";
    let borderClass = "";
    let titleFeedback = "";
    let descriptionFeedback = "";

    if (pct < 50) {
      badgeClass = "bg-rose-500 text-white";
      textClass = "text-rose-400";
      borderClass = "border-rose-500/30 bg-rose-950/20";
      titleFeedback = "🔴 RETORNO AO ALUNO (NÍVEL DE REVISÃO FORTE)";
      descriptionFeedback = "Seu aproveitamento neste assunto está em " + pct + "% (Crítico). AÇÃO RECOMENDADA: Pare imediatamente de responder questões sobre este assunto por hoje. Volte para as videoaulas ou material em PDF teórico básico, refaça ou revise seu resumo focado, marque as palavras-chave na lei seca e só volte a treinar após 24 horas.";
    } else if (pct < 70) {
      badgeClass = "bg-amber-400 text-slate-950";
      textClass = "text-amber-400";
      borderClass = "border-amber-500/30 bg-amber-950/20";
      titleFeedback = "🟡 RETORNO AO ALUNO (NÍVEL DE FIXAÇÃO INTERMEDIÁRIA)";
      descriptionFeedback = "Seu aproveitamento neste assunto está em " + pct + "% (Regular/Atenção). AÇÃO RECOMENDADA: Abra o seu Caderno de Erros logo abaixo para mapear quais tópicos ou detalhes estão falhando. Ative a revisão espaçada de 7 dias, estude seus apontamentos teóricos e faça mais 15 questões focadas.";
    } else {
      badgeClass = "bg-emerald-500 text-white";
      textClass = "text-emerald-400";
      borderClass = "border-emerald-500/30 bg-emerald-950/20";
      titleFeedback = "🟢 RETORNO AO ALUNO (NÍVEL DE MANUTENÇÃO PERIÓDICA)";
      descriptionFeedback = "Seu aproveitamento neste assunto está em " + pct + "% (Excelente/Nível de Aprovação!). AÇÃO RECOMENDADA: Nível fantástico de retenção! Mantenha a consistência. Avance imediatamente para novos assuntos do edital e agende revisões espaçadas de longo prazo (15 ou 30 dias) para manter o conteúdo ativo.";
    }

    return {
      key,
      subject: data.subject,
      topic: data.topic,
      attempted: data.attempted,
      correct: data.correct,
      pct,
      badgeClass,
      textClass,
      borderClass,
      titleFeedback,
      descriptionFeedback
    };
  });

  // Calculate daily study time in hours dynamically based on current cycle
  const dayNames = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const studyHoursData = Array.from({ length: 7 }, (_, index) => {
    const dayNum = index + 1;
    const cycleDay = cycle?.days?.find((d: any) => d.dayNumber === dayNum);
    
    let hours = 0;
    if (cycleDay) {
      const completedSubsCount = cycleDay.subjects?.filter((s: any) => s.completed).length || 0;
      const questionsSecs = (cycleDay.questionSolved || 0) * 3; // 3 mins per question solved
      hours = (completedSubsCount * 1.5) + (questionsSecs / 60);
    }
    
    // Seed beautiful visual hours for pre-seeded users
    if (hours === 0) {
      if (targetStudentId === "aluno_soldado_std") {
        hours = [3.5, 4.2, 3.8, 4.5, 4.0, 5.0, 2.0][index];
      } else if (targetStudentId === "aluno_cfo_std") {
        hours = [4.5, 5.0, 4.8, 5.5, 5.2, 6.0, 3.0][index];
      }
    }
    
    hours = Math.round(hours * 10) / 10;
    return {
      name: dayNames[index],
      hours: hours,
    };
  });

  const totalWeeklyStudyHours = studyHoursData.reduce((sum, d) => sum + d.hours, 0);

  return (
    <div id="performance-stats-component" className="space-y-6">
      
      {/* Controle de Constância / Estudo Semanal */}
      {!isViewingAsAdmin && <ConsistencyWidget currentUser={currentUser} />}

      {/* Diagnóstico Inteligente */}
      <SmartDiagnostic 
        studentId={targetStudentId} 
        studentName={isViewingAsAdmin ? "do Aluno" : currentUser.name} 
      />
      
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-amber-400">
              <TrendingUp className="w-6 h-6 text-amber-500" />
              Estatísticas de Desempenho
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              {isViewingAsAdmin 
                ? `Análise individual das métricas e caderno de erros do aluno.` 
                : "Acompanhe sua evolução em tempo real e identifique os principais motivos de erro."}
            </p>
          </div>
          {isViewingAsAdmin && (
            <div className="bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-red-400 text-xs font-semibold">
              <ShieldAlert className="w-4 h-4" />
              <span>Visão Administrador</span>
            </div>
          )}
        </div>

        {/* Global Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Questões Feitas</span>
            <span className="text-2xl font-bold font-mono block mt-1 text-slate-100">{totalAttempted}</span>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
            <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider block">Total Acertos</span>
            <span className="text-2xl font-bold font-mono block mt-1 text-emerald-400">{totalCorrect}</span>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
            <span className="text-[10px] text-rose-400 font-semibold uppercase tracking-wider block">Total Erros</span>
            <span className="text-2xl font-bold font-mono block mt-1 text-rose-400">{totalIncorrect}</span>
          </div>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850">
            <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">Aproveitamento</span>
            <span className="text-2xl font-bold font-mono block mt-1 text-amber-400">{overallRate}%</span>
          </div>
        </div>

        {/* Time Filters and Clear Data Control Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/80 pt-4 mt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mr-2">Filtro Temporal:</span>
            {[
              { id: "all", label: "Histórico Geral" },
              { id: "1", label: "Últimas 24h" },
              { id: "7", label: "Últimos 7 dias" },
              { id: "30", label: "Últimos 30 dias" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTimeFilter(f.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                  timeFilter === f.id
                    ? "bg-amber-400 text-slate-950 font-black"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-850"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleClearAllData}
            className="flex items-center gap-1 px-3 py-1 bg-rose-950/40 border border-rose-900/50 text-rose-400 hover:bg-rose-900/20 rounded-lg text-[10px] font-bold transition cursor-pointer uppercase tracking-wider"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Apagar Histórico
          </button>
        </div>
      </div>

      {/* Charts Row: Study Hours and Edital Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Weekly Study Hours Bar Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Tempo de Estudo Semanal</h3>
                <p className="text-[10px] text-slate-400">Tempo de estudo diário acumulado ao longo da semana baseado nas metas e questões concluídas.</p>
              </div>
            </div>
            <div className="bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-amber-400 text-xs font-semibold self-start sm:self-auto">
              <span>Carga Semanal Acumulada:</span>
              <span className="font-mono text-white font-bold">{totalWeeklyStudyHours.toFixed(1)}h</span>
            </div>
          </div>

          <div className="h-[260px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyHoursData} margin={{ top: 10, right: 10, left: -25, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="#64748b" 
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  unit="h"
                />
                <Tooltip
                  cursor={{ fill: '#1e293b', opacity: 0.15 }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-950 border border-slate-800 px-3 py-2 rounded-xl shadow-xl text-xs space-y-1">
                          <p className="font-bold text-slate-200">{payload[0].payload.name}</p>
                          <p className="font-semibold text-amber-400">
                            Estudado: <span className="font-mono text-white font-bold">{payload[0].value}</span> horas
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="hours" 
                  fill="#f59e0b" 
                  radius={[6, 6, 0, 0]}
                  maxBarSize={45}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Edital Verticalizado Donut Chart */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <div>
                <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Edital Verticalizado</h3>
                <p className="text-[10px] text-slate-400">Progresso total de conclusão</p>
              </div>
            </div>
            
            {/* Course Selector Toggle / Badge */}
            {currentUser.accessCFO && currentUser.accessSoldado ? (
              <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850 shrink-0">
                <button
                  type="button"
                  onClick={() => setSyllabusTab("soldado")}
                  className={`px-2 py-1 rounded text-[9px] font-black uppercase transition cursor-pointer ${
                    syllabusTab === "soldado" ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  Soldado
                </button>
                <button
                  type="button"
                  onClick={() => setSyllabusTab("cfo")}
                  className={`px-2 py-1 rounded text-[9px] font-black uppercase transition cursor-pointer ${
                    syllabusTab === "cfo" ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"
                  }`}
                >
                  CFO
                </button>
              </div>
            ) : (
              <span className="bg-slate-950 text-amber-400 border border-amber-400/20 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0">
                {syllabusTab === "soldado" ? "Soldado" : "CFO"}
              </span>
            )}
          </div>

          <div className="relative w-full h-[150px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={68}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-2xl font-black font-mono text-amber-400">{aggregateSyllabusCompletionPct}%</span>
              <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold text-center">Progresso<br/>Agregado</span>
            </div>
          </div>

          <div className="bg-slate-950/50 p-3 rounded-xl border border-slate-850 text-center space-y-1">
            <div className="flex justify-between text-[11px] font-medium text-slate-300">
              <span>Metas Concluídas:</span>
              <span className="font-mono font-bold text-amber-400">
                {completedCheckpoints} de {totalCheckpoints}
              </span>
            </div>
            <p className="text-[9px] text-slate-400 text-left leading-normal pt-1 border-t border-slate-900/50">
              * O progresso agregado pondera leitura de teoria, resumos elaborados e sessões de exercícios praticadas em todos os assuntos.
            </p>
          </div>

          {/* Subjects Progress List */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Cobertura por Disciplina (Teoria)
            </h4>
            <div className="space-y-2 max-h-[105px] overflow-y-auto pr-1">
              {subjectProgressList.map((item) => (
                <div key={item.subject} className="space-y-0.5">
                  <div className="flex justify-between text-[10px] text-slate-300">
                    <span className="truncate max-w-[140px] font-medium">{item.subject}</span>
                    <span className="font-mono text-slate-400 font-bold">{item.completed}/{item.total} ({item.pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-850">
                    <div 
                      className="bg-amber-400 h-full rounded-full transition-all duration-500" 
                      style={{ width: `${item.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* --- RANKING OF ERRORS & RECOMMENDATIONS (Ranking de Erros e Melhorias por Assunto) --- */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-500" />
            <div>
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Ranking dos Erros por Assunto</h3>
              <p className="text-[10px] text-slate-400">Identifique os assuntos mais críticos do seu edital e saiba exatamente o que você deve melhorar em cada um.</p>
            </div>
          </div>
          <span className="bg-rose-950/50 border border-rose-900/50 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider text-rose-400">
            Foco Máximo de Revisão
          </span>
        </div>

        {errorRankingList.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-medium">
            Nenhum erro registrado no período selecionado. Excelente trabalho de fixação teórica!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800/80 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-2.5">Assunto / Tópico</th>
                  <th className="py-2.5 text-center">Quantidade de Erros</th>
                  <th className="py-2.5 text-center">Aproveitamento Global</th>
                  <th className="py-2.5">Principal Causa</th>
                  <th className="py-2.5">O que Deve Melhorar (Diretriz de Correção)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {errorRankingList.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-950/25 transition">
                    <td className="py-3">
                      <span className="block font-extrabold text-slate-200">{item.topic}</span>
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{item.subject}</span>
                    </td>
                    <td className="py-3 text-center font-mono font-bold text-rose-400">
                      {item.mistakesCount} erros
                    </td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        item.correctRate < 50 
                          ? "bg-rose-950/40 text-rose-400 border border-rose-900/30" 
                          : "bg-amber-950/40 text-amber-400 border border-amber-900/30"
                      }`}>
                        {item.correctRate}%
                      </span>
                    </td>
                    <td className="py-3 font-semibold text-slate-300">
                      {item.mostCommonReason}
                    </td>
                    <td className="py-3 text-amber-300 text-[11px] leading-normal font-medium max-w-[280px]">
                      {item.improvementAdvice}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dynamic Tactical Advisor Panel (Orientador Tático de Ações) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Award className="w-5 h-5 text-amber-400" />
          <div>
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Diretrizes Táticas de Estudos (Por Assunto)</h3>
            <p className="text-[10px] text-slate-400">Plano de ação e diretrizes sugeridas automaticamente com base no seu aproveitamento para os assuntos adicionados.</p>
          </div>
        </div>

        {subjectTopicTacticalFeedback.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs font-medium">
            Nenhum assunto lançado no histórico de desempenho para fornecer feedback. Adicione seus logs de questões abaixo para ver as recomendações táticas.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[350px] overflow-y-auto pr-1">
            {subjectTopicTacticalFeedback.map((item) => (
              <div key={item.key} className={`border p-4 rounded-xl space-y-3 transition hover:border-slate-700 ${item.borderClass}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono font-bold block truncate">{item.subject}</span>
                    <span className="text-xs font-extrabold text-slate-100 block mt-0.5 truncate">{item.topic}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${item.badgeClass}`}>
                    {item.pct}% de Acertos ({item.correct}/{item.attempted})
                  </span>
                </div>
                
                <div className="border-t border-slate-800/40 pt-2.5 space-y-1">
                  <span className={`text-[10px] font-black uppercase tracking-wider block ${item.textClass}`}>
                    {item.titleFeedback}
                  </span>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                    {item.descriptionFeedback}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Log Input Form (Only for Student) */}
        {!isViewingAsAdmin && (
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl self-start">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 mb-4 uppercase tracking-wider">
              <Plus className="w-5 h-5 text-amber-400" />
              Lançar Questões
            </h3>
            <form onSubmit={handleAddLog} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Matéria</label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                  required
                >
                  <option value="">Selecione a matéria...</option>
                  {PRE_SEEDED_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Assunto / Tópico</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex: Teoria do Crime, Regência..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  required
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Motivo Principal do Erro</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                  required
                >
                  <option value="">Por que errou as questões?</option>
                  {ERROR_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>

                <div className="mt-2 p-3 rounded-xl bg-amber-400/10 border border-amber-400/20 text-slate-200 text-xs leading-relaxed space-y-1">
                  <span className="font-extrabold text-amber-400 block uppercase tracking-wider text-[10px] flex items-center gap-1">
                    ⚠️ Instrução de Estudo para Erros:
                  </span>
                  <p>Atenção Recruta! Ao identificar o motivo do erro, você deve obrigatoriamente <strong>anotar este erro em seu Caderno de Erros</strong> e <strong>resolver novas questões de fixação</strong> para dominar o assunto!</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Tentativas</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={attempted}
                    onChange={(e) => setAttempted(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-slate-200 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Acertos</label>
                  <input
                    type="number"
                    min="0"
                    max="500"
                    value={correct}
                    onChange={(e) => setCorrect(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition uppercase tracking-wider cursor-pointer shadow-md mt-2"
              >
                Salvar Desempenho
              </button>
            </form>
          </div>
        )}

        {/* Charts and Data (Fills remaining space) */}
        <div className={`${isViewingAsAdmin ? "lg:col-span-3" : "lg:col-span-2"} space-y-6`}>
          
          {/* Analysis Charts Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl">
            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2 mb-4 uppercase tracking-wider">
              <BarChart2 className="w-5 h-5 text-amber-400" />
              Anotar Erros & Resolver Questões
            </h3>

            {logs.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-xs">
                Insira registros de desempenho para ver o gráfico de erros.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Subject Error Bar Chart */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                    Erros por Matéria (Qtd)
                  </h4>
                  <div className="space-y-3">
                    {sortedSubjectMistakes.slice(0, 5).map((item) => {
                      const pct = Math.round((item.count / maxSubjectMistakes) * 100);
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span className="truncate max-w-[180px] font-medium">{item.name}</span>
                            <span className="font-mono text-rose-400 font-bold">{item.count} erros</span>
                          </div>
                          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                            <div 
                              className="bg-rose-500 h-full rounded-full transition-all duration-700" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reason Error Bar Chart */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
                    Diagnóstico dos Erros (Qtd)
                  </h4>
                  <div className="space-y-3">
                    {sortedReasonMistakes.slice(0, 5).map((item) => {
                      const pct = Math.round((item.count / maxReasonMistakes) * 100);
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-300">
                            <span className="truncate max-w-[180px] font-medium">{item.name}</span>
                            <span className="font-mono text-amber-400 font-bold">{item.count} erros</span>
                          </div>
                          <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                            <div 
                              className="bg-amber-400 h-full rounded-full transition-all duration-700" 
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* History table and Filters */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-slate-800 pb-4">
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">
                Caderno de Erros / Histórico
              </h3>
              
              {/* Dynamic Filters */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="Todos">Todas Matérias</option>
                  {PRE_SEEDED_SUBJECTS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Nenhum log correspondente aos filtros.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 font-semibold">Data</th>
                      <th className="py-2.5 font-semibold">Matéria / Assunto</th>
                      <th className="py-2.5 font-semibold">Motivo do Erro</th>
                      <th className="py-2.5 font-semibold text-center">Acertos</th>
                      <th className="py-2.5 font-semibold text-center">Desempenho</th>
                      <th className="py-2.5 font-semibold text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {filteredLogs.map((log) => {
                      const missed = log.questionsAttempted - log.questionsCorrect;
                      const pct = Math.round((log.questionsCorrect / log.questionsAttempted) * 100);
                      
                      return (
                        <tr key={log.id} className="hover:bg-slate-950/25 transition">
                          <td className="py-3 text-slate-400 font-mono">{log.date}</td>
                          <td className="py-3 pr-2">
                            <span className="font-bold text-slate-200 block">{log.subject}</span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{log.topic}</span>
                          </td>
                          <td className="py-3 text-slate-300">
                            <div className="flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                              <span className="truncate max-w-[150px] sm:max-w-xs">{log.reasonForError}</span>
                            </div>
                          </td>
                          <td className="py-3 text-center font-mono text-slate-300 font-medium">
                            {log.questionsCorrect}/{log.questionsAttempted}
                          </td>
                          <td className="py-3 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                              pct >= 70 
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                : pct >= 50 
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" 
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            }`}>
                              {pct}%
                            </span>
                          </td>
                          <td className="py-3 text-center">
                            <button
                              onClick={() => handleDeleteLog(log.id)}
                              className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Custom Confirm Modal */}
      {customConfirm?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden text-white shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-slate-800 bg-slate-950/30">
              <h3 className="text-base font-black text-amber-400 uppercase tracking-wider">
                {customConfirm.title}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {customConfirm.message}
              </p>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setCustomConfirm(null)}
                className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={customConfirm.onConfirm}
                className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-black rounded-xl transition cursor-pointer shadow"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Alert Modal */}
      {customAlert?.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full overflow-hidden text-white shadow-2xl animate-fade-in">
            <div className="p-6 border-b border-slate-800 bg-slate-950/30 flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${
                customAlert.type === "success" ? "bg-emerald-500" : customAlert.type === "error" ? "bg-rose-500" : "bg-amber-500"
              }`} />
              <h3 className="text-base font-black text-white uppercase tracking-wider">
                {customAlert.title}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-xs text-slate-300 leading-relaxed font-medium">
                {customAlert.message}
              </p>
            </div>
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setCustomAlert(null)}
                className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer shadow"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
