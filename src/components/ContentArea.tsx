import React, { useState, useEffect } from "react";
import { ContentItem, User, StudyModule } from "../types";
import { BookOpen, Video, FileText, ExternalLink, Plus, Edit2, Trash2, Tag, ShieldCheck, AlertCircle, ClipboardList, Maximize2, Minimize2, Download, Check, ChevronDown, ChevronRight, FolderPlus, Folder, FolderOpen, Settings } from "lucide-react";
import { 
  fetchSharedContentFromFirestore, 
  saveContentItemToFirestore, 
  deleteContentItemFromFirestore,
  fetchModulesFromFirestore,
  saveModuleToFirestore,
  deleteModuleFromFirestore
} from "../lib/firebase";

interface ContentAreaProps {
  currentUser: User;
  onlySimulados?: boolean;
  sidebarMinimized?: boolean;
  setSidebarMinimized?: (minimized: boolean) => void;
}

export default function ContentArea({ 
  currentUser, 
  onlySimulados = false,
  sidebarMinimized = false,
  setSidebarMinimized
}: ContentAreaProps) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>("todos");
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [selectedReadingItem, setSelectedReadingItem] = useState<ContentItem | null>(null);

  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [activeItem, setActiveItem] = useState<ContentItem | null>(null);
  const [expandedModules, setExpandedModules] = useState<{ [moduleName: string]: boolean }>({});
  const [expandedSubtopics, setExpandedSubtopics] = useState<{ [subtopicKey: string]: boolean }>({});

  const toggleSubtopic = (topicName: string, subtopicName: string) => {
    const key = `${topicName}::${subtopicName}`;
    setExpandedSubtopics(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  useEffect(() => {
    const saved = localStorage.getItem("completed_lessons");
    if (saved) {
      try {
        setCompletedLessons(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const toggleLessonCompletion = (id: string) => {
    let updated;
    if (completedLessons.includes(id)) {
      updated = completedLessons.filter(l => l !== id);
    } else {
      updated = [...completedLessons, id];
    }
    setCompletedLessons(updated);
    localStorage.setItem("completed_lessons", JSON.stringify(updated));
  };

  const toggleModule = (moduleName: string) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleName]: !prev[moduleName]
    }));
  };

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
  const [additionalPdfs, setAdditionalPdfs] = useState<{ name: string; url: string }[]>([]);

  // States for modules
  const [modules, setModules] = useState<StudyModule[]>([]);
  const [isManagingModules, setIsManagingModules] = useState<boolean>(false);
  const [newModuleName, setNewModuleName] = useState<string>("");
  const [newModuleDesc, setNewModuleDesc] = useState<string>("");
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [inlineNewModuleName, setInlineNewModuleName] = useState<string>("");

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

      const savedModules = localStorage.getItem("study_modules");
      if (savedModules) {
        try {
          setModules(JSON.parse(savedModules));
        } catch (e) {
          setModules([]);
        }
      }

      try {
        const [fsContent, fsModules] = await Promise.all([
          fetchSharedContentFromFirestore(),
          fetchModulesFromFirestore()
        ]);

        let finalModules = fsModules;

        // Auto-seed modules if empty but existing content items have topics
        if (fsModules.length === 0 && fsContent.length > 0) {
          const uniqueTopics = Array.from(new Set(fsContent.map(item => item.topic?.trim() || "Geral / Outros").filter(Boolean)));
          const seeded: StudyModule[] = [];
          for (const t of uniqueTopics) {
            const newM: StudyModule = {
              id: "module_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
              name: t,
              description: "Módulo gerado automaticamente a partir dos tópicos existentes.",
              createdAt: new Date().toISOString()
            };
            try {
              await saveModuleToFirestore(newM);
              seeded.push(newM);
            } catch (err) {
              console.error("Error saving auto-seeded module:", err);
            }
          }
          finalModules = seeded;
        }

        if (fsContent.length > 0) {
          setItems(fsContent);
          localStorage.setItem("shared_content", JSON.stringify(fsContent));
        }

        setModules(finalModules);
        localStorage.setItem("study_modules", JSON.stringify(finalModules));
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
    setInlineNewModuleName("");
    setAdditionalPdfs([]);
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
    setInlineNewModuleName("");
    setAdditionalPdfs(item.additionalPdfs || []);
  };

  const handleSaveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleName.trim()) return;

    const nameTrimmed = newModuleName.trim();

    if (editingModuleId) {
      // Edit
      const updated = modules.map((m) => {
        if (m.id === editingModuleId) {
          return { ...m, name: nameTrimmed, description: newModuleDesc.trim() || undefined };
        }
        return m;
      });
      setModules(updated);
      localStorage.setItem("study_modules", JSON.stringify(updated));

      const updatedMod = updated.find((m) => m.id === editingModuleId);
      if (updatedMod) {
        try {
          await saveModuleToFirestore(updatedMod);
        } catch (err) {
          console.error("Error updating module in Firestore:", err);
        }
      }
      setEditingModuleId(null);
    } else {
      // Create
      const newMod: StudyModule = {
        id: "module_" + Date.now(),
        name: nameTrimmed,
        description: newModuleDesc.trim() || undefined,
        createdAt: new Date().toISOString()
      };
      const updated = [...modules, newMod];
      setModules(updated);
      localStorage.setItem("study_modules", JSON.stringify(updated));
      try {
        await saveModuleToFirestore(newMod);
      } catch (err) {
        console.error("Error saving new module in Firestore:", err);
      }
    }

    setNewModuleName("");
    setNewModuleDesc("");
  };

  const handleDeleteModule = async (moduleId: string) => {
    const modToDelete = modules.find((m) => m.id === moduleId);
    if (!modToDelete) return;
    
    if (window.confirm(`Tem certeza que deseja excluir o módulo "${modToDelete.name}"? Os materiais dentro deste módulo não serão excluídos, mas serão movidos para "Geral / Outros".`)) {
      // 1. Update modules list
      const updatedModules = modules.filter((m) => m.id !== moduleId);
      setModules(updatedModules);
      localStorage.setItem("study_modules", JSON.stringify(updatedModules));

      // 2. Update local items that were in this module
      const updatedItems = items.map((item) => {
        if (item.topic === modToDelete.name) {
          const updatedItem = { ...item, topic: "Geral / Outros" };
          saveContentItemToFirestore(updatedItem).catch(console.error);
          return updatedItem;
        }
        return item;
      });
      setItems(updatedItems);
      localStorage.setItem("shared_content", JSON.stringify(updatedItems));

      // 3. Delete from Firestore
      try {
        await deleteModuleFromFirestore(moduleId);
      } catch (err) {
        console.error("Error deleting module from Firestore:", err);
      }
    }
  };

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Everything is optional, so we establish clean visual fallbacks
    const finalTitle = title.trim() || "Material Complementar";
    const finalSubtitle = subtitle.trim() || "Material complementar e de suporte ao cronograma de estudos.";
    const finalUrl = url.trim() || "";
    
    let finalTopic = topic.trim() || "Geral / Outros";
    if (finalTopic === "NEW_MODULE" && inlineNewModuleName.trim()) {
      finalTopic = inlineNewModuleName.trim();
    }

    // Check if we need to auto-create this module
    const exists = modules.some(m => m.name.toLowerCase() === finalTopic.toLowerCase());
    if (!exists && finalTopic !== "Geral / Outros" && finalTopic !== "") {
      const newM: StudyModule = {
        id: "module_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
        name: finalTopic,
        description: "Módulo criado dinamicamente ao adicionar material.",
        createdAt: new Date().toISOString()
      };
      try {
        await saveModuleToFirestore(newM);
        const updatedMods = [...modules, newM];
        setModules(updatedMods);
        localStorage.setItem("study_modules", JSON.stringify(updatedMods));
      } catch (err) {
        console.error("Error creating module on-the-fly:", err);
      }
    }

    const filteredPdfs = type === "pdf" 
      ? additionalPdfs.filter(p => p.name.trim() && p.url.trim()) 
      : undefined;

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
            subtopic: subtopic.trim() || undefined,
            additionalPdfs: filteredPdfs
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
        subtopic: subtopic.trim() || undefined,
        additionalPdfs: filteredPdfs
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
    setInlineNewModuleName("");
    setAdditionalPdfs([]);
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
    new Set([
      ...modules.map(m => m.name.trim()),
      ...filteredItems.map((item) => item.topic?.trim() || "Geral / Outros")
    ])
  ).filter((topicName) => {
    if (!topicName) return false;
    if (currentUser.isAdmin) return true;
    return filteredItems.some(item => (item.topic?.trim() || "Geral / Outros") === topicName);
  }) as string[]).sort((a, b) => {
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

  // Sorted list of topics to render (including empty custom modules for admins, and populated modules for students)
  const sortedTopics = Array.from(new Set([
    ...modules.map(m => m.name.trim()),
    ...Object.keys(groupedItems)
  ])).filter(topicName => {
    if (!topicName) return false;
    if (currentUser.isAdmin) return true; // admin sees empty modules too
    return groupedItems[topicName] && groupedItems[topicName].length > 0; // students only see populated modules
  }).sort((a, b) => {
    if (a === "Geral / Outros") return 1;
    if (b === "Geral / Outros") return -1;
    return a.localeCompare(b);
  });

  // Automatically select the first class of the active filtered items when the filter or items change
  useEffect(() => {
    if (itemsToDisplay.length > 0) {
      const exists = itemsToDisplay.some(i => i.id === activeItem?.id);
      if (!exists) {
        setActiveItem(itemsToDisplay[0]);
      }
    } else {
      setActiveItem(null);
    }
  }, [selectedTopicFilter, items]);

  // Expand the first module automatically when modules load
  useEffect(() => {
    if (sortedTopics.length > 0) {
      setExpandedModules(prev => {
        if (Object.keys(prev).length === 0) {
          const initial: { [key: string]: boolean } = {};
          sortedTopics.forEach((topic, idx) => {
            initial[topic] = idx === 0;
          });
          return initial;
        }
        return prev;
      });
    }
  }, [sortedTopics]);

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
          <div className="flex flex-wrap gap-2">
            {!onlySimulados && (
              <button
                onClick={() => setIsManagingModules(!isManagingModules)}
                className={`px-5 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md self-start md:self-auto uppercase tracking-wider ${
                  isManagingModules
                    ? "bg-amber-400/10 border-amber-400 text-amber-400 hover:bg-amber-400/20"
                    : "bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900"
                }`}
              >
                <Folder className="w-4 h-4" />
                {isManagingModules ? "Ver Materiais" : "Gerenciar Módulos"}
              </button>
            )}
            <button
              onClick={handleOpenAdd}
              className="px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md self-start md:self-auto uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              {onlySimulados ? "Cadastrar Simulado" : "Adicionar Material"}
            </button>
          </div>
        )}
      </div>

      {/* Admin Module Manager View */}
      {isManagingModules && currentUser.isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2 text-amber-400">
              <Folder className="w-5 h-5" />
              <h3 className="font-bold text-sm uppercase tracking-wider">
                Painel de Controle: Módulos do Curso
              </h3>
            </div>
            <button
              onClick={() => {
                setEditingModuleId(null);
                setNewModuleName("");
                setNewModuleDesc("");
              }}
              className="text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Limpar Campos
            </button>
          </div>

          {/* Create/Edit Module Form */}
          <form onSubmit={handleSaveModule} className="bg-slate-950 border border-slate-850 p-4 rounded-xl space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
              {editingModuleId ? "✏️ Editar Módulo Existente" : "🆕 Criar Novo Módulo de Aula"}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nome do Módulo</label>
                <input
                  type="text"
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  placeholder="Ex: Língua Portuguesa"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Breve Descrição</label>
                <input
                  type="text"
                  value={newModuleDesc}
                  onChange={(e) => setNewModuleDesc(e.target.value)}
                  placeholder="Ex: Aulas completas foca na banca da PMBA."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {editingModuleId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingModuleId(null);
                    setNewModuleName("");
                    setNewModuleDesc("");
                  }}
                  className="px-4 py-1.5 rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-900 text-xs font-semibold cursor-pointer"
                >
                  Cancelar Edição
                </button>
              )}
              <button
                type="submit"
                className="px-5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold cursor-pointer"
              >
                {editingModuleId ? "Salvar Alterações" : "Criar Módulo"}
              </button>
            </div>
          </form>

          {/* List of existing modules */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Módulos Ativos ({modules.length})
            </h4>
            {modules.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Nenhum módulo criado ainda. Crie um acima!</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 border border-slate-800/60 rounded-xl p-2 bg-slate-950/40">
                {modules.map((m) => {
                  const contentCount = items.filter(i => i.topic === m.name).length;
                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-slate-950 border border-slate-850 rounded-lg hover:border-slate-800 transition"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-200">{m.name}</span>
                          <span className="text-[10px] bg-slate-850 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                            {contentCount} {contentCount === 1 ? "aula/PDF" : "aulas/PDFs"}
                          </span>
                        </div>
                        {m.description && (
                          <p className="text-xs text-slate-400 mt-1">{m.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingModuleId(m.id);
                            setNewModuleName(m.name);
                            setNewModuleDesc(m.description || "");
                          }}
                          className="p-1.5 rounded bg-slate-900 hover:bg-slate-850 text-amber-400 cursor-pointer transition border border-slate-800"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteModule(m.id)}
                          className="p-1.5 rounded bg-slate-900 hover:bg-red-950/50 text-red-400 hover:text-red-300 cursor-pointer transition border border-slate-800 hover:border-red-900"
                          title="Excluir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

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
                <label className="block text-xs text-slate-400 mb-1">Módulo / Matéria</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-400 font-medium"
                >
                  <option value="">-- Selecione um Módulo --</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                  <option value="NEW_MODULE">+ Criar Novo Módulo...</option>
                </select>
                {topic === "NEW_MODULE" && (
                  <input
                    type="text"
                    value={inlineNewModuleName}
                    onChange={(e) => setInlineNewModuleName(e.target.value)}
                    placeholder="Nome do Novo Módulo"
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-lg px-3 py-2 mt-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                  />
                )}
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
              <label className="block text-xs text-slate-400 mb-1">
                {type === "pdf" ? "Link do PDF Principal" : "Link URL"}
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={type === "pdf" ? "Ex: https://meu-drive.com/resumo.pdf" : "Ex: https://www.youtube.com/watch?..."}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* ADDITIONAL PDFs ATTACHMENTS */}
            {type === "pdf" && (
              <div className="space-y-3 border-t border-slate-800 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5" />
                    Anexar PDFs Adicionais / Suporte
                  </span>
                  <button
                    type="button"
                    onClick={() => setAdditionalPdfs([...additionalPdfs, { name: "", url: "" }])}
                    className="text-[10px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-2 py-1 rounded-lg font-bold flex items-center gap-1 transition border border-emerald-500/20 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Incluir Outro PDF</span>
                  </button>
                </div>

                {additionalPdfs.length === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">Nenhum PDF adicional anexado. Você pode cadastrar múltiplos PDFs juntos nesta mesma publicação.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {additionalPdfs.map((pdf, pIdx) => (
                      <div key={pIdx} className="bg-slate-950 p-2.5 rounded-xl border border-slate-850 flex items-start gap-2 relative">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1">
                          <input
                            type="text"
                            value={pdf.name}
                            required
                            placeholder="Nome do PDF (Ex: Resumo Aula 01)"
                            onChange={(e) => {
                              const updated = [...additionalPdfs];
                              updated[pIdx].name = e.target.value;
                              setAdditionalPdfs(updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                          />
                          <input
                            type="url"
                            value={pdf.url}
                            required
                            placeholder="URL do PDF (Ex: https://...)"
                            onChange={(e) => {
                              const updated = [...additionalPdfs];
                              updated[pIdx].url = e.target.value;
                              setAdditionalPdfs(updated);
                            }}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setAdditionalPdfs(additionalPdfs.filter((_, idx) => idx !== pIdx))}
                          className="p-1.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg hover:bg-rose-500/20 hover:text-rose-300 transition shrink-0 cursor-pointer"
                          title="Remover"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

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

      {/* Kiwify Course Player Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* SIDEBAR: Modules & Progress (lg:col-span-4) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Progress Widget */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider">Seu Progresso</span>
              <span className="text-xs font-mono font-extrabold text-amber-400">
                {(() => {
                  const completedCount = completedLessons.filter(id => filteredItems.some(i => i.id === id)).length;
                  const totalCount = filteredItems.length;
                  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                  return `${pct}% (${completedCount}/${totalCount})`;
                })()}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-850">
              <div 
                className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ 
                  width: `${(() => {
                    const completedCount = completedLessons.filter(id => filteredItems.some(i => i.id === id)).length;
                    const totalCount = filteredItems.length;
                    return totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
                  })()}%` 
                }}
              />
            </div>
          </div>

          {/* Module Navigation List */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-950/20">
              <h3 className="font-extrabold text-xs text-slate-300 uppercase tracking-widest flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-amber-400" />
                Módulos do Curso
              </h3>
            </div>

            <div className="divide-y divide-slate-800 max-h-[600px] overflow-y-auto">
              {sortedTopics.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  Nenhum módulo disponível para sua categoria no momento.
                </div>
              ) : (
                sortedTopics.map((topicName) => {
                  const topicItems = groupedItems[topicName];
                  const isExpanded = !!expandedModules[topicName];
                  const topicCompletedCount = topicItems.filter(item => completedLessons.includes(item.id)).length;
                  const topicProgressPct = topicItems.length > 0 ? Math.round((topicCompletedCount / topicItems.length) * 100) : 0;

                  return (
                    <div key={topicName} className="bg-slate-900/50">
                      {/* Module Header Row */}
                      <button
                        onClick={() => toggleModule(topicName)}
                        className="w-full text-left p-4 hover:bg-slate-850/40 flex items-center justify-between transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <div className={`p-1.5 rounded-lg shrink-0 ${topicProgressPct === 100 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400'}`}>
                            <BookOpen className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-black text-xs text-slate-200 block truncate uppercase tracking-wider">{topicName}</span>
                            <span className="text-[10px] text-slate-400 font-mono block mt-0.5">
                              {topicCompletedCount}/{topicItems.length} concluídas • {topicProgressPct}%
                            </span>
                          </div>
                        </div>
                        <div className="shrink-0 text-slate-400 hover:text-white transition">
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                        </div>
                      </button>

                      {/* Lesson List inside Module */}
                      {isExpanded && (
                        <div className="bg-slate-950/40 border-t border-slate-900 pb-1 text-slate-300">
                          {(() => {
                            // Split items into standalone (no subtopic) and grouped by subtopic
                            const subtopicsMap: { [subtopicName: string]: ContentItem[] } = {};
                            const standaloneItems: ContentItem[] = [];

                            topicItems.forEach(item => {
                              const sub = item.subtopic?.trim();
                              if (sub) {
                                if (!subtopicsMap[sub]) {
                                  subtopicsMap[sub] = [];
                                }
                                subtopicsMap[sub].push(item);
                              } else {
                                standaloneItems.push(item);
                              }
                            });

                            const sortedSubtopics = Object.keys(subtopicsMap).sort((a, b) => a.localeCompare(b));

                            const renderLessonRow = (item: ContentItem, isNested: boolean) => {
                              const isCompleted = completedLessons.includes(item.id);
                              const isActive = activeItem?.id === item.id;

                              return (
                                <div 
                                  key={item.id}
                                  className={`group/lesson flex items-start justify-between py-3 pr-3.5 border-l-4 transition-all duration-150 ${
                                    isNested ? "pl-7" : "pl-3.5"
                                  } ${
                                    isActive 
                                      ? "bg-amber-400/5 border-amber-400 text-amber-400 font-extrabold" 
                                      : "border-transparent text-slate-300 hover:bg-slate-900/30 hover:text-white"
                                  }`}
                                >
                                  {/* Checkbox & Lesson Meta */}
                                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                    {/* Completion Round Toggle Checkbox */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleLessonCompletion(item.id);
                                      }}
                                      className={`mt-0.5 p-0.5 rounded-full transition-all duration-150 cursor-pointer shrink-0 ${
                                        isCompleted 
                                          ? "bg-emerald-500 text-slate-950 font-black scale-105" 
                                          : "bg-slate-800 text-slate-500 hover:bg-slate-700 hover:text-slate-300"
                                      }`}
                                      title={isCompleted ? "Marcar como não concluído" : "Marcar como concluído"}
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>

                                    {/* Clickable Lesson Detail Triggers */}
                                    <button
                                      onClick={() => setActiveItem(item)}
                                      className="text-left min-w-0 flex-1 cursor-pointer"
                                    >
                                      <div className="flex items-center gap-1.5">
                                        {/* Type icon on item */}
                                        {item.type === "video" && <Video className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                                        {item.type === "pdf" && <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                                        {item.type === "simulado" && <ClipboardList className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                        {item.type === "link" && <ExternalLink className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                                        <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-slate-500 shrink-0">
                                          {item.type === "video" ? "AULA" : item.type === "pdf" ? "PDF" : item.type === "simulado" ? "TESTE" : "LINK"}
                                        </span>
                                      </div>
                                      <span className={`text-xs block mt-1 leading-snug transition-colors truncate ${isActive ? "text-amber-400 font-extrabold" : "text-slate-200 group-hover/lesson:text-amber-400"}`}>
                                        {item.title}
                                      </span>
                                    </button>
                                  </div>

                                  {/* Admin Context Actions inside list */}
                                  {currentUser.isAdmin && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover/lesson:opacity-100 transition shrink-0 pl-1">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEdit(item)}
                                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-400 transition cursor-pointer"
                                        title="Editar"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteContent(item.id)}
                                        className="p-1 rounded hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition cursor-pointer"
                                        title="Excluir"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              );
                            };

                            return (
                              <div className="divide-y divide-slate-900/40">
                                {/* Standalone items under this module first */}
                                {standaloneItems.length > 0 && (
                                  <div className="py-1">
                                    {standaloneItems.map(item => renderLessonRow(item, false))}
                                  </div>
                                )}

                                {/* Subtopic folders */}
                                {sortedSubtopics.map(subName => {
                                  const subItems = subtopicsMap[subName];
                                  const subKey = `${topicName}::${subName}`;
                                  const isSubExpanded = expandedSubtopics[subKey] !== false; // true (expanded) by default
                                  const subCompletedCount = subItems.filter(item => completedLessons.includes(item.id)).length;
                                  const subPct = subItems.length > 0 ? Math.round((subCompletedCount / subItems.length) * 100) : 0;

                                  return (
                                    <div key={subName} className="bg-slate-950/20 border-b border-slate-900/60 last:border-0">
                                      {/* Folder header */}
                                      <button
                                        onClick={() => toggleSubtopic(topicName, subName)}
                                        className="w-full text-left px-4 py-2.5 hover:bg-slate-900/40 flex items-center justify-between transition cursor-pointer border-b border-slate-900/20"
                                      >
                                        <div className="flex items-center gap-2 min-w-0 pr-2">
                                          {isSubExpanded ? (
                                            <FolderOpen className="w-4 h-4 text-amber-500/80 shrink-0" />
                                          ) : (
                                            <Folder className="w-4 h-4 text-amber-500/80 shrink-0" />
                                          )}
                                          <div className="min-w-0">
                                            <span className="font-bold text-[11px] text-slate-300 block truncate uppercase tracking-wider">
                                              {subName}
                                            </span>
                                            <span className="text-[9px] text-slate-400 block mt-0.5 font-mono">
                                              {subCompletedCount}/{subItems.length} concluídas • {subPct}%
                                            </span>
                                          </div>
                                        </div>
                                        <div className="text-slate-500 hover:text-slate-300 transition shrink-0">
                                          {isSubExpanded ? (
                                            <ChevronDown className="w-3.5 h-3.5" />
                                          ) : (
                                            <ChevronRight className="w-3.5 h-3.5" />
                                          )}
                                        </div>
                                      </button>

                                      {/* Folder items list */}
                                      {isSubExpanded && (
                                        <div className="bg-slate-950/40 border-l border-amber-400/20 ml-5 py-1 animate-fade-in divide-y divide-slate-900/20">
                                          {subItems.map(item => renderLessonRow(item, true))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}

                                {standaloneItems.length === 0 && sortedSubtopics.length === 0 && (
                                  <div className="p-4 text-center text-slate-600 text-xs italic">
                                    Nenhum material neste módulo ainda.
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* STAGE: Active Lesson detail Workspace (lg:col-span-8) */}
        <div className="lg:col-span-8 space-y-6">
          {activeItem ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-2xl space-y-6 min-h-[550px] relative">
              
              {/* Inline delete confirmation overlay for the active material */}
              {deleteConfirmId === activeItem.id && (
                <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-5 text-center z-20 transition-all rounded-3xl">
                  <AlertCircle className="w-8 h-8 text-rose-500 mb-2 animate-bounce" />
                  <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wide">Excluir este Material?</h4>
                  <p className="text-[11px] text-slate-400 leading-normal max-w-xs mt-1 mb-4">
                    Tem certeza que deseja excluir "<strong>{activeItem.title}</strong>"? Esta ação não poderá ser desfeita.
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
                        const updated = items.filter((i) => i.id !== activeItem.id);
                        saveItems(updated);
                        setDeleteConfirmId(null);
                        setActiveItem(null);
                        try {
                          await deleteContentItemFromFirestore(activeItem.id);
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

              {/* Lesson Metadata Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                      Módulo: {activeItem.topic}
                    </span>
                    {activeItem.subtopic && (
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-300 bg-slate-950 px-2.5 py-0.5 rounded-full border border-slate-850">
                        {activeItem.subtopic}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-black text-slate-100 tracking-tight leading-snug">
                    {activeItem.title}
                  </h2>
                </div>

                {/* Admin Quick Options inside Workspace */}
                {currentUser.isAdmin && (
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <button
                      onClick={() => handleOpenEdit(activeItem)}
                      className="px-3 py-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 hover:text-amber-400 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar Material</span>
                    </button>
                    <button
                      onClick={() => handleDeleteContent(activeItem.id)}
                      className="px-3 py-1.5 bg-rose-950/20 border border-rose-900/40 text-rose-400 hover:bg-rose-950/40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Excluir</span>
                    </button>
                  </div>
                )}
              </div>

              {/* ACTIVE LESSON VIEW STAGE */}
              <div className="space-y-4">
                
                {/* 1. Video Player Container */}
                {activeItem.type === "video" && (
                  (() => {
                    const embedUrl = getYouTubeEmbedUrl(activeItem.url);
                    if (embedUrl) {
                      return (
                        <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-lg">
                          <iframe
                            width="100%"
                            height="100%"
                            src={embedUrl}
                            title={activeItem.title}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                        </div>
                      );
                    } else {
                      return (
                        <div className="bg-slate-950 border border-slate-850 rounded-2xl p-8 text-center space-y-4">
                          <Video className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                          <div className="max-w-md mx-auto space-y-2">
                            <h4 className="text-sm font-bold text-slate-200">Vídeo Externo Prontificado</h4>
                            <p className="text-xs text-slate-400">Esta videoaula está hospedada em uma plataforma externa. Clique no botão abaixo para assistir em tela cheia.</p>
                          </div>
                          {activeItem.url ? (
                            <a
                              href={activeItem.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs transition shadow-md cursor-pointer"
                            >
                              <ExternalLink className="w-4 h-4" />
                              <span>Assistir Aula Externa</span>
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">Sem link cadastrado para este vídeo.</span>
                          )}
                        </div>
                      );
                    }
                  })()
                )}

                {/* 2. PDF Study Container */}
                {activeItem.type === "pdf" && (
                  <div className="bg-slate-950 border border-slate-850 rounded-2xl p-6 text-center space-y-4">
                    <FileText className="w-12 h-12 text-emerald-400 mx-auto" />
                    <div className="max-w-md mx-auto space-y-2">
                      <h4 className="text-sm font-bold text-slate-200">Material de Estudos PDF Esquematizado</h4>
                      <p className="text-xs text-slate-400">Baixe o PDF principal do resumo elaborado por nossos instrutores ou inicie a leitura focada diretamente na plataforma.</p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      {activeItem.contentMarkdown && (
                        <button
                          onClick={() => setSelectedReadingItem(activeItem)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs transition shadow-md cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4" />
                          <span>Ler na Plataforma</span>
                        </button>
                      )}
                      
                      {activeItem.url ? (
                        <a
                          href={activeItem.url}
                          target="_blank"
                          download
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs transition shadow-md cursor-pointer"
                        >
                          <Download className="w-4 h-4 animate-bounce" />
                          <span>Baixar Resumo PDF</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">Sem PDF cadastrado</span>
                      )}
                    </div>
                  </div>
                )}

                {/* 3. Simulado Stage */}
                {activeItem.type === "simulado" && (
                  <div className="bg-slate-950 border border-slate-850 rounded-2xl p-8 text-center space-y-4">
                    <ClipboardList className="w-12 h-12 text-amber-500 mx-auto animate-pulse" />
                    <div className="max-w-md mx-auto space-y-2">
                      <h4 className="text-sm font-bold text-slate-200">Simulado de Combate Gabaritado</h4>
                      <p className="text-xs text-slate-400">Este exercício cronometrado irá mensurar seu aproveitamento e reforçar seu vertical de estudos.</p>
                    </div>
                    {activeItem.url ? (
                      <a
                        href={activeItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs transition shadow-md cursor-pointer uppercase tracking-wider"
                      >
                        <ClipboardList className="w-4 h-4" />
                        <span>Iniciar Simulado</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">Simulado sem link cadastrado</span>
                    )}
                  </div>
                )}

                {/* 4. Support Link Stage */}
                {activeItem.type === "link" && (
                  <div className="bg-slate-950 border border-slate-850 rounded-2xl p-8 text-center space-y-4">
                    <ExternalLink className="w-12 h-12 text-indigo-400 mx-auto" />
                    <div className="max-w-md mx-auto space-y-2">
                      <h4 className="text-sm font-bold text-slate-200">Hiperlink / Plataforma de Apoio</h4>
                      <p className="text-xs text-slate-400">Clique no link de redirecionamento abaixo para abrir as fontes externas, leis oficiais secas ou portais de questões complementares.</p>
                    </div>
                    {activeItem.url ? (
                      <a
                        href={activeItem.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs transition shadow-md cursor-pointer"
                      >
                        <span>Acessar Link Externo</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500">Link indisponível</span>
                    )}
                  </div>
                )}

              </div>

              {/* CLASS CONTROL BAR: CONCLUIR & NAVIGATE */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800 pt-5">
                
                {/* Mark Completed Button */}
                <button
                  onClick={() => toggleLessonCompletion(activeItem.id)}
                  className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 shadow-md ${
                    completedLessons.includes(activeItem.id)
                      ? "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30"
                      : "bg-emerald-500 hover:bg-emerald-600 text-slate-950"
                  }`}
                >
                  <Check className="w-4.5 h-4.5" />
                  <span>
                    {completedLessons.includes(activeItem.id) ? "Concluída ✓" : "Concluir Aula"}
                  </span>
                </button>

                {/* Prev / Next Buttons */}
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {(() => {
                    const flatList = filteredItems;
                    const curIdx = flatList.findIndex(i => i.id === activeItem.id);
                    
                    return (
                      <>
                        <button
                          disabled={curIdx <= 0}
                          onClick={() => {
                            if (curIdx > 0) setActiveItem(flatList[curIdx - 1]);
                          }}
                          className="flex-1 sm:flex-initial px-4 py-3 bg-slate-950 hover:bg-slate-850 text-slate-300 text-xs font-black rounded-xl transition border border-slate-850 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          Anterior
                        </button>
                        <button
                          disabled={curIdx === -1 || curIdx >= flatList.length - 1}
                          onClick={() => {
                            if (curIdx < flatList.length - 1) setActiveItem(flatList[curIdx + 1]);
                          }}
                          className="flex-1 sm:flex-initial px-4 py-3 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                        >
                          Próxima Aula
                        </button>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* LESSON DESCRIPTION & MATERIALS SUPPORT CARD */}
              <div className="space-y-4 pt-4 border-t border-slate-800/40">
                <div className="bg-slate-950/40 rounded-2xl p-4 border border-slate-850/60 space-y-2">
                  <h4 className="text-xs font-black uppercase text-amber-400 tracking-wider flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5" />
                    Descrição / Diretrizes de Estudos:
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {activeItem.subtitle || "Nenhuma anotação adicional disponível para esta aula."}
                  </p>
                </div>

                {/* ADDITIONAL PDF ATTACHMENTS FOR ACTIVE LESSON */}
                {activeItem.type === "pdf" && activeItem.additionalPdfs && activeItem.additionalPdfs.length > 0 && (
                  <div className="bg-slate-950/40 rounded-2xl p-4 border border-slate-850/60 space-y-3">
                    <h4 className="text-xs font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      Materiais e PDFs Adicionais de Suporte ({activeItem.additionalPdfs.length}):
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {activeItem.additionalPdfs.map((pdf, idx) => (
                        <a
                          key={idx}
                          href={pdf.url}
                          target="_blank"
                          download
                          rel="noopener noreferrer"
                          className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/30 hover:bg-slate-850/40 transition text-xs text-slate-300 group/pdf cursor-pointer"
                        >
                          <span className="truncate max-w-[180px] font-bold text-slate-300 group-hover/pdf:text-amber-400 transition-colors">
                            {pdf.name || `PDF Anexo #${idx + 1}`}
                          </span>
                          <span className="shrink-0 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-[9px] font-black tracking-wider flex items-center gap-1 group-hover/pdf:bg-emerald-500 group-hover/pdf:text-slate-950 transition">
                            <Download className="w-3.5 h-3.5" />
                            BAIXAR
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-white shadow-2xl flex flex-col items-center justify-center text-center min-h-[550px] space-y-5">
              <BookOpen className="w-16 h-16 text-slate-700 animate-pulse" />
              <div className="max-w-md space-y-2">
                <h3 className="text-lg font-extrabold text-slate-200">Sua Biblioteca de Elite PMBA</h3>
                <p className="text-xs text-slate-400 leading-relaxed">Selecione um módulo ou aula no menu de navegação lateral para acessar videoaulas exclusivas, resumos completos e simulados táticos.</p>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Embedded Rich Markdown Document Reader Modal */}
      {selectedReadingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div 
            className={`bg-slate-900 border border-slate-800 flex flex-col overflow-hidden text-white shadow-2xl transition-all duration-300 ${
              sidebarMinimized 
                ? "max-w-5xl w-full h-[90vh] max-h-[90vh] rounded-3xl" 
                : "max-w-3xl w-full max-h-[85vh] rounded-3xl"
            }`}
          >
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-950/30">
              <div className="flex-1 min-w-0 pr-4">
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">
                  Resumo Pedagógico • Mentor de Estudos IA
                </span>
                <h3 className="text-lg font-extrabold text-white leading-snug truncate">
                  {selectedReadingItem.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1 truncate">
                  {selectedReadingItem.subtitle}
                </p>
              </div>
              
              <div className="flex items-center gap-2 shrink-0">
                {setSidebarMinimized && (
                  <button
                    onClick={() => setSidebarMinimized(!sidebarMinimized)}
                    className="p-1.5 rounded-lg bg-slate-850 hover:bg-slate-800 hover:text-amber-400 border border-slate-800 text-slate-300 transition-colors flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    title={sidebarMinimized ? "Sair da Tela Cheia" : "Modo Leitura Focada (Tela Cheia)"}
                  >
                    {sidebarMinimized ? (
                      <>
                        <Minimize2 className="w-3.5 h-3.5 text-amber-400" />
                        <span className="hidden sm:inline">Sair Foco</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="hidden sm:inline">Tela Cheia</span>
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => setSelectedReadingItem(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition cursor-pointer font-extrabold text-base leading-none"
                  title="Fechar"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Document Content */}
            <div className={`p-6 overflow-y-auto space-y-2 select-text transition-all duration-300 ${
              sidebarMinimized ? "max-h-[75vh]" : "max-h-[60vh]"
            }`}>
              {(() => {
                const text = (selectedReadingItem.contentMarkdown || "").replace(/<br\s*\/?>/gi, "\n");
                
                const parseBoldText = (str: string) => {
                  const parts = str.split(/\*\*(.*?)\*\*/g);
                  return parts.flatMap((part, i) => {
                    if (i % 2 === 1) {
                      return [<strong key={`b-${i}`} className="text-amber-400 font-black">{part}</strong>];
                    }
                    const subparts = part.split(/\*(.*?)\*/g);
                    return subparts.map((subpart, j) => {
                      if (j % 2 === 1) {
                        return <strong key={`s-${i}-${j}`} className="text-amber-400 font-bold italic">{subpart}</strong>;
                      }
                      return subpart;
                    });
                  });
                };

                const lines = text.split("\n");
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
                      <h4 key={idx} className="text-xs font-black text-amber-400 uppercase tracking-wider mt-4 mb-2 font-mono">
                        {trimmed.replace(/^###\s*/, "")}
                      </h4>
                    );
                    return;
                  }
                  if (trimmed.startsWith("##")) {
                    flushList(idx);
                    elements.push(
                      <h3 key={idx} className="text-sm font-black text-white uppercase tracking-wider mt-5 mb-2.5 border-b border-slate-800 pb-1 font-mono">
                        {trimmed.replace(/^##\s*/, "")}
                      </h3>
                    );
                    return;
                  }
                  if (trimmed.startsWith("#")) {
                    flushList(idx);
                    elements.push(
                      <h2 key={idx} className="text-base font-black text-amber-500 uppercase tracking-widest mt-6 mb-3">
                        {trimmed.replace(/^#\s*/, "")}
                      </h2>
                    );
                    return;
                  }

                  if (trimmed.startsWith("-") || trimmed.startsWith("*")) {
                    const textContent = trimmed.substring(1).trim();
                    if (textContent !== "" && !textContent.match(/^[-\*]*$/)) {
                      listItems.push(
                        <li key={`li-${idx}`} className="text-xs text-slate-300 mb-1 leading-relaxed pl-1 py-1">
                          {parseBoldText(textContent)}
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
                    <p key={idx} className="text-xs text-slate-300 leading-relaxed my-2">
                      {parseBoldText(trimmed)}
                    </p>
                  );
                });

                flushList("final");
                flushTable("final");

                return elements;
              })()}
            </div>

            {/* Footer with actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <span className="text-[10px] text-slate-500 font-mono">
                Criado em {new Date(selectedReadingItem.createdAt).toLocaleDateString("pt-BR")}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedReadingItem.contentMarkdown || "");
                    alert("Copiado para a área de transferência!");
                  }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Copiar Texto
                </button>
                <button
                  onClick={() => setSelectedReadingItem(null)}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer"
                >
                  Concluir Leitura
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
