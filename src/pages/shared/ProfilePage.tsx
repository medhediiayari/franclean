import { useState, useRef } from 'react';
import { useAuthStore } from '../../store/authStore';
import { getInitials } from '../../utils/helpers';
import {
  Camera,
  User,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Save,
  Trash2,
  Shield,
  CheckCircle2,
  Hash,
  AlertCircle,
} from 'lucide-react';

// Generate stable agent matricule from user id
function agentMatricule(userId: string): string {
  const clean = userId.replace(/[^a-zA-Z0-9]/g, '');
  return 'AGT-' + clean.slice(-6).toUpperCase();
}

export default function ProfilePage() {
  const { user, updateProfile, updatePassword } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);

  // Profile form
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [avatar, setAvatar] = useState<string | null | undefined>(user?.avatar);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwError, setPwError] = useState('');

  if (!user) return null;

  const initials = getInitials(user.firstName, user.lastName);
  const isAgent = user.role === 'agent';

  // ── Avatar handling ──────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setProfileError('Photo trop lourde (max 10 Mo)');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── Save profile ──────────────────────────────────────
  const handleSaveProfile = async () => {
    setProfileError('');
    setProfileSuccess(false);
    setProfileSaving(true);
    try {
      await updateProfile({ firstName, lastName, phone, avatar: avatar ?? null });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: any) {
      setProfileError(err?.message ?? 'Erreur lors de la sauvegarde');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Save password ─────────────────────────────────────
  const handleSavePassword = async () => {
    setPwError('');
    setPwSuccess(false);
    if (newPassword !== confirmPassword) {
      setPwError('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 6) {
      setPwError('Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    setPwSaving(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setPwSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      setPwError(err?.message ?? 'Erreur lors du changement de mot de passe');
    } finally {
      setPwSaving(false);
    }
  };

  const roleLabel: Record<string, string> = {
    admin: 'Administrateur',
    agent: 'Agent de terrain',
    client: 'Client',
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-700 px-7 py-8 shadow-2xl">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-center gap-5">
          {/* Avatar large */}
          <div className="relative group">
            {avatar ? (
              <img src={avatar} alt={user.firstName} className="w-20 h-20 rounded-2xl object-cover ring-4 ring-white/30 shadow-xl" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-white text-2xl font-black ring-4 ring-white/20 shadow-xl select-none">
                {initials}
              </div>
            )}
            {/* Edit overlay */}
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute inset-0 rounded-2xl bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Changer la photo"
            >
              <Camera size={20} className="text-white" />
            </button>
            {avatar && (
              <button
                onClick={() => setAvatar(null)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors"
                title="Supprimer la photo"
              >
                <Trash2 size={12} className="text-white" />
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">{user.firstName} {user.lastName}</h1>
            <p className="text-white/60 text-sm mt-0.5">{roleLabel[user.role] ?? user.role}</p>
            {isAgent && (
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full border border-white/20">
                <Hash size={12} className="text-white/70" />
                <span className="text-white text-xs font-bold tracking-wider">{agentMatricule(user.id)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Informations personnelles ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center">
            <User size={16} className="text-indigo-600" />
          </div>
          <h2 className="font-bold text-slate-800">Informations personnelles</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Prénom</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nom</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
            <span className="inline-flex items-center gap-1"><Phone size={11} /> Téléphone</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition"
            placeholder="+33 6 00 00 00 00"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">
            <span className="inline-flex items-center gap-1"><Mail size={11} /> Email</span>
          </label>
          <input
            type="email"
            value={user.email}
            disabled
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-100 bg-slate-50 text-slate-400 text-sm cursor-not-allowed"
          />
          <p className="text-[11px] text-slate-400 mt-1">L'email ne peut pas être modifié ici.</p>
        </div>

        {/* Photo upload hint */}
        <div
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-3 p-3 rounded-xl border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-all group"
        >
          <div className="w-9 h-9 rounded-xl bg-slate-100 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
            <Camera size={16} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Photo de profil</p>
            <p className="text-xs text-slate-400">Cliquez pour sélectionner une image</p>
          </div>
          {avatar && <div className="ml-auto w-9 h-9 rounded-xl overflow-hidden ring-2 ring-indigo-200"><img src={avatar} alt="" className="w-full h-full object-cover" /></div>}
        </div>

        {profileError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
            <AlertCircle size={15} />
            {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
            <CheckCircle2 size={15} />
            Profil mis à jour avec succès !
          </div>
        )}

        <button
          onClick={handleSaveProfile}
          disabled={profileSaving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-lg shadow-indigo-500/25"
        >
          {profileSaving ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Save size={16} />
          )}
          {profileSaving ? 'Sauvegarde…' : 'Enregistrer les modifications'}
        </button>
      </div>

      {/* ── Changer le mot de passe ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
            <Shield size={16} className="text-amber-600" />
          </div>
          <h2 className="font-bold text-slate-800">Sécurité — Mot de passe</h2>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Mot de passe actuel</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              placeholder="••••••••"
            />
            <button onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 pr-10 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
              placeholder="Minimum 6 caractères"
            />
            <button onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase tracking-wider">Confirmer le nouveau mot de passe</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition"
            placeholder="••••••••"
          />
          {confirmPassword && newPassword !== confirmPassword && (
            <p className="text-xs text-rose-500 mt-1">Les mots de passe ne correspondent pas</p>
          )}
        </div>

        {pwError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
            <AlertCircle size={15} />
            {pwError}
          </div>
        )}
        {pwSuccess && (
          <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm">
            <CheckCircle2 size={15} />
            Mot de passe modifié avec succès !
          </div>
        )}

        <button
          onClick={handleSavePassword}
          disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword}
          className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold rounded-xl transition-all active:scale-95 shadow-lg shadow-amber-500/25"
        >
          {pwSaving ? (
            <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <Lock size={16} />
          )}
          {pwSaving ? 'Modification…' : 'Changer le mot de passe'}
        </button>
      </div>
    </div>
  );
}
