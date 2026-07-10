import React, { useState, useEffect } from "react";
import { PerformanceLog, User } from "../types";
import { AlertCircle, Plus, Filter, Trash2, TrendingUp, BarChart2, ShieldAlert, Award } from "lucide-react";
import { 
  fetchPerformanceLogsFromFirestore, 
  savePerformanceLogToFirestore, 
  deletePerformanceLogFromFirestore 
} from "../lib/firebase";

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
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    if (correct > attempted) {
      alert("O número de acertos não pode ser maior que o número de questões respondidas.");
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
    if (confirm("Deseja realmente excluir este registro de desempenho?")) {
      const updated = logs.filter((log) => log.id !== id);
      setLogs(updated);
      localStorage.setItem(`performance_logs_${targetStudentId}`, JSON.stringify(updated));
      try {
        await deletePerformanceLogFromFirestore(targetStudentId, id);
      } catch (e) {
        console.error("Error deleting log from Firestore:", e);
      }
    }
  };

  // Metrics calculators
  const filteredLogs = logs.filter((log) => {
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
  logs.forEach((log) => {
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
  logs.forEach((log) => {
    const missed = log.questionsAttempted - log.questionsCorrect;
    if (missed > 0) {
      reasonMistakesMap[log.reasonForError] = (reasonMistakesMap[log.reasonForError] || 0) + missed;
    }
  });

  const sortedReasonMistakes = Object.entries(reasonMistakesMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const maxReasonMistakes = sortedReasonMistakes.length > 0 ? Math.max(...sortedReasonMistakes.map((r) => r.count)) : 1;

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

  return (
    <div id="performance-stats-component" className="space-y-6">
      
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
              Mapeamento de Erros
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
                      {!isViewingAsAdmin && <th className="py-2.5 font-semibold text-center">Ações</th>}
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
                          {!isViewingAsAdmin && (
                            <td className="py-3 text-center">
                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                className="p-1 rounded hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          )}
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

    </div>
  );
}
