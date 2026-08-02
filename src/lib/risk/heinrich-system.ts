// src/lib/risk/heinrich-system.ts
export interface HeinrichEvent {
  id: string;
  projectId: string;
  description: string;
  level: 'green' | 'yellow' | 'red';
  category: string;
  date: string;
  status: 'open' | 'resolved' | 'dismissed';
  notes?: string;
}

export interface HeinrichStats {
  total: number;
  green: number;
  yellow: number;
  red: number;
  byCategory: Record<string, number>;
  trend: Array<{ date: string; red: number; yellow: number; green: number }>;
  escalationRate: number;
}

class HeinrichSystem {
  private events: HeinrichEvent[] = [];

  createEvent(data: Omit<HeinrichEvent, 'id'>): HeinrichEvent {
    const event = {
      ...data,
      id: `HEIN-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    };
    this.events.push(event);
    return event;
  }

  updateEvent(id: string, data: Partial<HeinrichEvent>): HeinrichEvent | null {
    const index = this.events.findIndex(e => e.id === id);
    if (index === -1) return null;
    this.events[index] = { ...this.events[index], ...data };
    return this.events[index];
  }

  getStats(projectId?: string): HeinrichStats {
    const filtered = projectId 
      ? this.events.filter(e => e.projectId === projectId)
      : this.events;

    const total = filtered.length;
    const green = filtered.filter(e => e.level === 'green').length;
    const yellow = filtered.filter(e => e.level === 'yellow').length;
    const red = filtered.filter(e => e.level === 'red').length;

    const byCategory: Record<string, number> = {};
    filtered.forEach(e => {
      byCategory[e.category] = (byCategory[e.category] || 0) + 1;
    });

    // Trend fittizio per ultimi 30 giorni
    const trend = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toISOString().split('T')[0],
        red: Math.floor(Math.random() * 2),
        yellow: Math.floor(Math.random() * 3),
        green: Math.floor(Math.random() * 4),
      };
    });

    return {
      total,
      green,
      yellow,
      red,
      byCategory,
      trend,
      escalationRate: total > 0 ? red / total : 0,
    };
  }

  generateReport(projectId?: string): string {
    const stats = this.getStats(projectId);
    return `
      Heinrich Report
      ===============
      Total Events: ${stats.total}
      🟢 Green: ${stats.green}
      🟡 Yellow: ${stats.yellow}
      🔴 Red: ${stats.red}
      Escalation Rate: ${(stats.escalationRate * 100).toFixed(1)}%
    `;
  }
}

export const heinrichSystem = new HeinrichSystem();
