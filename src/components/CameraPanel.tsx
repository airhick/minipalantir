import React, { useEffect, useState } from 'react';
import { Video, X, ExternalLink, WifiOff } from 'lucide-react';

interface CameraInfo {
    id: number;
    name?: string;
    city?: string;
    operator?: string;
    surveillance_type: string;
    url?: string;
    lat: number;
    lon: number;
    thumbnail?: string;
}

interface CameraPanelProps {
    camera: CameraInfo | null;
    onClose: () => void;
}

const CameraPanel: React.FC<CameraPanelProps> = ({ camera, onClose }) => {
    const [imgError, setImgError] = useState(false);

    // Removed 15s tick reloader — the backend now only returns true live streams 
    // or push MJPEGs, meaning the browser will keep the connection open and auto-update
    // the frame itself, eliminating the flashing caused by discrete snapshot reloading.
    useEffect(() => {
        setImgError(false);
    }, [camera]);

    if (!camera) return null;

    const isYoutube = camera.url && (camera.url.includes('youtube.com') || camera.url.includes('youtu.be'));
    const isRtsp = camera.url && camera.url.startsWith('rtsp://');
    const isHttp = camera.url && (camera.url.startsWith('http://') || camera.url.startsWith('https://'));
    const isImage = isHttp && !isYoutube &&
        (camera.url!.match(/\.(jpg|jpeg|png|gif|webp|mjpg|mjpeg)(\?|$)/i) ||
            camera.url!.includes('/snapshot') || camera.url!.includes('/mjpg') ||
            camera.url!.includes('/video') || camera.url!.includes('/cam'));

    // Youtube embed
    let embedUrl: string | null = null;
    if (isYoutube && camera.url) {
        const match = camera.url.match(/(?:v=|youtu\.be\/)([^&?/]+)/);
        if (match) embedUrl = `https://www.youtube.com/embed/${match[1]}?autoplay=1&mute=1`;
    }

    const displayName = camera.name || `CAM_${camera.id}`;
    const displayCity = camera.city || 'UNKNOWN';

    return (
        <div
            className="absolute bottom-6 right-16 z-50 w-[600px] font-mono pointer-events-auto shadow-2xl"
            style={{ filter: 'drop-shadow(0 0 20px rgba(8,247,254,0.6))' }}
        >
            {/* Header */}
            <div className="bg-black/90 backdrop-blur-md border border-[#08F7FE] border-b-0 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Video size={16} className="text-[#08F7FE] animate-pulse" />
                    <span className="text-sm font-bold tracking-widest text-[#08F7FE] uppercase shadow-text">CCTV_FEED</span>
                </div>
                <button onClick={onClose} className="text-[#08F7FE]/60 hover:text-[#08F7FE] hover:bg-[#08F7FE]/20 p-1 rounded transition-colors cursor-pointer">
                    <X size={18} />
                </button>
            </div>

            {/* Feed window */}
            <div className="bg-black border border-[#08F7FE] aspect-video relative overflow-hidden">
                {/* Scanline overlay for hacker aesthetic */}
                <div
                    className="absolute inset-0 z-10 pointer-events-none"
                    style={{
                        background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)',
                    }}
                />

                {embedUrl ? (
                    <>
                        <div className="absolute top-3 right-4 z-30 flex items-center gap-2 px-2 py-1 bg-red-600/80 backdrop-blur border border-red-400 rounded-sm">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-bold text-white tracking-widest uppercase shadow-text">EN DIRECT</span>
                        </div>
                        <iframe
                            src={embedUrl}
                            className="w-full h-full border-0 relative z-20"
                            allow="autoplay; encrypted-media"
                            allowFullScreen
                        />
                    </>
                ) : camera.thumbnail ? (
                    <>
                        <div className="absolute top-3 right-4 z-30 flex items-center gap-2 px-2 py-1 bg-[#08F7FE]/20 backdrop-blur border border-[#08F7FE]/40 rounded-sm">
                            <span className="text-[10px] font-bold text-[#08F7FE] tracking-widest uppercase shadow-text">PROXY_REQUIRED</span>
                        </div>
                        <div className="w-full h-full relative z-20 group">
                            <img
                                src={camera.thumbnail}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                                alt="Camera thumbnail"
                            />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <a
                                    href={camera.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 border border-[#08F7FE] text-[#08F7FE] hover:bg-[#08F7FE]/20 hover:shadow-[0_0_15px_rgba(8,247,254,0.5)] transition-all uppercase tracking-widest text-xs"
                                >
                                    <ExternalLink size={14} />
                                    OPEN EARTHCAM PLAYER
                                </a>
                            </div>
                        </div>
                    </>
                ) : isImage && !imgError ? (
                    <>
                        <div className="absolute top-3 right-4 z-30 flex items-center gap-2 px-2 py-1 bg-red-600/80 backdrop-blur border border-red-400 rounded-sm">
                            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                            <span className="text-[10px] font-bold text-white tracking-widest uppercase shadow-text">EN DIRECT</span>
                        </div>
                        <img
                            src={camera.url} // Loading the direct stream URL without refresh ticks
                            className="w-full h-full object-cover relative z-20"
                            onError={() => setImgError(true)}
                            alt="Camera feed"
                        />
                    </>
                ) : (
                    /* Feed unavailable — stylized placeholder */
                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#000a0a] gap-3 relative z-20">
                        <WifiOff size={28} className="text-[#08F7FE]/40" />
                        <div className="text-center">
                            <div className="text-[9px] text-[#08F7FE]/60 tracking-widest uppercase mb-1">STREAM UNAVAILABLE</div>
                            <div className="text-[8px] text-[#08F7FE]/30 tracking-widest">
                                {isRtsp ? 'RTSP :: DIRECT_CONNECT_REQUIRED' : 'NO_STREAM_URL_INDEXED'}
                            </div>
                        </div>
                        {camera.url && !isRtsp && (
                            <a
                                href={camera.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-[9px] text-[#08F7FE] hover:text-white transition-colors border border-[#08F7FE]/30 px-2 py-1"
                            >
                                <ExternalLink size={9} />
                                OPEN_SOURCE
                            </a>
                        )}
                    </div>
                )}

                {/* Corner markers */}
                {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                    <div key={i} className={`absolute ${pos} w-3 h-3 z-20 pointer-events-none`}
                        style={{
                            borderTop: i < 2 ? '1px solid #08F7FE' : 'none',
                            borderBottom: i >= 2 ? '1px solid #08F7FE' : 'none',
                            borderLeft: i % 2 === 0 ? '1px solid #08F7FE' : 'none',
                            borderRight: i % 2 === 1 ? '1px solid #08F7FE' : 'none',
                        }} />
                ))}
            </div>

            {/* Camera info text at the bottom */}
            <div className="bg-black/95 backdrop-blur-md border border-[#08F7FE] border-t-0 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs text-[#08F7FE] tracking-widest truncate uppercase font-bold">{displayName}</span>
                    <span className="text-[10px] bg-[#008F11]/20 border border-[#008F11] text-[#00FF41] px-2 py-0.5 rounded-sm shrink-0">{camera.surveillance_type}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[#00FF41]/80 tracking-wider">
                    <span>📍 {camera.lat.toFixed(5)}, {camera.lon.toFixed(5)}</span>
                    <span className="ml-auto text-[#08F7FE]/80">{displayCity.toUpperCase()}</span>
                </div>
                {camera.operator && (
                    <div className="text-[9px] text-[#008F11]/60 tracking-wider truncate">OP_TRACE: {camera.operator.toUpperCase()}</div>
                )}
            </div>
        </div>
    );
};

export default CameraPanel;
export type { CameraInfo };
