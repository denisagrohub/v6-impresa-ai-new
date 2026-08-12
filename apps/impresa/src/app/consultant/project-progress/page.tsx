'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import ProjectProgressContent from './ProjectProgressContent';

function ProjectProgressWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      router.push('/consultant/dashboard');
      return;
    }

    fetch(`/api/consultant/project-progress?id=${projectId}`)
      .then(res => res.json())
      .then(data => {
        setProject(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [projectId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <Loader2 size={40} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="bg-red-50 border border-red-200 rounded-xl p-8 max-w-md text-center">
          <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-red-800">Errore</h2>
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc]">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 max-w-md text-center">
          <h2 className="text-xl font-bold text-yellow-800">Progetto non trovato</h2>
          <p className="text-yellow-600 mt-2">ID: {projectId}</p>
          <Link href="/consultant/dashboard" className="mt-4 inline-block text-blue-600 hover:underline">
            Torna alla dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ProjectProgressContent usa useSearchParams internamente, 
  // quindi lo renderizziamo senza props
  return <ProjectProgressContent />;
}

export default function ProjectProgressPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#f8fafc]"><Loader2 size={40} className="animate-spin text-orange-500" /></div>}>
      <ProjectProgressWrapper />
    </Suspense>
  );
}
