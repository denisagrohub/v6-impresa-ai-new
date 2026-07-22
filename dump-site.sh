#!/bin/bash
# dump-site.sh
# Crea un dump completo del progetto v6-impresa-ai

set -e

PROJECT_DIR=~/Documents/v6-impresa-ai
DUMP_DIR=~/Documents/v6-impresa-ai-dump

mkdir -p "$DUMP_DIR"
cd "$PROJECT_DIR"

echo "📦 Creazione dump del progetto..."
tar -czf "$DUMP_DIR/v6-impresa-ai-full.tar.gz" \
    --exclude=node_modules \
    --exclude=.git \
    --exclude=.next \
    --exclude=*.log \
    --exclude=backup_*.sql \
    .

echo "📄 Generazione lista file..."
find . -type f -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.next/*" | sort > "$DUMP_DIR/file-list.txt"

echo "📝 Generazione dump markdown (struttura + contenuti chiave)..."
cat > "$DUMP_DIR/project_dump.md" << 'EOF'
# V6 Impresa AI - Dump del sito
Data: $(date '+%Y-%m-%d %H:%M:%S')
EOF

# Aggiungi struttura directory
echo "## Struttura Directory" >> "$DUMP_DIR/project_dump.md"
echo "\`\`\`" >> "$DUMP_DIR/project_dump.md"
find . -type d -not -path "./node_modules/*" -not -path "./.git/*" -not -path "./.next/*" | sort | sed 's/^\.\///' >> "$DUMP_DIR/project_dump.md"
echo "\`\`\`" >> "$DUMP_DIR/project_dump.md"

# Aggiungi package.json
echo "## package.json" >> "$DUMP_DIR/project_dump.md"
echo "\`\`\`json" >> "$DUMP_DIR/project_dump.md"
cat package.json >> "$DUMP_DIR/project_dump.md"
echo "\`\`\`" >> "$DUMP_DIR/project_dump.md"

# Aggiungi alcuni file importanti
for file in next.config.js tailwind.config.js postcss.config.js .env.local; do
    if [ -f "$file" ]; then
        echo "## $file" >> "$DUMP_DIR/project_dump.md"
        echo "\`\`\`" >> "$DUMP_DIR/project_dump.md"
        cat "$file" >> "$DUMP_DIR/project_dump.md"
        echo "\`\`\`" >> "$DUMP_DIR/project_dump.md"
    fi
done

echo "✅ Dump completato in $DUMP_DIR"
