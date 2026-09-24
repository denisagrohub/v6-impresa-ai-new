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
            [],
            ['id', 'name', 'subtitle', 'seo_name', 'is_published', 'published_date', 'post_date',
             'visits', 'blog_id', 'author_id'],
            0, 200, 'post_date desc',
        ]);
        return NextResponse.json({
            success: true,
            posts: (posts || []).map((p: any) => ({
                id: p.id,
                title: txt(p.name),
                subtitle: txt(p.subtitle),
                slug: txt(p.seo_name),
                isPublished: p.is_published,
                publishedDate: p.published_date,
                postDate: p.post_date,
                visits: p.visits,
                blogId: Array.isArray(p.blog_id) ? p.blog_id[0] : null,
                blogName: Array.isArray(p.blog_id) ? p.blog_id[1] : null,
                authorName: Array.isArray(p.author_id) ? p.author_id[1] : null,
            })),
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
}

export async function POST(request: Request) {
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 }); }
    const { title, subtitle, content, slug, publishedDate, isPublished } = body || {};
    if (!title) return NextResponse.json({ success: false, error: 'Titolo obbligatorio' }, { status: 400 });

    try {
        await odoo.connect();
        const vals: any = {
            'name': title,
            'subtitle': subtitle || false,
            'content': content || '',
            'blog_id': 1,
        };
        if (slug) vals.seo_name = slug;
        if (publishedDate) vals.published_date = publishedDate;
        if (isPublished) {
            vals.is_published = true;
            vals.post_date = publishedDate || new Date().toISOString().replace('T', ' ').slice(0, 19);
        }

        const id = await odoo.execute('blog.post', 'create', [vals]);
        return NextResponse.json({ success: true, id: Array.isArray(id) ? id[0] : id });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
}
