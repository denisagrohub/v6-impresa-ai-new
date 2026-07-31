'use client';

import React, { useState } from 'react';
import { TrendingUp, DollarSign, PieChart, AlertCircle, ArrowUpRight, ArrowDownRight, Download, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const monthlyData = [
  { month: 'Gen', revenue: 18000, taxStandard: 4500, taxOptimized: 3800 },
  { month: 'Feb', revenue: 22000, taxStandard: 5500, taxOptimized: 4600 },
  { month: 'Mar', revenue: 19500, taxStandard: 4875, taxOptimized: 4100 },
  { month: 'Apr', revenue: 24000, taxStandard: 6000, taxOptimized: 5000 },
  { month: 'Mag', revenue: 21000, taxStandard: 5250, taxOptimized: 4400 },
  { month: 'Giu', revenue: 25000, taxStandard: 6250, taxOptimized: 5200 },
  { month: 'Lug', revenue: 16000, taxStandard: 4000, taxOptimized: 3300 },
  { month: 'Ago', revenue: 14000, taxStandard: 3500, taxOptimized: 2900 },
  { month: 'Set', revenue: 23000, taxStandard: 5750, taxOptimized: 4800 },
  { month: 'Ott', revenue: 26000, taxStandard: 6500, taxOptimized: 5400 },
  { month: 'Nov', revenue: 20000, taxStandard: 5000, taxOptimized: 4200 },
  { month: 'Dic', revenue: 28000, taxStandard: 7000, taxOptimized: 5800 },
];

const suggestions = [
  { id: 1, category: 'Attrezzatura CNC', maxDeductible: 15000, savings: 4200, priority: 'Alta' },
  { id: 2, category: 'Divise Aziendali DPI', maxDeductible: 2500, savings: 700, priority: 'Media' },
  { id: 3, category: 'Formazione Sicurezza', maxDeductible: 3000, savings: 840, priority: 'Alta' },
  { id: 4, category: 'Software Gestione', maxDeductible: 1200, savings: 336, priority: 'Bassa' },
];

const budgetData = {
  incomeStatement: [
    { label: 'Ricavi di Vendita', values: [18, 22, 19.5, 24, 21, 25, 16, 14, 23, 26, 20, 28] },
    { label: 'Costi Materie Prime', values: [-5.4, -6.6, -5.8, -7.2, -6.3, -7.5, -4.8, -4.2, -6.9, -7.8, -6, -8.4] },
    { label: 'Costi del Personale', values: [-6, -6, -6, -6, -6, -6, -6, -6, -6, -6, -6, -6] },
    { label: 'Utile Lordo', values: [6.6, 9.4, 7.7, 10.8, 8.7, 11.5, 5.2, 3.8, 10.1, 12.2, 8, 13.6] },
    { label: 'Tasse (Stimate)', values: [-1.85, -2.63, -2.16, -3.02, -2.44, -3.22, -1.46, -1.06, -2.83, -3.42, -2.24, -3.81] },
    { label: 'Utile Netto', values: [4.75, 6.77, 5.54, 7.78, 6.26, 8.28, 3.74, 2.74, 7.27, 8.78, 5.76, 9.79] },
  ],
  balanceSheet: [
    { label: 'Attività Correnti', values: [45, 48, 50, 55, 53, 58, 54, 52, 56, 60, 58, 65] },
    { label: 'Attività Immobilizzate', values: [120, 120, 120, 135, 135, 135, 135, 135, 135, 135, 135, 135] },
    { label: 'Passività Correnti', values: [-30, -32, -31, -35, -33, -36, -32, -30, -34, -38, -35, -40] },
    { label: 'Patrimonio Netto', values: [135, 136, 139, 155, 155, 157, 157, 157, 157, 157, 158, 160] },
  ]
};

export default function AccountingDashboard() {
  const [viewType, setViewType] = useState<'income' | 'balance'>('income');
  const [simInput, setSimInput] = useState<number>(0);

  const totalRevenue = monthlyData.reduce((acc, curr) => acc + curr.revenue, 0);
  const totalTaxStandard = monthlyData.reduce((acc, curr) => acc + curr.taxStandard, 0);
  const totalTaxOptimized = monthlyData.reduce((acc, curr) => acc + curr.taxOptimized, 0);
  const taxSavings = totalTaxStandard - totalTaxOptimized;
  const cashFlow = totalRevenue * 0.35;
  const simTaxRate = 0.28;
  const simExtraTax = simInput * simTaxRate;
  const simNetProfit = simInput - simExtraTax;

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a2744]">Contabilità Predittiva</h1>
          <p className="text-gray-500">Panoramica finanziaria e ottimizzazione fiscale in tempo reale</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700">
          <Download size={16} /> Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard title="Fatturato Anno" value={`€ ${totalRevenue.toLocaleString()}`} trend="+12.5%" icon={<DollarSign className="text-blue-600" />} color="border-l-4 border-blue-600" />
        <KPICard title="Tasse Previste" value={`€ ${totalTaxStandard.toLocaleString()}`} subValue={`Ottimizzato: € ${totalTaxOptimized.toLocaleString()}`} trend="-5.2%" trendDown={true} icon={<PieChart className="text-red-600" />} color="border-l-4 border-red-600" />
        <KPICard title="Cash Flow Previsto" value={`€ ${cashFlow.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} trend="+8.1%" icon={<TrendingUp className="text-green-600" />} color="border-l-4 border-green-600" />
        <KPICard title="Risparmio Fiscale" value={`€ ${taxSavings.toLocaleString()}`} subValue="Potenziale attivabile" trend="Alto" icon={<AlertCircle className="text-orange-500" />} color="border-l-4 border-orange-500" />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-[#1a2744] mb-4">Andamento Fatturato vs Oneri Fiscali</h2>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280' }} tickFormatter={(value) => `€${value/1000}k`} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => [`€ ${Number(value).toLocaleString()}`, '']} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="Fatturato" stroke="#2563eb" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="taxStandard" name="Tasse Standard" stroke="#dc2626" strokeWidth={2} strokeDasharray="5 5" dot={false} />
              <Line type="monotone" dataKey="taxOptimized" name="Tasse Ottimizzate" stroke="#16a34a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-[#1a2744]">Suggerimenti Fiscali</h2>
            <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs font-bold rounded-full">3 Attivi</span>
          </div>
          <div className="space-y-4">
            {suggestions.map((item) => (
              <div key={item.id} className="p-4 border border-gray-100 rounded-lg hover:border-orange-200 hover:bg-orange-50 transition-colors">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-medium text-gray-900">{item.category}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${item.priority === 'Alta' ? 'bg-red-100 text-red-700' : item.priority === 'Media' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{item.priority}</span>
                </div>
                <div className="text-sm text-gray-600 mb-3">
                  <p>Deducibile: <span className="font-semibold">€ {item.maxDeductible}</span></p>
                  <p>Risparmio: <span className="font-semibold text-green-600">€ {item.savings}</span></p>
                </div>
                <button className="w-full py-2 bg-[#f97316] hover:bg-orange-600 text-white text-sm font-medium rounded-md transition-colors">Acquista ora</button>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-[#1a2744]">Bilancio Previsionale</h2>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button onClick={() => setViewType('income')} className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewType === 'income' ? 'bg-white text-[#1a2744] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Conto Economico</button>
                <button onClick={() => setViewType('balance')} className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewType === 'balance' ? 'bg-white text-[#1a2744] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Stato Patrimoniale</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 rounded-l-lg">Voce</th>
                    {['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D'].map((m, i) => (<th key={i} className="px-2 py-3 text-center">{m}</th>))}
                    <th className="px-4 py-3 rounded-r-lg text-right font-bold text-[#1a2744]">Totale</th>
                  </tr>
                </thead>
                <tbody>
                  {(viewType === 'income' ? budgetData.incomeStatement : budgetData.balanceSheet).map((row, idx) => (
                    <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{row.label}</td>
                      {row.values.map((val, vIdx) => (<td key={vIdx} className={`px-2 py-3 text-center ${val < 0 ? 'text-red-600' : 'text-green-600'}`}>{val > 0 ? '+' : ''}{val}</td>))}
                      <td className="px-4 py-3 text-right font-bold text-gray-900">{row.values.reduce((a, b) => a + b, 0).toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gradient-to-r from-[#1a2744] to-[#2c3e5f] p-6 rounded-xl shadow-lg text-white">
            <div className="flex items-center gap-2 mb-4"><RefreshCw size={20} className="text-[#f97316]" /><h2 className="text-lg font-semibold">Simulatore What-If</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Se fatturo €X in più...</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                  <input type="number" value={simInput || ''} onChange={(e) => setSimInput(Number(e.target.value))} placeholder="0" className="w-full pl-8 pr-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#f97316]" />
                </div>
                <p className="mt-2 text-xs text-gray-400">Inserisci un importo aggiuntivo previsto</p>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/10"><span className="text-gray-300 text-sm">Tasse Aggiuntive</span><span className="text-red-400 font-bold">- € {simExtraTax.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
                <div className="flex justify-between items-center p-3 bg-[#f97316]/20 rounded-lg border border-[#f97316]/30"><span className="text-[#f97316] font-medium text-sm">Utile Netto Aggiuntivo</span><span className="text-white font-bold text-lg">+ € {simNetProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ title, value, subValue, trend, trendDown, icon, color }: any) {
  return (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 ${color}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
        {trend && (<span className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${trendDown ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{trendDown ? <ArrowDownRight size={14} className="mr-1" /> : <ArrowUpRight size={14} className="mr-1" />}{trend}</span>)}
      </div>
      <h3 className="text-gray-500 text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-bold text-[#1a2744]">{value}</p>
      {subValue && <p className="text-xs text-gray-400 mt-1">{subValue}</p>}
    </div>
  );
}
