import type * as GeoJSON from 'geojson';

export const fetchCountriesWithWeather = async (): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> => {
    try {
        // 1. Fetch all countries
        const countriesRes = await fetch('https://restcountries.com/v3.1/all?fields=name,capitalInfo,population,region');
        if (!countriesRes.ok) {
            throw new Error(`Failed to fetch Countries: ${countriesRes.status}`);
        }
        const countriesData = await countriesRes.json();

        // We only want countries that have valid capital coordinates 
        // to map them as points on the globe, rather than attempting complex polygons.
        const validCountries = countriesData.filter((c: Record<string, unknown>) => {
            const capitalInfo = c.capitalInfo as { latlng?: [number, number] };
            return capitalInfo && capitalInfo.latlng && capitalInfo.latlng.length === 2;
        });

        // Map into GeoJSON points
        const features: GeoJSON.Feature<GeoJSON.Point>[] = validCountries.map((country: Record<string, unknown>) => {
            const capitalInfo = country.capitalInfo as { latlng: [number, number] };
            const name = country.name as { common: string };
            return {
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    // REST Countries returns [lat, lng], GeoJSON requires [lng, lat]
                    coordinates: [capitalInfo.latlng[1], capitalInfo.latlng[0]]
                },
                properties: {
                    name: name.common,
                    population: country.population,
                    region: country.region,
                    // Weather data starts empty, will be fetched on demand (e.g. on click) to save 200+ API calls
                    temperature: null,
                    windspeed: null
                }
            };
        });

        return {
            type: 'FeatureCollection',
            features
        };
    } catch (error) {
        console.error('Error fetching Countries data:', error);
        return { type: 'FeatureCollection', features: [] };
    }
};

export const fetchWeatherForLocation = async (lat: number, lng: number): Promise<unknown> => {
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
        if (!res.ok) throw new Error('Failed to fetch weather');
        const data = await res.json();
        return data.current_weather;
    } catch (error) {
        console.error('Weather fetch error:', error);
        return null;
    }
};
