"use client";

import { useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

import { hydrate } from "@/components/functions2";
import type {
  Achat, AchatsHydrated,
  Fournisseur, FournisseursHydrated,
  Chantier, ChantiersHydrated,
  Transaction, TresorerieHydrated,
  ContratSousTraitanceWithPaiements, SousTraitanceHydrated,
  FichePaie, SalairesHydrated,
  Article, CatalogueHydrated,
  Employe, AnnuaireHydrated,
  EcritureComptable, ComptabiliteHydrated,
  Paiement, PaiementsHydrated,
} from "@/components/functions2";
import {
  achatsHydrationConfig,
  fournisseursHydrationConfig,
  chantiersHydrationConfig,
  tresorerieHydrationConfig,
  sousTraitanceHydrationConfig,
  salairesHydrationConfig,
  catalogueHydrationConfig,
  annuaireHydrationConfig,
  comptabiliteHydrationConfig,
  paiementsHydrationConfig,
} from "@/components/functions2";

import { ChartJsLoader, Card, HorizontalBarChart, DonutChart, FadeSwap, Skeleton } from "@/components/Functions";

import { fetchAchats } from "@/lib/api/achats";
import { fetchFournisseurs } from "@/lib/api/fournisseurs";
import { fetchChantiers } from "@/lib/api/chantier";
import { fetchCaisses, fetchTransactions } from "@/lib/api/tresorerie";
import { fetchContratsSousTraitant, fetchPaiements } from "@/lib/api/sousTraitance";
import { fetchSalaires } from "@/lib/api/salaires";
import { fetchArticles } from "@/lib/api/articles";
import { fetchEmployes } from "@/lib/api/employes";
import { fetchEcritures } from "@/lib/api/comptabilite";
import { fetchStocksByChantier, type StockArticleDTO } from "@/lib/api/stocks";
import { fetchDashboardKpis, type DashboardKpisDTO } from "@/lib/api/dashboard";
import { fmt } from "@/components/functions2";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import type { ExportSection } from "@/lib/api/export";

import { useAuth } from "@/lib/authContext";
import { isAllowed, type Role } from "@/lib/auth/permissions";

export default function DashboardClient() {
  const { user, loading: authLoading } = useAuth();
  const role = user?.role as Role | undefined;

  const [achats, setAchats] = useState<Achat[]>([]);
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([]);
  const [chantiers, setChantiers] = useState<Chantier[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [contratsST, setContratsST] = useState<ContratSousTraitanceWithPaiements[]>([]);
  const [paiements, setPaiements] = useState<Paiement[]>([]);
  const [fiches, setFiches] = useState<FichePaie[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [employes, setEmployes] = useState<Employe[]>([]);
  const [ecritures, setEcritures] = useState<EcritureComptable[]>([]);
  const [stocks, setStocks] = useState<StockArticleDTO[]>([]);
  const [stocksChantierNom, setStocksChantierNom] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canFinanceKpis = role === "ADMIN" || role === "FINANCE" || role === "DIRECTEUR";
  const [kpisMonth, setKpisMonth] = useState("");
  const [kpis, setKpis] = useState<DashboardKpisDTO | null>(null);
  const [kpisLoading, setKpisLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Each domain is gated by its own backend role check, and not every role
    // can see every domain (e.g. a VIEWER can't list achats or salaires).
    // A 403 on one domain must never blank out the domains the role *can*
    // see, so every fetch below is isolated and skipped up front when the
    // role isn't allowed on that page.
    async function safe<T>(allowed: boolean, fn: () => Promise<T>, fallback: T): Promise<T> {
      if (!allowed) return fallback;
      try {
        return await fn();
      } catch {
        return fallback;
      }
    }

    const canAchats = isAllowed("/dashboard/achats", role);
    const canFournisseurs = isAllowed("/dashboard/fournisseurs", role);
    const canChantiers = isAllowed("/dashboard/suivi-chantiers", role);
    const canStocks = isAllowed("/dashboard/stocks", role);
    const canTresorerie = isAllowed("/dashboard/tresorerie", role);
    const canSousTraitance = isAllowed("/dashboard/sous-traitance", role) || isAllowed("/dashboard/payments", role);
    const canSalaires = isAllowed("/dashboard/salaires", role);
    const canCatalogue = isAllowed("/dashboard/catalogue", role);
    const canAnnuaire = isAllowed("/dashboard/annuaire", role);
    const canComptabilite = isAllowed("/dashboard/comptabilite", role);

    try {
      const [
        achatsData,
        fournisseursData,
        chantiersData,
        caissesData,
        contratsData,
        fichesData,
        articlesRes,
        employesData,
        ecrituresData,
      ] = await Promise.all([
        safe(canAchats, () => fetchAchats(), []),
        safe(canFournisseurs, () => fetchFournisseurs(), []),
        safe(canChantiers || canStocks, () => fetchChantiers(), []),
        safe(canTresorerie, () => fetchCaisses(), []),
        safe(canSousTraitance, () => fetchContratsSousTraitant(), []),
        safe(canSalaires, () => fetchSalaires(), []),
        safe(canCatalogue, () => fetchArticles(0, 100, "designation,asc"), {
          content: [], totalElements: 0, totalPages: 0, number: 0, size: 0, first: true, last: true,
        }),
        safe(canAnnuaire, () => fetchEmployes(), []),
        safe(canComptabilite, () => fetchEcritures(), []),
      ]);

      setAchats(achatsData);

      setFournisseurs(
        fournisseursData.map((f) => ({
          ...f,
          totalAchatsAnnee: f.totalAchatsAnnee ?? 0,
          soldeImpaye: f.soldeImpaye ?? 0,
        })) as unknown as Fournisseur[]
      );

      const mappedChantiers = chantiersData.map((c) => ({
        ...c,
        depensesHT: c.depensesHt ?? 0,
        budgetHT: c.budgetHt ?? 0,
        avancement: c.avancement ?? 0,
        jalons: c.jalons ?? [],
        soustraitantsActifs: c.soustraitantsActifs ?? [],
      })) as unknown as Chantier[];
      setChantiers(mappedChantiers);

      setFiches(fichesData as unknown as FichePaie[]);

      setArticles(
        articlesRes.content.map((a) => ({
          ...a,
          categorieLibelle: a.categorieLibelle ?? "Autre",
          actif: a.actif ?? true,
          fournisseursPreferentiels: a.fournisseursPreferentiels ?? [],
        })) as unknown as Article[]
      );

      setEmployes(
        employesData.map((e) => ({
          ...e,
          statut: e.statut ?? "ACTIF",
          role: (e.role as Employe["role"]) ?? "OUVRIER",
        })) as unknown as Employe[]
      );

      setEcritures(ecrituresData);

      // Cash flow: transactions live under each caisse.
      const txLists = await Promise.all(
        (caissesData ?? []).map((c) =>
          safe(
            canTresorerie,
            () => fetchTransactions(c.id),
            []
          ).then((tx) =>
            tx.map((t) => ({
              ...t,
              montant: t.montant ?? 0,
              caisseId: c.id,
              caisseLibelle: c.libelle,
            }))
          )
        )
      );
      setTransactions(txLists.flat() as unknown as Transaction[]);

      // Paiements live under each sous-traitance contract — fetch once and
      // reuse both for the sous-traitance chart (contrat.paiements) and the
      // flattened payments-domain view.
      const contratsWithPaiements = await Promise.all(
        (contratsData ?? []).map(async (contrat) => {
          const ps = await safe(canSousTraitance, () => fetchPaiements(contrat.id), []);
          return { ...contrat, paiements: ps };
        })
      );
      setContratsST(contratsWithPaiements as unknown as ContratSousTraitanceWithPaiements[]);

      const paiementLists = contratsWithPaiements.map((contrat) =>
        contrat.paiements.map(
          (p): Paiement => ({
            id: p.id,
            ref: p.reference,
            type: "SOUS_TRAITANT",
            tiers: contrat.sousTraitantRaisonSociale,
            chantierId: contrat.chantierId,
            chantierNom: contrat.chantierNom,
            montantTotal: p.montant,
            montantPaye: p.statut === "PAYE" ? p.montant : 0,
            montantRestant: p.statut === "PAYE" ? 0 : p.montant,
            dateEcheance: p.datePaiement ?? "",
            datePaiement: p.datePaiement ?? undefined,
            statut: p.statut,
            referenceDoc: contrat.reference,
          })
        )
      );
      setPaiements(paiementLists.flat());

      // Stocks are chantier-scoped — show the first chantier as a representative sample.
      if (canStocks && mappedChantiers.length > 0) {
        const first = chantiersData[0];
        const stocksData = await safe(true, () => fetchStocksByChantier(first.id), []);
        setStocks(stocksData);
        setStocksChantierNom(first.nom);
      } else {
        setStocks([]);
        setStocksChantierNom("");
      }
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  useEffect(() => {
    if (authLoading || !canFinanceKpis) return;
    setKpisLoading(true);
    fetchDashboardKpis(kpisMonth || undefined)
      .then(setKpis)
      .catch(() => setKpis(null))
      .finally(() => setKpisLoading(false));
  }, [authLoading, canFinanceKpis, kpisMonth]);

  const hAchats = useMemo(() => hydrate<Achat, AchatsHydrated>(achats, achatsHydrationConfig), [achats]);
  const hFournisseurs = useMemo(() => hydrate<Fournisseur, FournisseursHydrated>(fournisseurs, fournisseursHydrationConfig), [fournisseurs]);
  const hChantiers = useMemo(() => hydrate<Chantier, ChantiersHydrated>(chantiers, chantiersHydrationConfig), [chantiers]);
  const hTresorerie = useMemo(() => hydrate<Transaction, TresorerieHydrated>(transactions, tresorerieHydrationConfig), [transactions]);
  const hSousTraitance = useMemo(() => hydrate<ContratSousTraitanceWithPaiements, SousTraitanceHydrated>(contratsST, sousTraitanceHydrationConfig), [contratsST]);
  const hSalaires = useMemo(() => hydrate<FichePaie, SalairesHydrated>(fiches, salairesHydrationConfig), [fiches]);
  const hCatalogue = useMemo(() => hydrate<Article, CatalogueHydrated>(articles, catalogueHydrationConfig), [articles]);
  const hAnnuaire = useMemo(() => hydrate<Employe, AnnuaireHydrated>(employes, annuaireHydrationConfig), [employes]);
  const hComptabilite = useMemo(() => hydrate<EcritureComptable, ComptabiliteHydrated>(ecritures, comptabiliteHydrationConfig), [ecritures]);
  const hPaiements = useMemo(() => hydrate<Paiement, PaiementsHydrated>(paiements, paiementsHydrationConfig), [paiements]);

  const stocksEnAlerte = stocks.filter((s) => s.enAlerte);

  // Dette fournisseurs : même source que la carte du haut.
  //
  // Ce tuilage lisait SUM(fournisseur.soldeImpaye). Le champ existe en base,
  // dans le DTO et dans l'export Excel, mais rien ne l'écrit jamais — aucun
  // setSoldeImpaye dans le backend, et le mapper l'ignore explicitement. Il
  // valait donc 0 en permanence, juste sous une carte qui affichait la vraie
  // dette : deux chiffres contradictoires pour la même chose sur un écran.
  const resteFournisseurs = kpis?.dettesFournisseursTtc;
  const payeFournisseurs = kpis?.dettesFournisseursPayeTtc;
  const engageFournisseurs =
    resteFournisseurs !== undefined && payeFournisseurs !== undefined
      ? resteFournisseurs + payeFournisseurs
      : undefined;
  // Le sous-titre dit la part soldée plutôt qu'un taux d'impayé calculé sur un
  // champ mort. Sans rien d'engagé, un pourcentage ne veut rien dire.
  const sousTitreFournisseurs =
    engageFournisseurs === undefined || payeFournisseurs === undefined
      ? ""
      : engageFournisseurs > 0
        ? `${Math.round((payeFournisseurs / engageFournisseurs) * 100)}% déjà réglé`
        : "rien engagé";

  const topCards = [
    {
      title: "Dettes Fournisseurs",
      value: resteFournisseurs !== undefined ? fmt(resteFournisseurs) : "—",
      sub: sousTitreFournisseurs,
      href: "/dashboard/fournisseurs",
    },
    {
      title: "Décaissements caisse",
      value: hTresorerie.kpis[1]?.value ?? "—",
      sub: hTresorerie.kpis[1]?.sub ?? "",
      href: "/dashboard/tresorerie",
    },
    {
      title: "Dettes sous-traitants",
      value: hSousTraitance.kpis[3]?.value ?? "—",
      sub: hSousTraitance.kpis[3]?.sub ?? "",
      href: "/dashboard/sous-traitance",
    },
    {
      title: "Paiements",
      value: hPaiements.kpis[1]?.value ?? "—",
      sub: hPaiements.kpis[1]?.sub ?? "",
      href: "/dashboard/payments",
    },
  ].filter((c) => isAllowed(c.href, role));

  const domainCards: {
    href: string;
    title: string;
    kpi: string;
    sub: string;
    chart: ReactNode;
    exportSection?: ExportSection;
  }[] = [
    {
      href: "/dashboard/achats",
      title: "Achats",
      exportSection: "ACHATS" as ExportSection,
      kpi: hAchats.kpis[0]?.value ?? "—",
      sub: hAchats.kpis[0]?.sub ?? "",
      chart: hAchats.statuses.length > 0 ? <DonutChart data={hAchats.statuses} /> : null,
    },
    {
      href: "/dashboard/fournisseurs",
      title: "Fournisseurs",
      exportSection: "FOURNISSEURS" as ExportSection,
      kpi: hFournisseurs.kpis[0]?.value ?? "—",
      sub: hFournisseurs.kpis[0]?.sub ?? "",
      chart: hFournisseurs.statuses.length > 0 ? <DonutChart data={hFournisseurs.statuses} /> : null,
    },
    {
      href: "/dashboard/stocks",
      title: "Gestion des Stocks",
      kpi: `${stocks.length}`,
      sub: stocksChantierNom ? `articles — ${stocksChantierNom}` : "articles en stock",
      chart: (
        <div className="text-xs text-content-muted dark:text-content-muted-dark space-y-2 mt-1">
          <div className="flex items-center justify-between">
            <span>Alertes seuil</span>
            <span className="font-semibold text-red-600 dark:text-red-400">{stocksEnAlerte.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Quantité théorique</span>
            <span className="font-semibold text-content-primary dark:text-content-primary-dark">
              {stocks.reduce((s, a) => s + a.quantiteTheorique, 0).toLocaleString("fr-FR")}
            </span>
          </div>
        </div>
      ),
    },
    {
      href: "/dashboard/suivi-chantiers",
      exportSection: "CHANTIERS" as ExportSection,
      title: "Suivi Chantiers",
      kpi: hChantiers.kpis[0]?.value ?? "—",
      sub: hChantiers.kpis[0]?.sub ?? "",
      chart: hChantiers.statutsChantiers.length > 0 ? <DonutChart data={hChantiers.statutsChantiers} /> : null,
    },
    {
      href: "/dashboard/tresorerie",
      exportSection: "CAISSES" as ExportSection,
      title: "Trésorerie et Caisse",
      kpi: hTresorerie.kpis[2]?.value ?? "—",
      sub: hTresorerie.kpis[2]?.sub ?? "",
      chart: hTresorerie.repartitionFlux.length > 0 ? <DonutChart data={hTresorerie.repartitionFlux} /> : null,
    },
    {
      href: "/dashboard/sous-traitance",
      exportSection: "SOUS_TRAITANCE" as ExportSection,
      title: "Sous Traitance",
      kpi: hSousTraitance.kpis[1]?.value ?? "—",
      sub: hSousTraitance.kpis[1]?.sub ?? "",
      chart: hSousTraitance.statutsContrats.length > 0 ? <DonutChart data={hSousTraitance.statutsContrats} /> : null,
    },
    {
      href: "/dashboard/salaires",
      exportSection: "SALAIRES" as ExportSection,
      title: "Salaires",
      kpi: hSalaires.kpis[0]?.value ?? "—",
      sub: hSalaires.kpis[0]?.sub ?? "",
      chart: hSalaires.statutsFiches.length > 0 ? <DonutChart data={hSalaires.statutsFiches} /> : null,
    },
    {
      href: "/dashboard/catalogue",
      exportSection: "ARTICLES" as ExportSection,
      title: "Catalogue Articles",
      kpi: hCatalogue.kpis[0]?.value ?? "—",
      sub: hCatalogue.kpis[0]?.sub ?? "",
      chart: hCatalogue.statuses.length > 0 ? <DonutChart data={hCatalogue.statuses} /> : null,
    },
    {
      href: "/dashboard/payments",
      title: "Paiements",
      kpi: hPaiements.kpis[0]?.value ?? "—",
      sub: hPaiements.kpis[0]?.sub ?? "",
      chart: hPaiements.statutsPaiements.length > 0 ? <DonutChart data={hPaiements.statutsPaiements} /> : null,
    },
    {
      href: "/dashboard/annuaire",
      exportSection: "EMPLOYES" as ExportSection,
      title: "Annuaire",
      kpi: hAnnuaire.kpis[0]?.value ?? "—",
      sub: hAnnuaire.kpis[0]?.sub ?? "",
      chart: hAnnuaire.statutsEmployes.length > 0 ? <DonutChart data={hAnnuaire.statutsEmployes} /> : null,
    },
    {
      href: "/dashboard/comptabilite",
      title: "Comptabilite",
      kpi: hComptabilite.kpis[0]?.value ?? "—",
      sub: hComptabilite.kpis[0]?.sub ?? "",
      chart: hComptabilite.volumeParJournal.length > 0 ? <HorizontalBarChart data={hComptabilite.volumeParJournal.slice(0, 4)} /> : null,
    },
  ].filter((card) => isAllowed(card.href, role));

  const showSkeleton = loading && achats.length === 0 && fournisseurs.length === 0 && chantiers.length === 0;

  if (error && achats.length === 0 && fournisseurs.length === 0) {
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
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <FadeSwap show={showSkeleton} skeleton={<DashboardSkeleton />}>
        <ChartJsLoader>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            {!canFinanceKpis && (
              <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-white">
                  Vue d&apos;ensemble
                </h1>
                <p className="text-sm text-content-muted dark:text-gray-400 mt-1">
                  Indicateurs clés de tous les modules.
                </p>
              </div>
            )}

            {canFinanceKpis && (
              <FinanceKpisSection
                kpis={kpis}
                loading={kpisLoading}
                month={kpisMonth}
                onMonthChange={setKpisMonth}
              />
            )}

            {topCards.length === 0 && domainCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh] gap-2 text-center">
                <p className="text-sm font-medium text-content-primary dark:text-content-primary-dark">
                  Aucun module accessible avec votre rôle actuel.
                </p>
                <p className="text-xs text-content-muted dark:text-content-muted-dark">
                  Contactez un administrateur si vous pensez que c&apos;est une erreur.
                </p>
              </div>
            ) : (
              <>
                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-8">
                  {topCards.map((c) => (
                    <TopKpiCard key={c.title} {...c} />
                  ))}
                </section>

                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {domainCards.map((c) => (
                    <DomainCard key={c.href} {...c} />
                  ))}
                </section>
              </>
            )}
          </motion.div>
        </ChartJsLoader>
      </FadeSwap>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">
          Vue d&apos;ensemble
        </h1>
        <Skeleton className="h-4 w-56 mt-2" />
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="dark:bg-surface-card-dark bg-surface-card rounded-lg border border-edge-default dark:border-zinc-700 shadow-md p-3 h-25 flex flex-col justify-between">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-2.5 w-24" />
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-1">
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-16 mt-2" />
            <Skeleton className="h-3 w-28 mt-2 mb-3" />
            <Skeleton className="h-24 w-full rounded-full" />
          </Card>
        ))}
      </section>
    </>
  );
}

function TopKpiCard({
  title,
  value,
  sub,
  href,
}: {
  title: string;
  value: string;
  sub: string;
  href: string;
}) {
  return (
    <Link href={href} className="block group h-full">
      <div
        className="
          bg-surface-card dark:bg-[#1a1d25] border border-edge-default dark:border-[#242830] rounded-xl
          shadow-md p-5 h-full
          flex flex-col justify-between transition-all duration-150
          group-hover:shadow-lg group-hover:border-accent/50
          relative overflow-hidden
        "
      >
        <div className="flex items-center justify-between mb-3 z-10 relative">
          <span className="text-[10px] font-bold text-content-secondary dark:text-[#5a6275] uppercase tracking-widest">{title}</span>
          <span className="text-content-muted dark:text-[#3d4350] group-hover:text-accent transition-colors text-[10px]">→</span>
        </div>
        <div className="text-2xl font-bold font-mono text-content-primary dark:text-content-primary-dark mb-1.5 leading-none z-10 relative">{value}</div>
        <div className="text-[10px] text-content-muted dark:text-[#5a6275] truncate z-10 relative">{sub}</div>
      </div>
    </Link>
  );
}

function FinanceKpisSection({
  kpis,
  loading,
  month,
  onMonthChange,
}: {
  kpis: DashboardKpisDTO | null;
  loading: boolean;
  month: string;
  onMonthChange: (month: string) => void;
}) {
  return (
    <div className="module-view active">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-content-primary dark:text-white mb-1">Tableau de Bord Direction</h1>
          <p className="text-xs text-content-muted dark:text-gray-400">Situation en temps réel — <span id="dash-current-month-text">{month ? `Mois : ${month.split('-')[1]}/${month.split('-')[0]}` : 'Toutes les périodes'}</span></p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            id="dash-month-filter"
            className="w-auto h-10 px-3 bg-surface-card dark:bg-surface-card-dark text-content-primary dark:text-content-primary-dark border border-edge-default dark:border-[#242830] rounded-lg outline-none"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
          />
          {/* Whole dashboard, one sheet per section. Carries the month filter
              so the exported indicators match what is on screen. */}
          <ExportExcelButton month={month || undefined} size="md" />
        </div>
      </div>

      <h3 className="text-content-secondary dark:text-[#5a6275] mb-3 text-[11px] font-bold tracking-wider uppercase">
        <i className="fas fa-coins mr-2"></i>Trésorerie & Dettes (Affichage TTC)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <ModernKpiCard
          color="red"
          label="DETTES FOURNISSEURS (TTC)"
          value={kpis?.dettesFournisseursTtc}
          textColor="text-red-600 dark:text-red-500"
          sub="Déjà payé TTC :"
          subVal={kpis?.dettesFournisseursPayeTtc}
          loading={loading}
        />
        <ModernKpiCard
          color="red"
          label="DETTES SOUS-TRAITANTS (TTC)"
          value={kpis?.dettesSousTraitantsTtc}
          textColor="text-red-600 dark:text-red-500"
          sub="Déjà payé TTC :"
          subVal={kpis?.dettesSousTraitantsPayeTtc}
          loading={loading}
        />
        <ModernKpiCard
          color="yellow"
          label="PAIE (À PAYER NET)"
          value={kpis?.paieAPayerNet}
          textColor="text-amber-600 dark:text-amber-500"
          sub="Déjà réglée NET :"
          subVal={kpis?.paieRegleeNet}
          loading={loading}
        />
        <ModernKpiCard
          color="green"
          label="DÉCAISSEMENTS CAISSE (TTC)"
          value={kpis?.decaissementsCaisseTtc}
          textColor="text-green-600 dark:text-green-500"
          sub="Dépenses réelles de caisses"
          loading={loading}
        />
      </div>

      <h3 className="text-content-secondary dark:text-[#5a6275] mt-6 mb-3 text-[11px] font-bold tracking-wider uppercase">
        <i className="fas fa-chart-line mr-2"></i>Indicateurs Comptables (Affichage TTC, Base Marge HT)
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <ModernKpiCard
          color="green"
          label="ENCAISSEMENTS GLOBAUX (TTC)"
          value={kpis?.encaissementsGlobauxTtc}
          textColor="text-green-600 dark:text-green-500"
          sub="Décomptes clients encaissés"
          loading={loading}
        />
        <ModernKpiCard
          color="yellow"
          label="ATTACHEMENTS EN COURS (TTC)"
          value={kpis?.attachementsEnCoursTtc}
          textColor="text-amber-600 dark:text-amber-500"
          sub="Travaux validés non encaissés"
          loading={loading}
        />
        <ModernKpiCard
          color="white"
          label="DÉCAISSEMENTS GLOBAUX (TTC)"
          value={kpis?.decaissementsGlobauxTtc}
          textColor="text-content-primary dark:text-white"
          sub="Sorties globales (Banque + Caisses)"
          loading={loading}
        />
        <ModernKpiCard
          color="blue"
          label="VALEUR STOCKS GLOBALE (HT)"
          value={kpis?.valeurStocksGlobaleHt}
          textColor="text-blue-600 dark:text-blue-500"
          subNode={
            // Both figures used to be hardcoded 0 — there was no dépôt in the
            // model, so nothing could compute the split. They now come from the
            // stock location and always add up to the total above.
            <div className="text-[11px] text-content-muted dark:text-[#5a6275] mt-2 flex justify-between font-bold">
              <span>
                Dépôts:{" "}
                <span className="text-content-primary dark:text-white">
                  {loading || kpis?.valeurStocksDepotHt === undefined ? "—" : fmt(kpis.valeurStocksDepotHt)}
                </span>
              </span>
              <span>
                En Travaux:{" "}
                <span className="text-amber-600 dark:text-amber-500">
                  {loading || kpis?.valeurStocksEnTravauxHt === undefined ? "—" : fmt(kpis.valeurStocksEnTravauxHt)}
                </span>
              </span>
            </div>
          }
          loading={loading}
        />
        {/* Le même stock, découpé par emplacement au lieu de la disponibilité.
            Carte purement informative : aucune de ces deux valeurs n'entre dans
            une formule — seule la valeur globale ci-contre le fait, via la
            marge nette comptable. Le libellé le dit, pour qu'on ne l'additionne
            pas de tête avec la carte voisine. */}
        <ModernKpiCard
          color="white"
          label="STOCKS PAR EMPLACEMENT (HT)"
          value={kpis?.valeurStocksGlobaleHt}
          textColor="text-content-primary dark:text-white"
          subNode={
            <div className="text-[11px] text-content-muted dark:text-[#5a6275] mt-2 space-y-1 font-bold">
              <div className="flex justify-between">
                <span>
                  Au dépôt:{" "}
                  <span className="text-content-primary dark:text-white">
                    {loading || kpis?.valeurStocksAuDepotHt === undefined ? "—" : fmt(kpis.valeurStocksAuDepotHt)}
                  </span>
                </span>
                <span>
                  Sur chantiers:{" "}
                  <span className="text-blue-600 dark:text-blue-500">
                    {loading || kpis?.valeurStocksSurChantiersHt === undefined ? "—" : fmt(kpis.valeurStocksSurChantiersHt)}
                  </span>
                </span>
              </div>
              <div className="italic font-normal text-content-muted/85 dark:text-[#3d4350]">
                Informatif — n&apos;entre dans aucun calcul
              </div>
            </div>
          }
          loading={loading}
        />
      </div>

      {/* MARGES */}
      <div className="bg-surface-card dark:bg-surface-card-dark p-6 rounded-xl border border-edge-default dark:border-[#242830] mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h4 className="text-sm font-bold text-content-secondary dark:text-[#5a6275] uppercase tracking-wider">MARGE NETTE COMPTABLE (HT)</h4>
          <p className="text-xs text-content-muted dark:text-[#3d4350] mt-1">Formule : Encaissements Réels HT - Décaissements Réels HT + Valeur des Stocks HT</p>
          {/* Secondary note: the formula nets operational flows only, so the
              figure is not a taxable result. Kept subordinate to the formula. */}
          <p className="text-[11px] italic text-content-muted/85 dark:text-[#3d4350] mt-1">Indicateur calculé hors fiscalité (flux opérationnels ajustés)</p>
        </div>
        <div className={`text-3xl font-black font-['Space_Grotesk'] mt-4 sm:mt-0 ${kpis?.margeNetteComptableHt && kpis.margeNetteComptableHt < 0 ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500"}`}>
          {loading ? <Skeleton className="w-32 h-8" /> : `${kpis?.margeNetteComptableHt !== undefined ? fmt(kpis.margeNetteComptableHt) : "—"} MAD`}
        </div>
      </div>

      {/* The same margin read entirely on HT. The card above nets HT revenue
          against TTC spend, so its result still carries the TVA paid on
          purchases; this one removes it. Same card form, deliberately. */}
      <div className="bg-surface-card dark:bg-surface-card-dark p-6 rounded-xl border border-edge-default dark:border-[#242830] mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h4 className="text-sm font-bold text-content-secondary dark:text-[#5a6275] uppercase tracking-wider">RÉSULTAT HORS FISCALITÉ (HT)</h4>
          <p className="text-xs text-content-muted dark:text-[#3d4350] mt-1">Formule : Encaissements Réels HT - Décaissements Réels HT (Achats HT + Paie + Caisse)</p>
          <p className="text-[11px] italic text-content-muted/85 dark:text-[#3d4350] mt-1">Flux opérationnels uniquement, hors stocks : c’est la seule chose qui le sépare de la marge nette. Tous les décaissements réels sont retenus — la paie et la caisse à leur montant, les achats en HT. Décaissements retenus : {kpis?.decaissementsGlobauxHt !== undefined ? `${fmt(kpis.decaissementsGlobauxHt)} MAD` : "—"}</p>
        </div>
        <div className={`text-3xl font-black font-['Space_Grotesk'] mt-4 sm:mt-0 ${kpis?.resultatHorsFiscaliteHt && kpis.resultatHorsFiscaliteHt < 0 ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500"}`}>
          {loading ? <Skeleton className="w-32 h-8" /> : `${kpis?.resultatHorsFiscaliteHt !== undefined ? fmt(kpis.resultatHorsFiscaliteHt) : "—"} MAD`}
        </div>
      </div>

      <div className="bg-surface-card/50 dark:bg-surface-card-dark/50 p-4 mb-6 rounded-xl border border-edge-subtle dark:border-[#242830] mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h4 className="text-xs font-bold text-content-secondary dark:text-[#5a6275] uppercase tracking-wider">MARGE EN COURS (PRÉVISIONNELLE HT)</h4>
          <p className="text-[10px] text-content-muted dark:text-[#3d4350] mt-1">Formule : Attachements en attente HT - Dettes à payer HT (Fournisseurs HT + Sous-traitants HT + Paie NET)</p>
        </div>
        <div className={`text-xl font-bold font-['Space_Grotesk'] mt-4 sm:mt-0 ${kpis?.margeEnCoursPrevisionnelleHt && kpis.margeEnCoursPrevisionnelleHt < 0 ? "text-red-600 dark:text-red-500" : "text-green-600 dark:text-green-500"}`}>
          {loading ? <Skeleton className="w-24 h-6" /> : `${kpis?.margeEnCoursPrevisionnelleHt !== undefined ? fmt(kpis.margeEnCoursPrevisionnelleHt) : "—"} MAD`}
        </div>
      </div>
    </div>
  );
}

function ModernKpiCard({
  color,
  label,
  value,
  textColor,
  sub,
  subVal,
  subNode,
  loading
}: {
  color: "red" | "green" | "yellow" | "blue" | "white";
  label: string;
  value?: number;
  textColor: string;
  sub?: string;
  subVal?: number;
  subNode?: React.ReactNode;
  loading?: boolean;
}) {
  const bgClass = color === "red" ? "bg-red-500" : color === "green" ? "bg-green-500" : color === "yellow" ? "bg-amber-500" : color === "blue" ? "bg-blue-500" : "bg-gray-500";
  return (
    <div className="bg-surface-card dark:bg-surface-card-dark border border-edge-default dark:border-[#242830] rounded-xl p-5 relative overflow-hidden">
      <div className={`absolute top-0 right-0 w-20 h-20 rounded-bl-[80px] opacity-10 dark:opacity-[0.03] ${bgClass}`}></div>
      <div className="text-[11px] text-content-secondary dark:text-[#5a6275] font-semibold mb-2 uppercase tracking-wide z-10 relative">
        {label}
      </div>
      <div className={`font-mono text-2xl font-bold mb-1.5 leading-none z-10 relative ${textColor}`}>
        {loading ? <Skeleton className="w-24 h-8" /> : (value !== undefined ? fmt(value) : "0")}
      </div>
      <div className="text-[10px] text-content-muted dark:text-[#5a6275] mt-2 z-10 relative">
        {subNode ? subNode : (
          <>
            {sub} {subVal !== undefined && <span className="text-green-600 dark:text-green-500 font-bold">{fmt(subVal)}</span>}
          </>
        )}
      </div>
    </div>
  );
}

function DomainCard({
  href,
  title,
  kpi,
  sub,
  chart,
  exportSection,
}: {
  href: string;
  title: string;
  kpi: string;
  sub: string;
  chart: ReactNode;
  /** Omitted for sections with no tabular data worth exporting. */
  exportSection?: ExportSection;
}) {
  return (
    <Link href={href} className="block group h-full">
      <div className="bg-surface-card dark:bg-surface-card-dark border border-edge-default dark:border-[#242830] rounded-xl p-4 sm:p-5 h-full transition-all duration-150 group-hover:shadow-lg group-hover:border-accent/50">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] font-bold text-content-secondary dark:text-[#5a6275] uppercase tracking-wide">
            {title}
          </p>
          <span className="flex items-center gap-2">
            {exportSection && <ExportExcelButton section={exportSection} />}
            <span className="text-content-muted dark:text-[#3d4350] group-hover:text-accent transition-colors text-xs">→</span>
          </span>
        </div>
        <p className="text-xl font-bold font-mono text-content-primary dark:text-[#fafbfd] mb-0.5">{kpi}</p>
        <p className="text-xs text-content-muted dark:text-[#5a6275] mb-3">{sub}</p>
        <div className="mt-2 text-content-primary dark:text-white">
          {chart}
        </div>
      </div>
    </Link>
  );
}
