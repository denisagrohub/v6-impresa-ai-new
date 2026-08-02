import axios from 'axios';

interface OdooConfig {
  url: string;
  db: string;
  username: string;
  password: string;
  mock?: boolean;
}

class OdooApiAdapter {
  private config: OdooConfig;
  private uid: number | null = null;

  constructor(config: OdooConfig) {
    this.config = config;
  }

  async connect() {
    if (this.config.mock) {
      console.log('🔷 Modalità MOCK Odoo attiva');
      return;
    }

    console.log(`🔗 Tentativo connessione a ${this.config.url}`);

    try {
      // Usa JSON-RPC invece di XML-RPC
      const resp = await axios.post(`${this.config.url}/jsonrpc`, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'common',
          method: 'login',
          args: [this.config.db, this.config.username, this.config.password]
        },
        id: Date.now()
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (resp.data.error) {
        throw new Error(resp.data.error.message);
      }

      const uid = resp.data.result;

      if (uid === false || uid === null || uid === undefined) {
        throw new Error(`Login fallito per ${this.config.username}. Credenziali non valide.`);
      }

      if (typeof uid !== 'number') {
        throw new Error(`Risposta di login inaspettata: ${JSON.stringify(uid)}`);
      }

      this.uid = uid;
      console.log(`✅ Connesso a Odoo ${this.config.db} (UID: ${this.uid})`);

    } catch (e: any) {
      console.error('❌ Errore connessione Odoo:', e.message);
      if (e.code === 'ECONNREFUSED') {
        throw new Error(`Impossibile raggiungere Odoo all'URL ${this.config.url}. Verifica che il server sia attivo.`);
      }
      throw new Error(e.message || 'Errore di connessione a Odoo');
    }
  }

  async execute(model: string, method: string, args: any[]) {
    if (this.config.mock) {
      console.log(`🔷 Mock Odoo: ${model}.${method}`);
      return [];
    }

    if (!this.uid) {
      await this.connect();
    }

    try {
      const resp = await axios.post(`${this.config.url}/jsonrpc`, {
        jsonrpc: '2.0',
        method: 'call',
        params: {
          service: 'object',
          method: 'execute_kw',
          args: [this.config.db, this.uid, this.config.password, model, method, args]
        },
        id: Date.now()
      }, {
        headers: { 'Content-Type': 'application/json' }
      });

      if (resp.data.error) {
        throw new Error(resp.data.error.message);
      }

      return resp.data.result || [];

    } catch (e: any) {
      console.error(`❌ Errore ${model}.${method}:`, e.message);
      throw e;
    }
  }
}

export const odoo = new OdooApiAdapter({
  url: process.env.NEXT_PUBLIC_ODOO_URL || 'http://localhost:8069',
  db: process.env.NEXT_PUBLIC_ODOO_DB || 'erpv6',
  username: process.env.NEXT_PUBLIC_ODOO_USERNAME || 'admin',
  password: process.env.NEXT_PUBLIC_ODOO_PASSWORD || 'admin',
  mock: process.env.NEXT_PUBLIC_ODOO_MOCK === 'true'
});

export default odoo;
