import type * as GeoJSON from 'geojson';

export const fetchEarthquakes = async (): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => {
    try {
        // Fetch all earthquakes from the past day
        const response = await fetch('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson');
        if (!response.ok) {
            throw new Error(`Failed to fetch earthquakes: ${response.status}`);
        }
        const data = await response.json();
        return data as GeoJSON.FeatureCollection<GeoJSON.Point>;
    } catch (error) {
        console.error('Error fetching earthquake data:', error);
        return { type: 'FeatureCollection', features: [] };
    }
};
