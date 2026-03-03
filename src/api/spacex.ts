import type * as GeoJSON from 'geojson';

export const fetchSpaceXLaunches = async (): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => {
    try {
        // Fetch all SpaceX launchpads to plot their infrastructure globally
        const response = await fetch('https://api.spacexdata.com/v4/launchpads');
        if (!response.ok) {
            throw new Error(`Failed to fetch SpaceX Launchpads: ${response.status}`);
        }
        const data = await response.json();

        const features: GeoJSON.Feature<GeoJSON.Point>[] = data.map((pad: Record<string, unknown>) => {
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [pad.longitude, pad.latitude]
                },
                properties: {
                    id: pad.id,
                    name: pad.name,
                    fullName: pad.full_name,
                    status: pad.status,
                    region: pad.region,
                    launches: pad.launch_attempts,
                    successes: pad.launch_successes
                }
            };
        });

        return {
            type: 'FeatureCollection',
            features
        };
    } catch (error) {
        console.error('Error fetching SpaceX data:', error);
        return { type: 'FeatureCollection', features: [] };
    }
};
