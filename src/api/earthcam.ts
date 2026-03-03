import type { CameraFeature } from './cameras';

const EARTHCAM_API_URL = 'https://www.earthcam.com/api/mapsearch/get_locations_network.php?r=ecn&a=fetch';

export async function fetchEarthCam(signal?: AbortSignal): Promise<CameraFeature[]> {
    try {
        const resp = await fetch(EARTHCAM_API_URL, {
            signal: signal ? (AbortSignal as any).any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000),
        });

        if (!resp.ok) return [];
        const json = await resp.json();
        const apiData = json.data?.[0]?.places;

        if (!Array.isArray(apiData)) return [];

        return apiData.map((place: any) => {
            const lat = parseFloat(place.posn[0]);
            const lon = parseFloat(place.posn[1]);

            // Generate a deterministic integer ID from the hex ID string (e.g. "9d4ed...") or a fallback
            const idInt = place.id ? Math.abs(hashCode(place.id)) : Math.floor(Math.random() * 1000000000);

            return {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lon, lat] },
                properties: {
                    id: -idInt, // Use negative to avoid collisons with standard OSM IDs
                    surveillance_type: 'public',
                    camera_type: 'earthcam',
                    name: place.name || undefined,
                    url: place.url || undefined,
                    operator: 'EarthCam',
                    city: place.location || place.city || undefined,
                    thumbnail: place.thumbnail || undefined,
                },
            } as CameraFeature;
        });
    } catch (err) {
        console.error('Failed to fetch EarthCam data:', err);
        return [];
    }
}

// Simple hash function for generating IDs
function hashCode(str: string) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        const chr = str.charCodeAt(i);
        hash = (hash << 5) - hash + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
}
