import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Search, X, Building2, Loader2 } from 'lucide-react';
import { useClientStore } from '../../store/clientStore';

interface ClientComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /** Client names already used in existing events — merged into the dropdown automatically */
  existingClients?: string[];
}

export default function ClientCombobox({ value, onChange, existingClients = [] }: ClientComboboxProps) {
  const { clients: dbClients, loading, fetchClients, addClient } = useClientStore();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch clients from DB on mount
  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  // Use DB clients + existing event clients (deduplicated)
  const dbClientNames = dbClients.map((c) => c.name);
  const allClients = [...new Set([
    ...dbClientNames,
    ...existingClients.filter(Boolean),
  ])].sort((a, b) =>
    a.localeCompare(b, 'fr', { sensitivity: 'base' })
  );

  const filtered = search.trim()
    ? allClients.filter((c) => c.toLowerCase().includes(search.toLowerCase()))
    : allClients;

  const searchNormalized = search.trim().toUpperCase();
  const exactMatch = allClients.some((c) => c.toUpperCase() === searchNormalized);
  const canCreate = search.trim().length > 0 && !exactMatch;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(client: string) {
    onChange(client);
    setSearch('');
    setOpen(false);
  }

  async function handleCreate() {
    const name = search.trim().toUpperCase();
    if (!name || creating) return;
    setCreating(true);
    try {
      await addClient({ name });
      onChange(name);
      setSearch('');
      setOpen(false);
    } catch (err) {
      console.error('Failed to create client:', err);
    } finally {
      setCreating(false);
    }
  }

  function handleClear() {
    onChange('');
    setSearch('');
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Input display */}
      <div
        className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus-within:ring-2 focus-within:ring-primary-500 focus-within:border-primary-500 bg-white cursor-pointer"
        onClick={() => {
          setOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      >
        <Building2 size={16} className="text-slate-400 flex-shrink-0" />
        {open ? (
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (filtered.length > 0 && !canCreate) {
                  handleSelect(filtered[0]);
                } else if (canCreate) {
                  handleCreate();
                }
              }
              if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
            className="flex-1 outline-none bg-transparent text-sm placeholder-slate-400"
            placeholder="Rechercher un client..."
            autoFocus
          />
        ) : (
          <span className={`flex-1 truncate ${value ? 'text-slate-900' : 'text-slate-400'}`}>
            {value || 'Sélectionner un client'}
          </span>
        )}
        {value && !open && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-0.5 hover:bg-slate-100 rounded"
          >
            <X size={14} className="text-slate-400" />
          </button>
        )}
        {loading ? (
          <Loader2 size={16} className="text-slate-400 animate-spin flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className={`text-slate-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-xl border border-slate-200 shadow-xl max-h-64 overflow-auto">
          {/* Search hint */}
          {search && (
            <div className="px-3 py-1.5 text-xs text-slate-400 border-b border-slate-100 flex items-center gap-1.5">
              <Search size={12} />
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </div>
          )}

          {/* Results */}
          {filtered.map((client) => (
            <button
              key={client}
              type="button"
              onClick={() => handleSelect(client)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-primary-50 transition-colors flex items-center gap-2 ${
                client === value ? 'bg-primary-50 text-primary-700 font-medium' : 'text-slate-700'
              }`}
            >
              <Building2 size={14} className={client === value ? 'text-primary-500' : 'text-slate-300'} />
              <span className="truncate">{client}</span>
            </button>
          ))}

          {/* No results */}
          {filtered.length === 0 && !canCreate && (
            <div className="px-3 py-4 text-center text-sm text-slate-400">Aucun client trouvé</div>
          )}

          {/* Create new */}
          {canCreate && (
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="w-full text-left px-3 py-2.5 text-sm bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium transition-colors flex items-center gap-2 border-t border-slate-100 disabled:opacity-50"
            >
              {creating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              <span>Créer « {search.trim().toUpperCase()} »</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
