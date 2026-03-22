import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PlanningEvent, User } from '../types';

type PeriodType = 'day' | 'week' | 'month';

const STATUS_LABELS: Record<string, string> = {
  planifie: 'Planifie',
  en_cours: 'En cours',
  termine: 'Termine',
  a_reattribuer: 'A reattribuer',
  annule: 'Annule',
};

function stripAccents(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getPeriodRange(date: Date, period: PeriodType): { start: Date; end: Date; label: string } {
  switch (period) {
    case 'day':
      return {
        start: date,
        end: date,
        label: stripAccents(format(date, 'EEEE dd MMMM yyyy', { locale: fr })),
      };
    case 'week': {
      const start = startOfWeek(date, { weekStartsOn: 1 });
      const end = endOfWeek(date, { weekStartsOn: 1 });
      return {
        start,
        end,
        label: `Semaine du ${stripAccents(format(start, 'dd MMM', { locale: fr }))} au ${stripAccents(format(end, 'dd MMM yyyy', { locale: fr }))}`,
      };
    }
    case 'month': {
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      return {
        start,
        end,
        label: stripAccents(format(date, 'MMMM yyyy', { locale: fr })),
      };
    }
  }
}

function getEventsInRange(events: PlanningEvent[], start: Date, end: Date): PlanningEvent[] {
  const startStr = localDateStr(start);
  const endStr = localDateStr(end);
  return events.filter(e => e.endDate >= startStr && e.startDate <= endStr);
}

export function generatePlanningPDF(
  events: PlanningEvent[],
  users: User[],
  refDate: Date,
  period: PeriodType,
) {
  const { start, end, label } = getPeriodRange(refDate, period);
  const filtered = getEventsInRange(events, start, end);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFillColor(79, 70, 229); // primary indigo
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FranClean RH - Planning', 14, 13);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(label.charAt(0).toUpperCase() + label.slice(1), 14, 22);

  // Generation date
  doc.setFontSize(9);
  doc.text(`Genere le ${format(new Date(), 'dd/MM/yyyy', { locale: fr })} a ${format(new Date(), 'HH:mm')}`, pageWidth - 14, 22, { align: 'right' });

  doc.setTextColor(0, 0, 0);

  const RESPONSE_LABELS: Record<string, string> = {
    pending: 'en cours',
    accepted: 'confirme',
    refused: 'refuse',
  };

  const getAgentName = (id: string) => {
    const u = users.find(u => u.id === id);
    return u ? `${u.firstName} ${u.lastName}` : '-';
  };

  const getAgentLabel = (id: string, evt: PlanningEvent) => {
    const name = getAgentName(id);
    const response = evt.agentResponses?.[id] || 'pending';
    return `${name} (${RESPONSE_LABELS[response] || response})`;
  };

  // ── Summary stats ──
  const y = 36;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`Resume`, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const totalShifts = filtered.reduce((sum, e) => sum + (e.shifts || []).length, 0);
  const uniqueAgents = new Set(filtered.flatMap(e => e.assignedAgentIds)).size;
  const stats = [
    `${filtered.length} evenement${filtered.length > 1 ? 's' : ''}`,
    `${totalShifts} creneau${totalShifts > 1 ? 'x' : ''}`,
    `${uniqueAgents} agent${uniqueAgents > 1 ? 's' : ''} mobilise${uniqueAgents > 1 ? 's' : ''}`,
  ];
  doc.text(stats.join('  -  '), 14, y + 6);

  // ── Events table ──
  const tableRows: (string | number)[][] = [];

  for (const evt of filtered) {
    const agentsStr = evt.assignedAgentIds.length > 0
      ? evt.assignedAgentIds.map(id => getAgentLabel(id, evt)).join(', ')
      : 'Non assigne';

    // Get shifts in the period range
    const startStr = localDateStr(start);
    const endStr = localDateStr(end);
    const shiftsInRange = (evt.shifts || []).filter(s => s.date >= startStr && s.date <= endStr);

    if (shiftsInRange.length > 0) {
      // One row per shift
      for (const shift of shiftsInRange) {
        const shiftAgent = shift.agentId ? getAgentLabel(shift.agentId, evt) : agentsStr;
        tableRows.push([
          evt.title,
          evt.client || '-',
          STATUS_LABELS[evt.status] || evt.status,
          stripAccents(format(parseISO(shift.date), 'EEE dd/MM', { locale: fr })),
          `${shift.startTime} - ${shift.endTime}`,
          shiftAgent,
          evt.address ? evt.address.split(',')[0] : '-',
        ]);
      }
    } else {
      // No shifts - one row for the event itself
      tableRows.push([
        evt.title,
        evt.client || '-',
        STATUS_LABELS[evt.status] || evt.status,
        `${stripAccents(format(parseISO(evt.startDate), 'dd/MM', { locale: fr }))} - ${stripAccents(format(parseISO(evt.endDate), 'dd/MM', { locale: fr }))}`,
        '-',
        agentsStr,
        evt.address ? evt.address.split(',')[0] : '-',
      ]);
    }
  }

  autoTable(doc, {
    startY: y + 12,
    head: [['Evenement', 'Client', 'Statut', 'Date', 'Horaires', 'Agent(s)', 'Lieu']],
    body: tableRows,
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: [226, 232, 240],
      lineWidth: 0.3,
    },
    headStyles: {
      fillColor: [79, 70, 229],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 45, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 25 },
      3: { cellWidth: 30 },
      4: { cellWidth: 30 },
      5: { cellWidth: 50 },
      6: { cellWidth: 50 },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (data) => {
      // Footer on each page
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${data.pageNumber} / ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' },
      );
    },
  });

  // ── Daily breakdown for week/month ──
  if (period !== 'day' && filtered.length > 0) {
    const days = eachDayOfInterval({ start, end });
    const dailyData: { dateLabel: string; count: number; agents: string[] }[] = [];

    for (const day of days) {
      const dayStr = localDateStr(day);
      const dayEvents = filtered.filter(e => {
        const hasShift = (e.shifts || []).some(s => s.date === dayStr);
        if (hasShift) return true;
        return e.startDate <= dayStr && e.endDate >= dayStr;
      });

      if (dayEvents.length > 0) {
        const dayAgents = new Set<string>();
        for (const e of dayEvents) {
          const dayShifts = (e.shifts || []).filter(s => s.date === dayStr);
          if (dayShifts.length > 0) {
            dayShifts.forEach(s => { if (s.agentId) dayAgents.add(getAgentLabel(s.agentId, e)); });
          } else {
            e.assignedAgentIds.forEach(id => dayAgents.add(getAgentLabel(id, e)));
          }
        }
        dailyData.push({
          dateLabel: stripAccents(format(day, 'EEEE dd/MM', { locale: fr })),
          count: dayEvents.length,
          agents: Array.from(dayAgents),
        });
      }
    }

    if (dailyData.length > 0) {
      doc.addPage();

      // Header on new page
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pageWidth, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Recapitulatif journalier', 14, 15);
      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: 30,
        head: [['Jour', 'Nb evenements', 'Agents mobilises']],
        body: dailyData.map(d => [d.dateLabel, d.count, d.agents.join(', ') || '-']),
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: [226, 232, 240],
          lineWidth: 0.3,
        },
        headStyles: {
          fillColor: [79, 70, 229],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          const pageCount = doc.getNumberOfPages();
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(
            `Page ${data.pageNumber} / ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 8,
            { align: 'center' },
          );
        },
      });
    }
  }

  // ── Save ──
  const periodLabel = period === 'day' ? 'jour' : period === 'week' ? 'semaine' : 'mois';
  const dateLabel = format(refDate, 'yyyy-MM-dd');
  doc.save(`planning-${periodLabel}-${dateLabel}.pdf`);
}
