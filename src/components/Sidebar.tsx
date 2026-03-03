import React from 'react';
import { Plane, Video, Mountain, Activity, Rocket, Wind, Globe2, Satellite, Terminal } from 'lucide-react';

interface SidebarProps {
    layers: {
        planes: boolean;
        cameras: boolean;
        terrain: boolean;
        earthquakes: boolean;
        iss: boolean;
        openaq: boolean;
        countries: boolean;
        spacex: boolean;
    };
    toggleLayer: (layer: 'planes' | 'cameras' | 'terrain' | 'earthquakes' | 'iss' | 'openaq' | 'countries' | 'spacex') => void;
    planesCount: number;
    camerasCount: number;
    earthquakesCount: number;
    openaqCount: number;
    countriesCount: number;
    spacexCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({
    layers,
    toggleLayer,
    planesCount,
    camerasCount,
    earthquakesCount,
    openaqCount,
    countriesCount,
    spacexCount
}) => {
    return (
        <div className="absolute top-4 left-4 w-80 flex flex-col gap-4 z-10 pointer-events-none font-mono">

            {/* Header Panel */}
            <div className="glass-panel p-5 pointer-events-auto border-l-4 border-l-[#00FF41]">
                <h1 className="text-xl font-bold text-[#00FF41] flex items-center gap-2 drop-shadow-[0_0_8px_rgba(0,255,65,0.8)] tracking-wider uppercase">
                    <Terminal className="text-[#00FF41]" size={20} />
                    OS // PALANTIR
                </h1>
                <p className="text-xs text-[#008F11] mt-2 uppercase tracking-widest break-all">
                    root@system:~/monitoring$ _
                </p>
            </div>

            {/* Control Panel */}
            <div className="glass-panel p-5 flex flex-col gap-3 pointer-events-auto">
                <h2 className="text-xs font-bold text-[#008F11] uppercase tracking-widest mb-2 border-b border-[#008F11]/30 pb-2">
                    [ Data_Modules ]
                </h2>

                {/* Planes Toggle */}
                <button
                    onClick={() => toggleLayer('planes')}
                    className={`glass-button w-full flex items-center justify-between p-3 ${layers.planes ? 'active' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <Plane size={16} className={layers.planes ? 'text-[#00FF41]' : 'text-[#008F11]'} />
                        <span className="text-xs">AIRCRAFT_SYS</span>
                    </div>
                    <span className="text-[10px] bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] px-2 py-0.5">{planesCount}</span>
                </button>

                {/* Cameras Toggle */}
                <button
                    onClick={() => toggleLayer('cameras')}
                    className={`glass-button w-full flex items-center justify-between p-3 ${layers.cameras ? 'active' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <Video size={16} className={layers.cameras ? 'text-[#00FF41]' : 'text-[#008F11]'} />
                        <span className="text-xs">CCTV_FEED</span>
                    </div>
                    <span className="text-[10px] bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] px-2 py-0.5">{camerasCount}</span>
                </button>

                {/* Earthquakes Toggle */}
                <button
                    onClick={() => toggleLayer('earthquakes')}
                    className={`glass-button w-full flex items-center justify-between p-3 ${layers.earthquakes ? 'active' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <Activity size={16} className={layers.earthquakes ? 'text-[#00FF41]' : 'text-[#008F11]'} />
                        <span className="text-xs">SEISMIC_DATA</span>
                    </div>
                    <span className="text-[10px] bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] px-2 py-0.5">{earthquakesCount}</span>
                </button>

                {/* ISS Toggle */}
                <button
                    onClick={() => toggleLayer('iss')}
                    className={`glass-button w-full flex items-center justify-between p-3 ${layers.iss ? 'active' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <Rocket size={16} className={layers.iss ? 'text-[#00FF41]' : 'text-[#008F11]'} />
                        <span className="text-xs">ORBITAL_ISS</span>
                    </div>
                </button>

                {/* OpenAQ Toggle */}
                <button
                    onClick={() => toggleLayer('openaq')}
                    className={`glass-button w-full flex items-center justify-between p-3 ${layers.openaq ? 'active' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <Wind size={16} className={layers.openaq ? 'text-[#00FF41]' : 'text-[#008F11]'} />
                        <span className="text-xs">ATMOS_POLLUTION</span>
                    </div>
                    <span className="text-[10px] bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] px-2 py-0.5">{openaqCount}</span>
                </button>

                <hr className="border-[#008F11]/30 my-1" />

                {/* Countries / Weather Toggle */}
                <button
                    onClick={() => toggleLayer('countries')}
                    className={`glass-button w-full flex items-center justify-between p-3 ${layers.countries ? 'active' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <Globe2 size={16} className={layers.countries ? 'text-[#00FF41]' : 'text-[#008F11]'} />
                        <span className="text-xs">GEO_REGIONS</span>
                    </div>
                    <span className="text-[10px] bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] px-2 py-0.5">{countriesCount}</span>
                </button>

                {/* SpaceX Toggle */}
                <button
                    onClick={() => toggleLayer('spacex')}
                    className={`glass-button w-full flex items-center justify-between p-3 ${layers.spacex ? 'active' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <Satellite size={16} className={layers.spacex ? 'text-[#00FF41]' : 'text-[#008F11]'} />
                        <span className="text-xs">SPACEX_SITES</span>
                    </div>
                    <span className="text-[10px] bg-[#00FF41]/10 border border-[#00FF41]/30 text-[#00FF41] px-2 py-0.5">{spacexCount}</span>
                </button>

                {/* Terrain Toggle */}
                <button
                    onClick={() => toggleLayer('terrain')}
                    className={`glass-button w-full flex items-center justify-between p-3 border-dashed ${layers.terrain ? 'active' : ''}`}
                >
                    <div className="flex items-center gap-3">
                        <Mountain size={16} className={layers.terrain ? 'text-[#00FF41]' : 'text-[#008F11]'} />
                        <span className="text-xs">LIDAR_TERRAIN</span>
                    </div>
                </button>
            </div>

            {/* Status Panel */}
            <div className="glass-panel p-3 pointer-events-auto flex items-center gap-3 border-l-4 border-l-[#00FF41]">
                <div className="w-2 h-2 rounded-none bg-[#00FF41] animate-pulse shadow-[0_0_8px_#00FF41]" />
                <span className="text-[10px] text-[#00FF41] tracking-widest uppercase">CONNECTION_SECURE</span>
                <span className="ml-auto text-[10px] text-[#008F11]">v1.0.9</span>
            </div>

        </div>
    );
};

export default Sidebar;
