export type City = { id: string; name: string; country: string; lat: number; lon: number };
export const CITIES: City[] = [
  { id: "delhi", name: "New Delhi", country: "India", lat: 28.6139, lon: 77.209 },
  { id: "istanbul", name: "Istanbul", country: "Türkiye", lat: 41.0082, lon: 28.9784 },
  { id: "london", name: "London", country: "United Kingdom", lat: 51.5074, lon: -0.1278 },
  { id: "nairobi", name: "Nairobi", country: "Kenya", lat: -1.2921, lon: 36.8219 },
  { id: "singapore", name: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198 },
  { id: "sydney", name: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093 },
  { id: "sf", name: "San Francisco", country: "United States", lat: 37.7749, lon: -122.4194 },
  { id: "saopaulo", name: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333 },
];
export type ModelResponse = {
  latitude: number; longitude: number; timezone: string; utc_offset_seconds: number;
  current: { time: string; [key: string]: number | string | null };
  current_units: Record<string, string>;
  hourly: { time: string[]; [key: string]: (number | null)[] | string[] };
  hourly_units: Record<string, string>;
  daily?: { time: string[]; [key: string]: (number | null)[] | string[] };
  [key: string]: unknown;
};
export type ClimateData = { city: City; weather: ModelResponse | null; air: ModelResponse | null; retrievedAt: string; status: "live" | "snapshot" | "partial"; sources: { weather: string; air: string }; errors?: string[] };
export type Hour = { time: string; label: string; temperature: number | null; humidity: number | null; aqi: number | null; pm25: number | null; irradiance: number | null; solar: number | null; };
export const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n !== -999;
export function num(n: unknown, digits = 1) { return finite(n) ? n.toFixed(digits) : "—"; }
export function aqiCategory(value: unknown) {
  if (!finite(value)) return { label: "Unavailable", color: "#87958b" };
  if (value <= 50) return { label: "Good", color: "#aeeaa0" };
  if (value <= 100) return { label: "Moderate", color: "#e9cc7c" };
  if (value <= 150) return { label: "Unhealthy for sensitive groups", color: "#efac73" };
  if (value <= 200) return { label: "Unhealthy", color: "#e7918d" };
  if (value <= 300) return { label: "Very unhealthy", color: "#c7a0dc" };
  return { label: "Hazardous", color: "#df7591" };
}
export function hours(data: ClimateData | undefined, capacity = 5, derate = .8): Hour[] {
  const w = data?.weather; if (!w?.hourly) return [];
  const airIndices = new Map(data?.air?.hourly.time.map((t, i) => [t, i]) ?? []);
  return w.hourly.time.map((time, i) => {
    const read = (key: string) => { const n = w.hourly[key]?.[i]; return finite(n) ? n : null; };
    const ai = airIndices.get(time); const aq = (key: string) => { const n = ai === undefined ? null : data?.air?.hourly[key]?.[ai]; return finite(n) ? n : null; };
    const irradiance = read("global_tilted_irradiance");
    return { time, label: time.slice(11, 16), temperature: read("temperature_2m"), humidity: read("relative_humidity_2m"), aqi: aq("us_aqi"), pm25: aq("pm2_5"), irradiance, solar: irradiance === null ? null : Math.max(0, irradiance) / 1000 * capacity * derate };
  });
}
export function dayHours(data: ClimateData | undefined, offset=0, capacity = 5, derate = .8) {
  const current = data?.weather?.current.time.slice(0, 10); if(!current)return [];
  const date=new Date(current+"T00:00:00Z");date.setUTCDate(date.getUTCDate()+offset);const start=date.toISOString().slice(0,10);date.setUTCDate(date.getUTCDate()+1);const end=date.toISOString().slice(0,10);
  // Radiation endpoints 01:00..next-day 00:00 cover the preceding intervals for this complete local day.
  return hours(data,capacity,derate).filter(h=>h.time>`${start}T00:00`&&h.time<=`${end}T00:00`);
}
export const todayHours=(data:ClimateData|undefined,capacity=5,derate=.8)=>dayHours(data,0,capacity,derate);
export function nextHours(data: ClimateData | undefined) { const now = data?.weather?.current.time ?? ""; return hours(data).filter(h => h.time >= now).slice(0, 24); }
