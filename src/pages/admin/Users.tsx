import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import Modal from '../../components/common/Modal';
import { getInitials } from '../../utils/helpers';
import type { User, Role } from '../../types';
import {
  Plus,
  Edit3,
  Trash2,
  Search,
  UserCheck,
  UserX,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  Building2,
} from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';

export default function Users() {
  const { users, addUser, updateUser, deleteUser, fetchUsers } = useAuthStore();

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleBulkRefuse = async (value: boolean) => {
    try {
      const { api } = await import('../../lib/api');
      await api.put('/users/bulk-refuse', { canRefuseEvents: value });
      await fetchUsers();
      setBulkMsg(value ? 'Tous les agents peuvent refuser les missions' : 'Tous les agents sont forcés d\'accepter les missions');
      setTimeout(() => setBulkMsg(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'agent' as Role,
    isActive: true,
    canRefuseEvents: true,
    agentPercentage: '' as string | number,
  });

  const filteredUsers = users.filter((u) => {
    if (filterRole !== 'all' && u.role !== filterRole) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      return (
        u.firstName.toLowerCase().includes(s) ||
        u.lastName.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const resetForm = () =>
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
      role: 'agent',
      isActive: true,
      canRefuseEvents: true,
      agentPercentage: '',
    });

  const handleEdit = (user: User) => {
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      password: '',
      role: user.role,
      isActive: user.isActive,
      canRefuseEvents: user.canRefuseEvents,
      agentPercentage: user.agentPercentage ?? '',
    });
    setSelectedUserId(user.id);
    setFormMode('edit');
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (formMode === 'create') {
        await addUser({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          password: form.password,
          role: form.role,
          isActive: form.isActive,
          canRefuseEvents: form.canRefuseEvents,
          agentPercentage: form.agentPercentage === '' ? null : Number(form.agentPercentage),
        });
      } else if (selectedUserId) {
        const data: Record<string, unknown> = {
          ...form,
          agentPercentage: form.agentPercentage === '' ? null : Number(form.agentPercentage),
        };
        if (!form.password) delete data.password;
        await updateUser(selectedUserId, data as Partial<User> & { password?: string });
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cet utilisateur ?')) {
      try { await deleteUser(id); } catch (err) { alert(err instanceof Error ? err.message : 'Erreur'); }
    }
  };

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const agentCount = users.filter((u) => u.role === 'agent').length;
  const clientCount = users.filter((u) => u.role === 'client').length;
  const activeCount = users.filter((u) => u.isActive).length;
  const agents = users.filter((u) => u.role === 'agent');
  const allCanRefuse = agents.length > 0 && agents.every((a) => a.canRefuseEvents);

  return (
    <div className="space-y-6 animate-fadeIn">
      <PageHeader
        title="Utilisateurs"
        subtitle="Gestion des comptes et des rôles"
        action={
          <button
            onClick={() => {
              resetForm();
              setFormMode('create');
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-primary-600/25 transition-all"
          >
            <Plus size={18} />
            Nouvel utilisateur
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Admins" value={adminCount} icon={Shield} iconBg="bg-purple-50" iconColor="text-purple-600" />
        <StatCard label="Agents" value={agentCount} icon={UserCheck} iconBg="bg-blue-50" iconColor="text-blue-600" />
        <StatCard label="Clients" value={clientCount} icon={Building2} iconBg="bg-amber-50" iconColor="text-amber-600" />
        <StatCard label="Actifs" value={activeCount} subtitle={`/ ${users.length} total`} icon={UserCheck} iconBg="bg-emerald-50" iconColor="text-emerald-600" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 flex flex-wrap items-center gap-3 shadow-card">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          className="px-3 py-2 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
        >
          <option value="all">Tous les rôles</option>
          <option value="admin">Admin</option>
          <option value="agent">Agent</option>
          <option value="client">Client</option>
        </select>
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs font-medium text-slate-500 hidden sm:inline">Refus missions</span>
          <button
            type="button"
            onClick={() => handleBulkRefuse(!allCanRefuse)}
            className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
              allCanRefuse ? 'bg-primary-600' : 'bg-slate-300'
            }`}
            title={allCanRefuse ? 'Désactiver le refus pour tous les agents' : 'Activer le refus pour tous les agents'}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                allCanRefuse ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {bulkMsg && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary-50 border border-primary-100 text-primary-700 text-sm font-medium animate-fadeIn">
          <CheckCircle2 size={16} />
          {bulkMsg}
        </div>
      )}

      {/* User cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredUsers.map((user) => (
          <div
            key={user.id}
            className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-card hover:shadow-card-hover transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold ${
                    user.role === 'admin'
                      ? 'bg-purple-100 text-purple-700'
                      : user.role === 'client'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-primary-100 text-primary-700'
                  }`}
                >
                  {getInitials(user.firstName, user.lastName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {user.firstName} {user.lastName}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      user.role === 'admin'
                        ? 'bg-purple-100 text-purple-700'
                        : user.role === 'client'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {user.role === 'admin' ? (
                      <Shield size={10} />
                    ) : user.role === 'client' ? (
                      <Building2 size={10} />
                    ) : (
                      <UserCheck size={10} />
                    )}
                    {user.role === 'admin' ? 'Admin' : user.role === 'client' ? 'Client' : 'Agent'}
                  </span>
                </div>
              </div>
              <span
                className={`w-2.5 h-2.5 rounded-full mt-1 ${
                  user.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                }`}
                title={user.isActive ? 'Actif' : 'Inactif'}
              />
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Mail size={14} />
                <span className="truncate">{user.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Phone size={14} />
                <span>{user.phone}</span>
              </div>
              {user.role === 'agent' && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="text-xs font-medium text-slate-400 w-[14px] text-center">%</span>
                  <span>{user.agentPercentage != null ? `${user.agentPercentage}%` : <span className="italic text-slate-400">Non défini</span>}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2">
              <button
                onClick={() => handleEdit(user)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors"
              >
                <Edit3 size={12} /> Modifier
              </button>
              <button
                onClick={() => handleDelete(user.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors"
              >
                <Trash2 size={12} /> Supprimer
              </button>
              <button
                onClick={() => updateUser(user.id, { isActive: !user.isActive })}
                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  user.isActive
                    ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                    : 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100'
                }`}
              >
                {user.isActive ? (
                  <>
                    <UserX size={12} /> Désactiver
                  </>
                ) : (
                  <>
                    <UserCheck size={12} /> Activer
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredUsers.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-sm text-slate-400">
          Aucun utilisateur trouvé
        </div>
      )}

      {/* Form modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={formMode === 'create' ? 'Nouvel utilisateur' : 'Modifier l\'utilisateur'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Prénom *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom *</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                required
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone *</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Mot de passe {formMode === 'create' ? '*' : '(laisser vide pour ne pas changer)'}
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              required={formMode === 'create'}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Rôle *</label>
              <select
                value={form.role}
                onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="agent">Agent</option>
                <option value="admin">Administrateur</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Statut</label>
              <select
                value={form.isActive ? 'true' : 'false'}
                onChange={(e) =>
                  setForm((f) => ({ ...f, isActive: e.target.value === 'true' }))
                }
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              >
                <option value="true">Actif</option>
                <option value="false">Inactif</option>
              </select>
            </div>
          </div>

          {form.role === 'agent' && (
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-slate-50">
              <div>
                <label className="block text-sm font-medium text-slate-700">Peut refuser des missions</label>
                <p className="text-xs text-slate-500">Si désactivé, l'agent est forcé d'accepter les missions assignées</p>
              </div>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, canRefuseEvents: !f.canRefuseEvents }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  form.canRefuseEvents ? 'bg-primary-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    form.canRefuseEvents ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}

          {form.role === 'agent' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Pourcentage agent (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={form.agentPercentage}
                onChange={(e) => setForm((f) => ({ ...f, agentPercentage: e.target.value === '' ? '' : Number(e.target.value) }))}
                placeholder="Ex: 70"
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Pourcentage utilisé pour calculer la facturation par heure de l'agent</p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/25 transition-all"
            >
              {formMode === 'create' ? 'Créer' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
