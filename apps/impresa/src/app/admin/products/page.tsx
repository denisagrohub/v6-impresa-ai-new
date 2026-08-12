"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, Plus, Package, Edit, Trash2, 
  CheckCircle2, XCircle, Loader2, Euro
} from "lucide-react";

interface CustomPackage {
  id: string;
  name: string;
  clientName: string;
  modules: Array<{ id: string; name: string; price: number }>;
  totalPrice: number;
  discount: number;
  finalPrice: number;
  status: 'draft' | 'configured' | 'sent' | 'approved' | 'sold' | 'cancelled';
  createdAt: string;
  consultantId: string;
}

export default function AdminProductsPage() {
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<CustomPackage[]>([]);
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    loadPackages();
  }, []);

  const loadPackages = async () => {
    try {
      const res = await fetch('/api/admin/products');
      const data = await res.json();
      setPackages(data.packages || []);
    } catch (error) {
      console.error('Errore caricamento pacchetti:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-700';
      case 'configured': return 'bg-blue-100 text-blue-700';
      case 'sent': return 'bg-yellow-100 text-yellow-700';
      case 'approved': return 'bg-green-100 text-green-700';
      case 'sold': return 'bg-purple-100 text-purple-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 size={40} className="animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-2">
              <ArrowLeft size={16} /> Torna alla dashboard
            </Link>
            <h1 className="text-3xl font-bold text-[#1a2744] flex items-center gap-3">
              <Package size={32} className="text-orange-500" />
              Prodotti Custom
            </h1>
            <p className="text-gray-500">Gestione pacchetti personalizzati e wizard</p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#1a2744] text-white font-bold hover:bg-[#0f3460] transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus size={18} />
            Nuovo Pacchetto Custom
          </button>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="text-2xl font-bold text-[#1a2744]">{packages.length}</div>
            <div className="text-sm text-gray-500">Totale Pacchetti</div>
          </div>
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
            <div className="text-2xl font-bold text-blue-600">
              {packages.filter(p => p.status === 'configured').length}
            </div>
            <div className="text-sm text-blue-700">Configurati</div>
          </div>
          <div className="bg-green-50 rounded-2xl border border-green-200 p-5">
            <div className="text-2xl font-bold text-green-600">
              {packages.filter(p => p.status === 'sold').length}
            </div>
            <div className="text-sm text-green-700">Venduti</div>
          </div>
          <div className="bg-purple-50 rounded-2xl border border-purple-200 p-5">
            <div className="text-2xl font-bold text-purple-600">
              €{packages.reduce((sum, p) => sum + p.finalPrice, 0).toLocaleString()}
            </div>
            <div className="text-sm text-purple-700">Totale Vendite</div>
          </div>
        </div>

        {/* Lista Pacchetti */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Pacchetto</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Cliente</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Moduli</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Prezzo</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Stato</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {packages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    Nessun pacchetto custom creato
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-[#1a2744]">{pkg.name}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{pkg.clientName}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{pkg.modules.length}</td>
                    <td className="px-6 py-4 font-bold text-orange-600">€{pkg.finalPrice.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pkg.status)}`}>
                        {pkg.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg hover:bg-blue-50 text-blue-600">
                          <Edit size={16} />
                        </button>
                        <button className="p-2 rounded-lg hover:bg-red-50 text-red-600">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
