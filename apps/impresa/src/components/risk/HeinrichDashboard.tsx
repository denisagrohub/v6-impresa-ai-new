'use client';
import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

interface HeinrichStats {
  total: number;
  green: number;
  yellow: number;
  red: number;
  byCategory: Record<string, number>;
  trend: Array<{ date: string; red: number; yellow: number; green: number }>;
  escalationRate: number;
}

export function HeinrichDashboard({ projectId }: { projectId?: string }) {
  const [stats, setStats] = useState<HeinrichStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/risk/heinrich?action=stats${projectId ? `&projectId=${projectId}` : ''}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setStats(data.stats);
        } else {
          setError('Errore caricamento dati');
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600">
        Errore: {error || 'Dati non disponibili'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistiche */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Totali</div>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.green}</div>
          <div className="text-sm text-green-700">🟢 Verde</div>
        </div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-4 text-center">
          <div className="text-3xl font-bold text-yellow-600">{stats.yellow}</div>
          <div className="text-sm text-yellow-700">🟡 Giallo</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <div className="text-3xl font-bold text-red-600">{stats.red}</div>
          <div className="text-sm text-red-700">🔴 Rosso</div>
        </div>
      </div>

      {/* Tasso di escalation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrendingUp size={20} className="text-blue-600" />
          <span className="text-sm font-medium text-blue-900">Tasso di escalation</span>
        </div>
        <span className={`text-lg font-bold ${stats.escalationRate > 0.3 ? 'text-red-600' : 'text-green-600'}`}>
          {(stats.escalationRate * 100).toFixed(1)}%
        </span>
      </div>

      {/* Categorie */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="font-bold text-sm text-gray-700 mb-3">Per categoria</h4>
        <div className="space-y-2">
          {Object.entries(stats.byCategory).map(([category, count]) => (
            <div key={category} className="flex items-center gap-3">
              <span className="text-sm capitalize w-24">{category}</span>
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all"
                  style={{ width: `${(count / stats.total) * 100}%` }}
                />
              </div>
              <span className="text-sm font-bold w-8">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Trend ultimi 30 giorni */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="font-bold text-sm text-gray-700 mb-3">Trend ultimi 30 giorni</h4>
        <div className="h-16 flex items-end gap-1">
          {stats.trend.slice(-30).map((day, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="flex gap-0.5 w-full justify-center">
                {day.red > 0 && (
                  <div className="w-1.5 bg-red-500 rounded-t" style={{ height: `${day.red * 4}px` }} />
                )}
                {day.yellow > 0 && (
                  <div className="w-1.5 bg-yellow-500 rounded-t" style={{ height: `${day.yellow * 4}px` }} />
                )}
                {day.green > 0 && (
                  <div className="w-1.5 bg-green-500 rounded-t" style={{ height: `${day.green * 4}px` }} />
                )}
              </div>
              <span className="text-[8px] text-gray-400">{new Date(day.date).getDate()}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
