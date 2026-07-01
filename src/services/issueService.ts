import type { SlotIssue } from '../data/mockData';
import { buildApiUrl } from './apiConfig';

const h = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'ngrok-skip-browser-warning': '1' });

export async function fetchIssues(): Promise<SlotIssue[]> {
  try {
    const res = await fetch(buildApiUrl('/api/issues'), { headers: h() });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function apiCreateIssue(issue: Omit<SlotIssue, 'id' | 'reportedAt' | 'status'>): Promise<SlotIssue | null> {
  try {
    const res = await fetch(buildApiUrl('/api/issues'), {
      method: 'POST',
      headers: h(),
      body: JSON.stringify(issue),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`POST /api/issues failed ${res.status}:`, body);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error('POST /api/issues network error:', err);
    return null;
  }
}

export async function apiUpdateIssue(id: string, data: { status: string }): Promise<void> {
  try {
    await fetch(buildApiUrl(`/api/issues/${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: h(),
      body: JSON.stringify(data),
    });
  } catch {}
}

export function subscribeToIssueEvents(
  onUpdate: (issue: Partial<SlotIssue> & { id: string }) => void,
): () => void {
  let cancelled = false;
  let retryTimer: ReturnType<typeof setTimeout>;

  const connect = async () => {
    if (cancelled) return;
    try {
      const res = await fetch(buildApiUrl('/api/issues/events'), {
        headers: {
          Accept: 'text/event-stream',
          'Cache-Control': 'no-cache',
          'ngrok-skip-browser-warning': '1',
        },
      });
      if (!res.ok || !res.body) throw new Error('SSE failed');

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = '';

      while (true) {
        if (cancelled) { reader.cancel(); break; }
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed?.id) onUpdate(parsed);
          } catch {}
        }
      }
    } catch { /* fall through to retry */ }

    if (!cancelled) retryTimer = setTimeout(connect, 10000);
  };

  connect();
  return () => { cancelled = true; clearTimeout(retryTimer); };
}
