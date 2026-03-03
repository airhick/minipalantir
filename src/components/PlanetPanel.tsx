import { X } from 'lucide-react';
import type { PlanetInfo } from '../api/planets';

interface PlanetPanelProps {
    planet: PlanetInfo | null;
    onClose: () => void;
}

function fmt(n: number, decimals = 2): string {
    return n.toLocaleString('en-US', { maximumFractionDigits: decimals });
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

// Relative planet size bar (vs Jupiter = 1.0)
function SizeBar({ radius }: { radius: number }) {
    const max = 71_492; // Jupiter
    const pct = Math.min((radius / max) * 100, 100);
    return (
        <div className="flex items-center gap-2 px-3 pb-2">
            <div className="flex-1 h-1.5 bg-[#00FF41]/10 rounded-full overflow-hidden">
                <div
                    className="h-full bg-[#00FF41] rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-[9px] text-[#00FF41]/40 w-10 text-right">
                {pct < 1 ? '<1' : Math.round(pct)}% of ♃
            </span>
        </div>
    );
}

export default function PlanetPanel({ planet, onClose }: PlanetPanelProps) {
    if (!planet) return null;
    const d = planet.data;

    const dist_km = planet.distanceFromEarth_au * 149_597_870.7;
    const light_min = dist_km / (299_792.458 * 60);

    // Relative day length
    const absRot = Math.abs(d.rotation_hours);
    const rotLabel = absRot > 24
        ? `${fmt(absRot / 24)} Earth days`
        : `${fmt(absRot)} h`;
    const retroNote = d.rotation_hours < 0 ? ' (retrograde)' : '';

    const orbitYears = d.orbit_period_days / 365.25;

    const PLANET_COLORS: Record<string, string> = {
        MERCURY: '#9e9e9e', VENUS: '#f5deb3', MARS: '#c1440e',
        JUPITER: '#d4a860', SATURN: '#e8d080', URANUS: '#7fffd4', NEPTUNE: '#3a7bd5',
    };
    const color = PLANET_COLORS[planet.name] || '#00FF41';

    return (
        <div
            className="absolute top-6 right-6 z-50 w-80 font-mono text-xs overflow-hidden glass-panel"
            style={{ border: `1px solid ${color}80`, boxShadow: `0 0 24px ${color}30` }}
        >
            {/* ── Header ── */}
            <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: `${color}40`, background: `${color}18` }}
            >
                <div>
                    <div className="font-bold tracking-widest text-base" style={{ color }}>
                        {d.name.toUpperCase()}
                    </div>
                    <div className="text-[9px] tracking-widest" style={{ color: `${color}80` }}>
                        SOLAR SYSTEM // PLANET {['MERCURY', 'VENUS', 'MARS', 'JUPITER', 'SATURN', 'URANUS', 'NEPTUNE'].indexOf(planet.name) + 4}
                    </div>
                </div>
                <button onClick={onClose} style={{ color: `${color}80` }}
                    className="hover:opacity-100 transition-opacity" aria-label="Close">
                    <X size={15} />
                </button>
            </div>

            {/* ── Size bar ── */}
            <div className="pt-2" style={{ borderBottom: `1px solid ${color}20` }}>
                <div className="px-3 pb-1 text-[9px] tracking-widest" style={{ color: `${color}50` }}>
                    SIZE RELATIVE TO JUPITER
                </div>
                <SizeBar radius={d.radius_km} />
            </div>

            {/* ── Data grid ── */}
            <div className="grid grid-cols-2 gap-px" style={{ background: `${color}10` }}>
                <Stat label="Radius" value={`${fmt(d.radius_km, 0)} km`}
                    sub={`${fmt(d.radius_km / 6_371, 2)} × Earth`} />
                <Stat label="Surface Gravity" value={`${d.surface_gravity_mps2} m/s²`}
                    sub={`${fmt(d.surface_gravity_mps2 / 9.807, 2)} g`} />
                <Stat label="Orbital Speed" value={`${d.orbital_speed_kmps} km/s`}
                    sub={`${fmt(d.orbital_speed_kmps * 3_600, 0)} km/h`} />
                <Stat label="Orbit Period" value={orbitYears < 2 ? `${fmt(d.orbit_period_days)} days` : `${fmt(orbitYears, 1)} years`} />
                <Stat label="Day Length" value={rotLabel} sub={retroNote || undefined} />
                <Stat label="Avg Temperature" value={`${d.avg_temp_c > 0 ? '+' : ''}${d.avg_temp_c}°C`} />
                <Stat label="Distance (Now)" value={`${fmt(dist_km / 1_000_000, 1)}M km`}
                    sub={`${fmt(planet.distanceFromEarth_au, 3)} AU · ${fmt(light_min, 1)} light-min`} />
                <Stat label="From Sun" value={`${d.distance_from_sun_au} AU`}
                    sub={`${fmt(d.distance_from_sun_au * 149.6, 0)}M km`} />
                <Stat label="Mass" value={`${d.mass_kg.toExponential(3)} kg`} />
                <Stat label="Moons" value={d.moons === 0 ? 'None' : `${d.moons}`} />
                <Stat label="Atmosphere" value={d.atmosphere} wide />
            </div>

            {/* ── Description ── */}
            <div className="px-3 py-2 text-[9px] leading-relaxed"
                style={{ color: `${color}80`, borderTop: `1px solid ${color}20` }}>
                {d.description}
            </div>
        </div>
    );
}
