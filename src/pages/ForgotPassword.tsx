import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSuccess(true);
    } catch {
      setError('Erreur lors de l\'envoi. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-slate-900/[0.08] border border-slate-200/60 p-8">
          {/* Icon header */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1B3A5C] to-[#122A44] flex items-center justify-center mb-4 shadow-lg shadow-[#1B3A5C]/25">
              <Mail size={28} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Mot de passe oublié</h1>
            <p className="text-slate-500 text-sm mt-1.5 text-center leading-relaxed">
              Saisissez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
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
                  <p className="font-bold text-slate-800 text-base">Email envoyé !</p>
                  <p className="text-slate-500 text-sm mt-1 leading-relaxed">
                    Si cette adresse est associée à un compte, vous recevrez un email avec les instructions.<br />
                    Pensez à vérifier vos spams.
                  </p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-amber-700 text-xs text-center">
                ⏱ Le lien est valable <strong>1 heure</strong>
              </div>
            </div>
          ) : (
            /* Form */
            <form onSubmit={handleSubmit} className="space-y-5">
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
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#1B3A5C]/20 focus:border-[#1B3A5C] outline-none transition-all text-sm"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-[#1B3A5C] to-[#122A44] hover:from-[#122A44] hover:to-[#0E2137] text-white font-bold rounded-xl shadow-lg shadow-[#1B3A5C]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm active:scale-[0.98]"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                {loading ? 'Envoi en cours…' : 'Envoyer le lien de réinitialisation'}
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
