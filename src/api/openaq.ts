import type * as GeoJSON from 'geojson';

export const fetchOpenAQ = async (): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => {
    try {
        // OpenAQ v2 API for latest measurements
        // Note: Without an API key, we might hit strict rate limits. Adding a limit parameter to avoid huge payloads.
        const response = await fetch('https://corsproxy.io/?' + encodeURIComponent('https://api.openaq.org/v2/latest?limit=1000&has_geo=true'));
        if (!response.ok) {
            throw new Error(`Failed to fetch OpenAQ data: ${response.status}`);
        }
        const data = await response.json();

        const features: GeoJSON.Feature<GeoJSON.Point>[] = data.results
            .filter((result: Record<string, unknown>) => {
                const coords = result.coordinates as { longitude?: number; latitude?: number } | undefined;
                return coords?.longitude && coords?.latitude;
            })
            .map((result: Record<string, unknown>) => {
                // Determine a primary measurement to display (e.g., pm25, pm10, o3, etc.)
                // Fallback to the first available measurement
                const measurements = (result.measurements as Record<string, unknown>[]) || [];
                const primaryMeasurement = measurements.find((m: Record<string, unknown>) => m.parameter === 'pm25') || measurements[0];
                const coords = result.coordinates as { longitude: number; latitude: number };

                return {
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [coords.longitude, coords.latitude]
                    },
                    properties: {
                        location: result.location,
                        city: result.city,
                        country: result.country,
                        parameter: primaryMeasurement?.parameter,
                        value: primaryMeasurement?.value,
                        unit: primaryMeasurement?.unit,
                        lastUpdated: primaryMeasurement?.lastUpdated
                    }
                };
            });

        return {
            type: 'FeatureCollection',
            features
        };
    } catch (error) {
        console.error('Error fetching OpenAQ data:', error);
        return { type: 'FeatureCollection', features: [] };
    }
};
