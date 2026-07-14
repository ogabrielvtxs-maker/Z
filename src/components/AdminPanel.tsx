import React, { useState, useEffect } from "react";
import { User, StudyCycle, WeeklyReport, PerformanceLog, PasswordResetRequest } from "../types";
import PerformanceStats from "./PerformanceStats";
import ContentArea from "./ContentArea";
import { 
  Users, 
  Calendar, 
  BarChart2, 
  Mail, 
  Check, 
  X, 
  Shield, 
  BookOpen, 
  AlertCircle, 
  Send, 
  Award, 
  Trash, 
  Edit3, 
  UserPlus, 
  Plus, 
  Minus,
  FileText,
  RefreshCw,
  Bell,
  Sparkles,
  Loader2,
  Key,
  CheckCircle,
  ChevronDown
} from "lucide-react";
import { 
  saveStudyCycleToFirestore, 
  deleteStudyCycleFromFirestore,
  fetchStudyCycleFromFirestore,
  saveReportToFirestore, 
  deleteReportFromFirestore,
  fetchAllReportsFromFirestore,
  fetchPrivateStudentNotesFromFirestore,
  savePrivateStudentNotesToFirestore,
  googleSignInWithGmail,
  fetchPasswordResetRequestsFromFirestore,
  deletePasswordResetRequestFromFirestore,
  savePasswordResetRequestToFirestore,
  adminUpdateUserPassword
} from "../lib/firebase";
import { sendGmailMessage } from "../lib/gmail";
import { stripMarkdownAsterisks } from "../lib/textCleanup";

const calculateDefaultEndDate = (planType: string, baseDateStr: string) => {
  if (!baseDateStr) return "";
  try {
    const baseDate = new Date(baseDateStr + "T12:00:00");
    if (isNaN(baseDate.getTime())) return "";
    if (planType === "mensal") {
      baseDate.setMonth(baseDate.getMonth() + 1);
      return baseDate.toISOString().split("T")[0];
    } else if (planType === "trimestral") {
      baseDate.setMonth(baseDate.getMonth() + 3);
      return baseDate.toISOString().split("T")[0];
    }
  } catch (e) {
    console.error("Error calculating end date:", e);
  }
  return "";
};

interface AdminPanelProps {
  currentUser: User;
  allUsers: User[];
  onUpdateUser: (updatedUser: User) => void;
  onDeleteUser: (userId: string) => void;
  onAddUser?: (newUser: User) => void;
}

export default function AdminPanel({ currentUser, allUsers, onUpdateUser, onDeleteUser, onAddUser }: AdminPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<"users" | "cycle" | "stats" | "correio" | "content">("users");
  
  // Student Private Notes states
  const [activeNotesStudentId, setActiveNotesStudentId] = useState<string | null>(null);
  const [currentNotesText, setCurrentNotesText] = useState<string>("");
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [savingNotes, setSavingNotes] = useState<boolean>(false);

  // Student Inactivity alerts state
  const [inactivityAlerts, setInactivityAlerts] = useState<{ student: User; daysInactive: number; lastActiveDate: string | null }[]>([]);
  const [showInactivityDetails, setShowInactivityDetails] = useState<boolean>(false);
  
  // State for selected student to view/edit cycle or stats
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [isCreateCycleOpen, setIsCreateCycleOpen] = useState<boolean>(false);

  // User creation states
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserAccessSoldado, setNewUserAccessSoldado] = useState(true);
  const [newUserAccessCFO, setNewUserAccessCFO] = useState(false);
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [newUserIsApproved, setNewUserIsApproved] = useState(true);
  const [newUserPlan, setNewUserPlan] = useState<"mensal" | "trimestral" | "indefinido">("indefinido");
  const [newUserPlanEndDate, setNewUserPlanEndDate] = useState<string>("");
  const [newUserCreatedAt, setNewUserCreatedAt] = useState<string>(new Date().toISOString().split("T")[0]);

  const handleNewUserPlanChange = (val: "mensal" | "trimestral" | "indefinido") => {
    setNewUserPlan(val);
    if (val !== "indefinido") {
      setNewUserPlanEndDate(calculateDefaultEndDate(val, newUserCreatedAt));
    } else {
      setNewUserPlanEndDate("");
    }
  };

  const handleNewUserCreatedAtChange = (dateVal: string) => {
    setNewUserCreatedAt(dateVal);
    if (newUserPlan !== "indefinido") {
      setNewUserPlanEndDate(calculateDefaultEndDate(newUserPlan, dateVal));
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword.trim()) {
      setNotification({ type: "error", message: "Por favor, preencha nome, e-mail e senha do aluno." });
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
      createdAt: newUserCreatedAt ? new Date(newUserCreatedAt + "T12:00:00").toISOString() : new Date().toISOString(),
      plan: newUserPlan,
      planEndDate: newUserPlanEndDate ? new Date(newUserPlanEndDate + "T12:00:00").toISOString() : ""
    };

    if (onAddUser) {
      onAddUser(newUser);
      setNotification({ type: "success", message: `Guerreiro ${newUser.name} criado com sucesso!` });
      // Reset form
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserAccessSoldado(true);
      setNewUserAccessCFO(false);
      setNewUserIsAdmin(false);
      setNewUserIsApproved(true);
      setNewUserPlan("indefinido");
      setNewUserPlanEndDate("");
      setNewUserCreatedAt(new Date().toISOString().split("T")[0]);
      setShowCreateForm(false);
    } else {
      setNotification({ type: "error", message: "Função de criação de aluno não disponível." });
    }
  };

  // Cycle builder states
  const [targetWeek, setTargetWeek] = useState<number>(1);
  const [adminSelectedWeek, setAdminSelectedWeek] = useState<number>(1);
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

  // Email sending loading state
  const [emailSendingId, setEmailSendingId] = useState<string | null>(null);

  const handleSendPasswordEmail = async (studentUser: User) => {
    try {
      setEmailSendingId(studentUser.id);
      
      // Get the cached Gmail access token
      let token = localStorage.getItem("gmail_oauth_token");
      if (!token) {
        // If not found, prompt them to sign in with Google to authorize the sending!
        const result = await googleSignInWithGmail();
        if (result?.accessToken) {
          token = result.accessToken;
        } else {
          throw new Error("Você precisa autorizar o acesso à sua conta do Google/Gmail para enviar e-mails de recuperação.");
        }
      }

      const subject = "🔑 Suas Credenciais de Acesso - Plataforma PMBA";
      const bodyHtml = `
        <div style="font-family: Arial, sans-serif; background-color: #070b14; color: #f1f5f9; padding: 30px; border-radius: 12px; max-width: 600px; margin: 0 auto; border: 1px solid #1e293b;">
          <div style="text-align: center; border-bottom: 2px solid #fbbf24; padding-bottom: 20px; margin-bottom: 25px;">
            <h1 style="color: #fbbf24; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Plataforma de Estudos PMBA</h1>
            <p style="color: #94a3b8; margin: 5px 0 0 0; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">CFO & Soldado - Preparação de Elite</p>
          </div>
          
          <p style="font-size: 14px; line-height: 1.6; color: #f1f5f9;">Olá <strong>${studentUser.name}</strong>,</p>
          
          <p style="font-size: 14px; line-height: 1.6; color: #e2e8f0;">A sua conta de acesso à Plataforma de Estudos da PMBA foi homologada e está ativa! Seguem abaixo as suas credenciais de acesso oficiais para você iniciar seus estudos:</p>
          
          <div style="background-color: #0f172a; border: 1px solid #334155; padding: 20px; border-radius: 8px; margin: 25px 0;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #94a3b8; font-weight: bold; width: 120px;">E-mail:</td>
                <td style="padding: 6px 0; color: #f1f5f9; font-family: monospace;">${studentUser.email}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8; font-weight: bold;">Senha:</td>
                <td style="padding: 6px 0; color: #fbbf24; font-family: monospace; font-weight: bold; font-size: 16px;">${studentUser.password || "<i>(Redefina usando a opção 'Esqueceu a senha?' na tela de login)</i>"}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #94a3b8; font-weight: bold;">Status:</td>
                <td style="padding: 6px 0; color: #10b981; font-weight: bold;">ATIVO & HOMOLOGADO</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin-top: 35px; border-top: 1px solid #1e293b; padding-top: 20px;">
            <p style="font-size: 11px; color: #64748b; margin: 0;">Este é um e-mail oficial enviado via integração de API do Gmail da Plataforma de Estudos PMBA.</p>
          </div>
        </div>
      `;

      const success = await sendGmailMessage(token, studentUser.email, subject, bodyHtml);
      if (success) {
        setNotification({ type: "success", message: `E-mail de credenciais enviado com sucesso para ${studentUser.email}!` });
      } else {
        throw new Error("Erro no envio da API do Gmail. Verifique as permissões de OAuth ou refaça a autorização.");
      }
    } catch (error: any) {
      console.error(error);
      setNotification({ type: "error", message: "Erro ao enviar e-mail: " + (error.message || error) });
    } finally {
      setEmailSendingId(null);
    }
  };

  const [resetRequests, setResetRequests] = useState<PasswordResetRequest[]>([]);
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false);
  const [editedPasswords, setEditedPasswords] = useState<Record<string, string>>({});
  const [updatingPasswordUserId, setUpdatingPasswordUserId] = useState<string | null>(null);
  const [showPlanAlertsDetails, setShowPlanAlertsDetails] = useState<boolean>(true);

  const loadPasswordResetRequests = async () => {
    setLoadingRequests(true);
    try {
      const requests = await fetchPasswordResetRequestsFromFirestore();
      setResetRequests(requests.filter(r => r.status === "pending"));
    } catch (error) {
      console.error("Erro ao carregar solicitações de redefinição de senha:", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleSavePassword = async (targetUser: User, newPassword: string) => {
    if (!newPassword || newPassword.trim().length < 6) {
      setNotification({ type: "error", message: "A senha deve ter pelo menos 6 caracteres." });
      return;
    }

    setUpdatingPasswordUserId(targetUser.id);
    const oldPassword = targetUser.password || "";
    try {
      await adminUpdateUserPassword(
        targetUser.email,
        oldPassword,
        newPassword.trim(),
        currentUser.email,
        currentUser.password || ""
      );

      const updatedUser = { ...targetUser, password: newPassword.trim() };
      onUpdateUser(updatedUser);

      setEditedPasswords(prev => {
        const copy = { ...prev };
        delete copy[targetUser.id];
        return copy;
      });

      setNotification({ type: "success", message: `Senha do aluno ${targetUser.name} atualizada com sucesso!` });
    } catch (err: any) {
      console.error(err);
      setNotification({ type: "error", message: err.message || "Erro ao redefinir senha do aluno." });
    } finally {
      setUpdatingPasswordUserId(null);
    }
  };

  useEffect(() => {
    loadPasswordResetRequests();
  }, []);

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
    // Calculate student inactivity alerts (inactive for 7+ days)
    const alerts: typeof inactivityAlerts = [];
    const now = new Date();

    approvedStudents.forEach((student) => {
      let latestLogDate: Date | null = null;
      const savedLogs = localStorage.getItem(`performance_logs_${student.id}`);
      if (savedLogs) {
        try {
          const logs = JSON.parse(savedLogs);
          if (Array.isArray(logs) && logs.length > 0) {
            logs.forEach((log) => {
              if (log.date) {
                const d = new Date(log.date);
                if (!isNaN(d.getTime())) {
                  if (!latestLogDate || d > latestLogDate) {
                    latestLogDate = d;
                  }
                }
              }
            });
          }
        } catch (e) {
          // ignore
        }
      }

      let daysInactive = 999; // Never active
      let lastActiveStr: string | null = null;

      if (latestLogDate) {
        const diffTime = Math.abs(now.getTime() - latestLogDate.getTime());
        daysInactive = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        lastActiveStr = latestLogDate.toLocaleDateString("pt-BR");
      }

      if (daysInactive >= 7) {
        alerts.push({
          student,
          daysInactive,
          lastActiveDate: lastActiveStr
        });
      }
    });

    alerts.sort((a, b) => b.daysInactive - a.daysInactive);
    setInactivityAlerts(alerts);
  }, [allUsers]);

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
    const actualNextDayNum = (targetWeek - 1) * 7 + nextDayNum;
    setCycleDays([
      ...cycleDays,
      { dayNumber: nextDayNum, questionTarget: 15, subjects: [`Nova Matéria Dia ${actualNextDayNum < 10 ? '0' + actualNextDayNum : actualNextDayNum}`] }
    ]);
  };

  const handleAddMultipleDaysToCycle = (count: number) => {
    const newDays = [...cycleDays];
    for (let i = 0; i < count; i++) {
      const nextDayNum = newDays.length + 1;
      const actualNextDayNum = (targetWeek - 1) * 7 + nextDayNum;
      newDays.push({
        dayNumber: nextDayNum,
        questionTarget: 15,
        subjects: [`Matéria de Alocação Dia ${actualNextDayNum < 10 ? '0' + actualNextDayNum : actualNextDayNum}`]
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

  const handleSetWeeks = (weeks: number) => {
    const targetLength = weeks * 7;
    let newDays = [...cycleDays];
    if (newDays.length < targetLength) {
      // Grow
      for (let d = newDays.length + 1; d <= targetLength; d++) {
        const weekdayTemplateIdx = (d - 1) % 7;
        const defaultTemplates = [
          { questionTarget: 15, subjects: ["Língua Portuguesa: Crase", "Direito Constitucional: Artigo 5º"] },
          { questionTarget: 15, subjects: ["Língua Inglesa: Plurais", "Direito Penal: Consumação e Tentativa"] },
          { questionTarget: 20, subjects: ["Matemática: Progressão Aritmética", "Informática: Word e Writer"] },
          { questionTarget: 15, subjects: ["Direitos Humanos: Declaração 1948", "História da Bahia: Canudos"] },
          { questionTarget: 20, subjects: ["Direito Administrativo: Princípios", "Geografia da Bahia: Climatologia"] },
          { questionTarget: 15, subjects: ["Direito Penal Militar: Motim", "Matemática: Matrizes"] },
          { questionTarget: 30, subjects: ["Simulado Geral de Revisão"] }
        ];
        const template = defaultTemplates[weekdayTemplateIdx];
        newDays.push({
          dayNumber: d,
          questionTarget: template.questionTarget,
          subjects: template.subjects.map(s => `${s} - Sem ${Math.floor((d - 1) / 7) + 1}`)
        });
      }
    } else if (newDays.length > targetLength) {
      // Shrink
      newDays = newDays.slice(0, targetLength);
    }
    setCycleDays(newDays);
    setAdminSelectedWeek(1);
  };

  // Load selected student's active study cycle into the editor
  useEffect(() => {
    setShowDeleteConfirm(false);
    if (!selectedStudentId) return;

    const loadStudentCycle = async () => {
      setAdminSelectedWeek(1);
      // Fetch from Firestore FIRST to get the most accurate, shared state
      try {
        const fsCycle = await fetchStudyCycleFromFirestore(selectedStudentId);
        if (fsCycle && Array.isArray(fsCycle.days)) {
          setTargetWeek(fsCycle.weekNumber || 1);
          setCycleDays(fsCycle.days.map(d => ({
            dayNumber: d.dayNumber,
            questionTarget: d.questionTarget,
            subjects: d.subjects.map(s => s.name)
          })));
          localStorage.setItem(`study_cycle_${selectedStudentId}`, JSON.stringify(fsCycle));
          return;
        }
      } catch (err) {
        console.error("Error loading student cycle from Firestore in AdminPanel:", err);
      }

      // Fallback check in local storage
      const saved = localStorage.getItem(`study_cycle_${selectedStudentId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as StudyCycle;
          if (parsed && Array.isArray(parsed.days)) {
            setTargetWeek(parsed.weekNumber || 1);
            setCycleDays(parsed.days.map(d => ({
              dayNumber: d.dayNumber,
              questionTarget: d.questionTarget,
              subjects: d.subjects.map(s => s.name)
            })));
            return;
          }
        } catch (e) {
          // ignore, fall back
        }
      }

      // No cycle exists, reset editor to default template so admin starts with a clean template
      handleResetCycleToDefault();
      setTargetWeek(1);
    };

    loadStudentCycle();
  }, [selectedStudentId]);

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

  const handleDeleteStudentCycle = async () => {
    if (!selectedStudentId) {
      setNotification({ type: "error", message: "Por favor, selecione um aluno para excluir o ciclo." });
      return;
    }

    const student = allUsers.find((u) => u.id === selectedStudentId);
    if (!student) return;

    localStorage.removeItem(`study_cycle_${selectedStudentId}`);
    
    try {
      await deleteStudyCycleFromFirestore(selectedStudentId);
    } catch (e) {
      console.error("Error deleting cycle from Firestore:", e);
    }

    // Reset cycle editor state to default template
    handleResetCycleToDefault();
    setTargetWeek(1);

    window.dispatchEvent(new Event("storage"));

    setNotification({
      type: "success",
      message: `Sucesso! Ciclo de estudos de ${student.name} foi removido com sucesso.`
    });

    setShowDeleteConfirm(false);
  };

  // AI Weekly Report Helper
  const [aiGeneratingReport, setAiGeneratingReport] = useState<boolean>(false);

  const handleAiGenerateReport = async () => {
    if (!selectedStudentId) {
      setNotification({ type: "error", message: "Selecione um aluno primeiro para gerar o parecer com I.A." });
      return;
    }

    const student = allUsers.find((u) => u.id === selectedStudentId);
    if (!student) return;

    setAiGeneratingReport(true);
    setNotification({ type: "info", message: "Analisando histórico de acertos do recruta para gerar parecer..." });

    try {
      const savedLogs = localStorage.getItem(`performance_logs_${selectedStudentId}`);
      let logsSummary = "";
      if (savedLogs) {
        try {
          const logs: PerformanceLog[] = JSON.parse(savedLogs);
          if (Array.isArray(logs) && logs.length > 0) {
            const stats: { [sub: string]: { attempted: number; correct: number; errors: string[] } } = {};
            logs.forEach(log => {
              if (!stats[log.subject]) {
                stats[log.subject] = { attempted: 0, correct: 0, errors: [] };
              }
              stats[log.subject].attempted += log.questionsAttempted || 0;
              stats[log.subject].correct += log.questionsCorrect || 0;
              if (log.reasonForError && log.reasonForError.trim()) {
                stats[log.subject].errors.push(`${log.topic}: ${log.reasonForError}`);
              }
            });

            logsSummary += `RESUMO DE DESEMPENHO DE ${student.name}:\n`;
            Object.keys(stats).forEach(sub => {
              const item = stats[sub];
              const rate = item.attempted > 0 ? Math.round((item.correct / item.attempted) * 100) : 0;
              logsSummary += `- Disciplina: ${sub}\n  Aproveitamento: ${rate}% (${item.correct}/${item.attempted} acertos)\n`;
              if (item.errors.length > 0) {
                logsSummary += `  Pontos de Erro Reportados:\n   * ` + item.errors.slice(0, 5).join("\n   * ") + "\n";
              }
            });
          } else {
            logsSummary = "O aluno não possui nenhum registro de simulados ou questões respondidas cadastrado no sistema ainda.";
          }
        } catch (e) {
          logsSummary = "Erro ao ler histórico de questões.";
        }
      } else {
        logsSummary = "Nenhum histórico de questões respondidas encontrado para este aluno.";
      }

      const response = await fetch("/api/ai/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_report",
          studentName: student.name,
          week: reportWeek,
          performanceData: logsSummary
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Erro desconhecido na resposta do servidor.");
      }

      const data = await response.json();
      if (data.text) {
        setReportContent(stripMarkdownAsterisks(data.text));
        setNotification({ type: "success", message: "Parecer tático da IA do Tenente gerado com sucesso!" });
      } else {
        throw new Error("Resposta da IA veio vazia.");
      }
    } catch (err: any) {
      console.error("Erro ao gerar relatório com IA:", err);
      setNotification({ type: "error", message: `Falha ao gerar relatório: ${err.message}` });
    } finally {
      setAiGeneratingReport(false);
    }
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

  // Expired / reached plans logic
  const todayDateStr = new Date().toISOString().split("T")[0];
  const expiredPlanAlerts = allUsers.filter(u => {
    if (!u || u.isAdmin || !u.plan || u.plan === "indefinido" || !u.planEndDate) return false;
    const endDateStr = u.planEndDate.split("T")[0];
    return todayDateStr >= endDateStr;
  });

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

          {/* Alertas de Vencimento de Plano */}
          {expiredPlanAlerts.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg animate-pulse">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      Vencimentos de Plano de Estudos ({expiredPlanAlerts.length})
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Os seguintes alunos atingiram ou ultrapassaram a data de término de seus planos de estudo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlanAlertsDetails(!showPlanAlertsDetails)}
                  className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-[10px] text-rose-400 font-bold rounded border border-rose-500/20 cursor-pointer transition select-none"
                >
                  {showPlanAlertsDetails ? "Ocultar Detalhes" : "Visualizar Alunos"}
                </button>
              </div>

              {showPlanAlertsDetails && (
                <div className="pt-2 border-t border-rose-500/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-fade-in">
                  {expiredPlanAlerts.map((student) => {
                    const daysOverdue = Math.floor(
                      (new Date().getTime() - new Date(student.planEndDate!).getTime()) / (1000 * 60 * 60 * 24)
                    );
                    return (
                      <div key={student.id} className="bg-slate-950 p-3 rounded-lg border border-rose-500/10 flex flex-col justify-between space-y-2">
                        <div>
                          <span className="font-extrabold text-slate-200 text-xs block truncate">{student.name}</span>
                          <span className="text-[9px] text-slate-400 block truncate font-mono">{student.email}</span>
                          <span className="text-[8px] text-slate-500 block mt-0.5">Plano: {student.plan === "mensal" ? "Mensal" : "Trimestral"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-900">
                          <span className="text-[10px] font-bold text-rose-400">
                            {daysOverdue <= 0 ? "Vence hoje!" : `Vencido há ${daysOverdue} dias`}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {student.planEndDate ? new Date(student.planEndDate).toLocaleDateString("pt-BR") : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Alertas de Redefinição de Senha */}
          {resetRequests.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg animate-pulse">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    Solicitações de Redefinição de Senha ({resetRequests.length})
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    Os seguintes alunos esqueceram a senha e solicitaram que você realize a alteração de suas credenciais de acesso.
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-amber-500/15 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {resetRequests.map((req) => {
                  const targetUser = allUsers.find(
                    (u) => u && u.email && u.email.toLowerCase().trim() === req.email.toLowerCase().trim()
                  );
                  const currentEditPass = editedPasswords[req.id] !== undefined 
                    ? editedPasswords[req.id] 
                    : (targetUser ? targetUser.password || "" : "");

                  return (
                    <div key={req.id} className="bg-slate-950 p-3 rounded-lg border border-amber-500/10 flex flex-col justify-between space-y-2">
                      <div>
                        <span className="font-extrabold text-slate-200 text-xs block truncate">{req.name}</span>
                        <span className="text-[9px] text-slate-400 block truncate font-mono">{req.email}</span>
                        <span className="text-[8px] text-slate-500 block font-mono mt-0.5">Solicitado em: {new Date(req.createdAt).toLocaleString("pt-BR")}</span>
                      </div>

                      {targetUser ? (
                        <div className="pt-1.5 border-t border-slate-900 space-y-2">
                          <div>
                            <label className="block text-[8px] uppercase font-bold text-slate-400 mb-0.5">Nova Senha</label>
                            <input
                              type="text"
                              value={currentEditPass}
                              onChange={(e) => setEditedPasswords(prev => ({ ...prev, [req.id]: e.target.value }))}
                              placeholder="Digite a nova senha"
                              className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded px-2 py-1 text-xs text-amber-400 font-mono focus:outline-none transition"
                            />
                          </div>
                          
                          <button
                            type="button"
                            disabled={updatingPasswordUserId === targetUser.id}
                            onClick={async () => {
                              await handleSavePassword(targetUser, currentEditPass);
                              try {
                                await deletePasswordResetRequestFromFirestore(req.id);
                                await loadPasswordResetRequests();
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="w-full py-1.5 bg-amber-400 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-[10px] font-black rounded uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1"
                          >
                            {updatingPasswordUserId === targetUser.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Redefinir & Resolver
                          </button>
                        </div>
                      ) : (
                        <div className="pt-1.5 border-t border-slate-900 flex flex-col gap-1.5">
                          <p className="text-[9px] text-rose-400 italic">Usuário não encontrado na base de dados.</p>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deletePasswordResetRequestFromFirestore(req.id);
                                await loadPasswordResetRequests();
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="w-full py-1 bg-slate-900 hover:bg-slate-850 text-[10px] text-slate-400 font-bold rounded cursor-pointer text-center"
                          >
                            Descartar Solicitação
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Alertas Automáticos de Alunos Inativos */}
          {inactivityAlerts.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-lg animate-pulse">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      Alunos Inativos Detectados ({inactivityAlerts.length})
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Estes alunos homologados não registram atividades de estudo ou simulados há 7 dias ou mais.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInactivityDetails(!showInactivityDetails)}
                  className="px-3 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-[10px] text-rose-400 font-bold rounded border border-rose-500/20 cursor-pointer transition"
                >
                  {showInactivityDetails ? "Ocultar Detalhes" : "Visualizar Lista"}
                </button>
              </div>

              {showInactivityDetails && (
                <div className="pt-2 border-t border-rose-500/10 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 animate-fade-in">
                  {inactivityAlerts.map(({ student, daysInactive, lastActiveDate }) => (
                    <div key={student.id} className="bg-slate-950 p-3 rounded-lg border border-rose-500/10 flex flex-col justify-between space-y-2">
                      <div>
                        <span className="font-extrabold text-slate-200 text-xs block truncate">{student.name}</span>
                        <span className="text-[9px] text-slate-500 block truncate">{student.email}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1 border-t border-slate-900">
                        <span className="text-[10px] font-bold text-rose-400">
                          {daysInactive === 999 ? "Sem atividades" : `${daysInactive} dias inativo`}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {lastActiveDate ? `Último: ${lastActiveDate}` : "Nunca ativou"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStudentId(student.id);
                          setActiveSubTab("correio");
                          // pre-populate report area with a nudge
                          setReportWeek(1);
                          setReportContent(`Atenção Aluno ${student.name},\n\nIdentificamos em nosso painel de coordenação que você está sem registrar atividades em seu ciclo de estudos há mais de 7 dias.\n\nA constância é o pilar mais importante da sua aprovação no concurso PMBA. Como podemos te ajudar a retomar o ritmo hoje?\n\nForte abraço,\nSua Coordenação.`);
                        }}
                        className="w-full mt-1.5 py-1 bg-amber-400 hover:bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded text-center transition cursor-pointer"
                      >
                        Enviar Notificação / Cobrança
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Plano de Estudos</label>
                  <select
                    value={newUserPlan}
                    onChange={(e) => handleNewUserPlanChange(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer focus:outline-none transition"
                  >
                    <option value="mensal">Mensal</option>
                    <option value="trimestral">Trimestral</option>
                    <option value="indefinido">Indefinido</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Data de Entrada do Aluno</label>
                  <input
                    type="date"
                    required
                    value={newUserCreatedAt}
                    onChange={(e) => handleNewUserCreatedAtChange(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none transition"
                  />
                </div>
              </div>

              {newUserPlan !== "indefinido" && (
                <div className="bg-amber-400/5 border border-amber-400/10 rounded-xl p-4 space-y-2 animate-fade-in">
                  <label className="block text-[10px] uppercase font-bold text-amber-400/80 mb-1">Data de Término do Plano</label>
                  <input
                    type="date"
                    required
                    value={newUserPlanEndDate}
                    onChange={(e) => setNewUserPlanEndDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-amber-400 rounded-lg px-3 py-2 text-xs text-amber-400 font-mono focus:outline-none transition"
                  />
                  <p className="text-[10px] text-slate-400">
                    O plano {newUserPlan} expira automaticamente nesta data. O administrador receberá um alerta quando a data for atingida.
                  </p>
                </div>
              )}

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
                  <th className="p-3 text-center">Data de Entrada</th>
                  <th className="p-3 text-center">Plano</th>
                  <th className="p-3 text-center">Vencimento do Plano</th>
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

                    {/* Data de Entrada */}
                    <td className="p-3 text-center">
                      <input
                        type="date"
                        value={user.createdAt ? user.createdAt.split("T")[0] : ""}
                        onChange={(e) => onUpdateUser({ ...user, createdAt: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : new Date().toISOString() })}
                        className="bg-slate-900 border border-slate-800 focus:border-amber-400 text-slate-300 text-[11px] rounded px-1.5 py-0.5 focus:outline-none transition font-mono"
                      />
                    </td>

                    {/* Plano Selector */}
                    <td className="p-3 text-center">
                      <select
                        value={user.plan || "indefinido"}
                        onChange={(e) => {
                          const newPlan = e.target.value as "mensal" | "trimestral" | "indefinido";
                          let calculatedEndDate = "";
                          if (newPlan !== "indefinido") {
                            const baseDateStr = user.createdAt ? user.createdAt.split("T")[0] : new Date().toISOString().split("T")[0];
                            calculatedEndDate = calculateDefaultEndDate(newPlan, baseDateStr);
                          }
                          onUpdateUser({ 
                            ...user, 
                            plan: newPlan, 
                            planEndDate: calculatedEndDate ? new Date(calculatedEndDate + "T12:00:00").toISOString() : "" 
                          });
                        }}
                        className="bg-slate-900 border border-slate-800 focus:border-amber-400 text-slate-300 text-[11px] rounded px-1.5 py-0.5 focus:outline-none cursor-pointer transition"
                      >
                        <option value="mensal">Mensal</option>
                        <option value="trimestral">Trimestral</option>
                        <option value="indefinido">Indefinido</option>
                      </select>
                    </td>

                    {/* Vencimento do Plano */}
                    <td className="p-3 text-center">
                      {user.plan && user.plan !== "indefinido" ? (
                        <input
                          type="date"
                          value={user.planEndDate ? user.planEndDate.split("T")[0] : ""}
                          onChange={(e) => onUpdateUser({ ...user, planEndDate: e.target.value ? new Date(e.target.value + "T12:00:00").toISOString() : "" })}
                          className="bg-slate-900 border border-slate-800 focus:border-amber-400 text-slate-300 text-[11px] rounded px-1.5 py-0.5 focus:outline-none transition font-mono"
                        />
                      ) : (
                        <span className="text-slate-500 italic text-[11px]">N/A</span>
                      )}
                    </td>

                    {/* Password Management */}
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 max-w-[150px] mx-auto">
                        <input
                          type="text"
                          value={editedPasswords[user.id] !== undefined ? editedPasswords[user.id] : (user.password || "")}
                          onChange={(e) => setEditedPasswords(prev => ({ ...prev, [user.id]: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-800 hover:border-amber-400/50 focus:border-amber-400 rounded px-2 py-1 text-center font-mono text-[11px] text-amber-400 placeholder-slate-700 focus:outline-none transition"
                          placeholder="Sem senha"
                        />
                        {editedPasswords[user.id] !== undefined && editedPasswords[user.id] !== user.password && (
                          <button
                            disabled={updatingPasswordUserId === user.id}
                            onClick={() => handleSavePassword(user, editedPasswords[user.id])}
                            className="p-1 rounded bg-amber-400 hover:bg-amber-500 text-slate-950 transition cursor-pointer shrink-0"
                            title="Salvar nova senha"
                          >
                            {updatingPasswordUserId === user.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </button>
                        )}
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
                            onClick={async () => {
                              const updatedUser = { ...user, isApproved: true };
                              onUpdateUser(updatedUser);
                              setNotification({ 
                                type: "success", 
                                message: `Aluno ${user.name} homologado com sucesso!` 
                              });
                              if (localStorage.getItem("gmail_oauth_token")) {
                                await handleSendPasswordEmail(updatedUser);
                              } else {
                                setNotification({
                                  type: "success",
                                  message: `Aluno ${user.name} homologado! Clique no ícone de carta ao lado para autorizar o Gmail e enviar o e-mail de acesso.`
                                });
                              }
                            }}
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
                        
                        {/* Private Student Notes action */}
                        {!user.isAdmin && (
                          <button
                            onClick={async () => {
                              setActiveNotesStudentId(user.id);
                              setCurrentNotesText("");
                              setLoadingNotes(true);
                              try {
                                const notes = await fetchPrivateStudentNotesFromFirestore(user.id);
                                setCurrentNotesText(notes);
                              } catch (e) {
                                console.error(e);
                              } finally {
                                setLoadingNotes(false);
                              }
                            }}
                            className="p-1.5 rounded bg-amber-400/10 hover:bg-amber-400/20 border border-amber-400/30 text-amber-400 transition cursor-pointer"
                            title="Anotações Privadas do Coordenador"
                          >
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Enviar Credenciais via Gmail */}
                        <button
                          disabled={emailSendingId === user.id}
                          onClick={() => handleSendPasswordEmail(user)}
                          className={`p-1.5 rounded border transition cursor-pointer ${
                            emailSendingId === user.id
                              ? "bg-slate-800 border-slate-700 text-slate-500 animate-pulse"
                              : "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400"
                          }`}
                          title="Enviar credenciais de acesso por E-mail (Gmail)"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>

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
          {/* Collapsible Trigger Card */}
          <div 
            onClick={() => setIsCreateCycleOpen(!isCreateCycleOpen)}
            className="bg-slate-950 p-5 rounded-2xl border border-slate-800 hover:border-amber-400/40 transition duration-300 flex items-center justify-between cursor-pointer group shadow-lg select-none"
          >
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                <h3 className="text-base font-extrabold text-slate-100 uppercase tracking-wider">
                  Gerador de Ciclo de Estudos
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                Clique para abrir ou recolher as opções de criação de ciclos de estudos semanais.
              </p>
            </div>
            
            <button
              type="button"
              className="flex items-center justify-center gap-2 bg-amber-400 group-hover:bg-amber-500 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs uppercase tracking-wider transition shadow-md"
            >
              <span>Criar</span>
              <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isCreateCycleOpen ? "rotate-180" : ""}`} />
            </button>
          </div>

          {isCreateCycleOpen && (
            <div className="space-y-6 animate-fade-in">
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
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 cursor-pointer notranslate"
                  translate="no"
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
                {(() => {
                  const selectedStudent = approvedStudents.find((student) => student.id === selectedStudentId);
                  const maxWeeks = selectedStudent?.plan === "mensal" ? 4 : selectedStudent?.plan === "trimestral" ? 12 : 24;
                  return (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs text-slate-400">Duração do Ciclo (Semanas)</label>
                        {selectedStudent && (
                          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                            Plano: {selectedStudent.plan === "mensal" ? "Mensal (Max 4 Sem)" : selectedStudent.plan === "trimestral" ? "Trimestral (Max 12 Sem)" : "Premium / Completo"}
                          </span>
                        )}
                      </div>
                      <select
                        value={Math.ceil(cycleDays.length / 7)}
                        onChange={(e) => {
                          const weeks = parseInt(e.target.value) || 1;
                          handleSetWeeks(weeks);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 font-mono cursor-pointer"
                      >
                        {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((w) => (
                          <option key={w} value={w}>
                            {w} {w === 1 ? "Semana" : "Semanas"} ({w * 7} Dias)
                          </option>
                        ))}
                      </select>
                    </>
                  );
                })()}
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

            {cycleDays.length > 7 && (
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">Navegar pelas Semanas do Ciclo:</span>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.ceil(cycleDays.length / 7) }, (_, i) => i + 1).map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setAdminSelectedWeek(w)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition uppercase tracking-wider ${
                        adminSelectedWeek === w
                          ? "bg-amber-400 text-slate-950 shadow-md animate-pulse"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-950"
                      }`}
                    >
                      Semana {w < 10 ? `0${w}` : w}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cycleDays
                .filter((day) => {
                  if (cycleDays.length <= 7) return true;
                  const dayWeek = Math.floor((day.dayNumber - 1) / 7) + 1;
                  return dayWeek === adminSelectedWeek;
                })
                .map((day, idx) => {
                  const actualDayNum = day.dayNumber;
                  return (
                    <div key={day.dayNumber} className="bg-slate-950/60 p-4 border border-slate-850 rounded-xl space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-850 pb-1.5">
                        <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider font-mono">
                          Dia {actualDayNum < 10 ? `0${actualDayNum}` : actualDayNum}
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
              );
            })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <button
                onClick={handleSaveStudentCycle}
                className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs transition uppercase tracking-wider cursor-pointer shadow-md"
              >
                Publicar Ciclo para o Aluno Selecionado
              </button>
              
              {!showDeleteConfirm ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full bg-slate-900 border border-rose-900/40 hover:bg-rose-950/25 text-rose-400 font-bold pt-[10px] pb-3 rounded-xl text-xs transition uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Excluir Ciclo Existente do Aluno
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDeleteStudentCycle}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-xl text-[10px] transition uppercase tracking-wider cursor-pointer shadow-md"
                  >
                    Confirmar Exclusão
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 rounded-xl text-[10px] transition uppercase tracking-wider cursor-pointer shadow-md"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs text-slate-400">Parecer de Desempenho / Orientações do Coordenador</label>
                    <button
                      type="button"
                      onClick={handleAiGenerateReport}
                      disabled={aiGeneratingReport}
                      className="inline-flex items-center gap-1.5 text-[10px] bg-slate-900 border border-amber-450/40 text-amber-400 hover:text-slate-950 hover:bg-amber-400 hover:border-amber-400 px-2 py-1 rounded font-bold transition disabled:opacity-50"
                    >
                      {aiGeneratingReport ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                          <span>Analisando logs...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3 text-amber-400" />
                          <span>Gerar com I.A. ⚡</span>
                        </>
                      )}
                    </button>
                  </div>
                  <textarea
                    rows={6}
                    value={reportContent}
                    onChange={(e) => setReportContent(e.target.value)}
                    placeholder="Escreva seu parecer tático aqui... Ou clique em 'Gerar com I.A. ⚡' para obter uma análise cirúrgica automática baseada no histórico de acertos do recruta!"
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

      {/* Student Private Notes Modal */}
      {activeNotesStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full overflow-hidden text-white shadow-2xl animate-fade-in">
            {/* Header */}
            <div className="p-6 border-b border-slate-800 flex items-start justify-between bg-slate-950/30">
              <div>
                <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block mb-1">
                  Anotações de Segurança e Progresso
                </span>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">
                  Anotações Privadas do Coordenador
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Aluno: <strong className="text-amber-400 font-bold">{allUsers.find(u => u.id === activeNotesStudentId)?.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setActiveNotesStudentId(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <p className="text-[11px] text-slate-400 leading-normal">
                Estas anotações são de visibilidade <strong className="text-amber-400 font-bold">exclusiva da coordenação</strong>. O aluno não tem acesso a este conteúdo. Use para registrar observações sobre a constância, dificuldades específicas ou conversas de mentoria.
              </p>

              {loadingNotes ? (
                <div className="py-8 text-center flex flex-col items-center justify-center space-y-2">
                  <RefreshCw className="w-6 h-6 text-amber-500 animate-spin" />
                  <span className="text-[10px] text-slate-500 font-mono">Buscando anotações no servidor...</span>
                </div>
              ) : (
                <textarea
                  rows={6}
                  value={currentNotesText}
                  onChange={(e) => setCurrentNotesText(e.target.value)}
                  placeholder="Escreva aqui observações privadas sobre o desempenho e evolução do aluno..."
                  className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-4 py-3 text-xs text-slate-200 focus:outline-none placeholder:text-slate-700 font-medium leading-relaxed"
                />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
              <span className="text-[9px] text-slate-500 font-mono">
                Acesso Restrito à Coordenação
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setActiveNotesStudentId(null)}
                  className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={savingNotes || loadingNotes}
                  onClick={async () => {
                    setSavingNotes(true);
                    try {
                      await savePrivateStudentNotesToFirestore(activeNotesStudentId, currentNotesText);
                      setNotification({ type: "success", message: "Anotações privadas do aluno salvas com sucesso!" });
                      setActiveNotesStudentId(null);
                    } catch (e) {
                      console.error(e);
                      setNotification({ type: "error", message: "Erro ao salvar anotações privadas." });
                    } finally {
                      setSavingNotes(false);
                    }
                  }}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 text-xs font-black rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow"
                >
                  {savingNotes ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <span>Salvar Anotações</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
