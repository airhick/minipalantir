import { useState, useEffect, useRef } from 'react';
import type * as GeoJSON from 'geojson';
import CesiumGlobe from './components/CesiumGlobe';
import Sidebar from './components/Sidebar';
import CameraPanel from './components/CameraPanel';
import PlanePanel from './components/PlanePanel';
import PlanetPanel from './components/PlanetPanel';
import type { CameraInfo } from './components/CameraPanel';
import type { PlaneInfo } from './components/PlanePanel';
import type { PlanetInfo } from './api/planets';
import { fetchPlanes } from './api/planes';
import { fetchGlobalCameras } from './api/cameras';
import { fetchEarthquakes } from './api/earthquakes';
import { fetchIssLocation } from './api/iss';
import { fetchOpenAQ } from './api/openaq';
import { fetchCountriesWithWeather } from './api/countries';
import { fetchSpaceXLaunches } from './api/spacex';

interface LayersState {
  planes: boolean;
  cameras: boolean;
  terrain: boolean;
  earthquakes: boolean;
  iss: boolean;
  openaq: boolean;
  countries: boolean;
  spacex: boolean;
}

function App() {
  const [layers, setLayers] = useState<LayersState>({
    planes: false,
    cameras: false,
    terrain: true,
    earthquakes: false,
    iss: false,
    openaq: false,
    countries: false,
    spacex: false,
  });

  const [planesData, setPlanesData] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: 'FeatureCollection',
    features: [],
  });

  const [camerasData, setCamerasData] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: 'FeatureCollection',
    features: [],
  });

  const [earthquakesData, setEarthquakesData] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: 'FeatureCollection',
    features: [],
  });

  const [issData, setIssData] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: 'FeatureCollection',
    features: [],
  });

  const [openaqData, setOpenaqData] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: 'FeatureCollection',
    features: [],
  });

  const [countriesData, setCountriesData] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: 'FeatureCollection',
    features: [],
  });

  const [spacexData, setSpacexData] = useState<GeoJSON.FeatureCollection<GeoJSON.Point>>({
    type: 'FeatureCollection',
    features: [],
  });

  const [cameraLoading, setCameraLoading] = useState<{ loaded: number; total: number; count?: number } | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<CameraInfo | null>(null);
  const [selectedPlane, setSelectedPlane] = useState<PlaneInfo | null>(null);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetInfo | null>(null);

  // Keep a ref to cameras AbortController so we can cancel on toggle-off
  const cameraAbortRef = useRef<AbortController | null>(null);

  // Fetch global cameras when layer is toggled on.
  // Positions are streamed to the globe immediately after each batch of regions
  // via onBatch — dots appear as data arrives rather than all at once at the end.
  // The video feed is only loaded when the user clicks a dot (CameraPanel is lazy).
  useEffect(() => {
    if (!layers.cameras) {
      // Cancel any in-flight camera requests immediately
      if (cameraAbortRef.current) {
        cameraAbortRef.current.abort();
        cameraAbortRef.current = null;
      }
      setCamerasData({ type: 'FeatureCollection', features: [] });
      setCameraLoading(null);
      return;
    }

    const controller = new AbortController();
    cameraAbortRef.current = controller;

    // Reset to empty before loading so stale data doesn't linger
    setCamerasData({ type: 'FeatureCollection', features: [] });
    setCameraLoading({ loaded: 0, total: 42, count: 0 });

    fetchGlobalCameras(
      // onProgress: update the loading bar
      (loaded, total, count) => setCameraLoading({ loaded, total, count }),
      controller.signal,
      // onBatch: merge new positions into the globe immediately
      (newFeatures) => {
        if (!controller.signal.aborted) {
          setCamerasData(prev => ({
            type: 'FeatureCollection',
            features: [...prev.features, ...newFeatures],
          }));
        }
      },
    )
      .then(() => {
        if (!controller.signal.aborted) {
          setCameraLoading(null);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setCameraLoading(null);
      });

    return () => {
      controller.abort();
      cameraAbortRef.current = null;
    };
  }, [layers.cameras]);

  // Fetch planes periodically if layer is active
  useEffect(() => {
    if (!layers.planes) {
      setPlanesData({ type: 'FeatureCollection', features: [] });
      return;
    }

    let cancelled = false;
    let interval: number;

    const loadPlanes = async () => {
      const data = await fetchPlanes();
      if (!cancelled) setPlanesData(data);
    };

    loadPlanes();
    // 30s refresh — OpenSky data updates every 10-15s anyway; saves requests on slow connections
    interval = window.setInterval(loadPlanes, 30_000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      setPlanesData({ type: 'FeatureCollection', features: [] });
    };
  }, [layers.planes]);

  // Fetch ISS periodically if layer is active
  useEffect(() => {
    if (!layers.iss) {
      setIssData({ type: 'FeatureCollection', features: [] });
      return;
    }

    let cancelled = false;
    let interval: number;

    const loadIss = async () => {
      const data = await fetchIssLocation();
      if (!cancelled) setIssData(data);
    };

    loadIss();
    // 15s refresh — ISS moves ~7 km/s, still very visible at this interval
    interval = window.setInterval(loadIss, 15_000);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      setIssData({ type: 'FeatureCollection', features: [] });
    };
  }, [layers.iss]);

  // Fetch Earthquakes once when layer is toggled on (updates daily)
  useEffect(() => {
    if (!layers.earthquakes) {
      setEarthquakesData({ type: 'FeatureCollection', features: [] });
      return;
    }
    let cancelled = false;
    fetchEarthquakes().then(data => {
      if (!cancelled) setEarthquakesData(data);
    });
    return () => { cancelled = true; };
  }, [layers.earthquakes]);

  // Fetch OpenAQ once when layer is toggled on
  useEffect(() => {
    if (!layers.openaq) {
      setOpenaqData({ type: 'FeatureCollection', features: [] });
      return;
    }
    let cancelled = false;
    fetchOpenAQ().then(data => {
      if (!cancelled) setOpenaqData(data);
    });
    return () => { cancelled = true; };
  }, [layers.openaq]);

  // Fetch Countries once when layer is toggled on
  useEffect(() => {
    if (!layers.countries) {
      setCountriesData({ type: 'FeatureCollection', features: [] });
      return;
    }
    let cancelled = false;
    fetchCountriesWithWeather().then(data => {
      if (!cancelled) setCountriesData(data);
    });
    return () => { cancelled = true; };
  }, [layers.countries]);

  // Fetch SpaceX once when layer is toggled on
  useEffect(() => {
    if (!layers.spacex) {
      setSpacexData({ type: 'FeatureCollection', features: [] });
      return;
    }
    let cancelled = false;
    fetchSpaceXLaunches().then(data => {
      if (!cancelled) setSpacexData(data);
    });
    return () => { cancelled = true; };
  }, [layers.spacex]);

  const toggleLayer = (layer: keyof LayersState) => {
    setLayers((prev) => ({
      ...prev,
      [layer]: !prev[layer],
    }));
  };

  const handleBoundsChange = (_bounds: { south: number; west: number; north: number; east: number }, _zoomLevel: number) => {
    // Cameras are loaded globally — no viewport-based re-fetch needed
  };

  return (
    <div className="relative w-screen h-screen bg-black overflow-hidden scanlines font-mono z-0">
      <div className="absolute inset-0 pointer-events-none z-10">
        <CesiumGlobe
          layers={layers}
          planesData={planesData}
          camerasData={camerasData}
          earthquakesData={earthquakesData}
          issData={issData}
          openaqData={openaqData}
          countriesData={countriesData}
          spacexData={spacexData}
          onBoundsChange={handleBoundsChange}
          onCameraClick={setSelectedCamera}
          onPlaneClick={setSelectedPlane}
          onPlanetClick={setSelectedPlanet}
        />
      </div>

      <Sidebar
        layers={layers}
        toggleLayer={toggleLayer}
        planesCount={planesData.features.length}
        camerasCount={camerasData.features.length}
        earthquakesCount={earthquakesData.features.length}
        openaqCount={openaqData.features.length}
        countriesCount={countriesData.features.length}
        spacexCount={spacexData.features.length}
      />

      <CameraPanel camera={selectedCamera} onClose={() => setSelectedCamera(null)} />
      <PlanePanel plane={selectedPlane} onClose={() => setSelectedPlane(null)} />
      <PlanetPanel planet={selectedPlanet} onClose={() => setSelectedPlanet(null)} />


      {/* Camera loading overlay */}
      {cameraLoading && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-50 glass-panel px-6 py-3 flex items-center gap-4 border border-[#08F7FE] pointer-events-none">
          <div className="w-2 h-2 bg-[#08F7FE] animate-ping" />
          <span className="text-[11px] text-[#08F7FE] tracking-widest uppercase">
            {cameraLoading.total > 100
              ? `SYNCING_CCTV_NETWORK :: ${cameraLoading.loaded} / ${cameraLoading.total} CAMERAS`
              : `SCANNING_CCTV_REGIONS :: ${cameraLoading.loaded} / ${cameraLoading.total} REGIONS [${cameraLoading.count || 0} CAMERAS]`
            }
          </span>
          <div className="w-32 h-1 bg-[#001f21] overflow-hidden">
            <div
              className="h-full bg-[#08F7FE] transition-all duration-300"
              style={{ width: `${(cameraLoading.loaded / cameraLoading.total) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
