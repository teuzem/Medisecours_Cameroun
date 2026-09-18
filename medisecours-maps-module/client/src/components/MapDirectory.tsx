import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { FacilityDrawer, type SimilarFacility } from "@/components/FacilityDrawer";
import { MapView } from "@/components/Map";
import { buildLiveSearchInput, liveSearchCacheScope, mergePlacesPage, readCachedPlacesSearch, writeCachedPlacesSearch } from "@/lib/placesLiveSearch";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Baby, Bookmark, Clock3, Cross, FlaskConical, HeartPulse, Hospital, Layers3, LocateFixed, MapPin, Menu, MessageSquare, Navigation, Phone, Pill, Plus, Search, ShieldCheck, Stethoscope, UserCircle, X, Minus } from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const CAMEROON_CENTER = { lat: 7.3697, lng: 12.3547 };
type VisibleCategory = "all" | "hospital" | "clinic" | "health_center" | "pharmacy" | "laboratory" | "maternity" | "specialized_center";
const categoryVisuals: Record<VisibleCategory, { label: string; color: string; Icon: typeof Hospital }> = {
  all: { label: "Tous", color: "#0b8a96", Icon: MapPin },
  hospital: { label: "Hôpitaux", color: "#e13d55", Icon: Hospital },
  clinic: { label: "Cliniques", color: "#4169e1", Icon: Stethoscope },
  health_center: { label: "Centres de santé", color: "#0b8a96", Icon: HeartPulse },
  pharmacy: { label: "Pharmacies", color: "#2d9d62", Icon: Pill },
  laboratory: { label: "Laboratoires", color: "#7c4dff", Icon: FlaskConical },
  maternity: { label: "Maternités", color: "#d9618a", Icon: Baby },
  specialized_center: { label: "Centres spécialisés", color: "#ea8a2c", Icon: Cross },
};

type Bounds = { north: number; south: number; east: number; west: number };
type VisibleFacility = {
  key: string;
  localId?: number;
  placeId?: string;
  isLive: boolean;
  name: string;
  category: string;
  categoryLabel: string | null;
  address: string;
  city: string | null;
  latitude: number;
  longitude: number;
  googleRating: string | null;
  googleRatingCount: number;
  medisecoursRating: string | null;
  medisecoursRatingCount: number;
  isOpenNow: boolean | null;
  verificationStatus: string;
  distanceKm: number | null;
};

type LivePlace = {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  googleRating: number | null;
  googleRatingCount: number;
  isOpenNow: boolean | null;
  category: string;
  categoryLabel: string;
  verificationStatus: "unverified";
  isLive: true;
};

export type RouteTravelMode = "DRIVING" | "WALKING" | "BICYCLING";
type RoutePoint = { lat: number; lng: number };
type SosTarget = { id: number; name: string; category: string; address: string; phones: string[] | null; distanceKm: number };
type DirectionsApi = {
  DirectionsService: new () => { route: (request: unknown, callback: (result: { routes: Array<{ legs?: Array<{ duration?: { text?: string }; distance?: { text?: string } }> }> } | null, status: string) => void) => void };
  DirectionsRenderer: new (options?: unknown) => { setMap: (map: any) => void; setDirections: (result: any) => void };
  TravelMode: Record<RouteTravelMode, unknown>;
};

export function buildRouteFallbackUrl(destination: RoutePoint, travelMode: RouteTravelMode) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("travelmode", travelMode.toLowerCase());
  return url.toString();
}

export function buildSosContactHref(phone: string, channel: "call" | "sms") {
  const normalized = phone.replace(/[^+\d]/g, "");
  return `${channel === "call" ? "tel" : "sms"}:${normalized}`;
}

export function requestNativeMapRoute(input: { api?: DirectionsApi; map: unknown; renderer?: { setMap: (map: any) => void; setDirections: (result: any) => void }; origin: RoutePoint; destination: RoutePoint; travelMode: RouteTravelMode; onSuccess: (result: { routes: Array<{ legs?: Array<{ duration?: { text?: string }; distance?: { text?: string } }> }> }) => void; onFailure: () => void }) {
  if (!input.map || !input.api?.DirectionsService || !input.api?.DirectionsRenderer) return { started: false as const };
  const renderer = input.renderer ?? new input.api.DirectionsRenderer({ suppressMarkers: false, preserveViewport: false, polylineOptions: { strokeColor: "#0b8a96", strokeWeight: 6 } });
  renderer.setMap(input.map);
  const service = new input.api.DirectionsService();
  service.route({ origin: input.origin, destination: input.destination, travelMode: input.api.TravelMode[input.travelMode] }, (result, status) => {
    if (status === "OK" && result) {
      renderer.setDirections(result);
      input.onSuccess(result);
      return;
    }
    input.onFailure();
  });
  return { started: true as const, renderer };
}

function stars(value: string | null) {
  return Number(value ?? 0).toLocaleString("fr-CM", { maximumFractionDigits: 1 });
}

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const earthRadius = 6371;
  const lat = ((b.lat - a.lat) * Math.PI) / 180;
  const lng = ((b.lng - a.lng) * Math.PI) / 180;
  const value = Math.sin(lat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(lng / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value)) * 10) / 10;
}

export function isMapsQuotaError(error: unknown) {
  return error instanceof Error && /(?:\b412\b|\b429\b|precondition failed|quota|usage exhausted|resource exhausted|temporairement indisponible après épuisement)/i.test(error.message);
}

export function MapDirectory() {
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [category, setCategory] = useState<VisibleCategory>("all");
  const [bounds, setBounds] = useState<Bounds | undefined>();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number }>();
  const [livePageTokens, setLivePageTokens] = useState<string[]>([]);
  const [loadedLivePlaces, setLoadedLivePlaces] = useState<LivePlace[]>([]);
  const [loadingMoreLivePlaces, setLoadingMoreLivePlaces] = useState(false);
  const [selectedLocalId, setSelectedLocalId] = useState<number>();
  const [selectedPlaceId, setSelectedPlaceId] = useState<string>();
  const [selectedLiveCategory, setSelectedLiveCategory] = useState<VisibleCategory>("all");
  const [showMobileResults, setShowMobileResults] = useState(true);
  const [routeStatus, setRouteStatus] = useState<string>();
  const [sosTargets, setSosTargets] = useState<SosTarget[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [trafficLayer, setTrafficLayer] = useState(false);
  const [transitLayer, setTransitLayer] = useState(false);
  const [bicyclingLayer, setBicyclingLayer] = useState(false);
  const [, navigate] = useLocation();
  const { isAuthenticated, user } = useAuth();

  const searchInput = useMemo(
    () => ({ query: deferredSearch.trim() || undefined, category, bounds, userLocation, limit: 100 }),
    [bounds, category, deferredSearch, userLocation]
  );
  const liveSearchInput = useMemo(
    () => buildLiveSearchInput({ query: deferredSearch, category, location: userLocation, bounds, pageTokens: livePageTokens, maxSectors: 10 }),
    [bounds, category, deferredSearch, livePageTokens, userLocation]
  );
  const places = trpc.facilities.search.useQuery(searchInput, { staleTime: 20_000, refetchOnWindowFocus: false });
  const livePlaces = trpc.facilities.liveSearch.useQuery(liveSearchInput, { staleTime: 20_000, refetchOnWindowFocus: false, retry: (failureCount, error) => !isMapsQuotaError(error) && failureCount < 2 });
  const mapsStatus = trpc.facilities.mapsStatus.useQuery(undefined, { staleTime: 15_000, refetchOnWindowFocus: false });
  const autocompleteInput = useMemo(() => ({ input: deferredSearch.trim(), location: userLocation }), [deferredSearch, userLocation]);
  const autocomplete = trpc.facilities.autocomplete.useQuery(autocompleteInput, { enabled: deferredSearch.trim().length >= 2, staleTime: 30_000, retry: (failureCount, error) => !isMapsQuotaError(error) && failureCount < 1 });
  const indexedDetail = trpc.facilities.byId.useQuery({ id: selectedLocalId ?? 1 }, { enabled: Boolean(selectedLocalId) });
  const liveDetail = trpc.facilities.liveByPlaceId.useQuery(
    { placeId: selectedPlaceId ?? "preview-place", category: selectedLiveCategory },
    { enabled: Boolean(selectedPlaceId) }
  );
  const selectedDetail = selectedLocalId ? indexedDetail.data : liveDetail.data;
  const similarInput = useMemo(() => ({
    latitude: selectedDetail?.facility.latitude ?? CAMEROON_CENTER.lat,
    longitude: selectedDetail?.facility.longitude ?? CAMEROON_CENTER.lng,
    category: ((selectedDetail?.facility.category ?? "all") in categoryVisuals ? (selectedDetail?.facility.category ?? "all") : "all") as VisibleCategory,
    excludePlaceId: selectedDetail?.facility.googlePlaceId ?? selectedPlaceId,
  }), [selectedDetail, selectedPlaceId]);
  const similarPlaces = trpc.facilities.similar.useQuery(similarInput, { enabled: Boolean(selectedDetail), staleTime: 30_000 });
  const trpcUtils = trpc.useUtils();
  const recordSearch = trpc.account.recordSearch.useMutation({
    onSuccess: () => { void trpcUtils.account.dashboard.invalidate(); },
  });
  const sosAlert = trpc.account.triggerSos.useMutation({
    onSuccess: result => {
      setSosTargets(result.nearbyFacilities);
      toast.success(`SOS enregistré : le propriétaire est alerté et ${result.nearbyFacilities.length} formation(s) proche(s) ont été ciblées.`);
    },
    onError: error => toast.error(error.message),
  });

  const liveSearchScope = useMemo(() => liveSearchCacheScope({ query: deferredSearch, category, bounds, location: userLocation }), [bounds, category, deferredSearch, userLocation]);
  const mapsQuotaExhausted = isMapsQuotaError(livePlaces.error) || isMapsQuotaError(autocomplete.error) || isMapsQuotaError(liveDetail.error);
  const mapsConfigurationMissing = !mapsQuotaExhausted && (mapsStatus.data?.configured === false || livePlaces.data?.serviceStatus === "configuration_missing");
  const quotaCooldownSeconds = mapsStatus.data?.quotaCooldownSeconds ?? 0;
  useEffect(() => {
    if (quotaCooldownSeconds <= 0) return;
    const retryTimer = window.setTimeout(() => {
      void livePlaces.refetch();
      void mapsStatus.refetch();
    }, (quotaCooldownSeconds + 1) * 1000);
    return () => window.clearTimeout(retryTimer);
  }, [livePlaces, mapsStatus, quotaCooldownSeconds]);
  const cachedLivePlaces = useMemo(() => readCachedPlacesSearch<LivePlace>(liveSearchScope)?.places ?? [], [liveSearchScope, mapsQuotaExhausted]);
  const previousLiveSearchScope = useRef(liveSearchScope);
  useEffect(() => {
    if (previousLiveSearchScope.current === liveSearchScope) return;
    previousLiveSearchScope.current = liveSearchScope;
    setLivePageTokens([]);
    setLoadedLivePlaces([]);
    setLoadingMoreLivePlaces(false);
  }, [liveSearchScope]);

  useEffect(() => {
    const searchText = deferredSearch.trim();
    if (!isAuthenticated || searchText.length < 2) return;
    const timeout = window.setTimeout(() => {
      recordSearch.mutate({ searchText, category, source: "map" });
    }, 850);
    return () => window.clearTimeout(timeout);
  }, [category, deferredSearch, isAuthenticated, recordSearch]);

  useEffect(() => {
    const incoming = livePlaces.data?.places;
    if (!incoming) return;
    setLoadedLivePlaces(previous => {
      const next = !livePageTokens.length ? incoming : mergePlacesPage(previous, incoming);
      writeCachedPlacesSearch(liveSearchScope, next);
      return next;
    });
    setLoadingMoreLivePlaces(false);
  }, [livePageTokens.length, livePlaces.data, liveSearchScope]);

  const facilities = useMemo<VisibleFacility[]>(() => {
    const indexed = (places.data ?? []).map(facility => ({
      key: `medisecours-${facility.id}`,
      localId: facility.id,
      isLive: false,
      name: facility.name,
      category: facility.category,
      categoryLabel: facility.categoryLabel,
      address: facility.address,
      city: facility.city,
      latitude: Number(facility.latitude),
      longitude: Number(facility.longitude),
      googleRating: facility.googleRating,
      googleRatingCount: facility.googleRatingCount,
      medisecoursRating: facility.medisecoursRating,
      medisecoursRatingCount: facility.medisecoursRatingCount,
      isOpenNow: facility.isOpenNow,
      verificationStatus: facility.verificationStatus,
      distanceKm: facility.distanceKm,
    }));
    const knownPlaceIds = new Set(indexed.map(item => item.key));
    const dynamicSource = loadedLivePlaces.length ? loadedLivePlaces : mapsQuotaExhausted || mapsConfigurationMissing ? cachedLivePlaces : [];
    const dynamic = dynamicSource
      .map(place => ({
        key: `place-${place.placeId}`,
        placeId: place.placeId,
        isLive: true,
        name: place.name,
        category: place.category,
        categoryLabel: place.categoryLabel,
        address: place.address,
        city: null,
        latitude: place.latitude,
        longitude: place.longitude,
        googleRating: place.googleRating === null ? null : String(place.googleRating),
        googleRatingCount: place.googleRatingCount,
        medisecoursRating: null,
        medisecoursRatingCount: 0,
        isOpenNow: place.isOpenNow,
        verificationStatus: place.verificationStatus,
        distanceKm: userLocation ? distanceKm(userLocation, { lat: place.latitude, lng: place.longitude }) : null,
      }))
      .filter(item => !knownPlaceIds.has(item.key));
    return [...indexed, ...dynamic];
  }, [loadedLivePlaces, mapsConfigurationMissing, mapsQuotaExhausted, places.data, userLocation]);

  const updateBounds = useCallback(() => {
    const viewport = mapRef.current?.getBounds();
    if (!viewport) return;
    const northEast = viewport.getNorthEast();
    const southWest = viewport.getSouthWest();
    setBounds({ north: northEast.lat(), south: southWest.lat(), east: northEast.lng(), west: southWest.lng() });
  }, []);

  const onMapReady = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMapReady(true);
    updateBounds();
    map.addListener("idle", updateBounds);
  }, [updateBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !window.google?.maps) return;
    const traffic = new google.maps.TrafficLayer();
    const transit = new google.maps.TransitLayer();
    const bicycling = new google.maps.BicyclingLayer();
    traffic.setMap(trafficLayer ? map : null);
    transit.setMap(transitLayer ? map : null);
    bicycling.setMap(bicyclingLayer ? map : null);
    const instances = [traffic, transit, bicycling];
    return () => instances.forEach(layer => layer.setMap(null));
  }, [bicyclingLayer, mapReady, trafficLayer, transitLayer]);

  const openFacility = useCallback((facility: VisibleFacility) => {
    if (facility.isLive && facility.placeId) {
      setSelectedLiveCategory((facility.category in categoryVisuals ? facility.category : "all") as VisibleCategory);
      setSelectedPlaceId(facility.placeId);
      setSelectedLocalId(undefined);
    } else if (facility.localId) {
      setSelectedLocalId(facility.localId);
      setSelectedPlaceId(undefined);
    }
  }, []);

  const openSimilar = useCallback((facility: SimilarFacility) => {
    setSelectedLiveCategory((facility.category in categoryVisuals ? facility.category : "all") as VisibleCategory);
    setSelectedPlaceId(facility.placeId);
    setSelectedLocalId(undefined);
    mapRef.current?.panTo({ lat: facility.latitude, lng: facility.longitude });
    mapRef.current?.setZoom(15);
  }, []);

  useEffect(() => {
    if (!mapReady || !mapRef.current || !window.google?.maps?.marker) return;
    const map = mapRef.current;
    const markers = facilities.map(facility => {
      const visual = categoryVisuals[facility.category as VisibleCategory] ?? categoryVisuals.all;
      const pin = new google.maps.marker.PinElement({ background: visual.color, borderColor: "#ffffff", glyphColor: "#ffffff", glyphText: "+", scale: 1.05 } as unknown as google.maps.marker.PinElementOptions);
      const marker = new google.maps.marker.AdvancedMarkerElement({ map, position: { lat: facility.latitude, lng: facility.longitude }, title: facility.name, content: pin.element });
      marker.addListener("click", () => {
        const content = document.createElement("div");
        content.className = "min-w-[210px] max-w-[260px] p-1 font-sans";
        const label = document.createElement("p");
        label.className = "mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-[#0b8a96]";
        label.textContent = facility.categoryLabel || visual.label;
        const name = document.createElement("p");
        name.className = "text-sm font-bold text-[#102b46]";
        name.textContent = facility.name;
        const meta = document.createElement("p");
        meta.className = "mt-1 text-xs text-slate-500";
        meta.textContent = `${facility.isOpenNow ? "Ouvert" : "Horaires à vérifier"} · ★ ${stars(facility.medisecoursRating ?? facility.googleRating)}`;
        const action = document.createElement("button");
        action.type = "button";
        action.className = "mt-3 rounded-lg bg-[#0b8a96] px-3 py-2 text-xs font-bold text-white";
        action.textContent = "Voir la fiche";
        action.addEventListener("click", () => { openFacility(facility); infoWindowRef.current?.close(); });
        content.append(label, name, meta, action);
        infoWindowRef.current ??= new google.maps.InfoWindow();
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open({ map, anchor: marker });
      });
      return marker;
    });
    const clusterer = new MarkerClusterer({ map, markers });
    return () => {
      infoWindowRef.current?.close();
      clusterer.clearMarkers();
      markers.forEach(marker => (marker.map = null));
    };
  }, [facilities, mapReady, openFacility]);

  const focusFacility = (facility: VisibleFacility) => {
    openFacility(facility);
    mapRef.current?.panTo({ lat: facility.latitude, lng: facility.longitude });
    mapRef.current?.setZoom(15);
    setShowMobileResults(false);
  };

  const loadMoreLiveFacilities = () => {
    const tokens = livePlaces.data?.nextPageTokens ?? [];
    if (!tokens.length || loadingMoreLivePlaces) return;
    setLoadingMoreLivePlaces(true);
    window.setTimeout(() => setLivePageTokens(tokens), 1_700);
  };

  const locateUser = () => {
    if (!navigator.geolocation) return toast.error("La géolocalisation n’est pas prise en charge par votre navigateur.");
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(location);
        mapRef.current?.panTo(location);
        mapRef.current?.setZoom(13);
      },
      error => {
        const messages: Record<number, string> = { 1: "La géolocalisation a été refusée. Autorisez-la dans votre navigateur puis réessayez.", 2: "Votre position n’est pas disponible actuellement.", 3: "La géolocalisation a expiré. Réessayez dans quelques instants." };
        toast.error(messages[error.code] || "La géolocalisation a échoué.");
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  const startMapRoute = useCallback((destination: { latitude: number; longitude: number }, travelMode: RouteTravelMode) => {
    const fallback = () => {
      window.open(buildRouteFallbackUrl({ lat: destination.latitude, lng: destination.longitude }, travelMode), "_blank", "noopener,noreferrer");
    };
    const render = (origin: { lat: number; lng: number }) => {
      const response = requestNativeMapRoute({
        api: window.google?.maps as unknown as DirectionsApi | undefined,
        map: mapRef.current,
        renderer: directionsRendererRef.current ?? undefined,
        origin,
        destination: { lat: destination.latitude, lng: destination.longitude },
        travelMode,
        onSuccess: result => {
          const leg = result.routes[0]?.legs?.[0];
          setRouteStatus(`Itinéraire ${travelMode === "DRIVING" ? "en voiture" : travelMode === "WALKING" ? "à pied" : "à vélo"}${leg?.duration?.text ? ` · ${leg.duration.text}` : ""}${leg?.distance?.text ? ` · ${leg.distance.text}` : ""}`);
        },
        onFailure: () => {
          setRouteStatus(undefined);
          toast.error("Le tracé n’a pas pu être calculé ; ouverture de Google Maps.");
          fallback();
        },
      });
      if (!response.started) {
        toast.error("Le tracé natif est indisponible ; l’itinéraire s’ouvre dans Google Maps.");
        fallback();
        return;
      }
      setRouteStatus("Calcul de l’itinéraire en cours…");
      directionsRendererRef.current = response.renderer as google.maps.DirectionsRenderer;
    };
    if (userLocation) return render(userLocation);
    if (!navigator.geolocation) {
      toast.error("Votre navigateur ne fournit pas la position nécessaire au tracé.");
      fallback();
      return;
    }
    setRouteStatus("Demande de votre position pour calculer l’itinéraire…");
    navigator.geolocation.getCurrentPosition(
      position => {
        const origin = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(origin);
        render(origin);
      },
      () => {
        setRouteStatus(undefined);
        toast.error("La position a été refusée ; l’itinéraire s’ouvre dans Google Maps.");
        fallback();
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [userLocation]);

  const requestSos = useCallback((destination: { latitude: number; longitude: number; facilityId?: number; googlePlaceId?: string }) => {
    if (!isAuthenticated) return navigate("/connexion");
    const submit = (location: { lat: number; lng: number }) => sosAlert.mutate({ ...destination, location, consent: true });
    if (userLocation) return submit(userLocation);
    if (!navigator.geolocation) return toast.error("Votre position est nécessaire pour identifier les formations sanitaires les plus proches.");
    navigator.geolocation.getCurrentPosition(
      position => submit({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => toast.error("La géolocalisation est requise pour cibler les établissements proches lors d’un SOS."),
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  }, [isAuthenticated, navigate, sosAlert, userLocation]);

  const isDrawerOpen = Boolean(selectedLocalId || selectedPlaceId);
  const drawerDetail = selectedDetail;
  const drawerLoading = selectedLocalId ? indexedDetail.isLoading : liveDetail.isLoading;
  const loadingResults = places.isLoading || livePlaces.isLoading;

  return (
    <main className="relative h-dvh overflow-hidden bg-slate-100">
      <MapView initialCenter={CAMEROON_CENTER} initialZoom={6} onMapReady={onMapReady} className="absolute inset-0 h-full w-full" />
      {mapsConfigurationMissing && <div role="status" className="fixed left-3 right-3 top-[78px] z-40 mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-900 shadow-lg"><strong>Services cartographiques non configurés.</strong> Ajoutez le proxy Maps Manus côté serveur et côté frontend, puis republiez. Les données locales et les résultats en cache restent consultables.</div>}
      {!mapsConfigurationMissing && mapsQuotaExhausted && <div role="status" className="fixed left-3 right-3 top-[78px] z-40 mx-auto max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-5 text-amber-900 shadow-lg"><strong>Service cartographique temporairement limité.</strong> Le quota Maps est épuisé pour le moment. Les données déjà chargées restent consultables. {quotaCooldownSeconds > 0 ? `Nouvelle tentative automatique dans environ ${quotaCooldownSeconds} seconde(s).` : "Une nouvelle tentative sera effectuée automatiquement."}</div>}
      <button type="button" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu" className="fixed left-4 top-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-white text-[#102b46] ring-1 ring-slate-200 hover:bg-slate-50"><Menu className="h-5 w-5" /></button>
      <button type="button" onClick={() => navigate(isAuthenticated ? "/espace-patient" : "/connexion")} aria-label={isAuthenticated ? "Ouvrir mon espace" : "Se connecter"} className="fixed right-4 top-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-white text-[#102b46] ring-1 ring-slate-200 hover:bg-slate-50"><UserCircle className="h-6 w-6" /></button>
      <section className="fixed left-20 right-20 top-4 z-20 md:left-[calc(50%-340px)] md:right-auto md:w-[680px]">
        <div className="relative max-w-2xl rounded-full border border-slate-200 bg-white p-1">
          <Search className="pointer-events-none absolute left-5 top-5 h-5 w-5 text-slate-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un hôpital, une ville, un quartier…" className="h-11 w-full rounded-xl bg-slate-50 pl-10 pr-10 text-sm text-slate-900 outline-none ring-[#0b8a96] placeholder:text-slate-400 focus:ring-2" />
          {search && <button onClick={() => setSearch("")} className="absolute right-4 top-4 rounded-full p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>}
          {autocomplete.data?.length ? <div className="absolute left-0 right-0 top-[58px] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2"><p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Suggestions · Cameroun</p>{autocomplete.data.slice(0, 5).map(prediction => <button key={prediction.place_id} onClick={() => setSearch(prediction.structured_formatting?.main_text || prediction.description)} className="flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#eefbfc]"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#0b8a96]" /><span><span className="block text-sm font-semibold text-slate-800">{prediction.structured_formatting?.main_text || prediction.description}</span><span className="block text-xs text-slate-500">{prediction.structured_formatting?.secondary_text}</span></span></button>)}</div> : null}
        </div>
        <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {Object.entries(categoryVisuals).map(([id, visual]) => { const Icon = visual.Icon; return <button key={id} onClick={() => setCategory(id as VisibleCategory)} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition ${category === id ? "border-[#0b8a96] bg-[#0b8a96] text-white" : "border-slate-200 bg-white text-slate-700 hover:border-[#0b8a96] hover:text-[#087f8c]"}`}><Icon className="h-4 w-4" />{visual.label}</button>; })}
        </div>
      </section>
      {!isDrawerOpen && <section className={`fixed z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white md:bottom-4 md:left-4 md:top-[78px] md:w-[380px] ${showMobileResults ? "bottom-4 left-3 right-3 max-h-[48vh]" : "bottom-4 left-3 right-auto"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0b8a96]">Établissements chargés dans la zone</p><h1 className="mt-1 text-lg font-bold text-[#102b46]">Formations sanitaires <span className="text-sm font-semibold text-[#0b8a96]">({loadingResults ? "…" : facilities.length})</span></h1>{!loadingResults && <p className="mt-1 text-[11px] text-slate-500">{userLocation ? "Autour de votre position" : `${livePlaces.data?.searchedSectors ?? 0} secteurs explorés`} · déplacez la carte pour changer de zone</p>}</div><button onClick={() => setShowMobileResults(value => !value)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 md:hidden"><Menu className="h-5 w-5" /></button></div>
        <div className="max-h-[calc(48vh-76px)] overflow-y-auto p-2 md:max-h-[calc(100vh-98px)]">
          {loadingResults ? <p className="p-4 text-sm text-slate-500">Recherche des établissements…</p> : facilities.length ? <><div>{facilities.map(facility => <button key={facility.key} onClick={() => focusFacility(facility)} className="w-full rounded-xl p-3 text-left transition hover:bg-[#eefbfc]"><div className="flex items-start gap-3"><span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: (categoryVisuals[facility.category as VisibleCategory] ?? categoryVisuals.all).color }}><MapPin className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate font-semibold text-slate-800">{facility.name}</span>{facility.distanceKm !== null && <span className="shrink-0 text-xs text-slate-500">{facility.distanceKm} km</span>}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{facility.categoryLabel || facility.category.replaceAll("_", " ")} · {facility.city || facility.address}</span><span className="mt-2 flex items-center gap-2 text-xs"><span className="font-semibold text-amber-600">★ {stars(facility.medisecoursRating ?? facility.googleRating)}</span><span className={facility.isOpenNow ? "font-medium text-emerald-600" : "font-medium text-slate-500"}>{facility.isOpenNow ? "Ouvert" : "Horaires à vérifier"}</span>{facility.isLive && <span className="font-medium text-[#0b8a96]">Google Maps</span>}</span></span></div></button>)}</div>{livePlaces.data?.nextPageTokens?.length ? <button type="button" onClick={loadMoreLiveFacilities} disabled={loadingMoreLivePlaces} className="mx-2 mb-2 mt-1 w-[calc(100%-1rem)] rounded-xl border border-[#0b8a96] bg-[#eefbfc] px-3 py-3 text-sm font-semibold text-[#087f8c] transition hover:bg-[#dff7fa] disabled:cursor-wait disabled:opacity-60">{loadingMoreLivePlaces ? "Recherche de résultats supplémentaires…" : "Afficher davantage d’établissements dans cette zone"}</button> : null}</> : <div className="p-4"><div className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Aucun établissement ne correspond à cette recherche. Essayez une ville, un quartier ou une autre catégorie médicale.</div></div>}
        </div>
      </section>}
      {sosTargets.length > 0 && <aside role="alert" className="fixed bottom-4 left-3 right-3 z-50 mx-auto max-h-[58dvh] max-w-md overflow-y-auto rounded-3xl border border-rose-200 bg-white p-4 shadow-2xl md:bottom-6 md:right-6 md:left-auto"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-rose-700">SOS enregistré</p><h2 className="mt-1 text-lg font-bold text-[#102b46]">Établissements proches à joindre</h2><p className="mt-1 text-sm leading-5 text-slate-600">Le propriétaire est alerté. Utilisez les actions ci-dessous pour joindre directement une formation sanitaire.</p></div><button type="button" onClick={() => setSosTargets([])} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer les contacts SOS"><X className="h-5 w-5" /></button></div><div className="mt-4 space-y-2">{sosTargets.map(target => { const phone = target.phones?.[0]; return <article key={target.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold text-[#102b46]">{target.name}</p><p className="mt-1 truncate text-xs text-slate-500">{target.address}</p><p className="mt-1 text-xs font-bold text-[#087f8c]">{target.distanceKm.toLocaleString("fr-CM", { maximumFractionDigits: 1 })} km</p></div>{phone ? <div className="flex shrink-0 gap-2"><a href={buildSosContactHref(phone, "call")} className="grid h-10 w-10 place-items-center rounded-xl bg-[#0b8a96] text-white" aria-label={`Appeler ${target.name}`}><Phone className="h-4 w-4" /></a><a href={buildSosContactHref(phone, "sms")} className="grid h-10 w-10 place-items-center rounded-xl bg-[#102b46] text-white" aria-label={`Envoyer un SMS à ${target.name}`}><MessageSquare className="h-4 w-4" /></a></div> : <span className="rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800">Contact à vérifier</span>}</div></article>; })}</div></aside>}
      {routeStatus && <div className="fixed bottom-16 right-4 z-20 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-[#b8e9ed] bg-white px-4 py-3 text-sm text-[#135b64] shadow-xl"><Navigation className="h-4 w-4 shrink-0 text-[#087f8c]" /><span>{routeStatus}</span><button type="button" onClick={() => { directionsRendererRef.current?.setMap(null); setRouteStatus(undefined); }} className="rounded-lg px-2 py-1 text-xs font-bold text-[#087f8c] hover:bg-[#eefbfc]">Fermer</button></div>}
      {isDrawerOpen && <FacilityDrawer detail={drawerDetail as never} loading={drawerLoading} isAuthenticated={isAuthenticated} similar={(similarPlaces.data ?? []) as SimilarFacility[]} onOpenSimilar={openSimilar} onContributionPublished={() => { void indexedDetail.refetch(); void places.refetch(); }} onRouteRequest={startMapRoute} onSosRequest={requestSos} onClose={() => { setSelectedLocalId(undefined); setSelectedPlaceId(undefined); }} />}
      <div className="fixed bottom-4 left-4 z-30 flex items-end gap-2">
        <div className="relative">
          <button type="button" onClick={() => setLayersOpen(value => !value)} className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#102b46] ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Calques"><Layers3 className="h-5 w-5" /></button>
          {layersOpen && <div className="absolute bottom-14 left-0 w-56 rounded-2xl border border-slate-200 bg-white p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Calques</p>
            {([
              ["Trafic", trafficLayer, setTrafficLayer],
              ["Transports", transitLayer, setTransitLayer],
              ["Vélo", bicyclingLayer, setBicyclingLayer],
            ] as const).map(([label, enabled, setter]) => <label key={label} className="flex cursor-pointer items-center justify-between rounded-xl px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"><span>{label}</span><input type="checkbox" checked={enabled} onChange={event => setter(event.target.checked)} className="h-4 w-4 accent-[#0b8a96]" /></label>)}
          </div>}
        </div>
        <span className="rounded-lg bg-white/90 px-2 py-1 text-[10px] text-slate-500">MediSecours Maps</span>
      </div>
      <div className="fixed bottom-4 right-4 z-30 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <button type="button" onClick={() => mapRef.current?.setZoom((mapRef.current?.getZoom() ?? 6) + 1)} className="grid h-11 w-11 place-items-center text-[#102b46] hover:bg-slate-50" aria-label="Zoom avant"><Plus className="h-5 w-5" /></button>
        <div className="h-px bg-slate-200" />
        <button type="button" onClick={() => mapRef.current?.setZoom((mapRef.current?.getZoom() ?? 6) - 1)} className="grid h-11 w-11 place-items-center text-[#102b46] hover:bg-slate-50" aria-label="Zoom arrière"><Minus className="h-5 w-5" /></button>
      </div>
      <button type="button" onClick={locateUser} className="fixed bottom-4 right-20 z-30 grid h-11 w-11 place-items-center rounded-full border border-slate-200 bg-white text-[#087f8c] hover:bg-slate-50" aria-label="Me localiser"><LocateFixed className="h-5 w-5" /></button>
      {menuOpen && <div className="fixed inset-0 z-[80] bg-slate-950/30" onClick={() => setMenuOpen(false)}>
        <aside className="h-full w-[min(86vw,360px)] border-r border-slate-200 bg-white p-5" onClick={event => event.stopPropagation()}>
          <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.14em] text-[#0b8a96]">MediSecours</p><h2 className="mt-1 text-xl font-bold text-[#102b46]">Navigation</h2></div><button type="button" onClick={() => setMenuOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="Fermer le menu"><X className="h-5 w-5" /></button></div>
          <nav className="mt-6 space-y-1">
            {[
              ["Carte", "/carte", MapPin],
              ["Enregistrés", "/espace-patient", Bookmark],
              ["Historique", "/espace-patient", Clock3],
              ["Messages", "/messages", MessageSquare],
              ["Mon espace", isAuthenticated ? "/espace-patient" : "/connexion", UserCircle],
            ].map(([label, href, Icon]) => <button key={String(label)} type="button" onClick={() => { setMenuOpen(false); navigate(String(href)); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-[#eefbfc] hover:text-[#087f8c]"><Icon className="h-5 w-5" />{label}</button>)}
          </nav>
          <div className="mt-8 rounded-2xl bg-[#eefbfc] p-4 text-sm leading-6 text-slate-600">Recherchez les formations sanitaires du Cameroun, consultez leurs avis et préparez votre itinéraire.</div>
        </aside>
      </div>}
    </main>
  );
}
