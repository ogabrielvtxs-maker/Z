import { useState, useEffect } from "react";
import { initialSyllabusData } from "../data/syllabusData";
import { SyllabusSection, SyllabusItem, User } from "../types";
import { CheckCircle2, Circle, FileText, BarChart2, BookOpen, Layers, ShieldCheck, Award, Clock, Target, Sparkles } from "lucide-react";
import { fetchSyllabusProgressFromFirestore, saveSyllabusProgressToFirestore } from "../lib/firebase";
import TenenteIAModal from "./TenenteIAModal";
import { registerStudyDay } from "../lib/streak";

interface VerticalSyllabusProps {
  currentUser: User;
}

export default function VerticalSyllabus({ currentUser }: VerticalSyllabusProps) {
  const [syllabus, setSyllabus] = useState<SyllabusSection[]>([]);
  const [activeTab, setActiveTab] = useState<"cfo" | "soldado">("soldado");
  const [selectedSubject, setSelectedSubject] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Tenente IA modal states
  const [aiModalOpen, setAiModalOpen] = useState<boolean>(false);
  const [aiModalTopic, setAiModalTopic] = useState<string>("");
  const [aiModalSubject, setAiModalSubject] = useState<string>("");

  // Determine available study paths based on user access
  useEffect(() => {
    if (currentUser.accessCFO && !currentUser.accessSoldado) {
      setActiveTab("cfo");
    } else {
      setActiveTab("soldado");
    }
  }, [currentUser]);

  // Load progress from localStorage/Firestore
  useEffect(() => {
    const loadSyllabus = async () => {
      const saved = localStorage.getItem(`syllabus_progress_${currentUser.id}`);
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
        const fsSyllabus = await fetchSyllabusProgressFromFirestore(currentUser.id);
        if (fsSyllabus && fsSyllabus.length > 0) {
          setSyllabus(fsSyllabus);
          localStorage.setItem(`syllabus_progress_${currentUser.id}`, JSON.stringify(fsSyllabus));
        }
      } catch (err) {
        console.error("Error loading syllabus from Firestore:", err);
      }
    };

    loadSyllabus();
  }, [currentUser]);

  // Save to localStorage helper & sync to Firestore
  const saveSyllabus = async (updated: SyllabusSection[]) => {
    setSyllabus(updated);
    localStorage.setItem(`syllabus_progress_${currentUser.id}`, JSON.stringify(updated));
    window.dispatchEvent(new Event("syllabus_updated"));
    try {
      await saveSyllabusProgressToFirestore(currentUser.id, updated);
    } catch (e) {
      console.error("Error syncing syllabus to Firestore:", e);
    }
  };

  const handleToggleField = (sectionId: string, topicId: string, field: "isCompleted" | "hasSummary" | "hasQuestions") => {
    let hasRegisteredStudy = false;
    const updated = syllabus.map((section) => {
      if (section.id === sectionId) {
        const updatedTopics = section.topics.map((topic) => {
          if (topic.id === topicId) {
            const nextValue = !topic[field];
            if (nextValue) {
              hasRegisteredStudy = true;
            }
            return {
              ...topic,
              [field]: nextValue,
              // If we marked as read, summarised, and did questions, let's auto-increment studyCount
              studyCount: field === "isCompleted" && nextValue ? topic.studyCount + 1 : topic.studyCount
            };
          }
          return topic;
        });
        return { ...section, topics: updatedTopics };
      }
      return section;
    });
    saveSyllabus(updated);
    if (hasRegisteredStudy) {
      registerStudyDay(currentUser.id);
      window.dispatchEvent(new Event("streak_updated"));
    }
  };

  const handleRateChange = (sectionId: string, topicId: string, rate: number) => {
    const val = Math.min(100, Math.max(0, rate));
    const updated = syllabus.map((section) => {
      if (section.id === sectionId) {
        const updatedTopics = section.topics.map((topic) => {
          if (topic.id === topicId) {
            return { ...topic, correctRate: val };
          }
          return topic;
        });
        return { ...section, topics: updatedTopics };
      }
      return section;
    });
    saveSyllabus(updated);
  };

  const handleToggleSpacedRepetition = (sectionId: string, topicId: string) => {
    const updated = syllabus.map((section) => {
      if (section.id === sectionId) {
        const updatedTopics = section.topics.map((topic) => {
          if (topic.id === topicId) {
            const isActive = !topic.spacedRepetitionActive;
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split("T")[0];
            
            return {
              ...topic,
              spacedRepetitionActive: isActive,
              revisionStage: isActive ? 1 : undefined,
              nextRevisionDate: isActive ? tomorrowStr : undefined,
              lastRevisionDate: isActive ? new Date().toISOString().split("T")[0] : undefined
            };
          }
          return topic;
        });
        return { ...section, topics: updatedTopics };
      }
      return section;
    });
    saveSyllabus(updated);
  };

  const handleToggleRevision = (sectionId: string, topicId: string, type: "questoes" | "flashcards") => {
    const updated = syllabus.map((section) => {
      if (section.id === sectionId) {
        const updatedTopics = section.topics.map((topic) => {
          if (topic.id === topicId) {
            const isCurrentlySame = topic.isRevision && topic.revisionType === type;
            return {
              ...topic,
              isRevision: !isCurrentlySame,
              revisionType: !isCurrentlySame ? type : undefined
            };
          }
          return topic;
        });
        return { ...section, topics: updatedTopics };
      }
      return section;
    });
    saveSyllabus(updated);
  };

  // Calculations for current Category (CFO/Soldado)
  const currentSections = syllabus.filter((s) => s.category === activeTab);
  
  const subjects = ["Todos", ...Array.from(new Set(currentSections.map((s) => s.subject)))];

  const filteredSections = currentSections
    .map((section) => {
      const filteredTopics = section.topics.filter((topic) => {
        const matchesSubject = selectedSubject === "Todos" || section.subject === selectedSubject;
        const matchesSearch = topic.title.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesSubject && matchesSearch;
      });
      return { ...section, topics: filteredTopics };
    })
    .filter((section) => section.topics.length > 0);

  // Global Progress metrics for active tab
  const totalTopics = currentSections.reduce((acc, curr) => acc + curr.topics.length, 0);
  const completedRead = currentSections.reduce((acc, curr) => acc + curr.topics.filter((t) => t.isCompleted).length, 0);
  const completedSummary = currentSections.reduce((acc, curr) => acc + curr.topics.filter((t) => t.hasSummary).length, 0);
  const completedQuestions = currentSections.reduce((acc, curr) => acc + curr.topics.filter((t) => t.hasQuestions).length, 0);
  
  // Calculate average correct rate for topics where questions have been solved
  const solvedTopics = currentSections.flatMap((s) => s.topics).filter((t) => t.hasQuestions);
  const averageCorrectRate = solvedTopics.length > 0
    ? Math.round(solvedTopics.reduce((acc, curr) => acc + curr.correctRate, 0) / solvedTopics.length)
    : 0;

  const readPercent = totalTopics > 0 ? Math.round((completedRead / totalTopics) * 100) : 0;
  const summaryPercent = totalTopics > 0 ? Math.round((completedSummary / totalTopics) * 100) : 0;
  const questionsPercent = totalTopics > 0 ? Math.round((completedQuestions / totalTopics) * 100) : 0;

  return (
    <div id="vertical-syllabus-component" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-amber-400">
            <Award className="w-6 h-6 text-amber-500" />
            Edital Verticalizado PMBA
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Controle e mapeie de forma inteligente cada tópico do edital para fixação absoluta do conteúdo.
          </p>
        </div>

        {/* Roles/Tabs access selector */}
        <div className="flex items-center gap-2 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start">
          {currentUser.accessSoldado && (
            <button
              onClick={() => {
                setActiveTab("soldado");
                setSelectedSubject("Todos");
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                activeTab === "soldado"
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Soldado PMBA
            </button>
          )}
          {currentUser.accessCFO && (
            <button
              onClick={() => {
                setActiveTab("cfo");
                setSelectedSubject("Todos");
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer notranslate ${
                activeTab === "cfo"
                  ? "bg-amber-400 text-slate-950 shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
              translate="no"
            >
              Oficial (CFO) PMBA
            </button>
          )}
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Teoria Lida</span>
            <BookOpen className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-100">{readPercent}%</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {completedRead} de {totalTopics} tópicos
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-sky-400 h-full transition-all duration-500" style={{ width: `${readPercent}%` }} />
          </div>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Resumos Ativos</span>
            <FileText className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-100">{summaryPercent}%</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {completedSummary} de {totalTopics} tópicos
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-400 h-full transition-all duration-500" style={{ width: `${summaryPercent}%` }} />
          </div>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Questões Feitas</span>
            <Layers className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-100">{questionsPercent}%</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              {completedQuestions} de {totalTopics} tópicos
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${questionsPercent}%` }} />
          </div>
        </div>

        <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Média de Acertos</span>
            <BarChart2 className="w-4 h-4 text-amber-400" />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-slate-100">{averageCorrectRate}%</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">
              Média ponderada de erros
            </div>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${averageCorrectRate}%` }} />
          </div>
        </div>
      </div>

      {/* Filters Area */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">Matéria do Edital</label>
          <div className="flex flex-wrap gap-1.5">
            {subjects.map((sub) => (
              <button
                key={sub}
                onClick={() => setSelectedSubject(sub)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  selectedSubject === sub
                    ? "bg-slate-800 border border-amber-400 text-amber-400"
                    : "bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-400 mb-1.5 font-medium">Buscar Assunto</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Ex: Crase, Inquérito, Funções..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Syllabus Topics Accordion/Table */}
      <div className="space-y-6">
        {filteredSections.map((section) => (
          <div key={section.id} className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20">
            {/* Header */}
            <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800/80 flex justify-between items-center">
              <span className="font-semibold text-sm text-amber-400 uppercase tracking-wide">
                {section.subject}
              </span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md font-mono">
                {section.topics.length} tópicos
              </span>
            </div>

            {/* Topics List */}
            <div className="divide-y divide-slate-800/50">
              {section.topics.map((topic) => (
                <div key={topic.id} className="p-4 hover:bg-slate-900/40 transition grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                  {/* Topic Title */}
                  <div className="lg:col-span-6 flex flex-col gap-1">
                    <div className="flex items-start gap-2.5">
                      <span className="text-slate-500 text-xs font-mono select-none mt-0.5">
                        •
                      </span>
                      <span className="text-sm font-medium text-slate-200 leading-relaxed">
                        {topic.title}
                      </span>
                    </div>
                    {topic.spacedRepetitionActive && topic.nextRevisionDate && (
                      <div className="ml-4 flex items-center gap-1.5 text-[10px] text-amber-400 font-medium">
                        <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span>Próxima revisão (Fase {topic.revisionStage || 1}): {topic.nextRevisionDate.split("-").reverse().join("/")}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions (Lido, Resumo, Questões, Acerto %) */}
                  <div className="lg:col-span-6 flex flex-wrap items-center justify-between sm:justify-end gap-3.5 mt-2 lg:mt-0">
                    
                    {/* Spaced Repetition Toggle */}
                    <button
                      onClick={() => handleToggleSpacedRepetition(section.id, topic.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        topic.spacedRepetitionActive
                          ? "bg-amber-400/10 border-amber-400/40 text-amber-400 hover:bg-amber-400/20"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                      title={topic.spacedRepetitionActive ? `Revisão agendada para ${topic.nextRevisionDate.split("-").reverse().join("/")}` : "Ativar revisão espaçada para alertar na aba ciclo"}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>{topic.spacedRepetitionActive ? `Fase ${topic.revisionStage || 1}` : "Ativar Rev."}</span>
                    </button>

                    {/* Marcar Revisão por Questões */}
                    <button
                      onClick={() => handleToggleRevision(section.id, topic.id, "questoes")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        topic.isRevision && topic.revisionType === "questoes"
                          ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/25"
                          : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                      }`}
                      title="Marcar este assunto para revisão por questões no ciclo semanal"
                    >
                      <Target className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Rev: Questões</span>
                    </button>

                    {/* Marcar Revisão por Flashcards */}
                    <button
                      onClick={() => handleToggleRevision(section.id, topic.id, "flashcards")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        topic.isRevision && topic.revisionType === "flashcards"
                          ? "bg-fuchsia-500/15 border-fuchsia-500/50 text-fuchsia-400 hover:bg-fuchsia-500/25"
                          : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                      }`}
                      title="Marcar este assunto para revisão por flashcards no ciclo semanal"
                    >
                      <Layers className="w-3.5 h-3.5 text-fuchsia-400" />
                      <span>Rev: Flashcard</span>
                    </button>

                    {/* Tenente IA Button */}
                    <button
                      onClick={() => {
                        setAiModalTopic(topic.title);
                        setAiModalSubject(section.title);
                        setAiModalOpen(true);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 transition cursor-pointer group"
                      title="Consultar Tenente IA para explicações, resumos ou questões de treino"
                    >
                      <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-amber-400 group-hover:text-slate-950" />
                      <span>Tenente IA 🧠</span>
                    </button>

                    {/* Lido Checkbox */}
                    <button
                      onClick={() => handleToggleField(section.id, topic.id, "isCompleted")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        topic.isCompleted
                          ? "bg-sky-500/10 border-sky-500/40 text-sky-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {topic.isCompleted ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-600" />
                      )}
                      <span>Lido</span>
                    </button>

                    {/* Resumo Checkbox */}
                    <button
                      onClick={() => handleToggleField(section.id, topic.id, "hasSummary")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        topic.hasSummary
                          ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {topic.hasSummary ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-600" />
                      )}
                      <span>Resumo</span>
                    </button>

                    {/* Exercícios/Questões Checkbox */}
                    <button
                      onClick={() => handleToggleField(section.id, topic.id, "hasQuestions")}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                        topic.hasQuestions
                          ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-300"
                      }`}
                    >
                      {topic.hasQuestions ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : (
                        <Circle className="w-3.5 h-3.5 text-slate-600" />
                      )}
                      <span>Questões</span>
                    </button>

                    {/* % Correct rate (only active if questions are checked) */}
                    <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Acertos:</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={topic.correctRate}
                        onChange={(e) => handleRateChange(section.id, topic.id, parseInt(e.target.value) || 0)}
                        disabled={!topic.hasQuestions}
                        className={`w-10 text-center font-mono text-xs bg-transparent focus:outline-none ${
                          !topic.hasQuestions 
                            ? "text-slate-600 cursor-not-allowed" 
                            : topic.correctRate >= 70
                            ? "text-emerald-400 font-bold"
                            : topic.correctRate >= 50
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      />
                      <span className="text-xs text-slate-500 font-mono">%</span>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredSections.length === 0 && (
          <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 text-sm">Nenhum assunto correspondente aos filtros.</span>
          </div>
        )}
      </div>

      {/* Tenente IA Modal */}
      <TenenteIAModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        topicTitle={aiModalTopic}
        subjectTitle={aiModalSubject}
        currentUser={currentUser}
      />
    </div>
  );
}
