import { useState, useEffect, useMemo } from 'react';
import { useClientStore } from '../../store/clientStore';
import Modal from '../../components/common/Modal';
import LocationPicker from '../../components/common/LocationPicker';
import type { ClientData, ClientSite } from '../../types';
import {
  Plus,
  Search,
  Edit3,
  Trash2,
  Building2,
  MapPin,
  Mail,
  Phone,
  FileText,
  X,
  Save,
  AlertTriangle,
} from 'lucide-react';

export default function Clients() {
  const { clients, loading, fetchClients, addClient, updateClient, deleteClient, addSite, updateSite, deleteSite } = useClientStore();

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const [search, setSearch] = useState('');
  const [expandedClientId, setExpandedClientId] = useState<string | null>(null);

  // Client form
  const [showClientForm, setShowClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);
  const [clientForm, setClientForm] = useState({ name: '', email: '', phone: '', address: '', notes: '', siret: '' });
  const [clientError, setClientError] = useState<string | null>(null);
  const [clientSaving, setClientSaving] = useState(false);

  // Site form
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [siteParentId, setSiteParentId] = useState<string | null>(null);
  const [editingSite, setEditingSite] = useState<ClientSite | null>(null);
  const [siteForm, setSiteForm] = useState({ name: '', address: '', latitude: '', longitude: '', geoRadius: '500', hourlyRate: '', notes: '' });
  const [siteError, setSiteError] = useState<string | null>(null);
  const [siteSaving, setSiteSaving] = useState(false);

  // Filter
  const filtered = search.trim()
    ? clients.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email?.toLowerCase().includes(search.toLowerCase()) ||
        c.sites.some((s) => s.name.toLowerCase().includes(search.toLowerCase()))
      )
    : clients;

  // ── Client CRUD ──────────────────────────────────────

  const openCreateClient = () => {
    setEditingClient(null);
    setClientForm({ name: '', email: '', phone: '', address: '', notes: '', siret: '' });
    setClientError(null);
    setShowClientForm(true);
  };

  const openEditClient = (client: ClientData) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
      notes: client.notes || '',
      siret: client.siret || '',
    });
    setClientError(null);
    setShowClientForm(true);
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientForm.name.trim()) { setClientError('Le nom est requis.'); return; }
    setClientError(null);
    setClientSaving(true);
    try {
      if (editingClient) {
        await updateClient(editingClient.id, {
          name: clientForm.name,
          email: clientForm.email || null,
          phone: clientForm.phone || null,
          address: clientForm.address || null,
          notes: clientForm.notes || null,
          siret: clientForm.siret || null,
        });
      } else {
        await addClient({
          name: clientForm.name,
          email: clientForm.email || undefined,
          phone: clientForm.phone || undefined,
          address: clientForm.address || undefined,
          notes: clientForm.notes || undefined,
          siret: clientForm.siret || undefined,
        });
      }
      setShowClientForm(false);
    } catch {
      setClientError('Erreur lors de la sauvegarde.');
    } finally {
      setClientSaving(false);
    }
  };

  const handleDeleteClient = async (client: ClientData) => {
    if (!confirm(`Supprimer le client "${client.name}" et tous ses sites ?`)) return;
    try {
      await deleteClient(client.id);
      if (expandedClientId === client.id) setExpandedClientId(null);
    } catch {
      alert('Erreur lors de la suppression.');
    }
  };

  // ── Site CRUD ────────────────────────────────────────

  const openCreateSite = (clientId: string) => {
    setEditingSite(null);
    setSiteParentId(clientId);
    setSiteForm({ name: '', address: '', latitude: '', longitude: '', geoRadius: '500', hourlyRate: '', notes: '' });
    setSiteError(null);
    setShowSiteForm(true);
  };

  const openEditSite = (clientId: string, site: ClientSite) => {
    setEditingSite(site);
    setSiteParentId(clientId);
    setSiteForm({
      name: site.name,
      address: site.address || '',
      latitude: site.latitude?.toString() || '',
      longitude: site.longitude?.toString() || '',
      geoRadius: site.geoRadius?.toString() || '500',
      hourlyRate: site.hourlyRate?.toString() || '',
      notes: site.notes || '',
    });
    setSiteError(null);
    setShowSiteForm(true);
  };

  const handleSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteParentId) return;
    if (!siteForm.name.trim()) { setSiteError('Le nom du site est requis.'); return; }
    if (!siteForm.address.trim() && (!siteForm.latitude || !siteForm.longitude)) { setSiteError("L'adresse ou une position sur la carte est requise."); return; }
    setSiteError(null);
    setSiteSaving(true);
    const data = {
      name: siteForm.name.trim(),
      address: siteForm.address || undefined,
      latitude: siteForm.latitude ? parseFloat(siteForm.latitude) : null,
      longitude: siteForm.longitude ? parseFloat(siteForm.longitude) : null,
      geoRadius: siteForm.geoRadius ? parseInt(siteForm.geoRadius) : 500,
      hourlyRate: siteForm.hourlyRate ? parseFloat(siteForm.hourlyRate) : null,
      notes: siteForm.notes || undefined,
    };
    try {
      if (editingSite) {
        await updateSite(siteParentId, editingSite.id, data);
      } else {
        await addSite(siteParentId, data);
      }
      setShowSiteForm(false);
    } catch {
      setSiteError('Erreur lors de la sauvegarde.');
    } finally {
      setSiteSaving(false);
    }
  };

  const handleDeleteSite = async (clientId: string, site: ClientSite) => {
    if (!confirm(`Supprimer le site "${site.name}" ?`)) return;
    try {
      await deleteSite(clientId, site.id);
    } catch {
      alert('Erreur lors de la suppression.');
    }
  };

  // Group clients into rows of 3 for detail panel insertion
  const COLS = 3;
  const rows = useMemo(() => {
    const r: ClientData[][] = [];
    for (let i = 0; i < filtered.length; i += COLS) {
      r.push(filtered.slice(i, i + COLS));
    }
    return r;
  }, [filtered]);

  const selectedClient = expandedClientId ? clients.find((c) => c.id === expandedClientId) : null;

  // ── Render ───────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between bg-[#0E2137] rounded-xl px-6 py-4 shadow-lg">
        <div>
          <h1 className="text-xl font-bold text-white">Clients</h1>
          <p className="text-slate-300 mt-0.5 text-sm">Gestion des clients et de leurs sites</p>
        </div>
        <button
          onClick={openCreateClient}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-medium text-sm shadow-lg shadow-primary-600/25 transition-all"
        >
          <Plus size={18} />
          Nouveau client
        </button>
      </div>

      {/* Search + Stats */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
            placeholder="Rechercher un client ou un site..."
          />
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 font-medium">
            {clients.length} client{clients.length > 1 ? 's' : ''}
          </span>
          <span className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 font-medium">
            {clients.reduce((sum, c) => sum + c.sites.length, 0)} site{clients.reduce((sum, c) => sum + c.sites.length, 0) > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Client grid */}
      {loading && clients.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">{search ? 'Aucun résultat pour cette recherche' : 'Aucun client créé'}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row, rowIdx) => {
            const expandedInRow = row.find((c) => c.id === expandedClientId);
            return (
              <div key={rowIdx}>
                {/* Row of cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {row.map((client) => {
                    const isSelected = expandedClientId === client.id;
                    return (
                      <div
                        key={client.id}
                        onClick={() => setExpandedClientId(isSelected ? null : client.id)}
                        className={`relative bg-white rounded-2xl border-2 p-4 cursor-pointer transition-all duration-200 hover:shadow-md group ${
                          isSelected
                            ? 'border-primary-500 shadow-lg shadow-primary-500/10 ring-1 ring-primary-500/20'
                            : 'border-slate-200/80 hover:border-slate-300'
                        }`}
                      >
                        {/* Action buttons (top-right, visible on hover) */}
                        <div className="absolute top-3 right-3 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditClient(client); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                            title="Modifier"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteClient(client); }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        {/* Card content */}
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                            isSelected ? 'bg-primary-600 text-white' : 'bg-primary-50 text-primary-600'
                          }`}>
                            <Building2 size={18} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-slate-900 truncate pr-16">{client.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                client.sites.length > 0
                                  ? 'bg-emerald-50 text-emerald-600'
                                  : 'bg-slate-100 text-slate-400'
                              }`}>
                                {client.sites.length} site{client.sites.length > 1 ? 's' : ''}
                              </span>
                              {client.siret && (
                                <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full font-semibold">
                                  SIRET
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Compact info */}
                        <div className="mt-3 space-y-1">
                          {client.email && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                              <Mail size={10} className="flex-shrink-0" /> {client.email}
                            </p>
                          )}
                          {client.phone && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                              <Phone size={10} className="flex-shrink-0" /> {client.phone}
                            </p>
                          )}
                          {client.address && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1.5 truncate">
                              <MapPin size={10} className="flex-shrink-0" /> {client.address}
                            </p>
                          )}
                          {!client.email && !client.phone && !client.address && (
                            <p className="text-[11px] text-slate-300 italic">Aucune info de contact</p>
                          )}
                        </div>

                        {/* Selection indicator */}
                        {isSelected && (
                          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 bg-primary-500 rotate-45 rounded-sm z-10" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Detail panel below the row */}
                {expandedInRow && selectedClient && (
                  <div className="mt-3 bg-white rounded-2xl border-2 border-primary-200 shadow-lg overflow-hidden animate-fadeIn">
                    {/* Detail header */}
                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary-50 to-slate-50 border-b border-primary-100">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center">
                          <Building2 size={18} />
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-slate-900">{selectedClient.name}</h3>
                          <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                            {selectedClient.email && (
                              <span className="flex items-center gap-1"><Mail size={11} /> {selectedClient.email}</span>
                            )}
                            {selectedClient.phone && (
                              <span className="flex items-center gap-1"><Phone size={11} /> {selectedClient.phone}</span>
                            )}
                            {selectedClient.address && (
                              <span className="flex items-center gap-1"><MapPin size={11} /> {selectedClient.address}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditClient(selectedClient)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                        >
                          <Edit3 size={13} /> Modifier
                        </button>
                        <button
                          onClick={() => setExpandedClientId(null)}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white transition-colors"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Detail body */}
                    <div className="px-6 py-5">
                      {/* Juridique badges */}
                      {(selectedClient.siret || selectedClient.formeJuridique || selectedClient.representantLegal) && (
                        <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {selectedClient.siret && (
                            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">SIRET</p>
                              <p className="text-xs font-mono text-slate-700">{selectedClient.siret}</p>
                            </div>
                          )}
                          {selectedClient.formeJuridique && (
                            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Forme</p>
                              <p className="text-xs text-slate-700">{selectedClient.formeJuridique}</p>
                            </div>
                          )}
                          {selectedClient.tvaNumber && (
                            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">TVA</p>
                              <p className="text-xs font-mono text-slate-700">{selectedClient.tvaNumber}</p>
                            </div>
                          )}
                          {selectedClient.representantLegal && (
                            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Représentant</p>
                              <p className="text-xs text-slate-700">{selectedClient.representantLegal}{selectedClient.representantRole ? ` (${selectedClient.representantRole})` : ''}</p>
                            </div>
                          )}
                          {selectedClient.codeApe && (
                            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">APE</p>
                              <p className="text-xs font-mono text-slate-700">{selectedClient.codeApe}</p>
                            </div>
                          )}
                          {selectedClient.rcs && (
                            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">RCS</p>
                              <p className="text-xs text-slate-700">{selectedClient.rcs}</p>
                            </div>
                          )}
                          {selectedClient.capitalSocial && (
                            <div className="px-3 py-2 bg-slate-50 rounded-lg border border-slate-200">
                              <p className="text-[10px] text-slate-400 uppercase font-semibold">Capital</p>
                              <p className="text-xs text-slate-700">{selectedClient.capitalSocial}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Notes */}
                      {selectedClient.notes && (
                        <div className="mb-5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-start gap-2">
                          <FileText size={14} className="text-amber-500 mt-0.5 flex-shrink-0" />
                          {selectedClient.notes}
                        </div>
                      )}

                      {/* Sites header */}
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <MapPin size={15} className="text-primary-500" />
                          Sites ({selectedClient.sites.length})
                        </h4>
                        <button
                          onClick={() => openCreateSite(selectedClient.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-lg transition-colors"
                        >
                          <Plus size={13} /> Ajouter un site
                        </button>
                      </div>

                      {/* Sites grid */}
                      {selectedClient.sites.length === 0 ? (
                        <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center">
                          <MapPin size={28} className="mx-auto text-slate-300 mb-2" />
                          <p className="text-sm text-slate-400">Aucun site. Ajoutez le premier site pour ce client.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {selectedClient.sites.map((site) => (
                            <div key={site.id} className="bg-slate-50 rounded-xl border border-slate-200 p-4 hover:bg-white hover:shadow-sm transition-all group/site">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                                    <MapPin size={14} className="text-emerald-600" />
                                  </div>
                                  <h5 className="text-sm font-semibold text-slate-900 truncate">{site.name}</h5>
                                </div>
                                <div className="flex items-center gap-0.5 opacity-0 group-hover/site:opacity-100 transition-opacity">
                                  <button
                                    onClick={() => openEditSite(selectedClient.id, site)}
                                    className="p-1.5 rounded text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors"
                                  >
                                    <Edit3 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteSite(selectedClient.id, site)}
                                    className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              {site.address && (
                                <p className="text-xs text-slate-500 mb-1 flex items-center gap-1.5">
                                  <MapPin size={11} className="text-slate-400 flex-shrink-0" />
                                  <span className="truncate">{site.address}</span>
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                {site.latitude && site.longitude && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-slate-200/70 text-slate-500 rounded font-medium">
                                    Rayon: {site.geoRadius}m
                                  </span>
                                )}
                                {site.hourlyRate && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded font-medium">
                                    {site.hourlyRate}€/h
                                  </span>
                                )}
                              </div>
                              {site.notes && (
                                <p className="text-[10px] text-slate-400 mt-1.5 italic truncate">{site.notes}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Client Form Modal ── */}
      <Modal
        isOpen={showClientForm}
        onClose={() => setShowClientForm(false)}
        title={editingClient ? 'Modifier le client' : 'Nouveau client'}
        size="md"
      >
        <form onSubmit={handleClientSubmit} className="space-y-4">
          {clientError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              {clientError}
            </div>
          )}

          {/* Section: Informations générales */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Raison sociale *</label>
            <input
              type="text"
              value={clientForm.name}
              onChange={(e) => setClientForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="NOM DU CLIENT"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
              <input
                type="email"
                value={clientForm.email}
                onChange={(e) => setClientForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="contact@client.fr"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Téléphone</label>
              <input
                type="tel"
                value={clientForm.phone}
                onChange={(e) => setClientForm((f) => ({ ...f, phone: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="+33 6 00 00 00 00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Adresse du siège social</label>
            <input
              type="text"
              value={clientForm.address}
              onChange={(e) => setClientForm((f) => ({ ...f, address: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Adresse du siège"
            />
          </div>

          {/* SIRET */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">SIRET <span className="font-normal text-slate-400">(14 chiffres)</span></label>
            <input
              type="text"
              value={clientForm.siret}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 14);
                setClientForm((f) => ({ ...f, siret: v }));
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono"
              placeholder="12345678900012"
              maxLength={14}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
            <textarea
              value={clientForm.notes}
              onChange={(e) => setClientForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none resize-none"
              placeholder="Notes internes..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowClientForm(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={clientSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 rounded-xl shadow-lg shadow-primary-600/25 transition-all"
            >
              <Save size={16} />
              {clientSaving ? 'Enregistrement...' : editingClient ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Site Form Modal ── */}
      <Modal
        isOpen={showSiteForm}
        onClose={() => setShowSiteForm(false)}
        title={editingSite ? 'Modifier le site' : 'Nouveau site'}
        size="lg"
      >
        <form onSubmit={handleSiteSubmit} className="space-y-4">
          {siteError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
              {siteError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nom du site *</label>
            <input
              type="text"
              value={siteForm.name}
              onChange={(e) => setSiteForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
              placeholder="Nom du site d'intervention"
            />
          </div>

          <LocationPicker
            address={siteForm.address}
            latitude={siteForm.latitude}
            longitude={siteForm.longitude}
            onUpdate={(fields) => setSiteForm((f) => ({ ...f, ...fields }))}
          />

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Rayon GPS (m)</label>
              <input
                type="number"
                value={siteForm.geoRadius}
                onChange={(e) => setSiteForm((f) => ({ ...f, geoRadius: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Prix/heure (€) <span className="font-normal text-slate-400">— facturé au client</span></label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={siteForm.hourlyRate}
                onChange={(e) => setSiteForm((f) => ({ ...f, hourlyRate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Notes</label>
              <input
                type="text"
                value={siteForm.notes}
                onChange={(e) => setSiteForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Notes sur le site..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowSiteForm(false)}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={siteSaving}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:bg-slate-300 rounded-xl shadow-lg shadow-primary-600/25 transition-all"
            >
              <Save size={16} />
              {siteSaving ? 'Enregistrement...' : editingSite ? 'Enregistrer' : 'Créer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
