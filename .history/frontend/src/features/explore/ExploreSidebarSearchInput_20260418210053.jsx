/**
 * Left sidebar search with typeahead (California monitored beaches, data.ca.gov).
 * Enter (no highlighted row) geocodes the text and moves/zooms the Google map on `/explore`.
 */
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useExploreMapsApi } from "./ExploreMapsApiContext";
import { EXPLORE_MAP_ZOOM_FROM_SEARCH } from "./exploreMapSearchParams";

/**
 * @param {{
 *   query: string;
 *   setQuery: (q: string) => void;
 *   typeaheadItems: { key: string; kind: string; title: string; subtitle: string; onPick: () => void }[];
 *   typeaheadLoading?: boolean;
 *   typeaheadError?: string | null;
 *   mapGeocodeEnabled?: boolean;
 * }} props
 */
export default function ExploreSidebarSearchInput({
  query,
  setQuery,
  typeaheadItems,
  typeaheadLoading = false,
  typeaheadError = null,
  mapGeocodeEnabled = false
}) {
  const listId = useId();
  const inputRef = useRef(null);
  const [, setSearchParams] = useSearchParams();
  const { hasKey, ready } = useExploreMapsApi();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const q = query.trim();
  const showList = open && q.length >= 1 && (typeaheadItems.length > 0 || typeaheadLoading || !!typeaheadError);

  const applyMapFromLatLng = useCallback(
    (lat, lng, labelText) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev.toString());
          p.set("mlat", lat.toFixed(6));
          p.set("mlng", lng.toFixed(6));
          p.set("mz", String(EXPLORE_MAP_ZOOM_FROM_SEARCH));
          if (labelText) p.set("q", labelText);
          return p;
        },
        { replace: true }
      );
      if (labelText) setQuery(labelText);
    },
    [setSearchParams, setQuery]
  );

  const runGeocodeForQuery = useCallback(
    (text) => {
      if (!mapGeocodeEnabled || !hasKey || !ready || !window.google?.maps?.Geocoder) return;
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ address: `${text}, California, USA`, region: "us" }, (results, status) => {
        if (status !== "OK" || !results?.[0]?.geometry?.location) return;
        const loc = results[0].geometry.location;
        applyMapFromLatLng(loc.lat(), loc.lng(), text);
      });
    },
    [applyMapFromLatLng, hasKey, mapGeocodeEnabled, ready]
  );

  useEffect(() => {
    setActiveIdx(-1);
  }, [query, typeaheadItems.length]);

  const closeSoon = useCallback(() => {
    window.setTimeout(() => setOpen(false), 180);
  }, []);

  const pick = useCallback((fn) => {
    fn();
    setOpen(false);
    inputRef.current?.blur();
  }, []);

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      if (showList) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }

    if (e.key === "Enter") {
      if (showList && typeaheadItems.length > 0 && activeIdx >= 0 && activeIdx < typeaheadItems.length) {
        e.preventDefault();
        pick(typeaheadItems[activeIdx].onPick);
        return;
      }
      if (mapGeocodeEnabled && hasKey && ready && q.length >= 1) {
        e.preventDefault();
        runGeocodeForQuery(q);
        setOpen(false);
        return;
      }
    }

    if (!showList && (e.key === "ArrowDown" || e.key === "ArrowUp") && q.length >= 1 && typeaheadItems.length > 0) {
      setOpen(true);
    }
    if (!showList || typeaheadItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, typeaheadItems.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    }
  };

  return (
    <div className="ex-search-wrap">
      <input
        ref={inputRef}
        id={`${listId}-input`}
        className="ex-search"
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={showList ? `${listId}-listbox` : undefined}
        aria-activedescendant={activeIdx >= 0 ? `${listId}-opt-${activeIdx}` : undefined}
        aria-autocomplete="list"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={closeSoon}
        onKeyDown={onKeyDown}
        placeholder={
          mapGeocodeEnabled && hasKey && ready
            ? "Type a beach — pick a hint or press Enter to find on map"
            : "Type a beach name — suggestions appear as you type"
        }
        aria-label="Search beaches; choose a hint or press Enter to locate on map"
        autoComplete="off"
      />

      {showList && (
        <div
          id={`${listId}-listbox`}
          className="ex-typeahead"
          role="listbox"
          aria-label="Beach suggestions"
          onMouseDown={(e) => e.preventDefault()}
        >
          {typeaheadError && (
            <div className="ex-typeahead-status ex-typeahead-status--error" role="status">
              {typeaheadError}
            </div>
          )}
          {typeaheadLoading && (
            <div className="ex-typeahead-status" role="status">
              Searching California beach list…
            </div>
          )}
          {!typeaheadLoading &&
            !typeaheadError &&
            typeaheadItems.length === 0 &&
            q.length >= 1 && (
              <div className="ex-typeahead-status">No matches yet — keep typing or try another spelling.</div>
            )}
          {typeaheadItems.map((item, idx) => (
            <button
              key={item.key}
              type="button"
              id={`${listId}-opt-${idx}`}
              role="option"
              aria-selected={idx === activeIdx}
              className={`ex-typeahead-option ${idx === activeIdx ? "is-active" : ""}`}
              onMouseEnter={() => setActiveIdx(idx)}
              onClick={() => pick(item.onPick)}
            >
              <span className="ex-typeahead-title">{item.title}</span>
              {item.kind === "ca" && <span className="ex-typeahead-badge">CA data</span>}
              {item.kind === "mock" && <span className="ex-typeahead-badge">Demo</span>}
              <span className="ex-typeahead-sub">{item.subtitle}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
