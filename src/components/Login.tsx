import React, { useState, useEffect } from "react";
import { User } from "../types";
import { ShieldAlert, LogIn, UserPlus, KeyRound, CheckSquare, Square, Eye, EyeOff, Info, Award, Mail } from "lucide-react";
import { sendResetPasswordEmail, firebaseSignInWithEmailAndPassword, firebaseCreateUserWithEmailAndPassword, auth, savePasswordResetRequestToFirestore, fetchUserByEmailFromFirestore, saveUserToFirestore } from "../lib/firebase";

interface LoginProps {
  onLoginSuccess: (user: User, remember: boolean) => void;
  allUsers: User[];
  onRegisterUser: (newUser: User) => void;
}

export default function Login({ onLoginSuccess, allUsers, onRegisterUser }: LoginProps) {
  const [view, setView] = useState<"login" | "register" | "forgot">("login");
  
  // Login fields
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  // Register fields
  const [regName, setRegName] = useState<string>("");
  const [regEmail, setRegEmail] = useState<string>("");
  const [regPassword, setRegPassword] = useState<string>("");
  const [regAccessCFO, setRegAccessCFO] = useState<boolean>(false);
  const [regAccessSoldado, setRegAccessSoldado] = useState<boolean>(true);

  // Forgot Password fields
  const [forgotEmail, setForgotEmail] = useState<string>("");
  const [forgotSuccess, setForgotSuccess] = useState<boolean>(false);
  const [forgotLoading, setForgotLoading] = useState<boolean>(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Saved login for quick login display
  const [savedUserEmail, setSavedUserEmail] = useState<string | null>(null);
  const [savedUserName, setSavedUserName] = useState<string | null>(null);

  // Firebase Auth Method Configuration Warning state
  const [showConfigWarning, setShowConfigWarning] = useState<boolean>(() => {
    return localStorage.getItem("firebase_auth_method_disabled") === "true";
  });

  useEffect(() => {
    const savedEmail = localStorage.getItem("saved_login_email");
    const savedName = localStorage.getItem("saved_login_name");
    if (savedEmail && savedName) {
      setSavedUserEmail(savedEmail);
      setSavedUserName(savedName);
    }
  }, []);

  const [loginLoading, setLoginLoading] = useState<boolean>(false);
  const [registerLoading, setRegisterLoading] = useState<boolean>(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Preencha todos os campos.");
      return;
    }

    setLoginLoading(true);

    try {
      let searchEmail = email.toLowerCase().trim();
      if (!searchEmail.includes("@")) {
        searchEmail = searchEmail + "@pmba.com"; // Default domain fallback for quick logins
      }

      // 1. Try to fetch fresh user profile from Firestore by email
      let found: User | null = null;
      try {
        found = await fetchUserByEmailFromFirestore(searchEmail);
      } catch (err) {
        console.warn("Error querying Firestore for student on login, using local fallback:", err);
      }

      // 2. Fall back to local user array if Firestore query was empty or offline
      if (!found) {
        found = allUsers.find(
          (u) => 
            u.email.toLowerCase().trim() === searchEmail ||
            u.email.toLowerCase().split("@")[0].trim() === email.toLowerCase().trim()
        );
      }

      // Force auto-approve Lara Jamile's account if she tries to log in
      if (searchEmail === "larajamile99@gmail.com") {
        if (!found) {
          found = {
            id: "aluno_larajamile",
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
            await saveUserToFirestore(found);
          } catch (e) {
            console.error("Error seeding lara in Firestore during login:", e);
          }
        } else {
          found.isApproved = true;
          found.accessCFO = true;
          found.accessSoldado = true;
          found.password = "lara123";
          try {
            await saveUserToFirestore(found);
          } catch (e) {
            console.error("Error updating lara in Firestore during login:", e);
          }
        }
      }

      if (!found) {
        alert("Guerreiro, este e-mail não está cadastrado na plataforma.");
        setLoginLoading(false);
        return;
      }

      if (!found.isApproved) {
        alert(
          "Acesso Negado!\nSeu cadastro foi enviado com sucesso, mas está aguardando a homologação e aprovação de um Administrador/Coordenador."
        );
        setLoginLoading(false);
        return;
      }

      const enteredPass = password.trim();
      const storedPass = (found.password || "").trim();

      if (storedPass !== enteredPass) {
        alert("Senha incorreta, guerreiro! Por favor, verifique sua senha.");
        setLoginLoading(false);
        return;
      }

      // Password matches local database/Firestore record!
      // Ensure they are authenticated in Firebase Auth.
      let loginSuccess = false;
      try {
        await firebaseSignInWithEmailAndPassword(found.email, enteredPass);
        loginSuccess = true;
        localStorage.removeItem("firebase_auth_method_disabled");
        setShowConfigWarning(false);
      } catch (authErr: any) {
        console.warn("Firebase Auth login failed, checking if we can create user on-the-fly:", authErr);
        const errorCode = authErr.code || "";
        const errorMessage = authErr.message || "";

        // If the user does not exist in Firebase Auth yet, register them and sign them in!
        if (
          errorCode === "auth/user-not-found" ||
          errorCode === "auth/invalid-credential" ||
          errorMessage.includes("user-not-found") ||
          errorMessage.includes("invalid-credential")
        ) {
          try {
            await firebaseCreateUserWithEmailAndPassword(found.email, enteredPass);
            loginSuccess = true;
            localStorage.removeItem("firebase_auth_method_disabled");
            setShowConfigWarning(false);
          } catch (regErr: any) {
            const regErrorCode = regErr.code || "";
            if (regErrorCode === "auth/operation-not-allowed" || regErr.message?.includes("operation-not-allowed")) {
              localStorage.setItem("firebase_auth_method_disabled", "true");
              setShowConfigWarning(true);
              console.warn("Failed to register user on-the-fly in Firebase Auth (method disabled):", regErr);
            } else {
              console.warn("Failed to register user on-the-fly in Firebase Auth:", regErr);
            }
            // If they already exist but threw an error, set loginSuccess to true so they can log in locally as fallback
            loginSuccess = true;
          }
        } else {
          if (errorCode === "auth/operation-not-allowed" || errorMessage.includes("operation-not-allowed")) {
            localStorage.setItem("firebase_auth_method_disabled", "true");
            setShowConfigWarning(true);
            console.warn("Email/Password authentication is disabled in Firebase console. Using local fallback.");
          } else {
            // Other Firebase auth error (e.g., too many requests, networks, etc.)
            // Fall back to local login success so the user is not locked out, but log warning
            console.warn("Non-fatal Firebase Auth login error:", authErr);
          }
          loginSuccess = true;
        }
      }

      if (loginSuccess) {
        onLoginSuccess(found, rememberMe);
      }
    } catch (err: any) {
      console.error("Login error:", err);
      alert("Erro ao efetuar login: " + (err.message || err));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      alert("Preencha todos os campos do formulário.");
      return;
    }

    if (regPassword.length < 6) {
      alert("A senha secreta deve ter no mínimo 6 caracteres.");
      return;
    }

    setRegisterLoading(true);

    try {
      // Check duplicate
      const exists = allUsers.some((u) => u.email.toLowerCase() === regEmail.toLowerCase());
      if (exists) {
        alert("Este e-mail já possui cadastro cadastrado.");
        setRegisterLoading(false);
        return;
      }

      // 1. Create account in Firebase Auth
      let fbUser;
      try {
        fbUser = await firebaseCreateUserWithEmailAndPassword(regEmail, regPassword);
        localStorage.removeItem("firebase_auth_method_disabled");
        setShowConfigWarning(false);
      } catch (authErr: any) {
        const errorCode = authErr.code || "";
        const errorMessage = authErr.message || "";
        
        // If they already exist in auth, that's fine
        if (errorCode === "auth/email-already-in-use") {
          // Proceed normally
        } else if (
          errorCode === "auth/operation-not-allowed" ||
          errorMessage.includes("operation-not-allowed")
        ) {
          // If Email/Password auth method is disabled in console, set warning flag and proceed with Firestore signup
          localStorage.setItem("firebase_auth_method_disabled", "true");
          setShowConfigWarning(true);
          console.warn("Email/Password authentication method is disabled in the Firebase Console. Falling back to local database signup.");
        } else {
          console.error("Failed to register in Firebase Auth:", authErr);
          alert("Erro no cadastro de autenticação: " + (authErr.message || authErr));
          setRegisterLoading(false);
          return;
        }
      }

      // 2. Create the user object for our database
      const newUser: User = {
        id: fbUser ? fbUser.uid : "usr_" + Date.now(),
        name: regName,
        email: regEmail,
        password: regPassword, // Fix the missing password bug
        // Default: regular signup requires admin approval, unless explicitly set
        isAdmin: false,
        isApproved: false, 
        accessCFO: regAccessCFO,
        accessSoldado: regAccessSoldado,
        createdAt: new Date().toISOString()
      };

      onRegisterUser(newUser);

      // Sign out immediately so they do not auto-login and bypass admin approval
      try {
        await auth.signOut();
      } catch (signOutErr) {
        console.error("Error signing out after registration:", signOutErr);
      }
      
      alert(
        "Cadastro Solicitado com Sucesso!\n\nSeu cadastro agora foi enviado para a fila de aprovação. O Coordenador irá aprovar o seu acesso em breve. Uma notificação será exibida assim que seu acesso for liberado!"
      );
      
      // Auto populate login email for convenience
      setEmail(regEmail);
      setView("login");
    } catch (err: any) {
      console.error("Registration error:", err);
      alert("Erro ao realizar cadastro: " + (err.message || err));
    } finally {
      setRegisterLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    setForgotLoading(true);
    setForgotError(null);

    const emailClean = forgotEmail.toLowerCase().trim();
    const studentUser = allUsers.find((u) => u.email.toLowerCase().trim() === emailClean);
    if (!studentUser) {
      setForgotError("Este e-mail não foi encontrado na base de dados de alunos cadastrados. Verifique se há algum erro de digitação.");
      setForgotLoading(false);
      return;
    }

    try {
      const requestId = "pr_" + Math.random().toString(36).substring(2, 11);
      await savePasswordResetRequestToFirestore({
        id: requestId,
        email: emailClean,
        name: studentUser.name,
        status: "pending",
        createdAt: new Date().toISOString()
      });
      setForgotSuccess(true);
    } catch (error: any) {
      console.error("Erro ao solicitar redefinição de senha:", error);
      setForgotError("Erro ao enviar solicitação ao coordenador. Verifique sua conexão e tente novamente.");
    } finally {
      setForgotLoading(false);
    }
  };

  // Quick action to trigger login with saved credentials
  const handleQuickLogin = (quickEmail: string) => {
    const found = allUsers.find(
      (u) => u.email.toLowerCase().trim() === quickEmail.toLowerCase().trim()
    );
    if (found) {
      if (!found.isApproved) {
        alert(
          "Acesso Negado!\nSeu cadastro foi enviado com sucesso, mas está aguardando a homologação e aprovação de um Administrador/Coordenador."
        );
        return;
      }
      onLoginSuccess(found, rememberMe);
    }
  };

  // Clear saved login option from UI
  const handleClearSavedLogin = () => {
    localStorage.removeItem("saved_login_email");
    localStorage.removeItem("saved_login_name");
    setSavedUserEmail(null);
    setSavedUserName(null);
  };

  return (
    <div id="login-container" className="min-h-screen flex items-center justify-center bg-slate-950 p-4 font-sans text-white relative overflow-hidden">
      
      {/* Decorative tactical background grids */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-10" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-amber-400/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
 
      <div className="w-full max-w-md bg-slate-900/85 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative z-10 backdrop-blur-md">
        
        {/* Brand Logo & Slogan */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center p-3.5 bg-gradient-to-br from-amber-400 to-amber-500 rounded-2xl shadow-lg shadow-amber-500/10 text-slate-950 mb-3.5">
            <Award className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-oswald font-bold uppercase tracking-wider text-white">
            alof.emacao<span className="text-amber-400"> mentoria</span>
          </h1>
          <p className="text-[11px] text-slate-400 font-semibold tracking-widest uppercase mt-0.5">
            CFO & SOLDADO - PREPARAÇÃO DE ELITE
          </p>
        </div>

        {/* Configuration notice banner when email/password auth provider is disabled */}
        {showConfigWarning && (
          <div className="mb-5 p-3.5 bg-amber-400/10 border border-amber-400/25 rounded-2xl text-[11px] text-amber-300 leading-relaxed space-y-1 relative animate-fade-in text-left">
            <button 
              type="button"
              onClick={() => {
                setShowConfigWarning(false);
                localStorage.removeItem("firebase_auth_method_disabled");
              }}
              className="absolute top-2.5 right-2.5 text-amber-400 hover:text-white font-bold cursor-pointer transition text-xs px-1"
              title="Dispensar aviso"
            >
              ×
            </button>
            <div className="flex items-center gap-1.5 font-bold uppercase text-[10px] text-amber-400 mb-1">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Instrução de Configuração do Firebase</span>
            </div>
            <p>
              O provedor de <strong>E-mail/Senha</strong> está desativado no seu console do Firebase.
            </p>
            <p className="text-slate-400">
              Se você é o coordenador, ative-o em: <strong>Authentication &gt; Sign-in method &gt; E-mail/Senha</strong>.
            </p>
            <p className="text-slate-400 font-medium text-[10px]">
              *Alunos continuarão conseguindo se cadastrar e acessar normalmente via base de dados local reserva enquanto isso.
            </p>
          </div>
        )}

        {/* Dynamic Views: LOGIN */}
        {view === "login" && (
          <div className="space-y-4">
            
            {/* Saved login option if previously logged out with remember option */}
            {savedUserEmail && (
              <div className="bg-slate-950/60 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between mb-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Login Salvo</span>
                  <span className="text-xs font-extrabold text-amber-400">{savedUserName}</span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[200px]">{savedUserEmail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleQuickLogin(savedUserEmail)}
                    className="px-3 py-1.5 bg-amber-400 text-slate-950 text-[10px] font-black uppercase rounded-md hover:bg-amber-500 transition cursor-pointer"
                  >
                    Entrar
                  </button>
                  <button
                    onClick={handleClearSavedLogin}
                    className="text-[10px] text-rose-400 hover:underline font-bold"
                  >
                    Esquecer
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">E-MAIL</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@gmail.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  required
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Senha Secreta</label>
                  <button
                    type="button"
                    onClick={() => setView("forgot")}
                    className="text-[10px] text-slate-400 hover:text-amber-400 transition font-bold"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 transition"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Remember checkbox */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setRememberMe(!rememberMe)}
                  className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 font-semibold"
                >
                  {rememberMe ? (
                    <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-500 shrink-0" />
                  )}
                  <span>Salvar login neste dispositivo</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-3 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer shadow-lg shadow-amber-500/5 mt-2 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4 text-slate-950" />
                {loginLoading ? "Acessando..." : "Acessar Plataforma"}
              </button>
            </form>

            <div className="text-center pt-4 border-t border-slate-800/60 text-xs text-slate-400">
              Não possui uma conta?{" "}
              <button
                onClick={() => setView("register")}
                className="text-amber-400 font-bold hover:underline"
              >
                Cadastre-se aqui
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Views: REGISTER */}
        {view === "register" && (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <h3 className="font-bold text-sm text-slate-200 uppercase tracking-wider mb-2 text-center">
              Fazer Cadastro de Aluno / Guerreiro
            </h3>

            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Nome de Guerra</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                placeholder="Ex: Soldado Silva"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">E-mail</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                placeholder="seuemail@exemplo.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">Senha Secreta</label>
              <input
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                placeholder="Mínimo 6 dígitos"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400"
                required
              />
            </div>

            {/* Select Target Access */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-850 space-y-2">
              <span className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider">Visualizar Edital / Provas</span>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setRegAccessSoldado(!regAccessSoldado)}
                  className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold"
                >
                  {regAccessSoldado ? (
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span>Soldado PMBA</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRegAccessCFO(!regAccessCFO)}
                  className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold"
                >
                  {regAccessCFO ? (
                    <CheckSquare className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-600" />
                  )}
                  <span>CFO (Oficial)</span>
                </button>
              </div>
            </div>

            <div className="flex items-start gap-1.5 text-[10px] text-slate-400 bg-amber-400/5 p-2 rounded border border-amber-400/10">
              <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Para garantir a integridade da tropa, sua conta necessita de homologação manual do coordenador administrativo antes do login.</span>
            </div>

            <button
              type="submit"
              disabled={registerLoading}
              className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-2.5 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              {registerLoading ? "Solicitando..." : "Solicitar Acesso"}
            </button>

            <div className="text-center text-xs">
              Já possui conta?{" "}
              <button
                type="button"
                onClick={() => setView("login")}
                className="text-amber-400 font-bold hover:underline"
              >
                Voltar ao Login
              </button>
            </div>
          </form>
        )}

        {/* Dynamic Views: FORGOT PASSWORD */}
        {view === "forgot" && (
          <div className="space-y-4">
            <h3 className="font-black text-sm text-slate-200 uppercase tracking-wider text-center">
              Recuperação de Senha
            </h3>

            {forgotSuccess ? (
              <div className="space-y-4 text-center">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-emerald-400 text-xs space-y-2">
                  <div className="font-black text-sm uppercase tracking-wider">Solicitação Enviada!</div>
                  <p className="leading-relaxed">
                    Sua solicitação de redefinição de senha foi registrada com sucesso para:
                  </p>
                  <p className="font-mono font-bold bg-slate-950 px-2 py-1.5 rounded border border-slate-800 text-slate-200 truncate">
                    {forgotEmail}
                  </p>
                  <p className="leading-relaxed text-[11px] text-slate-400 mt-2">
                    O Coordenador Administrativo recebeu o alerta e poderá alterar a sua senha de acesso em breve. Entre em contato se necessário.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setForgotSuccess(false);
                    setForgotEmail("");
                    setForgotError(null);
                  }}
                  className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer shadow-lg"
                >
                  Voltar ao Login
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed text-center">
                  Insira o seu e-mail cadastrado na plataforma para enviar uma solicitação de redefinição de senha diretamente ao Coordenador Administrativo.
                </p>

                {forgotError && (
                  <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-medium leading-relaxed">
                    {forgotError}
                  </div>
                )}

                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">
                    E-mail Cadastrado
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="seuemail@exemplo.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                    required
                    disabled={forgotLoading}
                  />
                </div>

                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black py-3 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer shadow-lg flex items-center justify-center gap-2"
                >
                  {forgotLoading ? "Enviando Instruções..." : "Enviar Link de Redefinição"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setView("login");
                    setForgotError(null);
                  }}
                  className="w-full bg-slate-950 border border-slate-800 hover:border-amber-400 text-slate-400 hover:text-white font-bold py-2.5 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer text-center"
                >
                  Voltar ao Login
                </button>
              </form>
            )}
          </div>
        )}

        {/* End of Form View */}
      </div>
    </div>
  );
}
