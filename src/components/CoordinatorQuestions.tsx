import React, { useState, useEffect } from "react";
import { User, CoordQuestion, PerformanceLog } from "../types";
import { 
  fetchCoordQuestionsFromFirestore, 
  saveCoordQuestionToFirestore, 
  deleteCoordQuestionFromFirestore,
  savePerformanceLogToFirestore
} from "../lib/firebase";
import { 
  HelpCircle, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Clock, 
  BookOpen, 
  ShieldAlert, 
  FileText, 
  Award, 
  ChevronRight, 
  ChevronLeft, 
  RefreshCw, 
  Lock,
  ArrowRight,
  Filter,
  Trash
} from "lucide-react";
import { stripMarkdownAsterisks } from "../lib/textCleanup";

interface CoordinatorQuestionsProps {
  currentUser: User;
}

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

export default function CoordinatorQuestions({ currentUser }: CoordinatorQuestionsProps) {
  const [questions, setQuestions] = useState<CoordQuestion[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State (Admin)
  const [showAddForm, setShowAddForm] = useState(false);
  const [statement, setStatement] = useState("");
  const [subject, setSubject] = useState(PRE_SEEDED_SUBJECTS[0]);
  const [options, setOptions] = useState<string[]>(["", "", "", "", ""]);
  const [correctOption, setCorrectOption] = useState<number>(0);
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);

  // Expanded fields for QConcursos model
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<"Fácil" | "Média" | "Difícil">("Média");
  const [year, setYear] = useState("2026");
  const [banca, setBanca] = useState("IBFC");

  // QConcursos Filters state
  const [filterSubject, setFilterSubject] = useState("todos");
  const [filterTopic, setFilterTopic] = useState("todos");
  const [filterDifficulty, setFilterDifficulty] = useState("todos");
  const [filterYear, setFilterYear] = useState("todos");
  const [filterBanca, setFilterBanca] = useState("todos");
  const [filterStatus, setFilterStatus] = useState("todos");

  // Interactive Quiz State (Student)
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasChecked, setHasChecked] = useState(false);
  const [solvedStats, setSolvedStats] = useState<{ [key: string]: { correct: boolean, selectedIndex: number } }>({});
  const [solvedInCurrentSession, setSolvedInCurrentSession] = useState<Set<string>>(new Set());
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const triggerStatus = (msg: string) => {
    setActionStatus(msg);
    setTimeout(() => {
      setActionStatus(null);
    }, 4000);
  };

  // Safe color/formatting renderer for explanation
  const renderFormattedExplanation = (text: string) => {
    if (!text) return "";
    
    // Sanitize basic tags and escape
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Convert bold blocks **bold**
    html = html.replace(/\*\*([\s\S]*?)\*\*/g, '<strong class="font-extrabold text-white">$1</strong>');
    
    // Convert single asterisk italic *italic*
    html = html.replace(/\*([\s\S]*?)\*/g, '<em class="text-slate-300 italic">$1</em>');

    // Convert custom highlight tags:
    // [VERDE: text]
    html = html.replace(/\[VERDE:\s*([\s\S]*?)\]/gi, '<span class="text-emerald-400 font-extrabold bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/15">$1</span>');
    
    // [VERMELHO: text]
    html = html.replace(/\[VERMELHO:\s*([\s\S]*?)\]/gi, '<span class="text-rose-400 font-extrabold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/15">$1</span>');
    
    // [AMARELO: text]
    html = html.replace(/\[AMARELO:\s*([\s\S]*?)\]/gi, '<span class="text-amber-400 font-extrabold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/15">$1</span>');
    
    // [AZUL: text]
    html = html.replace(/\[AZUL:\s*([\s\S]*?)\]/gi, '<span class="text-cyan-400 font-extrabold bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/15">$1</span>');

    return <div dangerouslySetInnerHTML={{ __html: html }} className="whitespace-pre-wrap leading-relaxed select-text" />;
  };

  const loadQuestions = async () => {
    setLoading(true);
    // Load from local storage for instant render
    const saved = localStorage.getItem("coordination_questions");
    if (saved) {
      try {
        setQuestions(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }

    try {
      const fsQuestions = await fetchCoordQuestionsFromFirestore();
      setQuestions(fsQuestions);
      localStorage.setItem("coordination_questions", JSON.stringify(fsQuestions));
    } catch (err) {
      console.error("Error loading coordination questions:", err);
    } finally {
      setLoading(false);
    }
  };

  // Load user progress
  useEffect(() => {
    const savedStats = localStorage.getItem(`solved_stats_${currentUser.id}`);
    if (savedStats) {
      try {
        setSolvedStats(JSON.parse(savedStats));
      } catch (e) {
        // ignore
      }
    }
    loadQuestions();
  }, [currentUser.id]);

  // Sync state when index or filteredQuestions changes
  useEffect(() => {
    const questionId = filteredQuestions[currentQuestionIdx]?.id;
    if (questionId && solvedStats[questionId]) {
      setSelectedOption(solvedStats[questionId].selectedIndex);
      setHasChecked(true);
    } else {
      setSelectedOption(null);
      setHasChecked(false);
    }
  }, [currentQuestionIdx, filterSubject, filterTopic, filterDifficulty, filterYear, filterBanca, filterStatus, questions]);

  // Save progress locally when solvedStats updates
  const saveSolvedProgress = (newStats: { [key: string]: { correct: boolean, selectedIndex: number } }) => {
    setSolvedStats(newStats);
    localStorage.setItem(`solved_stats_${currentUser.id}`, JSON.stringify(newStats));
  };

  // AI Question Generator Helper
  const [aiGenerating, setAiGenerating] = useState<boolean>(false);

  const handleAiGenerateQuestion = async () => {
    if (!topic.trim()) {
      alert("Por favor, preencha o campo 'Assunto Específico' (Ex: Artigo 5º da CF, Crase, Crises na Primeira República) para orientar a geração da IA.");
      return;
    }

    setAiGenerating(true);
    try {
      const response = await fetch("/api/ai/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_question",
          subject: subject,
          topic: topic,
          difficulty: difficulty,
          year: year,
          banca: banca
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro de rede.");
      }

      const data = await response.json();
      if (!data.text) {
        throw new Error("A IA não retornou conteúdo.");
      }

      const parsed = JSON.parse(data.text);
      if (parsed.statement && Array.isArray(parsed.options) && parsed.options.length >= 5) {
        setStatement(stripMarkdownAsterisks(parsed.statement));
        setOptions(parsed.options.slice(0, 5).map((opt: string) => stripMarkdownAsterisks(opt)));
        setCorrectOption(parsed.correctOptionIndex ?? 0);
        setExplanation(parsed.explanation ?? "");
        triggerStatus("Questão tática gerada com sucesso pela I.A. do Tenente! Revise os campos e clique em 'Publicar Questão Tática' para salvar.");
      } else {
        throw new Error("O formato do JSON retornado pela IA é inválido.");
      }
    } catch (e: any) {
      console.error("Erro ao gerar questão com IA:", e);
      alert("Falha ao gerar questão com IA: " + (e.message || e));
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!statement.trim() || !explanation.trim()) {
      alert("Por favor, preencha o enunciado e a explicação tática.");
      return;
    }

    // Verify all 5 options are filled
    if (options.some(opt => !opt.trim())) {
      alert("Por favor, preencha todas as 5 alternativas.");
      return;
    }

    setSaving(true);
    const newQuestion: CoordQuestion = {
      id: "q_" + Date.now(),
      statement: statement.trim(),
      options: options.map(o => o.trim()),
      correctOptionIndex: correctOption,
      explanation: explanation.trim(),
      subject: subject,
      createdAt: new Date().toISOString(),
      topic: topic.trim() || "Geral",
      difficulty: difficulty,
      year: year.trim() || "2026",
      banca: banca.trim() || "IBFC"
    };

    try {
      await saveCoordQuestionToFirestore(newQuestion);
      const updated = [...questions, newQuestion];
      setQuestions(updated);
      localStorage.setItem("coordination_questions", JSON.stringify(updated));

      // Reset form
      setStatement("");
      setOptions(["", "", "", "", ""]);
      setCorrectOption(0);
      setExplanation("");
      setTopic("");
      setDifficulty("Média");
      setYear("2026");
      setBanca("IBFC");
      setShowAddForm(false);
      alert("Questão tática inserida com sucesso no banco de dados e enviada aos alunos!");
    } catch (e) {
      console.error("Error adding question:", e);
      alert("Erro ao salvar questão no banco de dados.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    try {
      await deleteCoordQuestionFromFirestore(id);
      const updated = questions.filter(q => q.id !== id);
      setQuestions(updated);
      localStorage.setItem("coordination_questions", JSON.stringify(updated));
      
      if (currentQuestionIdx >= updated.length && updated.length > 0) {
        setCurrentQuestionIdx(updated.length - 1);
      }
      triggerStatus("Questão tática removida com sucesso!");
    } catch (e) {
      console.error("Error deleting question:", e);
      triggerStatus("Erro ao excluir questão do banco.");
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    const updated = [...options];
    updated[idx] = val;
    setOptions(updated);
  };

  const handleVerifyAnswer = async () => {
    if (selectedOption === null) {
      alert("Selecione uma alternativa antes de responder!");
      return;
    }

    const safeIdx = (currentQuestionIdx >= 0 && currentQuestionIdx < filteredQuestions.length) 
      ? currentQuestionIdx 
      : (filteredQuestions.length > 0 ? filteredQuestions.length - 1 : 0);

    const currentQ = filteredQuestions[safeIdx];
    if (!currentQ) return;

    const isCorrect = selectedOption === currentQ.correctOptionIndex;

    const updatedStats = {
      ...solvedStats,
      [currentQ.id]: {
        correct: isCorrect,
        selectedIndex: selectedOption
      }
    };

    saveSolvedProgress(updatedStats);
    setSolvedInCurrentSession(prev => {
      const next = new Set(prev);
      next.add(currentQ.id);
      return next;
    });
    setHasChecked(true);

    // Save as a PerformanceLog so it shows up in the "desempenho" tab
    try {
      const performanceLogId = "log_coord_" + currentQ.id + "_" + Date.now();
      const newPerformanceLog: PerformanceLog = {
        id: performanceLogId,
        studentId: currentUser.id,
        date: new Date().toISOString().split("T")[0],
        subject: currentQ.subject || "Geral",
        topic: currentQ.topic || "Questão da Coordenação",
        reasonForError: isCorrect ? "Nenhum (Acertou!)" : "Atenção / Interpretação",
        questionsAttempted: 1,
        questionsCorrect: isCorrect ? 1 : 0
      };

      const savedLogsKey = `performance_logs_${currentUser.id}`;
      const saved = localStorage.getItem(savedLogsKey);
      let existingLogs: PerformanceLog[] = [];
      if (saved) {
        try {
          existingLogs = JSON.parse(saved);
        } catch (e) {
          existingLogs = [];
        }
      }
      existingLogs = [newPerformanceLog, ...existingLogs];
      localStorage.setItem(savedLogsKey, JSON.stringify(existingLogs));

      // Sync with Firestore
      await savePerformanceLogToFirestore(currentUser.id, newPerformanceLog);
    } catch (e) {
      console.error("Error logging performance for coordinator question:", e);
    }
  };

  const handleClearFilters = () => {
    setFilterSubject("todos");
    setFilterTopic("todos");
    setFilterDifficulty("todos");
    setFilterYear("todos");
    setFilterBanca("todos");
    setFilterStatus("todos");
    setCurrentQuestionIdx(0);
  };

  // Compile Dynamic Filter Option Lists from database questions
  const uniqueTopics = Array.from(new Set(questions.map(q => q.topic || "Geral"))).sort();
  const uniqueYears = Array.from(new Set(questions.map(q => q.year || "2026"))).sort();
  const uniqueBancas = Array.from(new Set(questions.map(q => q.banca || "IBFC"))).sort();

  // FILTER LOGIC
  const filteredQuestions = questions.filter((q) => {
    if (filterSubject !== "todos" && q.subject !== filterSubject) return false;
    
    const qTopic = q.topic || "Geral";
    if (filterTopic !== "todos" && qTopic !== filterTopic) return false;

    const qDiff = q.difficulty || "Média";
    if (filterDifficulty !== "todos" && qDiff !== filterDifficulty) return false;

    const qYear = q.year || "2026";
    if (filterYear !== "todos" && qYear !== filterYear) return false;

    const qBanca = q.banca || "IBFC";
    if (filterBanca !== "todos" && qBanca.toLowerCase() !== filterBanca.toLowerCase()) return false;

    const stat = solvedStats[q.id];
    if (filterStatus === "resolvidas" && !stat) return false;
    if (filterStatus === "nao_resolvidas" && stat) return false;
    if (filterStatus === "corretas" && (!stat || !stat.correct)) return false;
    if (filterStatus === "erradas" && (!stat || stat.correct)) return false;

    return true;
  });

  const safeIdx = (currentQuestionIdx >= 0 && currentQuestionIdx < filteredQuestions.length) 
    ? currentQuestionIdx 
    : (filteredQuestions.length > 0 ? filteredQuestions.length - 1 : 0);

  const currentQuestion = filteredQuestions[safeIdx] || null;

  // Ensure index is within boundaries of filtered questions
  useEffect(() => {
    if (currentQuestionIdx >= filteredQuestions.length && filteredQuestions.length > 0) {
      setCurrentQuestionIdx(filteredQuestions.length - 1);
    }
  }, [filteredQuestions.length]);

  const totalCorrectCount = Object.values(solvedStats).filter(s => (s as any).correct).length;
  const totalAttemptedCount = Object.keys(solvedStats).length;

  return (
    <div id="coordinator-questions-component" className="space-y-6 relative">
      
      {/* Floating notifications for iframe/sandbox compatibility */}
      {actionStatus && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950/95 border border-amber-400/40 text-amber-300 font-black text-xs px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5 animate-bounce backdrop-blur-md">
          <Award className="w-4 h-4 text-amber-400" />
          <span>{actionStatus}</span>
        </div>
      )}
      
      {/* Overview Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2 text-amber-400">
              <HelpCircle className="w-6 h-6 text-amber-500" />
              Banco de Questões Táticas
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              Filtre e resolva cadernos de questões inéditas da coordenação e provas anteriores no estilo QConcursos.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadQuestions}
              disabled={loading}
              className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 rounded-xl text-slate-300 transition cursor-pointer"
              title="Sincronizar Banco"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            {currentUser.isAdmin && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 uppercase tracking-wider"
              >
                <Plus className="w-4 h-4" />
                {showAddForm ? "Fechar Painel" : "Nova Questão"}
              </button>
            )}
          </div>
        </div>

        {/* Small stats banner for students when questions are present */}
        {questions.length > 0 && (
          <div className="flex items-center justify-between flex-wrap gap-4 bg-slate-950/40 border border-slate-800/60 p-4 rounded-2xl mt-5">
            <div className="flex items-center gap-4 text-xs">
              <Award className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-slate-400">Seu Histórico Geral de Resolução:</span>
                <span className="text-white font-mono font-bold ml-1">
                  {totalCorrectCount} acertos de {totalAttemptedCount} respondidas ({questions.length} totais cadastradas)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* QCONCURSOS FILTER PANEL */}
      {questions.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-4 h-4" />
              Painel de Filtros Inteligentes (Estilo QConcursos)
            </span>
            <button
              onClick={handleClearFilters}
              className="text-[10px] text-amber-500 hover:text-amber-400 font-extrabold flex items-center gap-1 uppercase tracking-wide cursor-pointer"
            >
              <Trash className="w-3.5 h-3.5" />
              <span>Limpar Filtros</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* Subject Select */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Disciplina</label>
              <select
                value={filterSubject}
                onChange={(e) => { setFilterSubject(e.target.value); setCurrentQuestionIdx(0); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todas as Disciplinas</option>
                {PRE_SEEDED_SUBJECTS.map((sub, idx) => (
                  <option key={idx} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Topic Select */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Assunto Específico</label>
              <select
                value={filterTopic}
                onChange={(e) => { setFilterTopic(e.target.value); setCurrentQuestionIdx(0); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todos os Assuntos</option>
                {uniqueTopics.map((top, idx) => (
                  <option key={idx} value={top}>{top}</option>
                ))}
              </select>
            </div>

            {/* Difficulty Select */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dificuldade</label>
              <select
                value={filterDifficulty}
                onChange={(e) => { setFilterDifficulty(e.target.value); setCurrentQuestionIdx(0); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todas as Dificuldades</option>
                <option value="Fácil">Fácil</option>
                <option value="Média">Média</option>
                <option value="Difícil">Difícil</option>
              </select>
            </div>

            {/* Year Select */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ano</label>
              <select
                value={filterYear}
                onChange={(e) => { setFilterYear(e.target.value); setCurrentQuestionIdx(0); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todos os Anos</option>
                {uniqueYears.map((yr, idx) => (
                  <option key={idx} value={yr}>{yr}</option>
                ))}
              </select>
            </div>

            {/* Banca Select */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Banca</label>
              <select
                value={filterBanca}
                onChange={(e) => { setFilterBanca(e.target.value); setCurrentQuestionIdx(0); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todas as Bancas</option>
                {uniqueBancas.map((bn, idx) => (
                  <option key={idx} value={bn}>{bn}</option>
                ))}
              </select>
            </div>

            {/* Resolution Status Select */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Situação</label>
              <select
                value={filterStatus}
                onChange={(e) => { setFilterStatus(e.target.value); setCurrentQuestionIdx(0); }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
              >
                <option value="todos">Todas (Histórico)</option>
                <option value="nao_resolvidas">Não Resolvidas</option>
                <option value="resolvidas">Resolvidas (Qualquer)</option>
                <option value="corretas">Resolvidas Corretamente</option>
                <option value="erradas">Resolvidas com Erros</option>
              </select>
            </div>
          </div>

          <div className="pt-2 text-[11px] text-slate-400 font-mono text-right flex items-center justify-between">
            <span>Resultados Ativos: <strong className="text-amber-400">{filteredQuestions.length}</strong> de <strong className="text-slate-300">{questions.length}</strong> cadastradas</span>
            {filteredQuestions.length > 0 && (
              <span>Foco: <strong className="text-amber-400">Questão {currentQuestionIdx + 1}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* Admin Authoring Panel */}
      {currentUser.isAdmin && showAddForm && (
        <form onSubmit={handleAddQuestion} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-4 h-4" />
              Cadastrar Nova Questão Tática (Formato QConcursos)
            </h3>
            <span className="bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg text-amber-400 text-[10px] font-black uppercase font-mono">
              Coordenação PMBA
            </span>
          </div>

          {/* AI Generator Integration Panel */}
          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider font-mono flex items-center gap-1">
                <ShieldAlert className="w-3.5 h-3.5" /> Geração de Exercício por Inteligência Artificial
              </span>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                Preencha os campos <strong>Disciplina, Assunto Específico, Nível, Ano e Banca</strong> abaixo e clique no botão. A I.A. formulará uma questão inédita com alternativas e gabarito comentado!
              </p>
            </div>
            <button
              type="button"
              onClick={handleAiGenerateQuestion}
              disabled={aiGenerating}
              className="px-4 py-2 bg-slate-900 hover:bg-amber-400 border border-amber-450/40 hover:border-amber-400 text-amber-400 hover:text-slate-950 rounded-xl text-xs font-black transition uppercase tracking-wider shrink-0 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {aiGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Gerando Questão...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 text-amber-400" />
                  <span>Gerar com I.A. ⚡</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Subject Dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Disciplina</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {PRE_SEEDED_SUBJECTS.map((sub, i) => (
                  <option key={i} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            {/* Topic input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Assunto Específico</label>
              <input
                type="text"
                required
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex: Crase, Artigo 5º, Atos Administrativos"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Difficulty dropdown */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Nível de Dificuldade</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                <option value="Fácil">Fácil</option>
                <option value="Média">Média</option>
                <option value="Difícil">Difícil</option>
              </select>
            </div>

            {/* Year input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Ano de Aplicação</label>
              <input
                type="text"
                required
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="Ex: 2026, 2025"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Banca input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Banca Examinadora</label>
              <input
                type="text"
                required
                value={banca}
                onChange={(e) => setBanca(e.target.value)}
                placeholder="Ex: IBFC, FCC, CESPE"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Correct Option index */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Gabarito Correto</label>
              <select
                value={correctOption}
                onChange={(e) => setCorrectOption(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              >
                {["Alternativa A", "Alternativa B", "Alternativa C", "Alternativa D", "Alternativa E"].map((label, idx) => (
                  <option key={idx} value={idx}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Statement Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Enunciado da Questão</label>
            <textarea
              required
              rows={4}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="Digite o enunciado completo da questão militar (Ex: Conforme a Constituição do Estado da Bahia, o servidor público estadual...)"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400 placeholder:text-slate-600 font-mono"
            />
          </div>

          {/* 5 Options Inputs */}
          <div className="space-y-3 pt-2">
            <label className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">Alternativas de Resposta</label>
            {["A", "B", "C", "D", "E"].map((letter, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                  correctOption === idx 
                    ? "bg-amber-400 text-slate-950 font-black" 
                    : "bg-slate-950 border border-slate-850 text-slate-400"
                }`}>
                  {letter}
                </span>
                <input
                  type="text"
                  required
                  value={options[idx]}
                  onChange={(e) => handleOptionChange(idx, e.target.value)}
                  placeholder={`Digite o texto da alternativa ${letter}`}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-400 placeholder:text-slate-600"
                />
              </div>
            ))}
          </div>

          {/* Explanation Input */}
          <div className="space-y-1.5 pt-2">
            <label className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest block">Resolução / Explicação do Coordenador</label>
            <textarea
              required
              rows={3}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Forneça a fundamentação jurídica, artigo de lei, ou pegadinha contida na questão para guiar o aprendizado do aluno..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none focus:border-amber-400 placeholder:text-slate-600 font-medium"
            />
          </div>

          <div className="pt-3 flex gap-3">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer flex items-center justify-center gap-2 uppercase tracking-wider shadow"
            >
              {saving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Salvando Questão...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Cadastrar Questão</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Main Core Display */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-white shadow-xl flex flex-col items-center justify-center space-y-4">
          <RefreshCw className="w-10 h-10 text-amber-500 animate-spin" />
          <span className="text-slate-400 text-xs font-mono">Buscando banco tático de questões...</span>
        </div>
      ) : filteredQuestions.length === 0 ? (
        
        /* 🚨 EXTREMELY POLISHED UNDER CONSTRUCTION SHIELD FOR USERS WHEN QUESTIONS ARE EMPTY 🚨 */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-white shadow-xl relative overflow-hidden space-y-6 flex flex-col items-center max-w-4xl mx-auto">
          <div className="absolute inset-0 bg-[radial-gradient(#fbbf24_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.03]" />
          
          <div className="relative z-10 p-5 bg-gradient-to-b from-amber-400/10 to-amber-600/5 border border-amber-400/25 rounded-3xl text-amber-400 flex items-center justify-center shadow-lg">
            <Lock className="w-12 h-12 text-amber-500 animate-pulse" />
          </div>

          <div className="relative z-10 max-w-lg space-y-2">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block font-mono">
              Status • Sem Resultados
            </span>
            <h3 className="text-lg font-black text-white uppercase tracking-wider">
              Nenhuma Questão Encontrada
            </h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Não encontramos nenhuma questão correspondente aos filtros de assunto, ano, banca ou situação selecionados.
            </p>
          </div>

          <button
            onClick={handleClearFilters}
            className="relative z-10 px-5 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl transition cursor-pointer shadow-md"
          >
            Limpar Todos os Filtros
          </button>
        </div>

      ) : (
        /* Render Active Question Screen */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Main Question Display Box */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between space-y-6">
            
            {/* Header info */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 flex-wrap gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg text-amber-400 text-[10px] font-black uppercase font-mono tracking-wider">
                  QUESTÃO {safeIdx + 1} DE {filteredQuestions.length}
                </span>
                
                {/* Visual Badges style of QConcursos */}
                <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-bold font-mono uppercase">
                  <span className="bg-slate-950 text-amber-500 px-2 py-0.5 rounded border border-slate-850">
                    {currentQuestion.banca || "IBFC"}
                  </span>
                  <span className="bg-slate-950 text-amber-500 px-2 py-0.5 rounded border border-slate-850">
                    {currentQuestion.year || "2026"}
                  </span>
                  <span className="bg-slate-950 text-amber-500 px-2 py-0.5 rounded border border-slate-850">
                    {currentQuestion.difficulty || "Média"}
                  </span>
                  <span className="bg-slate-950 text-slate-400 px-2 py-0.5 rounded border border-slate-850">
                    {currentQuestion.topic || "Geral"}
                  </span>
                </div>
              </div>

              {currentUser.isAdmin && (
                <div className="flex items-center gap-1.5 shrink-0">
                  {deleteConfirmId === currentQuestion.id ? (
                    <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-xl animate-fade-in">
                      <span className="text-[10px] text-rose-400 font-extrabold uppercase font-mono">Excluir?</span>
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteQuestion(currentQuestion.id);
                          setDeleteConfirmId(null);
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-black rounded-lg cursor-pointer transition shadow"
                      >
                        SIM
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg cursor-pointer transition"
                      >
                        NÃO
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(currentQuestion.id)}
                      className="p-2 text-rose-500 hover:bg-rose-950/20 rounded-lg border border-transparent hover:border-rose-900/30 transition cursor-pointer"
                      title="Remover Questão"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Statement Text */}
            <div className="space-y-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase font-mono">
                Disciplina: <span className="text-slate-300 font-extrabold">{currentQuestion.subject}</span>
              </p>
              
              <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium whitespace-pre-wrap select-text pl-1.5 border-l-2 border-amber-400/40">
                {stripMarkdownAsterisks(currentQuestion.statement)}
              </p>

              {/* Options list */}
              <div className="space-y-3 pt-2">
                {currentQuestion.options.map((opt, oIdx) => {
                  const isSelected = selectedOption === oIdx;
                  const isCorrectAnswer = oIdx === currentQuestion.correctOptionIndex;
                  const showFeedbackCorrectness = currentUser.isAdmin || solvedInCurrentSession.has(currentQuestion.id);
                  
                  let optStyle = "bg-slate-950 border-slate-850 text-slate-300 hover:bg-slate-850/30";
                  if (isSelected && !hasChecked) {
                    optStyle = "bg-amber-400/10 border-amber-400 text-amber-300";
                  } else if (hasChecked) {
                    if (showFeedbackCorrectness) {
                      if (isCorrectAnswer) {
                        optStyle = "bg-emerald-500/15 border-emerald-500 text-emerald-400 font-bold";
                      } else if (isSelected) {
                        optStyle = "bg-rose-500/15 border-rose-500 text-rose-400";
                      } else {
                        optStyle = "bg-slate-950/40 border-slate-850/60 text-slate-500 pointer-events-none";
                      }
                    } else {
                      if (isSelected) {
                        optStyle = "bg-cyan-500/10 border-cyan-500/50 text-cyan-400 font-bold pointer-events-none";
                      } else {
                        optStyle = "bg-slate-950/40 border-slate-850/40 text-slate-500 pointer-events-none";
                      }
                    }
                  }

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      disabled={hasChecked}
                      onClick={() => setSelectedOption(oIdx)}
                      className={`w-full text-left p-4 rounded-xl border text-xs leading-relaxed transition flex items-start gap-3.5 cursor-pointer ${optStyle}`}
                    >
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                        isSelected && !hasChecked
                          ? "bg-amber-400 text-slate-950"
                          : hasChecked && showFeedbackCorrectness && isCorrectAnswer
                          ? "bg-emerald-500 text-slate-950"
                          : hasChecked && showFeedbackCorrectness && isSelected
                          ? "bg-rose-500 text-slate-950"
                          : hasChecked && !showFeedbackCorrectness && isSelected
                          ? "bg-cyan-500 text-slate-950"
                          : "bg-slate-900 text-slate-400"
                      }`}>
                        {String.fromCharCode(65 + oIdx)}
                      </span>
                      <span className="pt-0.5">{stripMarkdownAsterisks(opt)}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Explanation box after checking */}
            {hasChecked && (currentUser.isAdmin || solvedInCurrentSession.has(currentQuestion.id)) && (
              <div className="bg-slate-950 border border-slate-850/80 rounded-2xl p-5 space-y-2 relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
                <h4 className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-amber-500" />
                  Gabarito Comentado Coordenador
                </h4>
                <div className="text-[11px] text-slate-300 leading-relaxed pl-1.5">
                  {renderFormattedExplanation(currentQuestion.explanation)}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between border-t border-slate-800/80 pt-4 mt-4">
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentQuestionIdx === 0}
                  onClick={() => setCurrentQuestionIdx(currentQuestionIdx - 1)}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 disabled:opacity-30 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Anterior
                </button>
                <button
                  type="button"
                  disabled={currentQuestionIdx === filteredQuestions.length - 1}
                  onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                  className="px-3 py-2 bg-slate-950 hover:bg-slate-850 border border-slate-800 disabled:opacity-30 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  Próxima
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {!hasChecked ? (
                <button
                  type="button"
                  onClick={handleVerifyAnswer}
                  disabled={selectedOption === null}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 disabled:opacity-40 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1 uppercase tracking-wider"
                >
                  <span>Confirmar Resposta</span>
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {(currentUser.isAdmin || solvedInCurrentSession.has(currentQuestion.id)) ? (
                    solvedStats[currentQuestion.id]?.correct ? (
                      <span className="text-emerald-400 text-xs font-bold font-mono flex items-center gap-1">
                        <CheckCircle className="w-4 h-4" /> ACERTOU!
                      </span>
                    ) : (
                      <span className="text-rose-400 text-xs font-bold font-mono flex items-center gap-1">
                        <XCircle className="w-4 h-4" /> ERROU!
                      </span>
                    )
                  ) : (
                    <span className="text-cyan-400 text-xs font-bold font-mono flex items-center gap-1.5 bg-cyan-950/40 border border-cyan-900/40 px-3 py-1.5 rounded-xl">
                      <CheckCircle className="w-4 h-4" /> RESPONDIDA
                    </span>
                  )}
                  {currentQuestionIdx < filteredQuestions.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                      className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1 uppercase tracking-wider ml-2"
                    >
                      Avançar <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Lateral Questions Map */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-3xl p-5 text-white shadow-xl space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3">
                <h3 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-4 h-4" />
                  Mapeamento do Caderno
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Navegue pelas questões correspondentes aos filtros ativos.</p>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-4 gap-2 max-h-[220px] overflow-y-auto pr-1">
                {filteredQuestions.map((q, idx) => {
                  const stat = solvedStats[q.id];
                  const isActive = currentQuestionIdx === idx;
                  
                  let btnStyle = "bg-slate-950 border-slate-850 hover:bg-slate-850/40 text-slate-400";
                  if (isActive) {
                    btnStyle = "bg-amber-400 text-slate-950 font-black border-amber-400 shadow";
                  } else if (stat) {
                    btnStyle = stat.correct 
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold" 
                      : "bg-rose-500/10 border-rose-500/40 text-rose-400";
                  }

                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentQuestionIdx(idx)}
                      className={`h-10 rounded-xl border text-xs font-bold transition flex items-center justify-center cursor-pointer ${btnStyle}`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-950 p-4 border border-slate-850 rounded-2xl space-y-3 mt-4">
              <span className="text-[9px] text-slate-500 font-mono tracking-widest uppercase block text-center">Informativo Militar</span>
              <p className="text-[10px] text-slate-400 leading-normal">
                Todas as questões disponibilizadas nesta área são de autoria intelectual da coordenação da PMBA. A redistribuição não autorizada é estritamente proibida.
              </p>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}
