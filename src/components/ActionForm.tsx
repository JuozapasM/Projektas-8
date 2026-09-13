'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ActionResult } from '@/types/database';

export function ActionForm({ action, children, label = 'Išsaugoti', goToCreatedEvent = false, confirmEventCancellation = false }: { action: (data: FormData) => Promise<ActionResult>; children: React.ReactNode; label?: string; goToCreatedEvent?: boolean; confirmEventCancellation?: boolean }) {
  const [pending, start] = useTransition(); const [result, setResult] = useState<ActionResult | null>(null); const router = useRouter();
  return <form onSubmit={e => {
    e.preventDefault(); const data = new FormData(e.currentTarget); setResult(null);
    if (confirmEventCancellation && data.get('status') === 'cancelled' && !window.confirm('Atšaukti renginį? Bus atšauktos visų žaidėjų ir komandų rezervacijos. Šio renginio iš naujo atidaryti nebegalėsite.')) return;
    const date = data.get('starts_at_local');
    if (typeof date === 'string') {
      if (!date || !Number.isFinite(Date.parse(date))) { setResult({ success: false, message: 'Pasirinkite galiojančią datą ir laiką.' }); return; }
      data.set('starts_at', new Date(date).toISOString());
    }
    start(async () => {
      try {
        const res = await action(data); setResult(res);
        if (res.success) { if (goToCreatedEvent && res.event_id) router.push(`/admin/events/${res.event_id}`); router.refresh(); }
      } catch { setResult({ success: false, message: 'Veiksmas nepavyko. Bandykite dar kartą.' }); }
    });
  }} className="space-y-4"><fieldset disabled={pending} className="space-y-4">{children}<button type="submit" className="primary-button" disabled={pending}>{pending ? 'Palaukite…' : label}</button></fieldset>{result && <p role={result.success ? 'status' : 'alert'} className={`text-sm ${result.success ? 'text-emerald-200' : 'text-red-300'}`}>{result.message}</p>}</form>;
}
export function MutationButton({ action, children, confirmMessage, href }: { action: () => Promise<ActionResult>; children: React.ReactNode; confirmMessage?: string; href?: string }) {
  const [pending, start] = useTransition(); const [result, setResult] = useState<ActionResult | null>(null); const router = useRouter();
  return <div><button disabled={pending} className="secondary-button" onClick={() => {
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setResult(null); start(async () => { try { const res = await action(); setResult(res); if (res.success) { if (href) router.push(href); router.refresh(); } } catch { setResult({ success: false, message: 'Veiksmas nepavyko. Bandykite dar kartą.' }); } });
  }}>{pending ? 'Palaukite…' : children}</button>{result && <p role={result.success ? 'status' : 'alert'} className={`mt-2 text-sm ${result.success ? 'text-emerald-200' : 'text-red-300'}`}>{result.message}</p>}</div>;
}
export function LocalDateField({ value }: { value?: string }) {
  const [local, setLocal] = useState('');
  useEffect(() => { if (value) { const date = new Date(value); setLocal(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16)); } }, [value]);
  return <label className="field-label">Data ir laikas (pagal jūsų įrenginį)<input className="field mt-2" type="datetime-local" name="starts_at_local" required value={local} onChange={e => setLocal(e.target.value)} /></label>;
}
export function CopyLink({ url }: { url: string }) {
  const [message, setMessage] = useState('');
  return <div><input aria-label="Komandos pakvietimo nuoroda" className="field text-xs mb-3" readOnly value={url} onFocus={e => e.target.select()} /><button className="secondary-button" onClick={async () => { try { await navigator.clipboard.writeText(url); setMessage('Nuoroda nukopijuota.'); } catch { setMessage('Pažymėkite ir nukopijuokite nuorodą iš laukelio.'); } }}>Kopijuoti pakvietimą</button><p role="status" className="mt-2 text-xs text-slate-400">{message}</p></div>;
}
