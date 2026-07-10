import React, { useState, useEffect } from "react";
import { ContentItem, User } from "../types";
import { BookOpen, Video, FileText, ExternalLink, Plus, Edit2, Trash2, Tag, ShieldCheck, AlertCircle, ClipboardList } from "lucide-react";
import { 
  fetchSharedContentFromFirestore, 
  saveContentItemToFirestore, 
  deleteContentItemFromFirestore 
} from "../lib/firebase";

interface ContentAreaProps {
  currentUser: User;
  onlySimulados?: boolean;
}

export default function ContentArea({ currentUser, onlySimulados = false }: ContentAreaProps) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>("todos");
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  const getYouTubeEmbedUrl = (videoUrl: string) => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = videoUrl.match(regExp);
      if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}`;
      }
    } catch (e) {
      // ignore
    }
    return null;
  };
  
  // States for adding/editing content
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [subtitle, setSubtitle] = useState<string>("");
  const [type, setType] = useState<"video" | "pdf" | "link" | "simulado">(onlySimulados ? "simulado" : "video");
  const [url, setUrl] = useState<string>("");
  const [category, setCategory] = useState<"cfo" | "soldado" | "both">("both");
  const [topic, setTopic] = useState<string>("");
  const [subtopic, setSubtopic] = useState<string>("");

  // Load content
  useEffect(() => {
    const loadContent = async () => {
      const saved = localStorage.getItem("shared_content");
      if (saved) {
        try {
          setItems(JSON.parse(saved));
        } catch (e) {
          setItems([]);
        }
      }

      try {
        const fsContent = await fetchSharedContentFromFirestore();
        if (fsContent.length > 0) {
          setItems(fsContent);
          localStorage.setItem("shared_content", JSON.stringify(fsContent));
        }
      } catch (err) {
        console.error("Error loading content from Firestore:", err);
      }
    };

    loadContent();
  }, []);

  const saveItems = (updated: ContentItem[]) => {
    setItems(updated);
    localStorage.setItem("shared_content", JSON.stringify(updated));
  };

  const handleOpenAdd = () => {
    setIsEditing(true);
    setEditingId(null);
    setTitle("");
    setSubtitle("");
    setType(onlySimulados ? "simulado" : "video");
    setUrl("");
    setCategory("both");
    setTopic("");
    setSubtopic("");
  };

  const handleOpenEdit = (item: ContentItem) => {
    setIsEditing(true);
    setEditingId(item.id);
    setTitle(item.title);
    setSubtitle(item.subtitle);
    setType(item.type);
    setUrl(item.url);
    setCategory(item.category);
    setTopic(item.topic || "");
    setSubtopic(item.subtopic || "");
  };

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Everything is optional, so we establish clean visual fallbacks
    const finalTitle = title.trim() || "Material Complementar";
    const finalSubtitle = subtitle.trim() || "Material complementar e de suporte ao cronograma de estudos.";
    const finalUrl = url.trim() || "";
    const finalTopic = topic.trim() || "Geral / Outros";

    if (editingId) {
      // Edit
      const updated = items.map((item) => {
        if (item.id === editingId) {
          return {
            ...item,
            title: finalTitle,
            subtitle: finalSubtitle,
            type,
            url: finalUrl,
            category,
            topic: finalTopic,
            subtopic: subtopic.trim() || undefined
          };
        }
        return item;
      });
      saveItems(updated);
      setIsEditing(false);
      setEditingId(null);

      const updatedItem = updated.find((i) => i.id === editingId);
      if (updatedItem) {
        try {
          await saveContentItemToFirestore(updatedItem);
        } catch (err) {
          console.error("Error updating content item in Firestore:", err);
        }
      }
    } else {
      // Create
      const newItem: ContentItem = {
        id: "content_" + Date.now(),
        title: finalTitle,
        subtitle: finalSubtitle,
        type,
        url: finalUrl,
        category,
        createdAt: new Date().toISOString(),
        topic: finalTopic,
        subtopic: subtopic.trim() || undefined
      };
      saveItems([newItem, ...items]);
      setIsEditing(false);

      try {
        await saveContentItemToFirestore(newItem);
      } catch (err) {
        console.error("Error saving new content item to Firestore:", err);
      }
    }

    setTitle("");
    setSubtitle("");
    setUrl("");
    setTopic("");
    setSubtopic("");
  };

  const handleDeleteContent = (id: string) => {
    setDeleteConfirmId(id);
  };

  // Filter content based on active student roles (CFO vs Soldado)
  const filteredItems = items.filter((item) => {
    // If onlySimulados is true, we ONLY show simulados
    if (onlySimulados) {
      if (item.type !== "simulado") return false;
    } else {
      // In the general library, we hide simulados since they have their own dedicated section
      if (item.type === "simulado") return false;
    }

    const studentAccessCFO = currentUser.accessCFO;
    const studentAccessSoldado = currentUser.accessSoldado;

    if (currentUser.isAdmin) return true; // admin sees everything

    if (studentAccessCFO && studentAccessSoldado) {
      return true; // shows both
    }
    if (studentAccessCFO) {
      return item.category === "cfo" || item.category === "both";
    }
    if (studentAccessSoldado) {
      return item.category === "soldado" || item.category === "both";
    }
    return item.category === "both"; // default fallback
  });

  // Get available unique topics
  const availableTopics = (Array.from(
    new Set(filteredItems.map((item) => item.topic?.trim() || "Geral / Outros"))
  ).filter(Boolean) as string[]).sort((a, b) => {
    if (a === "Geral / Outros") return 1;
    if (b === "Geral / Outros") return -1;
    return a.localeCompare(b);
  });

  // Items to show based on selected filter
  const itemsToDisplay = selectedTopicFilter === "todos"
    ? filteredItems
    : filteredItems.filter((item) => (item.topic?.trim() || "Geral / Outros") === selectedTopicFilter);

  // Grouped items
  const groupedItems: { [topicName: string]: ContentItem[] } = {};
  itemsToDisplay.forEach((item) => {
    const topicName = item.topic?.trim() || "Geral / Outros";
    if (!groupedItems[topicName]) {
      groupedItems[topicName] = [];
    }
    groupedItems[topicName].push(item);
  });

  // Sorted list of topics to render
  const sortedTopics = Object.keys(groupedItems).sort((a, b) => {
    if (a === "Geral / Outros") return 1;
    if (b === "Geral / Outros") return -1;
    return a.localeCompare(b);
  });

  return (
    <div id="content-area-component" className="space-y-6">
      
      {/* Header banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-amber-400">
            {onlySimulados ? (
              <>
                <ClipboardList className="w-6 h-6 text-amber-500 animate-pulse" />
                Simulados &amp; Provas PMBA
              </>
            ) : (
              <>
                <BookOpen className="w-6 h-6 text-amber-500" />
                Biblioteca de Conteúdos
              </>
            )}
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            {onlySimulados 
              ? "Simulados táticos gabaritados, cronometrados e provas anteriores para testar seus conhecimentos e focar na aprovação."
              : "Videoaulas, materiais complementares e PDFs de revisão selecionados e esquematizados pelos instrutores."
            }
          </p>
        </div>

        {/* Admin actions */}
        {currentUser.isAdmin && (
          <button
            onClick={handleOpenAdd}
            className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md self-start md:self-auto uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            {onlySimulados ? "Cadastrar Simulado" : "Adicionar Material"}
          </button>
        )}
      </div>

      {/* Admin Creator/Editor Form */}
      {isEditing && currentUser.isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl max-w-xl mx-auto">
          <div className="flex items-center gap-1.5 mb-4 border-b border-slate-800 pb-2.5 text-amber-400">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-bold text-sm uppercase tracking-wider">
              {editingId ? "Editar Conteúdo" : "Adicionar Novo Conteúdo"}
            </h3>
          </div>

          <form onSubmit={handleSaveContent} className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Título do Assunto</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Teoria da Equivalência dos Antecedentes"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Subtítulo / Descrição Rápida</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Ex: Artigo 13 do CP - Relação de Causalidade explicada passo a passo."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tópico (Edital / Matéria)</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex: Direito Penal, Língua Portuguesa"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Subtópico (Assunto Específico)</label>
                <input
                  type="text"
                  value={subtopic}
                  onChange={(e) => setSubtopic(e.target.value)}
                  placeholder="Ex: Relação de Causalidade, Crase"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Tipo de Material</label>
                {onlySimulados ? (
                  <div className="w-full bg-slate-950/60 border border-slate-850 rounded-lg px-3 py-2 text-sm text-amber-400 font-extrabold">
                    Simulado / Prova
                  </div>
                ) : (
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                  >
                    <option value="video">Vídeo</option>
                    <option value="pdf">PDF</option>
                    <option value="link">Link Externo</option>
                    <option value="simulado">Simulado / Prova</option>
                  </select>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Acesso (Público-Alvo)</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                >
                  <option value="both">Ambos (Geral)</option>
                  <option value="soldado">Apenas Soldado</option>
                  <option value="cfo">Apenas Oficial (CFO)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Link URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Ex: https://www.youtube.com/watch?..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-700 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-md"
              >
                {editingId ? "Salvar Alterações" : "Publicar Material"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick topic pills */}
      {availableTopics.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 bg-slate-900/60 border border-slate-800/80 p-3 rounded-2xl shadow-inner">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 mr-2 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            Filtrar por Assunto/Tópico:
          </span>
          <button
            onClick={() => setSelectedTopicFilter("todos")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedTopicFilter === "todos"
                ? "bg-amber-400 text-slate-950 font-extrabold shadow-sm"
                : "bg-slate-950 text-slate-300 hover:text-white border border-slate-850"
            }`}
          >
            Todos ({filteredItems.length})
          </button>
          {availableTopics.map((top) => {
            const count = filteredItems.filter((i) => (i.topic?.trim() || "Geral / Outros") === top).length;
            return (
              <button
                key={top}
                onClick={() => setSelectedTopicFilter(top)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedTopicFilter === top
                    ? "bg-amber-400 text-slate-950 font-extrabold shadow-sm"
                    : "bg-slate-950 text-slate-300 hover:text-white border border-slate-850"
                }`}
              >
                {top} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Grouped Lists of Materials */}
      <div className="space-y-10">
        {(() => {
          // Define card render utility
          const renderContentCard = (item: ContentItem) => {
            const embedUrl = item.type === "video" ? getYouTubeEmbedUrl(item.url) : null;
            const isPlaying = playingVideoId === item.id && embedUrl;

            return (
              <div
                key={item.id}
                className="bg-slate-900 border border-slate-800/80 rounded-2xl p-5 text-white flex flex-col justify-between hover:border-slate-700 hover:shadow-lg transition relative overflow-hidden group min-h-[220px]"
              >
                {/* Inline absolute confirmation overlay when deleting */}
                {deleteConfirmId === item.id && (
                  <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-5 text-center z-20 transition-all">
                    <AlertCircle className="w-8 h-8 text-rose-500 mb-2 animate-bounce" />
                    <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Excluir este Material?</h4>
                    <p className="text-[11px] text-slate-400 leading-normal max-w-xs mt-1 mb-4">
                      Tem certeza que deseja excluir "<strong>{item.title}</strong>"? Esta ação não poderá ser desfeita.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold cursor-pointer transition"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const updated = items.filter((i) => i.id !== item.id);
                          saveItems(updated);
                          setDeleteConfirmId(null);
                          try {
                            await deleteContentItemFromFirestore(item.id);
                          } catch (err) {
                            console.error("Error deleting content item from Firestore:", err);
                          }
                        }}
                        className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black cursor-pointer transition shadow-md shadow-rose-950"
                      >
                        Confirmar Exclusão
                      </button>
                    </div>
                  </div>
                )}

                {/* Background gradient decoration */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full blur-2xl group-hover:bg-amber-400/10 transition-all duration-500 pointer-events-none" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1">
                    {/* Type icon/badge */}
                    <div className="flex items-center gap-1.5">
                      <div className={`p-2 rounded-lg ${
                        item.type === "video" 
                          ? "bg-red-500/10 text-red-400" 
                          : item.type === "pdf" 
                          ? "bg-emerald-500/10 text-emerald-400" 
                          : item.type === "simulado"
                          ? "bg-amber-400/10 text-amber-400 border border-amber-400/20"
                          : "bg-indigo-500/10 text-indigo-400"
                      }`}>
                        {item.type === "video" && <Video className="w-4 h-4" />}
                        {item.type === "pdf" && <FileText className="w-4 h-4" />}
                        {item.type === "simulado" && <ClipboardList className="w-4 h-4" />}
                        {item.type === "link" && <ExternalLink className="w-4 h-4" />}
                      </div>
                      <span className="text-[10px] font-bold font-mono uppercase text-slate-400 tracking-wider">
                        {item.type === "video" && "Vídeoaula"}
                        {item.type === "pdf" && "Resumo PDF"}
                        {item.type === "simulado" && "Simulado Prático"}
                        {item.type === "link" && "Link Externo"}
                      </span>
                    </div>

                    {/* Target Audience Badge */}
                    <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-850 px-2.5 py-1 rounded-full text-[9px] font-bold font-mono tracking-wider">
                      <Tag className="w-2.5 h-2.5 text-amber-400" />
                      <span className="text-slate-300">
                        {item.category === "both" && "GERAL"}
                        {item.category === "cfo" && "CFO PMBA"}
                        {item.category === "soldado" && "SOLDADO"}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-extrabold text-sm text-slate-100 leading-snug group-hover:text-amber-400 transition-colors">
                    {item.title}
                  </h3>
                  
                  {item.subtopic && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="bg-slate-950 border border-slate-850 text-[9px] text-slate-300 font-bold font-mono px-2 py-0.5 rounded-md uppercase tracking-wide shrink-0">
                        Subtópico: {item.subtopic}
                      </span>
                    </div>
                  )}

                  {/* Integrated YouTube Player directly on card */}
                  {isPlaying ? (
                    <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-800 bg-black mt-2">
                      <iframe
                        width="100%"
                        height="100%"
                        src={embedUrl}
                        title={item.title}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  ) : (
                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-3">
                      {item.subtitle}
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between mt-5 border-t border-slate-800/60 pt-4">
                  <div className="flex items-center gap-3">
                    {item.type === "simulado" ? (
                      item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs flex items-center gap-1.5 transition cursor-pointer shadow-md shadow-amber-950/20"
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                          <span>Iniciar Simulado</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500 italic">Sem Link</span>
                      )
                    ) : embedUrl ? (
                      <button
                        type="button"
                        onClick={() => setPlayingVideoId(isPlaying ? null : item.id)}
                        className="text-xs font-bold text-amber-400 hover:text-amber-500 flex items-center gap-1.5 cursor-pointer"
                      >
                        {isPlaying ? (
                          <>
                            <span>Fechar Vídeo</span>
                          </>
                        ) : (
                          <>
                            <Video className="w-3.5 h-3.5 animate-pulse" />
                            <span>Assistir na Plataforma</span>
                          </>
                        )}
                      </button>
                    ) : item.url ? (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-amber-400 hover:text-amber-500 flex items-center gap-1.5 group/link"
                      >
                        <span>Acessar Material</span>
                        <ExternalLink className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">Sem Link</span>
                    )}
                  </div>

                  {/* Admin modifications */}
                  {currentUser.isAdmin && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        className="p-1.5 rounded bg-slate-950/50 border border-slate-850 hover:bg-slate-800 hover:text-amber-400 transition text-slate-400 cursor-pointer"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteContent(item.id)}
                        className="p-1.5 rounded bg-slate-950/50 border border-slate-850 hover:bg-rose-950/40 hover:text-rose-400 hover:border-rose-900/50 transition text-slate-400 cursor-pointer"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          };

          return sortedTopics.map((topicName) => {
            const topicItems = groupedItems[topicName];
            
            // Group items inside this topic by subtopic (which represents the specific Assunto / Subject)
            const groupedBySubtopic: { [subtopicName: string]: ContentItem[] } = {};
            topicItems.forEach((item) => {
              const subtopicName = item.subtopic?.trim() || "Geral / Introdução";
              if (!groupedBySubtopic[subtopicName]) {
                groupedBySubtopic[subtopicName] = [];
              }
              groupedBySubtopic[subtopicName].push(item);
            });

            // Sort subtopics: Put "Geral" first, then alphabetical
            const sortedSubtopics = Object.keys(groupedBySubtopic).sort((a, b) => {
              if (a === "Geral / Introdução" || a === "Geral") return -1;
              if (b === "Geral / Introdução" || b === "Geral") return 1;
              return a.localeCompare(b);
            });

            return (
              <div key={topicName} className="bg-slate-900/40 border border-slate-850 p-6 rounded-3xl space-y-6">
                {/* Topic Section Header */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-amber-400 animate-pulse" />
                    <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-100">
                      {topicName}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono bg-slate-950 text-amber-400 border border-slate-850 px-2.5 py-1 rounded-full font-bold font-mono">
                    {topicItems.length} {topicItems.length === 1 ? "conteúdo" : "conteúdos"}
                  </span>
                </div>

                {/* Sub-groups (Assuntos) separated inside the Topic */}
                <div className="space-y-8">
                  {sortedSubtopics.map((subtopicName) => {
                    const subtopicItems = groupedBySubtopic[subtopicName];
                    const subtopicVideos = subtopicItems.filter(item => item.type === "video");
                    const subtopicSimulados = subtopicItems.filter(item => item.type === "simulado");
                    const subtopicPDFs = subtopicItems.filter(item => item.type === "pdf");
                    const subtopicLinks = subtopicItems.filter(item => item.type === "link");

                    return (
                      <div key={subtopicName} className="bg-slate-950/30 border border-slate-850/60 rounded-2xl p-5 space-y-4">
                        {/* Subtopic / Assunto Header */}
                        <div className="flex items-center justify-between border-b border-slate-900 pb-2">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-amber-400" />
                            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                              Assunto: <span className="text-amber-400 font-extrabold">{subtopicName}</span>
                            </h4>
                          </div>
                          <span className="text-[9px] font-mono bg-slate-900 text-slate-400 px-2 py-0.5 rounded border border-slate-850">
                            {subtopicItems.length} {subtopicItems.length === 1 ? "item" : "itens"}
                          </span>
                        </div>

                        {/* List of separated content types within this Assunto */}
                        <div className="space-y-5">
                          {/* Video Lectures */}
                          {subtopicVideos.length > 0 && (
                            <div className="space-y-2.5">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-amber-500/80 flex items-center gap-1.5 pl-1">
                                <Video className="w-3.5 h-3.5 text-amber-500" />
                                Aulas em Vídeo ({subtopicVideos.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {subtopicVideos.map(renderContentCard)}
                              </div>
                            </div>
                          )}

                          {/* Simulados */}
                          {subtopicSimulados.length > 0 && (
                            <div className="space-y-2.5">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5 pl-1">
                                <ClipboardList className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                Simulados Práticos &amp; Questões ({subtopicSimulados.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {subtopicSimulados.map(renderContentCard)}
                              </div>
                            </div>
                          )}

                          {/* PDF Study Materials */}
                          {subtopicPDFs.length > 0 && (
                            <div className="space-y-2.5">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-400/80 flex items-center gap-1.5 pl-1">
                                <FileText className="w-3.5 h-3.5 text-emerald-400" />
                                Resumos &amp; PDFs ({subtopicPDFs.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {subtopicPDFs.map(renderContentCard)}
                              </div>
                            </div>
                          )}

                          {/* External reference links */}
                          {subtopicLinks.length > 0 && (
                            <div className="space-y-2.5">
                              <h5 className="text-[10px] font-black uppercase tracking-wider text-indigo-400/80 flex items-center gap-1.5 pl-1">
                                <ExternalLink className="w-3.5 h-3.5 text-indigo-400" />
                                Links de Apoio ({subtopicLinks.length})
                              </h5>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {subtopicLinks.map(renderContentCard)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          });
        })()}

        {filteredItems.length === 0 && (
          <div className="text-center py-12 bg-slate-900/50 rounded-2xl border border-slate-800/80">
            <span className="text-slate-500 text-sm">Nenhum conteúdo publicado para sua categoria no momento.</span>
          </div>
        )}
      </div>

    </div>
  );
}
