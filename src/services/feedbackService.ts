import type { Feedback } from '../data/mockData';
import { buildApiUrl as buildUrl } from './apiConfig';
const headers = () => ({ 'Content-Type': 'application/json', Accept: 'application/json', 'ngrok-skip-browser-warning': '1' });

function toFeedback(r: any): Feedback {
  return {
    id: String(r.id || r.feedback_id),
    userId: String(r.userId || r.user_id || ''),
    feedbackCode: r.feedbackCode || r.feedback_code || '',
    type: r.type || '',
    ticketCode: r.ticketCode || r.ticket_code || '',
    description: r.description || '',
    priority: r.priority || 'Low',
    status: r.status || 'New',
    attachmentUrl: r.attachmentUrl || r.attachment_url || '',
    staffResponse: r.staffResponse || r.staff_response || '',
    staffRespondedAt: r.staffRespondedAt || r.staff_responded_at || '',
    createdAt: r.createdAt || r.created_at || '',
  };
}

export async function fetchFeedbacksByUser(userId: string): Promise<Feedback[]> {
  const res = await fetch(buildUrl(`/api/feedbacks?userId=${encodeURIComponent(userId)}`), {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Feedbacks API ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(toFeedback);
}

export async function fetchAllFeedbacks(): Promise<Feedback[]> {
  const res = await fetch(buildUrl('/api/feedbacks'), { headers: headers() });
  if (!res.ok) throw new Error(`Feedbacks API ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map(toFeedback);
}

export async function createFeedback(feedback: Feedback): Promise<Feedback> {
  const res = await fetch(buildUrl('/api/feedbacks'), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(feedback),
  });
  if (!res.ok) throw new Error(`Feedbacks API ${res.status}`);
  const data = await res.json();
  return toFeedback(data.feedback ?? data);
}

export async function updateFeedback(
  id: string,
  patch: { status?: string; staffResponse?: string; staffRespondedAt?: string },
): Promise<Feedback> {
  const res = await fetch(buildUrl(`/api/feedbacks/${encodeURIComponent(id)}`), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Feedbacks API ${res.status}`);
  const data = await res.json();
  return toFeedback(data.feedback ?? data);
}
