import { useState, useEffect } from "react";
import { User, WeeklyReport } from "./types";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";
import WeeklyCycle from "./components/WeeklyCycle";
import Pomodoro from "./components/Pomodoro";
import PerformanceStats from "./components/PerformanceStats";
import VerticalSyllabus from "./components/VerticalSyllabus";
import ContentArea from "./components/ContentArea";
import { 
  fetchUsersFromFirestore, 
  saveUserToFirestore, 
  deleteUserFromFirestore,
  fetchAllReportsFromFirestore
} from "./lib/firebase";
import { 
  LogOut, 
  Calendar, 
  Clock, 
  BarChart3, 
  BookOpen, 
  FolderOpen, 
  Mail, 
  Shield, 
  User as UserIcon,
  Award,
  Bell,
  Menu,
  X
} from "lucide-react";

const INITIAL_USERS: User[] = [
  {
    id: "usr_admin",
    name: "Coordenador Geral (Admin)",
    email: "alofemacao@gmail.com",
    password: "2004biel",
    isAdmin: true,
    isApproved: true,
    accessCFO: true,
    accessSoldado: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "aluno_soldado_std",
    name: "Aluno Soldado",
    email: "soldado@pmba.com",
    password: "senha123",
    isAdmin: false,
    isApproved: true,
    accessCFO: false,
    accessSoldado: true,
    createdAt: new Date().toISOString()
  },
  {
    id: "aluno_cfo_std",
    name: "Aluno CFO",
    email: "cfo@pmba.com",
    password: "senha123",
    isAdmin: false,
    isApproved: true,
    accessCFO: true,
    accessSoldado: false,
    createdAt: new Date().toISOString()
  }
];

export default function App() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<string>("cycle");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  
  // Student reports addressed to them
  const [myReports, setMyReports] = useState<WeeklyReport[]>([]);

  // Initialize Users list and active session
  useEffect(() => {
    // Load users list from localStorage or pre-seed
    const savedUsers = localStorage.getItem("platform_users");
    let loadedUsers: User[] = [];
    if (savedUsers) {
      try {
        loadedUsers = JSON.parse(savedUsers);
      } catch (e) {
        loadedUsers = [...INITIAL_USERS];
      }
    } else {
      loadedUsers = [...INITIAL_USERS];
    }

    // Force-merge requested admin to guarantee access
    const adminEmail = "alofemacao@gmail.com";
    const adminExists = loadedUsers.some(u => u.email.toLowerCase() === adminEmail);
    if (!adminExists) {
      loadedUsers = loadedUsers.filter(u => u.id !== "usr_admin");
      loadedUsers.unshift(INITIAL_USERS[0]);
    } else {
      loadedUsers = loadedUsers.map(u => {
        if (u.email.toLowerCase() === adminEmail) {
          return {
            ...u,
            password: "2004biel",
            isAdmin: true,
            isApproved: true
          };
        }
        return u;
      });
    }

    setAllUsers(loadedUsers);
    localStorage.setItem("platform_users", JSON.stringify(loadedUsers));

    // Check active session for auto-login
    const activeSession = localStorage.getItem("active_user_session");
    if (activeSession) {
      try {
        const user = JSON.parse(activeSession);
        
        // Find fresh copy of active user in our freshly loaded list
        const freshUser = loadedUsers.find(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
        if (freshUser) {
          if (freshUser.isApproved) {
            setCurrentUser(freshUser);
          } else {
            localStorage.removeItem("active_user_session");
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(user);
        }
      } catch (e) {
        setCurrentUser(null);
      }
    }

    // Async sync with Firestore database
    const syncWithFirestore = async () => {
      try {
        const fsUsers = await fetchUsersFromFirestore();
        let finalMergedUsers: User[] = [];

        if (fsUsers.length > 0) {
          // Firestore is the absolute source of truth!
          finalMergedUsers = [...fsUsers];

          // Make sure our essential admin is present
          const adminExists = finalMergedUsers.some(u => u.email.toLowerCase() === adminEmail);
          if (!adminExists) {
            // Seed admin if missing
            const adminUser = {
              ...INITIAL_USERS[0],
              createdAt: new Date().toISOString()
            };
            finalMergedUsers.unshift(adminUser);
            await saveUserToFirestore(adminUser);
          } else {
            // Guarantee admin password and role
            finalMergedUsers = finalMergedUsers.map(u => {
              if (u.email.toLowerCase() === adminEmail) {
                return { ...u, password: "2004biel", isAdmin: true, isApproved: true };
              }
              return u;
            });
          }
        } else {
          // If Firestore is empty, upload all pre-seed users
          finalMergedUsers = [...loadedUsers];
          for (const u of finalMergedUsers) {
            await saveUserToFirestore(u);
          }
        }

        setAllUsers(finalMergedUsers);
        localStorage.setItem("platform_users", JSON.stringify(finalMergedUsers));

        // Keep active session fully in sync
        if (activeSession) {
          try {
            const activeUserObj = JSON.parse(activeSession);
            const freshestCopy = finalMergedUsers.find(u => u.id === activeUserObj.id || u.email.toLowerCase() === activeUserObj.email.toLowerCase());
            if (freshestCopy && freshestCopy.isApproved) {
              setCurrentUser(freshestCopy);
              localStorage.setItem("active_user_session", JSON.stringify(freshestCopy));
            } else {
              // User has been deleted or unapproved in Firestore: log out immediately!
              localStorage.removeItem("active_user_session");
              setCurrentUser(null);
            }
          } catch (e) {
            // ignore
          }
        }
      } catch (error) {
        console.error("Failed to sync with Firestore on mount:", error);
      }
    };

    syncWithFirestore();
  }, []);

  // Fetch and sync reports when current student is loaded
  useEffect(() => {
    if (currentUser) {
      const loadAndSyncReports = async () => {
        // First load from localStorage for rapid UX
        const savedReportsStr = localStorage.getItem("all_reports");
        if (savedReportsStr) {
          try {
            const reportsList: WeeklyReport[] = JSON.parse(savedReportsStr);
            const studentReports = reportsList.filter((r) => r.studentId === currentUser.id);
            setMyReports(studentReports);
          } catch (e) {
            setMyReports([]);
          }
        }

        // Then fetch from Firestore and update
        try {
          const fsReports = await fetchAllReportsFromFirestore();
          localStorage.setItem("all_reports", JSON.stringify(fsReports));
          const studentReports = fsReports.filter((r) => r.studentId === currentUser.id);
          setMyReports(studentReports);
        } catch (error) {
          console.error("Error fetching reports from Firestore:", error);
        }
      };

      loadAndSyncReports();
    }
  }, [currentUser, activeTab]);

  const handleLoginSuccess = (user: User, remember: boolean) => {
    setCurrentUser(user);
    localStorage.setItem("active_user_session", JSON.stringify(user));

    if (remember) {
      localStorage.setItem("saved_login_email", user.email);
      localStorage.setItem("saved_login_name", user.name);
    } else {
      localStorage.removeItem("saved_login_email");
      localStorage.removeItem("saved_login_name");
    }

    // Direct user to appropriate start tab
    if (user.isAdmin) {
      setActiveTab("admin");
    } else {
      setActiveTab("cycle");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("active_user_session");
    setCurrentUser(null);
    setMobileMenuOpen(false);
  };

  const handleRegisterUser = async (newUser: User) => {
    const updatedUsers = [...allUsers, newUser];
    setAllUsers(updatedUsers);
    localStorage.setItem("platform_users", JSON.stringify(updatedUsers));
    try {
      await saveUserToFirestore(newUser);
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateUser = async (updatedUser: User) => {
    const updated = allUsers.map((u) => (u.id === updatedUser.id ? updatedUser : u));
    setAllUsers(updated);
    localStorage.setItem("platform_users", JSON.stringify(updated));

    // If current logged-in user details were edited by admin, sync state
    if (currentUser && currentUser.id === updatedUser.id) {
      setCurrentUser(updatedUser);
      localStorage.setItem("active_user_session", JSON.stringify(updatedUser));
    }
    try {
      await saveUserToFirestore(updatedUser);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const updated = allUsers.filter((u) => u.id !== userId);
    setAllUsers(updated);
    localStorage.setItem("platform_users", JSON.stringify(updated));
    try {
      await deleteUserFromFirestore(userId);
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser) {
    return (
      <Login
        allUsers={allUsers}
        onLoginSuccess={handleLoginSuccess}
        onRegisterUser={handleRegisterUser}
      />
    );
  }

  const hasNoAccess = !currentUser.isAdmin && !currentUser.accessCFO && !currentUser.accessSoldado;
  const isNotApproved = !currentUser.isAdmin && !currentUser.isApproved;

  if (isNotApproved || hasNoAccess) {
    return (
      <div className="min-h-screen bg-[#070b14] font-sans text-slate-100 flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative z-10 text-center space-y-6">
          <div className="inline-flex items-center justify-center p-4 bg-rose-500/10 border border-rose-500/30 rounded-full text-rose-500 animate-pulse">
            <Shield className="w-12 h-12" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-white uppercase tracking-wider">Acesso Restrito / Suspenso</h2>
            <p className="text-slate-400 text-xs leading-relaxed">
              {isNotApproved 
                ? "Seu cadastro foi realizado com sucesso, mas está aguardando a homologação e aprovação de um Administrador/Coordenador."
                : "Seu cadastro está ativo, mas você não possui permissão para acessar os cursos de Soldado ou CFO no momento. Entre em contato com a coordenação para habilitar seu plano de estudos."
              }
            </p>
          </div>

          <div className="pt-2">
            <button
              onClick={handleLogout}
              className="w-full py-3 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/30 text-rose-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta / Voltar ao Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070b14] font-sans text-slate-100 flex flex-col">
      
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400 rounded-xl text-slate-950 shadow-md">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-amber-400 font-extrabold tracking-widest block uppercase">PMBA Curso</span>
              <span className="text-sm font-black text-white uppercase tracking-wider">Tático de Estudos</span>
            </div>
          </div>

          {/* User Status Badge and Logout */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-1.5 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-left text-xs">
                <span className="font-extrabold text-slate-200 block">{currentUser.name}</span>
                <span className="text-[9px] text-slate-400 font-mono block">
                  {currentUser.isAdmin 
                    ? "COORDENADOR ADMIN" 
                    : `${currentUser.accessCFO ? "CFO" : ""} ${currentUser.accessSoldado ? "• Soldado" : ""}`.trim()}
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/40 text-slate-400 hover:text-rose-400 cursor-pointer transition flex items-center gap-1.5 text-xs font-semibold"
            >
              <LogOut className="w-4 h-4" />
              Sair
            </button>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-300"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Navigation Sidebar (Desktop) */}
        <nav className="hidden md:block lg:col-span-3 space-y-2">
          
          <div className="bg-slate-950 px-4 py-3.5 rounded-2xl border border-slate-850 mb-4">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Status de Serviço</span>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-xs text-slate-300 font-semibold truncate">
                {currentUser.isAdmin ? "Acesso Total (Coordenador)" : "Acesso Estudantil Homologado"}
              </span>
            </div>
          </div>

          <div className="space-y-1">
            {!currentUser.isAdmin && (
              <>
                <button
                  onClick={() => setActiveTab("cycle")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "cycle" 
                      ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                      : "text-slate-400 hover:bg-slate-950 hover:text-white"
                  }`}
                >
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Meu Ciclo Semanal</span>
                </button>

                <button
                  onClick={() => setActiveTab("pomodoro")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "pomodoro" 
                      ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                      : "text-slate-400 hover:bg-slate-950 hover:text-white"
                  }`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>Pomodoro Tático</span>
                </button>

                <button
                  onClick={() => setActiveTab("stats")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "stats" 
                      ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                      : "text-slate-400 hover:bg-slate-950 hover:text-white"
                  }`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" />
                  <span>Estatísticas & Erros</span>
                </button>

                <button
                  onClick={() => setActiveTab("syllabus")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "syllabus" 
                      ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                      : "text-slate-400 hover:bg-slate-950 hover:text-white"
                  }`}
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>Edital Verticalizado</span>
                </button>

                <button
                  onClick={() => setActiveTab("content")}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "content" 
                      ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                      : "text-slate-400 hover:bg-slate-950 hover:text-white"
                  }`}
                >
                  <FolderOpen className="w-4 h-4 shrink-0" />
                  <span>Biblioteca Pública</span>
                </button>

                <button
                  onClick={() => setActiveTab("inbox")}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                    activeTab === "inbox" 
                      ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                      : "text-slate-400 hover:bg-slate-950 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Mail className="w-4 h-4 shrink-0" />
                    <span>Correio Coordenador</span>
                  </div>
                  {myReports.length > 0 && (
                    <span className="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full">
                      {myReports.length}
                    </span>
                  )}
                </button>
              </>
            )}

            {/* Admin Area - Available for admin only or student with admin role */}
            {currentUser.isAdmin && (
              <button
                onClick={() => setActiveTab("admin")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "admin" 
                    ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                    : "text-slate-400 hover:bg-slate-950 hover:text-white"
                }`}
              >
                <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Painel de Controle Admin</span>
              </button>
            )}
          </div>
        </nav>

        {/* Mobile Navigation Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
            {!currentUser.isAdmin && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setActiveTab("cycle"); setMobileMenuOpen(false); }}
                  className={`p-3 text-center rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    activeTab === "cycle" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Ciclo Semanal
                </button>
                <button
                  onClick={() => { setActiveTab("pomodoro"); setMobileMenuOpen(false); }}
                  className={`p-3 text-center rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    activeTab === "pomodoro" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  Pomodoro
                </button>
                <button
                  onClick={() => { setActiveTab("stats"); setMobileMenuOpen(false); }}
                  className={`p-3 text-center rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    activeTab === "stats" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Estatísticas
                </button>
                <button
                  onClick={() => { setActiveTab("syllabus"); setMobileMenuOpen(false); }}
                  className={`p-3 text-center rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    activeTab === "syllabus" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Edital Vertical
                </button>
                <button
                  onClick={() => { setActiveTab("content"); setMobileMenuOpen(false); }}
                  className={`p-3 text-center rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    activeTab === "content" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  Biblioteca
                </button>
                <button
                  onClick={() => { setActiveTab("inbox"); setMobileMenuOpen(false); }}
                  className={`p-3 text-center rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition relative ${
                    activeTab === "inbox" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Correio ({myReports.length})
                </button>
              </div>
            )}

            {currentUser.isAdmin && (
              <button
                onClick={() => { setActiveTab("admin"); setMobileMenuOpen(false); }}
                className={`w-full p-3 text-center rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                  activeTab === "admin" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                }`}
              >
                <Shield className="w-4 h-4" />
                Painel Administrativo
              </button>
            )}

            {/* Mobile Logout Button */}
            <button
              onClick={handleLogout}
              className="w-full py-2.5 mt-2 bg-slate-950 hover:bg-rose-950/40 border border-slate-800 text-rose-400 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              Sair da Conta
            </button>
          </div>
        )}

        {/* Content Viewer Section */}
        <main className="col-span-1 lg:col-span-9 space-y-6">
          
          {/* Active Tab Router */}
          {activeTab === "cycle" && !currentUser.isAdmin && (
            <WeeklyCycle 
              currentUser={currentUser} 
              onOpenPomodoro={() => setActiveTab("pomodoro")} 
            />
          )}

          {activeTab === "pomodoro" && !currentUser.isAdmin && (
            <Pomodoro />
          )}

          {activeTab === "stats" && !currentUser.isAdmin && (
            <PerformanceStats currentUser={currentUser} />
          )}

          {activeTab === "syllabus" && !currentUser.isAdmin && (
            <VerticalSyllabus currentUser={currentUser} />
          )}

          {activeTab === "content" && (
            <ContentArea currentUser={currentUser} />
          )}

          {/* Student Mailbox (Caixa de Correio) */}
          {activeTab === "inbox" && !currentUser.isAdmin && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-white shadow-xl space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Mail className="w-6 h-6 text-amber-500 animate-pulse" />
                <div>
                  <h2 className="text-lg font-bold text-amber-400 uppercase tracking-wider">Correio do Coordenador</h2>
                  <p className="text-slate-400 text-xs">Suas orientações semanais, planos táticos personalizados e correções enviadas pelo administrador.</p>
                </div>
              </div>

              <div className="space-y-4">
                {myReports.map((report) => (
                  <div key={report.id} className="bg-slate-950 p-5 rounded-2xl border border-slate-850 space-y-3 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-400" />
                    
                    <div className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-850 pb-2">
                      <div className="flex items-center gap-1">
                        <Award className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-amber-400 uppercase tracking-wide font-mono">Boletim Tático - Semana {report.weekNumber}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-500">Postado em: {report.createdAt.split("T")[0]}</span>
                    </div>

                    <p className="text-xs text-slate-200 whitespace-pre-line leading-relaxed pl-1.5">
                      {report.content}
                    </p>
                  </div>
                ))}

                {myReports.length === 0 && (
                  <div className="text-center py-12 bg-slate-950/40 rounded-xl border border-slate-850">
                    <Mail className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                    <span className="text-slate-500 text-xs">Sua caixa de correio está vazia. Aguarde o feedback semanal do Coordenador.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "admin" && currentUser.isAdmin && (
            <AdminPanel
              currentUser={currentUser}
              allUsers={allUsers}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
              onAddUser={handleRegisterUser}
            />
          )}

        </main>

      </div>

      {/* Tactically designed minimalist footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-4 px-6 text-center text-[10px] text-slate-500 font-mono tracking-widest uppercase">
        <span>© 2026 PMBA PLATAFORMA DE ESTUDOS • TODOS OS DIREITOS RESERVADOS</span>
      </footer>

    </div>
  );
}
