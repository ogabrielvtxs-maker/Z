import React, { useState, useEffect } from "react";
import { 
  FileText, Upload, Sparkles, RefreshCw, Award, 
  CheckCircle, AlertCircle, History, BookOpen, ChevronRight, 
  ArrowLeft, Check, Copy, Printer, ExternalLink, HelpCircle, Eye, EyeOff, Send
} from "lucide-react";
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend 
} from "recharts";
import { User, EssaySubmission, EssayTheme } from "../types";
import { saveEssaySubmissionToFirestore, fetchEssaySubmissionsForStudent, fetchEssayThemesFromFirestore } from "../lib/firebase";
import { callAIOcr, callAICorrectEssay } from "../utils/aiService";

interface RedacaoProps {
  currentUser: User;
}

const THEMES_PRESETS = [
  {
    title: "O papel da segurança pública na preservação dos direitos fundamentais no Brasil.",
    motivatingText: "TEXTO I:\nA Constituição Federal de 1988, no seu Artigo 144, estabelece que a segurança pública é dever do Estado, direito e responsabilidade de todos, sendo exercida para a preservação da ordem pública e da incolumidade das pessoas e do patrimônio. Contudo, a atuação das forças de segurança deve estar em constante harmonia com o respeito aos Direitos Fundamentais previstos no Artigo 5º, assegurando a dignidade da pessoa humana e a legalidade.\n\nTEXTO II:\nPara cientistas políticos e sociólogos, o grande desafio da segurança pública no século XXI é conciliar a repressão qualificada ao crime com a proteção ativa aos direitos humanos. Abordagens de proximidade e inteligência policial têm se mostrado as ferramentas mais eficazes para reduzir os índices de violência e aumentar a confiança da sociedade civil na instituição."
  },
  {
    title: "O avanço tecnológico e a inteligência artificial no combate ao crime organizado.",
    motivatingText: "TEXTO I:\nCom o aumento dos crimes cibernéticos e do crime organizado transnacional, as forças policiais têm buscado incorporar tecnologia avançada em suas rotinas. O uso de drones de reconhecimento, softwares de biometria facial, mapeamento preditivo por inteligência artificial e análise de big data têm revolucionado as investigações e o policiamento preventivo.\n\nTEXTO II:\nCríticos apontam que, embora o uso da inteligência artificial traga celeridade e precisão, há riscos eminentes relacionados à privacidade dos cidadãos e a possíveis vieses algorítmicos em sistemas de reconhecimento facial. É fundamental que haja marcos regulatórios rígidos que guiem o uso de tais tecnologias pelas instituições do Estado."
  },
  {
    title: "Saúde mental na atividade policial militar: desafios e caminhos para a valorização profissional.",
    motivatingText: "TEXTO I:\nA atividade policial militar é considerada uma das profissões mais estressantes do mundo. A exposição constante à violência, o risco iminente de morte, a rotina de plantões exaustivos e a cobrança da sociedade geram um ambiente propício para o desenvolvimento de transtornos mentais, como ansiedade, depressão e a síndrome de Burnout.\n\nTEXTO II:\nA valorização do policial militar passa, obrigatoriamente, por uma política integrada de assistência biopsicossocial. Campanhas de desmistificação do cuidado psicológico e a criação de núcleos de apoio mental nas unidades da corporação são fundamentais para garantir a saúde e a dignidade desses profissionais."
  },
  {
    title: "Violência doméstica no século XXI: desafios legislativos e a eficácia das medidas protetivas.",
    motivatingText: "TEXTO I:\nA Lei Maria da Penha (Lei nº 11.340/2006) representou um marco histórico na proteção dos direitos das mulheres no Brasil. Contudo, mesmo com os avanços legislativos, o país ainda registra altos índices de feminicídio e agressão doméstica, levantando questionamentos sobre a fiscalização efetiva e a rapidez na concessão de medidas protetivas.\n\nTEXTO II:\nA atuação da Polícia Militar da Bahia por meio da 'Operação Ronda Maria da Penha' tem desempenhado um papel crucial no acompanhamento de mulheres sob medida protetiva de urgência. A integração entre policiamento preventivo, apoio psicossocial e repressão imediata é o pilar central para quebrar o ciclo da violência."
  },
  {
    title: "A importância do policiamento comunitário no fortalecimento do elo social na Bahia.",
    motivatingText: "TEXTO I:\nO policiamento comunitário é uma filosofia de trabalho que promove a parceria entre a população e as forças de segurança. Baseado na premissa de que os problemas de segurança exigem soluções conjuntas, esse modelo foca na identificação e resolução de causas de desordem social no próprio bairro.\n\nTEXTO II:\nAs Bases Comunitárias de Segurança (BCS) na Bahia são exemplos de como a presença do Estado, combinada com projetos sociais, esportivos e culturais, consegue resgatar jovens em situação de vulnerabilidade. A proximidade física e o diálogo diário reduzem a desconfiança e geram resultados consolidados na pacificação social."
  },
  {
    title: "Mobilidade urbana e segurança de trânsito: dever do Estado e responsabilidade de todos.",
    motivatingText: "TEXTO I:\nO trânsito brasileiro é um dos que mais mata no mundo. A Organização Mundial da Saúde (OMS) aponta que os acidentes de trânsito são uma das principais causas de mortes de jovens no país. A imprudência, o excesso de velocidade e a mistura de álcool e direção continuam sendo as infrações mais fatais.\n\nTEXTO II:\nA segurança viária, segundo o Artigo 144, parágrafo 10 da Constituição Federal, compreende a educação, engenharia e fiscalização de trânsito, visando assegurar ao cidadão o direito à mobilidade urbana eficiente e segura. A educação continuada nas escolas e o endurecimento das leis de trânsito são passos indispensáveis para a preservação de vidas."
  },
  {
    title: "Outro Tema (Digitar tema personalizado...)",
    motivatingText: ""
  }
];

export default function RedacaoCorrector({ currentUser }: RedacaoProps) {
  const [submissions, setSubmissions] = useState<EssaySubmission[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  
  // Custom Themes from database
  const [dbThemes, setDbThemes] = useState<EssayTheme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState<boolean>(false);
  const [showMotivatingText, setShowMotivatingText] = useState<boolean>(true);

  // New Submission State
  const [selectedTheme, setSelectedTheme] = useState<string>("");
  const [customTheme, setCustomTheme] = useState<string>("");
  const [essayText, setEssayText] = useState<string>("");

  // Correction loading & result states
  const [correcting, setCorrecting] = useState<boolean>(false);
  const [activeSubmission, setActiveSubmission] = useState<EssaySubmission | null>(null);
  const [isViewingHistoryDetails, setIsViewingHistoryDetails] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Combined available themes (db first, then preset fallback)
  const allAvailableThemes = [
    ...dbThemes.map(t => t.title),
    ...THEMES_PRESETS.map(p => p.title)
  ];

  // Find selected theme's motivating text
  const currentSelectedThemeObj = dbThemes.find(t => t.title === selectedTheme);
  const presetThemeObj = THEMES_PRESETS.find(p => p.title === selectedTheme);
  const motivatingTextToShow = currentSelectedThemeObj?.motivatingText || presetThemeObj?.motivatingText || null;

  // Load past submissions and DB themes
  const loadSubmissionsAndThemes = async () => {
    setLoadingHistory(true);
    setLoadingThemes(true);
    try {
      const docs = await fetchEssaySubmissionsForStudent(currentUser.id);
      setSubmissions(docs);
      
      const themes = await fetchEssayThemesFromFirestore();
      setDbThemes(themes);
      
      // Select the first theme
      if (themes.length > 0) {
        setSelectedTheme(themes[0].title);
      } else {
        setSelectedTheme(THEMES_PRESETS[0].title);
      }
    } catch (error) {
      console.error("Erro ao carregar redações ou temas:", error);
    } finally {
      setLoadingHistory(false);
      setLoadingThemes(false);
    }
  };

  useEffect(() => {
    loadSubmissionsAndThemes();
  }, [currentUser]);

  // Helper to construct performance data for recharts progress chart
  const getChartData = () => {
    return [...submissions]
      .filter(sub => sub.status === "corrected")
      .reverse() // Sort chronologically (oldest to newest)
      .map((sub, idx) => {
        const details = sub.correctionDetails;
        
        // Derive/Fallback the 5 competencies for older submissions
        const grammar = details?.grammarScore !== undefined 
          ? details.grammarScore 
          : Math.round((details?.grammarFormalNormScore || 0) / 1.5);
          
        const structure = details?.structureScore !== undefined 
          ? details.structureScore 
          : (details?.themeAndStructureScore || 0);
          
        const content = details?.contentScore !== undefined 
          ? details.contentScore 
          : (details?.themeAndStructureScore || 0);
          
        const cohesion = details?.cohesionScore !== undefined 
          ? details.cohesionScore 
          : Math.round((details?.cohesionCoherenceScore || 0) / 1.25);
          
        const argumentation = details?.argumentationScore !== undefined 
          ? details.argumentationScore 
          : Math.round((details?.informativeArgumentativeScore || 0) / 1.25);
          
        const total = sub.score ?? details?.overallScore ?? 0;
        
        return {
          name: `Redação ${idx + 1}`,
          date: new Date(sub.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
          "Nota Total": total,
          // Scale individual 20-point scores to 100% for uniform visual comparison
          "Gramática": Math.min(100, Math.round(grammar * 5)),
          "Estrutura": Math.min(100, Math.round(structure * 5)),
          "Conteúdo": Math.min(100, Math.round(content * 5)),
          "Coesão": Math.min(100, Math.round(cohesion * 5)),
          "Argumentação": Math.min(100, Math.round(argumentation * 5)),
          rawGrammar: grammar,
          rawStructure: structure,
          rawContent: content,
          rawCohesion: cohesion,
          rawArgumentation: argumentation
        };
      });
  };

  const handleCopy = (text: string, type: "original" | "rewritten") => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Submit typed text for Gemini correction
  const handleRequestCorrection = async () => {
    const finalTheme = selectedTheme.startsWith("Outro Tema") ? customTheme : selectedTheme;
    if (!finalTheme.trim()) {
      alert("Por favor, selecione ou digite o tema da sua redação.");
      return;
    }
    if (!essayText.trim() || essayText.length < 100) {
      alert("Por favor, escreva uma redação mais detalhada (mínimo de 100 caracteres) antes de enviar.");
      return;
    }

    setCorrecting(true);

    try {
      const data = await callAICorrectEssay({
        theme: finalTheme,
        essayText: essayText,
        studentName: currentUser.name
      });

      // We got the correction! Save this to Firestore
      const newSubmission: EssaySubmission = {
        id: `essay_${Date.now()}_${currentUser.id}`,
        studentId: currentUser.id,
        studentName: currentUser.name,
        studentEmail: currentUser.email,
        theme: finalTheme,
        submissionType: "typed",
        essayText: essayText,
        createdAt: new Date().toISOString(),
        status: "corrected",
        score: data.overallScore,
        correctionFeedback: `## Avaliação do Tenente Corretor\n\nSua nota final foi **${data.overallScore}/100**.\n\n### Detalhamento dos Critérios:\n1. **Gramática:** ${data.grammarScore || Math.round((data.grammarFormalNormScore || 0) / 1.5)}/20\n2. **Estrutura:** ${data.structureScore || (data.themeAndStructureScore || 0)}/20\n3. **Conteúdo:** ${data.contentScore || (data.themeAndStructureScore || 0)}/20\n4. **Coesão:** ${data.cohesionScore || Math.round((data.cohesionCoherenceScore || 0) / 1.25)}/20\n5. **Argumentação:** ${data.argumentationScore || Math.round((data.informativeArgumentativeScore || 0) / 1.25)}/20`,
        correctionDetails: {
          themeAndStructureScore: data.themeAndStructureScore !== undefined ? data.themeAndStructureScore : (data.structureScore || 0),
          cohesionCoherenceScore: data.cohesionCoherenceScore !== undefined ? data.cohesionCoherenceScore : Math.round((data.cohesionScore || 0) * 1.25),
          informativeArgumentativeScore: data.informativeArgumentativeScore !== undefined ? data.informativeArgumentativeScore : Math.round((data.argumentationScore || 0) * 1.25),
          grammarFormalNormScore: data.grammarFormalNormScore !== undefined ? data.grammarFormalNormScore : Math.round((data.grammarScore || 0) * 1.5),
          overallScore: data.overallScore,
          themeFeedback: data.themeFeedback || data.contentFeedbackText || "",
          cohesionFeedback: data.cohesionFeedback || data.cohesionFeedbackText || "",
          argumentationFeedback: data.argumentationFeedback || data.argumentationFeedbackText || "",
          grammarFeedback: data.grammarFeedback || data.grammarFeedbackText || "",
          rewrittenText: data.rewrittenText,
          
          // Five PMBA Competencies
          grammarScore: data.grammarScore !== undefined ? data.grammarScore : Math.round((data.grammarFormalNormScore || 0) / 1.5),
          structureScore: data.structureScore !== undefined ? data.structureScore : (data.themeAndStructureScore || 0),
          contentScore: data.contentScore !== undefined ? data.contentScore : (data.themeAndStructureScore || 0),
          cohesionScore: data.cohesionScore !== undefined ? data.cohesionScore : Math.round((data.cohesionCoherenceScore || 0) / 1.25),
          argumentationScore: data.argumentationScore !== undefined ? data.argumentationScore : Math.round((data.informativeArgumentativeScore || 0) / 1.25),
          grammarFeedbackText: data.grammarFeedbackText || data.grammarFeedback || "",
          structureFeedbackText: data.structureFeedbackText || data.themeFeedback || "",
          contentFeedbackText: data.contentFeedbackText || data.themeFeedback || "",
          cohesionFeedbackText: data.cohesionFeedbackText || data.cohesionFeedback || "",
          argumentationFeedbackText: data.argumentationFeedbackText || data.argumentationFeedback || ""
        }
      };

      await saveEssaySubmissionToFirestore(newSubmission);
      
      // Update local states
      setSubmissions((prev) => [newSubmission, ...prev]);
      setActiveSubmission(newSubmission);
      setIsViewingHistoryDetails(false);
      
      // Reset inputs
      setEssayText("");
    } catch (error: any) {
      alert("Erro ao realizar a correção: " + error.message);
    } finally {
      setCorrecting(false);
    }
  };


  const handlePrint = () => {
    window.print();
  };

  // Return to submission form
  const handleReset = () => {
    setActiveSubmission(null);
    setIsViewingHistoryDetails(false);
  };

  return (
    <div id="redacao-corrector-root" className="space-y-6 text-white max-w-7xl mx-auto p-2 sm:p-4">
      {/* Upper Brand Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="space-y-1.5 relative z-10">
          <span className="text-[10px] font-black tracking-widest text-amber-400 bg-amber-400/10 px-2.5 py-1 rounded-full uppercase border border-amber-400/20">
            Módulo de Redação Oficial PMBA
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-100 flex items-center gap-2 mt-1">
            <BookOpen className="w-7 h-7 text-amber-400" />
            Corretor de Redação I.A.
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm max-w-xl leading-relaxed">
            Escreva ou faça upload de sua redação. Nossa Inteligência Artificial avalia seu texto de acordo com os critérios rígidos de correção oficial (Nota de 0 a 100), detalhando seus erros e reescrevendo uma versão modelo de nota 100.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10 shrink-0">
          <div className="bg-slate-950 p-4 border border-slate-800 rounded-2xl flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Tentativas</span>
            <span className="text-2xl font-black text-amber-400 font-mono">{submissions.length}</span>
          </div>
          <div className="bg-slate-950 p-4 border border-slate-800 rounded-2xl flex flex-col items-center">
            <span className="text-[10px] uppercase font-bold text-slate-500">Média Geral</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">
              {submissions.length > 0
                ? Math.round(submissions.reduce((acc, curr) => acc + (curr.score || 0), 0) / submissions.length)
                : 0}
            </span>
          </div>
        </div>
      </div>

      {activeSubmission ? (
        activeSubmission.status === "pending" ? (
          /* Pending View */
          <div className="space-y-6 animate-fade-in bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-2xl mx-auto my-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-400/5 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
            <RefreshCw className="w-12 h-12 text-amber-400 animate-spin mx-auto mb-4" />
            <h2 className="text-xl font-black text-white uppercase tracking-wider">Aguardando Correção da Coordenação</h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-md mx-auto mb-4">
              Sua redação sobre o tema <strong className="text-slate-200">"{activeSubmission.theme}"</strong> foi enviada com sucesso! 
              Nossa equipe pedagógica está analisando seu texto de acordo com os critérios formais oficiais da PMBA. 
              Sua nota final e o feedback detalhado estarão disponíveis aqui assim que homologados.
            </p>
            
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 text-left font-serif text-slate-300 text-xs leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap select-text mb-6">
              {activeSubmission.essayText}
            </div>

            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold transition uppercase tracking-wider cursor-pointer"
            >
              Voltar ao Painel
            </button>
          </div>
        ) : (
          /* Detailed Correction View */
          <div className="space-y-6 animate-fade-in">
          {/* Action Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleReset}
              className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para o Painel</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-bold transition flex items-center gap-2 cursor-pointer"
                title="Imprimir Avaliação"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">Imprimir PDF</span>
              </button>
            </div>
          </div>

          {/* Results Bento Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Box: Grading Badge & Details */}
            <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl relative overflow-hidden flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none -mr-12 -mt-12" />
              
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">Nota da Redação</span>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <span className={`text-6xl font-extrabold font-mono ${
                      (activeSubmission.score || 0) >= 80 
                        ? "text-emerald-400" 
                        : (activeSubmission.score || 0) >= 60 
                        ? "text-amber-400" 
                        : "text-rose-400"
                    }`}>
                      {activeSubmission.score || 0}
                    </span>
                    <span className="text-2xl text-slate-500 font-bold font-mono">/100</span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-400 pt-1">
                    {(activeSubmission.score || 0) >= 60 
                      ? "Aprovado na Nota de Corte da PMBA!" 
                      : "Abaixo da nota de corte exigida (60/100)."}
                  </p>
                </div>

                <div className="border-t border-b border-slate-800 py-5 space-y-4">
                  <h3 className="text-xs font-extrabold uppercase text-amber-400 tracking-widest flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-500" />
                    Detalhamento dos Critérios
                  </h3>
                  
                  {activeSubmission.correctionDetails && (
                    <div className="space-y-3">
                      {activeSubmission.correctionDetails.grammarScore !== undefined ? (
                        <>
                          {/* 5 Competencies View */}
                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">1. Gramática</span>
                              <span className="text-emerald-400 font-extrabold">{activeSubmission.correctionDetails.grammarScore}/20</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Rigor ortográfico, concordância, regência, crase e registro culto da língua.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-emerald-500 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.grammarScore / 20) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">2. Estrutura</span>
                              <span className="text-blue-400 font-extrabold">{activeSubmission.correctionDetails.structureScore}/20</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Paragrafação, introdução, desenvolvimento harmônico e tese bem delineada.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-blue-500 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.structureScore / 20) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">3. Conteúdo</span>
                              <span className="text-pink-400 font-extrabold">{activeSubmission.correctionDetails.contentScore}/20</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Fidelidade e pertinência ao tema, desenvolvimento completo das ideias.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-pink-500 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.contentScore / 20) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">4. Coesão</span>
                              <span className="text-purple-400 font-extrabold">{activeSubmission.correctionDetails.cohesionScore}/20</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Uso estratégico de conectivos inter/intraparágrafos, articulação lógica fluida.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-purple-500 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.cohesionScore / 20) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">5. Argumentação</span>
                              <span className="text-cyan-400 font-extrabold">{activeSubmission.correctionDetails.argumentationScore}/20</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Consistência argumentativa, repertório sociocultural e capacidade de persuasão.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-cyan-500 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.argumentationScore / 20) * 100}%` }}
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* 4 Criteria Fallback View */}
                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">1. Estrutura - Tópico 1</span>
                              <span className="text-slate-200">{activeSubmission.correctionDetails.themeAndStructureScore}/30</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Predominância dissertativo-argumentativa e articulação de ideias relacionadas ao tema.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-amber-400 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.themeAndStructureScore / 30) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">2. Estrutura - Tópico 2</span>
                              <span className="text-slate-200">{activeSubmission.correctionDetails.informativeArgumentativeScore}/30</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Fidelidade à questão, consistência e relevância argumentativa, progressão e senso crítico.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-amber-400 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.informativeArgumentativeScore / 30) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">3. Expressão - Tópico 1</span>
                              <span className="text-slate-200">{activeSubmission.correctionDetails.grammarFormalNormScore}/20</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Contribuição ideativa, adequação vocabular e fidelidade ao registro culto da língua.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-amber-400 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.grammarFormalNormScore / 20) * 100}%` }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-xs font-semibold mb-1">
                              <span className="text-slate-300">4. Expressão - Tópico 2</span>
                              <span className="text-slate-200">{activeSubmission.correctionDetails.cohesionCoherenceScore}/20</span>
                            </div>
                            <p className="text-[9px] text-slate-400 mb-1 leading-normal">
                              Conexão lógica, entrosamento das palavras e ideias de forma clara, coesa e concisa.
                            </p>
                            <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                              <div 
                                className="bg-amber-400 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${(activeSubmission.correctionDetails.cohesionCoherenceScore / 20) * 100}%` }}
                              />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl space-y-1.5 mt-4">
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider block">Tema Escolhido</span>
                <p className="text-xs text-slate-300 leading-normal font-medium">
                  {activeSubmission.theme}
                </p>
                <span className="text-[10px] text-slate-500 block pt-1 font-mono">
                  Enviado em: {new Date(activeSubmission.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>

            {/* Right Box: Detailed evaluations tabs */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl relative">
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                Análise do Tenente Corretor I.A.
              </h2>

              {activeSubmission.correctionDetails && (
                <div className="space-y-5">
                  {activeSubmission.correctionDetails.grammarScore !== undefined ? (
                    <>
                      {/* 5 Competencies Feedbacks */}
                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl border-l-4 border-l-emerald-500">
                        <span className="text-xs font-bold text-emerald-400 block mb-1">
                          1. GRAMÁTICA (Nota {activeSubmission.correctionDetails.grammarScore}/20)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "Rigor ortográfico, concordância verbal e nominal, regência, crase, pontuação, acentuação gráfica, colocação pronominal e fidelidade ao registro culto da língua portuguesa."
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.grammarFeedbackText || activeSubmission.correctionDetails.grammarFeedback}
                        </p>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl border-l-4 border-l-blue-500">
                        <span className="text-xs font-bold text-blue-400 block mb-1">
                          2. ESTRUTURA (Nota {activeSubmission.correctionDetails.structureScore}/20)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "Domínio da estrutura do texto dissertativo-argumentativo, paragrafação harmônica, introdução com tese explícita, desenvolvimentos bem delimitados e conclusão coerente."
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.structureFeedbackText || activeSubmission.correctionDetails.themeFeedback}
                        </p>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl border-l-4 border-l-pink-500">
                        <span className="text-xs font-bold text-pink-400 block mb-1">
                          3. CONTEÚDO (Nota {activeSubmission.correctionDetails.contentScore}/20)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "Fidelidade ao tema proposto, abordagem completa sem tangenciamento, consistência, relevância e articulação das ideias relacionadas ao assunto."
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.contentFeedbackText || activeSubmission.correctionDetails.themeFeedback}
                        </p>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl border-l-4 border-l-purple-500">
                        <span className="text-xs font-bold text-purple-400 block mb-1">
                          4. COESÃO (Nota {activeSubmission.correctionDetails.cohesionScore}/20)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "Mecanismos linguísticos de conexão (conjunções, pronomes, advérbios), repertório diversificado de conectivos interparágrafos e intraparágrafos sem repetições."
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.cohesionFeedbackText || activeSubmission.correctionDetails.cohesionFeedback}
                        </p>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl border-l-4 border-l-cyan-500">
                        <span className="text-xs font-bold text-cyan-400 block mb-1">
                          5. ARGUMENTAÇÃO (Nota {activeSubmission.correctionDetails.argumentationScore}/20)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "Consistência argumentativa, fundamentação por meio de repertório sociocultural produtivo, senso crítico, autoria e capacidade persuasiva."
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.argumentationFeedbackText || activeSubmission.correctionDetails.argumentationFeedback}
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* 4 Legacy Criteria Feedbacks */}
                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-amber-400 block mb-1">
                          1. ESTRUTURA: Abordagem Dissertativa-Argumentativa (Nota {activeSubmission.correctionDetails.themeAndStructureScore}/30)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "O conteúdo apresentado pelo(a) candidato(a) deve ser um texto predominantemente dissertativo-argumentativo, devendo constituir-se de um conjunto articulado de ideias relacionadas ao tema escolhido."
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.themeFeedback}
                        </p>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-amber-400 block mb-1">
                          2. ESTRUTURA: Análise e Consistência das Ideias (Nota {activeSubmission.correctionDetails.informativeArgumentativeScore}/30)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "Análise das ideias fundamentais do texto observando a fidelidade à questão; consistência e relevância argumentativa; progressão temática; e senso crítico do(a) candidato(a)."
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.argumentationFeedback}
                        </p>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-amber-400 block mb-1">
                          3. EXPRESSÃO: Contribuição Ideativa e Registro Culto (Nota {activeSubmission.correctionDetails.grammarFormalNormScore}/20)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "Atenção máxima à contribuição ideativa do(a) candidato(a), avaliando, ao mesmo tempo, a sua adequação vocabular à questão e a fidelidade ao registro culto da língua portuguesa."
                        </p>
                        <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.grammarFeedback}
                        </div>
                      </div>

                      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                        <span className="text-xs font-bold text-amber-400 block mb-1">
                          4. EXPRESSÃO: Conexão Lógica, Coesão e Concisão (Nota {activeSubmission.correctionDetails.cohesionCoherenceScore}/20)
                        </span>
                        <p className="text-[10px] text-slate-400 mb-2 leading-relaxed font-sans italic">
                          "As palavras devem ser bem colocadas e as ideias devem obedecer a uma determinada conexão lógica, promovendo assim um bom entrosamento das palavras e ideias de forma clara, coesa e concisa."
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {activeSubmission.correctionDetails.cohesionFeedback}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Side-by-Side Comparison Area */}
          {activeSubmission.correctionDetails && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="text-md font-black text-slate-100 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Comparação de Textos: Original vs. Modelo Exemplo
              </h3>
              <p className="text-slate-400 text-xs leading-relaxed max-w-3xl">
                À esquerda está o seu rascunho enviado. À direita está a versão modelo reescrita pelo Tenente Corretor, corrigindo todos os erros de concordância, ortografia, pontuação e elevando o vocabulário para torná-lo elegível ao padrão nota máxima da banca.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Original Text */}
                <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Seu Texto Original</span>
                      <button 
                        onClick={() => handleCopy(activeSubmission.essayText, "original")}
                        className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 transition cursor-pointer"
                        title="Copiar texto original"
                      >
                        {copiedText === "original" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-serif min-h-[250px]">
                      {activeSubmission.essayText}
                    </p>
                  </div>
                  <div className="border-t border-slate-850 mt-4 pt-3 text-[10px] text-slate-500 font-mono flex justify-between">
                    <span>Palavras: {activeSubmission.essayText.trim().split(/\s+/).length}</span>
                    <span>Caracteres: {activeSubmission.essayText.length}</span>
                  </div>
                </div>

                {/* Model Text */}
                <div className="bg-slate-950 border border-amber-400/20 rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-slate-950 via-slate-950 to-amber-400/5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-3">
                      <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        Reescrita Modelo (Exemplar Nota 100)
                      </span>
                      <button 
                        onClick={() => handleCopy(activeSubmission.correctionDetails?.rewrittenText || "", "rewritten")}
                        className="p-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                        title="Copiar texto modelo"
                      >
                        {copiedText === "rewritten" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap font-serif min-h-[250px]">
                      {activeSubmission.correctionDetails.rewrittenText}
                    </p>
                  </div>
                  <div className="border-t border-slate-850 mt-4 pt-3 text-[10px] text-slate-500 font-mono flex justify-between">
                    <span>Palavras: {activeSubmission.correctionDetails.rewrittenText.trim().split(/\s+/).length}</span>
                    <span>Caracteres: {activeSubmission.correctionDetails.rewrittenText.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Restart Button */}
          <div className="flex justify-center pt-4">
            <button
              onClick={handleReset}
              className="px-6 py-3 rounded-xl bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 cursor-pointer shadow-lg hover:brightness-110 uppercase tracking-wider transition"
            >
              <RefreshCw className="w-4 h-4 text-slate-950" />
              <span>Praticar com outro Tema</span>
            </button>
          </div>
        </div>
        )
      ) : (
        /* Submission Form / History Dashboard */
        <div className="space-y-6">
          {/* Progress Chart Dashboard - Displays only if student has completed submissions */}
          {submissions.filter(s => s.status === "corrected").length > 0 && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-850 pb-4">
                <div className="space-y-0.5">
                  <h2 className="text-md font-black text-slate-100 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    Sua Evolução na Redação PMBA
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Acompanhe o desenvolvimento da sua nota total e das 5 competências essenciais ao longo do tempo.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                  <span className="px-2.5 py-1 rounded-full bg-amber-400/10 border border-amber-400/20 text-amber-400 font-extrabold uppercase">Nota Total (0-100)</span>
                  <span className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-slate-400 font-extrabold uppercase">Competências (0-20)</span>
                </div>
              </div>

              <div className="h-64 sm:h-72 w-full pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getChartData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                    <XAxis dataKey="date" stroke="#64748B" fontSize={10} tickLine={false} />
                    <YAxis stroke="#64748B" fontSize={10} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const dataPoint = payload[0].payload;
                          return (
                            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 shadow-2xl space-y-1.5 text-xs">
                              <p className="font-extrabold text-amber-400 text-[10px] uppercase tracking-wider">{dataPoint.name} ({dataPoint.date})</p>
                              <div className="border-t border-slate-850 pt-1.5 space-y-1">
                                <p className="flex justify-between gap-6">
                                  <span className="text-slate-400">Nota Total:</span>
                                  <span className="font-black text-amber-400 font-mono">{dataPoint["Nota Total"]}/100</span>
                                </p>
                                <p className="flex justify-between gap-6 text-[11px]">
                                  <span className="text-slate-400">Gramática:</span>
                                  <span className="font-bold text-emerald-400 font-mono">{dataPoint.rawGrammar}/20</span>
                                </p>
                                <p className="flex justify-between gap-6 text-[11px]">
                                  <span className="text-slate-400">Estrutura:</span>
                                  <span className="font-bold text-blue-400 font-mono">{dataPoint.rawStructure}/20</span>
                                </p>
                                <p className="flex justify-between gap-6 text-[11px]">
                                  <span className="text-slate-400">Conteúdo:</span>
                                  <span className="font-bold text-pink-400 font-mono">{dataPoint.rawContent}/20</span>
                                </p>
                                <p className="flex justify-between gap-6 text-[11px]">
                                  <span className="text-slate-400">Coesão:</span>
                                  <span className="font-bold text-purple-400 font-mono">{dataPoint.rawCohesion}/20</span>
                                </p>
                                <p className="flex justify-between gap-6 text-[11px]">
                                  <span className="text-slate-400">Argumentação:</span>
                                  <span className="font-bold text-cyan-400 font-mono">{dataPoint.rawArgumentation}/20</span>
                                </p>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend 
                      verticalAlign="top" 
                      height={36} 
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, color: "#94A3B8" }}
                    />
                    {/* Overall Score Line */}
                    <Line 
                      type="monotone" 
                      dataKey="Nota Total" 
                      stroke="#F59E0B" 
                      strokeWidth={3} 
                      activeDot={{ r: 6 }} 
                      dot={{ r: 4 }}
                    />
                    {/* 5 Competency Lines scaled to 100 for proper visual mapping */}
                    <Line type="monotone" dataKey="Gramática" stroke="#10B981" strokeWidth={1.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Estrutura" stroke="#3B82F6" strokeWidth={1.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Conteúdo" stroke="#EC4899" strokeWidth={1.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Coesão" stroke="#8B5CF6" strokeWidth={1.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="Argumentação" stroke="#06B6D4" strokeWidth={1.5} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Form to request correction */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl relative">
            <h2 className="text-lg font-black text-slate-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-amber-400" />
              Enviar nova Redação para Correção
            </h2>

            {correcting ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <RefreshCw className="w-12 h-12 text-amber-400 animate-spin" />
                <div className="text-center">
                  <h3 className="text-md font-bold text-slate-200">Tenente Corretor está corrigindo sua folha...</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    Aguarde, estamos avaliando sua estrutura gramatical, conectivos, argumentos e gerando a sua reescrita de referência de acordo com a banca oficial da PMBA. Isso leva até 15 segundos...
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                 {/* Theme Selector */}
                 <div className="space-y-1.5">
                   <div className="flex justify-between items-center">
                     <label className="text-slate-400 text-[10px] uppercase font-bold block">1. Tema da Redação</label>
                     {loadingThemes && <span className="text-[9px] font-mono text-amber-400 animate-pulse">Carregando temas...</span>}
                   </div>
                   <select
                     value={selectedTheme}
                     onChange={(e) => setSelectedTheme(e.target.value)}
                     className="w-full bg-slate-950 border border-slate-850 text-slate-100 text-xs font-semibold px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400/50"
                   >
                     {allAvailableThemes.map((t) => (
                       <option key={t} value={t}>{t}</option>
                     ))}
                   </select>
                 </div>

                 {/* Motivating Text Box */}
                 {motivatingTextToShow && (
                   <div className="bg-slate-950 border border-slate-850 rounded-2xl p-4 space-y-2 animate-fade-in">
                     <button
                       type="button"
                       onClick={() => setShowMotivatingText(!showMotivatingText)}
                       className="w-full flex items-center justify-between text-slate-400 hover:text-slate-200 transition cursor-pointer text-left focus:outline-none"
                     >
                       <div className="flex items-center gap-2">
                         <BookOpen className="w-4 h-4 text-amber-400" />
                         <span className="text-[10px] uppercase font-black tracking-wider">Texto Motivador do Tema</span>
                       </div>
                       <div className="text-[10px] text-amber-400 font-bold flex items-center gap-1 uppercase">
                         {showMotivatingText ? (
                           <>
                             <EyeOff className="w-3.5 h-3.5" /> Ocultar
                           </>
                         ) : (
                           <>
                             <Eye className="w-3.5 h-3.5" /> Visualizar
                           </>
                         )}
                       </div>
                     </button>
                     {showMotivatingText && (
                       <div className="border-t border-slate-850/60 pt-3 text-[11px] text-slate-300 leading-relaxed whitespace-pre-wrap font-sans max-h-48 overflow-y-auto pr-1">
                         {motivatingTextToShow}
                       </div>
                     )}
                   </div>
                 )}


                {selectedTheme.startsWith("Outro Tema") && (
                  <div className="space-y-1.5 animate-fade-in">
                    <label className="text-slate-400 text-[10px] uppercase font-bold block">Digite o Tema Personalizado</label>
                    <input
                      type="text"
                      value={customTheme}
                      onChange={(e) => setCustomTheme(e.target.value)}
                      placeholder="Ex: A importância da atuação integrada das polícias no Nordeste..."
                      className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs px-4 py-3 rounded-xl focus:outline-none focus:border-amber-400/50"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-slate-400 text-[10px] uppercase font-bold">2. Texto da Redação (Padrão Dissertativo PMBA)</label>
                    <span className="text-[10px] font-mono text-slate-500">
                      {essayText.trim() === "" ? 0 : essayText.trim().split(/\s+/).length} Palavras / {essayText.length} Caracteres
                    </span>
                  </div>
                  <textarea
                    value={essayText}
                    onChange={(e) => setEssayText(e.target.value)}
                    placeholder="Cole ou digite seu texto aqui. Lembre-se de estruturar em parágrafos de introdução, desenvolvimento 1, desenvolvimento 2 e conclusão (entre 20 e 30 linhas)."
                    rows={14}
                    className="w-full bg-slate-950 border border-slate-850 text-slate-200 text-xs font-serif p-4 rounded-xl focus:outline-none focus:border-amber-400/50 leading-relaxed resize-none"
                  />

                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex items-start gap-2 text-slate-400 text-[11px] leading-relaxed">
                    <HelpCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      Para uma nota máxima de concurso: procure escrever entre 200 e 500 palavras, divida suas ideias claramente em 4 parágrafos utilizando conjunções de transição coerentes (ex: nesse sentido, ademais, outrossim, portanto, consoante) e evite rasuras e desvios de concordância.
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleRequestCorrection}
                      disabled={essayText.length < 100}
                      className={`w-full py-4 px-6 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition uppercase tracking-widest ${
                        essayText.length >= 100
                          ? "bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 cursor-pointer shadow-xl scale-[1.01] hover:scale-[1.02]"
                          : "bg-slate-950 border border-slate-850 text-slate-500 cursor-not-allowed"
                      }`}
                      title="Obter feedback e nota instantânea pela Inteligência Artificial"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950 animate-pulse" />
                      <span>Analisar e Corrigir Redação Instantaneamente</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Submission History */}
          <div className="lg:col-span-1 bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl relative flex flex-col justify-between">
            <div className="space-y-4">
              <h2 className="text-lg font-black text-slate-100 flex items-center gap-2 border-b border-slate-850 pb-3">
                <History className="w-5 h-5 text-slate-400" />
                Histórico de Envio
              </h2>

              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-2">
                  <RefreshCw className="w-6 h-6 text-slate-500 animate-spin" />
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Carregando histórico...</span>
                </div>
              ) : submissions.length === 0 ? (
                <div className="text-center py-16 px-4 bg-slate-950 border border-slate-850 rounded-2xl">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <span className="text-xs font-bold text-slate-400 block uppercase">Nenhuma Redação Enviada</span>
                  <p className="text-[10px] text-slate-500 leading-normal max-w-xs mx-auto mt-1">
                    Suas redações corrigidas ficarão armazenadas de forma definitiva na nuvem para que possa acompanhar seu progresso de escrita.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                  {submissions.map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => {
                        setActiveSubmission(sub);
                        setIsViewingHistoryDetails(true);
                      }}
                      className="w-full text-left bg-slate-950 hover:bg-slate-850 border border-slate-850 p-4 rounded-2xl transition cursor-pointer flex justify-between items-center group relative overflow-hidden"
                    >
                      <div className="space-y-1 pr-2 flex-1">
                        <span className="text-[9px] font-black text-slate-500 uppercase font-mono block">
                          {new Date(sub.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} às {new Date(sub.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <p className="text-xs font-bold text-slate-200 line-clamp-1 group-hover:text-amber-400 transition-colors">
                          {sub.theme}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono block">
                          {sub.essayText.trim().split(/\s+/).length} palavras
                        </span>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {sub.status === "pending" ? (
                          <span className="text-[9px] font-extrabold uppercase px-2 py-1 rounded bg-amber-500/10 border border-amber-500/25 text-amber-400 animate-pulse">
                            Pendente
                          </span>
                        ) : (
                          <span className={`text-lg font-black font-mono ${
                            (sub.score || 0) >= 80 
                              ? "text-emerald-400" 
                              : (sub.score || 0) >= 60 
                              ? "text-amber-400" 
                              : "text-rose-400"
                          }`}>
                            {sub.score || 0}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400 transition" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Support Message or Callout */}
            <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl text-[10px] text-slate-500 leading-normal space-y-1.5 mt-6">
              <span className="text-[9px] font-black uppercase text-amber-400/80 block">Regra PMBA (IBFC)</span>
              <p>
                A redação da PMBA é de caráter eliminatório e classificatório. Os alunos habilitados na prova objetiva que não alcançarem nota igual ou superior a 60 pontos na prova discursiva serão eliminados do concurso público. Pratique semanalmente!
              </p>
            </div>
          </div>

        </div>
        </div>
      )}
    </div>
  );
}
