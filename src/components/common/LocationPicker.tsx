import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Search, Loader2, X } from 'lucide-react';

// Fix default marker icon (leaflet icons break with bundlers)
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

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

/** Moves the map view when position changes */
function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 16);
  }, [map, lat, lng]);
  return null;
}

export default function LocationPicker({ address, latitude, longitude, onUpdate }: LocationPickerProps) {
  const [query, setQuery] = useState(address);
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync query when address prop changes externally
  useEffect(() => {
    setQuery(address);
  }, [address]);

  // Close results dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const searchAddress = useCallback(async (q: string) => {
    if (q.trim().length < 3) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: q.trim(),
        format: 'json',
        addressdetails: '1',
        limit: '5',
        countrycodes: 'fr',
      });
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: { 'Accept-Language': 'fr' },
      });
      if (resp.ok) {
        const data: NominatimResult[] = await resp.json();
        setResults(data);
        setShowResults(true);
      }
    } catch {
      // silently ignore network errors
    } finally {
      setSearching(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    onUpdate({ address: value });
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchAddress(value), 400);
  };

  const selectResult = (result: NominatimResult) => {
    setQuery(result.display_name);
    setShowResults(false);
    setResults([]);
    onUpdate({
      address: result.display_name,
      latitude: parseFloat(result.lat).toFixed(6),
      longitude: parseFloat(result.lon).toFixed(6),
    });
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    onUpdate({ address: '', latitude: '', longitude: '' });
  };

  const hasCoords = latitude && longitude && !isNaN(parseFloat(latitude)) && !isNaN(parseFloat(longitude));
  const lat = hasCoords ? parseFloat(latitude) : 48.8566;
  const lng = hasCoords ? parseFloat(longitude) : 2.3522;

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
            required
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
          <div className="absolute z-[1000] mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-lg max-h-[200px] overflow-y-auto">
            {results.map((r) => (
              <button
                key={r.place_id}
                type="button"
                onClick={() => selectResult(r)}
                className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-700 transition-colors border-b border-slate-100 last:border-0"
              >
                <MapPin size={13} className="inline mr-1.5 text-slate-400" />
                {r.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="rounded-xl overflow-hidden border border-slate-200" style={{ height: 220 }}>
        <MapContainer
          center={[lat, lng]}
          zoom={hasCoords ? 16 : 5}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {hasCoords && (
            <>
              <Marker position={[lat, lng]} />
              <MapUpdater lat={lat} lng={lng} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Lat/Lng display (read-only) */}
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
