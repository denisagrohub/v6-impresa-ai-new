/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 13/10/2026 (C-email-hub-2): token brand V6 + state email hub.
        brand: {
          navy:      '#1a2744',
          terracotta:'#c85a3a',
          sand:      '#fafafa',
          card:      '#ffffff',
          border:    '#e5e7eb',
          text:      '#0f172a',
          muted:     '#64748b',
        },
        state: {
          unread:  '#3b82f6',
          replied: '#10b981',
          overdue: '#ef4444',
          muted:   '#94a3b8',
        },
      },
      boxShadow: {
        'hub-card':   '0 1px 2px rgba(0,0,0,0.04)',
        'hub-hover':  '0 4px 12px rgba(26,39,68,0.08)',
        'hub-panel':  '-4px 0 20px rgba(26,39,68,0.06)',
      },
      transitionDuration: {
        '200': '200ms',
      },
    },
  },
  plugins: [],
}
