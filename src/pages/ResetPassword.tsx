import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { KeyRound, Eye, EyeOff, ArrowLeft, CheckCircle2, AlertCircle, Loader2, ShieldCheck } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Lien invalide. Veuillez faire une nouvelle demande de réinitialisation.');
    }
  }, [token]);

  // Password strength indicator
  const strength = (() => {
    if (newPassword.length === 0) return 0;
    let s = 0;
    if (newPassword.length >= 6) s++;
    if (newPassword.length >= 10) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Trop court', 'Faible', 'Moyen', 'Fort', 'Très fort'][strength];
  const strengthColor = ['', 'bg-rose-500', 'bg-orange-400', 'bg-amber-400', 'bg-emerald-400', 'bg-emerald-500'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 4000);
    } catch (err: any) {
      setError(err?.message ?? 'Lien invalide ou expiré. Veuillez faire une nouvelle demande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/[0.08] border border-slate-200/60 p-8">
          {/* Icon header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1B3A5C] to-[#122A44] flex items-center justify-center mb-4 shadow-lg shadow-[#1B3A5C]/25">
              <KeyRound size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Nouveau mot de passe</h1>
            <p className="text-slate-500 text-sm mt-1.5 text-center">
              Choisissez un nouveau mot de passe sécurisé pour votre compte.
            </p>
          </div>

          {success ? (
            /* Success state */
            <div className="space-y-5">
              <div className="flex flex-col items-center py-4 gap-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
                  <CheckCircle2 size={28} className="text-emerald-500" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-800 text-base">Mot de passe modifié !</p>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    Votre mot de passe a été réinitialisé avec succès.<br />
                    Vous allez être redirigé vers la connexion…
                  </p>
                </div>
              </div>
              <Link
                to="/login"
                className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#1B3A5C] to-[#122A44] text-white font-bold rounded-xl text-sm"
              >
                Se connecter maintenant
              </Link>
            </div>
          ) : !token ? (
            /* No token */
            <div className="space-y-5">
              <div className="flex items-start gap-3 px-4 py-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>Lien invalide. Veuillez faire une nouvelle demande de réinitialisation.</span>
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* New password */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Nouveau mot de passe</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 caractères"
                    required
                    autoFocus
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1B3A5C]/20 focus:border-[#1B3A5C] outline-none transition-all text-sm"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {/* Strength bar */}
                {newPassword.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= strength ? strengthColor : 'bg-slate-100'}`}
                        />
                      ))}
                    </div>
                    <p className={`text-[11px] font-semibold ${['', 'text-rose-500', 'text-orange-500', 'text-amber-500', 'text-emerald-600', 'text-emerald-700'][strength]}`}>
                      {strengthLabel}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirm */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Confirmer le mot de passe</label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1B3A5C]/20 focus:border-[#1B3A5C] outline-none transition-all text-sm"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} />Les mots de passe ne correspondent pas
                  </p>
                )}
                {confirmPassword && newPassword === confirmPassword && newPassword.length >= 6 && (
                  <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                    <ShieldCheck size={12} />Les mots de passe correspondent
                  </p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#1B3A5C] to-[#122A44] hover:from-[#122A44] hover:to-[#0E2137] text-white font-bold rounded-xl shadow-lg shadow-[#1B3A5C]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm active:scale-[0.98]"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
                {loading ? 'Réinitialisation…' : 'Définir le nouveau mot de passe'}
              </button>
            </form>
          )}

          {/* Back to login */}
          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ArrowLeft size={14} />
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
