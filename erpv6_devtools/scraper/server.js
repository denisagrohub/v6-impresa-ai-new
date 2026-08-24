'use strict';

/**
 * Microservizio scraper per erpv6_deep_source._call_scraper_service.
 * Contratto (verificato in odoo-modules/erpv6_deep_source/models/deep_source_engine.py,
 * metodo _call_scraper_service, 23-24/08/2026):
 *   POST /render  body: {url, wait_for, timeout_ms}
 *   200 {"html": "..."}         su successo
 *   200 {"error": "messaggio"}  su fallimento applicativo (MAI status diverso da 200 qui:
 *                               il chiamante Python fa response.raise_for_status() PRIMA di
 *                               leggere il JSON, quindi un 4xx/5xx verrebbe intercettato come
 *                               errore di rete generico dal suo retry-loop invece che gestito
 *                               dal ramo dedicato "if 'error' in result" - vedi righe 87-93
 *                               del chiamante)
 * Un solo browser Chromium condiviso all'avvio (piu' veloce di lanciarne uno per richiesta),
 * un browser context isolato per ogni /render (nessuno stato/cookie condiviso tra richieste).
 */

const http = require('http');
const { chromium } = require('playwright');

const PORT = process.env.SCRAPER_PORT || 8090;
const MAX_BODY_BYTES = 1024 * 1024; // 1MB, ampio margine per un body {url, wait_for, timeout_ms}
const VALID_WAIT_FOR = new Set(['load', 'domcontentloaded', 'networkidle', 'commit']);
const DEFAULT_TIMEOUT_MS = 15000;
const HARD_TIMEOUT_MARGIN_MS = 5000; // oltre timeout_ms, garanzia che la richiesta non resti mai appesa

let browser = null;

async function ensureBrowser() {
  if (browser && browser.isConnected()) return browser;
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  browser.on('disconnected', () => { browser = null; });
  return browser;
}

async function renderUrl(url, waitFor, timeoutMs) {
  const b = await ensureBrowser();
  const context = await b.newContext();
  try {
    const page = await context.newPage();
    await page.goto(url, { waitUntil: waitFor, timeout: timeoutMs });
    const html = await page.content();
    return { html };
  } finally {
    await context.close().catch(() => {});
  }
}

function withHardTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ error: `Timeout superato (${ms}ms) senza risposta dalla pagina.` }), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    sendJson(res, 200, { status: 'ok', browser_connected: !!(browser && browser.isConnected()) });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/render') {
    sendJson(res, 200, { error: `Rotta non supportata: ${req.method} ${req.url}` });
    return;
  }

  let bodyBytes = 0;
  const chunks = [];
  req.on('data', (chunk) => {
    bodyBytes += chunk.length;
    if (bodyBytes > MAX_BODY_BYTES) {
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch (e) {
      sendJson(res, 200, { error: `Body JSON non valido: ${e.message}` });
      return;
    }

    const url = payload.url;
    if (!url || typeof url !== 'string') {
      sendJson(res, 200, { error: "Campo 'url' mancante o non valido." });
      return;
    }
    const waitFor = VALID_WAIT_FOR.has(payload.wait_for) ? payload.wait_for : 'networkidle';
    const timeoutMs = Number.isFinite(payload.timeout_ms) && payload.timeout_ms > 0
      ? payload.timeout_ms : DEFAULT_TIMEOUT_MS;

    try {
      const result = await withHardTimeout(renderUrl(url, waitFor, timeoutMs), timeoutMs + HARD_TIMEOUT_MARGIN_MS);
      sendJson(res, 200, result);
    } catch (e) {
      sendJson(res, 200, { error: `Rendering fallito: ${e.message || String(e)}` });
    }
  });

  req.on('error', (e) => {
    sendJson(res, 200, { error: `Errore lettura richiesta: ${e.message}` });
  });
});

server.listen(PORT, () => {
  console.log(`erpv6-scraper in ascolto su :${PORT}`);
});

process.on('SIGTERM', async () => {
  if (browser) await browser.close().catch(() => {});
  server.close(() => process.exit(0));
});
