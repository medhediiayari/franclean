import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { PlanningEvent, User } from '../types';

type PeriodType = 'day' | 'week' | 'month';

export interface PDFExportFilters {
  agentId?: string;
  client?: string;
  site?: string;
}

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
  filters?: PDFExportFilters,
  appName = 'Bipbip',
) {
  const { start, end, label } = getPeriodRange(refDate, period);
  let filtered = getEventsInRange(events, start, end);

  // Apply filters
  if (filters?.agentId) {
    filtered = filtered.filter(e => e.assignedAgentIds.includes(filters.agentId!));
  }
  if (filters?.client) {
    filtered = filtered.filter(e => e.client === filters.client);
  }
  if (filters?.site) {
    filtered = filtered.filter(e => e.site === filters.site);
  }

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ── Header ──
  doc.setFillColor(79, 70, 229); // primary indigo
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(`${appName} - Planning`, 14, 13);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  // Build filter label
  let filterLabel = '';
  if (filters?.agentId) {
    const agent = users.find(u => u.id === filters.agentId);
    if (agent) filterLabel += ` - Agent: ${agent.firstName} ${agent.lastName}`;
  }
  if (filters?.client) {
    filterLabel += ` - Client: ${filters.client}`;
  }
  if (filters?.site) {
    filterLabel += ` - Site: ${filters.site}`;
  }
  
  doc.text((label.charAt(0).toUpperCase() + label.slice(1)) + filterLabel, 14, 22);

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

// ─── Pointages PDF Export ───────────────────────────────
export interface PointageRow {
  day: number;
  agentName: string;
  client: string;
  site: string;
  checkIn: string;
  checkOut: string;
  totalStr: string;
  validatedStr: string;
  hoursWorked: number;
  validatedHours: number;
  status: string;
}

export interface PointageExportOptions {
  rows: PointageRow[];
  periodLabel: string;
  startDate: string;
  endDate: string;
  siteFilter?: string;
  agentFilter?: string;
  totalHours: number;
  totalValidated: number;
  appName?: string;
}

export function generatePointagesPDF(opts: PointageExportOptions) {
  const {
    rows, periodLabel, startDate, endDate,
    siteFilter, agentFilter,
    totalHours, totalValidated,
    appName = 'Bipbip',
  } = opts;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // ── Header ──
  doc.setFillColor(27, 58, 92); // primary navy
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${appName} - Recapitulatif Pointages`, 14, 13);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const filters: string[] = [stripAccents(periodLabel)];
  if (siteFilter) filters.push(`Site: ${stripAccents(siteFilter)}`);
  if (agentFilter) filters.push(`Agent: ${stripAccents(agentFilter)}`);
  doc.text(filters.join('  |  '), 14, 22);

  doc.setFontSize(8);
  doc.text(
    `${format(new Date(), 'dd/MM/yyyy')} a ${format(new Date(), 'HH:mm')}`,
    pageWidth - 14, 22, { align: 'right' },
  );
  doc.setTextColor(0, 0, 0);

  // ── Summary ──
  const y = 36;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');

  const fmtH = (h: number) => {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return `${hh}h${String(mm).padStart(2, '0')}`;
  };

  const summaryText = `${rows.length} pointage${rows.length > 1 ? 's' : ''}  |  Heures totales: ${fmtH(totalHours)}  |  Heures validees: ${fmtH(totalValidated)}`;
  doc.text(summaryText, 14, y);
  doc.setFont('helvetica', 'normal');

  // ── Group rows by agent ──
  const agentGroups = new Map<string, PointageRow[]>();
  for (const row of rows) {
    if (!agentGroups.has(row.agentName)) agentGroups.set(row.agentName, []);
    agentGroups.get(row.agentName)!.push(row);
  }

  const STATUS_MAP: Record<string, string> = {
    'valide': 'Valide',
    'en_attente': 'En attente',
    'suspect': 'Suspect',
    'refuse': 'Refuse',
  };

  const tableBody: (string | number)[][] = [];
  const groupHeaderRows: number[] = []; // row indices that are group headers

  for (const [agentName, agentRows] of agentGroups) {
    // Group header row
    const agentTotal = agentRows.reduce((s, r) => s + r.hoursWorked, 0);
    const agentValidated = agentRows.reduce((s, r) => s + r.validatedHours, 0);
    groupHeaderRows.push(tableBody.length);
    tableBody.push([
      stripAccents(agentName),
      '',
      '',
      '',
      '',
      fmtH(agentTotal),
      fmtH(agentValidated),
      `${agentRows.length} pts`,
    ]);

    // Detail rows
    for (const row of agentRows) {
      tableBody.push([
        String(row.day),
        stripAccents(row.client),
        stripAccents(row.site),
        row.checkIn || '-',
        row.checkOut || '-',
        row.totalStr || '0:00',
        row.validatedStr || '-',
        STATUS_MAP[row.status] || row.status,
      ]);
    }
  }

  autoTable(doc, {
    startY: y + 6,
    head: [['Jour / Agent', 'Client', 'Site', 'Entree', 'Sortie', 'Total', 'Valide', 'Statut']],
    body: tableBody,
    styles: {
      fontSize: 7.5,
      cellPadding: 2.5,
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [27, 58, 92],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 45 },
      2: { cellWidth: 50 },
      3: { cellWidth: 22, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
      6: { cellWidth: 22, halign: 'center' },
      7: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      // Style group header rows
      if (data.section === 'body' && groupHeaderRows.includes(data.row.index)) {
        data.cell.styles.fillColor = [241, 245, 249]; // slate-100
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 8.5;
        data.cell.styles.textColor = [27, 58, 92];
      }
    },
    didDrawPage: () => {
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Page ${doc.getCurrentPageInfo().pageNumber} / ${pageCount}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' },
      );
    },
  });

  // ── Save ──
  const safeFilter = siteFilter ? `-${stripAccents(siteFilter).replace(/\s+/g, '_')}` : '';
  const safeAgent = agentFilter ? `-${stripAccents(agentFilter).replace(/\s+/g, '_')}` : '';
  doc.save(`pointages-${startDate}-${endDate}${safeFilter}${safeAgent}.pdf`);
}
