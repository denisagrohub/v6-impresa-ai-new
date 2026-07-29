#!/bin/bash
set -e

echo "🚀 Deploy OpenSign in corso..."

# Verifica Docker
if ! command -v docker &> /dev/null; then
    echo "📦 Installazione Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
fi

# Scarica docker-compose.yml
curl -o docker-compose.yml https://raw.githubusercontent.com/OpenSignLabs/OpenSign/main/docker-compose.yml

# Avvia OpenSign
docker-compose up -d

# Attendi che sia pronto
sleep 30

echo "✅ OpenSign deployato su http://localhost:3000"
