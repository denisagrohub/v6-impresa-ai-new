import { NextResponse } from 'next/server';
import { odoo } from '@/lib/odoo/api-adapter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function txt(v: any): string {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object') return v.it_IT || v.en_US || Object.values(v)[0] as string || '';
    return String(v);
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
    try {
        await odoo.connect();
        // seo_name è jsonb: cerco per valore it_IT via ilike su cast
        const posts = await odoo.execute('blog.post', 'search_read', [
            [['seo_name', 'ilike', params.slug], ['is_published', '=', true]],
            ['id', 'name', 'subtitle', 'content', 'seo_name', 'post_date'],
            0, 1,
        ]);
        if (!posts || !posts.length) return NextResponse.json({ success: false, error: 'Articolo non trovato' }, { status: 404 });
        const p = posts[0];
        return NextResponse.json({
            success: true,
            post: {
                id: p.id,
                title: txt(p.name),
                subtitle: txt(p.subtitle),
                content: txt(p.content),
                slug: txt(p.seo_name),
                date: p.post_date,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
}
