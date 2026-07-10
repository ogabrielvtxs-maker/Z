import React, { useState, useEffect } from "react";
import { User, StudyCycle, WeeklyReport } from "../types";
import PerformanceStats from "./PerformanceStats";
import ContentArea from "./ContentArea";
import { Users, Calendar, BarChart2, Mail, Check, X, Shield, BookOpen, AlertCircle, Send, Award, Trash, Edit3, UserPlus, Plus, Minus } from "lucide-react";
import { 
  saveStudyCycleToFirestore, 
  saveReportToFirestore, 
  deleteReportFromFirestore,
  fetchAllReportsFromFirestore 
} from "../lib/firebase";

interface AdminPanelProps {
  currentUser: User;
  allUsers: User[];
  onUpdateUser: (updatedUser: User) => void;
  onDeleteUser: (userId: string) => void;
  onAddUser?: (newUser: User) => void;
}

export default function AdminPanel({ currentUser, allUsers, onUpdateUser, onDeleteUser, onAddUser }: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"users" | "cycle" | "stats" | "correio" | "content">("users");
  
  // State for selected student to view/edit cycle or stats
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");

  // User creation states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserAccessSoldado, setNewUserAccessSoldado] = useState(true);
  const [newUserAccessCFO, setNewUserAccessCFO] = useState(false);
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserIsApproved, setNewUserIsApproved] = useState(true);

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setNotification({ type: "error", message: "Por favor, preencha nome, e-mail e senha do usuário." });
      return;
    }

    const emailLower = newUserEmail.toLowerCase().trim();
    const emailExists = allUsers.some(u => u && u.email && u.email.toLowerCase().trim() === emailLower);
    if (emailExists) {
      setNotification({ type: "error", message: "Este e-mail já está cadastrado na plataforma." });
      return;
    }

    const newUser: User = {
      id: "usr_" + Math.random().toString(36).substring(2, 11),
      name: newUserName.trim(),
      email: emailLower,
      password: newUserPassword.trim(),
      accessSoldado: newUserAccessSoldado,
      accessCFO: newUserAccessCFO,
      isAdmin: newUserIsAdmin,
      isApproved: newUserIsApproved,
      createdAt: new Date().toISOString()
    };

    if (onAddUser) {
      onAddUser(newUser);
      setNotification({ type: "success", message: `Usuário ${newUser.name} criado com sucesso!` });
      // Reset form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserAccessSoldado(true);
      setNewUserAccessCFO(false);
      setNewUserIsAdmin(false);
      setNewUserIsApproved(true);
      setShowCreateForm(false);
    } else {
      setNotification({ type: "error", message: "Função de criação de usuário não disponível." });
    }
  };

  // Cycle builder states
  const [targetWeek, setTargetWeek] = useState<number>(1);
  const [cycleDays, setCycleDays] = useState<{
    dayNumber: number;
    questionTarget: number;
    subjects: string[];
  }[]>([
    { dayNumber: 1, questionTarget: 15, subjects: ["Língua Portuguesa: Crase", "Direito Constitucional: Artigo 5º"] },
    { dayNumber: 2, questionTarget: 15, subjects: ["Língua Inglesa: Plurais", "Direito Penal: Consumação e Tentativa"] },
    { dayNumber: 3, questionTarget: 20, subjects: ["Matemática: Progressão Aritmética", "Informática: Word e Writer"] },
    { dayNumber: 4, questionTarget: 15, subjects: ["Direitos Humanos: Declaração 1948", "História da Bahia: Canudos"] },
    { dayNumber: 5, questionTarget: 20, subjects: ["Direito Administrativo: Princípios", "Geografia da Bahia: Climatologia"] },
    { dayNumber: 6, questionTarget: 15, subjects: ["Direito Penal Militar: Motim", "Matemática: Matrizes"] },
    { dayNumber: 7, questionTarget: 30, subjects: ["Simulado Geral de Revisão"] }
  ]);

  // Mail / Report states
  const [reportWeek, setReportWeek] = useState<number>(1);
  const [reportContent, setReportContent] = useState<string>("");
  const [existingReports, setExistingReports] = useState<WeeklyReport[]>([]);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [reportToDeleteId, setReportToDeleteId] = useState<string | null>(null);

  // Auto dismiss notifications
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Approved students list for selectors
  const approvedStudents = allUsers.filter((u) => u && u.isApproved && !u.isAdmin);

  useEffect(() => {
    if (approvedStudents.length > 0 && !selectedStudentId) {
      setSelectedStudentId(approvedStudents[0].id);
    }
  }, [allUsers, approvedStudents, selectedStudentId]);

  // Load existing reports on mount and when student changes
  useEffect(() => {
    const loadReports = async () => {
      const saved = localStorage.getItem("all_reports");
      if (saved) {
        try {
          setExistingReports(JSON.parse(saved));
        } catch (e) {
          setExistingReports([]);
        }
      }

      try {
        const fsReports = await fetchAllReportsFromFirestore();
        if (fsReports.length > 0) {
          localStorage.setItem("all_reports", JSON.stringify(fsReports));
          setExistingReports(fsReports);
        }
      } catch (err) {
        console.error("Error loading reports from Firestore:", err);
      }
    };

    loadReports();
  }, [selectedStudentId]);

  // Cycle day modification helper
  const handleDayFieldChange = (dayNum: number, field: "questionTarget", val: number) => {
    setCycleDays(
      cycleDays.map((d) => (d.dayNumber === dayNum ? { ...d, [field]: Math.max(1, val) } : d))
    );
  };

  const handleDaySubjectChange = (dayNum: number, subIdx: number, val: string) => {
    setCycleDays(
      cycleDays.map((d) => {
        if (d.dayNumber === dayNum) {
          const subs = [...d.subjects];
          subs[subIdx] = val;
          return { ...d, subjects: subs };
        }
        return d;
      })
    );
  };

  const handleAddSubjectToDay = (dayNum: number) => {
    setCycleDays(
      cycleDays.map((d) => {
        if (d.dayNumber === dayNum) {
          if (d.subjects.length >= 4) {
            setNotification({ type: "error", message: "Limite máximo de 4 matérias por dia atingido." });
            return d;
          }
          return { ...d, subjects: [...d.subjects, "Nova Matéria"] };
        }
        return d;
      })
    );
  };

  const handleRemoveSubjectFromDay = (dayNum: number, subIdx: number) => {
    setCycleDays(
      cycleDays.map((d) => {
        if (d.dayNumber === dayNum) {
          const subs = d.subjects.filter((_, idx) => idx !== subIdx);
          return { ...d, subjects: subs };
        }
        return d;
      })
    );
  };

  const handleAddDayToCycle = () => {
    const nextDayNum = cycleDays.length + 1;
    setCycleDays([
      ...cycleDays,
      { dayNumber: nextDayNum, questionTarget: 15, subjects: ["Nova Matéria"] }
    ]);
  };

  const handleAddMultipleDaysToCycle = (count: number) => {
    const newDays = [...cycleDays];
    for (let i = 0; i < count; i++) {
      const nextDayNum = newDays.length + 1;
      newDays.push({
        dayNumber: nextDayNum,
        questionTarget: 15,
        subjects: [`Matéria de Alocação Dia ${nextDayNum}`]
      });
    }
    setCycleDays(newDays);
  };

  const handleRemoveLastDayFromCycle = () => {
    if (cycleDays.length <= 1) {
      setNotification({ type: "error", message: "O ciclo deve conter no mínimo 1 dia." });
      return;
    }
    setCycleDays(cycleDays.slice(0, -1));
  };

  const handleResetCycleToDefault = () => {
    setCycleDays([
      { dayNumber: 1, questionTarget: 15, subjects: ["Língua Portuguesa: Crase", "Direito Constitucional: Artigo 5º"] },
      { dayNumber: 2, questionTarget: 15, subjects: ["Língua Inglesa: Plurais", "Direito Penal: Consumação e Tentativa"] },
      { dayNumber: 3, questionTarget: 20, subjects: ["Matemática: Progressão Aritmética", "Informática: Word e Writer"] },
      { dayNumber: 4, questionTarget: 15, subjects: ["Direitos Humanos: Declaração 1948", "História da Bahia: Canudos"] },
      { dayNumber: 5, questionTarget: 20, subjects: ["Direito Administrativo: Princípios", "Geografia da Bahia: Climatologia"] },
      { dayNumber: 6, questionTarget: 15, subjects: ["Direito Penal Militar: Motim", "Matemática: Matrizes"] },
      { dayNumber: 7, questionTarget: 30, subjects: ["Simulado Geral de Revisão"] }
    ]);
  };

  // Save student cycle
  const handleSaveStudentCycle = async () => {
    if (!selectedStudentId) {
      setNotification({ type: "error", message: "Por favor, selecione um aluno para receber o ciclo." });
      return;
    }

    const student = allUsers.find((u) => u.id === selectedStudentId);
    if (!student) return;

    const newCycle: StudyCycle = {
      id: "cycle_" + Date.now(),
      studentId: selectedStudentId,
      studentName: student.name,
      weekNumber: targetWeek,
      isCompleted: false,
      unlockedAt: new Date().toISOString(),
      days: cycleDays.map((d) => ({
        dayNumber: d.dayNumber,
        questionTarget: d.questionTarget,
        questionSolved: 0,
        completed: false,
        subjects: d.subjects
          .filter((sub) => sub.trim() !== "")
          .map((sub, sIdx) => ({
            id: `sub_${d.dayNumber}_${sIdx}_${Date.now()}`,
            name: sub,
            completed: false
          }))
      }))
    };

    localStorage.setItem(`study_cycle_${selectedStudentId}`, JSON.stringify(newCycle));
    
    try {
      await saveStudyCycleToFirestore(selectedStudentId, newCycle);
    } catch (e) {
      console.error("Error saving cycle to Firestore:", e);
    }
    
    // Dispatch a storage event so that other components (like WeeklyCycle) update immediately
    window.dispatchEvent(new Event("storage"));
    
    setNotification({
      type: "success",
      message: `Sucesso! Ciclo de estudos da Semana ${targetWeek} publicado para o aluno: ${student.name}`
    });
  };

  // Send Report / Correio
  const handleSendReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId) {
      setNotification({ type: "error", message: "Selecione um aluno." });
      return;
    }
    if (!reportContent.trim()) {
      setNotification({ type: "error", message: "Escreva o conteúdo do relatório." });
      return;
    }

    const savedReportsStr = localStorage.getItem("all_reports") || "[]";
    let savedReports: WeeklyReport[] = [];
    try {
      savedReports = JSON.parse(savedReportsStr);
    } catch (e) {
      savedReports = [];
    }

    // Check if report already exists for this week & student (if so, we overwrite/edit)
    const existingIndex = savedReports.findIndex(
      (r) => r.studentId === selectedStudentId && r.weekNumber === reportWeek
    );

    const now = new Date().toISOString();
    let targetReport: WeeklyReport;
    
    if (existingIndex > -1) {
      savedReports[existingIndex].content = reportContent;
      savedReports[existingIndex].updatedAt = now;
      targetReport = savedReports[existingIndex];
      setNotification({ type: "success", message: "Relatório semanal editado e atualizado com sucesso!" });
    } else {
      const newReport: WeeklyReport = {
        id: "rep_" + Date.now(),
        studentId: selectedStudentId,
        weekNumber: reportWeek,
        content: reportContent,
        createdAt: now,
        updatedAt: now
      };
      savedReports.unshift(newReport);
      targetReport = newReport;
      setNotification({ type: "success", message: "Relatório semanal enviado para a caixa de correio do aluno!" });
    }

    localStorage.setItem("all_reports", JSON.stringify(savedReports));
    setExistingReports(savedReports);
    setReportContent("");

    try {
      await saveReportToFirestore(targetReport);
    } catch (e) {
      console.error("Error saving report to Firestore:", e);
    }
  };

  const handleDeleteReport = (id: string) => {
    setReportToDeleteId(id);
  };

  const handleConfirmDeleteReport = async (id: string) => {
    const updated = existingReports.filter((r) => r.id !== id);
    localStorage.setItem("all_reports", JSON.stringify(updated));
    setExistingReports(updated);
    setReportToDeleteId(null);
    setNotification({ type: "success", message: "Relatório removido com sucesso!" });

    try {
      await deleteReportFromFirestore(id);
    } catch (e) {
      console.error("Error deleting report from Firestore:", e);
    }
  };

  return (
    <div id="admin-panel-component" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl">
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-800 pb-4">
        <div className="p-2.5 bg-amber-400 rounded-xl text-slate-950 shadow-md">
          <Shield className="w-5 h-5 text-slate-950" />
        </div>
        <div>
          <h2 className="text-lg font-extrabold text-amber-400 uppercase tracking-wider">Painel Administrativo Coordenador</h2>
          <p className="text-slate-400 text-xs">Gestão de acessos, ciclos personalizados, relatórios semanais e homologação.</p>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className={`p-4 mb-6 rounded-xl border flex items-center justify-between text-xs font-bold animate-fade-in ${
          notification.type === "success" 
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
            : "bg-rose-500/10 border-rose-500/30 text-rose-400"
        }`}>
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{notification.message}</span>
          </div>
          <button 
            type="button"
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selector Subtabs */}
      <div className="flex flex-wrap gap-2 mb-6 bg-slate-950 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => setActiveSubTab("users")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === "users" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <Users className="w-4 h-4" />
          Membros e Aprovações
        </button>
        <button
          onClick={() => setActiveSubTab("cycle")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === "cycle" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Gerar Ciclo de Estudos
        </button>
        <button
          onClick={() => setActiveSubTab("stats")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === "stats" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          Estatísticas dos Alunos
        </button>
        <button
          onClick={() => setActiveSubTab("correio")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === "correio" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <Mail className="w-4 h-4" />
          Correio / Relatórios
        </button>
        <button
          onClick={() => setActiveSubTab("content")}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
            activeSubTab === "content" ? "bg-amber-400 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
          }`}
        >
          <BookOpen className="w-4 h-4" />
          Gerenciar Biblioteca
        </button>
      </div>

      {/* --- SUBTAB 1: MEMBERS APPROVAL --- */}
      {activeSubTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">Aprovação de Alunos PMBA</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-bold rounded-lg cursor-pointer transition shadow-sm"
              >
                {showCreateForm ? <Minus className="w-3.5 h-3.5" /> : <UserPlus className="w-3.5 h-3.5" />}
                {showCreateForm ? "Fechar Cadastro" : "Criar Novo Usuário"}
              </button>
              <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1.5 rounded-lg font-mono">
                Total Cadastros: {allUsers.length}
              </span>
            </div>
          </div>

          {showCreateForm && (
            <form onSubmit={handleCreateUserSubmit} className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4" />
                Cadastrar Novo Usuário e Definir Senha
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="Ex: Gabriel Jesus"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Endereço de E-mail</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="Ex: gabriel@pmba.com"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Senha de Acesso</label>
                  <input
                    type="text"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Defina a senha do aluno"
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none transition"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-900">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Soldado Access Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newUserAccessSoldado}
                      onChange={(e) => setNewUserAccessSoldado(e.target.checked)}
                      className="rounded border-slate-850 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300">Acesso Soldado</span>
                  </label>

                  {/* CFO Access Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newUserAccessCFO}
                      onChange={(e) => setNewUserAccessCFO(e.target.checked)}
                      className="rounded border-slate-850 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300">Acesso CFO</span>
                  </label>

                  {/* Admin Access Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newUserIsAdmin}
                      onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                      className="rounded border-slate-850 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 font-bold text-amber-400">Coordenador/Admin</span>
                  </label>

                  {/* Approved Checkbox */}
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={newUserIsApproved}
                      onChange={(e) => setNewUserIsApproved(e.target.checked)}
                      className="rounded border-slate-850 text-amber-500 focus:ring-0 focus:ring-offset-0 bg-slate-900 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300 font-bold text-emerald-400">Homologar Automaticamente</span>
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-400 text-xs rounded-lg font-semibold transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-extrabold rounded-lg transition cursor-pointer shadow-md"
                  >
                    Salvar Usuário
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="overflow-x-auto border border-slate-800 rounded-xl bg-slate-950/20">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="p-3">Nome / E-mail</th>
                  <th className="p-3 text-center">Senha de Acesso</th>
                  <th className="p-3 text-center">Acesso Soldado</th>
                  <th className="p-3 text-center">Acesso CFO</th>
                  <th className="p-3 text-center">Acesso Admin</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Ações de Gestão</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {allUsers.filter(Boolean).map((user) => (
                  <tr key={user.id} className="hover:bg-slate-950/40 transition">
                    <td className="p-3">
                      <span className="font-bold text-slate-200 block">{user.name}</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{user.email}</span>
                    </td>

                    {/* Password Management */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center max-w-[120px] mx-auto">
                        <input
                          type="text"
                          value={user.password || ""}
                          onChange={(e) => onUpdateUser({ ...user, password: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-800 hover:border-amber-400/50 focus:border-amber-400 rounded px-2 py-1 text-center font-mono text-[11px] text-amber-400 placeholder-slate-700 focus:outline-none transition"
                          placeholder="Sem senha"
                        />
                      </div>
                    </td>
                    
                    {/* Toggle Access Soldado */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onUpdateUser({ ...user, accessSoldado: !user.accessSoldado })}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                          user.accessSoldado 
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                            : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}
                      >
                        {user.accessSoldado ? "SIM" : "NÃO"}
                      </button>
                    </td>

                    {/* Toggle Access CFO */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onUpdateUser({ ...user, accessCFO: !user.accessCFO })}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                          user.accessCFO 
                            ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" 
                            : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}
                      >
                        {user.accessCFO ? "SIM" : "NÃO"}
                      </button>
                    </td>

                    {/* Toggle Admin */}
                    <td className="p-3 text-center">
                      <button
                        onClick={() => onUpdateUser({ ...user, isAdmin: !user.isAdmin })}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition cursor-pointer ${
                          user.isAdmin 
                            ? "bg-amber-400/10 border-amber-400/20 text-amber-400" 
                            : "bg-slate-950 border-slate-800 text-slate-500"
                        }`}
                      >
                        {user.isAdmin ? "ADMIN" : "ALUNO"}
                      </button>
                    </td>

                    {/* Status approved */}
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-[5px] text-[10px] font-mono font-bold ${
                        user.isApproved 
                          ? "bg-emerald-500/10 text-emerald-400" 
                          : "bg-amber-500/10 text-amber-400 animate-pulse"
                      }`}>
                        {user.isApproved ? "HOMOLOGADO" : "PENDENTE"}
                      </span>
                    </td>

                    {/* Approve/Decline actions */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {!user.isApproved ? (
                          <button
                            onClick={() => onUpdateUser({ ...user, isApproved: true })}
                            className="p-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 transition cursor-pointer"
                            title="Aprovar Aluno"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => onUpdateUser({ ...user, isApproved: false })}
                            className="p-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 transition cursor-pointer"
                            title="Suspender Aluno"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        
                        {/* Delete User */}
                        {user.id !== currentUser.id && (
                          <button
                            onClick={() => onDeleteUser(user.id)}
                            className="p-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 transition cursor-pointer"
                            title="Excluir Usuário"
                          >
                            <Trash className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- SUBTAB 2: CREATE STUDY CYCLE --- */}
      {activeSubTab === "cycle" && (
        <div className="space-y-6">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <h3 className="font-bold text-sm text-slate-200 mb-4 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-amber-400" />
              Parâmetros de Alocação do Ciclo
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Selecione o Aluno Alvo</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer"
                >
                  <option value="">Selecione um aluno...</option>
                  {approvedStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.accessCFO ? "CFO" : ""} {student.accessSoldado ? "Soldado" : ""})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Número da Semana do Ciclo</label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={targetWeek}
                  onChange={(e) => setTargetWeek(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Builder Day-by-Day Editor */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 border-b border-slate-850 pb-2">
              Planejamento de Metas Diárias (Máximo 4 matérias por dia)
            </h4>

            {/* Custom Cycle Length Controls */}
            <div className="bg-slate-950 p-4 border border-slate-850 rounded-xl space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                Duração do Ciclo Atual: <span className="text-white font-mono font-black">{cycleDays.length} Dias</span>
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddDayToCycle}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-amber-400/40 text-xs rounded-lg text-slate-200 font-semibold cursor-pointer transition"
                >
                  +1 Dia
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMultipleDaysToCycle(7)}
                  className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs rounded-lg font-bold cursor-pointer transition shadow-sm"
                >
                  +7 Dias de Uma Vez
                </button>
                <button
                  type="button"
                  onClick={() => handleAddMultipleDaysToCycle(14)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-amber-400/40 text-xs rounded-lg text-slate-200 font-semibold cursor-pointer transition"
                >
                  +14 Dias de Uma Vez
                </button>
                <button
                  type="button"
                  onClick={handleRemoveLastDayFromCycle}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-rose-900 text-rose-400 text-xs rounded-lg font-semibold cursor-pointer transition"
                  disabled={cycleDays.length <= 1}
                >
                  Remover Último Dia
                </button>
                <button
                  type="button"
                  onClick={handleResetCycleToDefault}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs rounded-lg text-slate-400 font-semibold cursor-pointer transition"
                >
                  Resetar para Padrão (7 Dias)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cycleDays.map((day, idx) => (
                <div key={day.dayNumber} className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                    <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider font-mono">
                      Dia {day.dayNumber}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400">Meta Questões:</span>
                      <input
                        type="number"
                        min="5"
                        max="200"
                        value={day.questionTarget}
                        onChange={(e) => handleDayFieldChange(day.dayNumber, "questionTarget", parseInt(e.target.value) || 15)}
                        className="w-12 bg-slate-900 border border-slate-800 rounded text-center text-xs text-slate-200 font-mono py-0.5"
                      />
                    </div>
                  </div>

                  {/* Day subjects list */}
                  <div className="space-y-2">
                    {day.subjects.map((sub, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={sub}
                          onChange={(e) => handleDaySubjectChange(day.dayNumber, sIdx, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-850 rounded px-2.5 py-1 text-[11px] text-slate-200"
                          placeholder="Ex: Português: Crase"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveSubjectFromDay(day.dayNumber, sIdx)}
                          className="p-1 rounded text-rose-500 hover:bg-rose-500/10 transition"
                          title="Remover"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {day.subjects.length < 4 && (
                      <button
                        type="button"
                        onClick={() => handleAddSubjectToDay(day.dayNumber)}
                        className="text-[10px] font-bold text-amber-400 hover:underline flex items-center gap-1 mt-1"
                      >
                        + Adicionar Matéria ({day.subjects.length}/4)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleSaveStudentCycle}
              className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs transition uppercase tracking-wider cursor-pointer shadow-md mt-4"
            >
              Publicar Ciclo para o Aluno Selecionado
            </button>
          </div>
        </div>
      )}

      {/* --- SUBTAB 3: VIEW STUDENT STATS --- */}
      {activeSubTab === "stats" && (() => {
        // Fetch all student logs for general master grid
        const logsList: any[] = [];
        approvedStudents.forEach((student) => {
          const saved = localStorage.getItem(`performance_logs_${student.id}`);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed)) {
                parsed.forEach((log) => {
                  logsList.push({
                    ...log,
                    studentName: student.name,
                    studentEmail: student.email,
                  });
                });
              }
            } catch (e) {
              // ignore
            }
          }
        });
        const sortedAllLogs = logsList.sort((a, b) => (b.id || "").localeCompare(a.id || ""));

        return (
          <div className="space-y-6">
            {/* Quick selector for deep auditing */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Users className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm uppercase tracking-wider">Auditoria Individual de Alunos</h3>
                  <p className="text-[10px] text-slate-400">Selecione um aluno específico para ver o Caderno de Erros completo e os diagnósticos detalhados.</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-200 cursor-pointer focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Selecione o Aluno para Auditoria Individual --</option>
                  {approvedStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name} ({student.email})
                    </option>
                  ))}
                </select>
                {selectedStudentId && (
                  <button
                    onClick={() => setSelectedStudentId("")}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded-xl cursor-pointer transition"
                  >
                    Ver Painel Geral
                  </button>
                )}
              </div>
            </div>

            {selectedStudentId ? (
              <div className="border border-slate-800 rounded-2xl p-2 bg-slate-950/20">
                <PerformanceStats currentUser={currentUser} overrideStudentId={selectedStudentId} />
              </div>
            ) : (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-white shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-amber-400" />
                    <div>
                      <h3 className="font-bold text-sm uppercase tracking-wider text-slate-200">Painel Geral de Dificuldades (Toda a Tropa)</h3>
                      <p className="text-[10px] text-slate-400">Visão consolidada de todas as matérias, assuntos específicos e motivos de erro lançados por todos os alunos.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-amber-400/10 text-amber-400 px-2.5 py-1 rounded-md">
                    Total Lançamentos: {sortedAllLogs.length}
                  </span>
                </div>

                {sortedAllLogs.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    Nenhum aluno lançou histórico de desempenho ou caderno de erros até o momento.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="p-3">Aluno / Turma</th>
                          <th className="p-3">Matéria / Assunto</th>
                          <th className="p-3">Tópico Detalhado</th>
                          <th className="p-3">Motivo Principal do Erro</th>
                          <th className="p-3 text-center">Acertos</th>
                          <th className="p-3 text-center">Aproveitamento</th>
                          <th className="p-3 text-center">Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/40">
                        {sortedAllLogs.map((log) => {
                          const pct = Math.round((log.questionsCorrect / log.questionsAttempted) * 100);
                          return (
                            <tr key={log.id} className="hover:bg-slate-950/40 transition">
                              <td className="p-3">
                                <span className="font-bold text-amber-400 block">{log.studentName}</span>
                                <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">{log.studentEmail}</span>
                              </td>
                              <td className="p-3">
                                <span className="font-extrabold text-slate-200 block">{log.subject}</span>
                              </td>
                              <td className="p-3">
                                <span className="text-slate-300 block">{log.topic}</span>
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-1.5">
                                  <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                                  <span className="text-slate-300 font-medium">{log.reasonForError}</span>
                                </div>
                              </td>
                              <td className="p-3 text-center font-mono text-slate-400">
                                {log.questionsCorrect}/{log.questionsAttempted}
                              </td>
                              <td className="p-3 text-center">
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
                              <td className="p-3 text-center text-slate-500 font-mono">
                                {log.date}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* --- SUBTAB 4: WEEKLY FEEDBACK REPORTS / CORREIO --- */}
      {activeSubTab === "correio" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Writer form */}
            <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-850 space-y-4">
              <h3 className="font-bold text-sm text-amber-400 uppercase tracking-wider flex items-center gap-1">
                <Send className="w-4 h-4" />
                Redigir Relatório de Desempenho
              </h3>

              <form onSubmit={handleSendReport} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Destinatário Aluno</label>
                    <select
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 cursor-pointer"
                      required
                    >
                      <option value="">Escolha...</option>
                      {approvedStudents.map((student) => (
                        <option key={student.id} value={student.id}>{student.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Semana de Referência</label>
                    <input
                      type="number"
                      min="1"
                      max="52"
                      value={reportWeek}
                      onChange={(e) => setReportWeek(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-200 font-mono"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Parecer de Desempenho / Orientações do Coordenador</label>
                  <textarea
                    rows={6}
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    placeholder="Escreva seu parecer tático aqui... Ex: 'Soldado, observei que seu aproveitamento em Análise Combinatória está em 40%. Sugiro revisar a teoria do Binômio de Newton antes de realizar mais exercícios de fixação nesta semana...'"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-2.5 rounded-xl text-xs transition uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Enviar Relatório Semanal
                </button>
              </form>
            </div>

            {/* List of Sent reports */}
            <div className="bg-slate-950/40 p-5 rounded-xl border border-slate-850 space-y-4">
              <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider">
                Relatórios Enviados Anteriores
              </h3>

              <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                {existingReports.map((report) => {
                  const student = allUsers.find((u) => u.id === report.studentId);
                  return (
                    <div key={report.id} className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 space-y-2 relative overflow-hidden">
                      {reportToDeleteId === report.id && (
                        <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center p-3 text-center z-10 animate-fade-in">
                          <span className="text-[11px] font-bold text-slate-200">Excluir este relatório?</span>
                          <div className="flex items-center gap-2 mt-2">
                            <button
                              type="button"
                              onClick={() => setReportToDeleteId(null)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-[10px] font-bold rounded cursor-pointer text-slate-300"
                            >
                              Não
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteReport(report.id)}
                              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-[10px] font-extrabold rounded text-white cursor-pointer"
                            >
                              Excluir
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Aluno: {student ? student.name : "Desconhecido"}</span>
                          <span className="text-[9px] text-amber-400 font-bold font-mono">Semana {report.weekNumber}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteReport(report.id)}
                          className="p-1 rounded hover:bg-rose-950 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          title="Excluir"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-300 whitespace-pre-line leading-relaxed">
                        {report.content}
                      </p>
                      <span className="text-[9px] text-slate-500 font-mono block text-right">
                        Enviado em: {report.createdAt.split("T")[0]}
                      </span>
                    </div>
                  );
                })}

                {existingReports.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-xs italic">
                    Nenhum relatório de desempenho postado no momento.
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- SUBTAB 5: CONTENT LIBRARY / BIBLIOTECA --- */}
      {activeSubTab === "content" && (
        <div className="space-y-4">
          <ContentArea currentUser={currentUser} />
        </div>
      )}

    </div>
  );
}
