import { useState, useEffect } from "react";
import { User, WeeklyReport } from "./types";
import { initialSyllabusData } from "./data/syllabusData";
import Login from "./components/Login";
import AdminPanel from "./components/AdminPanel";
import WeeklyCycle from "./components/WeeklyCycle";
import Pomodoro from "./components/Pomodoro";
import PerformanceStats from "./components/PerformanceStats";
import VerticalSyllabus from "./components/VerticalSyllabus";
import ContentArea from "./components/ContentArea";
import CoordinatorQuestions from "./components/CoordinatorQuestions";
import { stripMarkdownAsterisks } from "./lib/textCleanup";
import { 
  fetchUsersFromFirestore, 
  fetchUserFromFirestore,
  saveUserToFirestore, 
  deleteUserFromFirestore,
  fetchAllReportsFromFirestore,
  fetchSharedContentFromFirestore,
  fetchStudentReportsFromFirestore,
  auth,
  migrateStudentData
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
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
  X,
  ClipboardList,
  HelpCircle,
  History,
  Lock,
  AlertTriangle,
  CheckCircle2
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
    id: "usr_admin_gabriel",
    name: "Coordenador Gabriel (Admin)",
    email: "gabrielj0s239@gmail.com",
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
  },
  {
    id: "aluno_larajamile",
    name: "Lara Jamile",
    email: "larajamile99@gmail.com",
    password: "lara123",
    isAdmin: false,
    isApproved: true,
    accessCFO: true,
    accessSoldado: true,
    createdAt: new Date().toISOString()
  }
];

const ADMIN_EMAILS = ["alofemacao@gmail.com", "gabrielj0s239@gmail.com"];

export default function App() {
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthInitializing, setIsAuthInitializing] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>("cycle");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [sidebarMinimized, setSidebarMinimized] = useState<boolean>(false);
  
  // Student reports addressed to them
  const [myReports, setMyReports] = useState<WeeklyReport[]>([]);

  // Syllabus progress and login tracking states
  const [syllabusProgressPercent, setSyllabusProgressPercent] = useState<number>(0);
  const [lastLoginDisplay, setLastLoginDisplay] = useState<string>("");

  const [expiredStats, setExpiredStats] = useState<{
    completedSyllabusPercent: number;
    totalAttempted: number;
    totalCorrect: number;
    accuracy: number;
  }>({
    completedSyllabusPercent: 0,
    totalAttempted: 0,
    totalCorrect: 0,
    accuracy: 0
  });

  const isPlanExpired = (() => {
    if (!currentUser || currentUser.isAdmin || !currentUser.plan || currentUser.plan === "indefinido" || !currentUser.planEndDate) return false;
    const todayDateStr = new Date().toISOString().split("T")[0];
    const endDateStr = currentUser.planEndDate.split("T")[0];
    return todayDateStr >= endDateStr;
  })();

  useEffect(() => {
    if (currentUser && isPlanExpired) {
      // 1. Syllabus progress
      const savedSyllabus = localStorage.getItem(`syllabus_progress_${currentUser.id}`);
      let syllabusPercent = 0;
      if (savedSyllabus) {
        try {
          const parsed = JSON.parse(savedSyllabus);
          if (Array.isArray(parsed)) {
            let totalTopics = 0;
            let completedTopics = 0;
            const path = currentUser.accessCFO && !currentUser.accessSoldado ? "cfo" : "soldado";
            const currentSections = parsed.filter((s: any) => s.category === path);
            currentSections.forEach((sec: any) => {
              if (sec && Array.isArray(sec.topics)) {
                sec.topics.forEach((t: any) => {
                  totalTopics++;
                  if (t.isCompleted) completedTopics++;
                });
              }
            });
            if (totalTopics > 0) {
              syllabusPercent = Math.round((completedTopics / totalTopics) * 100);
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      // 2. Performance stats
      const savedLogs = localStorage.getItem(`performance_logs_${currentUser.id}`);
      let totalAttempted = 0;
      let totalCorrect = 0;
      if (savedLogs) {
        try {
          const parsedLogs = JSON.parse(savedLogs);
          if (Array.isArray(parsedLogs)) {
            parsedLogs.forEach((log: any) => {
              totalAttempted += log.questionsAttempted || 0;
              totalCorrect += log.questionsCorrect || 0;
            });
          }
        } catch (e) {
          console.error(e);
        }
      }

      setExpiredStats({
        completedSyllabusPercent: syllabusPercent || syllabusProgressPercent,
        totalAttempted,
        totalCorrect,
        accuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0
      });
    }
  }, [currentUser, isPlanExpired, syllabusProgressPercent]);

  const formatLastLogin = (isoString?: string) => {
    if (!isoString) return "Primeiro acesso";
    try {
      const date = new Date(isoString);
      const pad = (num: number) => String(num).padStart(2, "0");
      const day = pad(date.getDate());
      const month = pad(date.getMonth() + 1);
      const year = date.getFullYear();
      const hours = pad(date.getHours());
      const minutes = pad(date.getMinutes());
      return `${day}/${month}/${year} às ${hours}:${minutes}`;
    } catch (e) {
      return "Primeiro acesso";
    }
  };

  const registerSessionEntry = async (user: User) => {
    if (!user) return;
    
    const sessionKey = `session_registered_${user.id}`;
    const displayKey = `previous_login_display_${user.id}`;
    
    const isSessionRegistered = sessionStorage.getItem(sessionKey);
    let prevLoginTime = "";
    
    if (isSessionRegistered) {
      prevLoginTime = sessionStorage.getItem(displayKey) || "";
    } else {
      // First load in this browser tab: capture previous timestamp
      prevLoginTime = user.lastLoginAt || "";
      if (prevLoginTime) {
        sessionStorage.setItem(displayKey, prevLoginTime);
      }
      
      // Update lastLoginAt to current ISO timestamp
      const nowStr = new Date().toISOString();
      const updatedUser: User = {
        ...user,
        previousLoginAt: prevLoginTime,
        lastLoginAt: nowStr
      };
      
      // Save locally
      setCurrentUser(updatedUser);
      localStorage.setItem("active_user_session", JSON.stringify(updatedUser));
      
      // Sync on the main users list
      setAllUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
      
      // Sync to Firestore
      try {
        await saveUserToFirestore(updatedUser);
      } catch (e) {
        console.error("Error updating user session timestamp:", e);
      }
      
      sessionStorage.setItem(sessionKey, "true");
    }
    
    setLastLoginDisplay(prevLoginTime);
  };

  // Synchronise and calculate Verticalised Syllabus progress
  useEffect(() => {
    if (!currentUser || currentUser.isAdmin) return;

    const updateProgress = () => {
      const saved = localStorage.getItem(`syllabus_progress_${currentUser.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            const path = currentUser.accessCFO && !currentUser.accessSoldado ? "cfo" : "soldado";
            const currentSections = parsed.filter((s: any) => s.category === path);
            const totalTopics = currentSections.reduce((acc: number, curr: any) => acc + (curr.topics?.length || 0), 0);
            if (totalTopics > 0) {
              const completedRead = currentSections.reduce((acc: number, curr: any) => acc + (curr.topics?.filter((t: any) => t.isCompleted).length || 0), 0);
              setSyllabusProgressPercent(Math.round((completedRead / totalTopics) * 100));
            } else {
              setSyllabusProgressPercent(0);
            }
          }
        } catch (e) {
          console.error("Error parsing syllabus progress:", e);
        }
      } else {
        const path = currentUser.accessCFO && !currentUser.accessSoldado ? "cfo" : "soldado";
        const currentSections = initialSyllabusData.filter((s: any) => s.category === path);
        const totalTopics = currentSections.reduce((acc: number, curr: any) => acc + (curr.topics?.length || 0), 0);
        setSyllabusProgressPercent(0);
      }
    };

    updateProgress();

    window.addEventListener("syllabus_updated", updateProgress);
    window.addEventListener("storage", updateProgress);
    return () => {
      window.removeEventListener("syllabus_updated", updateProgress);
      window.removeEventListener("storage", updateProgress);
    };
  }, [currentUser, activeTab]);

  // Toast Notification System
  const [toasts, setToasts] = useState<{ id: string; type: "success" | "info" | "warning" | "alert"; title: string; message: string }[]>([]);

  const addToast = (title: string, message: string, type: "success" | "info" | "warning" | "alert" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 8000);
  };

  // Background polling for Toast Notifications (new reports, library materials, simulados)
  useEffect(() => {
    if (!currentUser) return;

    let isMounted = true;
    
    // Helper keys for localStorage
    const reportSeenKey = `notified_reports_${currentUser.id}`;
    const contentSeenKey = `notified_contents_${currentUser.id}`;

    const checkUpdates = async (isInitialSetup: boolean = false) => {
      try {
        // 1. Check for new reports safely based on user role
        const fsReports = currentUser.isAdmin 
          ? await fetchAllReportsFromFirestore()
          : await fetchStudentReportsFromFirestore(currentUser.id);
        if (!isMounted) return;

        // Filter reports belonging to current student
        const studentReports = currentUser.isAdmin 
          ? fsReports 
          : fsReports.filter(r => r.studentId === currentUser.id);
        
        // Get already seen reports from localStorage
        const seenReportIdsStr = localStorage.getItem(reportSeenKey);
        let seenReportIds: string[] = [];
        if (seenReportIdsStr) {
          try {
            seenReportIds = JSON.parse(seenReportIdsStr);
          } catch (e) {
            seenReportIds = [];
          }
        }

        if (isInitialSetup && !seenReportIdsStr) {
          // On first load, mark all existing student reports as seen so we don't spam them
          const initialIds = studentReports.map(r => r.id);
          localStorage.setItem(reportSeenKey, JSON.stringify(initialIds));
        } else {
          // Look for any reports that are not in seen list
          const newReports = studentReports.filter(r => !seenReportIds.includes(r.id));
          if (newReports.length > 0) {
            newReports.forEach(report => {
              addToast(
                "Novo Relatório Disponível! 📬",
                `O Coordenador enviou um parecer tático para a Semana ${report.weekNumber}. Acesse a Caixa de Correio para ler.`,
                "success"
              );
              seenReportIds.push(report.id);
            });
            localStorage.setItem(reportSeenKey, JSON.stringify(seenReportIds));
            // Update myReports state so the inbox refreshes automatically!
            setMyReports(studentReports);
          }
        }

        // 2. Check for new library contents
        const fsContents = await fetchSharedContentFromFirestore();
        if (!isMounted) return;

        const seenContentIdsStr = localStorage.getItem(contentSeenKey);
        let seenContentIds: string[] = [];
        if (seenContentIdsStr) {
          try {
            seenContentIds = JSON.parse(seenContentIdsStr);
          } catch (e) {
            seenContentIds = [];
          }
        }

        if (isInitialSetup && !seenContentIdsStr) {
          // On first load, mark all existing materials as seen
          const initialIds = fsContents.map(c => c.id);
          localStorage.setItem(contentSeenKey, JSON.stringify(initialIds));
        } else {
          // Look for any contents not in seen list
          const newContents = fsContents.filter(c => !seenContentIds.includes(c.id));
          if (newContents.length > 0) {
            newContents.forEach(item => {
              const isSimulado = item.type === "simulado";
              if (isSimulado) {
                addToast(
                  "Novo Simulado Disponível! 🏆",
                  `A prova "${item.title}" foi adicionada. Prepare-se e inicie o simulado quando estiver pronto!`,
                  "warning"
                );
              } else {
                addToast(
                  "Novo Material na Biblioteca! 📚",
                  `O material "${item.title}" foi adicionado à biblioteca de estudos.`,
                  "info"
                );
              }
              seenContentIds.push(item.id);
            });
            localStorage.setItem(contentSeenKey, JSON.stringify(seenContentIds));
          }
        }
      } catch (err) {
        console.error("Erro ao verificar atualizações de segundo plano:", err);
      }
    };

    // Run initial setup immediately
    checkUpdates(true);

    // Set up polling interval (every 12 seconds)
    const intervalId = setInterval(() => {
      checkUpdates(false);
    }, 12000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [currentUser]);

  // 1. Initialize Users list
  useEffect(() => {
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

    ADMIN_EMAILS.forEach((email, idx) => {
      const exists = loadedUsers.some(u => u.email.toLowerCase() === email.toLowerCase());
      if (!exists) {
        const initialAdmin = INITIAL_USERS.find(u => u.email.toLowerCase() === email.toLowerCase()) || INITIAL_USERS[idx];
        loadedUsers.unshift(initialAdmin);
      } else {
        loadedUsers = loadedUsers.map(u => {
          if (u.email.toLowerCase() === email.toLowerCase()) {
            return {
              ...u,
              isAdmin: true,
              isApproved: true,
              password: u.password || "2004biel"
            };
          }
          return u;
        });
      }
    });

    setAllUsers(loadedUsers);
    localStorage.setItem("platform_users", JSON.stringify(loadedUsers));
  }, []);

  // 2. Track Firebase Auth state & sync user profiles
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email?.toLowerCase().trim() || "";
        
        // Find user from our locally loaded state
        const savedUsers = localStorage.getItem("platform_users");
        let loadedUsers: User[] = [];
        if (savedUsers) {
          try { loadedUsers = JSON.parse(savedUsers); } catch(e) {}
        }
        if (loadedUsers.length === 0) {
          loadedUsers = [...INITIAL_USERS];
        }

        let matchedUser = loadedUsers.find(u => u.email.toLowerCase().trim() === email);

        if (!matchedUser) {
          // Attempt to pull user profile directly from Firestore
          try {
            const qUsers = await fetchUsersFromFirestore();
            matchedUser = qUsers.find(u => u.email.toLowerCase().trim() === email);
          } catch (e) {
            console.error("Error finding user in Firestore during auth init:", e);
          }
        }

        // Force auto-approve Lara Jamile profile if detected
        if (email === "larajamile99@gmail.com") {
          if (matchedUser) {
            matchedUser.isApproved = true;
            matchedUser.accessCFO = true;
            matchedUser.accessSoldado = true;
            matchedUser.password = "lara123";
          } else {
            matchedUser = {
              id: firebaseUser.uid,
              name: "Lara Jamile",
              email: "larajamile99@gmail.com",
              password: "lara123",
              isAdmin: false,
              isApproved: true,
              accessCFO: true,
              accessSoldado: true,
              createdAt: new Date().toISOString()
            };
            try {
              await saveUserToFirestore(matchedUser);
            } catch (e) {
              console.error("Error saving Lara profile in Firestore during auth init:", e);
            }
          }
        }

        if (matchedUser) {
          // Align pre-seeded or hardcoded IDs with actual Firebase Auth UID
          if (matchedUser.id !== firebaseUser.uid) {
            const oldId = matchedUser.id;
            matchedUser.id = firebaseUser.uid;
            
            // Update loadedUsers list and persist to localStorage
            loadedUsers = loadedUsers.map(u => u.id === oldId ? matchedUser : u);
            setAllUsers(loadedUsers);
            localStorage.setItem("platform_users", JSON.stringify(loadedUsers));

            // Clean up and migrate old Firestore data and local data asynchronously
            migrateStudentData(oldId, firebaseUser.uid, matchedUser).catch(err => {
              console.error("Non-blocking data migration failed:", err);
            });
          }

          // If they are admin, sync all users from Firestore
          if (matchedUser.isAdmin) {
            try {
              const fsUsers = await fetchUsersFromFirestore();
              if (fsUsers.length > 0) {
                // Securely merge admins with any remaining fetched users
                let merged = [...fsUsers];
                ADMIN_EMAILS.forEach((adminEmail, idx) => {
                  const hasAdmin = merged.some(u => u.email.toLowerCase() === adminEmail.toLowerCase());
                  if (!hasAdmin) {
                    const initialAdmin = INITIAL_USERS.find(u => u.email.toLowerCase() === adminEmail.toLowerCase()) || INITIAL_USERS[idx];
                    merged.unshift(initialAdmin);
                  } else {
                    merged = merged.map(u => {
                      if (u.email.toLowerCase() === adminEmail.toLowerCase()) {
                        return {
                          ...u,
                          isAdmin: true,
                          isApproved: true,
                          password: u.password || "2004biel"
                        };
                      }
                      return u;
                    });
                  }
                });
                setAllUsers(merged);
                localStorage.setItem("platform_users", JSON.stringify(merged));
                const freshAdmin = merged.find(u => u.email.toLowerCase().trim() === email);
                if (freshAdmin) {
                  matchedUser = freshAdmin;
                }
              } else {
                // If it is truly empty, we seed the database with the INITIAL_USERS safely from the authenticated Admin context
                console.log("Firestore users collection is empty. Seeding initial users securely from Admin context...");
                for (const u of INITIAL_USERS) {
                  try {
                    await saveUserToFirestore(u);
                  } catch (err) {
                    console.error("Error seeding initial user:", u.email, err);
                  }
                }
                setAllUsers(INITIAL_USERS);
                localStorage.setItem("platform_users", JSON.stringify(INITIAL_USERS));
              }
            } catch (err) {
              console.error("Admin user sync failed:", err);
            }
          } else {
            // Student user: sync single profile from Firestore
            try {
              const freshStudent = await fetchUserFromFirestore(matchedUser.id);
              if (freshStudent) {
                matchedUser = freshStudent;
                const updatedLocals = loadedUsers.map(u => u.id === freshStudent.id ? freshStudent : u);
                setAllUsers(updatedLocals);
                localStorage.setItem("platform_users", JSON.stringify(updatedLocals));
              }
            } catch (err) {
              console.error("Student profile sync failed:", err);
            }
          }

          setCurrentUser(matchedUser);
          localStorage.setItem("active_user_session", JSON.stringify(matchedUser));
          registerSessionEntry(matchedUser);
        } else {
          // Fallback user if not found in pre-seeded lists or database
          const fallbackUser: User = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || "Guerreiro",
            email: email,
            isAdmin: false,
            isApproved: false,
            accessCFO: false,
            accessSoldado: false,
            createdAt: new Date().toISOString()
          };
          setCurrentUser(fallbackUser);
          localStorage.setItem("active_user_session", JSON.stringify(fallbackUser));
        }
      } else {
        // Fallback to local session if present (in case Firebase Auth fails or Email/Password provider is disabled)
        const localSession = localStorage.getItem("active_user_session");
        if (localSession) {
          try {
            const parsed = JSON.parse(localSession) as User;
            setCurrentUser(parsed);
          } catch (e) {
            setCurrentUser(null);
          }
        } else {
          setCurrentUser(null);
        }
      }
      setIsAuthInitializing(false);
    });

    return () => unsubscribe();
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
          const fsReports = currentUser.isAdmin 
            ? await fetchAllReportsFromFirestore()
            : await fetchStudentReportsFromFirestore(currentUser.id);
          
          if (currentUser.isAdmin) {
            localStorage.setItem("all_reports", JSON.stringify(fsReports));
          }
          const studentReports = currentUser.isAdmin 
            ? fsReports 
            : fsReports.filter((r) => r.studentId === currentUser.id);
          setMyReports(studentReports);
        } catch (error) {
          console.error("Error fetching reports from Firestore:", error);
        }
      };

      loadAndSyncReports();
    }
  }, [currentUser, activeTab]);

  const handleLoginSuccess = (user: User, remember: boolean) => {
    // Clear session storage flags for a clean login cycle
    sessionStorage.removeItem(`session_registered_${user.id}`);
    sessionStorage.removeItem(`previous_login_display_${user.id}`);

    registerSessionEntry(user);

    if (remember) {
      localStorage.setItem("saved_login_email", user.email);
      localStorage.setItem("saved_login_name", user.name);
    } else {
      localStorage.removeItem("saved_login_email");
      localStorage.removeItem("saved_login_name");
    }

    // Direct user to appropriate start tab
    setCurrentUser(user);
    localStorage.setItem("active_user_session", JSON.stringify(user));

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

  if (isAuthInitializing) {
    return (
      <div id="auth-initializing-container" className="min-h-screen bg-[#070b14] flex flex-col items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
        <div className="flex flex-col items-center space-y-4 relative z-10 text-center">
          <div className="p-3 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl shadow-lg text-slate-950 animate-pulse">
            <Award className="w-8 h-8" />
          </div>
          <p className="text-amber-400 font-bold uppercase tracking-widest text-xs animate-pulse">
            Carregando Plataforma, Guerreiro...
          </p>
        </div>
      </div>
    );
  }

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

  if (isPlanExpired) {
    return (
      <div className="min-h-screen bg-[#070b14] font-sans text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
        
        <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 text-center space-y-6">
          
          {/* Header Warning */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Lock className="w-3.5 h-3.5" />
              <span>Plano de Estudos Expirado</span>
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white uppercase tracking-tight">
              Acesso Temporariamente Suspenso
            </h2>
            
            <p className="text-slate-400 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
              Olá, <strong className="text-slate-200">{currentUser.name}</strong>. Seu plano de acesso à mentoria chegou ao fim. Para continuar usando as ferramentas de estudo e as orientações da coordenação, realize a renovação do seu plano.
            </p>
          </div>

          {/* Reassurance Banner */}
          <div className="bg-emerald-950/20 border border-emerald-500/25 px-5 py-4 rounded-2xl flex items-start gap-3.5 text-left">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-emerald-400">Seu Progresso está 100% Salvo e Protegido!</h4>
              <p className="text-[11px] text-slate-300 leading-normal">
                Nenhum dado ou estatística foi perdido. Todos os seus tópicos lidos no Edital Verticalizado, cronogramas semanais, revisões de repetição espaçada e logs de erros de questões permanecem gravados de forma segura na nuvem, aguardando a sua renovação para serem reativados.
              </p>
            </div>
          </div>

          {/* Stats Summary Grid (Visual proof that they didn't lose performance data!) */}
          <div className="space-y-2 text-left">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block pl-1">Seu Desempenho Registrado:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              
              {/* Syllabus Progress */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Edital Vertical</span>
                <div className="space-y-1">
                  <span className="text-xl font-extrabold text-amber-400">{expiredStats.completedSyllabusPercent}%</span>
                  <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${expiredStats.completedSyllabusPercent}%` }} />
                  </div>
                </div>
              </div>

              {/* Total Attempted */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Total de Questões</span>
                <span className="text-xl font-extrabold text-slate-200">{expiredStats.totalAttempted}</span>
              </div>

              {/* Total Correct */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Acertos</span>
                <span className="text-xl font-extrabold text-teal-400">{expiredStats.totalCorrect}</span>
              </div>

              {/* Accuracy Rate */}
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-850 flex flex-col justify-between">
                <span className="text-[9px] text-slate-400 font-bold uppercase block mb-1">Aproveitamento</span>
                <span className="text-xl font-extrabold text-emerald-400">{expiredStats.accuracy}%</span>
              </div>

            </div>
          </div>

          {/* CTA / Support Block */}
          <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850/80 space-y-4">
            <div className="space-y-1.5">
              <span className="text-xs font-bold text-amber-400 block">Deseja continuar se preparando para a aprovação?</span>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Entre em contato direto com a nossa coordenação de suporte pelo WhatsApp clicando no botão abaixo para renovar o seu acesso e continuar seus estudos passo a passo.
              </p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <a
                href={`https://wa.me/5575983245389?text=Olá!%20Meu%20nome%20é%20${encodeURIComponent(currentUser.name)}%20e%20gostaria%20de%20renovar%20meu%20plano%20de%20estudos%20na%20plataforma%20de%20mentoria%20alof.emacao.`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/10"
              >
                <HelpCircle className="w-4 h-4 text-slate-950" />
                Falar com o Suporte (WhatsApp)
              </a>

              <button
                onClick={handleLogout}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-900/30 text-rose-400 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sair da Conta / Login
              </button>
            </div>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col">
      
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50 px-4 py-3 shadow-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400 rounded-xl text-slate-950 shadow-md">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <span className="text-sm font-oswald font-bold text-white uppercase tracking-wider">
                alof.emacao<span className="text-amber-400"> mentoria</span>
              </span>
              <span className="text-[9px] text-slate-400 font-mono tracking-widest block uppercase">Tático de Estudos</span>
            </div>
          </div>

          {/* User Status Badge and Logout */}
          <div className="hidden md:flex items-center gap-4">
            <div className="flex items-center gap-3 bg-slate-950 border border-slate-800 px-4 py-1.5 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <div className="text-left text-xs">
                <span className="font-extrabold text-slate-200 block">{currentUser.name}</span>
                <span className="text-[9px] text-slate-400 font-mono block notranslate" translate="no">
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
        {!sidebarMinimized ? (
          <nav className="hidden md:block lg:col-span-3 space-y-2">
            
            <div className="bg-slate-950 px-4 py-4 rounded-2xl border border-slate-850 mb-4 space-y-3.5 shadow-md">
              <div>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Status de Serviço</span>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="text-xs text-slate-300 font-semibold truncate">
                    {currentUser.isAdmin ? "Acesso Total (Coordenador)" : "Acesso Estudantil Homologado"}
                  </span>
                </div>
              </div>

              {!currentUser.isAdmin && (
                <>
                  <div className="h-px bg-slate-850" />
                  
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Última Entrada</span>
                    <div className="flex items-center gap-2">
                      <History className="w-4 h-4 text-teal-400 shrink-0" />
                      <span className="text-xs text-slate-300 font-semibold">
                        {lastLoginDisplay ? formatLastLogin(lastLoginDisplay) : "Primeiro acesso hoje"}
                      </span>
                    </div>
                  </div>

                  <div className="h-px bg-slate-850" />

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Edital Verticalizado</span>
                      <span className="text-xs text-amber-400 font-extrabold">{syllabusProgressPercent}%</span>
                    </div>
                    {/* Sleek dynamic progress bar */}
                    <div className="w-full h-2 bg-slate-900 border border-slate-800 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(245,158,11,0.3)]"
                        style={{ width: `${syllabusProgressPercent}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-slate-500 font-medium mt-1 block">Tópicos lidos / concluídos</span>
                  </div>
                </>
              )}
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

              {/* Biblioteca Area - Available for both students and admins */}
              <button
                onClick={() => setActiveTab("content")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "content" 
                    ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                    : "text-slate-400 hover:bg-slate-950 hover:text-white"
                }`}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span>{currentUser.isAdmin ? "Biblioteca & Materiais" : "Biblioteca Pública"}</span>
              </button>

              {/* Simulados Area - Dedicated tab for mock exams and tests */}
              <button
                onClick={() => setActiveTab("simulados")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "simulados" 
                    ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                    : "text-slate-400 hover:bg-slate-950 hover:text-white"
                }`}
              >
                <ClipboardList className="w-4 h-4 shrink-0 text-amber-400" />
                <span>{currentUser.isAdmin ? "Gerenciar Simulados" : "Simulados & Provas"}</span>
              </button>

              {/* Questões do Coordenador - Dedicated area for Coordinator training questions */}
              <button
                onClick={() => setActiveTab("questions")}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === "questions" 
                    ? "bg-slate-900 border-l-4 border-amber-400 text-amber-400" 
                    : "text-slate-400 hover:bg-slate-950 hover:text-white"
                }`}
              >
                <HelpCircle className="w-4 h-4 shrink-0 text-amber-400" />
                <span>Questões do Coordenador</span>
              </button>

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
        ) : (
          <div className="hidden md:flex lg:col-span-1 flex-col items-center py-5 bg-slate-950/80 border border-slate-850/80 rounded-2xl h-fit space-y-4 shadow-xl">
            <button
              onClick={() => setSidebarMinimized(false)}
              className="p-3 bg-slate-900 hover:bg-amber-400 border border-amber-400/20 text-amber-400 hover:text-slate-950 rounded-xl transition-all cursor-pointer shadow-md"
              title="Restaurar Menu Lateral"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="h-20 border-l border-slate-800" />
            <span className="text-[10px] text-slate-400 font-black font-mono tracking-widest uppercase select-none" style={{ writingMode: "vertical-rl" }}>
              Modo Foco Ativo ⚡
            </span>
          </div>
        )}

        {/* Mobile Navigation Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden col-span-1 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-lg">
            {!currentUser.isAdmin && (
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-2.5 mb-2 text-left">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  <span>Último Acesso</span>
                  <span className="text-slate-300 normal-case font-semibold">
                    {lastLoginDisplay ? formatLastLogin(lastLoginDisplay) : "Primeiro acesso hoje"}
                  </span>
                </div>
                
                <div className="h-px bg-slate-850" />
                
                <div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                    <span>Progresso do Edital</span>
                    <span className="text-amber-400 font-extrabold">{syllabusProgressPercent}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${syllabusProgressPercent}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
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
                  onClick={() => { setActiveTab("simulados"); setMobileMenuOpen(false); }}
                  className={`p-3 text-center rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition ${
                    activeTab === "simulados" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  Simulados
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
                <button
                  onClick={() => { setActiveTab("questions"); setMobileMenuOpen(false); }}
                  className={`p-3 text-center rounded-xl text-xs font-bold flex flex-col items-center gap-1.5 transition relative ${
                    activeTab === "questions" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  Questões
                </button>
              </div>
            )}

            {currentUser.isAdmin && (
              <div className="space-y-2">
                <button
                  onClick={() => { setActiveTab("content"); setMobileMenuOpen(false); }}
                  className={`w-full p-3 text-center rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                    activeTab === "content" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <FolderOpen className="w-4 h-4" />
                  Biblioteca &amp; Materiais
                </button>
                <button
                  onClick={() => { setActiveTab("simulados"); setMobileMenuOpen(false); }}
                  className={`w-full p-3 text-center rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                    activeTab === "simulados" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <ClipboardList className="w-4 h-4" />
                  Gerenciar Simulados
                </button>
                <button
                  onClick={() => { setActiveTab("questions"); setMobileMenuOpen(false); }}
                  className={`w-full p-3 text-center rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                    activeTab === "questions" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <HelpCircle className="w-4 h-4" />
                  Gerenciar Questões
                </button>
                <button
                  onClick={() => { setActiveTab("admin"); setMobileMenuOpen(false); }}
                  className={`w-full p-3 text-center rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${
                    activeTab === "admin" ? "bg-amber-400 text-slate-950" : "bg-slate-950 text-slate-400"
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Painel Administrativo
                </button>
              </div>
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
        <main className={`col-span-1 ${sidebarMinimized ? "lg:col-span-11" : "lg:col-span-9"} space-y-6`}>
          
          {/* Active Tab Router */}
          {activeTab === "cycle" && !currentUser.isAdmin && (
            <WeeklyCycle 
              currentUser={currentUser} 
              onOpenPomodoro={() => setActiveTab("pomodoro")} 
            />
          )}

          {activeTab === "pomodoro" && !currentUser.isAdmin && (
            <Pomodoro 
              currentUser={currentUser} 
              sidebarMinimized={sidebarMinimized}
              setSidebarMinimized={setSidebarMinimized}
            />
          )}

          {activeTab === "stats" && !currentUser.isAdmin && (
            <PerformanceStats currentUser={currentUser} />
          )}

          {activeTab === "syllabus" && !currentUser.isAdmin && (
            <VerticalSyllabus currentUser={currentUser} />
          )}

          {activeTab === "content" && (
            <ContentArea 
              currentUser={currentUser} 
              onlySimulados={false} 
              sidebarMinimized={sidebarMinimized}
              setSidebarMinimized={setSidebarMinimized}
            />
          )}

          {activeTab === "simulados" && (
            <ContentArea 
              currentUser={currentUser} 
              onlySimulados={true} 
              sidebarMinimized={sidebarMinimized}
              setSidebarMinimized={setSidebarMinimized}
            />
          )}

          {activeTab === "questions" && (
            <CoordinatorQuestions currentUser={currentUser} />
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
                      {stripMarkdownAsterisks(report.content)}
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

      {/* Dynamic Toast Notifications Area */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 max-w-sm w-full px-4 sm:px-0 pointer-events-auto">
        <style>{`
          @keyframes toast-slide-in {
            0% { transform: translateY(1rem) scale(0.95); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          .animate-slide-in {
            animation: toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}</style>
        {toasts.map((toast) => {
          let icon = <Bell className="w-5 h-5 text-amber-400 shrink-0" />;
          let borderColor = "border-slate-800";

          if (toast.type === "success") {
            icon = <Mail className="w-5 h-5 text-emerald-400 shrink-0 animate-bounce" />;
            borderColor = "border-emerald-500/40 bg-emerald-950/20";
          } else if (toast.type === "info") {
            icon = <BookOpen className="w-5 h-5 text-blue-400 shrink-0 animate-pulse" />;
            borderColor = "border-blue-500/40 bg-blue-950/20";
          } else if (toast.type === "warning") {
            icon = <ClipboardList className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />;
            borderColor = "border-amber-500/40 bg-amber-950/20";
          }

          return (
            <div
              key={toast.id}
              className={`flex items-start gap-3 p-4 bg-slate-950/95 border ${borderColor} rounded-2xl text-white shadow-2xl relative overflow-hidden group transition-all duration-300 animate-slide-in backdrop-blur-md`}
            >
              {/* Highlight bar */}
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-400" />
              
              <div className="p-1.5 bg-slate-900 rounded-xl border border-slate-850">
                {icon}
              </div>

              <div className="flex-1 space-y-0.5 min-w-0 pr-2">
                <h4 className="text-xs font-black text-slate-100">
                  {toast.title}
                </h4>
                <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
                  {toast.message}
                </p>
              </div>

              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-slate-500 hover:text-white transition duration-200 text-xs font-bold leading-none shrink-0 cursor-pointer p-1 rounded hover:bg-slate-900"
                title="Ignorar Alerta"
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
