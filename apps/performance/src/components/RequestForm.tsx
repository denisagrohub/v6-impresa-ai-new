'use client';

import { useId, type FormEvent } from 'react';
import { Button } from '@erpv6/ui';

// Placeholder: sostituire con l'indirizzo definitivo di V6 Performance quando disponibile.
const CONTACT_EMAIL = 'fattoriaaitosimati@gmail.com';

const SECTORS = [
  { value: 'carrozzeria', label: 'Carrozzeria' },
  { value: 'stampa', label: 'Stampa' },
  { value: 'falegnameria', label: 'Falegnameria' },
  { value: 'altro', label: 'Altro settore' },
];

export function RequestForm() {
  const nameId = useId();
  const businessId = useId();
  const sectorId = useId();
  const emailId = useId();
  const messageId = useId();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '');
    const business = String(data.get('business') ?? '');
    const sectorLabel = SECTORS.find((s) => s.value === data.get('sector'))?.label ?? '';
    const email = String(data.get('email') ?? '');
    const message = String(data.get('message') ?? '');

    const subject = `Richiesta accesso anticipato — ${sectorLabel || 'settore da definire'}`;
    const body = [
      `Nome: ${name}`,
      `Attività: ${business}`,
      `Settore: ${sectorLabel}`,
      `Email: ${email}`,
      message ? `Messaggio: ${message}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={nameId} className="mb-1.5 block text-sm font-medium text-gray-700">
            Nome e cognome
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            required
            autoComplete="name"
            placeholder="Mario Rossi"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>
        <div>
          <label htmlFor={businessId} className="mb-1.5 block text-sm font-medium text-gray-700">
            Nome dell&rsquo;attività
          </label>
          <input
            id={businessId}
            name="business"
            type="text"
            required
            autoComplete="organization"
            placeholder="Carrozzeria Rossi"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor={sectorId} className="mb-1.5 block text-sm font-medium text-gray-700">
            Settore
          </label>
          <select
            id={sectorId}
            name="sector"
            required
            defaultValue=""
            className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          >
            <option value="" disabled>
              Seleziona il tuo settore…
            </option>
            {SECTORS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={emailId} className="mb-1.5 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id={emailId}
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            spellCheck={false}
            placeholder="mario@carrozzeriarossi.it"
            className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
          />
        </div>
      </div>

      <div>
        <label htmlFor={messageId} className="mb-1.5 block text-sm font-medium text-gray-700">
          Messaggio <span className="font-normal text-gray-400">(facoltativo)</span>
        </label>
        <textarea
          id={messageId}
          name="message"
          rows={3}
          placeholder="Raccontaci qualcosa in più sulla tua attività…"
          className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        />
      </div>

      <div>
        <Button type="submit" size="lg" fullWidth className="bg-sky-700 hover:bg-sky-800">
          Richiedi di essere tra i primi a provarlo nel tuo settore
        </Button>
        <p className="mt-2 text-xs text-gray-500">
          Si apre il tuo programma di posta con i dati già compilati: dovrai solo premere invia.
        </p>
      </div>
    </form>
  );
}
