import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Eye, EyeOff, LogIn, CalendarDays, MapPin, Clock, ShieldCheck, Sparkles, Droplets } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        const user = useAuthStore.getState().user;
        navigate(user?.role === 'admin' ? '/admin' : '/agent');
      } else {
        setError('Email ou mot de passe incorrect');
      }
    } catch {
      setError('Erreur de connexion au serveur');
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: CalendarDays, title: 'Planning', desc: 'Gestion centralisée des interventions' },
    { icon: MapPin, title: 'Pointage', desc: 'Validation par photo & géolocalisation' },
    { icon: ShieldCheck, title: 'Validation', desc: 'Contrôle et approbation admin' },
    { icon: Clock, title: 'Suivi', desc: 'Heures travaillées en temps réel' },
  ];

  // Generate stable bubble configs
  const bubbles = useMemo(() => 
    Array.from({ length: 18 }, (_, i) => ({
      id: i,
      size: 8 + (i * 7) % 40,
      left: (i * 17 + 5) % 95,
      delay: (i * 1.3) % 12,
      duration: 8 + (i * 3) % 14,
      drift: -30 + (i * 13) % 60,
    })), []
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        {/* Full gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 via-primary-700 to-slate-900" />

        {/* Decorative shapes */}
        <div className="absolute inset-0">
          <div className="absolute -top-24 -left-24 w-[500px] h-[500px] bg-white/5 rounded-full" />
          <div className="absolute top-1/3 -right-32 w-[400px] h-[400px] bg-white/5 rounded-full" />
          <div className="absolute -bottom-20 left-1/4 w-[350px] h-[350px] bg-white/5 rounded-full" />
          <div className="absolute top-20 right-20 w-72 h-72 bg-primary-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-32 left-16 w-64 h-64 bg-primary-300/10 rounded-full blur-3xl" />
        </div>

        {/* Floating bubbles animation */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {bubbles.map((b) => (
            <div
              key={b.id}
              className="login-bubble"
              style={{
                width: b.size,
                height: b.size,
                left: `${b.left}%`,
                animationDelay: `${b.delay}s`,
                animationDuration: `${b.duration}s`,
                '--drift': `${b.drift}px`,
              } as React.CSSProperties}
            />
          ))}
        </div>

        {/* Sparkle icons floating */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Sparkles className="login-sparkle absolute" style={{ top: '15%', left: '80%', animationDelay: '0s' }} size={20} />
          <Sparkles className="login-sparkle absolute" style={{ top: '45%', left: '10%', animationDelay: '3s' }} size={14} />
          <Droplets className="login-sparkle absolute" style={{ top: '70%', left: '70%', animationDelay: '5s' }} size={18} />
          <Sparkles className="login-sparkle absolute" style={{ top: '25%', left: '45%', animationDelay: '7s' }} size={12} />
          <Droplets className="login-sparkle absolute" style={{ top: '85%', left: '25%', animationDelay: '2s' }} size={16} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <img src="/CX.png" alt="FranClean" className="w-14 h-14 rounded-2xl object-contain drop-shadow-lg" />
            <div>
              <h1 className="text-white text-2xl font-extrabold tracking-tight">FranClean</h1>
              <p className="text-primary-200 text-sm font-medium">Gestion des Ressources Humaines</p>
            </div>
          </div>

          {/* Hero text */}
          <div className="space-y-8 max-w-lg">
            <div>
              <h2 className="text-white text-5xl font-extrabold leading-[1.1] tracking-tight">
                Gérez votre équipe<br />
                <span className="bg-gradient-to-r from-white to-primary-200 bg-clip-text text-transparent">en toute simplicité</span>
              </h2>
              <p className="text-primary-200/90 text-lg mt-5 leading-relaxed">
                Planning, pointage, suivi des heures — la propreté avant tout, la gestion en prime.
              </p>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-3">
              {features.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="group bg-white/[0.08] hover:bg-white/[0.14] backdrop-blur-md rounded-2xl p-4 border border-white/[0.08] hover:border-white/20 transition-all duration-300"
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      <Icon size={16} className="text-primary-200" />
                    </div>
                    <p className="text-white font-bold text-sm">{title}</p>
                  </div>
                  <p className="text-primary-300/80 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <p className="text-primary-400/60 text-sm">
            © {new Date().getFullYear()} FranClean — Tous droits réservés
          </p>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <img src="/CX.png" alt="FranClean" className="w-16 h-16 rounded-2xl object-contain mb-3" />
            <h1 className="text-slate-900 text-2xl font-extrabold">FranClean</h1>
            <p className="text-slate-400 text-sm">Gestion des Ressources Humaines</p>
          </div>

          {/* Welcome */}
          <div className="hidden lg:block mb-8">
            <p className="text-sm font-medium text-primary-600 mb-1">Bienvenue</p>
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Connexion</h2>
            <p className="text-slate-500 mt-2">Accédez à votre espace de travail</p>
          </div>
          <div className="lg:hidden text-center mb-8">
            <h2 className="text-2xl font-extrabold text-slate-900">Connexion</h2>
            <p className="text-slate-500 mt-1">Accédez à votre espace de travail</p>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/[0.04] border border-slate-200/60 p-8 sm:p-9">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.fr"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-sm"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all text-sm pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-rose-50 text-rose-600 text-sm px-4 py-3 rounded-xl border border-rose-200 animate-fadeIn flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-rose-500 rounded-full flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 text-white font-bold rounded-xl shadow-lg shadow-primary-600/30 hover:shadow-xl hover:shadow-primary-600/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm active:scale-[0.98]"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={18} />
                    Se connecter
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer for desktop */}
          <p className="hidden lg:block text-center text-xs text-slate-400 mt-8">
            © {new Date().getFullYear()} FranClean · Plateforme sécurisée
          </p>
        </div>
      </div>
    </div>
  );
}
