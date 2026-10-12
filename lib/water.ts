import {finite, type ClimateData} from './climate';
import type {UrbanFeature} from './twin';

export type WaterSettings = {
  connectedFraction: number;
  runoffCoefficient: number;
  capacityM3: number;
  initialStorageM3: number;
  dailyDemandM3: number;
};
export const WATER_DEFAULTS: WaterSettings = {
  connectedFraction: 1, runoffCoefficient: .85, capacityM3: 10,
  initialStorageM3: 0, dailyDemandM3: 1,
};
export const WATER_MODEL_VERSION = 'roof-tank-hourly-v1';

export type RainInterval = {
  /** Provider endpoint; rain and showers cover the preceding hour. */
  time: string;
  intervalStart: string;
  label: string;
  rain: number | null;
  showers: number | null;
  rainMm: number | null;
};
export type RainDay = {
  available: boolean;
  reason: string | null;
  date: string | null;
  rows: RainInterval[];
};

/** Validate a nominal local day without interpreting local labels in the browser's time zone. */
export function rainIntervals(active: ClimateData | undefined, offset = 1): RainDay {
  const weather = active?.weather;
  const unavailable = (reason: string, date: string | null = null, rows: RainInterval[] = []): RainDay =>
    ({available: false, reason, date, rows});
  if (!weather || typeof weather.current?.time !== 'string') return unavailable('A weather forecast is needed.');
  if (!Number.isInteger(offset) || Math.abs(offset) > 3660) return unavailable('The forecast day offset is invalid.');
  const currentDate = weather.current.time.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(currentDate)) return unavailable('The forecast date is invalid.');
  const calendar = new Date(currentDate + 'T00:00:00Z');
  if (!finite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== currentDate) return unavailable('The forecast date is invalid.');
  calendar.setUTCDate(calendar.getUTCDate() + offset);
  const date = calendar.toISOString().slice(0, 10);
  calendar.setUTCDate(calendar.getUTCDate() + 1);
  const end = calendar.toISOString().slice(0, 10) + 'T00:00';
  const start = date + 'T00:00';
  const expected = Array.from({length: 24}, (_, i) => i === 23 ? end : `${date}T${String(i + 1).padStart(2, '0')}:00`);
  const hourly = weather.hourly;
  const times = Array.isArray(hourly?.time) ? hourly.time : [];
  const indices = new Map<string, number>();
  times.forEach((time, i) => { if (typeof time === 'string') indices.set(time, i); });
  const rainArray = Array.isArray(hourly?.rain) ? hourly.rain : null;
  const showersArray = Array.isArray(hourly?.showers) ? hourly.showers : null;
  const rainUnit = weather.hourly_units?.rain === 'mm';
  const showersUnit = weather.hourly_units?.showers === 'mm';
  const read = (values: (number | null)[] | string[] | null, index: number | undefined, validUnit: boolean): number | null => {
    const value = index === undefined ? null : values?.[index];
    return validUnit && finite(value) && value >= 0 ? value : null;
  };
  const rows = expected.map((time, i): RainInterval => {
    const index = indices.get(time), rain = read(rainArray, index, rainUnit), showers = read(showersArray, index, showersUnit);
    const liquid = rain === null || showers === null ? null : rain + showers;
    return {time, intervalStart: i === 0 ? start : expected[i - 1], label: `${String(i).padStart(2, '0')}:00`, rain, showers,
      rainMm: finite(liquid) ? liquid : null};
  });
  if (!rainArray || !showersArray) return unavailable('This source snapshot has no complete rain and showers fields. Refresh the weather data.', date, rows);
  if (!rainUnit || !showersUnit) return unavailable('Rain and showers must both have explicit millimeter (mm) units.', date, rows);
  if (typeof weather.timezone !== 'string' || !weather.timezone) return unavailable('The forecast time zone is unavailable.', date, rows);
  const window = times.filter(time => typeof time === 'string' && time > start && time <= end);
  if (window.length !== 24 || window.some((time, i) => time !== expected[i]))
    return unavailable('A complete day requires 24 unique, consecutive hourly endpoints from 01:00 through the following midnight.', date, rows);
  if (rows.some(row => row.rainMm === null || !finite(row.rainMm)))
    return unavailable('At least one hourly rain or showers value is missing, negative, or invalid.', date, rows);
  return {available: true, reason: null, date, rows};
}

export type WaterRow = RainInterval & {
  roofRunoff: number | null;
  inflow: number | null;
  bypass: number | null;
  overflow: number | null;
  reuse: number | null;
  storage: number | null;
  unserved: number | null;
  afterRelease: number | null;
  demand: number | null;
};
export type WaterTotals = {
  rainMm: number;
  roofRunoff: number;
  inflow: number;
  bypass: number;
  overflow: number;
  reuse: number;
  storage: number;
  unserved: number;
  baselineRelease: number;
  afterRelease: number;
  retained: number;
  initialStorage: number;
  demand: number;
};
export type WaterBalance = {
  available: boolean;
  reason: string | null;
  date: string | null;
  rows: WaterRow[];
  catchmentAreaM2: number | null;
  connectedAreaM2: number | null;
  totals: WaterTotals | null;
  residual: number | null;
};

function invalidSettings(settings: WaterSettings): string | null {
  if (!settings || Object.keys(WATER_DEFAULTS).some(key => !finite(settings[key as keyof WaterSettings])))
    return 'Every water assumption must be a finite number.';
  if (settings.connectedFraction < 0 || settings.connectedFraction > 1) return 'Connected roof fraction must be between 0 and 1.';
  if (settings.runoffCoefficient < 0 || settings.runoffCoefficient > 1) return 'Runoff coefficient must be between 0 and 1.';
  if (settings.capacityM3 < 0) return 'Tank capacity cannot be negative.';
  if (settings.initialStorageM3 < 0 || settings.initialStorageM3 > settings.capacityM3) return 'Initial storage must be between zero and the tank capacity.';
  if (settings.dailyDemandM3 < 0) return 'Assumed daily demand cannot be negative.';
  return null;
}

/** One mapped roof, one idealized tank; spillage happens before uniform hourly reuse. Volumes are m³. */
export function waterBalance(active: ClimateData | undefined, feature: UrbanFeature | undefined | null, settings: WaterSettings): WaterBalance {
  const rain = rainIntervals(active);
  const area = feature?.kind === 'building' && finite(feature.area) && feature.area > 0 ? feature.area : null;
  const fail = (reason: string): WaterBalance => ({available: false, reason, date: rain.date, catchmentAreaM2: area,
    connectedAreaM2: area !== null && finite(settings?.connectedFraction) && settings.connectedFraction >= 0 && settings.connectedFraction <= 1
      ? area * settings.connectedFraction : null,
    rows: rain.rows.map(row => ({...row, roofRunoff: null, inflow: null, bypass: null, overflow: null,
      reuse: null, storage: null, unserved: null, afterRelease: null, demand: null})), totals: null, residual: null});
  const invalid = invalidSettings(settings);
  if (invalid) return fail(invalid);
  if (area === null) return fail('Select one mapped building with a positive footprint area.');
  if (!rain.available) return fail(rain.reason ?? 'The rainfall forecast is unavailable.');
  const demand = settings.dailyDemandM3 / 24;
  let storage = settings.initialStorageM3;
  const rows: WaterRow[] = rain.rows.map(row => {
    const roofRunoff = row.rainMm! * (area / 1000) * settings.runoffCoefficient;
    const inflow = roofRunoff * settings.connectedFraction, bypass = roofRunoff - inflow;
    const overflow = Math.max(storage + inflow - settings.capacityM3, 0);
    const available = Math.min(settings.capacityM3, storage + inflow), reuse = Math.min(demand, available);
    storage = available - reuse;
    return {...row, roofRunoff, inflow, bypass, overflow, reuse, storage, unserved: demand - reuse,
      afterRelease: bypass + overflow, demand};
  });
  if (rows.some(row => [row.roofRunoff, row.inflow, row.bypass, row.overflow, row.reuse, row.storage, row.unserved, row.afterRelease].some(n => !finite(n))))
    return fail('The rainfall or assumptions exceed the supported numeric range.');
  const sum = (key: 'rainMm' | 'roofRunoff' | 'inflow' | 'bypass' | 'overflow' | 'reuse' | 'unserved' | 'afterRelease') =>
    rows.reduce((total, row) => total + row[key]!, 0);
  const runoff = sum('roofRunoff'), afterRelease = sum('afterRelease');
  const totals: WaterTotals = {rainMm: sum('rainMm'), roofRunoff: runoff, inflow: sum('inflow'), bypass: sum('bypass'),
    overflow: sum('overflow'), reuse: sum('reuse'), storage, unserved: sum('unserved'), baselineRelease: runoff,
    afterRelease, retained: runoff - afterRelease, initialStorage: settings.initialStorageM3, demand: settings.dailyDemandM3};
  if (Object.values(totals).some(n => !finite(n))) return fail('The rainfall or assumptions exceed the supported numeric range.');
  const residual = settings.initialStorageM3 + totals.inflow - totals.overflow - totals.reuse - storage;
  if (!finite(residual)) return fail('The rainfall or assumptions exceed the supported numeric range.');
  return {available: true, reason: null, date: rain.date, rows, catchmentAreaM2: area,
    connectedAreaM2: area * settings.connectedFraction, totals, residual};
}

export type CapacityCandidate = {
  capacityM3: number;
  available: boolean;
  reason: string | null;
  reuse: number | null;
  overflow: number | null;
  storage: number | null;
  retained: number | null;
  unserved: number | null;
};

/** Capacity comparisons always start empty, so larger tanks do not gain invented initial water. */
export function capacitySweep(active: ClimateData | undefined, feature: UrbanFeature | undefined | null, settings: WaterSettings): CapacityCandidate[] {
  if (invalidSettings(settings)) return [];
  const empty = {...settings, initialStorageM3: 0};
  // Stable candidate assumptions, not recommended sizes; retain a custom selected capacity exactly.
  const capacities = Array.from(new Set([0, 1, 2.5, 5, 10, 25, 50, 100, settings.capacityM3])).sort((a, b) => a - b);
  return capacities.map(capacityM3 => {
    const result = waterBalance(active, feature, {...empty, capacityM3}), totals = result.totals;
    return {capacityM3, available: result.available, reason: result.reason, reuse: totals?.reuse ?? null,
      overflow: totals?.overflow ?? null, storage: totals?.storage ?? null, retained: totals?.retained ?? null,
      unserved: totals?.unserved ?? null};
  });
}
