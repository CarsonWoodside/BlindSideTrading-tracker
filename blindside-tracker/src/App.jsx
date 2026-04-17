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

// ─────────────────────────────────────────────
// Custom hook: hash-based routing
// ─────────────────────────────────────────────

function useHashRoute() {
  const parseHash = () => {
    const match = window.location.hash.match(/^#\/set\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  };

  const [routeSetId, setRouteSetId] = useState(() => parseHash());

  useEffect(() => {
    const handleHashChange = () => setRouteSetId(parseHash());
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const navigate = useCallback((setId) => {
    const nextHash = setId ? `#/set/${encodeURIComponent(setId)}` : "#/";
    if (window.location.hash !== nextHash) {
      window.location.hash = nextHash;
    }
    setRouteSetId(setId);
  }, []);

  return { routeSetId, navigate };
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function buildSetStats(set, collection) {
  const setState = collection[set.id] ?? {};
  const ownedCards = set.cards.filter(
    (card) => (setState[card.id]?.quantity ?? 0) > 0,
  );
  return {
    ownedCount: ownedCards.length,
    completion:
      set.totalCards === 0 ? 0 : (ownedCards.length / set.totalCards) * 100,
  };
}

// ─────────────────────────────────────────────
// CardArtwork
// ─────────────────────────────────────────────

function CardArtwork({ card, set }) {
  const [missing, setMissing] = useState(false);

  if (missing) {
    return (
      <div className="card-artwork placeholder" aria-hidden="true">
        <span>{card.cardNumber}</span>
        <strong>{card.type}</strong>
      </div>
    );
  }

  return (
    <img
      className="card-artwork"
      src={card.imagePath}
      alt={`${card.playerName} card`}
      loading="lazy"
      onError={() => setMissing(true)}
      data-folder={set.imageFolder}
    />
  );
}

// ─────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────

function Toast({ message, visible }) {
  return (
    <div className={`toast${visible ? "" : " hidden"}`} aria-live="polite">
      {message}
    </div>
  );
}

// ─────────────────────────────────────────────
// SetViewer — owns all filter state for a set
// ─────────────────────────────────────────────

function SetViewer({ selectedSet, collection, onUpdateCardQuantity, onToast }) {
  const [searchValue, setSearchValue] = useState("");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [rarityFilter, setRarityFilter] = useState("all");

  // Reset filters when the set changes
  const prevSetId = useRef(selectedSet?.id);
  useEffect(() => {
    if (selectedSet?.id !== prevSetId.current) {
      setSearchValue("");
      setOwnershipFilter("all");
      setTypeFilter("all");
      setRarityFilter("all");
      prevSetId.current = selectedSet?.id;
    }
  }, [selectedSet?.id]);

  const selectedSetState = useMemo(() => {
    return selectedSet ? (collection[selectedSet.id] ?? {}) : {};
  }, [collection, selectedSet]);

  const selectedSetStats = useMemo(() => {
    return selectedSet
      ? buildSetStats(selectedSet, collection)
      : { ownedCount: 0, completion: 0 };
  }, [collection, selectedSet]);

  const rarityProgress = useMemo(() => {
    if (!selectedSet) return [];
    return selectedSet.rarities.map((rarity) => {
      const cards = selectedSet.cards.filter((c) => c.rarity === rarity);
      const ownedCount = cards.filter(
        (c) => (selectedSetState[c.id]?.quantity ?? 0) > 0,
      ).length;
      return {
        rarity,
        ownedCount,
        totalCards: cards.length,
        completion: cards.length === 0 ? 0 : (ownedCount / cards.length) * 100,
      };
    });
  }, [selectedSet, selectedSetState]);

  const visibleCards = useMemo(() => {
    if (!selectedSet) return [];
    return [...selectedSet.cards]
      .filter((card) => {
        const quantity = selectedSetState[card.id]?.quantity ?? 0;
        const searchText =
          `${card.cardNumber} ${card.playerName} ${card.type} ${card.rarity}`.toLowerCase();
        const matchesSearch =
          searchValue.trim() === "" ||
          searchText.includes(searchValue.trim().toLowerCase());
        const matchesOwnership =
          ownershipFilter === "all" ||
          (ownershipFilter === "owned" && quantity > 0) ||
          (ownershipFilter === "missing" && quantity === 0);
        const matchesType = typeFilter === "all" || card.type === typeFilter;
        const matchesRarity =
          rarityFilter === "all" || card.rarity === rarityFilter;
        return (
          matchesSearch && matchesOwnership && matchesType && matchesRarity
        );
      })
      .sort(
        (a, b) =>
          a.rarityRank - b.rarityRank ||
          CARD_NUMBER_COLLATOR.compare(a.cardNumber, b.cardNumber),
      );
  }, [
    ownershipFilter,
    rarityFilter,
    searchValue,
    selectedSet,
    selectedSetState,
    typeFilter,
  ]);

  const filtersAreActive =
    searchValue.trim() !== "" ||
    ownershipFilter !== "all" ||
    typeFilter !== "all" ||
    rarityFilter !== "all";

  // Mark all currently visible cards as owned
  function markAllVisible() {
    visibleCards.forEach((card) => {
      const current = selectedSetState[card.id]?.quantity ?? 0;
      if (current === 0) {
        onUpdateCardQuantity(selectedSet.id, card.id, 1);
      }
    });
    onToast(
      `Marked ${visibleCards.length} card${visibleCards.length !== 1 ? "s" : ""} as owned`,
    );
  }

  // Clear all visible cards from collection
  function clearAllVisible() {
    visibleCards.forEach((card) => {
      const current = selectedSetState[card.id]?.quantity ?? 0;
      if (current > 0) {
        onUpdateCardQuantity(selectedSet.id, card.id, 0);
      }
    });
    onToast(
      `Cleared ${visibleCards.length} card${visibleCards.length !== 1 ? "s" : ""}`,
    );
  }

  if (!selectedSet) return null;

  return (
    <section className="content">
      {/* Set header */}
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
          <div>
            <strong>{selectedSetStats.ownedCount}</strong>
            <span>cards found</span>
          </div>
          <div>
            <strong>{selectedSet.totalCards}</strong>
            <span>cards in set</span>
          </div>
          <div>
            <strong>
              {selectedSet.totalCards - selectedSetStats.ownedCount}
            </strong>
            <span>still missing</span>
          </div>
          <div>
            <strong>{formatPercent(selectedSetStats.completion)}</strong>
            <span>complete</span>
          </div>
        </div>
      </header>

      {/* Rarity breakdown */}
      <section className="panel">
        <div className="panel-heading">
          <h2>Set Breakdown</h2>
          <span>{formatPercent(selectedSetStats.completion)}</span>
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
                <span style={{ width: `${item.completion}%` }}></span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Filters */}
      <section className="panel filters">
        <input
          type="search"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search card number, player, type, rarity"
          aria-label="Search cards"
        />
        {/* On mobile these three selects render side-by-side via .filter-selects */}
        <div className="filter-selects" style={{ display: "contents" }}>
          <select
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value)}
            aria-label="Filter by ownership"
          >
            <option value="all">All cards</option>
            <option value="owned">Owned only</option>
            <option value="missing">Missing only</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
          >
            <option value="all">All types</option>
            {selectedSet.types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            aria-label="Filter by rarity"
          >
            <option value="all">All rarities</option>
            {selectedSet.rarities.map((rarity) => (
              <option key={rarity} value={rarity}>
                {rarity}
              </option>
            ))}
          </select>
        </div>
        {/* Always show count so users know how many cards match */}
        <p className="filter-count">
          Showing {visibleCards.length} of {selectedSet.totalCards} card
          {selectedSet.totalCards !== 1 ? "s" : ""}
          {filtersAreActive ? " (filtered)" : ""}
        </p>
      </section>

      {/* Bulk actions — only shown when there are visible cards */}
      {visibleCards.length > 0 && (
        <div className="bulk-actions">
          <span>
            {filtersAreActive
              ? `${visibleCards.length} filtered card${visibleCards.length !== 1 ? "s" : ""}`
              : `All ${visibleCards.length} card${visibleCards.length !== 1 ? "s" : ""}`}
          </span>
          <button
            type="button"
            className="btn btn-dark"
            onClick={markAllVisible}
          >
            Mark all as owned
          </button>
          <button type="button" className="btn" onClick={clearAllVisible}>
            Clear all
          </button>
        </div>
      )}

      {/* Card grid */}
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

                {/* Quantity stepper — only shown once owned */}
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

              {/* Mark owned/missing toggle — replaces the old toggle + redundant status pill */}
              <div className="tracker-actions">
                <button
                  type="button"
                  className={`collection-toggle${owned ? " active" : ""}`}
                  aria-label={`${card.playerName} — ${owned ? "remove from" : "add to"} collection`}
                  onClick={() =>
                    onUpdateCardQuantity(selectedSet.id, card.id, owned ? 0 : 1)
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
              {/* tracker-footer removed — redundant with the toggle above */}
            </article>
          );
        })}
      </section>
    </section>
  );
}

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────

function App() {
  const { routeSetId, navigate } = useHashRoute();
  const [collection, setCollection] = useState(() => collectionStore.load());
  const [teamFilter, setTeamFilter] = useState("All Teams");
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef(null);

  // Debounced save — write at most once per 300 ms of inactivity
  const saveTimer = useRef(null);
  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      collectionStore.save(collection);
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [collection]);

  // Default to first set if no hash present
  const selectedSet = useMemo(() => {
    return catalog.find((set) => set.id === routeSetId) ?? catalog[0];
  }, [routeSetId]);

  useEffect(() => {
    if (!routeSetId && selectedSet) {
      navigate(selectedSet.id);
    }
  }, [routeSetId, selectedSet, navigate]);

  const filteredSets = useMemo(() => {
    return catalog.filter(
      (set) => teamFilter === "All Teams" || set.teamName === teamFilter,
    );
  }, [teamFilter]);

  // Pre-compute stats for every set in one pass — no per-render recalculation in JSX
  const allSetStats = useMemo(() => {
    const map = {};
    catalog.forEach((set) => {
      map[set.id] = buildSetStats(set, collection);
    });
    return map;
  }, [collection]);

  const overviewStats = useMemo(() => {
    const totals = catalog.reduce(
      (acc, set) => {
        const stats = allSetStats[set.id];
        acc.totalCards += set.totalCards;
        acc.ownedCount += stats.ownedCount;
        return acc;
      },
      { totalCards: 0, ownedCount: 0 },
    );
    return {
      ...totals,
      completion:
        totals.totalCards === 0
          ? 0
          : (totals.ownedCount / totals.totalCards) * 100,
    };
  }, [allSetStats]);

  // ── Toast helper ──
  function showToast(message) {
    clearTimeout(toastTimer.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  // ── Collection mutation ──
  function updateCardQuantity(setId, cardId, nextQuantity) {
    setCollection((current) => {
      const safeQuantity = Math.max(0, nextQuantity);
      return {
        ...current,
        [setId]: {
          ...(current[setId] ?? {}),
          [cardId]: {
            quantity: safeQuantity,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }

  // ── Export collection as JSON ──
  function handleExport() {
    const json = JSON.stringify(collection, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `blindside-collection-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Collection exported!");
  }

  // ── Import collection from JSON ──
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
          if (typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Invalid format");
          }
          setCollection(parsed);
          showToast("Collection imported!");
        } catch {
          showToast("Import failed — invalid file.");
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function selectSet(setId) {
    navigate(setId);
  }

  return (
    <div className="app-shell">
      {/* ── Hero / header ── */}
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
            {/* Export / Import */}
            <div className="data-actions" style={{ marginTop: "16px" }}>
              <button
                type="button"
                className="btn btn-dark"
                onClick={handleExport}
              >
                Export collection
              </button>
              <button type="button" className="btn" onClick={handleImport}>
                Import collection
              </button>
            </div>
          </div>
        </div>

        {/* Overall progress */}
        <section className="collection-progress">
          <div className="collection-progress-top">
            <div>
              <p className="eyebrow">Total Collection Progress</p>
              <strong>
                {overviewStats.ownedCount} / {overviewStats.totalCards}
              </strong>
            </div>
            <span>{formatPercent(overviewStats.completion)} complete</span>
          </div>
          <div
            className="collection-progress-bar"
            role="progressbar"
            aria-valuenow={Math.round(overviewStats.completion)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Overall collection progress"
          >
            <span style={{ width: `${overviewStats.completion}%` }}></span>
          </div>
        </section>
      </header>

      <main className="content-flow">
        {/* ── Set browser ── */}
        <section className="panel set-browser-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Browse Collections</p>
              <h2>Choose a set</h2>
            </div>
            <select
              value={teamFilter}
              onChange={(e) => setTeamFilter(e.target.value)}
              aria-label="Filter sets by team"
            >
              <option>All Teams</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          <div className="set-strip">
            {filteredSets.map((set) => {
              // Use pre-computed stats — no recalculation here
              const stats = allSetStats[set.id];
              const isActive = selectedSet?.id === set.id;

              return (
                <button
                  key={set.id}
                  type="button"
                  className={`set-tile${isActive ? " active" : ""}`}
                  onClick={() => selectSet(set.id)}
                  aria-pressed={isActive}
                >
                  <span className="set-meta">{set.season}</span>
                  <strong>{set.teamName}</strong>
                  <small>{set.setName}</small>
                  <div className="set-tile-footer">
                    <span>
                      {stats.ownedCount} / {set.totalCards}
                    </span>
                    <span>{formatPercent(stats.completion)}</span>
                  </div>
                  <div className="progress-bar" aria-hidden="true">
                    <span style={{ width: `${stats.completion}%` }}></span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Set viewer (owns its own filter state) ── */}
        {selectedSet && (
          <SetViewer
            selectedSet={selectedSet}
            collection={collection}
            onUpdateCardQuantity={updateCardQuantity}
            onToast={showToast}
          />
        )}
      </main>

      {/* ── Toast notifications ── */}
      <Toast message={toastMessage} visible={toastVisible} />
    </div>
  );
}

export default App;
