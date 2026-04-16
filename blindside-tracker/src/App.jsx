import { useEffect, useMemo, useState } from 'react'
import blindsideLogo from '../data/images/blindside-logo.png'
import './App.css'
import { catalog, teams } from './lib/catalog'
import { collectionStore } from './lib/collectionStore'

const CARD_NUMBER_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

function parseHash() {
  const match = window.location.hash.match(/^#\/set\/([^/]+)$/)
  return match ? decodeURIComponent(match[1]) : null
}

function updateHash(setId) {
  const nextHash = setId ? `#/set/${encodeURIComponent(setId)}` : '#/'
  if (window.location.hash !== nextHash) {
    window.location.hash = nextHash
  }
}

function formatPercent(value) {
  return `${Math.round(value)}%`
}

function buildSetStats(set, collection) {
  const setState = collection[set.id] ?? {}
  const ownedCards = set.cards.filter((card) => (setState[card.id]?.quantity ?? 0) > 0)

  return {
    ownedCount: ownedCards.length,
    completion: set.totalCards === 0 ? 0 : (ownedCards.length / set.totalCards) * 100,
  }
}

function CardArtwork({ card, set }) {
  const [missing, setMissing] = useState(false)

  if (missing) {
    return (
      <div className="card-artwork placeholder" aria-hidden="true">
        <span>{card.cardNumber}</span>
        <strong>{card.type}</strong>
      </div>
    )
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
  )
}

function App() {
  const [routeSetId, setRouteSetId] = useState(() => parseHash())
  const [collection, setCollection] = useState(() => collectionStore.load())
  const [teamFilter, setTeamFilter] = useState('All Teams')
  const [searchValue, setSearchValue] = useState('')
  const [ownershipFilter, setOwnershipFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [rarityFilter, setRarityFilter] = useState('all')

  useEffect(() => {
    const handleHashChange = () => {
      setRouteSetId(parseHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    collectionStore.save(collection)
  }, [collection])

  const selectedSet = useMemo(() => {
    return catalog.find((set) => set.id === routeSetId) ?? catalog[0]
  }, [routeSetId])

  useEffect(() => {
    if (!routeSetId && selectedSet) {
      updateHash(selectedSet.id)
    }
  }, [routeSetId, selectedSet])

  const filteredSets = useMemo(() => {
    return catalog.filter((set) => teamFilter === 'All Teams' || set.teamName === teamFilter)
  }, [teamFilter])

  const overviewStats = useMemo(() => {
    const totals = catalog.reduce(
      (summary, set) => {
        const stats = buildSetStats(set, collection)
        summary.totalCards += set.totalCards
        summary.ownedCount += stats.ownedCount
        return summary
      },
      { totalCards: 0, ownedCount: 0 },
    )

    return {
      ...totals,
      completion: totals.totalCards === 0 ? 0 : (totals.ownedCount / totals.totalCards) * 100,
    }
  }, [collection])

  const selectedSetState = useMemo(() => {
    return selectedSet ? collection[selectedSet.id] ?? {} : {}
  }, [collection, selectedSet])

  const visibleCards = useMemo(() => {
    if (!selectedSet) {
      return []
    }

    return [...selectedSet.cards]
      .filter((card) => {
        const quantity = selectedSetState[card.id]?.quantity ?? 0
        const searchText = `${card.cardNumber} ${card.playerName} ${card.type} ${card.rarity}`.toLowerCase()
        const matchesSearch =
          searchValue.trim() === '' || searchText.includes(searchValue.trim().toLowerCase())
        const matchesOwnership =
          ownershipFilter === 'all' ||
          (ownershipFilter === 'owned' && quantity > 0) ||
          (ownershipFilter === 'missing' && quantity === 0)
        const matchesType = typeFilter === 'all' || card.type === typeFilter
        const matchesRarity = rarityFilter === 'all' || card.rarity === rarityFilter

        return matchesSearch && matchesOwnership && matchesType && matchesRarity
      })
      .sort((left, right) => {
        return (
          left.rarityRank - right.rarityRank ||
          CARD_NUMBER_COLLATOR.compare(left.cardNumber, right.cardNumber)
        )
      })
  }, [ownershipFilter, rarityFilter, searchValue, selectedSet, selectedSetState, typeFilter])

  const selectedSetStats = useMemo(() => {
    return selectedSet ? buildSetStats(selectedSet, collection) : { ownedCount: 0, completion: 0 }
  }, [collection, selectedSet])

  const rarityProgress = useMemo(() => {
    if (!selectedSet) {
      return []
    }

    return selectedSet.rarities.map((rarity) => {
      const cards = selectedSet.cards.filter((card) => card.rarity === rarity)
      const ownedCount = cards.filter((card) => (selectedSetState[card.id]?.quantity ?? 0) > 0).length

      return {
        rarity,
        ownedCount,
        totalCards: cards.length,
        completion: cards.length === 0 ? 0 : (ownedCount / cards.length) * 100,
      }
    })
  }, [selectedSet, selectedSetState])

  function selectSet(setId) {
    setRouteSetId(setId)
    updateHash(setId)
    setSearchValue('')
    setOwnershipFilter('all')
    setTypeFilter('all')
    setRarityFilter('all')
  }

  function updateCardQuantity(setId, cardId, nextQuantity) {
    setCollection((current) => {
      const safeQuantity = Math.max(0, nextQuantity)
      const next = {
        ...current,
        [setId]: {
          ...(current[setId] ?? {}),
          [cardId]: {
            quantity: safeQuantity,
            updatedAt: new Date().toISOString(),
          },
        },
      }

      return next
    })
  }

  return (
    <div className="app-shell">
      <header className="hero-panel">
        <div className="brand-block">
          <img className="brand-logo" src={blindsideLogo} alt="BlindSide Trading Cards" />
          <div>
            <p className="eyebrow">BlindSide Trading Cards</p>
            <h1>Collector Tracker</h1>
            <p className="hero-copy">
              A white-label MVP for browsing every set, marking pulls locally, and scaling by simply
              dropping in a new CSV plus card images.
            </p>
          </div>
        </div>

        <section className="collection-progress">
          <div className="collection-progress-top">
            <div>
              <p className="eyebrow">Total Collection Progress</p>
              <strong>{overviewStats.ownedCount} / {overviewStats.totalCards}</strong>
            </div>
            <span>{formatPercent(overviewStats.completion)} complete</span>
          </div>
          <div className="collection-progress-bar" aria-hidden="true">
            <span style={{ width: `${overviewStats.completion}%` }}></span>
          </div>
        </section>
      </header>

      <main className="content-flow">
        <section className="panel set-browser-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Browse Collections</p>
              <h2>Choose a set</h2>
            </div>
            <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
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
              const stats = buildSetStats(set, collection)
              const isActive = selectedSet?.id === set.id

              return (
                <button
                  key={set.id}
                  type="button"
                  className={`set-tile${isActive ? ' active' : ''}`}
                  onClick={() => selectSet(set.id)}
                >
                  <span className="set-meta">{set.season}</span>
                  <strong>{set.teamName}</strong>
                  <small>{set.setName}</small>
                  <div className="set-tile-footer">
                    <span>{stats.ownedCount} / {set.totalCards}</span>
                    <span>{formatPercent(stats.completion)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {selectedSet && (
          <section className="content">
            <header className="content-header panel">
              <div>
                <p className="eyebrow">{selectedSet.season}</p>
                <h2>{selectedSet.teamName} {selectedSet.setName}</h2>
                <p className="section-copy">Track what you own, filter what is missing, and keep your checklist up to date.</p>
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
              </div>
            </header>

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
                      <span>{item.ownedCount} / {item.totalCards}</span>
                    </div>
                    <div className="progress-bar" aria-hidden="true">
                      <span style={{ width: `${item.completion}%` }}></span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="panel filters">
              <input
                type="search"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search card number, player, type, rarity"
              />
              <select value={ownershipFilter} onChange={(event) => setOwnershipFilter(event.target.value)}>
                <option value="all">All cards</option>
                <option value="owned">Owned only</option>
                <option value="missing">Missing only</option>
              </select>
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                <option value="all">All types</option>
                {selectedSet.types.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select value={rarityFilter} onChange={(event) => setRarityFilter(event.target.value)}>
                <option value="all">All rarities</option>
                {selectedSet.rarities.map((rarity) => (
                  <option key={rarity} value={rarity}>
                    {rarity}
                  </option>
                ))}
              </select>
            </section>

            <section className="card-grid">
              {visibleCards.map((card) => {
                const quantity = selectedSetState[card.id]?.quantity ?? 0
                const owned = quantity > 0

                return (
                  <article key={`${selectedSet.id}:${card.id}`} className={`tracker-card${owned ? ' owned' : ''}`}>
                    <CardArtwork card={card} set={selectedSet} />
                    <div className="tracker-card-body">
                      <div className="card-topline">
                        <span>{card.cardNumber}</span>
                        <span>{card.rarity}</span>
                      </div>
                      <h3>{card.playerName}</h3>
                      <p>{card.type}</p>
                      {card.duplicateIndex > 1 && (
                        <small className="duplicate-note">Duplicate CSV entry #{card.duplicateIndex}</small>
                      )}
                    </div>
                    <div className="tracker-actions">
                      <button
                        type="button"
                        className={`collection-toggle${owned ? ' active' : ''}`}
                        onClick={() => updateCardQuantity(selectedSet.id, card.id, owned ? 0 : 1)}
                      >
                        <span className="toggle-label">{owned ? 'In collection' : 'Missing'}</span>
                        <span className="toggle-state">{owned ? 'Tap to remove' : 'Tap to mark found'}</span>
                      </button>
                    </div>
                    <div className="tracker-footer">
                      <span className={`status-pill${owned ? ' owned' : ''}`}>
                        {owned ? 'Owned' : 'Missing'}
                      </span>
                    </div>
                  </article>
                )
              })}
            </section>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
