'use client';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Video, AlertCircle, Clock } from 'lucide-react';

export function CalendarWithHeinrich() {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const MONTHS = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];
  const DAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  const getDaysInMonth = (m: number, y: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (m: number, y: number) => {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1;
  };

  const navigateMonth = (direction: number) => {
    let newMonth = currentMonth + direction;
    let newYear = currentYear;
    if (newMonth < 0) { newMonth = 11; newYear--; }
    else if (newMonth > 11) { newMonth = 0; newYear++; }
    setCurrentMonth(newMonth);
    setCurrentYear(newYear);
  };

  const events = [
    { id: 1, date: '2026-07-25', title: 'Call AI - Innovazione S.p.A.', type: 'call', risk: 'yellow' },
    { id: 2, date: '2026-07-28', title: 'Review Business Plan - GreenEnergy', type: 'review', risk: 'green' },
    { id: 3, date: '2026-07-30', title: 'Scadenza SAL 2 - Innovazione', type: 'deadline', risk: 'red' },
  ];

  const getEventsForDay = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'red': return 'bg-red-500';
      case 'yellow': return 'bg-yellow-500';
      case 'green': return 'bg-green-500';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigateMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-[#1a2744] min-w-[180px] text-center">
            {MONTHS[currentMonth]} {currentYear}
          </h2>
          <button onClick={() => navigateMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {DAYS.map(day => (
          <div key={day} className="text-center text-sm font-bold text-gray-500 py-2">{day}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: getFirstDayOfMonth(currentMonth, currentYear) }).map((_, i) => (
          <div key={`empty-${i}`} className="h-24 bg-gray-50 rounded-lg border border-gray-100"></div>
        ))}
        {Array.from({ length: getDaysInMonth(currentMonth, currentYear) }).map((_, i) => {
          const day = i + 1;
          const dayEvents = getEventsForDay(day);
          const isToday = day === new Date().getDate() && currentMonth === new Date().getMonth() && currentYear === new Date().getFullYear();

          return (
            <div
              key={day}
              className={`h-24 p-2 rounded-lg border-2 transition-all hover:border-blue-300 ${
                isToday ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-bold ${isToday ? 'text-orange-600' : 'text-gray-700'}`}>{day}</span>
                {dayEvents.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold">
                    {dayEvents.length}
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {dayEvents.slice(0, 2).map((event) => (
                  <div
                    key={event.id}
                    className={`text-[10px] px-1.5 py-0.5 rounded truncate text-white flex items-center gap-1 ${getRiskColor(event.risk)}`}
                    title={event.title}
                  >
                    {event.type === 'call' && <Video size={10} />}
                    {event.type === 'review' && <AlertCircle size={10} />}
                    {event.type === 'deadline' && <Clock size={10} />}
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-[9px] text-gray-500 font-medium">+{dayEvents.length - 2} altri</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-6 text-xs text-gray-500 border-t border-gray-100 pt-4">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span> Critico</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> Attenzione</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-green-500"></span> Safe</div>
      </div>
    </div>
  );
}
