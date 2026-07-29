import type { PricingRule, VehicleKey } from '../data/mockData';
import { buildApiUrl, defaultHeaders } from './apiConfig';

function toPricingRule(r: any, index: number): PricingRule {
  return {
    id: Number(r.id) || index,
    vehicleType: (r.vehicleKey || 'car') as VehicleKey,
    firstHourPrice: r.prices?.hourly ?? 0,
    overnightPrice: r.prices?.overnight ?? 0,
    monthlyPrice: r.prices?.monthly ?? 0,
    lostTicketFee: r.lostTicketFee ?? 0,
    extraServiceFee: r.extraServiceFee ?? 0,
    note: r.note ?? '',
  };
}

/** Live pricing straight from dbo.pricing_rules — the single source of truth Manager edits and Staff/User both read. */
export async function fetchPricingRules(): Promise<PricingRule[]> {
  try {
    const res = await fetch(buildApiUrl('/api/pricing-rules'), { headers: defaultHeaders() });
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(toPricingRule);
  } catch {
    return [];
  }
}
