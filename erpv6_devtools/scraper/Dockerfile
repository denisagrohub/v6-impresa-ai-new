# Immagine ufficiale Playwright: Chromium + tutte le dipendenze di sistema
# gia' incluse, nessuna installazione manuale di librerie native.
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY server.js .

ENV SCRAPER_PORT=8090
EXPOSE 8090

# L'immagine base gia' crea un utente non-root 'pwuser' con Chromium
# utilizzabile in sandbox limitata; qui il browser gira comunque con
# --no-sandbox (vedi server.js) perche' il container stesso e' isolato via
# Docker, stessa scelta pragmatica di molte immagini scraper headless.
USER pwuser

CMD ["node", "server.js"]
