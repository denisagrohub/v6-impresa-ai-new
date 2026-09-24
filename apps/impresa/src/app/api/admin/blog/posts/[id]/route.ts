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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
    try {
        await odoo.connect();
        const [p] = await odoo.execute('blog.post', 'read', [
            [id],
            ['id', 'name', 'subtitle', 'content', 'seo_name', 'is_published',
             'published_date', 'post_date', 'visits', 'blog_id', 'author_id'],
        ]);
        if (!p) return NextResponse.json({ success: false, error: 'Articolo non trovato' }, { status: 404 });
        return NextResponse.json({
            success: true,
            post: {
                id: p.id,
                title: txt(p.name),
                subtitle: txt(p.subtitle),
                content: txt(p.content),
                slug: txt(p.seo_name),
                isPublished: p.is_published,
                publishedDate: p.published_date,
                postDate: p.post_date,
                visits: p.visits,
            },
        });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
    let body: any;
    try { body = await request.json(); } catch { return NextResponse.json({ success: false, error: 'JSON non valido' }, { status: 400 }); }
    const vals: any = {};
    if (body.title !== undefined) vals.name = body.title;
    if (body.subtitle !== undefined) vals.subtitle = body.subtitle;
    if (body.content !== undefined) vals.content = body.content;
    if (body.slug !== undefined) vals.seo_name = body.slug;
    if (body.publishedDate !== undefined) vals.published_date = body.publishedDate;
    if (body.isPublished !== undefined) {
        vals.is_published = body.isPublished;
        if (body.isPublished && !body.publishedDate) {
            vals.post_date = new Date().toISOString().replace('T', ' ').slice(0, 19);
        }
    }

    if (Object.keys(vals).length === 0) return NextResponse.json({ success: false, error: 'Nessun campo' }, { status: 400 });
    try {
        await odoo.connect();
        await odoo.execute('blog.post', 'write', [[id], vals]);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
    const id = parseInt(params.id, 10);
    if (!id) return NextResponse.json({ success: false, error: 'ID non valido' }, { status: 400 });
    try {
        await odoo.connect();
        await odoo.execute('blog.post', 'unlink', [[id]]);
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 502 });
    }
}
