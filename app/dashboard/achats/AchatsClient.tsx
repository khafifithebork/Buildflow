"use client";


import { Fragment } from "react";
import {
  createAchat,
  updateAchatIndicateurs,
  updateLignePrix,
  updateMontantHt,
  validateBL,
  validateFacture,
  annulerPaiement,
  validatePaiement,
} from "@/lib/api/achats";
import { extractApiErrorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/authContext";
import { changerModePaiement } from "@/lib/api/modePaiement";
import {
  ModePaiementDialog,
  ModePaiementBadge,
  type ModePaiement,
} from "@/components/ModePaiementDialog";
import {
  IndicateurBadge,
  IndicateurCheckbox,
  IndicateurFilterSelect,
  INDICATEURS,
  matchesIndicateurFilter,
  type IndicateurFilterValue,
} from "@/components/IndicateursOperation";
import { fetchFournisseurs } from "@/lib/api/fournisseurs";
import { fetchChantiers } from "@/lib/api/chantier";
import { useState, useEffect, useCallback, useMemo } from "react";
import { fetchAchats } from "@/lib/api/achats";
import { hydrate } from "@/components/functions2";
import type { Achat, AchatsHydrated } from "@/components/functions2";
import { achatsHydrationConfig } from "@/components/functions2";
import { fetchArticles } from "@/lib/api/articles";
import { fetchBpuLignes } from "@/lib/api/bpu";
import type { BpuLigneDTO } from "@/lib/api/bpu";
import { fmt } from "@/components/functions2";
import {
  ChartJsLoader,
  Section, Card, ChartCard,
  KpiGrid,
  PieChart,
  HorizontalBarChart,
  DonutChart,
  StackedBarChart,
  LineChart,
  RefreshButton,
  PrimaryActionButton,
  FadeSwap,
  Skeleton,
  KpiGridSkeleton,
  ChartCardSkeleton,
  TableSkeleton,
} from "@/components/Functions";

export default function AchatsClient() {
  const { user } = useAuth();
  // Mirrors the @PreAuthorize on each transition, so the UI only offers what
  // the server would actually accept.
  const canValiderBL = user?.role === "ADMIN" || user?.role === "ACHAT" || user?.role === "PM";
  const canValiderFinance = user?.role === "ADMIN" || user?.role === "FINANCE";

  const [achats, setAchats] = useState<Achat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [articles, setArticles] = useState<
    {
      id: string;
      designation: string;
      prixAchatRef: number;
    }[]
  >([]);
  const [fournisseurs, setFournisseurs] = useState<
    { id: string; raisonSociale: string }[]
  >([]);

  const [chantiers, setChantiers] = useState<
    { id: string; nom: string }[]
  >([]);

  const [bpuLignes, setBpuLignes] = useState<BpuLigneDTO[]>([]);

  const [submitting, setSubmitting] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);

  // Indicator filters + sort for the "Liste des commandes" table.
  const [filterAnalytique, setFilterAnalytique] = useState<IndicateurFilterValue>("ALL");
  const [filterFiscal, setFilterFiscal] = useState<IndicateurFilterValue>("ALL");
  const [sortBy, setSortBy] = useState<"NONE" | "ANALYTIQUE" | "FISCAL">("NONE");

  const [form, setForm] = useState({
    ref: "",
    fournisseurId: "",
    chantierId: "",
    dateCommande: new Date().toISOString().slice(0, 10),
    dateLivraisonPrevue: new Date().toISOString().slice(0, 10),
    impactAnalytiqueChantier: false,
    impactComptableFiscal: false,
    lignes: [
      {
        articleId: "",
        designation: "",
        quantite: 1,
        prixUnitaire: 0,
        bpuLigneId: ""
      }
    ]
  });

  useEffect(() => {
    if (!form.chantierId) {
      setBpuLignes([]);
      return;
    }
    fetchBpuLignes(form.chantierId).then(setBpuLignes).catch(() => setBpuLignes([]));
  }, [form.chantierId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        achatsData,
        fournisseursData,
        chantiersData,
        articlesData
      ] = await Promise.all([
        fetchAchats(),
        fetchFournisseurs(),
        fetchChantiers(),
        fetchArticles(),
      ]);

      setAchats(achatsData ?? []);

      setFournisseurs(
        fournisseursData.map(f => ({
          id: f.id,
          raisonSociale: f.raisonSociale,
        }))
      );

      setChantiers(
        chantiersData.map(c => ({
          id: c.id,
          nom: c.nom,
        }))
      );

      setArticles(
        articlesData.content.map(a => ({
          id: a.id,
          designation: a.designation,
          prixAchatRef: a.prixAchatRef,
        }))
      );

    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setFormError(null);

    try {

      await createAchat({
        ...form,
        lignes: form.lignes.map(l => ({
          articleId: l.articleId,
          designation: l.designation,
          quantite: Number(l.quantite),
          prixUnitaire: Number(l.prixUnitaire),
          bpuLigneId: l.bpuLigneId || undefined
        }))
      });

      setShowForm(false);

      setForm({
        ref: "",
        fournisseurId: "",
        chantierId: "",
        dateCommande: new Date().toISOString().slice(0, 10),
        dateLivraisonPrevue: new Date().toISOString().slice(0, 10),
        impactAnalytiqueChantier: false,
        impactComptableFiscal: false,
        lignes: [
          {
            articleId: "",
            designation: "",
            quantite: 1,
            prixUnitaire: 0,
            bpuLigneId: ""
          }
        ]
      });

      await load();

    } catch {
      setFormError("Impossible de créer l'achat");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();

    const rows = achats.filter(a => {
      const matchesSearch = !q
        || a.ref.toLowerCase().includes(q)
        || a.fournisseurNom.toLowerCase().includes(q)
        || a.chantierNom.toLowerCase().includes(q);

      return matchesSearch
        && matchesIndicateurFilter(a.impactAnalytiqueChantier ?? false, filterAnalytique)
        && matchesIndicateurFilter(a.impactComptableFiscal ?? false, filterFiscal);
    });

    if (sortBy === "NONE") return rows;

    // "Oui" first, so flagged operations surface at the top of the list.
    const key = sortBy === "ANALYTIQUE" ? "impactAnalytiqueChantier" : "impactComptableFiscal";
    return [...rows].sort((a, b) => Number(b[key] ?? false) - Number(a[key] ?? false));
  }, [achats, search, filterAnalytique, filterFiscal, sortBy]);

  /** Optimistic in-place toggle of one indicator on one achat. */
  const toggleIndicateur = useCallback(
    async (id: string, key: "impactAnalytiqueChantier" | "impactComptableFiscal", next: boolean) => {
      setAchats(prev => prev.map(a => (a.id === id ? { ...a, [key]: next } : a)));
      try {
        await updateAchatIndicateurs(id, { [key]: next });
      } catch {
        // Roll back and tell the user, rather than leaving a lie on screen.
        setAchats(prev => prev.map(a => (a.id === id ? { ...a, [key]: !next } : a)));
        setError("Impossible de mettre à jour les indicateurs de cette commande.");
      }
    },
    []
  );

  /** Swap in the order the server returned after a line was re-priced. */
  const handleRepriced = useCallback((updated: Achat) => {
    setAchats(prev => prev.map(a => (a.id === updated.id ? updated : a)));
  }, []);

  // Feedback for the lifecycle transitions. Separate from `error`, which is the
  // "page failed to load" state and only renders on an empty list.
  const [notice, setNotice] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Payment-mode popup: `payingAchat` settles an order, `changingAchat`
  // corrects the mode of one already settled.
  const [payingAchat, setPayingAchat] = useState<Achat | null>(null);
  const [changingAchat, setChangingAchat] = useState<Achat | null>(null);
  const [modeSubmitting, setModeSubmitting] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);

  /** FACTURE -> PAYE with the mode chosen in the popup. */
  const confirmPaiement = useCallback(async (modePaiement: ModePaiement) => {
    if (!payingAchat) return;
    setModeSubmitting(true);
    setModeError(null);
    try {
      await validatePaiement(payingAchat.id, modePaiement);
      setNotice({
        kind: "success",
        text: modePaiement === "CAISSE"
          ? `${payingAchat.ref} soldé en espèces. La caisse a été débitée de ${fmt(payingAchat.ttc)}.`
          : `${payingAchat.ref} soldé par ${modePaiement.toLowerCase()}. La caisse n'a pas été débitée.`,
      });
      setPayingAchat(null);
      await load();
    } catch (err) {
      setModeError(extractApiErrorMessage(err, `Impossible de solder ${payingAchat.ref}.`));
    } finally {
      setModeSubmitting(false);
    }
  }, [payingAchat, load]);

  /** Correct the mode of an already-paid order; the caisse is not adjusted. */
  const confirmChangeMode = useCallback(async (modePaiement: ModePaiement) => {
    if (!changingAchat) return;
    setModeSubmitting(true);
    setModeError(null);
    try {
      const res = await changerModePaiement("ACHAT", changingAchat.id, modePaiement);
      setChangingAchat(null);
      setNotice(res.avertissement
        ? { kind: "error", text: res.avertissement }
        : { kind: "success", text: `Mode de paiement de ${changingAchat.ref} mis à jour.` });
      await load();
    } catch (err) {
      setModeError(extractApiErrorMessage(err, "Modification impossible."));
    } finally {
      setModeSubmitting(false);
    }
  }, [changingAchat, load]);

  /**
   * Advance one order along EN_COURS → LIVRE → FACTURE → PAYE.
   *
   * The server enforces the sequence and the caisse balance, so failures are
   * shown verbatim: "Cannot FACTURE an Achat that is currently 'EN_COURS'",
   * "Insufficient funds in caisse …". Reloading afterwards keeps stock and
   * caisse figures in step with the transition's side effects.
   */
  /**
   * Défait un règlement saisi à tort. Le montant revient en caisse et la
   * commande redevient une facture à régler — les deux ensemble, sans quoi la
   * commande resterait payée sans dette ni décaissement.
   */
  const runAnnulerPaiement = useCallback(
    async (achat: Achat) => {
      const motif = prompt(
        `Annuler le paiement de ${achat.ref} ?

` +
        `${achat.ttc} DH reviennent en caisse et la commande redevient une facture ` +
        `à régler.

Motif (facultatif) :`,
        ""
      );
      if (motif === null) return;

      setPendingId(achat.id);
      setNotice(null);
      try {
        await annulerPaiement(achat.id, motif || undefined);
        setNotice({ kind: "success", text: `Paiement de ${achat.ref} annulé.` });
        await load();
      } catch (err) {
        setNotice({
          kind: "error",
          text: extractApiErrorMessage(err, "Impossible d'annuler ce paiement."),
        });
      } finally {
        setPendingId(null);
      }
    },
    [load]
  );

  const runTransition = useCallback(
    async (achat: Achat, step: "BL" | "FACTURE" | "PAIEMENT") => {
      let ref: string | null = null;

      if (step === "BL") {
        ref = prompt(`Référence du bon de livraison pour ${achat.ref} :`, "");
        if (!ref?.trim()) return;
      } else if (step === "FACTURE") {
        ref = prompt(`Référence de la facture fournisseur pour ${achat.ref} :`, "");
        if (!ref?.trim()) return;
      } else {
        // Settling needs an explicit payment mode, so the popup takes over from
        // here and confirmPaiement() issues the request once a mode is chosen.
        setPayingAchat(achat);
        return;
      }

      setPendingId(achat.id);
      setNotice(null);
      try {
        if (step === "BL") {
          await validateBL(achat.id, ref!.trim());
          setNotice({ kind: "success", text: `${achat.ref} livré. Le stock du chantier a été approvisionné.` });
        } else if (step === "FACTURE") {
          await validateFacture(achat.id, ref!.trim());
          setNotice({ kind: "success", text: `Facture enregistrée pour ${achat.ref}.` });
        }
        await load();
      } catch (err) {
        setNotice({
          kind: "error",
          text: extractApiErrorMessage(err, `Impossible de faire progresser ${achat.ref}.`),
        });
      } finally {
        setPendingId(null);
      }
    },
    [load]
  );

  const h = useMemo(() => hydrate<Achat, AchatsHydrated>(achats, achatsHydrationConfig), [achats]);

  if (error && achats.length === 0) {
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
        <button onClick={() => load()} className="px-5 py-2 text-sm font-medium text-white bg-accent hover:bg-accent/90 rounded-lg transition-colors">
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="bg-surface-page dark:bg-surface-page-dark min-h-full py-6 px-4 sm:px-6 lg:px-8">
      <FadeSwap show={loading && achats.length === 0} skeleton={<AchatsSkeleton />}>
        <ChartJsLoader>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">
              Achats — Commandes
            </h1>
            <p className="text-sm text-content-muted dark:text-content-muted-dark mt-1">
              {achats.length} commandes enregistrées
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RefreshButton onClick={() => load()} loading={loading} />
            <PrimaryActionButton onClick={() => setShowForm(v => !v)}>
              {showForm ? "Fermer" : "+ Nouvelle commande"}
            </PrimaryActionButton>
          </div>
        </div>

        {/* Choosing the mode when settling an order. */}
        <ModePaiementDialog
          open={payingAchat !== null}
          subtitle={payingAchat
            ? `Commande ${payingAchat.ref} — ${fmt(payingAchat.ttc)} TTC · chantier ${payingAchat.chantierNom}`
            : undefined}
          submitting={modeSubmitting}
          error={modeError}
          onConfirm={confirmPaiement}
          onCancel={() => { setPayingAchat(null); setModeError(null); }}
        />

        {/* Correcting the mode of an order already settled. */}
        <ModePaiementDialog
          open={changingAchat !== null}
          title="Modifier le mode de paiement"
          subtitle={changingAchat ? `Commande ${changingAchat.ref}` : undefined}
          current={changingAchat?.modePaiement}
          submitting={modeSubmitting}
          error={modeError}
          onConfirm={confirmChangeMode}
          onCancel={() => { setChangingAchat(null); setModeError(null); }}
        />

        {notice && (
          <div
            role={notice.kind === "error" ? "alert" : "status"}
            className={`mb-6 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${
              notice.kind === "error"
                ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
                : "border-green-200 dark:border-green-900/50 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
            }`}
          >
            <span>{notice.text}</span>
            <button
              onClick={() => setNotice(null)}
              aria-label="Fermer"
              className="shrink-0 font-semibold opacity-70 hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        )}

        {showForm && (
          <form
            onSubmit={handleSubmit}
            className="mb-6 rounded-2xl border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark p-4 space-y-5"
          >
            <h2 className="text-sm font-semibold text-content-primary dark:text-content-primary-dark">
              Nouvelle commande achat
            </h2>

            <div className="grid gap-4 md:grid-cols-2">

              <label className="text-sm space-y-1">
                <span className="text-content-muted">Référence</span>
                <input
                  required
                  value={form.ref}
                  onChange={(e) =>
                    setForm(v => ({ ...v, ref: e.target.value }))
                  }
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                  placeholder="ACH-001"
                />
              </label>


              <label className="text-sm space-y-1">
                <span className="text-content-muted">Fournisseur</span>
                <select
                  required
                  value={form.fournisseurId}
                  onChange={(e) =>
                    setForm(v => ({
                      ...v,
                      fournisseurId: e.target.value
                    }))
                  }
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                >
                  <option value="">Choisir un fournisseur</option>

                  {fournisseurs.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.raisonSociale}
                    </option>
                  ))}
                </select>
              </label>


              <label className="text-sm space-y-1">
                <span className="text-content-muted">Chantier</span>
                <select
                  required
                  value={form.chantierId}
                  onChange={(e) =>
                    setForm(v => ({
                      ...v,
                      chantierId: e.target.value
                    }))
                  }
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                >
                  <option value="">Choisir un chantier</option>

                  {chantiers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nom}
                    </option>
                  ))}
                </select>
              </label>


              <label className="text-sm space-y-1">
                <span className="text-content-muted">Date commande</span>
                <input
                  type="date"
                  required
                  value={form.dateCommande}
                  onChange={(e) =>
                    setForm(v => ({
                      ...v,
                      dateCommande: e.target.value
                    }))
                  }
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                />
              </label>


              <label className="text-sm space-y-1">
                <span className="text-content-muted">
                  Date livraison prévue
                </span>

                <input
                  type="date"
                  required
                  value={form.dateLivraisonPrevue}
                  onChange={(e) =>
                    setForm(v => ({
                      ...v,
                      dateLivraisonPrevue: e.target.value
                    }))
                  }
                  className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                />
              </label>

            </div>


            <div className="space-y-2">
              <h3 className="text-sm font-semibold">
                Indicateurs de facturation
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <IndicateurCheckbox
                  variant="analytique"
                  checked={form.impactAnalytiqueChantier}
                  onChange={(v) => setForm(f => ({ ...f, impactAnalytiqueChantier: v }))}
                />
                <IndicateurCheckbox
                  variant="fiscal"
                  checked={form.impactComptableFiscal}
                  onChange={(v) => setForm(f => ({ ...f, impactComptableFiscal: v }))}
                />
              </div>
            </div>


            <div className="space-y-3">

              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold">
                  Lignes de commande
                </h3>

                <button
                  type="button"
                  onClick={() =>
                    setForm(v => ({
                      ...v,
                      lignes: [
                        ...v.lignes,
                        {
                          articleId: "",
                          designation: "",
                          quantite: 1,
                          prixUnitaire: 0,
                          bpuLigneId: ""
                        }
                      ]
                    }))
                  }
                  className="text-xs text-accent font-semibold"
                >
                  + Ajouter une ligne
                </button>
              </div>


              {form.lignes.map((ligne, index) => (

                <div
                  key={index}
                  className="grid gap-3 md:grid-cols-5 items-end"
                >
                  <label className="text-sm space-y-1 md:col-span-2">
                    <span className="text-content-muted">
                      Désignation
                    </span>

                    <label className="text-sm space-y-1 md:col-span-2">
                      <span className="text-content-muted">Article</span>

                      <select
                        required
                        value={ligne.articleId}
                        onChange={(e) => {
                          const article = articles.find(a => a.id === e.target.value);

                          setForm(v => ({
                            ...v,
                            lignes: v.lignes.map((l, i) =>
                              i === index
                                ? {
                                  ...l,
                                  articleId: article?.id ?? "",
                                  designation: article?.designation ?? "",
                                  prixUnitaire: article?.prixAchatRef ?? 0,
                                }
                                : l
                            ),
                          }));
                        }}
                        className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                      >
                        <option value="">Choisir un article</option>

                        {articles.map(article => (
                          <option key={article.id} value={article.id}>
                            {article.designation}
                          </option>
                        ))}
                      </select>
                    </label>
                  </label>


                  <label className="text-sm space-y-1">
                    <span className="text-content-muted">
                      Quantité
                    </span>

                    <input
                      type="number"
                      // Quantities are DOUBLE PRECISION like the unit price, so
                      // the browser must not round to whole units — a line can
                      // legitimately be 2.75 t or 0.125 m³.
                      min="0"
                      step="any"
                      required
                      value={ligne.quantite}
                      onChange={(e) =>
                        setForm(v => ({
                          ...v,
                          lignes: v.lignes.map((l, i) =>
                            i === index
                              ? { ...l, quantite: Number(e.target.value) }
                              : l
                          )
                        }))
                      }
                      className="w-full rounded-lg border border-edge-subtle px-3 py-2"
                    />
                  </label>


                  <label className="text-sm space-y-1">
                    <span className="text-content-muted">
                      Prix HT
                    </span>

                    <div className="w-full rounded-lg border border-edge-subtle px-3 py-2 bg-gray-100">
                      {ligne.prixUnitaire} DH
                    </div>
                  </label>


                  <label className="text-sm space-y-1">
                    <span className="text-content-muted">
                      Ligne BPU
                    </span>

                    <select
                      value={ligne.bpuLigneId}
                      disabled={!form.chantierId}
                      onChange={(e) =>
                        setForm(v => ({
                          ...v,
                          lignes: v.lignes.map((l, i) =>
                            i === index
                              ? { ...l, bpuLigneId: e.target.value }
                              : l
                          )
                        }))
                      }
                      className="w-full rounded-lg border border-edge-subtle px-3 py-2 disabled:opacity-50"
                    >
                      <option value="">Aucune imputation</option>

                      {bpuLignes.map(bl => (
                        <option key={bl.id} value={bl.id}>
                          {bl.ref} — {bl.designation}
                        </option>
                      ))}
                    </select>
                  </label>


                  {form.lignes.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm(v => ({
                          ...v,
                          lignes: v.lignes.filter((_, i) => i !== index)
                        }))
                      }
                      className="text-xs text-red-500"
                    >
                      Supprimer
                    </button>
                  )}

                </div>

              ))}

            </div>


            {formError && (
              <p className="text-sm text-red-500">
                {formError}
              </p>
            )}


            <div className="flex gap-3">

              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? "Enregistrement…" : "Créer la commande"}
              </button>


              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-sm text-content-muted"
              >
                Annuler
              </button>

            </div>

          </form>
        )}
        {/* ── KPIs ─────────────────────────────────────────────────────── */}
        <Section title="Vue d'ensemble">
          <KpiGrid kpis={h.kpis} />
        </Section>

        {/* ── Charts ───────────────────────────────────────────────────── */}
        <Section title="Analyse financière">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="HT vs TVA par commande (MAD)">
              <StackedBarChart data={h.budgetStacks} />
            </ChartCard>
            <ChartCard title="Tendance HT vs TVA">
              <LineChart data={h.budgetTrend} />
            </ChartCard>
          </div>
        </Section>

        <Section title="Répartition des achats">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Montants TTC par fournisseur">
              <PieChart data={h.fournisseurs} />
            </ChartCard>
            <ChartCard title="Montants TTC par chantier">
              <HorizontalBarChart data={h.chantiers} />
            </ChartCard>
          </div>
        </Section>

        <Section title="Statuts & Articles">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ChartCard title="Statuts des commandes" className="sm:col-span-1">
              <DonutChart data={h.statuses} />
            </ChartCard>
            <ChartCard title="Top articles commandés (Valeur)" className="sm:col-span-2">
              <HorizontalBarChart data={h.articles} />
            </ChartCard>
          </div>
        </Section>

        {/* ── Table ───────────────────────────────────────────────────── */}
        <Section title="Liste des commandes">
          <Card>
            <div className="px-4 pt-4 pb-3 flex flex-col lg:flex-row lg:items-center gap-3">
              <input
                type="text"
                placeholder="Rechercher par référence, fournisseur, chantier…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full lg:w-80 px-4 py-2 text-sm rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark placeholder:text-content-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
              />
              <div className="flex flex-wrap items-center gap-3">
                <IndicateurFilterSelect variant="analytique" value={filterAnalytique} onChange={setFilterAnalytique} />
                <IndicateurFilterSelect variant="fiscal" value={filterFiscal} onChange={setFilterFiscal} />
                <label className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                    Trier
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="px-2.5 py-2 text-sm rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
                  >
                    <option value="NONE">Par défaut</option>
                    <option value="ANALYTIQUE">{INDICATEURS.analytique.label}</option>
                    <option value="FISCAL">{INDICATEURS.fiscal.label}</option>
                  </select>
                </label>
              </div>
            </div>
            {error && achats.length > 0 && (
              <p className="px-4 pb-3 text-xs text-red-500">{error}</p>
            )}
            <AchatsTable
              achats={filtered}
              onToggleIndicateur={toggleIndicateur}
              onRepriced={handleRepriced}
              onTransition={runTransition}
              onAnnulerPaiement={runAnnulerPaiement}
              onChangeMode={setChangingAchat}
              canValiderBL={canValiderBL}
              canValiderFinance={canValiderFinance}
              pendingId={pendingId}
            />
          </Card>
        </Section>
        </ChartJsLoader>
      </FadeSwap>
    </div>
  );
}

function AchatsSkeleton() {
  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">
            Achats — Commandes
          </h1>
          <Skeleton className="h-4 w-40 mt-2" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
      </div>

      <Section title="Vue d'ensemble">
        <KpiGridSkeleton count={5} />
      </Section>

      <Section title="Analyse financière">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCardSkeleton title="HT vs TVA par commande (MAD)" variant="bar" />
          <ChartCardSkeleton title="Tendance HT vs TVA" variant="line" />
        </div>
      </Section>

      <Section title="Répartition des achats">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCardSkeleton title="Montants TTC par fournisseur" variant="pie" />
          <ChartCardSkeleton title="Montants TTC par chantier" variant="hbar" rows={4} />
        </div>
      </Section>

      <Section title="Statuts & Articles">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ChartCardSkeleton title="Statuts des commandes" className="sm:col-span-1" variant="donut" />
          <ChartCardSkeleton title="Top articles commandés (Valeur)" className="sm:col-span-2" variant="hbar" rows={5} />
        </div>
      </Section>

      <Section title="Liste des commandes">
        <Card>
          <div className="px-4 pt-4 pb-3">
            <Skeleton className="h-9 w-full sm:w-80 rounded-lg" />
          </div>
          <TableSkeleton columns={12} rows={6} />
        </Card>
      </Section>
    </>
  );
}

/**
 * Order lines for one purchase order, with the unit price editable in place.
 * Re-pricing is allowed at every statut; the server answers with a warning when
 * the order is already invoiced or paid, and that warning is shown here.
 */
function LignesPanel({ achat, onRepriced }: { achat: Achat; onRepriced: (updated: Achat) => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [editingMontant, setEditingMontant] = useState(false);
  const [montantDraft, setMontantDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "warning" | "error"; text: string } | null>(null);

  const lignes = achat.lignes ?? [];

  const startEdit = (ligneId: string, current: number) => {
    setFeedback(null);
    setEditingId(ligneId);
    setDraft(String(current));
  };

  const save = async (ligneId: string) => {
    const next = Number(draft);
    if (!Number.isFinite(next) || next < 0) {
      setFeedback({ kind: "error", text: "Le prix doit être un nombre positif." });
      return;
    }
    setSaving(true);
    try {
      const { achat: updated, warning } = await updateLignePrix(achat.id, ligneId, next);
      onRepriced(updated);
      setEditingId(null);
      setFeedback(warning ? { kind: "warning", text: warning } : null);
    } catch (err) {
      setFeedback({
        kind: "error",
        text: extractApiErrorMessage(err, "Impossible de modifier le prix de cette ligne."),
      });
    } finally {
      setSaving(false);
    }
  };

  /** Re-prices the whole order; the server spreads the total over the lines. */
  const saveMontant = async () => {
    const next = Number(montantDraft);
    if (!Number.isFinite(next) || next < 0) {
      setFeedback({ kind: "error", text: "Le montant doit être un nombre positif." });
      return;
    }
    setSaving(true);
    try {
      const { achat: updated, warning } = await updateMontantHt(achat.id, next);
      onRepriced(updated);
      setEditingMontant(false);
      setFeedback(warning ? { kind: "warning", text: warning } : null);
    } catch (err) {
      setFeedback({
        kind: "error",
        text: extractApiErrorMessage(err, "Impossible de modifier le montant de cette commande."),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <h4 className="text-xs font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark mb-3">
        Lignes de commande ({lignes.length})
      </h4>

      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={`mb-3 rounded-lg border px-3 py-2 text-xs ${
            feedback.kind === "error"
              ? "border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300"
              : "border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
          }`}
        >
          {feedback.text}
        </p>
      )}

      {lignes.length === 0 ? (
        <p className="text-xs text-content-muted dark:text-content-muted-dark">Aucune ligne.</p>
      ) : (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-edge-subtle dark:border-edge-subtle-dark">
              {["Article", "Désignation", "Qté", "Unité", "Prix unitaire HT", "Total HT", ""].map((h, i) => (
                <th key={i} className="text-left px-2 py-1.5 font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => {
              const isEditing = editingId === l.id;
              return (
                <tr key={l.id} className="border-b border-edge-subtle dark:border-edge-subtle-dark">
                  <td className="px-2 py-2 font-mono">{l.articleCode}</td>
                  <td className="px-2 py-2">{l.designation}</td>
                  <td className="px-2 py-2">{l.quantite}</td>
                  <td className="px-2 py-2">{l.unite}</td>
                  <td className="px-2 py-2">
                    {isEditing ? (
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        // prix_unitaire is DOUBLE PRECISION: step="0.01" would
                        // make the browser reject sub-centime rates.
                        step="any"
                        value={draft}
                        disabled={saving}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") save(l.id);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-28 px-2 py-1 rounded border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark focus:outline-none focus:ring-2 focus:ring-accent/40"
                      />
                    ) : (
                      <span>{fmt(l.prixUnitaire)}</span>
                    )}
                  </td>
                  <td className="px-2 py-2 font-semibold">{fmt(l.total)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => save(l.id)}
                          disabled={saving}
                          className="text-accent font-semibold mr-3 disabled:opacity-50"
                        >
                          {saving ? "…" : "Enregistrer"}
                        </button>
                        <button onClick={() => setEditingId(null)} className="text-content-muted">
                          Annuler
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => startEdit(l.id, l.prixUnitaire)}
                        className="text-accent font-semibold"
                      >
                        Modifier le prix
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {lignes.length > 0 && (
        <div className="mt-4 pt-3 border-t border-edge-subtle dark:border-edge-subtle-dark">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark">
              Montant de la commande
            </span>
            {editingMontant ? (
              <>
                <input
                  autoFocus
                  type="number"
                  min="0"
                  step="any"
                  value={montantDraft}
                  disabled={saving}
                  onChange={(e) => setMontantDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveMontant();
                    if (e.key === "Escape") setEditingMontant(false);
                  }}
                  className="w-36 px-2 py-1 text-xs rounded border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
                <span className="text-xs text-content-muted dark:text-content-muted-dark">DH HT</span>
                <button
                  onClick={saveMontant}
                  disabled={saving}
                  className="text-xs text-accent font-semibold disabled:opacity-50"
                >
                  {saving ? "…" : "Enregistrer"}
                </button>
                <button
                  onClick={() => setEditingMontant(false)}
                  className="text-xs text-content-muted dark:text-content-muted-dark"
                >
                  Annuler
                </button>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold">{fmt(achat.ht)} DH HT</span>
                <button
                  onClick={() => {
                    setFeedback(null);
                    setMontantDraft(String(achat.ht));
                    setEditingMontant(true);
                  }}
                  className="text-xs text-accent font-semibold"
                  title="Re-tarifer toute la commande : les lignes gardent leurs proportions"
                >
                  Modifier le montant
                </button>
              </>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-content-muted dark:text-content-muted-dark">
            Le nouveau montant est réparti sur les lignes dans les proportions
            qu&apos;elles ont déjà. Pour une seule ligne, modifiez son prix ci-dessus.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * The one action available on an order at its current statut, or null when the
 * order is settled. Mirrors the server's strictly sequential state machine, so
 * a step can never be offered out of order.
 */
function nextTransition(
  status: Achat["status"],
  canValiderBL: boolean,
  canValiderFinance: boolean
): { step: "BL" | "FACTURE" | "PAIEMENT"; label: string; allowed: boolean } | null {
  switch (status) {
    case "EN_COURS":
      return { step: "BL", label: "Valider le BL", allowed: canValiderBL };
    case "LIVRE":
      return { step: "FACTURE", label: "Valider la facture", allowed: canValiderFinance };
    case "FACTURE":
      return { step: "PAIEMENT", label: "Valider le paiement", allowed: canValiderFinance };
    default:
      return null; // PAYE — end of the cycle
  }
}

function AchatsTable({
  achats,
  onToggleIndicateur,
  onRepriced,
  onTransition,
  onAnnulerPaiement,
  onChangeMode,
  canValiderBL,
  canValiderFinance,
  pendingId,
}: {
  achats: Achat[];
  onToggleIndicateur: (
    id: string,
    key: "impactAnalytiqueChantier" | "impactComptableFiscal",
    next: boolean
  ) => void;
  onRepriced: (updated: Achat) => void;
  onTransition: (achat: Achat, step: "BL" | "FACTURE" | "PAIEMENT") => void;
  onAnnulerPaiement: (achat: Achat) => void;
  onChangeMode: (achat: Achat) => void;
  canValiderBL: boolean;
  canValiderFinance: boolean;
  pendingId: string | null;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const hTable = useMemo(() => achatsHydrationConfig.table(achats), [achats]);

  if (achats.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-content-muted dark:text-content-muted-dark">Aucune commande trouvée.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[1200px]">
        <thead>
          <tr className="border-b-2 border-edge-default dark:border-edge-default-dark">
            {["Réf", "Fournisseur", "Chantier", "Date", "HT", "TVA", "TTC", "Statut"].map(title => (
              <th key={title} className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap">
                {title}
              </th>
            ))}
            <th
              title={INDICATEURS.analytique.tooltip}
              className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap"
            >
              {INDICATEURS.analytique.short}
            </th>
            <th
              title={INDICATEURS.fiscal.tooltip}
              className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap"
            >
              {INDICATEURS.fiscal.short}
            </th>
            <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap">
              Paiement
            </th>
            <th className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {hTable.rows.map(row => {
            const isOpen = expanded === row.id;
            const achat = achats.find(a => a.id === row.id);
            return (
              <Fragment key={row.id}>
              <tr
                onClick={() => setExpanded(isOpen ? null : row.id)}
                className={`border-b border-edge-subtle dark:border-edge-subtle-dark cursor-pointer transition-colors duration-150 ${isOpen ? "bg-accent-50 dark:bg-accent-950/30" : "hover:bg-surface-hover dark:hover:bg-surface-hover-dark"}`}
              >
                <td className="px-3 py-3 font-mono text-xs font-semibold text-accent whitespace-nowrap">{row.ref}</td>
                <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark">{row.col1}</td>
                <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark">{row.col2}</td>
                <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark">{row.col3}</td>
                <td className="px-3 py-3 font-semibold text-content-primary dark:text-content-primary-dark">{fmt(row.ht)}</td>
                <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark">{fmt(row.tva)}</td>
                <td className="px-3 py-3 font-bold text-content-primary dark:text-content-primary-dark">{fmt(row.ttc)}</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${row.statusBg} ${row.statusText}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: row.statusDot }} />
                    {row.statusLabel}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <IndicateurBadge
                    variant="analytique"
                    value={row.impactAnalytiqueChantier ?? false}
                    onToggle={() =>
                      onToggleIndicateur(row.id, "impactAnalytiqueChantier", !(row.impactAnalytiqueChantier ?? false))
                    }
                  />
                </td>
                <td className="px-3 py-3">
                  <IndicateurBadge
                    variant="fiscal"
                    value={row.impactComptableFiscal ?? false}
                    onToggle={() =>
                      onToggleIndicateur(row.id, "impactComptableFiscal", !(row.impactComptableFiscal ?? false))
                    }
                  />
                </td>
                <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {achat?.status === "PAYE" ? (
                    <span className="inline-flex items-center gap-2">
                      <ModePaiementBadge mode={achat.modePaiement} />
                      {canValiderFinance && (
                        <button
                          onClick={() => onChangeMode(achat)}
                          className="text-[11px] text-accent font-semibold hover:underline"
                        >
                          Modifier
                        </button>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  {(() => {
                    if (!achat) return null;
                    const next = nextTransition(achat.status, canValiderBL, canValiderFinance);
                    if (!next) {
                      // Une commande soldée n'a plus d'étape devant elle, mais son
                      // règlement peut avoir été saisi à tort. C'est le seul endroit
                      // d'où l'annuler : contre-passer l'écriture depuis la caisse
                      // rendrait l'argent en laissant la commande payée.
                      return canValiderFinance ? (
                        <button
                          onClick={() => onAnnulerPaiement(achat)}
                          disabled={pendingId === achat.id}
                          className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50 disabled:cursor-wait"
                          title="Le montant est rendu à la caisse et la commande redevient une facture à régler"
                        >
                          {pendingId === achat.id ? "…" : "Annuler le paiement"}
                        </button>
                      ) : (
                        <span className="text-[11px] text-content-muted dark:text-content-muted-dark">Soldé</span>
                      );
                    }
                    if (!next.allowed) {
                      return (
                        <span
                          title="Votre rôle ne permet pas cette étape"
                          className="text-[11px] text-content-muted dark:text-content-muted-dark"
                        >
                          {next.label}
                        </span>
                      );
                    }
                    return (
                      <button
                        onClick={() => onTransition(achat, next.step)}
                        disabled={pendingId === achat.id}
                        className="text-xs font-semibold text-accent hover:underline disabled:opacity-50 disabled:cursor-wait"
                      >
                        {pendingId === achat.id ? "…" : next.label}
                      </button>
                    );
                  })()}
                </td>
              </tr>
              {isOpen && achat && (
                <tr>
                  <td colSpan={12} className="bg-surface-hover dark:bg-surface-hover-dark px-4 py-4">
                    <LignesPanel achat={achat} onRepriced={onRepriced} />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}