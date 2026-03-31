import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Loader2, X } from 'lucide-react';

// Fix Leaflet default marker icons (broken by bundlers)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerProps {
  address: string;
  latitude: string;
  longitude: string;
  onUpdate: (fields: { address?: string; latitude?: string; longitude?: string }) => void;
}

interface GouvFeature {
  properties: {
    label: string;
    score: number;
    context: string;
  };
  geometry: {
    coordinates: [number, number]; // [lng, lat]
  };
}

/** Syncs map view when marker position changes */
function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 17, { animate: true });
  }, [map, lat, lng]);
  return null;
}

/** Handles click-on-map to drop marker */
function MapClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPicker({ address, latitude, longitude, onUpdate }: LocationPickerProps) {
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<GouvFeature[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync input when address prop changes externally
  useEffect(() => {
    setQuery(address);
  }, [address]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Search via api-adresse.data.gouv.fr (free, unlimited, official French data)
  const searchAddress = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: q.trim(), limit: '5' });
      const resp = await fetch(`https://api-adresse.data.gouv.fr/search/?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        setResults(data.features || []);
        setShowResults(true);
      }
    } catch {
      // silently ignore
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    onUpdate({ address: value });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(value), 350);
  };

  const selectResult = (feat: GouvFeature) => {
    const [lng, lat] = feat.geometry.coordinates;
    setQuery(feat.properties.label);
    setShowResults(false);
    setResults([]);
    onUpdate({
      address: feat.properties.label,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    });
  };

  // Reverse geocode on map click
  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    onUpdate({
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    });
    setSearching(true);
    try {
      const params = new URLSearchParams({ lat: lat.toString(), lon: lng.toString() });
      const resp = await fetch(`https://api-adresse.data.gouv.fr/reverse/?${params}`);
      if (resp.ok) {
        const data = await resp.json();
        const label = data.features?.[0]?.properties?.label;
        if (label) {
          setQuery(label);
          onUpdate({ address: label, latitude: lat.toFixed(6), longitude: lng.toFixed(6) });
        }
      }
    } catch {
      // keep coords even if reverse fails
    } finally {
      setSearching(false);
    }
  }, [onUpdate]);

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    onUpdate({ address: '', latitude: '', longitude: '' });
  };

  const hasCoords = latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude));
  const lat = hasCoords ? parseFloat(latitude) : 46.603354;
  const lng = hasCoords ? parseFloat(longitude) : 1.888334;
  const markerKey = `${latitude}-${longitude}`;

  return (
    <div className="sm:col-span-2 space-y-3">
      {/* Search bar */}
      <div ref={containerRef} className="relative">
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          <MapPin size={14} className="inline mr-1 text-primary-500" />
          Adresse *
        </label>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => results.length > 0 && setShowResults(true)}
            className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="Rechercher une adresse..."
          />
          {searching && (
            <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-500 animate-spin" />
          )}
          {!searching && query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Results dropdown */}
        {showResults && results.length > 0 && (
          <div className="absolute z-[1000] mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-[220px] overflow-y-auto">
            {results.map((feat, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectResult(feat)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors border-b border-slate-100 last:border-0"
              >
                <MapPin size={13} className="inline mr-1.5 text-slate-400" />
                <span className="text-slate-800 font-medium">{feat.properties.label}</span>
                <span className="text-slate-400 text-xs ml-2">{feat.properties.context}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map — OpenStreetMap (gratuit) */}
      <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 250 }}>
        <MapContainer
          center={[lat, lng]}
          zoom={hasCoords ? 17 : 6}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onClick={handleMapClick} />
          {hasCoords && (
            <>
              <Marker key={markerKey} position={[parseFloat(latitude), parseFloat(longitude)]} />
              <MapUpdater lat={parseFloat(latitude)} lng={parseFloat(longitude)} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Lat/Lng read-only */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Latitude</label>
          <input
            type="text"
            value={latitude}
            readOnly
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 outline-none cursor-default"
            placeholder="—"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-slate-500 mb-1">Longitude</label>
          <input
            type="text"
            value={longitude}
            readOnly
            className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-500 outline-none cursor-default"
            placeholder="—"
          />
        </div>
      </div>
    </div>
  );
}
