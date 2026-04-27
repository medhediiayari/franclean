import { useState, useRef, useEffect } from 'react';
import { Settings, Image, Building2, Mail, Save, Upload, X, RotateCcw, Eye } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import EmailNotificationsContent from './EmailNotifications';
import { useAppSettingsStore, getLogoSrc } from '../../store/appSettingsStore';

type Tab = 'identite' | 'emails' | 'client';

export default function Reglages() {
  const [activeTab, setActiveTab] = useState<Tab>('identite');
  const { settings, loading, fetchSettings, updateSettings } = useAppSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state (local)
  const [appName, setAppName] = useState('');
  const [appSubtitle, setAppSubtitle] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoBase64, setLogoBase64] = useState<string | null | undefined>(undefined); // undefined = unchanged
  const [companyName, setCompanyName] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Client portal photo settings
  const [clientPhotosCheckin, setClientPhotosCheckin] = useState(true);
  const [clientPhotosWork, setClientPhotosWork] = useState(true);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Populate form when settings load
  useEffect(() => {
    if (settings) {
      setAppName(settings.appName);
      setAppSubtitle(settings.appSubtitle ?? '');
      setLogoPreview(settings.appLogoBase64 || null);
      setCompanyName(settings.companyName ?? '');
      setCompanyEmail(settings.companyEmail ?? '');
      setCompanyPhone(settings.companyPhone ?? '');
      setCompanyAddress(settings.companyAddress ?? '');
      setClientPhotosCheckin(settings.clientPhotosCheckin ?? true);
      setClientPhotosWork(settings.clientPhotosWork ?? true);
    }
  }, [settings]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setLogoPreview(base64);
      setLogoBase64(base64);
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoPreview(null);
    setLogoBase64(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        appName: appName.trim() || 'Bipbip',
        appSubtitle: appSubtitle.trim(),
        ...(logoBase64 !== undefined ? { appLogoBase64: logoBase64 } : {}),
        companyName: companyName.trim() || null,
        companyEmail: companyEmail.trim() || null,
        companyPhone: companyPhone.trim() || null,
        companyAddress: companyAddress.trim() || null,
        clientPhotosCheckin,
        clientPhotosWork,
      });
      setLogoBase64(undefined); // reset dirty flag
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'identite', label: 'Identité de l\'application', icon: Image },    { key: 'client', label: 'Espace client', icon: Eye },    { key: 'emails', label: 'Notifications & E-mails', icon: Mail },
  ];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Réglages"
        subtitle="Personnalisation et configuration de l'application"
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Identité ── */}
      {activeTab === 'identite' && (
        <div className="space-y-6 max-w-2xl">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
              Chargement…
            </div>
          ) : (
            <>
              {/* Logo */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Image size={18} className="text-indigo-500" />
                  Logo de l'application
                </h3>
                <div className="flex items-center gap-5">
                  <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50">
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-1" />
                        <button
                          onClick={clearLogo}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <img src="/newfavicon.png" alt="Logo par défaut" className="w-full h-full object-contain p-2 opacity-40" />
                    )}
                  </div>
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="hidden"
                      onChange={handleLogoChange}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
                    >
                      <Upload size={15} />
                      Choisir un logo
                    </button>
                    {logoPreview && (
                      <button
                        onClick={clearLogo}
                        className="flex items-center gap-2 px-4 py-2 text-slate-600 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition"
                      >
                        <RotateCcw size={14} />
                        Réinitialiser
                      </button>
                    )}
                    <p className="text-xs text-slate-400">PNG, JPG, SVG ou WEBP</p>
                  </div>
                </div>
              </div>

              {/* App name & subtitle */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Settings size={18} className="text-indigo-500" />
                  Nom de l'application
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom affiché</label>
                    <input
                      type="text"
                      value={appName}
                      onChange={e => setAppName(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Bipbip"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Sous-titre</label>
                    <input
                      type="text"
                      value={appSubtitle}
                      onChange={e => setAppSubtitle(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Gestion RH"
                    />
                  </div>
                </div>
                {/* Preview */}
                <div className="flex items-center gap-3 mt-2 px-4 py-3 bg-[#0E2137] rounded-lg w-fit">
                  <img
                    src={logoPreview || '/newfavicon.png'}
                    alt="preview"
                    className="w-9 h-9 rounded-lg object-contain"
                  />
                  <div>
                    <p className="text-white font-extrabold text-base leading-tight">{appName || 'Bipbip'}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{appSubtitle || 'Gestion RH'}</p>
                  </div>
                </div>
              </div>

              {/* Company identity */}
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Building2 size={18} className="text-indigo-500" />
                  Identité de l'entreprise
                </h3>
                <p className="text-xs text-slate-400">
                  Ces informations apparaissent dans les e-mails envoyés et les documents exportés (PDFs).
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nom de l'entreprise</label>
                    <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="FranClean SAS" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de contact</label>
                    <input type="email" value={companyEmail} onChange={e => setCompanyEmail(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="contact@monentreprise.fr" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Téléphone</label>
                    <input type="text" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="+33 1 23 45 67 89" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Adresse</label>
                    <input type="text" value={companyAddress} onChange={e => setCompanyAddress(e.target.value)}
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="12 rue de la Paix, 75001 Paris" />
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {saved && (
                  <span className="text-sm text-emerald-600 font-medium">✓ Paramètres sauvegardés</span>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Emails ── */}
      {activeTab === 'emails' && <EmailNotificationsContent embedded />}

      {/* ── Tab: Client Portal ── */}
      {activeTab === 'client' && (
        <div className="space-y-6 max-w-2xl">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500 text-sm py-8">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600" />
              Chargement…
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Eye size={18} className="text-indigo-500" />
                  Visibilit\u00e9 des photos (par d\u00e9faut pour tous les clients)
                </h3>
                <p className="text-xs text-slate-400">
                  Ces r\u00e9glages s'appliquent \u00e0 tous les clients par d\u00e9faut. Vous pouvez ensuite personnaliser par client dans la fiche client.
                </p>

                <div className="space-y-4">
                  {/* Checkin photos toggle */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Photos de pointage</p>
                      <p className="text-xs text-slate-400 mt-0.5">Photos d'arriv\u00e9e et de d\u00e9part des agents</p>
                    </div>
                    <button
                      onClick={() => setClientPhotosCheckin(!clientPhotosCheckin)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        clientPhotosCheckin ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        clientPhotosCheckin ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {/* Work photos toggle */}
                  <div className="flex items-center justify-between bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Photos de travail</p>
                      <p className="text-xs text-slate-400 mt-0.5">Photos prises pendant l'intervention</p>
                    </div>
                    <button
                      onClick={() => setClientPhotosWork(!clientPhotosWork)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        clientPhotosWork ? 'bg-emerald-500' : 'bg-slate-300'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        clientPhotosWork ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 transition disabled:opacity-60"
                >
                  {saving ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                  ) : (
                    <Save size={16} />
                  )}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                {saved && (
                  <span className="text-sm text-emerald-600 font-medium">✓ Param\u00e8tres sauvegard\u00e9s</span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
