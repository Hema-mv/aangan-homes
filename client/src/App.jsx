import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { useLiveEvents } from "./hooks/useLiveEvents.js";
import { useDebounced } from "./hooks/useDebounced.js";
import { canAddToCompare } from "./lib/compare.js";
import { money } from "./lib/format.js";
import Header from "./components/Header.jsx";
import Filters from "./components/Filters.jsx";
import ListingCard from "./components/ListingCard.jsx";
import MapView from "./components/MapView.jsx";
import DetailDialog from "./components/DetailDialog.jsx";
import PostDialog from "./components/PostDialog.jsx";
import EnquiriesDialog from "./components/EnquiriesDialog.jsx";
import CompareTray from "./components/CompareTray.jsx";
import CompareDialog from "./components/CompareDialog.jsx";
import Toast from "./components/Toast.jsx";

const DEFAULT_FILTERS = { deal: "buy", city: "Chennai", q: "", bhk: [], type: "", maxPrice: "", status: "", sort: "new" };
const FRESH_MS = 12_000;

export default function App() {
  const [cities, setCities] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [savedOnly, setSavedOnly] = useState(false);
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Per-browser state (no accounts yet): saved homes, compare set, enquiries sent, listings posted.
  const [saved, setSaved] = useLocalStorage("saved", []);
  const [storedCompare, setStoredCompare] = useLocalStorage("compare", []);
  const [enquiryIds, setEnquiryIds] = useLocalStorage("enquiries", []);
  const [mine, setMine] = useLocalStorage("mine", []);

  const [compareItems, setCompareItems] = useState([]);
  const compareHydrated = useRef(false);
  const [detail, setDetail] = useState(null);
  const [dialog, setDialog] = useState(null); // "post" | "enquiries" | "compare" | null
  const [hotId, setHotId] = useState(null);
  const [view, setView] = useState("list");
  const [fresh, setFresh] = useState(() => new Set());
  const [toast, setToast] = useState(null);

  const showToast = useCallback((text) => setToast({ id: Date.now(), text }), []);
  const clearToast = useCallback(() => setToast(null), []);
  const markFresh = useCallback((id) => {
    setFresh((s) => new Set(s).add(id));
    setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(id); return n; }), FRESH_MS);
  }, []);

  const q = useDebounced(filters.q);
  const city = cities?.find((c) => c.name === filters.city);

  // ---- data loading ----
  useEffect(() => {
    api.cities().then(setCities).catch((e) => setError(e.message));
    if (storedCompare.length) {
      api.listings({ ids: storedCompare })
        .then((items) => setCompareItems(storedCompare.map((id) => items.find((l) => l.id === id)).filter(Boolean)))
        .catch(() => {})
        .finally(() => { compareHydrated.current = true; });
    } else {
      compareHydrated.current = true;
    }
  }, []); // mount only: storedCompare is read once to hydrate

  useEffect(() => {
    if (compareHydrated.current) setStoredCompare(compareItems.map((l) => l.id));
  }, [compareItems, setStoredCompare]);

  const queryKey = JSON.stringify({ ...filters, q, ids: savedOnly ? saved : undefined });
  useEffect(() => {
    if (savedOnly && !saved.length) { setListings([]); setLoading(false); return; }
    const ctrl = new AbortController();
    setLoading(true);
    api.listings(JSON.parse(queryKey), ctrl.signal)
      .then((items) => { if (!ctrl.signal.aborted) { setListings(items); setError(null); } })
      .catch((e) => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!ctrl.signal.aborted) setLoading(false); });
    return () => ctrl.abort();
  }, [queryKey, reloadKey, savedOnly, saved.length]);

  // ---- live updates ----
  const patchListing = (id, patch) => {
    const apply = (l) => (l.id === id ? { ...l, ...patch } : l);
    setListings((ls) => ls.map(apply));
    setCompareItems((ls) => ls.map(apply));
    setDetail((d) => (d && d.id === id ? { ...d, ...patch } : d));
  };

  const live = useLiveEvents({
    "listing:created": (l) => {
      // Locality rates (and possibly a brand-new locality) change with every listing.
      api.cities().then(setCities).catch(() => {});
      if (!mine.includes(l.id)) {
        showToast(`New ${l.deal === "buy" ? "for sale" : "to rent"} in ${l.locality}, ${l.city} · ${money(l.price)}`);
      }
      if (l.deal === filters.deal && l.city === filters.city && !savedOnly) {
        markFresh(l.id);
        setReloadKey((k) => k + 1);
      }
    },
    "listing:activity": ({ id, enquiryCount }) => patchListing(id, { enquiryCount }),
    // Back online after a dropped connection: catch up on anything we missed.
    resync: () => {
      api.cities().then(setCities).catch(() => {});
      setReloadKey((k) => k + 1);
    },
  });

  // ---- actions ----
  const updateFilters = (patch) => setFilters((f) => ({ ...f, ...patch, ...(patch.deal && patch.deal !== f.deal ? { maxPrice: "" } : {}) }));

  const toggleSave = (l) => {
    const on = !saved.includes(l.id);
    setSaved(on ? [...saved, l.id] : saved.filter((id) => id !== l.id));
    showToast(on ? "Saved" : "Removed from saved");
  };

  const toggleCompare = (l) => {
    if (compareItems.some((x) => x.id === l.id)) {
      const next = compareItems.filter((x) => x.id !== l.id);
      setCompareItems(next);
      if (next.length < 2 && dialog === "compare") setDialog(null);
      return;
    }
    const msg = canAddToCompare(compareItems, l);
    if (msg) return showToast(msg);
    setCompareItems([...compareItems, l]);
  };

  const onCreated = (l) => {
    setMine([...mine, l.id]);
    setDialog(null);
    setSavedOnly(false);
    setFilters({ ...DEFAULT_FILTERS, deal: l.deal, city: l.city });
    markFresh(l.id);
    setReloadKey((k) => k + 1);
    showToast("Listing published. It's live for everyone now.");
  };

  const hoverPin = (id) => {
    setHotId(id);
    if (window.innerWidth > 980) document.querySelector(`.card[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  const median = listings.length ? [...listings].map((l) => l.price).sort((a, b) => a - b)[Math.floor(listings.length / 2)] : 0;
  const word = filters.deal === "buy" ? "for sale" : "for rent";

  return (
    <>
      <Header
        deal={filters.deal} onDeal={(deal) => updateFilters({ deal })}
        cities={cities} city={filters.city} onCity={(c) => updateFilters({ city: c, q: "" })}
        q={filters.q} onQ={(v) => updateFilters({ q: v })}
        savedCount={saved.length} savedOnly={savedOnly} onToggleSaved={() => setSavedOnly((s) => !s)}
        enquiryCount={enquiryIds.length} onEnquiries={() => setDialog("enquiries")}
        onPost={() => setDialog("post")} live={live}
      />
      <Filters filters={filters} onChange={updateFilters} />

      <main className={"wrap" + (compareItems.length ? " has-tray" : "")} data-view={view}>
        <div className="inner">
          <div className="listcol">
            <div className="summary">
              <div>
                <h1>{savedOnly ? "Saved homes " : "Homes "}{word} in {filters.city}</h1>
                <p aria-live="polite">
                  {loading && !listings.length ? "Loading listings…"
                    : listings.length ? `${listings.length} ${listings.length === 1 ? "listing" : "listings"} · median ${money(median)}${filters.deal === "rent" ? "/month" : ""}`
                    : "No listings match these filters"}
                </p>
              </div>
              <span className="sample">Sample listings · indicative locality rates</span>
            </div>
            <ViewTabs view={view} setView={setView} />
            {error && (
              <div className="banner" role="alert">
                <span>{error}</span>
                <button className="btn ghost sm" type="button" onClick={() => { setError(null); setReloadKey((k) => k + 1); }}>Retry</button>
              </div>
            )}
            <div className={"grid" + (loading ? " busy" : "")} aria-busy={loading}>
              {loading && !listings.length
                ? Array.from({ length: 6 }, (_, i) => <div className="card skeleton" key={i} aria-hidden="true" />)
                : listings.length
                  ? listings.map((l) => (
                    <ListingCard
                      key={l.id} listing={l}
                      hot={hotId === l.id} fresh={fresh.has(l.id)} saved={saved.includes(l.id)} mine={mine.includes(l.id)}
                      comparing={compareItems.some((x) => x.id === l.id)}
                      onOpen={() => setDetail(l)} onHover={() => setHotId(l.id)}
                      onToggleSave={() => toggleSave(l)} onToggleCompare={() => toggleCompare(l)}
                    />
                  ))
                  : !error && (
                    <div className="empty">
                      <b>No {savedOnly ? "saved " : ""}homes match.</b><br />
                      {savedOnly ? "Tap the heart on any listing to save it." : "Try a higher budget, another BHK, or clear the locality search."}
                    </div>
                  )}
            </div>
          </div>
          <aside className="mapcol">
            <ViewTabs view={view} setView={setView} />
            <div className="mapbox">
              <div className="maphead"><b>{filters.city} · {filters.deal === "rent" ? "rents" : "sale prices"}</b><span>Circles show avg ₹/sq ft by locality</span></div>
              <MapView city={city} deal={filters.deal} listings={listings} hotId={hotId} onHover={hoverPin} onOpen={setDetail} />
              <div className="legend">
                <span><i style={{ background: "var(--brand)" }} />Listing</span>
                <span><i style={{ background: "var(--accent)" }} />Selected</span>
                <span><i style={{ background: "transparent", border: "1.5px solid var(--muted)" }} />Locality rate</span>
              </div>
            </div>
          </aside>
        </div>
      </main>

      <CompareTray items={compareItems} onRemove={toggleCompare} onCompare={() => setDialog("compare")} onClear={() => setCompareItems([])} />

      <DetailDialog
        open={!!detail} listing={detail} city={cities?.find((c) => c.name === detail?.city)} onClose={() => setDetail(null)}
        comparing={!!detail && compareItems.some((x) => x.id === detail.id)} onToggleCompare={() => toggleCompare(detail)}
        onEnquirySent={(e) => setEnquiryIds([e.id, ...enquiryIds])} onCopied={() => showToast("Number copied")}
      />
      <PostDialog open={dialog === "post"} onClose={() => setDialog(null)} cities={cities} defaultCity={filters.city} onCreated={onCreated} />
      <EnquiriesDialog open={dialog === "enquiries"} onClose={() => setDialog(null)} ids={enquiryIds} />
      <CompareDialog
        open={dialog === "compare"} onClose={() => setDialog(null)} items={compareItems} cities={cities}
        onRemove={toggleCompare} onOpen={(l) => { setDialog(null); setDetail(l); }}
      />
      <Toast toast={toast} onDone={clearToast} />
    </>
  );
}

function ViewTabs({ view, setView }) {
  return (
    <div className="mobtabs" role="group" aria-label="View">
      <button className="chip" type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>List</button>
      <button className="chip" type="button" aria-pressed={view === "map"} onClick={() => setView("map")}>Map</button>
    </div>
  );
}
