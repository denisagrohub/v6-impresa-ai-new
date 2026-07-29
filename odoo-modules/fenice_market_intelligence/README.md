# Fenice Market Intelligence

Modulo Odoo 18 per la raccolta, storage e analisi di dati di mercato provenienti da fonti esterne.

## Funzionalità

### 1. Raccolta Dati Automatica
- **Amazon Product Advertising API**: Prodotti complementari, prezzi medi, best seller rank
- **Google Trends API**: Volume ricerche, trend stagionali, crescita interesse
- **Open Food Facts API**: Dati nutrizionali, certificazioni, ingredienti

### 2. Dashboard KPI
- Trend monitorati in tempo reale
- Prodotti in trend (score > 70)
- Opportunità di mercato ad alto potenziale
- Variazione prezzi vs competitor Amazon
- Alert automatici su anomalie

### 3. Analisi Predittiva (Preparazione)
- Storage strutturato per futuri algoritmi ML
- Pattern recognition prodotti complementari
- Analisi stagionalità
- Forecasting domanda

### 4. Integrazione con Marketplace
- Estende `product.template` con campi intelligence
- Score opportunità mercato per ogni prodotto
- Badge "In Trend" automatico
- Link a analisi dettagliate

## Installazione

1. Copia la cartella `fenice_market_intelligence` in `odoo-modules/`
2. Aggiorna lista app in Odoo
3. Installa "Fenice Market Intelligence"
4. Configura API keys in `Settings > Technical > Parameters > System Parameters`

## Configurazione API Keys

