import { useState, useEffect } from "react";
import { initialSyllabusData } from "../data/syllabusData";
import { SyllabusSection, SyllabusItem, User } from "../types";
import { CheckCircle2, Circle, FileText, BarChart2, BookOpen, Layers, ShieldCheck, Award, Clock, Target, Sparkles, Flame, Trophy, Zap, Search, Sparkle, ArrowUpDown, Filter, Check, Info, Lightbulb } from "lucide-react";
import { fetchSyllabusProgressFromFirestore, saveSyllabusProgressToFirestore } from "../lib/firebase";
import TenenteIAModal from "./TenenteIAModal";
import { registerStudyDay } from "../lib/streak";
import { raioXSoldadoData, raioXCfoData, top15Incidence, top15IncidenceCfo } from "../data/raioxData";

interface VerticalSyllabusProps {
  currentUser: User;
}

export default function VerticalSyllabus({ currentUser }: VerticalSyllabusProps) {
  const [syllabus, setSyllabus] = useState<SyllabusSection[]>([]);
  const [activeTab, setActiveTab] = useState<"cfo" | "soldado">("soldado");
  const [selectedSubject, setSelectedSubject] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Raio-X view states
  const [raioXCfo, setRaioXCfo] = useState<any[]>(raioXCfoData);

  useEffect(() => {
    const loadCustomRaioX = () => {
      const saved = localStorage.getItem("custom_raiox_cfo_data");
      if (saved) {
        try {
          setRaioXCfo(JSON.parse(saved));
        } catch (e) {
          setRaioXCfo(raioXCfoData);
        }
      } else {
        setRaioXCfo(raioXCfoData);
      }
    };

    loadCustomRaioX();

    window.addEventListener("custom_raiox_updated", loadCustomRaioX);
    return () => {
      window.removeEventListener("custom_raiox_updated", loadCustomRaioX);
    };
  }, []);

  const derivedTop15Cfo = [...raioXCfo]
    .flatMap(sub => sub.topics.map((t: any) => ({ ...t, subject: sub.subject })))
    .sort((a, b) => b.incidence - a.incidence)
    .slice(0, 15)
    .map((t, idx) => ({
      rank: idx + 1,
      topic: t.topic,
      subject: t.subject,
      incidence: t.incidence,
      articles: t.articles || "—"
    }));

  const [syllabusView, setSyllabusView] = useState<"edital" | "raiox">("edital");
  const [raioxSubjectFilter, setRaioxSubjectFilter] = useState<string>("Todos");
  const [raioxSearch, setRaioxSearch] = useState<string>("");
  const [raioxIncidenceFilter, setRaioxIncidenceFilter] = useState<string>("Todos");
  const [raioxSubView, setRaioxSubView] = useState<"todos" | "top15">("todos");
  const [showAiTacticalTip, setShowAiTacticalTip] = useState<boolean>(false);
  const [aiTacticalTipText, setAiTacticalTipText] = useState<string>("");
  const [generatingTip, setGeneratingTip] = useState<boolean>(false);

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

  // Reset Raio-X filters on activeTab switch
  useEffect(() => {
    setRaioxSubjectFilter("Todos");
    setRaioxSearch("");
    setRaioxIncidenceFilter("Todos");
    setRaioxSubView("todos");
  }, [activeTab]);

  const cleanObsoleteSyllabus = (sections: SyllabusSection[]): SyllabusSection[] => {
    return sections.map(section => {
      if (section.category === "cfo") {
        const cleanedTopics = section.topics.filter(topic => {
          const titleLower = topic.title.toLowerCase();
          return !(
            titleLower.includes("lei de acesso") ||
            titleLower.includes("acesso à informação") ||
            titleLower.includes("12.527") ||
            titleLower.includes("obsoleto")
          );
        });
        return { ...section, topics: cleanedTopics };
      }
      return section;
    });
  };

  // Load progress from localStorage/Firestore
  useEffect(() => {
    const loadSyllabus = async () => {
      let activeSyllabus: SyllabusSection[] = [];
      const saved = localStorage.getItem(`syllabus_progress_${currentUser.id}`);
      if (saved) {
        try {
          activeSyllabus = cleanObsoleteSyllabus(JSON.parse(saved));
        } catch (e) {
          activeSyllabus = cleanObsoleteSyllabus(initialSyllabusData);
        }
      } else {
        activeSyllabus = cleanObsoleteSyllabus(initialSyllabusData);
      }

      setSyllabus(activeSyllabus);

      try {
        const fsSyllabus = await fetchSyllabusProgressFromFirestore(currentUser.id);
        if (fsSyllabus && fsSyllabus.length > 0) {
          const cleanedFs = cleanObsoleteSyllabus(fsSyllabus);
          setSyllabus(cleanedFs);
          localStorage.setItem(`syllabus_progress_${currentUser.id}`, JSON.stringify(cleanedFs));
        }
      } catch (err) {
        console.error("Error loading syllabus from Firestore:", err);
      }
    };

    loadSyllabus();
  }, [currentUser]);

  // Save to localStorage helper & sync to Firestore
  const saveSyllabus = async (updated: SyllabusSection[]) => {
    const cleaned = cleanObsoleteSyllabus(updated);
    setSyllabus(cleaned);
    localStorage.setItem(`syllabus_progress_${currentUser.id}`, JSON.stringify(cleaned));
    window.dispatchEvent(new Event("syllabus_updated"));
    try {
      await saveSyllabusProgressToFirestore(currentUser.id, cleaned);
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

  // Dynamic heuristic matching from Raio-X item to actual syllabus state
  const findMatchingSyllabusTopic = (subjectName: string, topicText: string) => {
    const matchedSection = syllabus.find(s => 
      s.category === activeTab && 
      (s.subject.toLowerCase().replace(/[\s/]/g, "").includes(subjectName.toLowerCase().replace(/[\s/]/g, "")) ||
       subjectName.toLowerCase().replace(/[\s/]/g, "").includes(s.subject.toLowerCase().replace(/[\s/]/g, "")))
    );
    if (!matchedSection) return null;

    // First try exact word intersection
    const cleanTopic = topicText.toLowerCase().replace(/[()~]/g, "");
    const words = cleanTopic.split(/[\s,/-]+/).filter(w => w.length > 3);
    
    let bestTopic: { sectionId: string; topic: SyllabusItem } | null = null;
    let maxMatches = 0;

    matchedSection.topics.forEach(topic => {
      const titleLower = topic.title.toLowerCase();
      let matches = 0;
      words.forEach(w => {
        if (titleLower.includes(w)) {
          matches++;
        }
      });
      if (matches > maxMatches) {
        maxMatches = matches;
        bestTopic = { sectionId: matchedSection.id, topic };
      }
    });

    if (!bestTopic && matchedSection.topics.length > 0) {
      bestTopic = { sectionId: matchedSection.id, topic: matchedSection.topics[0] };
    }

    return bestTopic;
  };

  // Dynamic Gamified Readiness and XP Calculation for Raio-X
  const getRaioXProgress = () => {
    let totalScore = 0;
    let maxPossibleScore = 0;
    let totalRaioxTopics = 0;
    let completedRaioxTopics = 0;

    const activeRaioXData = activeTab === "cfo" ? raioXCfo : raioXSoldadoData;

    activeRaioXData.forEach(sub => {
      sub.topics.forEach(top => {
        totalRaioxTopics++;
        const matched = findMatchingSyllabusTopic(sub.subject, top.topic);
        
        // Base weight based on incidence score
        const weight = activeTab === "cfo" ? (top.incidence >= 3 ? 3 : top.incidence >= 2 ? 2 : 1) : (top.incidence >= 10 ? 3 : top.incidence >= 5 ? 2 : 1);
        maxPossibleScore += weight * (100 + 150 + 200); // theory, summary, questions

        if (matched && matched.topic) {
          const t = matched.topic;
          let topicScore = 0;
          if (t.isCompleted) topicScore += 100;
          if (t.hasSummary) topicScore += 150;
          if (t.hasQuestions) topicScore += 200;

          totalScore += topicScore * weight;

          if (t.isCompleted && t.hasSummary && t.hasQuestions) {
            completedRaioxTopics++;
          }
        }
      });
    });

    const completionRate = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;
    return {
      xp: totalScore,
      maxXP: maxPossibleScore,
      rate: completionRate,
      completedCount: completedRaioxTopics,
      totalCount: totalRaioxTopics
    };
  };

  const raioxProg = getRaioXProgress();

  // AI Tactical Strategy advice generator based on progress
  const generateAiTacticalStrategy = () => {
    setGeneratingTip(true);
    setShowAiTacticalTip(true);
    setAiTacticalTipText("Analisando seu perfil de estudos e a incidência histórica das provas PMBA... 🧠⚡");
    
    setTimeout(() => {
      const activeRaioXData = activeTab === "cfo" ? raioXCfo : raioXSoldadoData;
      const suggestions: string[] = [];
      const threshold = activeTab === "cfo" ? 2 : 8;

      activeRaioXData.forEach(sub => {
        sub.topics.forEach(top => {
          if (top.incidence >= threshold && suggestions.length < 3) {
            const matched = findMatchingSyllabusTopic(sub.subject, top.topic);
            if (!matched || !matched.topic.isCompleted || !matched.topic.hasQuestions) {
              suggestions.push(`🎯 **${sub.subject} - ${top.topic}** (Incidência: ${top.incidence}x): Você ainda não concluiu ou não fixou este tema de alta incidência histórica. Sugiro que clique no botão **Mentor IA 🧠** para receber um resumo didático passo a passo do assunto.`);
            }
          }
        });
      });

      const trackLabel = activeTab === "cfo" ? "Oficial (CFO)" : "Soldado";
      if (suggestions.length === 0) {
        setAiTacticalTipText(`🏆 **Excelente trabalho!** Você já concluiu a preparação teórica e prática para todos os tópicos de alta e altíssima incidência nas provas de ${trackLabel} da PMBA. Seu nível de preparação está excelente. Agora, mantenha revisões diárias e simulados!`);
      } else {
        setAiTacticalTipText(`📈 **Planejamento Estratégico de Estudos (${trackLabel}):**\n\nCom base nas estatísticas das provas de 2010 a 2024, aqui estão as suas 3 maiores prioridades de estudo hoje para maximizar seus acertos:\n\n${suggestions.join("\n\n")}\n\n*Acelere seus estudos marcando as caixas de 'Lido', 'Resumo' e 'Questões' diretamente em cada assunto para subir seu nível de desempenho!*`);
      }
      setGeneratingTip(false);
    }, 1500);
  };

  const getCombatRank = (xp: number) => {
    if (xp >= 15000) return { title: "Subtenente de Elite ⚔️", color: "text-rose-400 border-rose-500/30 bg-rose-500/5" };
    if (xp >= 8000) return { title: "Sargento Tático 🎖️", color: "text-amber-400 border-amber-500/30 bg-amber-500/5" };
    if (xp >= 4000) return { title: "Cabo Preparado 🛡️", color: "text-indigo-400 border-indigo-500/30 bg-indigo-500/5" };
    if (xp >= 1500) return { title: "Soldado Alerta 👮", color: "text-sky-400 border-sky-500/30 bg-sky-500/5" };
    return { title: "Recruta Aspirante 🔰", color: "text-slate-400 border-slate-800 bg-slate-950/40" };
  };

  const currentRank = getCombatRank(raioxProg.xp);

  // Filtered Raio-X subjects and topics
  const activeRaioXData = activeTab === "cfo" ? raioXCfo : raioXSoldadoData;
  const raioxSubjects = ["Todos", ...activeRaioXData.map(s => s.subject)];
  const filteredRaioxSubjects = activeRaioXData
    .map(sub => {
      const filteredTopics = sub.topics.filter(top => {
        const matchesSubject = raioxSubjectFilter === "Todos" || sub.subject === raioxSubjectFilter;
        const matchesSearch = top.topic.toLowerCase().includes(raioxSearch.toLowerCase()) || 
                              sub.subject.toLowerCase().includes(raioxSearch.toLowerCase());
        
        let matchesIncidence = true;
        if (raioxIncidenceFilter === "altissima") {
          matchesIncidence = activeTab === "cfo" ? top.incidence >= 3 : top.incidence >= 10;
        } else if (raioxIncidenceFilter === "alta") {
          matchesIncidence = activeTab === "cfo" ? top.incidence === 2 : top.incidence >= 5 && top.incidence < 10;
        } else if (raioxIncidenceFilter === "media") {
          matchesIncidence = activeTab === "cfo" ? top.incidence < 2 : top.incidence < 5;
        }

        return matchesSubject && matchesSearch && matchesIncidence;
      });

      return {
        ...sub,
        topics: filteredTopics
      };
    })
    .filter(sub => sub.topics.length > 0);

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

      {/* View Toggle */}
      {(currentUser.accessSoldado || currentUser.accessCFO) && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-1.5 rounded-xl border border-slate-800/80 mb-6">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setSyllabusView("edital")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                syllabusView === "edital"
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Edital Completo
            </button>
            <button
              onClick={() => setSyllabusView("raiox")}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                syllabusView === "raiox"
                  ? "bg-amber-400 text-slate-950 font-bold shadow-md"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              {activeTab === "cfo" ? "Raio-X PMBA (Foco CFO 🏆)" : "Raio-X PMBA (Foco Soldado 🎯)"}
            </button>
          </div>

          {syllabusView === "raiox" && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-lg border border-amber-500/20 font-medium">
              <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span>Prontidão Raio-X: <span className="font-bold font-mono">{raioxProg.rate}%</span></span>
            </div>
          )}
        </div>
      )}

      {/* RENDER VIEW 1: EDITAL COMPLETO */}
      {syllabusView === "edital" ? (
        <>
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

                        {/* Mentor IA Button */}
                        <button
                          onClick={() => {
                            setAiModalTopic(topic.title);
                            setAiModalSubject(section.subject);
                            setAiModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 transition cursor-pointer group"
                          title="Consultar Mentor IA para explicações, resumos ou questões de treino"
                        >
                          <Sparkles className="w-3.5 h-3.5 group-hover:scale-110 transition-transform text-amber-400 group-hover:text-slate-950" />
                          <span>Mentor IA 🧠</span>
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
        </>
      ) : (
        /* RENDER VIEW 2: RAIO-X COMPLETO (SOLDADO) */
        <>
          {/* Gamified Metrics Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Prontidão Estatística</span>
                <Trophy className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-amber-400">{raioxProg.rate}%</div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Precisão ponderada de estudo
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${raioxProg.rate}%` }} />
              </div>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between transition-all duration-300 ${currentRank.color}`}>
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Patente de Estudos</span>
                <Award className="w-4 h-4 shrink-0" />
              </div>
              <div>
                <div className="text-base font-bold truncate">{currentRank.title}</div>
                <div className="text-[10px] opacity-80 font-mono mt-1.5">
                  Pontuação: <span className="font-bold">{raioxProg.xp} XP</span>
                </div>
              </div>
              <div className="w-full bg-slate-800/50 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-current h-full transition-all duration-500" style={{ width: `${Math.min(100, (raioxProg.xp / 16000) * 100)}%` }} />
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Temas Críticos Mapeados</span>
                <Check className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-emerald-400">{raioxProg.completedCount}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  de {raioxProg.totalCount} tópicos do Raio-X 100% concluídos
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-emerald-400 h-full transition-all duration-500" style={{ width: `${(raioxProg.completedCount / raioxProg.totalCount) * 100}%` }} />
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-400 mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider">Foco na Prova</span>
                <Flame className="w-4 h-4 text-rose-400" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono text-slate-100">Top Relevância</div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Temas ordenados pela frequência histórica
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div className="bg-rose-500 h-full" style={{ width: "100%" }} />
              </div>
            </div>
          </div>

          {/* AI Tactical Tip Generator */}
          <div className="bg-slate-950/40 border border-slate-800 rounded-xl p-4 mb-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <Lightbulb className="w-24 h-24 text-amber-400" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-400/10 rounded-lg text-amber-400 shrink-0 border border-amber-400/20">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200">Recomendação de Estudos do Mentor IA 💡</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Análise em tempo real dos seus pontos fracos com base na incidência histórica das provas PMBA.
                  </p>
                </div>
              </div>
              <button
                onClick={generateAiTacticalStrategy}
                disabled={generatingTip}
                className="px-4 py-2 bg-amber-400 text-slate-950 text-xs font-bold rounded-lg hover:bg-amber-300 transition shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                <span>{generatingTip ? "Analisando..." : "Análise do Mentor IA"}</span>
              </button>
            </div>

            {showAiTacticalTip && (
              <div className="mt-4 pt-4 border-t border-slate-800/60 text-xs text-slate-300 whitespace-pre-line leading-relaxed bg-slate-950/80 p-3 rounded-lg border border-slate-800/40">
                {aiTacticalTipText}
              </div>
            )}
          </div>

          {/* Raio-X Sub-tab bar */}
          <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-3">
            <button
              onClick={() => setRaioxSubView("todos")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                raioxSubView === "todos"
                  ? "bg-amber-400/10 border border-amber-500/30 text-amber-400 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Todos os Assuntos do Raio-X
            </button>
            <button
              onClick={() => setRaioxSubView("top15")}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                raioxSubView === "top15"
                  ? "bg-amber-400/10 border border-amber-500/30 text-amber-400 font-bold shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              Top 15 Temas de Ouro (Mapeados 🏆)
            </button>
          </div>

          {raioxSubView === "todos" ? (
            <>
              {/* Raio-X Filtering */}
              <div className="flex flex-col gap-4 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">Filtrar Disciplina</label>
                    <select
                      value={raioxSubjectFilter}
                      onChange={(e) => setRaioxSubjectFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
                    >
                      {raioxSubjects.map(sub => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="md:col-span-4">
                    <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">Buscar Assunto</label>
                    <input
                      type="text"
                      value={raioxSearch}
                      onChange={(e) => setRaioxSearch(e.target.value)}
                      placeholder="Ex: Direito Penal, Excel, Crase..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block text-[11px] text-slate-400 mb-1.5 font-medium">Grau de Prioridade</label>
                    <select
                      value={raioxIncidenceFilter}
                      onChange={(e) => setRaioxIncidenceFilter(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-400"
                    >
                      <option value="Todos">Todos os Assuntos</option>
                      {activeTab === "cfo" ? (
                        <>
                          <option value="altissima">🔥 Altíssima Prioridade (3 ou mais incidências)</option>
                          <option value="alta">⚡ Alta Prioridade (2 incidências)</option>
                          <option value="media">📌 Prioridade Média (menos de 2 incidências)</option>
                        </>
                      ) : (
                        <>
                          <option value="altissima">🔥 Altíssima Prioridade (10 ou mais incidências)</option>
                          <option value="alta">⚡ Alta Prioridade (5 a 9 incidências)</option>
                          <option value="media">📌 Prioridade Média (menos de 5 incidências)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* MAIN RAIO-X DATA PRESENTATION */}
              <div className="space-y-6">
                {filteredRaioxSubjects.map((sub) => (
                    <div key={sub.subject} className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/20">
                      {/* Subject Header */}
                      <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                        <span className="font-bold text-xs text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                          {sub.subject}
                        </span>
                        <span className="text-[10px] bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-md font-medium">
                          {sub.questionsPerExam}
                        </span>
                      </div>

                      {/* Topics sorted descending */}
                      <div className="divide-y divide-slate-800/40">
                        {sub.topics.map((top) => {
                          // Find real syllabus state
                          const matched = findMatchingSyllabusTopic(sub.subject, top.topic);
                          const isHighIncidence = activeTab === "cfo" ? top.incidence >= 3 : top.incidence >= 10;
                          const isMediumIncidence = activeTab === "cfo" ? top.incidence === 2 : top.incidence >= 5 && top.incidence < 10;

                          return (
                            <div key={top.topic} className="p-4 hover:bg-slate-900/30 transition flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                              {/* Left: Info details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                  {/* Incidence badge */}
                                  <div className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono border ${
                                    isHighIncidence 
                                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400" 
                                      : isMediumIncidence 
                                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                                      : "bg-slate-800 border-slate-700 text-slate-300"
                                  }`}>
                                    {top.incidence}x Cobrado
                                  </div>
                                  {isHighIncidence && (
                                    <span className="bg-rose-500/20 text-rose-400 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-0.5">
                                      <Flame className="w-2.5 h-2.5" /> Altíssima Prioridade
                                    </span>
                                  )}
                                  {top.articles && top.articles !== "—" && (
                                    <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded font-mono truncate max-w-xs" title={`Base Legal: ${top.articles}`}>
                                      {top.articles}
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-sm font-bold text-slate-100 flex items-center gap-1.5">
                                  {top.topic}
                                </h4>

                                {/* "Como cai na prova" Box */}
                                <p className="text-xs text-slate-400 leading-relaxed mt-1.5 font-medium border-l-2 border-slate-800 pl-3">
                                  <span className="text-amber-500/90 font-bold block text-[10px] uppercase tracking-wider mb-0.5">Como cai na prova:</span>
                                  {top.howItFalls}
                                </p>
                              </div>

                              {/* Right: Checklist Actions Cockpit linked directly to Syllabus state */}
                              <div className="flex flex-wrap items-center gap-2.5 xl:justify-end shrink-0 bg-slate-950/60 p-3 xl:p-0 rounded-lg border border-slate-800 xl:border-none">
                                {matched ? (
                                  <>
                                    {/* Spaced Repetition Toggle */}
                                    <button
                                      onClick={() => handleToggleSpacedRepetition(matched.sectionId, matched.topic.id)}
                                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                                        matched.topic.spacedRepetitionActive
                                          ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                                          : "bg-slate-900 border-slate-800/80 text-slate-500 hover:text-slate-400"
                                      }`}
                                      title={matched.topic.spacedRepetitionActive ? `Revisão agendada` : "Ativar revisão espaçada"}
                                    >
                                      <Clock className="w-3.5 h-3.5" />
                                      <span>{matched.topic.spacedRepetitionActive ? `Fase ${matched.topic.revisionStage || 1}` : "Rev"}</span>
                                    </button>

                                    {/* Mentor IA Button */}
                                    <button
                                      onClick={() => {
                                        setAiModalTopic(matched.topic.title);
                                        setAiModalSubject(sub.subject);
                                        setAiModalOpen(true);
                                      }}
                                      className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 transition cursor-pointer"
                                      title="Conselho do Mentor IA"
                                    >
                                      <Sparkles className="w-3 h-3 text-amber-400" />
                                      <span>Mentor IA 🧠</span>
                                    </button>

                                    {/* Lido */}
                                    <button
                                      onClick={() => handleToggleField(matched.sectionId, matched.topic.id, "isCompleted")}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                                        matched.topic.isCompleted
                                          ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                                      }`}
                                    >
                                      {matched.topic.isCompleted ? (
                                        <CheckCircle2 className="w-3 h-3 text-sky-400" />
                                      ) : (
                                        <Circle className="w-3 h-3 text-slate-600" />
                                      )}
                                      <span>Lido</span>
                                    </button>

                                    {/* Resumo */}
                                    <button
                                      onClick={() => handleToggleField(matched.sectionId, matched.topic.id, "hasSummary")}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                                        matched.topic.hasSummary
                                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                                      }`}
                                    >
                                      {matched.topic.hasSummary ? (
                                        <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                                      ) : (
                                        <Circle className="w-3 h-3 text-slate-600" />
                                      )}
                                      <span>Resumo</span>
                                    </button>

                                    {/* Questões */}
                                    <button
                                      onClick={() => handleToggleField(matched.sectionId, matched.topic.id, "hasQuestions")}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                                        matched.topic.hasQuestions
                                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                          : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                                      }`}
                                    >
                                      {matched.topic.hasQuestions ? (
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      ) : (
                                        <Circle className="w-3 h-3 text-slate-600" />
                                      )}
                                      <span>Questões</span>
                                    </button>

                                    {/* % Correct */}
                                    <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md px-1.5 py-0.5">
                                      <span className="text-[9px] font-bold text-slate-500 uppercase">Acertos:</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={matched.topic.correctRate}
                                        onChange={(e) => handleRateChange(matched.sectionId, matched.topic.id, parseInt(e.target.value) || 0)}
                                        disabled={!matched.topic.hasQuestions}
                                        className={`w-7 text-center font-mono text-[10px] bg-transparent focus:outline-none ${
                                          !matched.topic.hasQuestions 
                                            ? "text-slate-600 cursor-not-allowed" 
                                            : matched.topic.correctRate >= 70
                                            ? "text-emerald-400 font-bold"
                                            : matched.topic.correctRate >= 50
                                            ? "text-amber-400"
                                            : "text-rose-400"
                                        }`}
                                      />
                                      <span className="text-[9px] text-slate-500 font-mono">%</span>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-[10px] text-slate-500 italic">Vinculando ao edital...</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                ))
                }
                {filteredRaioxSubjects.length === 0 && (
                  <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-800/80">
                    <span className="text-slate-500 text-sm font-medium">Nenhum assunto correspondente aos filtros.</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* TOP 15 INCIDENCE SUBVIEW */
            <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 divide-y divide-slate-800/40">
              <div className="bg-slate-950/80 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                <span className="font-bold text-xs text-amber-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  Top 15 Assuntos Mais Cobrados ({activeTab === "cfo" ? "Oficial CFO" : "Soldado"})
                </span>
                <span className="text-[10px] text-slate-400">
                  Comprovado estatisticamente pelas provas reais
                </span>
              </div>
              
              {(activeTab === "cfo" ? derivedTop15Cfo : top15Incidence).map((item) => {
                const matched = findMatchingSyllabusTopic(item.subject, item.topic);
                return (
                  <div key={item.rank} className="p-4 hover:bg-slate-900/30 transition flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    {/* Left: Rank, Subject & Topic info */}
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 font-mono border ${
                        item.rank === 1
                          ? "bg-amber-400 text-slate-950 border-amber-300"
                          : item.rank === 2
                          ? "bg-slate-300 text-slate-950 border-slate-200"
                          : item.rank === 3
                          ? "bg-amber-700 text-amber-100 border-amber-600"
                          : "bg-slate-900 text-slate-300 border-slate-800"
                      }`}>
                        #{item.rank}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] text-amber-400 font-semibold uppercase bg-amber-400/10 px-2 py-0.5 rounded border border-amber-500/20">
                            {item.subject}
                          </span>
                          <span className="text-[10px] font-bold font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                            {item.incidence}x Cobrado
                          </span>
                          {item.articles && item.articles !== "—" && (
                            <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] px-2 py-0.5 rounded font-mono truncate max-w-xs" title={`Base Legal: ${item.articles}`}>
                              {item.articles}
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-slate-100">
                          {item.topic}
                        </h4>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex flex-wrap items-center gap-2.5 xl:justify-end shrink-0 bg-slate-950/60 p-3 xl:p-0 rounded-lg border border-slate-800 xl:border-none">
                      {matched ? (
                        <>
                          {/* Spaced Repetition */}
                          <button
                            onClick={() => handleToggleSpacedRepetition(matched.sectionId, matched.topic.id)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold border transition cursor-pointer ${
                              matched.topic.spacedRepetitionActive
                                ? "bg-amber-400/10 border-amber-400/30 text-amber-400"
                                : "bg-slate-900 border-slate-800/80 text-slate-500 hover:text-slate-400"
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            <span>{matched.topic.spacedRepetitionActive ? `Fase ${matched.topic.revisionStage || 1}` : "Rev"}</span>
                          </button>

                          {/* Mentor IA */}
                          <button
                            onClick={() => {
                              setAiModalTopic(matched.topic.title);
                              setAiModalSubject(item.subject);
                              setAiModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 hover:bg-amber-400 text-amber-400 hover:text-slate-950 transition cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>Mentor IA 🧠</span>
                          </button>

                          {/* Lido */}
                          <button
                            onClick={() => handleToggleField(matched.sectionId, matched.topic.id, "isCompleted")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                              matched.topic.isCompleted
                                ? "bg-sky-500/10 border-sky-500/30 text-sky-400"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            {matched.topic.isCompleted ? (
                              <CheckCircle2 className="w-3 h-3 text-sky-400" />
                            ) : (
                              <Circle className="w-3 h-3 text-slate-600" />
                            )}
                            <span>Lido</span>
                          </button>

                          {/* Resumo */}
                          <button
                            onClick={() => handleToggleField(matched.sectionId, matched.topic.id, "hasSummary")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                              matched.topic.hasSummary
                                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            {matched.topic.hasSummary ? (
                              <CheckCircle2 className="w-3 h-3 text-indigo-400" />
                            ) : (
                              <Circle className="w-3 h-3 text-slate-600" />
                            )}
                            <span>Resumo</span>
                          </button>

                          {/* Questões */}
                          <button
                            onClick={() => handleToggleField(matched.sectionId, matched.topic.id, "hasQuestions")}
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold border transition cursor-pointer ${
                              matched.topic.hasQuestions
                                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
                            }`}
                          >
                            {matched.topic.hasQuestions ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Circle className="w-3 h-3 text-slate-600" />
                            )}
                            <span>Questões</span>
                          </button>

                          {/* % Correct */}
                          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-md px-1.5 py-0.5">
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Acertos:</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={matched.topic.correctRate}
                              onChange={(e) => handleRateChange(matched.sectionId, matched.topic.id, parseInt(e.target.value) || 0)}
                              disabled={!matched.topic.hasQuestions}
                              className={`w-7 text-center font-mono text-[10px] bg-transparent focus:outline-none ${
                                !matched.topic.hasQuestions 
                                  ? "text-slate-600 cursor-not-allowed" 
                                  : matched.topic.correctRate >= 70
                                  ? "text-emerald-400 font-bold"
                                  : matched.topic.correctRate >= 50
                                  ? "text-amber-400"
                                  : "text-rose-400"
                              }`}
                            />
                            <span className="text-[9px] text-slate-500 font-mono">%</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Vinculando ao edital...</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

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
