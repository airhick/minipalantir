import type * as GeoJSON from 'geojson';

// ── Supabase config (PostgREST — no SDK needed, plain fetch) ─────────────────
const SUPABASE_URL = 'https://thfbkakbbszvgbkicssx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoZmJrYWtiYnN6dmdia2ljc3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0MzUxOTEsImV4cCI6MjA4MjAxMTE5MX0.nMzv5oOThART2Q5e40RGtIeq0F3vz2X2M7mUtWXUQEo';

const SUPA_HEADERS = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${SUPABASE_ANON}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface CameraProperties {
    id: number;
    surveillance_type: string;
    camera_type: string;
    name?: string;
    url?: string;
    operator?: string;
    city?: string;
    thumbnail?: string;
}

export interface CameraFeature {
    type: 'Feature';
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: CameraProperties;
}

interface DbCamera {
    osm_id: number;
    lat: number;
    lon: number;
    name: string | null;
    url: string | null;
    operator: string | null;
    city: string | null;
    surveillance_type: string;
    camera_type: string;
}

// ── Supabase helpers ──────────────────────────────────────────────────────────

/** Fetch all cameras from Supabase in pages of 1000 rows */
async function fetchFromSupabase(signal?: AbortSignal): Promise<CameraFeature[]> {
    const PAGE = 1000;
    const all: CameraFeature[] = [];
    let offset = 0;

    // eslint-disable-next-line no-constant-condition
    while (true) {
        if (signal?.aborted) break;
        try {
            const resp = await fetch(
                `${SUPABASE_URL}/rest/v1/camera` +
                `?select=osm_id,lat,lon,name,url,operator,city,surveillance_type,camera_type` +
                `&order=osm_id.asc` +
                `&limit=${PAGE}&offset=${offset}`,
                { headers: SUPA_HEADERS, signal: signal ?? undefined }
            );
            if (!resp.ok) break;
            const rows: DbCamera[] = await resp.json();
            if (!rows.length) break;

            for (const row of rows) {
                all.push(dbRowToFeature(row));
            }
            if (rows.length < PAGE) break;
            offset += PAGE;
        } catch {
            break;
        }
    }
    return all;
}

/** Upsert a batch of camera features into Supabase */
async function upsertToSupabase(features: CameraFeature[]): Promise<void> {
    if (!features.length) return;
    const rows: DbCamera[] = features.map(f => ({
        osm_id: f.properties.id,
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        name: f.properties.name ?? null,
        url: f.properties.url ?? null,
        operator: f.properties.operator ?? null,
        city: f.properties.city ?? null,
        surveillance_type: f.properties.surveillance_type,
        camera_type: f.properties.camera_type,
    }));

    // Upsert in chunks of 500 to stay within request size limits
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
        try {
            await fetch(`${SUPABASE_URL}/rest/v1/camera`, {
                method: 'POST',
                headers: { ...SUPA_HEADERS, 'Prefer': 'resolution=merge-duplicates,return=minimal' },
                body: JSON.stringify(rows.slice(i, i + CHUNK)),
                signal: AbortSignal.timeout(30_000),
            });
        } catch {
            // Non-fatal — we'll try again next time
        }
    }
}

function dbRowToFeature(row: DbCamera): CameraFeature {
    return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [row.lon, row.lat] },
        properties: {
            id: row.osm_id,
            surveillance_type: row.surveillance_type,
            camera_type: row.camera_type,
            name: row.name ?? undefined,
            url: row.url ?? undefined,
            operator: row.operator ?? undefined,
            city: row.city ?? undefined,
        },
    };
}

// ── Overpass fallback ─────────────────────────────────────────────────────────
const OVERPASS_MIRRORS = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
let mirrorIdx = 0;
const REGIONS: Array<{ name: string; bbox: [number, number, number, number] }> = [
    { name: 'UK', bbox: [49.5, -8.7, 61.0, 2.0] },
    { name: 'France', bbox: [42.3, -5.2, 51.1, 8.2] },
    { name: 'Germany', bbox: [47.3, 6.0, 55.0, 15.0] },
    { name: 'BeNeLux', bbox: [49.4, 2.5, 53.6, 7.2] },
    { name: 'Spain+PT', bbox: [36.0, -10.0, 43.8, 4.3] },
    { name: 'Italy', bbox: [36.6, 6.6, 47.1, 18.5] },
    { name: 'Poland', bbox: [49.0, 14.1, 54.8, 24.1] },
    { name: 'Scandinav', bbox: [55.4, 4.5, 71.2, 31.0] },
    { name: 'US-NE', bbox: [38.9, -80.0, 47.5, -66.9] },
    { name: 'US-SE', bbox: [24.8, -92.0, 38.8, -66.9] },
    { name: 'US-MW', bbox: [36.1, -104.0, 49.4, -80.0] },
    { name: 'US-West', bbox: [31.3, -124.4, 49.4, -104.0] },
    { name: 'Japan', bbox: [24.0, 129.5, 45.5, 145.8] },
    { name: 'China-NE', bbox: [30.0, 108.0, 42.0, 125.0] },
    { name: 'India-N', bbox: [20.0, 68.0, 36.0, 97.0] },
    { name: 'SE-Asia', bbox: [-8.0, 95.0, 20.0, 141.0] },
    { name: 'Australia', bbox: [-44.0, 113.0, -10.0, 154.0] },
    { name: 'Brazil-SE', bbox: [-25.0, -54.0, -5.0, -35.0] },
    { name: 'S-Africa', bbox: [-35.0, 17.0, -10.0, 37.0] },
    { name: 'Turkey', bbox: [36.0, 26.0, 42.0, 44.8] },
];

function buildQuery(bbox: [number, number, number, number]): string {
    const [s, w, n, e] = bbox;
    const bb = `(${s},${w},${n},${e})`;
    return `[out:json][timeout:25];(node["man_made"="surveillance"]["url"]${bb};node["man_made"="surveillance"]["contact:url"]${bb};node["man_made"="surveillance"]["image"]${bb};node["man_made"="surveillance"]["website"]${bb};);out body;`;
}

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchRegion(
    regionName: string,
    bbox: [number, number, number, number],
    signal: AbortSignal,
    attempt = 0,
): Promise<CameraFeature[]> {
    if (signal.aborted) return [];
    const mirror = OVERPASS_MIRRORS[mirrorIdx % OVERPASS_MIRRORS.length];
    mirrorIdx++;
    try {
        const combined = (AbortSignal as any).any
            ? (AbortSignal as any).any([signal, AbortSignal.timeout(28_000)])
            : signal;
        const resp = await fetch(mirror, { method: 'POST', body: buildQuery(bbox), signal: combined });
        if (resp.status === 429 || resp.status === 504) {
            if (attempt < 1 && !signal.aborted) {
                await delay(3000 * (attempt + 1));
                return fetchRegion(regionName, bbox, signal, attempt + 1);
            }
            return [];
        }
        if (!resp.ok) return [];
        const data = await resp.json();
        return (data.elements as Record<string, unknown>[])
            .filter(el => el.type === 'node' && el.lat != null && el.lon != null)
            .map(el => {
                const tags = (el.tags as Record<string, string>) || {};
                const url = tags.url || tags['contact:url'] || tags.image || tags.website || undefined;
                return {
                    type: 'Feature' as const,
                    geometry: { type: 'Point' as const, coordinates: [el.lon as number, el.lat as number] },
                    properties: {
                        id: el.id as number,
                        surveillance_type: tags.surveillance || 'public',
                        camera_type: tags.camera_type || 'fixed',
                        name: tags.name || tags['name:en'] || undefined,
                        url,
                        operator: tags.operator || undefined,
                        city: regionName,
                    },
                } as CameraFeature;
            })
            .filter(f => !!f.properties.url);
    } catch {
        return [];
    }
}

import { fetchEarthCam } from './earthcam';

// ── Main export ──────────────────────────────────────────────────────────────
// Flow:
//   1. Try Supabase first (fast cached live streams)
//   2. Fetch EarthCam API (private network streams)
//   3. If Supabase is empty, fall back to Overpass + save results to Supabase
//      so next load is instant.
export const fetchGlobalCameras = async (
    onProgress?: (loaded: number, total: number, count: number) => void,
    signal?: AbortSignal,
    onBatch?: (features: CameraFeature[]) => void,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => {

    let allFeatures: CameraFeature[] = [];

    // ── 0. Fetch EarthCam in parallel ──────────────────────────────────────
    const earthCamPromise = fetchEarthCam(signal).then(earthCams => {
        if (earthCams.length > 0 && !signal?.aborted) {
            onBatch?.(earthCams);
            allFeatures = [...allFeatures, ...earthCams];
        }
        return earthCams;
    }).catch(() => []);

    // ── 1. Try Supabase ────────────────────────────────────────────────────
    const cached = await fetchFromSupabase(signal);
    if (cached.length > 0) {
        allFeatures = [...allFeatures, ...cached];
        const total = cached.length;
        const CHUNK = 500;
        for (let i = 0; i < total; i += CHUNK) {
            if (signal?.aborted) break;
            const chunk = cached.slice(i, i + CHUNK);
            onBatch?.(chunk);
            onProgress?.(Math.min(i + CHUNK, total), total, Math.min(i + CHUNK, total));
            // Yield to the render loop between chunks
            await new Promise(r => setTimeout(r, 0));
        }
        onProgress?.(total, total, allFeatures.length);

        await earthCamPromise; // Wait for Earthcam before returning
        return { type: 'FeatureCollection', features: allFeatures };
    }

    // ── 2. Supabase empty → fall back to Overpass ──────────────────────────
    const total = REGIONS.length;
    const seen = new Set<number>();
    allFeatures = [];
    let loaded = 0;

    const BATCH = 2; // gentler on slow connections / limited mirrors
    for (let i = 0; i < total; i += BATCH) {
        if (signal?.aborted) break;
        const batch = REGIONS.slice(i, i + BATCH);
        const results = await Promise.all(
            batch.map(({ name, bbox }) =>
                fetchRegion(name, bbox, signal ?? new AbortController().signal)
            )
        );

        const batchNew: CameraFeature[] = [];
        for (const regionFeatures of results) {
            for (const f of regionFeatures) {
                if (!seen.has(f.properties.id)) {
                    seen.add(f.properties.id);
                    allFeatures.push(f);
                    batchNew.push(f);
                }
            }
        }

        loaded = Math.min(i + BATCH, total);
        onProgress?.(loaded, total, allFeatures.length);
        if (batchNew.length > 0 && !signal?.aborted) {
            onBatch?.(batchNew);
            // Save each batch to Supabase in the background (non-blocking)
            upsertToSupabase(batchNew).catch(() => { /* non-fatal */ });
        }
        if (i + BATCH < total && !signal?.aborted) await delay(500);
    }

    await earthCamPromise; // Wait for Earthcam to finish if it hasn't already
    return { type: 'FeatureCollection', features: allFeatures };
};

export const fetchCameras = async (
    bounds: { south: number; west: number; north: number; east: number },
    signal?: AbortSignal,
): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => {
    const features = await fetchRegion(
        'viewport',
        [bounds.south, bounds.west, bounds.north, bounds.east],
        signal ?? new AbortController().signal,
    );
    return { type: 'FeatureCollection', features };
};
