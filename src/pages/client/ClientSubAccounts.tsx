import { useEffect, useState } from 'react';
import { useClientPortalStore } from '../../store/clientPortalStore';
import {
  Users,
  UserPlus,
  Sparkles,
  Shield,
  MapPin,
  Mail,
  Phone,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  X,
  Check,
  AlertTriangle,
} from 'lucide-react';

interface SubAccountForm {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  phone: string;
  siteIds: string[];
}

const emptyForm: SubAccountForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  siteIds: [],
};

export default function ClientSubAccounts() {
  const {
    clientInfo,
    subAccounts,
    fetchClientInfo,
    fetchSubAccounts,
    createSubAccount,
    updateSubAccount,
    deleteSubAccount,
    loading,
  } = useClientPortalStore();

  const [visible, setVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SubAccountForm>(emptyForm);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchClientInfo();
    fetchSubAccounts();
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, [fetchClientInfo, fetchSubAccounts]);

  const sites = clientInfo?.sites || [];

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowPassword(false);
    setShowModal(true);
  };

  const openEdit = (account: (typeof subAccounts)[0]) => {
    setEditingId(account.id);
    setForm({
      firstName: account.firstName,
      lastName: account.lastName,
      email: account.email,
      password: '',
      phone: account.phone,
      siteIds: account.sites.map((s) => s.id),
    });
    setError('');
    setShowPassword(false);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      if (editingId) {
        const data: any = {
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          siteIds: form.siteIds,
        };
        if (form.password) data.password = form.password;
        await updateSubAccount(editingId, data);
      } else {
        if (!form.password || form.password.length < 6) {
          setError('Le mot de passe doit contenir au moins 6 caractères');
          setSaving(false);
          return;
        }
        await createSubAccount({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          password: form.password,
          phone: form.phone,
          siteIds: form.siteIds,
        });
      }
      setShowModal(false);
      await fetchSubAccounts();
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSubAccount(id);
      setDeleteConfirm(null);
      await fetchSubAccounts();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleToggleActive = async (account: (typeof subAccounts)[0]) => {
    try {
      await updateSubAccount(account.id, { isActive: !account.isActive });
      await fetchSubAccounts();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const toggleSite = (siteId: string) => {
    setForm((f) => ({
      ...f,
      siteIds: f.siteIds.includes(siteId)
        ? f.siteIds.filter((id) => id !== siteId)
        : [...f.siteIds, siteId],
    }));
  };

  if (loading && !clientInfo) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="relative">
          <div className="w-14 h-14 rounded-full border-[3px] border-emerald-100 border-t-emerald-500 animate-spin" />
          <Sparkles size={18} className="absolute inset-0 m-auto text-emerald-500 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 transition-all duration-700 ${visible ? 'opacity-100' : 'opacity-0 translate-y-4'}`}>
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl mesh-gradient px-7 py-8 md:px-10 md:py-10 shadow-2xl">
        <div className="orb w-32 h-32 bg-blue-400/15 top-0 right-10" />
        <div className="orb orb-alt w-24 h-24 bg-emerald-400/10 bottom-0 left-20" />
        <div className="dot-pattern absolute inset-0" />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-sm rounded-full mb-4 border border-white/10">
              <Users size={13} className="text-blue-300" />
              <span className="text-blue-200 text-[11px] font-bold tracking-widest uppercase">Sous-comptes</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">
              <span className="bg-gradient-to-r from-white to-white/70 bg-clip-text text-transparent">
                {subAccounts.length} employé{subAccounts.length > 1 ? 's' : ''}
              </span>
            </h1>
            <p className="text-white/40 mt-2 text-sm max-w-lg">
              Gérez les accès de vos employés à l'espace client.
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-2xl bg-white/[0.08] backdrop-blur-sm flex items-center justify-center border border-white/10">
              <Shield size={36} className="text-white/40" />
            </div>
          </div>
        </div>
      </div>

      {/* Add button */}
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
        >
          <UserPlus size={16} />
          Ajouter un employé
        </button>
      </div>

      {/* Sub-accounts list */}
      {subAccounts.length === 0 ? (
        <div className="glass-card rounded-2xl border border-dashed border-slate-200 p-14 text-center hover-lift">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-5 shadow-inner">
            <Users size={32} className="text-slate-300" />
          </div>
          <p className="text-lg font-bold text-slate-400">Aucun sous-compte</p>
          <p className="text-sm text-slate-400/70 mt-2">
            Créez des accès pour vos employés afin qu'ils puissent consulter les missions et photos de leurs sites.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
          {subAccounts.map((account) => (
            <div
              key={account.id}
              className="group relative bg-white rounded-2xl border border-slate-200/60 shadow-sm hover-lift card-shine overflow-hidden"
            >
              {/* Top accent */}
              <div className={`h-1 w-full ${account.isActive ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-slate-300 to-slate-400'}`} />

              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white text-sm font-extrabold shadow-lg transition-all duration-500 group-hover:scale-110 ${
                      account.isActive
                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/25'
                        : 'bg-gradient-to-br from-slate-400 to-slate-500 shadow-slate-400/25'
                    }`}>
                      {account.firstName[0]}{account.lastName[0]}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {account.firstName} {account.lastName}
                      </h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                        account.isActive
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${account.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {account.isActive ? 'Actif' : 'Inactif'}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEdit(account)}
                      className="p-2 rounded-xl text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                      title="Modifier"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => handleToggleActive(account)}
                      className={`p-2 rounded-xl transition-all ${
                        account.isActive
                          ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                          : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                      }`}
                      title={account.isActive ? 'Désactiver' : 'Activer'}
                    >
                      {account.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                    {deleteConfirm === account.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="p-2 rounded-xl text-red-500 hover:bg-red-50 transition-all"
                          title="Confirmer"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(null)}
                          className="p-2 rounded-xl text-slate-400 hover:bg-slate-50 transition-all"
                          title="Annuler"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(account.id)}
                        className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                        title="Supprimer"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Contact info */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Mail size={13} className="text-slate-400" />
                    <span className="truncate">{account.email}</span>
                  </div>
                  {account.phone && (
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone size={13} className="text-slate-400" />
                      <span>{account.phone}</span>
                    </div>
                  )}
                </div>

                {/* Assigned sites */}
                <div className="border-t border-slate-100 pt-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Sites autorisés</p>
                  {account.sites.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">Aucun site assigné</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {account.sites.map((site) => (
                        <span
                          key={site.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-semibold"
                        >
                          <MapPin size={10} />
                          {site.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white rounded-t-3xl border-b border-slate-100 px-6 py-5 flex items-center justify-between z-10">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {editingId ? 'Modifier le sous-compte' : 'Nouveau sous-compte'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingId ? 'Modifiez les informations et les accès' : 'Créez un accès employé à votre espace client'}
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                  <AlertTriangle size={16} />
                  {error}
                </div>
              )}

              {/* Name fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Prénom</label>
                  <input
                    type="text"
                    required
                    value={form.firstName}
                    onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    placeholder="Prénom"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">Nom</label>
                  <input
                    type="text"
                    required
                    value={form.lastName}
                    onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    placeholder="Nom"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Email</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    placeholder="employe@exemple.fr"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Mot de passe {editingId && <span className="text-slate-400 font-normal">(laisser vide pour ne pas changer)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all pr-10"
                    placeholder={editingId ? '••••••' : 'Min. 6 caractères'}
                    required={!editingId}
                    minLength={editingId ? undefined : 6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">Téléphone <span className="text-slate-400 font-normal">(optionnel)</span></label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all"
                    placeholder="+33 6 00 00 00 00"
                  />
                </div>
              </div>

              {/* Sites assignment */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">
                  Sites autorisés
                  <span className="text-slate-400 font-normal ml-1">({form.siteIds.length} sélectionné{form.siteIds.length > 1 ? 's' : ''})</span>
                </label>
                {sites.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-3">Aucun site configuré pour ce client.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto rounded-xl border border-slate-200 p-3">
                    {sites.map((site) => {
                      const checked = form.siteIds.includes(site.id);
                      return (
                        <label
                          key={site.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 ${
                            checked
                              ? 'bg-emerald-50 border border-emerald-200'
                              : 'hover:bg-slate-50 border border-transparent'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSite(site.id)}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800">{site.name}</p>
                            {site.address && (
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">{site.address}</p>
                            )}
                          </div>
                          <MapPin size={14} className={checked ? 'text-emerald-500' : 'text-slate-300'} />
                        </label>
                      );
                    })}
                  </div>
                )}
                <p className="text-[11px] text-slate-400 mt-2">
                  L'employé n'aura accès qu'aux missions et photos des sites sélectionnés.
                </p>
              </div>

              {/* Submit */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 disabled:opacity-50 transition-all"
                >
                  {saving ? 'Enregistrement...' : editingId ? 'Modifier' : 'Créer le compte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
