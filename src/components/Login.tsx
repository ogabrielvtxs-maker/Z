import React, { useState, useEffect } from "react";
import { User } from "../types";
import { ShieldAlert, LogIn, UserPlus, KeyRound, CheckSquare, Square, Eye, EyeOff, Info, Award } from "lucide-react";

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

  // Saved login for quick login display
  const [savedUserEmail, setSavedUserEmail] = useState<string | null>(null);
  const [savedUserName, setSavedUserName] = useState<string | null>(null);

  useEffect(() => {
    const savedEmail = localStorage.getItem("saved_login_email");
    const savedName = localStorage.getItem("saved_login_name");
    if (savedEmail && savedName) {
      setSavedUserEmail(savedEmail);
      setSavedUserName(savedName);
    }
  }, []);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Preencha todos os campos.");
      return;
    }

    // Authenticate against our list (allow both full email or just the username prefix before @)
    const found = allUsers.find(
      (u) => 
        u.email.toLowerCase().trim() === email.toLowerCase().trim() ||
        u.email.toLowerCase().split("@")[0].trim() === email.toLowerCase().trim()
    );

    if (!found) {
      alert("Usuário não cadastrado.");
      return;
    }

    // Authenticate password
    const enteredPass = password.trim();
    const storedPass = (found.password || "").trim();
    if (storedPass && storedPass !== enteredPass) {
      alert("Senha incorreta!");
      return;
    }

    if (!found.isApproved) {
      alert(
        "Acesso Negado!\nSeu cadastro foi enviado com sucesso, mas está aguardando a homologação e aprovação de um Administrador/Coordenador."
      );
      return;
    }

    // Success
    onLoginSuccess(found, rememberMe);
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      alert("Preencha todos os campos do formulário.");
      return;
    }

    // Check duplicate
    const exists = allUsers.some((u) => u.email.toLowerCase() === regEmail.toLowerCase());
    if (exists) {
      alert("Este e-mail já possui cadastro cadastrado.");
      return;
    }

    const newUser: User = {
      id: "usr_" + Date.now(),
      name: regName,
      email: regEmail,
      // Default: regular signup requires admin approval, unless explicitly set
      isAdmin: false,
      isApproved: false, 
      accessCFO: regAccessCFO,
      accessSoldado: regAccessSoldado,
      createdAt: new Date().toISOString()
    };

    onRegisterUser(newUser);
    alert(
      "Cadastro Efetuado com Sucesso!\n\nSeu cadastro agora foi enviado para a fila administrativa. Entre em contato com seu coordenador para liberar o seu acesso."
    );
    
    // Auto populate login email for convenience
    setEmail(regEmail);
    setView("login");
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    const exists = allUsers.some((u) => u.email.toLowerCase() === forgotEmail.toLowerCase());
    if (exists) {
      setForgotSuccess(true);
    } else {
      alert("E-mail não encontrado na base de dados.");
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
    <div id="login-container" className="min-h-screen flex items-center justify-center bg-[#070b14] p-4 font-sans text-white relative overflow-hidden">
      
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
          <h1 className="text-xl font-black uppercase tracking-wider text-amber-400">
            PLATAFORMA ESTUDOS PMBA
          </h1>
          <p className="text-[11px] text-slate-400 font-semibold tracking-widest uppercase mt-0.5">
            CFO & SOLDADO - PREPARAÇÃO DE ELITE
          </p>
        </div>

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
                <label className="block text-xs text-slate-400 mb-1 font-semibold uppercase tracking-wider">E-mail funcional</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seuemail@pmba.com"
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
                className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-3 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer shadow-lg shadow-amber-500/5 mt-2 flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4 text-slate-950" />
                Acessar Plataforma
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
              Fazer Cadastro de Estudante
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
              className="w-full bg-amber-400 hover:bg-amber-500 text-slate-950 font-black py-2.5 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer shadow-md flex items-center justify-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Solicitar Acesso
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
          <div className="space-y-4 text-center">
            <h3 className="font-black text-sm text-slate-200 uppercase tracking-wider">
              Solicitação de Alteração de Senha
            </h3>

            <div className="bg-amber-400/10 border border-amber-400/20 p-4 rounded-xl text-slate-300 text-xs text-left space-y-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
                <div>
                  <span className="font-extrabold text-amber-400 uppercase tracking-wide block mb-1">Aviso de Segurança</span>
                  <p className="leading-relaxed text-[11px]">
                    Por questões de segurança cibernética e auditoria de acesso dos alunos da PMBA, as solicitações de mudança ou redefinição de senha <strong>devem ser feitas diretamente ao Administrador Geral (coordenador e dono da conta principal <span className="text-white font-mono underline">alofemacao@gmail.com</span>)</strong>.
                  </p>
                </div>
              </div>

              <div className="border-t border-slate-800/60 pt-2 text-[10px] text-slate-400 leading-normal">
                Nenhum e-mail de redefinição automática é disparado para preservar os logs teóricos e as credenciais funcionais de acesso.
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Por favor, informe seu Nome de Guerra e solicite a sua nova senha diretamente ao coordenador da plataforma.
            </p>

            <button
              type="button"
              onClick={() => setView("login")}
              className="w-full bg-slate-950 border border-slate-800 hover:border-amber-400 text-amber-400 hover:text-white font-bold py-2.5 rounded-xl text-xs transition uppercase tracking-widest cursor-pointer"
            >
              Voltar ao Login
            </button>
          </div>
        )}

        {/* End of Form View */}
      </div>
    </div>
  );
}
