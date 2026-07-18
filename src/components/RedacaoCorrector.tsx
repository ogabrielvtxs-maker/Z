import React, { useState, useEffect } from "react";
import { 
  FileText, Upload, Sparkles, RefreshCw, Award, 
  CheckCircle, AlertCircle, History, BookOpen, ChevronRight, 
  ArrowLeft, Check, Copy, Printer, ExternalLink, HelpCircle, Eye, EyeOff, Send
} from "lucide-react";
import { User, EssaySubmission, EssayTheme } from "../types";
import { saveEssaySubmissionToFirestore, fetchEssaySubmissionsForStudent, fetchEssayThemesFromFirestore } from "../lib/firebase";
import { callAIOcr, callAICorrectEssay } from "../utils/aiService";

interface RedacaoProps {
  currentUser: User;
}

const THEMES_PRESETS = [
  "O papel da segurança pública na preservação dos direitos fundamentais no Brasil.",
  "O avanço tecnológico e a inteligência artificial no combate ao crime organizado.",
  "Saúde mental na atividade policial militar: desafios e caminhos para a valorização profissional.",
  "Violência doméstica no século XXI: desafios legislativos e a eficácia das medidas protetivas.",
  "A importância do policiamento comunitário no fortalecimento do elo social na Bahia.",
  "Mobilidade urbana e segurança de trânsito: dever do Estado e responsabilidade de todos.",
  "Outro Tema (Digitar tema personalizado...)"
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
    ...THEMES_PRESETS
  ];

  // Find selected theme's motivating text
  const currentSelectedThemeObj = dbThemes.find(t => t.title === selectedTheme);
  const motivatingTextToShow = currentSelectedThemeObj?.motivatingText || null;

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
        setSelectedTheme(THEMES_PRESETS[0]);
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
        correctionFeedback: `## Avaliação do Tenente Corretor\n\nSua nota final foi **${data.overallScore}/100**.\n\n### Detalhamento dos Critérios:\n1. **Tema e Texto Dissertativo-Argumentativo:** ${data.themeAndStructureScore}/20\n2. **Coesão e Coerência:** ${data.cohesionCoherenceScore}/25\n3. **Informatividade e Argumentação:** ${data.informativeArgumentativeScore}/25\n4. **Norma Culta / Gramática:** ${data.grammarFormalNormScore}/30`,
        correctionDetails: {
          themeAndStructureScore: data.themeAndStructureScore,
          cohesionCoherenceScore: data.cohesionCoherenceScore,
          informativeArgumentativeScore: data.informativeArgumentativeScore,
          grammarFormalNormScore: data.grammarFormalNormScore,
          overallScore: data.overallScore,
          themeFeedback: data.themeFeedback,
          cohesionFeedback: data.cohesionFeedback,
          argumentationFeedback: data.argumentationFeedback,
          grammarFeedback: data.grammarFeedback,
          rewrittenText: data.rewrittenText
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

  // Submit essay directly to the coordinator (status: pending)
  const handleSendToCoordinator = async () => {
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
      const newSubmission: EssaySubmission = {
        id: `essay_${Date.now()}_${currentUser.id}`,
        studentId: currentUser.id,
        studentName: currentUser.name,
        studentEmail: currentUser.email,
        theme: finalTheme,
        submissionType: "typed",
        essayText: essayText,
        createdAt: new Date().toISOString(),
        status: "pending"
      };

      await saveEssaySubmissionToFirestore(newSubmission);
      
      // Update local states
      setSubmissions((prev) => [newSubmission, ...prev]);
      alert("Redação enviada com sucesso para a coordenação! Seus professores irão analisar seu texto e lançar a nota oficial. Você poderá ver o resultado aqui no seu Histórico.");
      
      // Reset inputs
      setEssayText("");
    } catch (error: any) {
      alert("Erro ao enviar redação para a coordenação: " + error.message);
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
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-slate-300">1. Tema e Estrutura</span>
                          <span className="text-slate-200">{activeSubmission.correctionDetails.themeAndStructureScore}/20</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div 
                            className="bg-amber-400 h-full rounded-full transition-all duration-1000" 
                            style={{ width: `${(activeSubmission.correctionDetails.themeAndStructureScore / 20) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-slate-300">2. Coesão e Coerência</span>
                          <span className="text-slate-200">{activeSubmission.correctionDetails.cohesionCoherenceScore}/25</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div 
                            className="bg-amber-400 h-full rounded-full transition-all duration-1000" 
                            style={{ width: `${(activeSubmission.correctionDetails.cohesionCoherenceScore / 25) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-slate-300">3. Argumentação e Profundidade</span>
                          <span className="text-slate-200">{activeSubmission.correctionDetails.informativeArgumentativeScore}/25</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div 
                            className="bg-amber-400 h-full rounded-full transition-all duration-1000" 
                            style={{ width: `${(activeSubmission.correctionDetails.informativeArgumentativeScore / 25) * 100}%` }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className="text-slate-300">4. Norma Culta e Gramática</span>
                          <span className="text-slate-200">{activeSubmission.correctionDetails.grammarFormalNormScore}/30</span>
                        </div>
                        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div 
                            className="bg-amber-400 h-full rounded-full transition-all duration-1000" 
                            style={{ width: `${(activeSubmission.correctionDetails.grammarFormalNormScore / 30) * 100}%` }}
                          />
                        </div>
                      </div>
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
                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                    <span className="text-xs font-bold text-amber-400 block mb-1">Adequação ao Tema e Estrutura (Nota {activeSubmission.correctionDetails.themeAndStructureScore}/20)</span>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {activeSubmission.correctionDetails.themeFeedback}
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                    <span className="text-xs font-bold text-amber-400 block mb-1">Coesão e Coerência (Nota {activeSubmission.correctionDetails.cohesionCoherenceScore}/25)</span>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {activeSubmission.correctionDetails.cohesionFeedback}
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl">
                    <span className="text-xs font-bold text-amber-400 block mb-1">Informatividade e Argumentação (Nota {activeSubmission.correctionDetails.informativeArgumentativeScore}/25)</span>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {activeSubmission.correctionDetails.argumentationFeedback}
                    </p>
                  </div>

                  <div className="bg-slate-950 border border-emerald-500/10 p-4 rounded-2xl bg-emerald-950/5">
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-1">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      Erros Gramaticais Encontrados (Desvios na Norma Culta: Nota {activeSubmission.correctionDetails.grammarFormalNormScore}/30)
                    </span>
                    <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap pl-5 pt-1">
                      {activeSubmission.correctionDetails.grammarFeedback}
                    </div>
                  </div>
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleRequestCorrection}
                      disabled={essayText.length < 100}
                      className={`py-3.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition uppercase tracking-wider ${
                        essayText.length >= 100
                          ? "bg-slate-950 border border-amber-400/40 text-amber-400 hover:bg-slate-900 cursor-pointer shadow-lg"
                          : "bg-slate-950 border border-slate-850 text-slate-500 cursor-not-allowed"
                      }`}
                      title="Obter feedback e nota instantânea pela Inteligência Artificial"
                    >
                      <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                      <span>Correção Instantânea I.A.</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSendToCoordinator}
                      disabled={essayText.length < 100}
                      className={`py-3.5 px-4 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition uppercase tracking-wider ${
                        essayText.length >= 100
                          ? "bg-amber-400 text-slate-950 cursor-pointer shadow-lg hover:brightness-110"
                          : "bg-slate-950 border border-slate-850 text-slate-500 cursor-not-allowed"
                      }`}
                      title="Enviar texto para avaliação oficial por professores humanos"
                    >
                      <Send className="w-4 h-4 text-slate-950" />
                      <span>Enviar p/ Coordenação</span>
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
      )}
    </div>
  );
}
