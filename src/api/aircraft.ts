// Secondary lookups triggered on plane click — two free/open APIs:
//  1. hexdb.io    → registration, manufacturer, aircraft type/model
//  2. OpenSky     → departure / arrival airport ICAO codes for the current flight

export interface AircraftInfo {
    registration?: string;
    manufacturer?: string;
    model?: string;           // ICAO type code e.g. "B738"
    typeDescription?: string; // Human-readable e.g. "Land 2-Engine Jet"
    operator?: string;
}

export interface FlightRoute {
    departureIcao?: string;
    arrivalIcao?: string;
    departureTime?: number;   // unix timestamp
    arrivalTime?: number;
    callsign?: string;
}

/** Fetch static aircraft metadata from hexdb.io (no auth, generous rate limit) */
export async function fetchAircraftInfo(icao24: string): Promise<AircraftInfo> {
    try {
        const resp = await fetch(
            `/hexproxy/hex-data?hex=${icao24.toUpperCase()}`,
            { signal: AbortSignal.timeout(8_000) },
        );
        if (!resp.ok) return {};
        const d = await resp.json();
        return {
            registration: d.Registration || undefined,
            manufacturer: d.Manufacturer || undefined,
            model: d.Type || undefined,
            typeDescription: d.ICAOTypeDescription || undefined,
            operator: d.RegisteredOwners || undefined,
        };
    } catch {
        return {};
    }
}

/** Fetch the most recent flight record for an aircraft from OpenSky (no auth required) */
export async function fetchFlightRoute(icao24: string): Promise<FlightRoute> {
    const now = Math.floor(Date.now() / 1_000);
    const begin = now - 24 * 3_600; // last 24 h
    try {
        const resp = await fetch(
            `https://opensky-network.org/api/flights/aircraft` +
            `?icao24=${icao24.toLowerCase()}&begin=${begin}&end=${now}`,
            { signal: AbortSignal.timeout(8_000) },
        );
        if (!resp.ok) return {};
        const data = await resp.json() as Array<{
            estDepartureAirport?: string | null;
            estArrivalAirport?: string | null;
            firstSeen?: number;
            lastSeen?: number;
            callsign?: string;
        }>;
        if (!data?.length) return {};
        const latest = data[data.length - 1];
        return {
            departureIcao: latest.estDepartureAirport || undefined,
            arrivalIcao: latest.estArrivalAirport || undefined,
            departureTime: latest.firstSeen,
            arrivalTime: latest.lastSeen,
            callsign: latest.callsign?.trim() || undefined,
        };
    } catch {
        return {};
    }
}
