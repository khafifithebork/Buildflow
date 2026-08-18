"use client";

import { useState, useEffect, useCallback } from "react";
import {
  fetchStocksByChantier,
  fetchStocksDepot,
  createMouvementStock,
  affecterAuxTravaux,
  type StockArticleDTO,
  type TypeMouvement,
} from "@/lib/api/stocks";
import { extractApiErrorMessage } from "@/lib/api/client";
import { fetchChantiers, type ChantierDTO } from "@/lib/api/chantier";
import { fetchArticles } from "@/lib/api/articles";
import { useAuth } from "@/lib/authContext";
import {
  Section, Card,
  KpiGrid,
  RefreshButton,
  PrimaryActionButton,
  FadeSwap,
  Skeleton,
  KpiGridSkeleton,
  TableSkeleton,
} from "@/components/Functions";
import type { KpiItem } from "@/components/Functions";

/** Sentinel for the central dépôt — stock with no chantier. */
const DEPOT_ID = "DEPOT";

export default function StocksClient() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "MAGASINIER" || user?.role === "PM";

  const [chantiers, setChantiers] = useState<ChantierDTO[]>([]);
  // The location being viewed: DEPOT_ID for the central dépôt, otherwise a
  // chantier id. Stock now lives in one or the other.
  const [chantierId, setChantierId] = useState<string>(DEPOT_ID);
  const [stocks, setStocks] = useState<StockArticleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [articles, setArticles] = useState<{ id: string; code: string; designation: string }[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [movementForm, setMovementForm] = useState<{
    articleId: string;
    typeMouvement: TypeMouvement;
    quantite: number;
    documentRef: string;
    destinationId: string;
  }>({ articleId: "", typeMouvement: "ENTREE", quantite: 0, documentRef: "", destinationId: "" });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadChantiers = useCallback(async () => {
    try {
      const data = await fetchChantiers();
      setChantiers(data);
    } catch {
      const msg = "Une erreur est survenue. Veuillez réessayer.";
      setError(msg);
    }
  }, []);

  const loadStocks = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = id === DEPOT_ID ? await fetchStocksDepot() : await fetchStocksByChantier(id);
      setStocks(data);
    } catch {
      const msg = "Une erreur est survenue. Veuillez réessayer.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadChantiers(); }, [loadChantiers]);
  useEffect(() => { if (chantierId) loadStocks(chantierId); }, [chantierId, loadStocks]);
  useEffect(() => {
    fetchArticles(0, 200, "designation,asc")
      .then((res) => setArticles(res.content.map((a) => ({ id: a.id, code: a.code, designation: a.designation }))))
      .catch(() => setArticles([]));
  }, []);

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementForm.articleId || !movementForm.quantite) {
      setFormError("Choisissez un article et une quantité.");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await createMouvementStock({
        articleId: movementForm.articleId,
        // null targets the dépôt on both sides of the movement
        chantierId: chantierId === DEPOT_ID ? null : chantierId,
        typeMouvement: movementForm.typeMouvement,
        quantite: Number(movementForm.quantite),
        documentRef: movementForm.documentRef || undefined,
        ...(movementForm.typeMouvement === "TRANSFERT"
          ? { chantierDestinationId: movementForm.destinationId === DEPOT_ID ? null : movementForm.destinationId }
          : {}),
      });
      setShowForm(false);
      setMovementForm({ articleId: "", typeMouvement: "ENTREE", quantite: 0, documentRef: "", destinationId: "" });
      await loadStocks(chantierId);
    } catch (err) {
      setFormError(extractApiErrorMessage(
        err, "Impossible d'enregistrer ce mouvement (quantité insuffisante en stock ?)."));
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Incorporates material into the works. Quantity moves from available to posé
   * at the same location — the material has not gone anywhere, it is laid.
   */
  const handleAffecter = async (row: StockArticleDTO) => {
    const raw = prompt(
      `Quantité de « ${row.designation} » à poser / incorporer aux travaux ?

` +
      `Disponible à ${row.chantierNom} : ${row.quantiteTheorique}`,
      ""
    );
    if (raw === null) return;
    const quantite = Number(raw.replace(",", "."));
    if (!quantite || quantite <= 0) {
      setError("Quantité invalide.");
      return;
    }
    setError(null);
    try {
      await affecterAuxTravaux({
        articleId: row.articleId,
        chantierId: row.chantierId,
        quantite,
      });
      await loadStocks(chantierId);
    } catch (err) {
      setError(extractApiErrorMessage(err, "Affectation impossible."));
    }
  };

  const filtered = search
    ? stocks.filter(s =>
      s.articleCode.toLowerCase().includes(search.toLowerCase()) ||
      s.designation.toLowerCase().includes(search.toLowerCase())
    )
    : stocks;

  const enAlerte = stocks.filter(s => s.enAlerte);
  const kpis: KpiItem[] = [
    { label: "Articles en stock", value: `${stocks.length}`, sub: chantierId === DEPOT_ID ? "Dépôt central" : (chantiers.find(c => c.id === chantierId)?.nom ?? "") },
    { label: "Alertes seuil", value: `${enAlerte.length}`, sub: "articles à réapprovisionner" },
    { label: "Quantité théorique totale", value: `${stocks.reduce((s, a) => s + a.quantiteTheorique, 0).toLocaleString("fr-FR")}`, sub: "toutes unités confondues" },
  ];

  if (error && stocks.length === 0 && chantiers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-5">
        <div className="w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <p className="text-base font-semibold text-content-primary dark:text-content-primary-dark">Connexion impossible</p>
          <p className="text-sm text-content-muted dark:text-content-muted-dark max-w-md">{error}</p>
        </div>
        <button onClick={() => loadChantiers()} className="px-5 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors">
          Réessayer
        </button>
      </div>
    );
  }

  return (
      <div className="bg-surface-page dark:bg-surface-page-dark min-h-full py-6 px-4 sm:px-6 lg:px-8">
        <FadeSwap show={loading && stocks.length === 0} skeleton={<StocksSkeleton />}>
        <>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">
              Tableau de bord — Stocks
            </h1>
            <p className="text-sm text-content-muted dark:text-content-muted-dark mt-1">
              {stocks.length} articles · {enAlerte.length} alertes seuil
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={chantierId}
              onChange={(e) => setChantierId(e.target.value)}
              className="px-3 py-2 text-sm rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
            >
              {/* The dépôt is a location in its own right, listed first. */}
              <option value={DEPOT_ID}>Dépôt central</option>
              {chantiers.map(c => (
                <option key={c.id} value={c.id}>{c.nom}</option>
              ))}
            </select>
            <RefreshButton onClick={() => loadStocks(chantierId)} loading={loading} />
            {canManage && (
              <PrimaryActionButton onClick={() => setShowForm(v => !v)}>
                {showForm ? "Fermer" : "+ Mouvement"}
              </PrimaryActionButton>
            )}
          </div>
        </div>

        {canManage && showForm && (
          <form
            onSubmit={handleMovementSubmit}
            className="mb-6 rounded-2xl border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark p-4 space-y-5"
          >
            <h3 className="text-sm font-semibold text-content-primary dark:text-content-primary-dark">
              Nouveau mouvement de stock
            </h3>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="text-sm space-y-1 md:col-span-2">
                <span className="text-content-muted">Article</span>
                <select
                  required
                  value={movementForm.articleId}
                  onChange={(e) => setMovementForm(v => ({ ...v, articleId: e.target.value }))}
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                >
                  <option value="">Choisir un article</option>
                  {articles.map(a => (
                    <option key={a.id} value={a.id}>{a.code} — {a.designation}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm space-y-1">
                <span className="text-content-muted">Type</span>
                <select
                  value={movementForm.typeMouvement}
                  onChange={(e) => setMovementForm(v => ({ ...v, typeMouvement: e.target.value as TypeMouvement }))}
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                >
                  <option value="ENTREE">Entrée (+)</option>
                  <option value="SORTIE">Sortie (-)</option>
                  <option value="AJUSTEMENT">Ajustement (+)</option>
                  <option value="TRANSFERT">Transfert (→)</option>
                </select>
              </label>

              {movementForm.typeMouvement === "TRANSFERT" && (
                <label className="text-sm space-y-1">
                  <span className="text-content-muted">Destination</span>
                  <select
                    required
                    value={movementForm.destinationId}
                    onChange={(e) => setMovementForm(v => ({ ...v, destinationId: e.target.value }))}
                    className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                  >
                    <option value="">Choisir une destination</option>
                    {chantierId !== DEPOT_ID && <option value={DEPOT_ID}>Dépôt central</option>}
                    {chantiers
                      .filter(c => c.id !== chantierId)
                      .map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </label>
              )}

              <label className="text-sm space-y-1">
                <span className="text-content-muted">Quantité</span>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  required
                  value={movementForm.quantite || ""}
                  onChange={(e) => setMovementForm(v => ({ ...v, quantite: Number(e.target.value) }))}
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                />
              </label>

              <label className="text-sm space-y-1 md:col-span-4">
                <span className="text-content-muted">Référence document (optionnel)</span>
                <input
                  value={movementForm.documentRef}
                  onChange={(e) => setMovementForm(v => ({ ...v, documentRef: e.target.value }))}
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                  placeholder="BL-2026-042"
                />
              </label>
            </div>

            {formError && <p className="text-sm text-red-500">{formError}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-sm text-content-muted">
                Annuler
              </button>
            </div>
          </form>
        )}

        <Section title="Vue d'ensemble">
          <KpiGrid kpis={kpis} />
        </Section>

        <Section title="Liste des articles en stock">
          <Card>
            <div className="px-4 pt-4 pb-3">
              <input
                type="text"
                placeholder="Rechercher par code ou désignation…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-80 px-4 py-2 text-sm rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark placeholder:text-content-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
              />
            </div>
            <StocksTable stocks={filtered} canManage={canManage} onAffecter={handleAffecter} />
          </Card>
        </Section>
        </>
        </FadeSwap>
      </div>
  );
}

function StocksSkeleton() {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">
            Tableau de bord — Stocks
          </h1>
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>
      </div>

      <Section title="Vue d'ensemble">
        <KpiGridSkeleton count={3} />
      </Section>

      <Section title="Liste des articles en stock">
        <Card>
          <div className="px-4 pt-4 pb-3">
            <Skeleton className="h-9 w-full sm:w-80 rounded-lg" />
          </div>
          <TableSkeleton columns={7} rows={6} />
        </Card>
      </Section>
    </>
  );
}

function StocksTable({
  stocks,
  canManage,
  onAffecter,
}: {
  stocks: StockArticleDTO[];
  canManage: boolean;
  onAffecter: (s: StockArticleDTO) => void;
}) {
  if (stocks.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-content-muted dark:text-content-muted-dark">Aucun article en stock pour ce chantier.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b-2 border-edge-default dark:border-edge-default-dark">
            {["Code", "Désignation", "Unité", "Emplacement", "Stock dispo", "Stock travaux (posé)", "Seuil alerte", "Statut", "Actions"].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stocks.map(s => (
            <tr key={s.id} className="border-b border-edge-subtle dark:border-edge-subtle-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors duration-150">
              <td className="px-3 py-3 font-mono text-xs font-semibold text-accent whitespace-nowrap">{s.articleCode}</td>
              <td className="px-3 py-3 font-medium text-content-primary dark:text-content-primary-dark max-w-[240px] truncate">{s.designation}</td>
              <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark">{s.unite}</td>
              <td className="px-3 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  s.emplacement === "DEPOT"
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                }`}>
                  {s.chantierNom}
                </span>
              </td>
              <td className="px-3 py-3 font-semibold text-green-700 dark:text-green-400">{s.quantiteTheorique.toLocaleString("fr-FR")}</td>
              <td className="px-3 py-3 font-semibold text-amber-700 dark:text-amber-400">{(s.quantiteTravaux ?? 0).toLocaleString("fr-FR")}</td>
              <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark">{s.seuilAlerte.toLocaleString("fr-FR")}</td>
              <td className="px-3 py-3">
                {s.enAlerte ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#dc2626]" />
                    En alerte
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a]" />
                    OK
                  </span>
                )}
              </td>
              <td className="px-3 py-3 whitespace-nowrap">
                {canManage && s.quantiteTheorique > 0 ? (
                  <button
                    onClick={() => onAffecter(s)}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-md bg-amber-600 hover:bg-amber-700 text-white transition-colors"
                    title="Incorporer ces matériaux aux travaux (dispo → posé)"
                  >
                    Affecter aux travaux
                  </button>
                ) : (
                  <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
