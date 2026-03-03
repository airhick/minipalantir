import React, { useRef } from 'react';
import {
  Viewer, Entity, Scene, Globe,
  EllipseGraphics, LabelGraphics,
} from 'resium';
import {
  Cartesian3, Color, Ion, createWorldTerrainAsync,
  Math as CesiumMath, Scene as CesiumScene,
  GeoJsonDataSource,
  LabelStyle, NearFarScalar, Cartesian2,
  VerticalOrigin, HorizontalOrigin, JulianDate,
  PointPrimitiveCollection, BillboardCollection,
  SkyAtmosphere,
  ScreenSpaceEventHandler, ScreenSpaceEventType,
} from 'cesium';
import type * as GeoJSON from 'geojson';
import { getPlanetPositions, getPlanetCanvas, type PlanetInfo } from '../api/planets';
import type { CameraInfo } from './CameraPanel';
import type { PlaneInfo } from './PlanePanel';

// ── Cached canvas airplane icon ───────────────────────────────────────────────
// Drawn once, pointing UP (north = heading 0). BillboardCollection rotation
// applies heading-based CCW rotation per billboard at render time.
let _planeCanvas: HTMLCanvasElement | null = null;
function getPlaneCanvas(): HTMLCanvasElement {
  if (_planeCanvas) return _planeCanvas;
  const S = 32;
  const canvas = document.createElement('canvas');
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#00FF41';
  ctx.shadowColor = '#00FF41';
  ctx.shadowBlur = 3;
  // Fuselage
  ctx.beginPath();
  ctx.moveTo(16, 2); ctx.lineTo(18, 18); ctx.lineTo(16, 17); ctx.lineTo(14, 18);
  ctx.closePath(); ctx.fill();
  // Wings
  ctx.beginPath();
  ctx.moveTo(16, 11); ctx.lineTo(2, 20); ctx.lineTo(4, 21);
  ctx.lineTo(16, 15); ctx.lineTo(28, 21); ctx.lineTo(30, 20);
  ctx.closePath(); ctx.fill();
  // Tail fins
  ctx.beginPath();
  ctx.moveTo(16, 17); ctx.lineTo(10, 24); ctx.lineTo(11, 25);
  ctx.lineTo(16, 21); ctx.lineTo(21, 25); ctx.lineTo(22, 24);
  ctx.closePath(); ctx.fill();
  _planeCanvas = canvas;
  return canvas;
}

import 'cesium/Build/Cesium/Widgets/widgets.css';

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_TOKEN || '';
if (CESIUM_TOKEN) {
  Ion.defaultAccessToken = CESIUM_TOKEN;
}

import { EllipsoidTerrainProvider } from 'cesium';

const COUNTRIES_URL =
  'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/countries.geojson';

interface CesiumGlobeProps {
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
  planesData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  camerasData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  earthquakesData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  issData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  openaqData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  countriesData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  spacexData: GeoJSON.FeatureCollection<GeoJSON.Point>;
  onBoundsChange?: (
    bounds: { south: number; west: number; north: number; east: number },
    zoomLevel: number
  ) => void;
  onCameraClick?: (camera: CameraInfo) => void;
  onPlaneClick?: (plane: PlaneInfo) => void;
  onPlanetClick?: (planet: PlanetInfo) => void;
}

const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  layers,
  planesData, camerasData, earthquakesData,
  issData, openaqData, countriesData, spacexData,
  onBoundsChange,
  onCameraClick,
  onPlaneClick,
  onPlanetClick,
}) => {
  const viewerRef = useRef<React.ComponentRef<typeof Viewer> | null>(null);
  const [viewerInitialized, setViewerInitialized] = React.useState(false);
  const [planets, setPlanets] = React.useState<PlanetInfo[]>([]);
  const cameraPrimitivesRef = useRef<PointPrimitiveCollection | null>(null);
  const planesBillboardsRef = useRef<BillboardCollection | null>(null);
  const cameraHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const planetsBillboardsRef = useRef<BillboardCollection | null>(null);
  const planesHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  const planetsHandlerRef = useRef<ScreenSpaceEventHandler | null>(null);
  // Store data refs for ScreenSpaceEventHandler access without closure stale state
  const camerasDataRef = React.useRef(camerasData);
  const onCameraClickRef = React.useRef(onCameraClick);
  const onPlaneClickRef = React.useRef(onPlaneClick);
  const onPlanetClickRef = React.useRef(onPlanetClick);
  React.useEffect(() => { camerasDataRef.current = camerasData; }, [camerasData]);
  React.useEffect(() => { onCameraClickRef.current = onCameraClick; }, [onCameraClick]);
  React.useEffect(() => { onPlaneClickRef.current = onPlaneClick; }, [onPlaneClick]);
  React.useEffect(() => { onPlanetClickRef.current = onPlanetClick; }, [onPlanetClick]);


  // Stable initial camera position — avoids re-triggering CameraFlyTo on every render
  const initialCamera = React.useMemo(
    () => Cartesian3.fromDegrees(2.3522, 48.8566, 15_000_000),
    []
  );

  // ── Terrain ────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || !viewerInitialized || viewer.isDestroyed()) return;

    // Inside the loadTerrain async function, we need to check if viewer is still valid.
    // However, TypeScript doesn't know 'viewer' won't become undefined.
    // Rather than checking viewer.isDestroyed() we can just keep a reference to it
    // because we already returned early if it was undefined.
    const activeViewer = viewer;

    let mounted = true;
    async function loadTerrain() {
      if (layers.terrain && CESIUM_TOKEN) {
        try {
          const tp = await createWorldTerrainAsync();
          if (mounted && !activeViewer.isDestroyed()) {
            activeViewer.terrainProvider = tp;
          }
        } catch {
          if (mounted && !activeViewer.isDestroyed()) {
            activeViewer.terrainProvider = new EllipsoidTerrainProvider();
          }
        }
      } else {
        if (mounted && !activeViewer.isDestroyed()) {
          activeViewer.terrainProvider = new EllipsoidTerrainProvider();
        }
      }
    }
    loadTerrain();
    return () => { mounted = false; };
  }, [layers.terrain, viewerInitialized]);

  // ── First-frame init: resize + mark ready + initial camera ────────────────
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const viewer = viewerRef.current?.cesiumElement;
      if (viewer && !viewer.isDestroyed()) {
        viewer.resize();
        // Set initial camera position once imperatively, so re-renders don't reset it
        viewer.camera.flyTo({
          destination: initialCamera,
          duration: 0,
        });
        viewer.scene.requestRender();
        setViewerInitialized(true);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [initialCamera]);

  // ── Globe styling: atmosphere + scroll-zoom fix ───────────────────────────
  React.useEffect(() => {
    if (!viewerInitialized) return;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || viewer.isDestroyed()) return;

    // Bloom is off by default — expensive on integrated/low-end GPUs.
    // Uncomment to enable: viewer.scene.postProcessStages.bloom.enabled = true;
    const bloom = viewer.scene.postProcessStages.bloom;
    bloom.enabled = false;

    // Green-tinted atmosphere halo
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.hueShift = 0.27;
      viewer.scene.skyAtmosphere.saturationShift = 1.0;
      viewer.scene.skyAtmosphere.brightnessShift = 0.25;
    }
    viewer.scene.fog.enabled = false;
    viewer.scene.backgroundColor = Color.BLACK;

    // Explicitly enable all camera navigation (defensive — they're on by default
    // but some embedded configurations reset them)
    const ctrl = viewer.scene.screenSpaceCameraController;
    ctrl.enableZoom = true;
    ctrl.enableRotate = true;
    ctrl.enableTilt = true;
    ctrl.enableLook = true;
    ctrl.enableTranslate = true;

    // ── Scroll-wheel zoom fix ──────────────────────────────────────────────
    // CSS `pointer-events: none` on parent wrappers can prevent the browser from
    // routing wheel events to Cesium's internal canvas listener in some
    // browser / OS combinations. A native addEventListener on the canvas itself
    // is always reliable — it bypasses CSS pointer-events entirely.
    const canvas = viewer.scene.canvas;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();   // stop page scroll
      e.stopPropagation();
      if (viewer.isDestroyed()) return;
      const height = viewer.camera.positionCartographic.height;
      // Scale zoom speed with current altitude so it feels consistent
      const amount = height * Math.min(Math.abs(e.deltaY) / 200, 1) * 0.35;
      if (e.deltaY > 0) {
        viewer.camera.zoomOut(amount);
      } else {
        viewer.camera.zoomIn(amount);
      }
      viewer.scene.requestRender();
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    // Suppress Cesium's "Rendering has stopped" dialog
    const renderErrorHandler = viewer.scene.renderError.addEventListener(
      (_scene: unknown, error: unknown) => {
        console.warn('[Cesium renderError suppressed]', error);
        if (!viewer.isDestroyed()) {
          viewer.useDefaultRenderLoop = true;
        }
      }
    );

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
      renderErrorHandler();
    };
  }, [viewerInitialized]);

  // ── Country borders + labels (only when countries layer is active) ─────────
  React.useEffect(() => {
    if (!viewerInitialized) return;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || viewer.isDestroyed()) return;

    // Only load the heavy GeoJSON when the countries layer is toggled on
    if (!layers.countries) return;

    let ds: InstanceType<typeof GeoJsonDataSource> | undefined;
    const labelEntities: ReturnType<typeof viewer.entities.add>[] = [];
    let cancelled = false;

    GeoJsonDataSource.load(COUNTRIES_URL, {
      stroke: Color.fromCssColorString('#00FF41').withAlpha(0.7),
      fill: Color.TRANSPARENT,
      strokeWidth: 1.5,
      clampToGround: false,
    })
      .then(dataSource => {
        if (cancelled || viewer.isDestroyed()) return;
        ds = dataSource;

        // Add country name labels at polygon centroids
        dataSource.entities.values.forEach(entity => {
          const countryName = entity.name;
          if (countryName && entity.polygon) {
            const hier = entity.polygon.hierarchy?.getValue(new JulianDate());
            if (hier?.positions?.length > 0) {
              const positions = hier.positions as Cartesian3[];
              let cx = 0, cy = 0, cz = 0;
              for (const p of positions) { cx += p.x; cy += p.y; cz += p.z; }
              const n = positions.length;
              const centroid = new Cartesian3(cx / n, cy / n, cz / n);

              const lbl = viewer.entities.add({
                position: centroid,
                label: {
                  text: countryName.toUpperCase(),
                  font: '8px "Courier New"',
                  fillColor: Color.fromCssColorString('#00FF41').withAlpha(0.9),
                  outlineColor: Color.BLACK,
                  outlineWidth: 2,
                  style: LabelStyle.FILL_AND_OUTLINE,
                  verticalOrigin: VerticalOrigin.CENTER,
                  horizontalOrigin: HorizontalOrigin.CENTER,
                  scaleByDistance: new NearFarScalar(400_000, 1.4, 5_000_000, 0.0),
                  translucencyByDistance: new NearFarScalar(400_000, 1.0, 5_000_000, 0.0),
                  disableDepthTestDistance: Number.POSITIVE_INFINITY,
                } as any,
              });
              labelEntities.push(lbl);
            }
          }
        });

        viewer.dataSources.add(dataSource);
      })
      .catch(err => {
        if (!cancelled) console.warn('Country borders failed:', err);
      });

    return () => {
      cancelled = true;
      if (ds && !viewer.isDestroyed()) viewer.dataSources.remove(ds, true);
      if (!viewer.isDestroyed()) labelEntities.forEach(e => viewer.entities.remove(e));
    };
  }, [viewerInitialized, layers.countries]);

  // ── Planets (updated every minute) ────────────────────────────────────────
  React.useEffect(() => {
    const update = () => setPlanets(getPlanetPositions());
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);

  // Tracks how many camera features have already been added to the GPU collection,
  // so we only add the new ones when camerasData grows (instead of rebuilding everything).
  const cameraRenderedCountRef = React.useRef(0);

  // ── Effect 1: create/destroy the PointPrimitiveCollection + click handler ──
  // Runs only when the cameras layer is toggled or the viewer is first ready.
  React.useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || viewer.isDestroyed()) return;

    // Clean up any previous collection
    if (cameraPrimitivesRef.current) {
      if (viewer.scene.primitives.contains(cameraPrimitivesRef.current)) {
        viewer.scene.primitives.remove(cameraPrimitivesRef.current);
      }
      cameraPrimitivesRef.current = null;
    }
    if (cameraHandlerRef.current) {
      cameraHandlerRef.current.destroy();
      cameraHandlerRef.current = null;
    }
    cameraRenderedCountRef.current = 0;

    if (!layers.cameras) return;

    // Create an empty collection — points will be added incrementally by Effect 2
    const collection = new PointPrimitiveCollection();
    viewer.scene.primitives.add(collection);
    cameraPrimitivesRef.current = collection;

    // Click handler — checks the shared collection reference
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      if (!picked || !picked.primitive) return;
      const prim = picked.primitive;
      if (!collection.contains(prim)) return;
      const meta = prim.id;
      if (!meta) return;
      onCameraClickRef.current?.({
        id: meta.props.id,
        name: meta.props.name,
        city: meta.props.city,
        operator: meta.props.operator,
        surveillance_type: meta.props.surveillance_type || 'unknown',
        url: meta.props.url,
        lat: meta.lat,
        lon: meta.lon,
      });
    }, ScreenSpaceEventType.LEFT_CLICK);
    cameraHandlerRef.current = handler;

    return () => {
      if (!viewer.isDestroyed() && viewer.scene.primitives.contains(collection)) {
        viewer.scene.primitives.remove(collection);
      }
      handler.destroy();
      cameraPrimitivesRef.current = null;
      cameraHandlerRef.current = null;
      cameraRenderedCountRef.current = 0;
    };
  }, [layers.cameras, viewerInitialized]);

  // ── Effect 2: add only NEW camera points when camerasData grows ────────────
  // camerasData grows incrementally (one batch at a time) so this only does
  // O(batch_size) work per update, never rebuilds the entire collection.
  React.useEffect(() => {
    const collection = cameraPrimitivesRef.current;
    if (!collection || !layers.cameras) return;

    const alreadyRendered = cameraRenderedCountRef.current;
    const newFeatures = camerasData.features.slice(alreadyRendered);
    if (newFeatures.length === 0) return;

    const colorWithUrl = Color.fromCssColorString('#FF003C');
    const scaleByDist = new NearFarScalar(1000, 1.0, 1.5e7, 0.4);
    const outlineColor = Color.fromCssColorString('#FF003C').withAlpha(0.5);

    for (const f of newFeatures) {
      const [lon, lat] = f.geometry.coordinates;
      const props = f.properties || {};
      const hasUrl = !!props.url;
      if (!hasUrl) continue; // Skip rendering broken ones if any lingered

      collection.add({
        position: Cartesian3.fromDegrees(lon, lat, 10),
        color: colorWithUrl,
        pixelSize: 6, // Simple, small dot
        outlineColor,
        outlineWidth: 4, // creates a glowing halo effect around the dot
        scaleByDistance: scaleByDist,
        disableDepthTestDistance: 1.2e7, // Disables terrain depth testing for cameras up to 12,000km away; beyond that, Earth occludes cameras on the back face
        id: { lon, lat, props },
      });
    }
    cameraRenderedCountRef.current = camerasData.features.length;
  }, [layers.cameras, camerasData]);


  // ── Planes: GPU-batched BillboardCollection with rotated airplane icons ────
  React.useEffect(() => {
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || viewer.isDestroyed()) return;

    // Clean up previous billboard collection and click handler
    if (planesBillboardsRef.current) {
      if (viewer.scene.primitives.contains(planesBillboardsRef.current)) {
        viewer.scene.primitives.remove(planesBillboardsRef.current);
      }
      planesBillboardsRef.current = null;
    }
    if (planesHandlerRef.current) {
      planesHandlerRef.current.destroy();
      planesHandlerRef.current = null;
    }

    if (!layers.planes || planesData.features.length === 0) return;

    // One shared canvas icon — rotation is applied per-billboard in GPU
    const iconCanvas = getPlaneCanvas();
    const collection = new BillboardCollection({ scene: viewer.scene });
    const planeColor = Color.fromCssColorString('#00FF41');

    planesData.features.forEach(f => {
      const [lon, lat] = f.geometry.coordinates;
      const alt = (f.properties?.altitude as number) || 10000;
      const heading = (f.properties?.true_track as number) || 0;
      // rotation is CCW from screen +X (east); our icon points up (north = π/2 from east)
      // For heading H (CW from north): rotation = π/2 - H_radians
      const rotation = Math.PI / 2 - CesiumMath.toRadians(heading);
      collection.add({
        position: Cartesian3.fromDegrees(lon, lat, alt),
        image: iconCanvas,
        rotation,
        color: planeColor,
        scale: 0.85,
        scaleByDistance: new NearFarScalar(100_000, 1.2, 2e7, 0.25),
        // depth test enabled — globe occludes planes on the far side
        id: {
          icao24: f.properties?.icao24 as string,
          callsign: f.properties?.callsign as string,
          origin_country: f.properties?.origin_country as string,
          altitude: alt,
          velocity: (f.properties?.velocity as number) || 0,
          true_track: heading,
          lat, lon,
        },
      });
    });

    viewer.scene.primitives.add(collection);
    planesBillboardsRef.current = collection;

    // Click handler — opens PlanePanel with the clicked aircraft's data
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      // Billboards: picked.primitive is the Billboard instance; .id holds our metadata
      if (!picked?.primitive?.id) return;
      const meta = picked.primitive.id;
      // Make sure it's a plane click (has icao24 but not camera props)
      if (!meta.icao24 || meta.props) return;
      onPlaneClickRef.current?.({
        icao24: meta.icao24,
        callsign: meta.callsign,
        origin_country: meta.origin_country,
        altitude: meta.altitude,
        velocity: meta.velocity,
        true_track: meta.true_track,
        lat: meta.lat,
        lon: meta.lon,
      });
    }, ScreenSpaceEventType.LEFT_CLICK);

    planesHandlerRef.current = handler;

    return () => {
      if (!viewer.isDestroyed() && viewer.scene.primitives.contains(collection)) {
        viewer.scene.primitives.remove(collection);
      }
      handler.destroy();
      planesBillboardsRef.current = null;
      planesHandlerRef.current = null;
    };
  }, [layers.planes, planesData, viewerInitialized]);

  // ── Planets (BillboardCollection) ──────────────────────────────────────────
  React.useEffect(() => {
    if (!viewerInitialized) return;
    const viewer = viewerRef.current?.cesiumElement;
    if (!viewer || viewer.isDestroyed()) return;

    // Cleanup previous handler
    if (planetsHandlerRef.current) {
      planetsHandlerRef.current.destroy();
      planetsHandlerRef.current = null;
    }

    if (planets.length === 0) return;

    const collection = new BillboardCollection({ scene: viewer.scene });

    planets.forEach(planet => {
      const iconCanvas = getPlanetCanvas(planet.name);
      collection.add({
        position: Cartesian3.fromDegrees(planet.lon, planet.lat, planet.altitude),
        image: iconCanvas,
        scale: 0.9,
        scaleByDistance: new NearFarScalar(1e7, 1.0, 3e8, 0.4),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        id: planet, // Store full PlanetInfo object for click handler
      });
    });

    viewer.scene.primitives.add(collection);
    planetsBillboardsRef.current = collection;

    // Click handler for planets
    const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: Cartesian2 }) => {
      const picked = viewer.scene.pick(click.position);
      if (!picked?.primitive?.id) return;
      const meta = picked.primitive.id;
      // Identify planet by checking for 'data' property
      if (!meta.data || !meta.name || meta.icao24 || meta.props) return;

      onPlanetClickRef.current?.(meta as PlanetInfo);
    }, ScreenSpaceEventType.LEFT_CLICK);

    planetsHandlerRef.current = handler;

    return () => {
      if (!viewer.isDestroyed() && viewer.scene.primitives.contains(collection)) {
        viewer.scene.primitives.remove(collection);
      }
      handler.destroy();
      planetsBillboardsRef.current = null;
      planetsHandlerRef.current = null;
    };
  }, [planets, viewerInitialized]);


  // ── Camera / bounds ────────────────────────────────────────────────────────
  const handleZoomIn = () => {
    const viewer = viewerRef.current?.cesiumElement;
    if (viewer && !viewer.isDestroyed()) {
      viewer.camera.zoomIn(viewer.camera.positionCartographic.height * 0.4);
    }
  };

  const handleZoomOut = () => {
    const viewer = viewerRef.current?.cesiumElement;
    if (viewer && !viewer.isDestroyed()) {
      viewer.camera.zoomOut(viewer.camera.positionCartographic.height * 0.4);
    }
  };

  const handleCameraChange = (scene: CesiumScene) => {
    if (!onBoundsChange || !scene?.camera) return;
    const rect = scene.camera.computeViewRectangle(scene.globe.ellipsoid);
    if (rect) {
      const south = CesiumMath.toDegrees(rect.south);
      const west = CesiumMath.toDegrees(rect.west);
      const north = CesiumMath.toDegrees(rect.north);
      const east = CesiumMath.toDegrees(rect.east);
      const height = scene.camera.positionCartographic.height;
      onBoundsChange({ south, west, north, east }, Math.log2(2e7 / height));
    }
  };

  // Cache the SkyAtmosphere instance so the Viewer doesn't see a new object
  // reference on every render, which triggers a full recreation of the Viewer.
  const skyAtmosphere = React.useMemo(() => new SkyAtmosphere(), []);

  return (
    <div className="absolute inset-0 w-full h-full bg-black z-0 pointer-events-none">
      {/* Zoom controls */}
      <div className="absolute right-6 bottom-6 flex flex-col gap-3 z-20 pointer-events-auto">
        <button
          onClick={handleZoomIn}
          className="glass-button w-10 h-10 border border-[#00FF41] flex items-center justify-center font-bold text-2xl hover:bg-[#00FF41]/20 transition-colors cursor-pointer"
          title="Zoom In"
        >+</button>
        <button
          onClick={handleZoomOut}
          className="glass-button w-10 h-10 border border-[#00FF41] flex items-center justify-center font-bold text-3xl hover:bg-[#00FF41]/20 transition-colors cursor-pointer"
          title="Zoom Out"
        >-</button>
      </div>

      <Viewer
        ref={viewerRef}
        full
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'auto' }}
        animation={false}
        timeline={false}
        baseLayerPicker={false}
        geocoder={false}
        homeButton={false}
        infoBox={false}
        sceneModePicker={false}
        selectionIndicator={false}
        navigationHelpButton={false}
        navigationInstructionsInitiallyVisible={false}
        scene3DOnly={true}
        // Enable atmospheric and celestial features
        skyAtmosphere={skyAtmosphere}
        skyBox={false} // Keep background black as requested ("hacker style") but allow earth halo
      >
        {/* @ts-expect-error resium Scene onPostRender types */}
        {viewerInitialized && <Scene onPostRender={handleCameraChange} />}

        <Globe
          enableLighting={true}
          dynamicAtmosphereLighting={true}
          dynamicAtmosphereLightingFromSun={true}
          showGroundAtmosphere={true}
          depthTestAgainstTerrain={layers.terrain}
        />

        {/* ── Planes: rendered via imperative BillboardCollection (see useEffect) ── */}

        {/* ── Planets: rendered via imperative BillboardCollection (see useEffect) ── */}

        {/* ── Cameras: rendered via imperative PointPrimitiveCollection (see useEffect) ── */}

        {/* ── Earthquakes ── */}
        {layers.earthquakes && earthquakesData.features.map((f, idx) => {
          const [lon, lat] = f.geometry.coordinates;
          const props = f.properties || {};
          const mag = props.mag || 1;
          const radius = Math.max(mag * 40000, 10000);
          let color = Color.fromCssColorString('#FF003C').withAlpha(0.6);
          if (mag < 2) color = Color.fromCssColorString('#00FF41').withAlpha(0.6);
          else if (mag < 4) color = Color.fromCssColorString('#FDFD00').withAlpha(0.6);
          else if (mag < 6) color = Color.fromCssColorString('#FF8C00').withAlpha(0.6);
          return (
            <Entity
              key={`eq-${props.id || idx}`}
              position={Cartesian3.fromDegrees(lon, lat, 0)}
              name={props.title || 'Earthquake'}
              description={`Magnitude: ${mag}\nTime: ${new Date(props.time).toLocaleString()}`}
            >
              <EllipseGraphics
                semiMinorAxis={radius}
                semiMajorAxis={radius}
                height={0}
                material={color}
                outline={true}
                outlineColor={color.withAlpha(1)}
              />
            </Entity>
          );
        })}

        {/* ── ISS ── */}
        {layers.iss && issData.features.map((f, idx) => {
          const [lon, lat] = f.geometry.coordinates;
          return (
            <Entity
              key={`iss-${idx}`}
              position={Cartesian3.fromDegrees(lon, lat, 400000)}
              name="International Space Station"
            >
              <LabelGraphics
                text="✦ ISS"
                font={'11px "Courier New"'}
                fillColor={Color.fromCssColorString('#FE0000')}
                outlineColor={Color.BLACK}
                outlineWidth={2}
                style={LabelStyle.FILL_AND_OUTLINE}
                verticalOrigin={VerticalOrigin.BOTTOM}
                pixelOffset={new Cartesian2(0, -8)}
              />
            </Entity>
          );
        })}

        {/* ── OpenAQ ── */}
        {layers.openaq && openaqData.features.map((f, idx) => {
          const [lon, lat] = f.geometry.coordinates;
          const props = f.properties || {};
          const value = props.value || 0;
          let color = Color.fromCssColorString('#00FF41');
          if (value > 12) color = Color.fromCssColorString('#FDFD00');
          if (value > 35) color = Color.fromCssColorString('#FF8C00');
          if (value > 55) color = Color.fromCssColorString('#FF003C');
          return (
            <Entity
              key={`aq-${idx}`}
              position={Cartesian3.fromDegrees(lon, lat, 100)}
              name={`Air Quality: ${props.city || 'Unknown'}, ${props.country || ''}`}
              description={`Parameter: ${props.parameter}\nValue: ${value} ${props.unit}`}
            >
              <LabelGraphics
                text="●"
                font={'8px "Courier New"'}
                fillColor={color}
                outlineColor={Color.BLACK}
                outlineWidth={1}
                style={LabelStyle.FILL_AND_OUTLINE}
                verticalOrigin={VerticalOrigin.CENTER}
                horizontalOrigin={HorizontalOrigin.CENTER}
                scaleByDistance={new NearFarScalar(1000, 1.2, 1.5e7, 0.5)}
              />
            </Entity>
          );
        })}

        {/* ── Countries/Capitals ── */}
        {layers.countries && countriesData.features.map((f, idx) => {
          const [lon, lat] = f.geometry.coordinates;
          const props = f.properties || {};
          return (
            <Entity
              key={`country-${idx}`}
              position={Cartesian3.fromDegrees(lon, lat, 100)}
              name={`${props.name} Capital`}
              description={`Region: ${props.region}\nPopulation: ${props.population?.toLocaleString()}`}
            >
              <LabelGraphics
                text="▲"
                font={'8px "Courier New"'}
                fillColor={Color.fromCssColorString('#08F7FE')}
                outlineColor={Color.fromCssColorString('#00FF41')}
                outlineWidth={1}
                style={LabelStyle.FILL_AND_OUTLINE}
                verticalOrigin={VerticalOrigin.CENTER}
                horizontalOrigin={HorizontalOrigin.CENTER}
                scaleByDistance={new NearFarScalar(1000, 1.2, 1.5e7, 0.5)}
              />
            </Entity>
          );
        })}

        {/* ── SpaceX ── */}
        {layers.spacex && spacexData.features.map((f, idx) => {
          const [lon, lat] = f.geometry.coordinates;
          const props = f.properties || {};
          const color = props.status === 'active'
            ? Color.fromCssColorString('#B900FF')
            : Color.fromCssColorString('#444444');
          return (
            <Entity
              key={`spacex-${props.id || idx}`}
              position={Cartesian3.fromDegrees(lon, lat, 50)}
              name={`SpaceX: ${props.name}`}
              description={`Status: ${props.status}\nLaunches: ${props.successes}/${props.launches}`}
            >
              <LabelGraphics
                text="◆"
                font={'10px "Courier New"'}
                fillColor={color}
                outlineColor={Color.fromCssColorString('#08F7FE')}
                outlineWidth={2}
                style={LabelStyle.FILL_AND_OUTLINE}
                verticalOrigin={VerticalOrigin.CENTER}
                horizontalOrigin={HorizontalOrigin.CENTER}
                scaleByDistance={new NearFarScalar(1000, 1.5, 1.5e7, 0.5)}
              />
            </Entity>
          );
        })}
      </Viewer>
    </div>
  );
};

export default CesiumGlobe;
