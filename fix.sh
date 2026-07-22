cd ~/v6-impresa-ai
cat > src/app/layout.tsx << 'EOF'
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "V6 Impresa AI",
  description: "Piattaforma di consulenza per business plan, brand e marketing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
EOF

# Testa che il server parta
npm run dev
# Dovresti vedere "ready" e il sito su http://localhost:3000
# Premi Ctrl+C per fermarlo
