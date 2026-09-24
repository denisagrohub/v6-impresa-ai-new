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

export async function GET() {
    try {
        await odoo.connect();
        const posts = await odoo.execute('blog.post', 'search_read', [
            [['is_published', '=', true]],
            ['id', 'name', 'subtitle', 'seo_name', 'post_date', 'visits'],
            0, 100, 'post_date desc',
        ]);
        return NextResponse.json({
            success: true,
            posts: (posts || []).map((p: any) => ({
                id: p.id,
                title: txt(p.name),
                subtitle: txt(p.subtitle),
                slug: txt(p.seo_name),
                date: p.post_date,
                visits: p.visits,
            })),
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
}
