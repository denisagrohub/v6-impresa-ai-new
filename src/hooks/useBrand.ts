'use client';

import { useState, useEffect } from 'react';
type BrandData = {
    [key: string]: any;
};

export function useBrand(slug?: string) {
    const [brand, setBrand] = useState<BrandData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function fetchBrand() {
            setLoading(true);
            setError(null);

            try {
                const brandSlug = slug || 'progetto-impresa';
                const response = await fetch(`/api/brands/${brandSlug}`);

                if (!response.ok) {
                    throw new Error('Brand non trovato');
                }

                const data = await response.json();

                if (!cancelled) {
                    setBrand(data);
                    setLoading(false);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Errore sconosciuto');
                    setLoading(false);
                }
            }
        }

        fetchBrand();

        return () => {
            cancelled = true;
        };
    }, [slug]);

    return { brand, loading, error };
}

// Hook per applicare i colori del brand dinamicamente
export function useBrandTheme(brand: BrandData | null) {
    useEffect(() => {
        if (!brand) return;

        const root = document.documentElement;
        root.style.setProperty('--brand-primary', brand.colors.primary);
        root.style.setProperty('--brand-secondary', brand.colors.secondary);
        root.style.setProperty('--brand-accent', brand.colors.accent);
        root.style.setProperty('--brand-background', brand.colors.background);
    }, [brand]);
}
