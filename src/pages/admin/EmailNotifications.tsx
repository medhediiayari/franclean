import { useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api';
import PageHeader from '../../components/common/PageHeader';
import Modal from '../../components/common/Modal';
import {
  Mail,
  Bell,
  Clock,
  Users,
  AlertTriangle,
  Check,
  X,
  Send,
  Settings,
  Plus,
  History,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  UserCheck,
  UserX,
  ShieldAlert,
  CalendarClock,
  LogIn,
  LogOut,
  Smartphone,
  MessageSquare,
  Eye,
  EyeOff,
} from 'lucide-react';

interface EmailRule {
  type: string;
  label: string;
  description: string;
  thresholdUnit: string;
  cronType: string;
  enabled: boolean;
  smsEnabled: boolean;
  recipients: string[];
  threshold: number;
}

interface EmailLogEntry {
  id: string;
  ruleType: string;
  recipient: string;
  subject: string;
  channel?: string;
  entityId?: string;
  sentAt: string;
}

interface SmsConfig {
  accountSid: string;
  authToken: string;
  phoneNumber: string;
  enabled: boolean;
  isConfigured: boolean;
}

const RULE_ICONS: Record<string, any> = {
  agent_assigned: UserCheck,
  mission_reminder: CalendarClock,
  unassigned_mission: AlertTriangle,
  no_checkin: LogIn,
  no_checkout: LogOut,
  suspect_attendance: ShieldAlert,
  event_refused: UserX,
};

const RULE_COLORS: Record<string, string> = {
  agent_assigned: 'bg-blue-500',
  mission_reminder: 'bg-amber-500',
  unassigned_mission: 'bg-orange-500',
  no_checkin: 'bg-red-500',
  no_checkout: 'bg-yellow-500',
  suspect_attendance: 'bg-red-600',
  event_refused: 'bg-rose-500',
};

export default function EmailNotifications() {
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showLogs, setShowLogs] = useState(false);
  const [newRecipient, setNewRecipient] = useState<Record<string, string>>({});

  // SMS config
  const [smsConfig, setSmsConfig] = useState<SmsConfig>({ accountSid: '', authToken: '', phoneNumber: '', enabled: false, isConfigured: false });
  const [smsForm, setSmsForm] = useState({ accountSid: '', authToken: '', phoneNumber: '' });
  const [smsSaving, setSmsSaving] = useState(false);
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testSmsSending, setTestSmsSending] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchRules = useCallback(async () => {
    try {
      const data = await api.get<EmailRule[]>('/email-notifications/rules');
      setRules(data);
    } catch (err) {
      console.error('Failed to fetch rules:', err);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await api.get<EmailLogEntry[]>('/email-notifications/logs?limit=100');
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  }, []);

  const fetchSmsConfig = useCallback(async () => {
    try {
      const data = await api.get<SmsConfig>('/email-notifications/sms-config');
      setSmsConfig(data);
      setSmsForm({ accountSid: data.accountSid, authToken: '', phoneNumber: data.phoneNumber });
    } catch (err) {
      console.error('Failed to fetch SMS config:', err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchRules(), fetchLogs(), fetchSmsConfig()]).finally(() => setLoading(false));
  }, [fetchRules, fetchLogs, fetchSmsConfig]);

  const updateRule = async (type: string, updates: Partial<EmailRule>) => {
    setSaving(type);
    try {
      const updated = await api.put<EmailRule>(`/email-notifications/rules/${type}`, updates);
      setRules((prev) => prev.map((r) => (r.type === type ? updated : r)));
    } catch (err) {
      console.error('Failed to update rule:', err);
    } finally {
      setSaving(null);
    }
  };

  const toggleRule = (type: string, field: 'enabled' | 'smsEnabled', currentValue: boolean) => {
    updateRule(type, { [field]: !currentValue });
  };

  const updateThreshold = (type: string, threshold: number) => {
    updateRule(type, { threshold });
  };

  const addRecipient = (type: string, rule: EmailRule) => {
    const email = newRecipient[type]?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (rule.recipients.includes(email)) return;
    updateRule(type, { recipients: [...rule.recipients, email] });
    setNewRecipient((prev) => ({ ...prev, [type]: '' }));
  };

  const removeRecipient = (type: string, rule: EmailRule, email: string) => {
    updateRule(type, { recipients: rule.recipients.filter((r) => r !== email) });
  };

  const sendTestEmail = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestResult(null);
    try {
      await api.post('/email-notifications/test', { email: testEmail.trim() });
      setTestResult({ ok: true, msg: 'Email de test envoyé avec succès !' });
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || 'Échec de l\'envoi' });
    } finally {
      setTestSending(false);
    }
  };

  const saveSmsConfig = async () => {
    setSmsSaving(true);
    try {
      const data: any = { accountSid: smsForm.accountSid, phoneNumber: smsForm.phoneNumber };
      if (smsForm.authToken) data.authToken = smsForm.authToken;
      const updated = await api.put<SmsConfig>('/email-notifications/sms-config', data);
      setSmsConfig(updated);
      setSmsForm((prev) => ({ ...prev, authToken: '' }));
      setShowAuthToken(false);
    } catch (err) {
      console.error('Failed to save SMS config:', err);
    } finally {
      setSmsSaving(false);
    }
  };

  const toggleSmsGlobal = async () => {
    setSmsSaving(true);
    try {
      const updated = await api.put<SmsConfig>('/email-notifications/sms-config', { enabled: !smsConfig.enabled });
      setSmsConfig(updated);
    } catch (err) {
      console.error('Failed to toggle SMS:', err);
    } finally {
      setSmsSaving(false);
    }
  };

  const sendTestSms = async () => {
    if (!testPhone.trim()) return;
    setTestSmsSending(true);
    setTestSmsResult(null);
    try {
      await api.post('/email-notifications/test-sms', { phone: testPhone.trim() });
      setTestSmsResult({ ok: true, msg: 'SMS de test envoyé !' });
    } catch (err: any) {
      setTestSmsResult({ ok: false, msg: err.message || 'Échec de l\'envoi' });
    } finally {
      setTestSmsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Configuration des alertes email et SMS automatiques"
      />

      {/* ── Email Test ─────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
            <Mail className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800">Test Email</h3>
            <p className="text-sm text-slate-500">Vérifiez que les emails sont bien envoyés</p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="votre@email.com"
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            onKeyDown={(e) => e.key === 'Enter' && sendTestEmail()}
          />
          <button onClick={sendTestEmail} disabled={testSending || !testEmail.trim()} className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors">
            {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Envoyer
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${testResult.ok ? 'text-green-600' : 'text-red-600'}`}>
            {testResult.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {testResult.msg}
          </div>
        )}
      </div>

      {/* ── SMS Twilio Config ──────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Configuration SMS (Twilio)</h3>
              <p className="text-sm text-slate-500">
                {smsConfig.isConfigured
                  ? <span className="text-emerald-600 font-medium">Configuré</span>
                  : <span className="text-amber-600">Non configuré</span>
                }
              </p>
            </div>
          </div>
          {smsConfig.isConfigured && (
            <button onClick={toggleSmsGlobal} disabled={smsSaving} className="flex-shrink-0">
              {smsConfig.enabled ? (
                <ToggleRight className="w-10 h-10 text-green-500" />
              ) : (
                <ToggleLeft className="w-10 h-10 text-slate-300" />
              )}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Account SID</label>
            <input
              type="text"
              value={smsForm.accountSid}
              onChange={(e) => setSmsForm((p) => ({ ...p, accountSid: e.target.value }))}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Auth Token</label>
            <div className="relative">
              <input
                type={showAuthToken ? 'text' : 'password'}
                value={smsForm.authToken}
                onChange={(e) => setSmsForm((p) => ({ ...p, authToken: e.target.value }))}
                placeholder={smsConfig.authToken || 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500 pr-9"
              />
              <button onClick={() => setShowAuthToken(!showAuthToken)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showAuthToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Numéro Twilio</label>
            <input
              type="text"
              value={smsForm.phoneNumber}
              onChange={(e) => setSmsForm((p) => ({ ...p, phoneNumber: e.target.value }))}
              placeholder="+1234567890"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={saveSmsConfig} disabled={smsSaving} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
            {smsSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Sauvegarder
          </button>

          {smsConfig.isConfigured && smsConfig.enabled && (
            <div className="flex-1 flex gap-2">
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+33 6 12 34 56 78"
                className="flex-1 max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500"
                onKeyDown={(e) => e.key === 'Enter' && sendTestSms()}
              />
              <button onClick={sendTestSms} disabled={testSmsSending || !testPhone.trim()} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
                {testSmsSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
                Test SMS
              </button>
            </div>
          )}
        </div>

        {testSmsResult && (
          <div className={`mt-3 flex items-center gap-2 text-sm ${testSmsResult.ok ? 'text-green-600' : 'text-red-600'}`}>
            {testSmsResult.ok ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            {testSmsResult.msg}
          </div>
        )}
      </div>

      {/* ── Rules Section ──────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-400" />
            Règles de notification
          </h3>
          <button onClick={() => setShowLogs(true)} className="flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
            <History className="w-4 h-4" />
            Historique ({logs.length})
          </button>
        </div>

        {rules.map((rule) => {
          const Icon = RULE_ICONS[rule.type] || Bell;
          const colorClass = RULE_COLORS[rule.type] || 'bg-slate-500';
          const isExpanded = expandedRule === rule.type;
          const isSaving = saving === rule.type;

          return (
            <div key={rule.type} className={`bg-white rounded-xl border transition-all ${rule.enabled || rule.smsEnabled ? 'border-slate-200' : 'border-slate-100 opacity-60'}`}>
              {/* Rule header */}
              <div className="flex items-center gap-4 p-4 cursor-pointer" onClick={() => setExpandedRule(isExpanded ? null : rule.type)}>
                <div className={`w-10 h-10 ${colorClass} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-slate-800">{rule.label}</h4>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${rule.cronType === 'instant' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                      {rule.cronType === 'instant' ? 'Instantané' : 'Planifié'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{rule.description}</p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />}

                  {/* Email toggle */}
                  <button onClick={(e) => { e.stopPropagation(); toggleRule(rule.type, 'enabled', rule.enabled); }} className="flex items-center gap-1 flex-shrink-0" title="Email">
                    <Mail className={`w-4 h-4 ${rule.enabled ? 'text-indigo-500' : 'text-slate-300'}`} />
                    {rule.enabled ? <ToggleRight className="w-7 h-7 text-indigo-500" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                  </button>

                  {/* SMS toggle */}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleRule(rule.type, 'smsEnabled', rule.smsEnabled); }}
                    className="flex items-center gap-1 flex-shrink-0"
                    title="SMS"
                    disabled={!smsConfig.isConfigured || !smsConfig.enabled}
                  >
                    <Smartphone className={`w-4 h-4 ${rule.smsEnabled && smsConfig.enabled ? 'text-emerald-500' : 'text-slate-300'}`} />
                    {rule.smsEnabled && smsConfig.enabled ? <ToggleRight className="w-7 h-7 text-emerald-500" /> : <ToggleLeft className="w-7 h-7 text-slate-300" />}
                  </button>

                  {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                </div>
              </div>

              {/* Rule details (expanded) */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50/50">
                  {/* Threshold */}
                  {rule.thresholdUnit && (
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        <Clock className="w-4 h-4 inline mr-1" />
                        Seuil ({rule.thresholdUnit})
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="0"
                          value={rule.threshold}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            setRules((prev) => prev.map((r) => r.type === rule.type ? { ...r, threshold: val } : r));
                          }}
                          className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                        <span className="text-sm text-slate-500">{rule.thresholdUnit}</span>
                        <button onClick={() => updateThreshold(rule.type, rule.threshold)} className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 transition-colors">
                          Sauvegarder
                        </button>
                      </div>
                      {rule.type === 'no_checkin' && <p className="text-xs text-slate-400 mt-1">Alerte envoyée si l'agent n'a pas pointé {rule.threshold} min après le début du créneau</p>}
                      {rule.type === 'no_checkout' && <p className="text-xs text-slate-400 mt-1">Alerte envoyée si pas de check-out {rule.threshold} min après la fin du créneau</p>}
                      {rule.type === 'unassigned_mission' && <p className="text-xs text-slate-400 mt-1">Alerte envoyée si pas d'agent assigné à J-{rule.threshold}</p>}
                      {rule.type === 'mission_reminder' && <p className="text-xs text-slate-400 mt-1">Rappel envoyé {rule.threshold} jour(s) avant la mission</p>}
                    </div>
                  )}

                  {/* Recipients */}
                  {rule.cronType !== 'instant' || rule.type === 'suspect_attendance' || rule.type === 'event_refused' ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-600 mb-1.5">
                        <Users className="w-4 h-4 inline mr-1" />
                        Destinataires email <span className="font-normal text-slate-400">(vide = tous les admins)</span>
                      </label>
                      <div className="flex flex-wrap gap-2 mb-2">
                        {rule.recipients.length === 0 && <span className="text-xs text-slate-400 italic">Tous les administrateurs</span>}
                        {rule.recipients.map((email) => (
                          <span key={email} className="inline-flex items-center gap-1 px-3 py-1 bg-white border border-slate-200 rounded-full text-xs text-slate-600">
                            {email}
                            <button onClick={() => removeRecipient(rule.type, rule, email)} className="hover:text-red-500 transition-colors"><X className="w-3 h-3" /></button>
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={newRecipient[rule.type] || ''}
                          onChange={(e) => setNewRecipient((prev) => ({ ...prev, [rule.type]: e.target.value }))}
                          placeholder="ajouter@email.com"
                          className="flex-1 max-w-xs rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500"
                          onKeyDown={(e) => e.key === 'Enter' && addRecipient(rule.type, rule)}
                        />
                        <button onClick={() => addRecipient(rule.type, rule)} className="px-3 py-1.5 bg-slate-600 text-white rounded-lg text-xs font-medium hover:bg-slate-700 transition-colors flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Ajouter
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {/* SMS info */}
                  {rule.smsEnabled && smsConfig.enabled && (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <Smartphone className="w-3 h-3" />
                      SMS activé — les admins avec un nº de téléphone recevront une alerte SMS
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Logs Modal ─────────────────────────── */}
      <Modal isOpen={showLogs} onClose={() => setShowLogs(false)} title="Historique des notifications" size="lg">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Aucune notification envoyée</p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Date</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Canal</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Type</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Destinataire</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Sujet</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const ruleLabel = rules.find((r) => r.type === log.ruleType)?.label || log.ruleType;
                  const isSms = log.channel === 'sms';
                  return (
                    <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                        {new Date(log.sentAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-3 py-2">
                        {isSms ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full"><Smartphone className="w-3 h-3" /> SMS</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full"><Mail className="w-3 h-3" /> Email</span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">{ruleLabel}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600 text-xs font-mono">{log.recipient}</td>
                      <td className="px-3 py-2 text-slate-700 truncate max-w-xs">{log.subject}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  );
}
