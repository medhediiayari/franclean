import { format, parseISO, differenceInHours, differenceInMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatDate(dateStr: string, fmt: string = 'dd MMM yyyy'): string {
  return format(parseISO(dateStr), fmt, { locale: fr });
}

export function formatTime(dateStr: string): string {
  return format(parseISO(dateStr), 'HH:mm', { locale: fr });
}

export function formatDateTime(dateStr: string): string {
  return format(parseISO(dateStr), 'dd MMM yyyy à HH:mm', { locale: fr });
}

export function calculateHours(start: string, end: string): number {
  const startDate = parseISO(start);
  const endDate = parseISO(end);
  const mins = differenceInMinutes(endDate, startDate);
  return Number((mins / 60).toFixed(2));
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
