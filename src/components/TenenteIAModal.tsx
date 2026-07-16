import React, { useState, useEffect, useRef } from "react";
import { User, ContentItem } from "../types";
import { 
  Sparkles, 
  X, 
  HelpCircle, 
  BookOpen, 
  FileText, 
  Target, 
  Loader2, 
  Copy, 
  Check, 
  Save, 
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Volume2,
  Square,
  Play,
  Pause,
  Camera,
  FileDown,
  Layers,
  Send,
  RefreshCw
} from "lucide-react";
import { saveContentItemToFirestore } from "../lib/firebase";
import { cleanAiOutputText } from "../lib/textCleanup";

interface TenenteIAModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicTitle: string;
  subjectTitle: string;
  currentUser: User;
}

const MOTIVATIONAL_PHRASES = [
  "Estudante que se prepara com método e constância alcança a aprovação passo a passo!",
  "Analisando a jurisprudência e a doutrina recomendada para a banca PMBA...",
  "O estudo diário e consistente constrói a base sólida para o dia da prova!",
  "Elaborando mnemônicos didáticos e esquemas para fixação profunda do conteúdo...",
  "Estruturando 20 questões detalhadas com gabarito comentado passo a passo...",
  "Estudando com planejamento estratégico para garantir o seu sucesso profissional!"
];

export default function TenenteIAModal({ isOpen, onClose, topicTitle, subjectTitle, currentUser }: TenenteIAModalProps) {
  const [loading, setLoading] = useState<boolean>(false);
  const [currentPhrase, setCurrentPhrase] = useState<string>(MOTIVATIONAL_PHRASES[0]);
  const [responseText, setResponseText] = useState<string>("");
  const [contextText, setContextText] = useState<string>("");
  const [copied, setCopied] = useState<boolean>(false);
  const [savedToLibrary, setSavedToLibrary] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");

  // States for new interactive capabilities
  const [currentAction, setCurrentAction] = useState<string>("");
  const [flashcards, setFlashcards] = useState<{ front: string; back: string }[]>([]);
  const [currentFlashcardIndex, setCurrentFlashcardIndex] = useState<number>(0);
  const [showAnswer, setShowAnswer] = useState<boolean>(false);
  const [flashcardViewMode, setFlashcardViewMode] = useState<"interactive" | "text">("interactive");

  // OCR upload state
  const [ocrLoading, setOcrLoading] = useState<boolean>(false);

  // Audio Narration (TTS) states
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState<boolean>(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Clear speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  if (!isOpen) return null;

  const triggerAIAction = async (action: "explain" | "summarize" | "questions" | "flashcards" | "ask_doubt") => {
    setLoading(true);
    setCurrentAction(action);
    setErrorMsg("");
    setSavedToLibrary(false);
    setCopied(false);
    handleStopSpeech();
    setFlashcards([]);

    // Rotate phrases randomly during generation
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * MOTIVATIONAL_PHRASES.length);
      setCurrentPhrase(MOTIVATIONAL_PHRASES[idx]);
    }, 4500);

    try {
      const res = await fetch("/api/ai/action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          topic: topicTitle,
          subject: subjectTitle,
          contextText: contextText.trim() || undefined
        })
      });

      const data = await res.json();
      clearInterval(interval);

      if (res.ok && data.text) {
        setResponseText(data.text);
        if (action === "flashcards") {
          const cards: { front: string; back: string }[] = [];
          const sections = data.text.split("---");
          sections.forEach((sec: string) => {
            const trimmed = sec.trim();
            if (!trimmed) return;
            
            let front = "";
            let back = "";
            
            const frontMatch = trimmed.match(/Frente:\s*([\s\S]*?)(?=Verso:|$)/i);
            const backMatch = trimmed.match(/Verso:\s*([\s\S]*?)$/i);
            
            if (frontMatch && frontMatch[1]) {
              front = frontMatch[1].trim();
            }
            if (backMatch && backMatch[1]) {
              back = backMatch[1].trim();
            }
            
            if (front && back) {
              cards.push({ front, back });
            }
          });
          setFlashcards(cards);
          setCurrentFlashcardIndex(0);
          setShowAnswer(false);
          setFlashcardViewMode("interactive");
        }
      } else {
        setErrorMsg(data.error || "Ocorreu um erro inesperado ao se conectar com o Tenente IA.");
      }
    } catch (err: any) {
      clearInterval(interval);
      setErrorMsg("Não foi possível conectar ao servidor da Inteligência Artificial. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(responseText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveToSharedLibrary = async () => {
    if (!responseText) return;
    setSavedToLibrary(true);

    const newItem: ContentItem = {
      id: "ai_material_" + Date.now(),
      title: `[Tenente IA] ${topicTitle}`,
      subtitle: `Resumo / Explicação gerada por IA para ${subjectTitle}.`,
      type: "pdf", // categorized as material/reading
      url: "", // local document representation
      category: currentUser.accessCFO && !currentUser.accessSoldado ? "cfo" : currentUser.accessSoldado && !currentUser.accessCFO ? "soldado" : "both",
      createdAt: new Date().toISOString(),
      topic: subjectTitle,
      subtopic: topicTitle,
      contentMarkdown: responseText // rich content injected
    };

    try {
      const saved = localStorage.getItem("shared_content");
      let currentItems: ContentItem[] = [];
      if (saved) {
        currentItems = JSON.parse(saved);
      }
      const updated = [newItem, ...currentItems];
      localStorage.setItem("shared_content", JSON.stringify(updated));

      // Push to Firestore as well for shared database backup
      await saveContentItemToFirestore(newItem);
      alert("Material adicionado com sucesso à sua Biblioteca de Estudos!");
    } catch (e) {
      console.error(e);
    }
  };

  // --- OCR IMAGE UPLOAD SCANNER ---
  const handleOCRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setErrorMsg("");

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      try {
        const response = await fetch("/api/ai/ocr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            image: base64String,
            mimeType: file.type
          })
        });

        const data = await response.json();
        if (response.ok && data.text) {
          setContextText((prev) => {
            const added = data.text;
            return prev ? `${prev}\n\n[Texto Escaneado por OCR]:\n${added}` : added;
          });
          alert("OCR Concluído! O texto da imagem foi extraído e anexado abaixo com sucesso.");
        } else {
          alert(data.error || "Erro ao processar imagem para extração de texto.");
        }
      } catch (err) {
        console.error(err);
        alert("Erro de conexão ao enviar imagem para análise de OCR.");
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- AUDIO NARRATION (NATIVE TTS / SPEECH SYNTHESIS) ---
  const handleSpeak = () => {
    if (!responseText) return;

    if (window.speechSynthesis) {
      if (isSpeechPaused) {
        window.speechSynthesis.resume();
        setIsSpeechPaused(false);
        setIsSpeaking(true);
        return;
      }

      window.speechSynthesis.cancel(); // Stop any pending reading

      // Clean markdown tags for natural speech
      const textToSpeak = responseText
        .replace(/[*#|]/g, " ")
        .replace(/- /g, " ")
        .substring(0, 4000); // safety length boundary for speech synthesizers

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = "pt-BR";

      // Select high quality Portuguese voice if available
      const voices = window.speechSynthesis.getVoices();
      const ptVoice = voices.find(v => v.lang.startsWith("pt-BR") || v.lang.startsWith("pt"));
      if (ptVoice) {
        utterance.voice = ptVoice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsSpeechPaused(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsSpeechPaused(false);
      };

      utteranceRef.current = utterance;
      setIsSpeaking(true);
      setIsSpeechPaused(false);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("A ferramenta de voz não é suportada neste navegador.");
    }
  };

  const handlePauseSpeech = () => {
    if (window.speechSynthesis && isSpeaking) {
      window.speechSynthesis.pause();
      setIsSpeechPaused(true);
      setIsSpeaking(false);
    }
  };

  const handleStopSpeech = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsSpeechPaused(false);
    }
  };

  // --- PDF EXPORT ENGINE ---
  const handleExportPDF = () => {
    if (!responseText) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Por favor, ative a permissão de popups em seu navegador para exportar o PDF!");
      return;
    }

    const printContent = `
      <html>
        <head>
          <title>[Tenente IA] ${topicTitle} - PDF</title>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=JetBrains+Mono&display=swap" rel="stylesheet">
          <script src="https://cdn.tailwindcss.com"></script>
          <script>
            tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    sans: ['Inter', 'sans-serif'],
                    mono: ['JetBrains Mono', 'monospace'],
                  }
                }
              }
            }
          </script>
          <style>
            @media print {
              body {
                background: white !important;
                color: black !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print { display: none !important; }
              .page-break { page-break-before: always; }
              
              /* Bottom watermark on every printed page */
              body::after {
                content: "Material de Estudo de Elite - Aluno ${currentUser.name} • @alof.emacao";
                position: fixed;
                bottom: 12px;
                left: 0;
                right: 0;
                text-align: center;
                font-size: 8px;
                color: rgba(15, 23, 42, 0.35) !important;
                font-family: monospace;
                font-weight: bold;
              }
            }
            body {
              font-family: 'Inter', sans-serif;
              background-color: #ffffff;
              color: #1e293b;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 1.5rem 0;
            }
            th {
              background-color: #0f172a !important;
              color: #fbbf24 !important;
              font-weight: bold;
              text-transform: uppercase;
              font-size: 11px;
              padding: 10px;
              border: 1px solid #334155;
            }
            td {
              padding: 10px;
              border: 1px solid #cbd5e1;
              font-size: 11px;
              line-height: 1.6;
            }
            tr:nth-child(even) {
              background-color: #f8fafc;
            }
            h1, h2, h3, h4 {
              text-transform: uppercase;
              font-weight: 800;
              letter-spacing: 0.05em;
            }
            h2 {
              font-size: 1.25rem;
              color: #0f172a;
              border-bottom: 2px solid #fbbf24;
              padding-bottom: 0.25rem;
              margin-top: 2rem;
              margin-bottom: 1rem;
            }
            h3 {
              font-size: 1rem;
              color: #1e293b;
              margin-top: 1.5rem;
              margin-bottom: 0.75rem;
            }
            h4 {
              font-size: 0.875rem;
              color: #475569;
              margin-top: 1rem;
              margin-bottom: 0.5rem;
            }
            li {
              margin-bottom: 0.5rem;
              font-size: 12px;
            }
            p {
              margin-bottom: 0.75rem;
              font-size: 12px;
              line-height: 1.7;
            }
            strong {
              color: #b45309;
              font-weight: 850;
            }
            
            /* Suttle diagonal background watermark */
            .watermark-overlay {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-32deg);
              font-size: 4.5rem;
              color: rgba(15, 23, 42, 0.045);
              font-weight: 900;
              pointer-events: none;
              white-space: nowrap;
              z-index: 9999;
              text-transform: uppercase;
              letter-spacing: 0.2em;
              font-family: 'Inter', sans-serif;
            }
          </style>
        </head>
        <body class="p-8 max-w-4xl mx-auto bg-white relative">
          <!-- Subtle Watermark -->
          <div class="watermark-overlay">@alof.emacao</div>

          <div class="flex items-center justify-between border-b-4 border-amber-500 pb-4 mb-6">
            <div>
              <span class="text-[10px] font-bold text-amber-600 uppercase tracking-widest font-mono">Plataforma de Estudos PMBA</span>
              <h1 class="text-xl font-black text-slate-900 tracking-tight">RELATÓRIO DE INSTRUÇÃO DE ELITE</h1>
              <span class="text-xs text-slate-500 font-mono">Gerado em: ${new Date().toLocaleDateString("pt-BR")} | Coordenador: Tenente IA</span>
            </div>
            <div class="text-right">
              <span class="text-[9px] bg-slate-900 text-amber-400 font-mono font-bold px-2.5 py-1.5 rounded uppercase border border-slate-800">
                Aprovação CFO / Soldado
              </span>
            </div>
          </div>

          <div class="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 flex flex-wrap gap-x-6 gap-y-2 text-xs">
            <div><span class="text-slate-400 font-bold uppercase font-mono">Disciplina:</span> <span class="font-extrabold text-slate-800 uppercase">${subjectTitle}</span></div>
            <div><span class="text-slate-400 font-bold uppercase font-mono">Assunto:</span> <span class="font-bold text-slate-700">${topicTitle}</span></div>
            <div><span class="text-slate-400 font-bold uppercase font-mono">Aluno:</span> <span class="font-bold text-slate-700">${currentUser.name} (${currentUser.email})</span></div>
          </div>

          <div class="prose max-w-none text-slate-800">
            ${formatMarkdownToHTML(responseText)}
          </div>

          <div class="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 font-mono no-print">
            Este material foi produzido sob demanda personalizada para fins de estudo privado. Proibida cópia ou venda ilegal.
          </div>

          <div class="fixed bottom-6 right-6 no-print">
            <button onclick="window.print()" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition">
              Imprimir / Salvar PDF
            </button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 1000);
  };

  const formatMarkdownToHTML = (text: string) => {
    // Call the AI cleanup helper to strip weird BR and stray asterisk tags
    let html = cleanAiOutputText(text);

    // Convert headings
    html = html.replace(/^### (.*?)$/gm, "<h4>$1</h4>");
    html = html.replace(/^## (.*?)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.*?)$/gm, "<h1>$1</h1>");

    // Convert bullet lists
    html = html.replace(/^[-*] (.*?)$/gm, "<li>$1</li>");

    // Convert bold blocks
    html = html.replace(/\*\*([\s\S]*?)\*\*/g, "<strong>$1</strong>");

    // Convert single asterisk italic blocks
    html = html.replace(/\*([\s\S]*?)\*/g, "<em>$1</em>");

    const lines = html.split("\n");
    let inTable = false;
    let tableHTML = "";
    
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("|")) {
        const cells = trimmed.split("|").slice(1, -1);
        if (!inTable) {
          inTable = true;
          tableHTML = "<table><thead><tr>";
          cells.forEach(cell => {
            tableHTML += `<th>${cell.trim()}</th>`;
          });
          tableHTML += "</tr></thead><tbody>";
          return "";
        } else {
          if (cells.every(cell => cell.trim().match(/^[:-]*$/))) {
            return "";
          }
          tableHTML += "<tr>";
          cells.forEach(cell => {
            tableHTML += `<td>${cell.trim()}</td>`;
          });
          tableHTML += "</tr>";
          return "";
        }
      } else {
        if (inTable) {
          inTable = false;
          const finished = tableHTML + "</tbody></table>";
          tableHTML = "";
          return finished + "<p>" + trimmed + "</p>";
        }
      }
      if (trimmed === "") return "<br/>";
      if (trimmed.startsWith("<h") || trimmed.startsWith("<li")) return trimmed;
      return "<p>" + trimmed + "</p>";
    });

    return processedLines.join("\n");
  };

  // --- RICH MARKDOWN TABLE PARSER ---
  const renderRichMarkdown = (rawText: string) => {
    if (!rawText) return null;

    // Call the AI cleanup helper to strip weird BR and stray asterisk tags
    const cleanedText = cleanAiOutputText(rawText);

    const lines = cleanedText.split("\n");
    const elements: React.ReactNode[] = [];
    
    let inTable = false;
    let tableRows: string[][] = [];
    
    let inList = false;
    let listItems: React.ReactNode[] = [];

    const flushList = (key: string | number) => {
      if (inList && listItems.length > 0) {
        elements.push(
          <ul key={`list-${key}`} className="list-disc pl-5 my-2 space-y-1">
            {listItems}
          </ul>
        );
        listItems = [];
        inList = false;
      }
    };

    const flushTable = (key: string | number) => {
      if (inTable && tableRows.length > 0) {
        const cleanRows = tableRows.filter(row => {
          return !row.every(cell => cell.trim().match(/^[:-|-]*$/));
        });

        if (cleanRows.length > 0) {
          const headers = cleanRows[0];
          const bodyRows = cleanRows.slice(1);

          elements.push(
            <div key={`table-container-${key}`} className="overflow-x-auto my-4 border border-slate-800 rounded-2xl bg-slate-950/40">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-amber-400 font-bold uppercase">
                    {headers.map((cell, cIdx) => (
                      <th key={cIdx} className="p-3 font-extrabold uppercase tracking-wider">{cell.trim()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-900/30 transition-colors">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-3 text-slate-300 whitespace-pre-wrap leading-relaxed">{parseBoldText(cell.trim())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        tableRows = [];
        inTable = false;
      }
    };

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("|")) {
        flushList(idx);
        const cells = line.split("|").slice(1, -1);
        if (cells.length > 0) {
          tableRows.push(cells);
          inTable = true;
        }
        return;
      }

      if (inTable) {
        flushTable(idx);
      }

      if (trimmed.startsWith("###")) {
        flushList(idx);
        elements.push(
          <h4 key={idx} className="text-sm font-bold text-amber-400 mt-4 mb-2 uppercase tracking-wide">
            {trimmed.replace("###", "").trim()}
          </h4>
        );
        return;
      }
      if (trimmed.startsWith("##")) {
        flushList(idx);
        elements.push(
          <h3 key={idx} className="text-base font-black text-amber-300 border-b border-slate-800 pb-1 mt-5 mb-2.5 uppercase">
            {trimmed.replace("##", "").trim()}
          </h3>
        );
        return;
      }
      if (trimmed.startsWith("#")) {
        flushList(idx);
        elements.push(
          <h2 key={idx} className="text-lg font-black text-white mt-6 mb-3 uppercase tracking-wider">
            {trimmed.replace("#", "").trim()}
          </h2>
        );
        return;
      }

      if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
        const text = trimmed.substring(1).trim();
        if (text !== "" && !text.match(/^[-\*]*$/)) {
          listItems.push(
            <li key={`li-${idx}`} className="text-xs text-slate-300 mb-1 leading-relaxed">
              {parseBoldText(text)}
            </li>
          );
          inList = true;
          return;
        }
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
    flushTable("final");

    return elements;
  };

  const parseBoldText = (text: string) => {
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-amber-300 font-extrabold">{part}</strong>;
      }
      return part;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="bg-slate-950 px-6 py-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-400 rounded-lg text-slate-950 animate-pulse">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[9px] text-amber-400 font-black uppercase tracking-wider block">Área de Aprendizado</span>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Mentor de Estudos IA • Auxiliar Didático</h3>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Title Card */}
          <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Matéria / Disciplina</span>
              <span className="text-xs font-black text-amber-400 uppercase tracking-wide">{subjectTitle}</span>
              <span className="text-xs text-slate-500 mx-2 hidden sm:inline">|</span>
              <span className="text-[9px] text-slate-400 font-bold uppercase block sm:inline">Assunto: </span>
              <span className="text-xs font-bold text-slate-200 block sm:inline">{topicTitle}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 rounded-full uppercase">
                Aprovação Garantida
              </span>
            </div>
          </div>

          {/* Prompt options block */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            
            {/* Input query bar */}
            <div className="md:col-span-12">
              <label className="block text-xs font-black text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
                Dúvida Específica ou Questão para Analisar (Opcional)
              </label>
              <textarea
                value={contextText}
                onChange={(e) => setContextText(e.target.value)}
                placeholder="Ex: Cole aqui uma questão sobre este assunto que você errou, ou digite uma dúvida conceitual específica para o Mentor de Estudos IA desmistificar e ensinar passo a passo..."
                rows={3}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 resize-none"
              />
              
              {/* OCR Image Scanner & Enviar Dúvida Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer">
                    <Camera className="w-3.5 h-3.5 text-amber-500" />
                    <span>OCR: Ler Texto de Imagem (Questão)</span>
                    <input type="file" accept="image/*" onChange={handleOCRUpload} className="hidden" disabled={ocrLoading} />
                  </label>
                  {ocrLoading && (
                    <span className="text-[10px] text-amber-400 flex items-center gap-1 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Extraindo texto via IA...
                    </span>
                  )}
                </div>

                <button
                  onClick={() => {
                    if (!contextText.trim()) {
                      alert("Por favor, digite sua dúvida ou cole uma questão no campo acima antes de enviar!");
                      return;
                    }
                    triggerAIAction("ask_doubt");
                  }}
                  disabled={loading}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl transition flex items-center gap-1.5 shadow-lg shadow-amber-400/10 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-slate-950" />
                  Enviar Dúvida para o Mentor
                </button>
              </div>
            </div>

            {/* Direct AI Action triggers */}
            <div className="md:col-span-12 grid grid-cols-1 sm:grid-cols-4 gap-3">
              <button
                onClick={() => triggerAIAction("explain")}
                disabled={loading}
                className="flex items-center justify-center gap-2 p-3 bg-slate-950 hover:bg-slate-850 text-slate-200 hover:text-white rounded-xl border border-slate-800 hover:border-amber-400/40 transition cursor-pointer font-bold text-xs disabled:opacity-50 group"
              >
                <BookOpen className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
                <span>Explicar Assunto</span>
              </button>

              <button
                onClick={() => triggerAIAction("summarize")}
                disabled={loading}
                className="flex items-center justify-center gap-2 p-3 bg-slate-950 hover:bg-slate-850 text-slate-200 hover:text-white rounded-xl border border-slate-800 hover:border-amber-400/40 transition cursor-pointer font-bold text-xs disabled:opacity-50 group"
              >
                <FileText className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Gerar Resumo</span>
              </button>

              <button
                onClick={() => triggerAIAction("flashcards")}
                disabled={loading}
                className="flex items-center justify-center gap-2 p-3 bg-slate-950 hover:bg-slate-850 text-slate-200 hover:text-white rounded-xl border border-slate-800 hover:border-amber-400/40 transition cursor-pointer font-bold text-xs disabled:opacity-50 group bg-slate-950"
              >
                <Layers className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Gerar Flashcards</span>
              </button>

              <button
                onClick={() => triggerAIAction("questions")}
                disabled={loading}
                className="flex items-center justify-center gap-2 p-3 bg-slate-950 hover:bg-slate-850 text-slate-200 hover:text-white rounded-xl border border-slate-800 hover:border-amber-400/40 transition cursor-pointer font-bold text-xs disabled:opacity-50 group"
              >
                <Target className="w-4 h-4 text-violet-400 group-hover:scale-110 transition-transform" />
                <span>Gerar 20 Questões</span>
              </button>
            </div>
          </div>

          {/* Loading view */}
          {loading && (
            <div className="bg-slate-950/60 border border-slate-850 p-12 rounded-3xl flex flex-col items-center justify-center text-center space-y-4 min-h-[300px]">
              <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white uppercase tracking-wider">Mentor de Estudos IA está processando...</h4>
                <p className="text-xs text-amber-400/80 italic max-w-md">
                  "{currentPhrase}"
                </p>
              </div>
            </div>
          )}

          {/* Error notification */}
          {errorMsg && (
            <div className="bg-rose-950/20 border border-rose-500/30 p-4 rounded-2xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <span className="text-xs font-bold text-rose-400 block">Falha de Operação</span>
                <p className="text-[11px] text-slate-300 leading-normal">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Response area */}
          {responseText && !loading && (
            <div className="space-y-3">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-850">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  Explicação pedagógica gerada com sucesso!
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Speech syntheses player */}
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 gap-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase mr-1.5 flex items-center gap-1">
                      <Volume2 className="w-3 h-3 text-amber-400" />
                      Áudio:
                    </span>
                    {!isSpeaking ? (
                      <button
                        onClick={handleSpeak}
                        className="p-1 text-slate-300 hover:text-amber-400 transition"
                        title="Iniciar Narração de Áudio (TTS)"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={handlePauseSpeech}
                        className="p-1 text-slate-300 hover:text-amber-400 transition"
                        title="Pausar Narração"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {(isSpeaking || isSpeechPaused) && (
                      <button
                        onClick={handleStopSpeech}
                        className="p-1 text-rose-400 hover:text-rose-500 transition"
                        title="Parar Áudio"
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Export PDF */}
                  <button
                    onClick={handleExportPDF}
                    className="flex items-center gap-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="Exportar como PDF"
                  >
                    <FileDown className="w-3.5 h-3.5 text-amber-500" />
                    <span>Exportar PDF</span>
                  </button>

                  <button
                    onClick={handleCopyText}
                    className="flex items-center gap-1 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-300 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                    title="Copiar texto para área de transferência"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleSaveToSharedLibrary}
                    disabled={savedToLibrary}
                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer border ${
                      savedToLibrary
                        ? "bg-emerald-950/20 border-emerald-500/25 text-emerald-400"
                        : "bg-amber-400 hover:bg-amber-500 text-slate-950 border-amber-400 font-extrabold"
                    }`}
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savedToLibrary ? "Salvo" : "Salvar Biblioteca"}</span>
                  </button>
                </div>
              </div>

              {/* If action is flashcards and we have cards, show the card study desk! */}
              {currentAction === "flashcards" && flashcards.length > 0 ? (
                <div className="space-y-4">
                  {/* View mode toggle */}
                  <div className="flex items-center justify-between bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-850">
                    <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                      <Layers className="w-4 h-4" />
                      Baralho de Memorização Ativa (IA)
                    </span>
                    <div className="flex gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                      <button
                        onClick={() => setFlashcardViewMode("interactive")}
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition cursor-pointer ${
                          flashcardViewMode === "interactive"
                            ? "bg-amber-400 text-slate-950 font-black"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Interativo
                      </button>
                      <button
                        onClick={() => setFlashcardViewMode("text")}
                        className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition cursor-pointer ${
                          flashcardViewMode === "text"
                            ? "bg-amber-400 text-slate-950 font-black"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Texto Completo
                      </button>
                    </div>
                  </div>

                  {flashcardViewMode === "interactive" ? (
                    <div className="flex flex-col items-center justify-center py-4 space-y-4">
                      {/* Interactive Card */}
                      <div
                        onClick={() => setShowAnswer(!showAnswer)}
                        className={`w-full max-w-lg min-h-[220px] bg-slate-950 border ${
                          showAnswer ? "border-emerald-500/40 shadow-lg shadow-emerald-500/5" : "border-amber-500/40 shadow-lg shadow-amber-500/5"
                        } rounded-3xl p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 transform hover:scale-[1.01] active:scale-[0.99] select-none text-center relative overflow-hidden`}
                      >
                        {/* Background Watermark decoration */}
                        <div className="absolute right-3 top-3 opacity-[0.02] text-slate-100 select-none pointer-events-none">
                          <Sparkles className="w-40 h-40" />
                        </div>

                        {/* Card Header/Badge */}
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-bold tracking-widest uppercase font-mono text-slate-500">
                            Frente de Memorização
                          </span>
                          <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full uppercase ${
                            showAnswer ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                          }`}>
                            {showAnswer ? "Gabarito / Verso" : "Pergunta / Frente"}
                          </span>
                        </div>

                        {/* Card Body - Content */}
                        <div className="my-auto py-4">
                          {!showAnswer ? (
                            <h4 className="text-sm sm:text-base font-extrabold text-slate-100 leading-relaxed max-w-md mx-auto">
                              {flashcards[currentFlashcardIndex].front}
                            </h4>
                          ) : (
                            <p className="text-xs sm:text-sm font-semibold text-slate-300 leading-relaxed max-w-md mx-auto whitespace-pre-wrap">
                              {flashcards[currentFlashcardIndex].back}
                            </p>
                          )}
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 animate-pulse mt-3">
                          <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                          <span>Clique no cartão para {showAnswer ? "ver a pergunta" : "revelar a resposta"}</span>
                        </div>
                      </div>

                      {/* Navigation Controls */}
                      <div className="w-full max-w-lg flex items-center justify-between px-2">
                        <button
                          onClick={() => {
                            if (currentFlashcardIndex > 0) {
                              setCurrentFlashcardIndex(currentFlashcardIndex - 1);
                              setShowAnswer(false);
                            }
                          }}
                          disabled={currentFlashcardIndex === 0}
                          className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 disabled:opacity-30 rounded-xl transition text-slate-300 hover:text-white cursor-pointer"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>

                        <div className="flex flex-col items-center">
                          <span className="text-xs font-mono font-bold text-slate-400">
                            {currentFlashcardIndex + 1} de {flashcards.length}
                          </span>
                          {/* Horizontal Progress bar */}
                          <div className="w-24 h-1 bg-slate-950 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className="h-full bg-amber-400 transition-all duration-300"
                              style={{ width: `${((currentFlashcardIndex + 1) / flashcards.length) * 100}%` }}
                            />
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            if (currentFlashcardIndex < flashcards.length - 1) {
                              setCurrentFlashcardIndex(currentFlashcardIndex + 1);
                              setShowAnswer(false);
                            }
                          }}
                          disabled={currentFlashcardIndex === flashcards.length - 1}
                          className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 disabled:opacity-30 rounded-xl transition text-slate-300 hover:text-white cursor-pointer"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Text full view */
                    <div className="bg-slate-950/80 border border-slate-850/80 p-6 rounded-2xl overflow-y-auto max-h-[400px] shadow-inner select-text">
                      <div className="prose prose-invert max-w-none space-y-3 font-sans">
                        {renderRichMarkdown(responseText)}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Default response text layout */
                <div className="bg-slate-950/80 border border-slate-850/80 p-6 rounded-2xl overflow-y-auto max-h-[400px] shadow-inner select-text">
                  <div className="prose prose-invert max-w-none space-y-3 font-sans">
                    {renderRichMarkdown(responseText)}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="bg-slate-950 px-6 py-4 border-t border-slate-800/80 flex items-center justify-between">
          <span className="text-[10px] text-slate-500 font-mono">
            Plataforma Avançada de Estudos • Mentor de Estudos IA
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-xs font-extrabold cursor-pointer transition border border-slate-850"
          >
            Fechar Espaço de Estudos
          </button>
        </div>

      </div>
    </div>
  );
}

