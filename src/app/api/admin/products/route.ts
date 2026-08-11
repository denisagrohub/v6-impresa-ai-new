import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requirePermission } from '@/lib/auth';

const PRODUCTS_PATH = path.join(process.cwd(), 'src/data/custom-products.json');

// Assicura che il file esista
function ensureFile() {
  if (!fs.existsSync(PRODUCTS_PATH)) {
    const defaultData = { packages: [] };
    fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(defaultData, null, 2));
  }
}

export async function GET(request: NextRequest) {
  try {
    const permissionCheck = requirePermission(request, ['admin', 'chief']);
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck;
    }

    ensureFile();
    const data = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf-8'));
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore caricamento prodotti' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const permissionCheck = requirePermission(request, ['admin', 'chief']);
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck;
    }

    const body = await request.json();
    ensureFile();
    
    const data = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf-8'));
    
    const newPackage = {
      id: `CP-${Date.now()}`,
      ...body,
      createdAt: new Date().toISOString(),
    };
    
    data.packages.push(newPackage);
    fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(data, null, 2));
    
    return NextResponse.json({ success: true, package: newPackage });
  } catch (error) {
    return NextResponse.json(
      { error: 'Errore creazione pacchetto' },
      { status: 500 }
    );
  }
}
