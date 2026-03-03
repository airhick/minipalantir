import type * as GeoJSON from 'geojson';

export interface PlaneFeature {
    type: 'Feature';
    geometry: {
        type: 'Point';
        coordinates: [number, number]; // [lng, lat]
    };
    properties: {
        icao24: string;
        callsign: string;
        origin_country: string;
        velocity: number;
        true_track: number;
        altitude: number;
    };
}

export const fetchPlanes = async (): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => {
    try {
        // Abort if OpenSky takes more than 15 s (common on slow connections)
        const response = await fetch('https://opensky-network.org/api/states/all', {
            signal: AbortSignal.timeout(15_000),
        });
        if (!response.ok) {
            throw new Error(`OpenSky API error: ${response.status}`);
        }
        const data = await response.json();

        // Each state: [icao24, callsign, origin_country, time_position, last_contact,
        //              longitude, latitude, baro_altitude, on_ground, velocity,
        //              true_track, vertical_rate, sensors, geo_altitude, squawk, spi, position_source]
        const features: PlaneFeature[] = (data.states || [])
            .filter((state: (string | number | boolean | null)[]) =>
                state[5] !== null && state[6] !== null && !state[8]) // must have coords, not on ground
            .slice(0, 2000) // reduced from 5000 → 2000 for performance
            .map((state: (string | number | boolean | null)[]) => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [state[5], state[6]],
                },
                properties: {
                    icao24: state[0],
                    callsign: typeof state[1] === 'string' ? state[1].trim() : String(state[1] || 'UNKNOWN'),
                    origin_country: state[2],
                    altitude: state[7] || state[13] || 0,
                    velocity: state[9] || 0,
                    true_track: state[10] || 0,
                },
            }));

        return { type: 'FeatureCollection', features };
    } catch (error) {
        console.error('Error fetching planes:', error);
        return { type: 'FeatureCollection', features: [] };
    }
};
