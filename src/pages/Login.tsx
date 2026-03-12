import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Eye, EyeOff, LogIn } from 'lucide-react';

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

  return (
    <div className="min-h-screen flex">
      {/* Left panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold text-lg">
              FC
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">FranClean</h1>
              <p className="text-primary-200 text-sm">Ressources Humaines</p>
            </div>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h2 className="text-white text-4xl font-bold leading-tight">
            Gérez votre équipe<br />
            en toute simplicité
          </h2>
          <p className="text-primary-200 text-lg max-w-md">
            Planning, pointage, suivi des heures — tout dans une seule plateforme sécurisée et intuitive.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-md">
            {[
              { val: 'Planning', desc: 'Gestion centralisée' },
              { val: 'Pointage', desc: 'Photo + GPS' },
              { val: 'Validation', desc: 'Contrôle admin' },
              { val: 'Suivi', desc: 'Heures en temps réel' },
            ].map((item) => (
              <div
                key={item.val}
                className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10"
              >
                <p className="text-white font-semibold">{item.val}</p>
                <p className="text-primary-200 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-primary-300 text-sm">
            © {new Date().getFullYear()} FranClean — Tous droits réservés
          </p>
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white font-bold">
              FC
            </div>
            <div>
              <h1 className="text-slate-900 text-xl font-bold">FranClean</h1>
              <p className="text-slate-400 text-xs">Ressources Humaines</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/50 p-8">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-slate-900">Connexion</h2>
              <p className="text-slate-500 mt-1">Accédez à votre espace de travail</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Adresse email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.fr"
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Mot de passe
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-sm pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="bg-rose-50 text-rose-600 text-sm px-4 py-3 rounded-xl border border-rose-200 animate-fadeIn">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl shadow-lg shadow-primary-600/25 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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

            {/* Demo accounts */}
            <div className="mt-8 pt-6 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-3">
                Comptes de démonstration
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setEmail('admin@franclean.fr');
                    setPassword('demo');
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors group"
                >
                  <span className="text-sm font-medium text-slate-700 group-hover:text-primary-600">
                    Admin
                  </span>
                  <span className="text-xs text-slate-400 ml-2">admin@franclean.fr</span>
                </button>
                <button
                  onClick={() => {
                    setEmail('ahmed@franclean.fr');
                    setPassword('demo');
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 transition-colors group"
                >
                  <span className="text-sm font-medium text-slate-700 group-hover:text-primary-600">
                    Agent
                  </span>
                  <span className="text-xs text-slate-400 ml-2">ahmed@franclean.fr</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
