import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import blindsideLogo from "../data/images/blindside-logo.png";
import "./App.css";
import { catalog, teams } from "./lib/catalog";
import { collectionStore } from "./lib/collectionStore";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const CARD_NUMBER_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

const COLLECTION_VERSION = 1;
const PREFS_KEY = "blindside-prefs";

const prefsStore = {
  load() {
    try {
      const raw = localStorage.getItem(PREFS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },
  save(prefs) {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {}
  },
};

// ─────────────────────────────────────────────
// Routing
// ─────────────────────────────────────────────

function parseHashFull() {
  const raw = window.location.hash.slice(1);
  const [path, queryStr = ""] = raw.split("?");
  const match = path.match(/^\/set\/([^/]+)$/);
  const params = new URLSearchParams(queryStr);
  return {
    setId: match ? decodeURIComponent(match[1]) : null,
    owned: params.get("owned") ?? "all",
    type: params.get("type") ?? "all",
    rarity: params.get("rarity") ?? "all",
    q: params.get("q") ?? "",
    sort: params.get("sort") ?? "default",
  };
}

function buildHash(setId, filters) {
  if (!setId) return "#/";
  const params = new URLSearchParams();
  if (filters.owned !== "all") params.set("owned", filters.owned);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.rarity !== "all") params.set("rarity", filters.rarity);
  if (filters.q?.trim()) params.set("q", filters.q.trim());
  if (filters.sort !== "default") params.set("sort", filters.sort);
  const qs = params.toString();
  return `#/set/${encodeURIComponent(setId)}${qs ? "?" + qs : ""}`;
}

function useHashRoute() {
  const [routeState, setRouteState] = useState(() => parseHashFull());

  useEffect(() => {
    const handle = () => setRouteState(parseHashFull());
    window.addEventListener("hashchange", handle);
    return () => window.removeEventListener("hashchange", handle);
  }, []);

  const navigate = useCallback((setId, filters) => {
    const defaultFilters = {
      owned: "all",
      type: "all",
      rarity: "all",
      q: "",
      sort: "default",
    };
    const next = buildHash(setId, filters ?? defaultFilters);
    if (window.location.hash !== next) window.location.hash = next;
    setRouteState(parseHashFull());
  }, []);

  const updateFilters = useCallback((setId, filters) => {
    const next = buildHash(setId, filters);
    if (window.location.hash !== next) window.location.hash = next;
    setRouteState((prev) => ({ ...prev, ...filters }));
  }, []);

  return { routeState, navigate, updateFilters };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function timeAgo(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function buildSetStats(set, collection) {
  const setState = collection[set.id] ?? {};
  let ownedCount = 0;
  let totalQuantity = 0;
  let latestUpdate = null;

  set.cards.forEach((card) => {
    const q = setState[card.id]?.quantity ?? 0;
    if (q > 0) {
      ownedCount++;
      totalQuantity += q;
      const ts = setState[card.id]?.updatedAt;
      if (ts && (!latestUpdate || ts > latestUpdate)) latestUpdate = ts;
    }
  });

  return {
    ownedCount,
    totalQuantity,
    duplicateCount: totalQuantity - ownedCount,
    completion: set.totalCards === 0 ? 0 : (ownedCount / set.totalCards) * 100,
    lastUpdated: latestUpdate,
  };
}

function matchesSearch(card, rawQuery) {
  if (!rawQuery?.trim()) return true;
  const text =
    `${card.cardNumber} ${card.playerName} ${card.type} ${card.rarity}`.toLowerCase();
  return rawQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .every((word) => text.includes(word));
}

// ─────────────────────────────────────────────
// Team navigation content (reused in sidebar + drawer)
// ─────────────────────────────────────────────

function buildTeamTree(allSets) {
  const tree = {};
  allSets.forEach((set) => {
    if (!tree[set.teamName]) tree[set.teamName] = {};
    if (!tree[set.teamName][set.season]) tree[set.teamName][set.season] = [];
    tree[set.teamName][set.season].push(set);
  });
  return tree;
}

function TeamNavContent({ catalog, allSetStats, selectedSet, onSelectSet }) {
  const tree = useMemo(() => buildTeamTree(catalog), [catalog]);

  const [expandedTeam, setExpandedTeam] = useState(
    () => selectedSet?.teamName ?? teams[0] ?? null,
  );

  useEffect(() => {
    if (selectedSet?.teamName) setExpandedTeam(selectedSet.teamName);
  }, [selectedSet?.teamName]);

  return (
    <>
      <p className="eyebrow" style={{ marginBottom: "12px" }}>
        Browse Collections
      </p>
      {teams.map((teamName) => {
        const isOpen = expandedTeam === teamName;
        const seasons = tree[teamName] ?? {};
        const sortedSeasons = Object.keys(seasons).sort((a, b) =>
          b.localeCompare(a),
        );
        const teamSets = catalog.filter((s) => s.teamName === teamName);
        const teamOwned = teamSets.reduce(
          (sum, s) => sum + allSetStats[s.id].ownedCount,
          0,
        );
        const teamTotal = teamSets.reduce((sum, s) => sum + s.totalCards, 0);
        const teamCompletion =
          teamTotal === 0 ? 0 : (teamOwned / teamTotal) * 100;

        return (
          <div key={teamName} className="team-nav-group">
            <button
              type="button"
              className={`team-nav-header${isOpen ? " open" : ""}`}
              onClick={() => setExpandedTeam(isOpen ? null : teamName)}
              aria-expanded={isOpen}
            >
              <div className="team-nav-header-top">
                <strong>{teamName}</strong>
                <span className="team-nav-pct">
                  {formatPercent(teamCompletion)}
                </span>
              </div>
              <div className="team-nav-progress">
                <div className="progress-bar" aria-hidden="true">
                  <span style={{ width: `${teamCompletion}%` }} />
                </div>
                <span className="team-nav-count">
                  {teamOwned}/{teamTotal}
                </span>
              </div>
              <span className="team-nav-chevron" aria-hidden="true">
                {isOpen ? "▲" : "▼"}
              </span>
            </button>

            {isOpen && (
              <div className="team-nav-seasons">
                {sortedSeasons.map((season) => {
                  const sets = seasons[season];
                  return (
                    <div key={season} className="team-nav-season">
                      <p className="team-nav-season-label">{season}</p>
                      {sets.map((set) => {
                        const stats = allSetStats[set.id];
                        const isActive = selectedSet?.id === set.id;
                        const lastUpdatedLabel = timeAgo(stats.lastUpdated);
                        return (
                          <button
                            key={set.id}
                            type="button"
                            className={`team-nav-set-btn${isActive ? " active" : ""}`}
                            onClick={() => onSelectSet(set.id)}
                            aria-pressed={isActive}
                          >
                            <div className="team-nav-set-top">
                              <span className="team-nav-set-name">
                                {set.setName}
                              </span>
                              {stats.duplicateCount > 0 && (
                                <span className="dupe-badge">
                                  {stats.duplicateCount} dupe
                                  {stats.duplicateCount !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            <div className="team-nav-set-bottom">
                              <span>
                                {stats.ownedCount} / {set.totalCards}
                              </span>
                              <span>{formatPercent(stats.completion)}</span>
                            </div>
                            <div className="progress-bar" aria-hidden="true">
                              <span style={{ width: `${stats.completion}%` }} />
                            </div>
                            {lastUpdatedLabel && (
                              <span className="set-tile-updated">
                                Updated {lastUpdatedLabel}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────
// Mobile drawer
// ─────────────────────────────────────────────

function MobileDrawer({ open, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <>
      <div
        className={`drawer-backdrop${open ? " open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`drawer${open ? " open" : ""}`}
        aria-modal="true"
        role="dialog"
      >
        <div className="drawer-header">
          <p className="drawer-title">Collections</p>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// Lightbox
// ─────────────────────────────────────────────

function Lightbox({ src, alt, onClose }) {
  useEffect(() => {
    const handle = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <img
        className="lightbox-img"
        src={src}
        alt={alt}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ─────────────────────────────────────────────
// Shared components
// ─────────────────────────────────────────────

function CardArtwork({ card, set }) {
  const [missing, setMissing] = useState(false);
  const [lightbox, setLightbox] = useState(false);

  if (missing) {
    return (
      <div className="card-artwork placeholder" aria-hidden="true">
        <span>{card.cardNumber}</span>
        <strong>{card.type}</strong>
      </div>
    );
  }

  return (
    <>
      <img
        className="card-artwork card-artwork--clickable"
        src={card.imagePath}
        alt={`${card.playerName} card`}
        loading="lazy"
        onClick={() => setLightbox(true)}
        onError={(e) => {
          if (!e.target.src.endsWith(".jpg")) {
            e.target.src = card.imagePath.replace(/\.png$/, ".jpg");
          } else {
            setMissing(true);
          }
        }}
        data-folder={set.imageFolder}
      />
      {lightbox && (
        <Lightbox
          src={card.imagePath}
          alt={`${card.playerName} card`}
          onClose={() => setLightbox(false)}
        />
      )}
    </>
  );
}

function Toast({ message, visible }) {
  return (
    <div className={`toast${visible ? "" : " hidden"}`} aria-live="polite">
      {message}
    </div>
  );
}

function StorageWarning({ show }) {
  if (!show) return null;
  return (
    <div className="storage-warning" role="alert">
      ⚠️ Couldn't save your collection — browser storage may be full. Export a
      backup to avoid losing progress.
    </div>
  );
}

// ─────────────────────────────────────────────
// Set viewer
// ─────────────────────────────────────────────

function SetViewer({
  selectedSet,
  collection,
  onUpdateCardQuantity,
  onToast,
  routeState,
  onUpdateFilters,
  viewMode,
}) {
  const searchValue = routeState.q;
  const ownershipFilter = routeState.owned;
  const typeFilter = routeState.type;
  const rarityFilter = routeState.rarity;
  const sortOrder = routeState.sort;

  const [filtersOpen, setFiltersOpen] = useState(false);

  function setFilter(key, value) {
    onUpdateFilters({ ...routeState, [key]: value });
  }

  function clearFilters() {
    onUpdateFilters({
      ...routeState,
      owned: "all",
      type: "all",
      rarity: "all",
      q: "",
      sort: "default",
    });
  }

  const [clearPending, setClearPending] = useState(false);
  const clearTimer = useRef(null);

  function requestClear() {
    if (clearPending) {
      clearTimeout(clearTimer.current);
      setClearPending(false);
      clearAllVisible();
    } else {
      setClearPending(true);
      clearTimer.current = setTimeout(() => setClearPending(false), 3000);
    }
  }

  useEffect(() => {
    setClearPending(false);
    clearTimeout(clearTimer.current);
  }, [selectedSet?.id]);

  const selectedSetState = useMemo(
    () => (selectedSet ? (collection[selectedSet.id] ?? {}) : {}),
    [collection, selectedSet],
  );

  const selectedSetStats = useMemo(
    () =>
      selectedSet
        ? buildSetStats(selectedSet, collection)
        : { ownedCount: 0, totalQuantity: 0, duplicateCount: 0, completion: 0 },
    [collection, selectedSet],
  );

  const rarityProgress = useMemo(() => {
    if (!selectedSet) return [];
    return selectedSet.rarities.map((rarity) => {
      const cards = selectedSet.cards.filter((c) => c.rarity === rarity);
      const ownedCount = cards.filter(
        (c) => (selectedSetState[c.id]?.quantity ?? 0) > 0,
      ).length;
      return {
        rarity,
        totalCards: cards.length,
        ownedCount,
        completion: cards.length === 0 ? 0 : (ownedCount / cards.length) * 100,
      };
    });
  }, [selectedSet, selectedSetState]);

  const visibleCards = useMemo(() => {
    if (!selectedSet) return [];
    const filtered = selectedSet.cards.filter((card) => {
      const qty = selectedSetState[card.id]?.quantity ?? 0;
      const matchOwn =
        ownershipFilter === "all" ||
        (ownershipFilter === "owned" && qty > 0) ||
        (ownershipFilter === "missing" && qty === 0) ||
        (ownershipFilter === "duplicates" && qty > 1);
      const matchType = typeFilter === "all" || card.type === typeFilter;
      const matchRarity =
        rarityFilter === "all" || card.rarity === rarityFilter;
      return (
        matchesSearch(card, searchValue) && matchOwn && matchType && matchRarity
      );
    });

    return filtered.sort((a, b) => {
      if (sortOrder === "name") return a.playerName.localeCompare(b.playerName);
      if (sortOrder === "number")
        return CARD_NUMBER_COLLATOR.compare(a.cardNumber, b.cardNumber);
      if (sortOrder === "recent") {
        const tsA = selectedSetState[a.id]?.updatedAt ?? "";
        const tsB = selectedSetState[b.id]?.updatedAt ?? "";
        return tsB.localeCompare(tsA);
      }
      return (
        a.rarityRank - b.rarityRank ||
        CARD_NUMBER_COLLATOR.compare(a.cardNumber, b.cardNumber)
      );
    });
  }, [
    ownershipFilter,
    rarityFilter,
    searchValue,
    selectedSet,
    selectedSetState,
    sortOrder,
    typeFilter,
  ]);

  const filtersAreActive =
    searchValue.trim() !== "" ||
    ownershipFilter !== "all" ||
    typeFilter !== "all" ||
    rarityFilter !== "all";

  function markAllVisible() {
    onUpdateCardQuantity(selectedSet.id, null, null, (curr) => {
      const next = { ...curr };
      visibleCards.forEach((card) => {
        if ((next[card.id]?.quantity ?? 0) === 0) {
          next[card.id] = { quantity: 1, updatedAt: new Date().toISOString() };
        }
      });
      return next;
    });
    onToast(
      `Marked ${visibleCards.length} card${visibleCards.length !== 1 ? "s" : ""} as owned`,
    );
  }

  function clearAllVisible() {
    onUpdateCardQuantity(selectedSet.id, null, null, (curr) => {
      const next = { ...curr };
      visibleCards.forEach((card) => {
        if ((next[card.id]?.quantity ?? 0) > 0) {
          next[card.id] = { quantity: 0, updatedAt: new Date().toISOString() };
        }
      });
      return next;
    });
    onToast(
      `Cleared ${visibleCards.length} card${visibleCards.length !== 1 ? "s" : ""}`,
    );
  }

  if (!selectedSet) return null;

  const isListView = viewMode === "list";

  return (
    <section className="content">
      {/* Header */}
      <header className="content-header panel">
        <div>
          <p className="eyebrow">{selectedSet.season}</p>
          <h2>
            {selectedSet.teamName} {selectedSet.setName}
          </h2>
          <p className="section-copy">
            Track what you own, filter what is missing, and keep your checklist
            up to date.
          </p>
        </div>
        <div className="content-stats">
          {/* Always visible */}
          <div>
            <strong>{selectedSetStats.ownedCount}</strong>
            <span>owned</span>
          </div>
          <div>
            <strong>
              {selectedSet.totalCards - selectedSetStats.ownedCount}
            </strong>
            <span>missing</span>
          </div>
          <div>
            <strong>{formatPercent(selectedSetStats.completion)}</strong>
            <span>complete</span>
          </div>
          {/* Hidden on mobile */}
          <div className="stat-desktop-only">
            <strong>{selectedSet.totalCards}</strong>
            <span>in set</span>
          </div>
          <div className="stat-desktop-only">
            <strong>{selectedSetStats.totalQuantity}</strong>
            <span>total cards</span>
          </div>
          <div className="stat-desktop-only">
            <strong>{selectedSetStats.duplicateCount}</strong>
            <span>duplicates</span>
          </div>
        </div>
      </header>

      {/* Breakdown */}
      <section className="panel">
        <div className="panel-heading">
          <h2>Set Breakdown</h2>
          <span>{formatPercent(selectedSetStats.completion)}</span>
        </div>
        <div className="breakdown-overall">
          <div className="progress-bar progress-bar--lg" aria-hidden="true">
            <span style={{ width: `${selectedSetStats.completion}%` }} />
          </div>
        </div>
        <div className="breakdown-list">
          {rarityProgress.map((item) => (
            <article key={item.rarity} className="breakdown-row">
              <div>
                <strong>{item.rarity}</strong>
                <span>
                  {item.ownedCount} / {item.totalCards}
                </span>
              </div>
              <div className="progress-bar" aria-hidden="true">
                <span style={{ width: `${item.completion}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="panel filters-panel">
        <div className="filters-top">
          <input
            type="search"
            className="filters-search"
            value={searchValue}
            onChange={(e) => setFilter("q", e.target.value)}
            placeholder="Search player, number, type…"
            aria-label="Search cards"
          />
          <button
            type="button"
            className={`btn filters-toggle-btn${filtersAreActive ? " filters-active" : ""}`}
            onClick={() => setFiltersOpen((v) => !v)}
            aria-expanded={filtersOpen}
          >
            {filtersAreActive ? "Filters ●" : "Filters"}
          </button>
        </div>

        <div className={`filters-dropdowns${filtersOpen ? " open" : ""}`}>
          <select
            value={ownershipFilter}
            onChange={(e) => setFilter("owned", e.target.value)}
            aria-label="Filter by ownership"
          >
            <option value="all">All cards</option>
            <option value="owned">Owned only</option>
            <option value="missing">Missing only</option>
            <option value="duplicates">Duplicates only</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setFilter("type", e.target.value)}
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            {selectedSet.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={rarityFilter}
            onChange={(e) => setFilter("rarity", e.target.value)}
            aria-label="Filter by rarity"
          >
            <option value="all">All rarities</option>
            {selectedSet.rarities.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setFilter("sort", e.target.value)}
            aria-label="Sort order"
          >
            <option value="default">Sort: Default</option>
            <option value="name">Sort: Name A–Z</option>
            <option value="number">Sort: Card number</option>
            <option value="recent">Sort: Recently added</option>
          </select>
        </div>

        <p className="filter-count">
          Showing {visibleCards.length} of {selectedSet.totalCards} card
          {selectedSet.totalCards !== 1 ? "s" : ""}
          {filtersAreActive && (
            <>
              {" "}
              (filtered) —{" "}
              <button type="button" className="link-btn" onClick={clearFilters}>
                clear filters
              </button>
            </>
          )}
        </p>
      </section>

      {/* Bulk actions */}
      {visibleCards.length > 0 && (
        <div className="bulk-actions">
          <span>
            {filtersAreActive
              ? `${visibleCards.length} filtered card${visibleCards.length !== 1 ? "s" : ""}`
              : `All ${visibleCards.length} card${visibleCards.length !== 1 ? "s" : ""}`}
          </span>
          <button
            type="button"
            className="btn btn-dark bulk-btn"
            onClick={markAllVisible}
          >
            Mark all as owned
          </button>
          <button
            type="button"
            className={`btn bulk-btn${clearPending ? " btn-danger" : ""}`}
            onClick={requestClear}
            title={
              clearPending
                ? "Tap again to confirm clear"
                : "Remove all from collection"
            }
          >
            {clearPending ? "Tap again to confirm" : "Clear all"}
          </button>
        </div>
      )}

      {visibleCards.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-title">No cards match your filters</p>
          <p className="empty-state-sub">
            Try adjusting the search or filter options above.
          </p>
          <button type="button" className="btn" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      )}

      {/* Cards */}
      {isListView ? (
        <section className="card-list">
          {visibleCards.map((card) => {
            const quantity = selectedSetState[card.id]?.quantity ?? 0;
            const owned = quantity > 0;
            return (
              <article
                key={`${selectedSet.id}:${card.id}`}
                className={`list-row${owned ? " owned" : ""}`}
              >
                <span className="list-number">{card.cardNumber}</span>
                <span className="list-name">{card.playerName}</span>
                <span className="list-meta">{card.type}</span>
                <span className="list-meta list-rarity">{card.rarity}</span>
                {owned && quantity > 1 && (
                  <span className="list-qty">×{quantity}</span>
                )}
                <div className="list-actions">
                  {owned && (
                    <>
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label={`Remove a copy of ${card.playerName}`}
                        onClick={() =>
                          onUpdateCardQuantity(
                            selectedSet.id,
                            card.id,
                            quantity - 1,
                          )
                        }
                        disabled={quantity <= 0}
                      >
                        −
                      </button>
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label={`Add a copy of ${card.playerName}`}
                        onClick={() =>
                          onUpdateCardQuantity(
                            selectedSet.id,
                            card.id,
                            quantity + 1,
                          )
                        }
                      >
                        +
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className={`btn${owned ? "" : " btn-dark"}`}
                    aria-label={`${card.playerName} — ${owned ? "remove from" : "add to"} collection`}
                    onClick={() =>
                      onUpdateCardQuantity(
                        selectedSet.id,
                        card.id,
                        owned ? 0 : 1,
                      )
                    }
                  >
                    {owned ? "Remove" : "Mark found"}
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="card-grid">
          {visibleCards.map((card) => {
            const quantity = selectedSetState[card.id]?.quantity ?? 0;
            const owned = quantity > 0;
            return (
              <article
                key={`${selectedSet.id}:${card.id}`}
                className={`tracker-card${owned ? " owned" : ""}`}
              >
                <CardArtwork card={card} set={selectedSet} />
                <div className="tracker-card-body">
                  <div className="card-topline">
                    <span>{card.cardNumber}</span>
                    <span>{card.rarity}</span>
                  </div>
                  <h3>{card.playerName}</h3>
                  <p>{card.type}</p>
                  {owned && (
                    <div className="quantity-controls">
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label={`Remove one copy of ${card.playerName}`}
                        onClick={() =>
                          onUpdateCardQuantity(
                            selectedSet.id,
                            card.id,
                            quantity - 1,
                          )
                        }
                        disabled={quantity <= 0}
                      >
                        −
                      </button>
                      <span aria-label={`${quantity} owned`}>{quantity}</span>
                      <button
                        type="button"
                        className="qty-btn"
                        aria-label={`Add another copy of ${card.playerName}`}
                        onClick={() =>
                          onUpdateCardQuantity(
                            selectedSet.id,
                            card.id,
                            quantity + 1,
                          )
                        }
                      >
                        +
                      </button>
                      <span className="qty-label">
                        {quantity === 1 ? "copy" : "copies"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="tracker-actions">
                  <button
                    type="button"
                    className={`collection-toggle${owned ? " active" : ""}`}
                    aria-label={`${card.playerName} — ${owned ? "remove from" : "add to"} collection`}
                    onClick={() =>
                      onUpdateCardQuantity(
                        selectedSet.id,
                        card.id,
                        owned ? 0 : 1,
                      )
                    }
                  >
                    <span className="toggle-label">
                      {owned ? "In collection" : "Missing"}
                    </span>
                    <span className="toggle-state">
                      {owned ? "Tap to remove" : "Tap to mark found"}
                    </span>
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────

function App() {
  const { routeState, navigate, updateFilters } = useHashRoute();
  const [collection, setCollection] = useState(() => collectionStore.load());
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [importMode, setImportMode] = useState("replace");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const toastTimer = useRef(null);
  const saveTimer = useRef(null);

  const [prefs, setPrefs] = useState(() => {
    const saved = prefsStore.load();
    return {
      defaultOwnership: saved.defaultOwnership ?? "all",
      viewMode: saved.viewMode ?? "grid",
      theme: saved.theme ?? "light",
    };
  });

  useEffect(() => {
    prefsStore.save(prefs);
  }, [prefs]);
  function setPref(key, value) {
    setPrefs((p) => ({ ...p, [key]: value }));
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", prefs.theme);
  }, [prefs.theme]);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        collectionStore.save(collection);
        setStorageWarning(false);
      } catch {
        setStorageWarning(true);
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [collection]);

  const selectedSet = useMemo(
    () => catalog.find((s) => s.id === routeState.setId) ?? catalog[0],
    [routeState.setId],
  );

  useEffect(() => {
    if (!routeState.setId && selectedSet) {
      navigate(selectedSet.id, {
        owned: prefs.defaultOwnership,
        type: "all",
        rarity: "all",
        q: "",
        sort: "default",
      });
    }
  }, [routeState.setId, selectedSet, navigate, prefs.defaultOwnership]);

  const allSetStats = useMemo(() => {
    const map = {};
    catalog.forEach((set) => {
      map[set.id] = buildSetStats(set, collection);
    });
    return map;
  }, [collection]);

  const overviewStats = useMemo(() => {
    let totalCards = 0,
      ownedCount = 0,
      totalQuantity = 0;
    catalog.forEach((set) => {
      const s = allSetStats[set.id];
      totalCards += set.totalCards;
      ownedCount += s.ownedCount;
      totalQuantity += s.totalQuantity;
    });
    return {
      totalCards,
      ownedCount,
      totalQuantity,
      duplicateCount: totalQuantity - ownedCount,
      completion: totalCards === 0 ? 0 : (ownedCount / totalCards) * 100,
    };
  }, [allSetStats]);

  function showToast(message) {
    clearTimeout(toastTimer.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  function updateCardQuantity(setId, cardId, nextQuantity, batchUpdater) {
    setCollection((current) => {
      if (batchUpdater) {
        const nextSetState = batchUpdater(current[setId] ?? {});
        return { ...current, [setId]: nextSetState };
      }
      const safeQty = Math.max(0, nextQuantity);
      return {
        ...current,
        [setId]: {
          ...(current[setId] ?? {}),
          [cardId]: { quantity: safeQty, updatedAt: new Date().toISOString() },
        },
      };
    });
  }

  function handleExport() {
    const payload = { version: COLLECTION_VERSION, data: collection };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blindside-collection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Collection exported!");
  }

  function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const parsed = JSON.parse(ev.target.result);
          const incoming = parsed.version && parsed.data ? parsed.data : parsed;
          if (typeof incoming !== "object" || Array.isArray(incoming))
            throw new Error("Invalid format");
          if (importMode === "replace") {
            setCollection(incoming);
            showToast("Collection replaced from file!");
          } else {
            setCollection((current) => {
              const next = { ...current };
              Object.entries(incoming).forEach(([setId, cards]) => {
                next[setId] = { ...(next[setId] ?? {}) };
                Object.entries(cards).forEach(([cardId, cardData]) => {
                  const existingQty = next[setId][cardId]?.quantity ?? 0;
                  const incomingQty = cardData?.quantity ?? 0;
                  if (incomingQty > existingQty) next[setId][cardId] = cardData;
                });
              });
              return next;
            });
            showToast("Collection merged — kept highest quantities!");
          }
        } catch {
          showToast("Import failed — invalid file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function selectSet(setId) {
    navigate(setId, {
      owned: prefs.defaultOwnership,
      type: "all",
      rarity: "all",
      q: "",
      sort: "default",
    });
    setDrawerOpen(false);
  }

  const navProps = {
    catalog,
    allSetStats,
    selectedSet,
    onSelectSet: selectSet,
  };

  return (
    <div className="app-shell">
      <StorageWarning show={storageWarning} />

      <header className="hero-panel">
        <div className="brand-block">
          <img
            className="brand-logo"
            src={blindsideLogo}
            alt="BlindSide Trading Cards"
          />
          <div>
            <p className="eyebrow">BlindSide Trading Cards</p>
            <h1>Collector Tracker</h1>
            <p className="hero-copy">
              Track your BlindSide Trading Cards collections! Official lists and
              images coming soon.
            </p>
            <div className="data-actions" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="btn btn-dark"
                onClick={handleExport}
              >
                Export
              </button>
              <div className="import-group">
                <select
                  value={importMode}
                  onChange={(e) => setImportMode(e.target.value)}
                  aria-label="Import mode"
                  className="import-mode-select"
                >
                  <option value="replace">Replace</option>
                  <option value="merge">Merge</option>
                </select>
                <button type="button" className="btn" onClick={handleImport}>
                  Import
                </button>
              </div>
              <button
                type="button"
                className="btn theme-toggle hero-theme-toggle"
                onClick={() =>
                  setPref("theme", prefs.theme === "light" ? "dark" : "light")
                }
                aria-label="Toggle dark mode"
                title="Toggle dark mode"
              >
                {prefs.theme === "light" ? "🌙" : "☀️"}
              </button>
            </div>
          </div>
        </div>

        <section className="collection-progress">
          <div className="collection-progress-top">
            <div>
              <p className="eyebrow">Total Collection Progress</p>
              <strong>
                {overviewStats.ownedCount} / {overviewStats.totalCards}
              </strong>
            </div>
            <div className="overview-meta">
              <span>{formatPercent(overviewStats.completion)} complete</span>
              <span className="overview-sub">
                {overviewStats.totalQuantity} total ·{" "}
                {overviewStats.duplicateCount} dupes
              </span>
            </div>
          </div>
          <div
            className="collection-progress-bar"
            role="progressbar"
            aria-valuenow={Math.round(overviewStats.completion)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall collection progress"
          >
            <span style={{ width: `${overviewStats.completion}%` }} />
          </div>
        </section>
      </header>

      {/* ── Mobile toolbar (hidden on desktop) ── */}
      <div className="mobile-toolbar">
        <button
          type="button"
          className="btn mobile-nav-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Browse collections"
        >
          ☰{" "}
          {selectedSet
            ? `${selectedSet.teamName} — ${selectedSet.setName}`
            : "Browse"}
        </button>
        <div className="mobile-toolbar-right">
          <div className="view-toggle">
            <button
              type="button"
              className={`view-btn${prefs.viewMode === "grid" ? " active" : ""}`}
              onClick={() => setPref("viewMode", "grid")}
              aria-label="Grid view"
            >
              ⊞
            </button>
            <button
              type="button"
              className={`view-btn${prefs.viewMode === "list" ? " active" : ""}`}
              onClick={() => setPref("viewMode", "list")}
              aria-label="List view"
            >
              ≡
            </button>
          </div>
          <button
            type="button"
            className="btn theme-toggle"
            onClick={() =>
              setPref("theme", prefs.theme === "light" ? "dark" : "light")
            }
            aria-label="Toggle dark mode"
          >
            {prefs.theme === "light" ? "🌙" : "☀️"}
          </button>
        </div>
      </div>

      {/* ── Mobile drawer ── */}
      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <div className="drawer-settings">
          <label htmlFor="drawer-ownership" className="settings-label">
            Default filter
          </label>
          <select
            id="drawer-ownership"
            value={prefs.defaultOwnership}
            onChange={(e) => setPref("defaultOwnership", e.target.value)}
          >
            <option value="all">All cards</option>
            <option value="owned">Owned only</option>
            <option value="missing">Missing only</option>
            <option value="duplicates">Duplicates only</option>
          </select>
        </div>
        <TeamNavContent {...navProps} />
      </MobileDrawer>

      <main className="app-body">
        {/* Desktop sidebar */}
        <aside className="app-sidebar">
          <div className="settings-bar panel">
            <div className="settings-group">
              <label htmlFor="default-ownership" className="settings-label">
                Default filter
              </label>
              <select
                id="default-ownership"
                value={prefs.defaultOwnership}
                onChange={(e) => setPref("defaultOwnership", e.target.value)}
              >
                <option value="all">All cards</option>
                <option value="owned">Owned only</option>
                <option value="missing">Missing only</option>
                <option value="duplicates">Duplicates only</option>
              </select>
            </div>
            <div className="settings-group">
              <span className="settings-label">View</span>
              <div className="view-toggle">
                <button
                  type="button"
                  className={`view-btn${prefs.viewMode === "grid" ? " active" : ""}`}
                  onClick={() => setPref("viewMode", "grid")}
                  aria-label="Grid view"
                  title="Grid view"
                >
                  ⊞
                </button>
                <button
                  type="button"
                  className={`view-btn${prefs.viewMode === "list" ? " active" : ""}`}
                  onClick={() => setPref("viewMode", "list")}
                  aria-label="List view"
                  title="List view"
                >
                  ≡
                </button>
              </div>
            </div>
          </div>
          <nav className="team-nav panel">
            <TeamNavContent {...navProps} />
          </nav>
        </aside>

        {/* Content */}
        <div className="app-content">
          {selectedSet && (
            <SetViewer
              selectedSet={selectedSet}
              collection={collection}
              onUpdateCardQuantity={updateCardQuantity}
              onToast={showToast}
              routeState={routeState}
              onUpdateFilters={(filters) =>
                updateFilters(selectedSet.id, filters)
              }
              viewMode={prefs.viewMode}
            />
          )}
        </div>
      </main>

      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}

export default App;
