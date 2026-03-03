import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { fetchAircraftInfo, fetchFlightRoute, type AircraftInfo, type FlightRoute } from '../api/aircraft';

export interface PlaneInfo {
    icao24: string;
    callsign: string;
    origin_country: string;
    altitude: number;   // metres
    velocity: number;   // m/s
    true_track: number; // degrees, clockwise from north
    lat: number;
    lon: number;
}

interface PlanePanelProps {
    plane: PlaneInfo | null;
    onClose: () => void;
}

function compassDir(deg: number): string {
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
        'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    return dirs[Math.round(deg / 22.5) % 16];
}

function Stat({ label, value, sub, wide }: {
    label: string; value: string; sub?: string; wide?: boolean;
}) {
    return (
        <div className={`px-3 py-2 bg-black/50 ${wide ? 'col-span-2' : ''}`}>
            <div className="text-[9px] text-[#00FF41]/50 tracking-widest uppercase mb-0.5">{label}</div>
            <div className="text-[#00FF41] font-bold tracking-wider truncate text-[11px]">{value}</div>
            {sub && <div className="text-[#00FF41]/50 text-[9px] truncate">{sub}</div>}
        </div>
    );
}

export default function PlanePanel({ plane, onClose }: PlanePanelProps) {
    const [aircraft, setAircraft] = useState<AircraftInfo>({});
    const [route, setRoute] = useState<FlightRoute>({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!plane) return;
        setAircraft({});
        setRoute({});
        setLoading(true);
        Promise.all([
            fetchAircraftInfo(plane.icao24),
            fetchFlightRoute(plane.icao24),
        ]).then(([ac, rt]) => {
            setAircraft(ac);
            setRoute(rt);
            setLoading(false);
        });
    }, [plane?.icao24]);

    if (!plane) return null;

    const altFt = Math.round((plane.altitude || 0) * 3.28084);
    const fl = Math.round(altFt / 100);
    const kts = Math.round((plane.velocity || 0) * 1.944);
    const kmh = Math.round((plane.velocity || 0) * 3.6);
    const heading = Math.round(plane.true_track || 0);

    const depTime = route.departureTime
        ? new Date(route.departureTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;
    const arrTime = route.arrivalTime
        ? new Date(route.arrivalTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;

    return (
        <div
            className="absolute top-6 right-6 z-50 w-72 font-mono text-xs overflow-hidden glass-panel border border-[#00FF41]"
            style={{ boxShadow: '0 0 24px rgba(0,255,65,0.25)' }}
        >
            {/* ── Header ── */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#00FF41]/40 bg-[#00FF41]/10">
                <div className="flex items-center gap-2">
                    <span className="text-[20px] leading-none">✈</span>
                    <div>
                        <div className="text-[#00FF41] font-bold tracking-widest text-sm">
                            {plane.callsign?.trim() || plane.icao24.toUpperCase()}
                        </div>
                        <div className="text-[#00FF41]/50 text-[9px] tracking-widest">
                            ICAO24 // {plane.icao24.toUpperCase()}
                        </div>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="text-[#00FF41]/60 hover:text-[#00FF41] transition-colors"
                    aria-label="Close"
                >
                    <X size={15} />
                </button>
            </div>

            {/* ── Route bar ── */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#00FF41]/20 bg-black/30">
                {/* Origin */}
                <div className="text-center w-16">
                    <div className="text-[#00FF41] font-bold text-base tracking-widest">
                        {route.departureIcao || (loading ? '···' : '????')}
                    </div>
                    {depTime && <div className="text-[#00FF41]/50 text-[9px] mt-0.5">{depTime}</div>}
                </div>

                {/* Line */}
                <div className="flex-1 flex items-center gap-1 px-1">
                    <div className="flex-1 border-t border-dashed border-[#00FF41]/30" />
                    <span className="text-[11px] text-[#00FF41]/70">✈</span>
                    <div className="flex-1 border-t border-dashed border-[#00FF41]/30" />
                </div>

                {/* Destination */}
                <div className="text-center w-16">
                    <div className="text-[#00FF41] font-bold text-base tracking-widest">
                        {route.arrivalIcao || (loading ? '···' : '????')}
                    </div>
                    {arrTime && <div className="text-[#00FF41]/50 text-[9px] mt-0.5">{arrTime}</div>}
                </div>
            </div>

            {/* ── Data grid ── */}
            <div className="grid grid-cols-2 gap-px bg-[#00FF41]/10">
                <Stat label="Altitude" value={`FL${String(fl).padStart(3, '0')}`} sub={`${altFt.toLocaleString()} ft`} />
                <Stat label="Speed" value={`${kts} KTS`} sub={`${kmh} km/h`} />
                <Stat label="Heading" value={`${heading}°`} sub={compassDir(plane.true_track)} />
                <Stat label="Country" value={plane.origin_country || '—'} />
                {aircraft.registration && (
                    <Stat label="Reg." value={aircraft.registration} />
                )}
                {aircraft.model && (
                    <Stat label="Type" value={aircraft.model} sub={aircraft.manufacturer} />
                )}
                {aircraft.operator && (
                    <Stat label="Operator" value={aircraft.operator} wide />
                )}
                <Stat label="Position"
                    value={`${plane.lat.toFixed(3)}°, ${plane.lon.toFixed(3)}°`}
                    wide
                />
            </div>

            {/* ── Loading indicator ── */}
            {loading && (
                <div className="flex items-center gap-2 px-3 py-2 border-t border-[#00FF41]/10 bg-black/30">
                    <div className="w-1.5 h-1.5 bg-[#00FF41] rounded-full animate-ping" />
                    <span className="text-[9px] text-[#00FF41]/50 tracking-widest">QUERYING FLIGHT DATABASE…</span>
                </div>
            )}
        </div>
    );
}
