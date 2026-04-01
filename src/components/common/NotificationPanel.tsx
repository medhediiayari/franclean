import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Clock,
  CalendarX2,
  UserX,
  UserCheck,
  Timer,
  LogOut as LogOutIcon,
  CheckCircle2,
  BellOff,
  X,
  ChevronRight,
  CalendarClock,
} from 'lucide-react';
import { useNotificationStore, type AdminNotification, type NotificationType } from '../../store/notificationStore';

const iconMap: Record<NotificationType, React.ElementType> = {
  suspect: AlertTriangle,
  reassign: CalendarX2,
  overtime: Timer,
  early_leave: LogOutIcon,
  no_checkout: Clock,
  accepted: UserCheck,
  refused: UserX,
  pending: CheckCircle2,
  unassigned: CalendarClock,
};

const colorMap: Record<AdminNotification['severity'], { bg: string; icon: string; border: string }> = {
  error: { bg: 'bg-rose-50', icon: 'text-rose-500', border: 'border-rose-200' },
  warning: { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'border-amber-200' },
  info: { bg: 'bg-blue-50', icon: 'text-blue-500', border: 'border-blue-200' },
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'hier';
  return `il y a ${days}j`;
}

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  sidebarCollapsed?: boolean;
}

export default function NotificationPanel({ open, onClose, sidebarCollapsed }: NotificationPanelProps) {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotificationStore();
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the opening click
    const t = setTimeout(() => document.addEventListener('mousedown', handler), 50);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const handleClick = (notif: AdminNotification) => {
    markAsRead(notif.id);
    navigate(notif.link);
    onClose();
  };

  const count = unreadCount();

  return (
    <div
      ref={panelRef}
      className={`fixed bottom-4 w-[420px] max-h-[80vh] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[9990] flex flex-col animate-scaleIn origin-bottom-left ${sidebarCollapsed ? 'left-[80px]' : 'left-[264px]'}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900 text-base">Notifications</h3>
          {count > 0 && (
            <span className="px-2 py-0.5 text-xs font-bold bg-rose-500 text-white rounded-full">
              {count}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {count > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded-lg hover:bg-primary-50 transition-colors"
            >
              Tout marquer lu
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400">
            <BellOff size={32} className="mb-3 text-slate-300" />
            <p className="text-sm font-medium">Aucune notification</p>
            <p className="text-xs mt-1">Tout est en ordre !</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const Icon = iconMap[notif.type] || AlertTriangle;
            const colors = colorMap[notif.severity];
            return (
              <button
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={`w-full text-left px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-start gap-3 ${
                  !notif.isRead ? 'bg-slate-50/50' : ''
                }`}
              >
                {/* Icon */}
                <div
                  className={`flex-shrink-0 w-9 h-9 rounded-xl ${colors.bg} flex items-center justify-center mt-0.5`}
                >
                  <Icon size={18} className={colors.icon} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p
                      className={`text-sm font-semibold truncate ${
                        notif.isRead ? 'text-slate-600' : 'text-slate-900'
                      }`}
                    >
                      {notif.title}
                    </p>
                    {!notif.isRead && (
                      <span className="w-2 h-2 bg-primary-500 rounded-full flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{notif.message}</p>
                  <p className="text-[11px] text-slate-400 mt-1">{timeAgo(notif.timestamp)}</p>
                </div>

                {/* Arrow */}
                <ChevronRight size={14} className="text-slate-300 flex-shrink-0 mt-2" />
              </button>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-slate-100 px-5 py-2.5 text-center">
          <p className="text-xs text-slate-400">
            {notifications.length} notification{notifications.length > 1 ? 's' : ''}{' '}
            {count > 0 && `• ${count} non lue${count > 1 ? 's' : ''}`}
          </p>
        </div>
      )}
    </div>
  );
}
