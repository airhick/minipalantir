import type * as GeoJSON from 'geojson';

export const fetchIssLocation = async (): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => {
    try {
        const response = await fetch('http://api.open-notify.org/iss-now.json');
        if (!response.ok) {
            throw new Error(`Failed to fetch ISS location: ${response.status}`);
        }
        const data = await response.json();

        if (data.message === 'success' && data.iss_position) {
            return {
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: {
                        type: 'Point',
                        coordinates: [
                            parseFloat(data.iss_position.longitude),
                            parseFloat(data.iss_position.latitude)
                        ]
                    },
                    properties: {
                        name: 'International Space Station',
                        timestamp: data.timestamp
                    }
                }]
            };
        }
        return { type: 'FeatureCollection', features: [] };
    } catch (error) {
        console.error('Error fetching ISS location:', error);
        return { type: 'FeatureCollection', features: [] };
    }
};
