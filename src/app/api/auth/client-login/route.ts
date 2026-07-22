import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const USERS_PATH = path.join(process.cwd(), 'src/data/clients.json');

function ensureUsersFile() {
    if (!fs.existsSync(USERS_PATH)) {
        // Crea un utente di test per demo
        const defaultUsers = {
            users: [
                {
                    id: 'client_001',
                    email: 'demo@progettoimpresa.it',
                    password: 'demo123', // In produzione: hash bcrypt
                    name: 'Mario Rossi',
                    company: 'Azienda Demo S.r.l.',
                    createdAt: new Date().toISOString(),
                }
            ]
        };
        fs.writeFileSync(USERS_PATH, JSON.stringify(defaultUsers, null, 2));
    }
}

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { success: false, error: 'Email e password sono obbligatori' },
                { status: 400 }
            );
        }

        ensureUsersFile();
        const data = JSON.parse(fs.readFileSync(USERS_PATH, 'utf-8'));

        const user = data.users.find((u: any) =>
            u.email.toLowerCase() === email.toLowerCase() &&
            u.password === password
        );

        if (!user) {
            return NextResponse.json(
                { success: false, error: 'Credenziali non valide' },
                { status: 401 }
            );
        }

        // Genera un token semplice (in produzione: JWT firmato)
        const token = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return NextResponse.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                company: user.company,
            }
        });
    } catch (error) {
        console.error('Errore login:', error);
        return NextResponse.json(
            { success: false, error: 'Errore del server' },
            { status: 500 }
        );
    }
}
