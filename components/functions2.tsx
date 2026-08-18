"use client";

import type { ModePaiement } from "./ModePaiementDialog";

// ─────────────────────────────────────────────────────────────────────────────
// SHARED TYPES (used by chart components in Functions.tsx)
// ─────────────────────────────────────────────────────────────────────────────

export interface DataPoint {
    label: string;
    value: number;
    color?: string;
}

export interface ChartSeries {
    label: string;
    data: number[];
    color: string;
    dashed?: boolean;
    fill?: boolean;
}

export interface MultiSeriesData {
    labels: string[];
    series: ChartSeries[];
}

export interface KpiItem {
    label: string;
    value: string;
    sub: string;
}

export interface ProgressData {
    paidLabel: string;
    pendingLabel: string;
    paidPct: number;
    footerLabel: string;
}

export interface StatusPoint extends DataPoint {
    badgeBg: string;
    badgeText: string;
}

export interface TableRow {
    id: string;
    ref: string;
    col1: string;
    col2: string;
    col3: string;
    ht: number;
    tva: number;
    ttc: number;
    statusLabel: string;
    statusBg: string;
    statusText: string;
    statusDot: string;
    subRows: {
        code: string;
        designation: string;
        quantite: number;
        unite: string;
        prixUnitaire: number;
        total: number;
    }[];
    footnotes: { label: string; value: string }[];
    /** "L'achat a-t-il réellement servi au chantier ?" — absent on tables without operations. */
    impactAnalytiqueChantier?: boolean;
    /** "Y a-t-il une facture officielle à déclarer ?" — absent on tables without operations. */
    impactComptableFiscal?: boolean;
}

export interface TableData {
    rows: TableRow[];
    totalHT: number;
    totalTVA: number;
    totalTTC: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// GENERIC HYDRATOR
// ─────────────────────────────────────────────────────────────────────────────

export function hydrate<TInput, THydrated>(
    input: TInput[],
    config: { [K in keyof THydrated]: (input: TInput[]) => THydrated[K] }
): THydrated {
    const result = {} as THydrated;
    for (const key in config) {
        result[key] = config[key](input);
    }
    return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

export function fmt(value: number): string {
    return new Intl.NumberFormat("fr-MA", {
        maximumFractionDigits: 0,
        useGrouping: true,
    }).format(value);
}

const CHART_COLORS = ["#2a78d6", "#1baf7a", "#eda100", "#4a3aa7", "#e34948", "#e87ba4", "#eb6834", "#008300"] as const;
const color = (i: number) => CHART_COLORS[i % CHART_COLORS.length];

// ─────────────────────────────────────────────────────────────────────────────
// DOMAIN TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AchatStatus = "EN_COURS" | "LIVRE" | "FACTURE" | "PAYE";
export interface LigneAchat { id: string; articleCode: string; designation: string; quantite: number; unite: string; prixUnitaire: number; total: number; bpuLigneRef?: string; }
export interface Achat { id: string; ref: string; fournisseurNom: string; chantierNom: string; dateCommande: string; dateLivraisonPrevue: string; status: AchatStatus; ht: number; tva: number; ttc: number; lignes: LigneAchat[]; bonLivraisonRef?: string; factureRef?: string; modePaiement?: ModePaiement; impactAnalytiqueChantier?: boolean; impactComptableFiscal?: boolean; }

export type FournisseurStatut = "ACTIF" | "INACTIF" | "BLACKLISTE";
export interface Fournisseur { id: string; code: string; raisonSociale: string; ice: string; contact: string; telephone: string; email: string; ville: string; adresse: string; rib: string; banque: string; statut: FournisseurStatut; categorieArticles: string[]; totalAchatsAnnee: number; soldeImpaye: number; }

export type MouvementType = "ENTREE" | "SORTIE" | "AJUSTEMENT";
export interface MouvementStock { id: string; date: string; type: MouvementType; quantite: number; motif: string; referenceDoc: string; chantierNom?: string; }
export interface StockArticle { id: string; articleCode: string; designation: string; categorie: string; unite: string; quantiteDisponible: number; seuilAlerte: number; depot: string; chantierNom?: string; prixUnitaireMoyen: number; valeurStock: number; dernierMouvement: string; mouvements: MouvementStock[]; }

export interface Article { id: string; code: string; designation: string; description?: string; categorieId: string; categorieLibelle: string; unite: string; prixAchatRef: number; tvaRate: number; actif: boolean; fournisseursPreferentiels: string[]; }

export type ChantierStatut = "EN_PREPARATION" | "EN_COURS" | "EN_PAUSE" | "TERMINE" | "ANNULE";
export interface Jalon { id: string; libelle: string; datePrevue: string; dateReelle?: string; statut: "A_FAIRE" | "EN_COURS" | "TERMINE" | "EN_RETARD"; }
export interface Chantier { id: string; code: string; nom: string; client: string; adresse: string; ville: string; statut: ChantierStatut; dateDebut: string; dateFin: string; budgetHT: number; depensesHT: number; avancement: number; chefProjetNom: string; nombreOuvriers: number; jalons: Jalon[]; soustraitantsActifs: string[]; }

export type RessourceType = "OUVRIER" | "CHEF_EQUIPE" | "CONDUCTEUR_TRAVAUX" | "ENGIN";
export interface Ressource { id: string; nom: string; type: RessourceType; specialite: string; telephone?: string; }
export interface Affectation { id: string; ressourceId: string; ressourceNom: string; ressourceType: RessourceType; chantierId: string; chantierNom: string; dateDebut: string; dateFin: string; tauxOccupation: number; notes?: string; }

export type ContratSTStatut = "EN_COURS" | "TERMINE" | "RESILIE";
export type PaiementSTStatut =
    | "EN_ATTENTE"
    | "VALIDE"
    | "PAYE"
    | "EN_RETARD"
    | "PARTIELLEMENT_PAYE";
export interface PaiementST { id: string; reference: string; montant: number; motif: string; statut: PaiementSTStatut; datePaiement: string | null; }
export interface EcheanceST { id: string; montant: number; datePrevue: string; datePaiement?: string; statut: PaiementSTStatut; referenceVirement?: string; }
export interface ContratSousTraitance {
    id: string; reference: string; sousTraitantId: string; sousTraitantRaisonSociale: string; chantierId: string; chantierNom: string; objet: string; montantHt: number; tva: number; montantTtc: number; montantPaye: number; resteAPayer: number; dateDebut: string; dateFin: string; statut: ContratSTStatut;
    avanceDemandeeHt?: number; retenueGarantieHt?: number; montantRealiseHt?: number; dossierStatut?: "COMPLET" | "INCOMPLET";
}
export interface ContratSousTraitanceWithPaiements extends ContratSousTraitance {
    paiements: PaiementST[];
}

export type StatutSalaire = "BROUILLON" | "VALIDE" | "PAYEE";
export interface LigneSalaire { libelle: string; montant: number; type: "GAIN" | "RETENUE"; }
export interface FichePaie {
    id: string;

    reference: string;

    employeId: string;
    employeNomComplet: string;
    employeMatricule: string;

    chantierId: string;
    chantierNom: string;

    periode: string;

    joursTravailles: number;

    salaireBase: number;
    heuresSupplementaires?: number;
    montantHeuresSupp?: number;

    primeTransport?: number;
    primePanier?: number;
    autresPrimes?: number;

    avance?: number;
    deductionsCnss?: number;
    deductionsIr?: number;

    netAPayer: number;

    statut: StatutSalaire;
}

export type TransactionCategorie = "PAIEMENT_FOURNISSEUR" | "PAIEMENT_SOUSTRAIT" | "PAIEMENT_SALAIRE" | "ENCAISSEMENT_CLIENT" | "FRAIS_GENERAUX" | "DEPOT_BANQUE" | "RETRAIT_BANQUE" | "AUTRE";
export type TypeTransaction = "CREDIT" | "DEBIT";
export interface Transaction { id: string; typeTransaction: TypeTransaction; montant: number; motif: string; referenceDocument?: string; createdAt: string; caisseId: string; caisseLibelle: string; impactAnalytiqueChantier?: boolean; impactComptableFiscal?: boolean; annule?: boolean; ajustement?: boolean; }
export interface Caisse { id: string; code: string; libelle: string; chantierId: string; chantierNom: string; solde: number; seuilMinimum: number; enAlerte: boolean; }



export type PaiementStatut = "EN_ATTENTE" | "VALIDE" | "PAYE" | "EN_RETARD" | "PARTIELLEMENT_PAYE";
export type PaiementType = "FOURNISSEUR" | "SOUS_TRAITANT" | "SALAIRE" | "AUTRE";
export interface Paiement { id: string; ref: string; type: PaiementType; tiers: string; chantierId?: string; chantierNom?: string; referenceDoc: string; montantTotal: number; montantPaye: number; montantRestant: number; dateEcheance: string; datePaiement?: string; statut: PaiementStatut; modeReglement?: "VIREMENT" | "CHEQUE" | "ESPECES"; referenceVirement?: string; notes?: string; }

export type JournalCode = "ACH" | "VTE" | "BNQ" | "CAI" | "OD" | "SAL" | "STR";
export interface LigneEcriture { id: string; compteNum: string; compteLibelle: string; debit: number; credit: number; }
export interface EcritureComptable { id: string; date: string; journal: JournalCode; pieceRef: string; libelle: string; lignes: LigneEcriture[]; montant: number; saisiePar: string; }
export interface CompteResultat { categorie: string; libelle: string; montantN: number; montantN1: number; }

export type EmployeRole = "ADMIN" | "RH" | "FINANCE" | "PM" | "ACHAT" | "CONDUCTEUR_TRAVAUX" | "CHEF_EQUIPE" | "OUVRIER";
export type EmployeStatut = "ACTIF" | "CONGE" | "INACTIF";
export interface Employe { id: string; matricule: string; nom: string; prenom: string; role: EmployeRole; poste: string; departement: string; telephone: string; email: string; dateEmbauche: string; chantierActuelId?: string; chantierActuelNom?: string; statut: EmployeStatut; salaireBrut: number; typeContrat: "CDI" | "CDD" | "ANAPEC" | "JOURNALIER"; }

// ─────────────────────────────────────────────────────────────────────────────
// ① ACHATS
// ─────────────────────────────────────────────────────────────────────────────

export interface AchatsHydrated {
    kpis: KpiItem[];
    progress: ProgressData;
    budgetStacks: MultiSeriesData;
    budgetTrend: MultiSeriesData;
    fournisseurs: DataPoint[];
    chantiers: DataPoint[];
    statuses: StatusPoint[];
    articles: DataPoint[];
    table: TableData;
}

const ACHAT_STATUS_META: Record<AchatStatus, { label: string; bg: string; text: string; dot: string }> = {
    PAYE: { label: "Payé", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#16a34a" },
    LIVRE: { label: "Livré", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "#2563eb" },
    FACTURE: { label: "Facturé", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "#d97706" },
    EN_COURS: { label: "En cours", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "#6b7280" },
};

export const achatsHydrationConfig = {
    kpis: (achats: Achat[]): KpiItem[] => {
        const totalTTC = achats.reduce((s, a) => s + a.ttc, 0);
        const totalHT = achats.reduce((s, a) => s + a.ht, 0);
        const totalTVA = achats.reduce((s, a) => s + a.tva, 0);
        const paidTTC = achats.filter(a => a.status === "PAYE").reduce((s, a) => s + a.ttc, 0);
        const paidPct = totalTTC > 0 ? Math.round((paidTTC / totalTTC) * 100) : 0;
        const enCours = achats.filter(a => a.status === "EN_COURS").length;
        return [
            { label: "Total TTC", value: fmt(totalTTC), sub: `HT : ${fmt(totalHT)}` },
            { label: "TVA déductible", value: fmt(totalTVA), sub: `${Math.round((totalTVA / totalHT) * 100)}% du HT` },
            { label: "Encaissé", value: fmt(paidTTC), sub: `${paidPct}% du total` },
            { label: "En attente", value: fmt(totalTTC - paidTTC), sub: "à régler" },
            { label: "Commandes", value: `${achats.length}`, sub: `${enCours} en cours` },
        ];
    },
    progress: (achats: Achat[]): ProgressData => {
        const totalTTC = achats.reduce((s, a) => s + a.ttc, 0);
        const paidTTC = achats.filter(a => a.status === "PAYE").reduce((s, a) => s + a.ttc, 0);
        const paidPct = totalTTC > 0 ? Math.round((paidTTC / totalTTC) * 100) : 0;
        return { paidLabel: `Payé : ${fmt(paidTTC)}`, pendingLabel: `En attente : ${fmt(totalTTC - paidTTC)}`, paidPct, footerLabel: `${paidPct}% du total TTC encaissé` };
    },
    budgetStacks: (achats: Achat[]): MultiSeriesData => ({
        labels: achats.map(a => a.ref.replace("CMD-2025-", "")),
        series: [
            { label: "HT", data: achats.map(a => a.ht), color: "#2a78d6", fill: false },
            { label: "TVA", data: achats.map(a => a.tva), color: "#b5d4f4", fill: false },
        ],
    }),
    budgetTrend: (achats: Achat[]): MultiSeriesData => ({
        labels: achats.map(a => a.ref.replace("CMD-2025-", "")),
        series: [
            { label: "HT", data: achats.map(a => a.ht), color: "#2a78d6", fill: true, dashed: false },
            { label: "TVA", data: achats.map(a => a.tva), color: "#1baf7a", fill: true, dashed: true },
        ],
    }),
    fournisseurs: (achats: Achat[]): DataPoint[] => {
        const map = achats.reduce<Record<string, number>>((acc, a) => { acc[a.fournisseurNom] = (acc[a.fournisseurNom] ?? 0) + a.ttc; return acc; }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    chantiers: (achats: Achat[]): DataPoint[] => {
        const map = achats.reduce<Record<string, number>>((acc, a) => { acc[a.chantierNom] = (acc[a.chantierNom] ?? 0) + a.ttc; return acc; }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    statuses: (achats: Achat[]): StatusPoint[] =>
        (["PAYE", "LIVRE", "FACTURE", "EN_COURS"] as AchatStatus[]).map(s => ({
            label: ACHAT_STATUS_META[s].label,
            value: achats.filter(a => a.status === s).length,
            color: ACHAT_STATUS_META[s].dot,
            badgeBg: ACHAT_STATUS_META[s].bg,
            badgeText: ACHAT_STATUS_META[s].text,
        })),
    articles: (achats: Achat[]): DataPoint[] => {
        const map = achats.flatMap(a => a.lignes ?? []).reduce<Record<string, number>>((acc, l) => {
            const k = l.designation.length > 26 ? l.designation.slice(0, 24) + "…" : l.designation;
            acc[k] = (acc[k] ?? 0) + l.total; return acc;
        }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    table: (achats: Achat[]): TableData => ({
        rows: achats.map(a => ({
            id: a.id, ref: a.ref,
            col1: a.fournisseurNom, col2: a.chantierNom,
            col3: new Date(a.dateCommande).toLocaleDateString("fr-MA"),
            ht: a.ht, tva: a.tva, ttc: a.ttc,
            statusLabel: ACHAT_STATUS_META[a.status].label,
            statusBg: ACHAT_STATUS_META[a.status].bg,
            statusText: ACHAT_STATUS_META[a.status].text,
            statusDot: ACHAT_STATUS_META[a.status].dot,
            impactAnalytiqueChantier: a.impactAnalytiqueChantier ?? false,
            impactComptableFiscal: a.impactComptableFiscal ?? false,
            subRows: a.lignes.map(l => ({ code: l.articleCode, designation: l.designation, quantite: l.quantite, unite: l.unite, prixUnitaire: l.prixUnitaire, total: l.total })),
            footnotes: [
                ...(a.bonLivraisonRef ? [{ label: "BL", value: a.bonLivraisonRef }] : []),
                ...(a.factureRef ? [{ label: "Facture", value: a.factureRef }] : []),
            ],
        })),
        totalHT: achats.reduce((s, a) => s + a.ht, 0),
        totalTVA: achats.reduce((s, a) => s + a.tva, 0),
        totalTTC: achats.reduce((s, a) => s + a.ttc, 0),
    }),
};

// ─────────────────────────────────────────────────────────────────────────────
// ② FOURNISSEURS
// ─────────────────────────────────────────────────────────────────────────────

export interface FournisseursHydrated {
    kpis: KpiItem[];
    caParFournisseur: DataPoint[];       // horizontal bar — achats annuels par fournisseur
    impayes: DataPoint[];                // horizontal bar — solde impayé par fournisseur
    partMarche: DataPoint[];             // pie — % du volume total
    statuses: StatusPoint[];             // donut — ACTIF / INACTIF / BLACKLISTE
    categoriesCount: DataPoint[];        // horizontal bar — nb fournisseurs par catégorie d'articles
    topFournisseurs: MultiSeriesData;    // grouped bar — achats vs impayé pour le top 5
}

const FOURNISSEUR_STATUS_META: Record<FournisseurStatut, { label: string; bg: string; text: string; dot: string }> = {
    ACTIF: { label: "Actif", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#16a34a" },
    INACTIF: { label: "Inactif", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "#6b7280" },
    BLACKLISTE: { label: "Blacklisté", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "#dc2626" },
};

export const fournisseursHydrationConfig = {
    kpis: (fournisseurs: Fournisseur[]): KpiItem[] => {
        const actifs = fournisseurs.filter(f => f.statut === "ACTIF");
        const totalAchats = fournisseurs.reduce((s, f) => s + f.totalAchatsAnnee, 0);
        const totalImpaye = fournisseurs.reduce((s, f) => s + f.soldeImpaye, 0);
        const tauxImpaye = totalAchats > 0 ? Math.round((totalImpaye / totalAchats) * 100) : 0;
        return [
            { label: "Fournisseurs", value: `${fournisseurs.length}`, sub: `${actifs.length} actifs` },
            { label: "Achats annuels", value: fmt(totalAchats), sub: "HT cumulé" },
            { label: "Solde impayé", value: fmt(totalImpaye), sub: `${tauxImpaye}% du volume` },
            { label: "Moy. par fournisseur", value: fmt(Math.round(totalAchats / Math.max(actifs.length, 1))), sub: "HT actifs" },
        ];
    },
    caParFournisseur: (fournisseurs: Fournisseur[]): DataPoint[] =>
        [...fournisseurs]
            .sort((a, b) => b.totalAchatsAnnee - a.totalAchatsAnnee)
            .map((f, i) => ({ label: f.raisonSociale, value: f.totalAchatsAnnee, color: color(i) })),

    impayes: (fournisseurs: Fournisseur[]): DataPoint[] =>
        fournisseurs
            .filter(f => f.soldeImpaye > 0)
            .sort((a, b) => b.soldeImpaye - a.soldeImpaye)
            .map(f => ({ label: f.raisonSociale, value: f.soldeImpaye, color: "#e34948" })),

    partMarche: (fournisseurs: Fournisseur[]): DataPoint[] => {
        return [...fournisseurs]
            .filter(f => f.totalAchatsAnnee > 0)
            .sort((a, b) => b.totalAchatsAnnee - a.totalAchatsAnnee)
            .map((f, i) => ({ label: f.raisonSociale, value: f.totalAchatsAnnee, color: color(i) }));
    },
    statuses: (fournisseurs: Fournisseur[]): StatusPoint[] =>
        (["ACTIF", "INACTIF", "BLACKLISTE"] as FournisseurStatut[]).map(s => ({
            label: FOURNISSEUR_STATUS_META[s].label,
            value: fournisseurs.filter(f => f.statut === s).length,
            color: FOURNISSEUR_STATUS_META[s].dot,
            badgeBg: FOURNISSEUR_STATUS_META[s].bg,
            badgeText: FOURNISSEUR_STATUS_META[s].text,
        })),
    categoriesCount: (fournisseurs: Fournisseur[]): DataPoint[] => {
        const map: Record<string, number> = {};
        fournisseurs.forEach(f => (f.categorieArticles ?? []).forEach(c => { map[c] = (map[c] ?? 0) + 1; }));
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    topFournisseurs: (fournisseurs: Fournisseur[]): MultiSeriesData => {
        const top = [...fournisseurs].sort((a, b) => b.totalAchatsAnnee - a.totalAchatsAnnee).slice(0, 5);
        return {
            labels: top.map(f => f.raisonSociale.length > 18 ? f.raisonSociale.slice(0, 16) + "…" : f.raisonSociale),
            series: [
                { label: "Achats annuels HT", data: top.map(f => f.totalAchatsAnnee), color: "#2a78d6", fill: false },
                { label: "Solde impayé", data: top.map(f => f.soldeImpaye), color: "#e34948", fill: false },
            ],
        };
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ③ STOCKS
// ─────────────────────────────────────────────────────────────────────────────

export interface StocksHydrated {
    kpis: KpiItem[];
    valeurParCategorie: DataPoint[];   // pie — valeur stock par catégorie
    alertes: DataPoint[];             // horizontal bar — articles sous seuil (écart)
    mouvementsParType: StatusPoint[];  // donut — ENTREE / SORTIE / AJUSTEMENT
    stockParDepot: DataPoint[];        // horizontal bar — valeur par dépôt
    progress: ProgressData;           // % articles au-dessus du seuil
}

/**
 * Same rule the backend applies in StockMapper.enAlerte:
 *
 *   quantiteTheorique <= seuilAlerte  AND  seuilAlerte > 0
 *
 * The `> 0` guard matters — a threshold of 0 means "no threshold set", not
 * "alert on everything". This used to be duplicated here without the guard,
 * so the two disagreed for any line at zero quantity.
 *
 * NOTE: nothing currently writes seuilAlerte — it is created at 0 and there is
 * no endpoint to change it — so this predicate is false for every row today.
 */
export function estSousSeuil(s: { quantiteDisponible: number; seuilAlerte: number }): boolean {
    return s.seuilAlerte > 0 && s.quantiteDisponible <= s.seuilAlerte;
}

export const stocksHydrationConfig = {
    kpis: (stocks: StockArticle[]): KpiItem[] => {
        const valeurTotale = stocks.reduce((s, a) => s + a.valeurStock, 0);
        const sousSeuil = stocks.filter(estSousSeuil);
        const auDessus = stocks.length - sousSeuil.length;
        const totalMvts = stocks.flatMap(a => a.mouvements ?? []).length;
        return [
            { label: "Articles en stock", value: `${stocks.length}`, sub: `${auDessus} au-dessus du seuil` },
            { label: "Valeur totale", value: fmt(valeurTotale), sub: "MAD (prix moyen)" },
            { label: "Alertes seuil", value: `${sousSeuil.length}`, sub: "articles à réapprovisionner" },
            { label: "Mouvements récents", value: `${totalMvts}`, sub: "entrées + sorties" },
        ];
    },
    valeurParCategorie: (stocks: StockArticle[]): DataPoint[] => {
        const map = stocks.reduce<Record<string, number>>((acc, s) => { acc[s.categorie] = (acc[s.categorie] ?? 0) + s.valeurStock; return acc; }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    alertes: (stocks: StockArticle[]): DataPoint[] =>
        stocks
            .filter(estSousSeuil)
            .map(s => ({ label: s.designation.length > 28 ? s.designation.slice(0, 26) + "…" : s.designation, ecart: s.seuilAlerte - s.quantiteDisponible }))
            .filter(s => s.ecart > 0)
            .sort((a, b) => b.ecart - a.ecart)
            .map(s => ({ label: s.label, value: s.ecart, color: "#e34948" })),
    mouvementsParType: (stocks: StockArticle[]): StatusPoint[] => {
        const mvts = stocks.flatMap(s => s.mouvements ?? []);
        return [
            { label: "Entrées", value: mvts.filter(m => m.type === "ENTREE").length, color: "#16a34a", badgeBg: "bg-green-100 dark:bg-green-900/30", badgeText: "text-green-700 dark:text-green-400" },
            { label: "Sorties", value: mvts.filter(m => m.type === "SORTIE").length, color: "#e34948", badgeBg: "bg-red-100 dark:bg-red-900/30", badgeText: "text-red-700 dark:text-red-400" },
            { label: "Ajustements", value: mvts.filter(m => m.type === "AJUSTEMENT").length, color: "#eda100", badgeBg: "bg-amber-100 dark:bg-amber-900/30", badgeText: "text-amber-700 dark:text-amber-400" },
        ];
    },
    stockParDepot: (stocks: StockArticle[]): DataPoint[] => {
        const map = stocks.reduce<Record<string, number>>((acc, s) => { acc[s.depot] = (acc[s.depot] ?? 0) + s.valeurStock; return acc; }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label: label.length > 28 ? label.slice(0, 26) + "…" : label, value, color: color(i) }));
    },
    progress: (stocks: StockArticle[]): ProgressData => {
        const total = stocks.length;
        const ok = stocks.filter(s => !estSousSeuil(s)).length;
        const paidPct = total > 0 ? Math.round((ok / total) * 100) : 0;
        const alert = total - ok;
        return { paidLabel: `OK : ${ok} articles`, pendingLabel: `Alerte : ${alert} articles`, paidPct, footerLabel: `${paidPct}% des articles au-dessus du seuil d'alerte` };
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ④ CATALOGUE
// ─────────────────────────────────────────────────────────────────────────────

export interface CatalogueHydrated {
    kpis: KpiItem[];
    articlesParCategorie: DataPoint[];   // pie
    prixParCategorie: DataPoint[];       // horizontal bar — prix de référence moyen
    statuses: StatusPoint[];             // donut — actif / inactif
    topArticlesPrix: DataPoint[];        // horizontal bar — top 8 par prixAchatRef
    fournisseursPreferentiels: DataPoint[]; // horizontal bar — nb articles par fournisseur préférentiel
}

export const catalogueHydrationConfig = {
    kpis: (articles: Article[]): KpiItem[] => {
        const actifs = articles.filter(a => a.actif);
        const cats = new Set(articles.map(a => a.categorieLibelle)).size;
        const prixMoyen = actifs.length > 0 ? Math.round(actifs.reduce((s, a) => s + a.prixAchatRef, 0) / actifs.length) : 0;
        return [
            { label: "Total articles", value: `${articles.length}`, sub: `${actifs.length} actifs` },
            { label: "Catégories", value: `${cats}`, sub: "familles d'articles" },
            { label: "Prix moyen réf.", value: fmt(prixMoyen), sub: "MAD HT (actifs)" },
            { label: "Inactifs", value: `${articles.length - actifs.length}`, sub: "articles désactivés" },
        ];
    },
    articlesParCategorie: (articles: Article[]): DataPoint[] => {
        const map = articles.reduce<Record<string, number>>((acc, a) => { acc[a.categorieLibelle] = (acc[a.categorieLibelle] ?? 0) + 1; return acc; }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    prixParCategorie: (articles: Article[]): DataPoint[] => {
        const map: Record<string, number[]> = {};
        articles.filter(a => a.actif).forEach(a => { (map[a.categorieLibelle] = map[a.categorieLibelle] ?? []).push(a.prixAchatRef); });
        return Object.entries(map)
            .map(([label, vals]) => ({ label, value: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) }))
            .sort((a, b) => b.value - a.value)
            .map((d, i) => ({ ...d, color: color(i) }));
    },
    statuses: (articles: Article[]): StatusPoint[] => [
        { label: "Actif", value: articles.filter(a => a.actif).length, color: "#16a34a", badgeBg: "bg-green-100 dark:bg-green-900/30", badgeText: "text-green-700 dark:text-green-400" },
        { label: "Inactif", value: articles.filter(a => !a.actif).length, color: "#6b7280", badgeBg: "bg-gray-100 dark:bg-gray-800", badgeText: "text-gray-600 dark:text-gray-400" },
    ],
    topArticlesPrix: (articles: Article[]): DataPoint[] =>
        [...articles].sort((a, b) => b.prixAchatRef - a.prixAchatRef).slice(0, 8)
            .map((a, i) => ({ label: a.designation.length > 28 ? a.designation.slice(0, 26) + "…" : a.designation, value: a.prixAchatRef, color: color(i) })),
    fournisseursPreferentiels: (articles: Article[]): DataPoint[] => {
        const map: Record<string, number> = {};
        articles.forEach(a => (a.fournisseursPreferentiels ?? []).forEach(f => { map[f] = (map[f] ?? 0) + 1; }));
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ SUIVI CHANTIERS
// ─────────────────────────────────────────────────────────────────────────────

export interface ChantiersHydrated {
    kpis: KpiItem[];
    budgetVsDepenses: MultiSeriesData;  // grouped bar — budget vs dépenses par chantier
    avancement: DataPoint[];            // horizontal bar — % avancement
    statutsChantiers: StatusPoint[];    // donut
    jalonsSummary: StatusPoint[];       // donut — statuts de jalons globaux
    depensesParVille: DataPoint[];      // pie — dépenses par ville
}

const CHANTIER_STATUS_META: Record<ChantierStatut, { label: string; bg: string; text: string; dot: string }> = {
    EN_COURS: { label: "En cours", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "#2563eb" },
    EN_PREPARATION: { label: "En préparation", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "#d97706" },
    EN_PAUSE: { label: "En pause", bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-400", dot: "#ea580c" },
    TERMINE: { label: "Terminé", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#16a34a" },
    ANNULE: { label: "Annulé", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "#dc2626" },
};

export const chantiersHydrationConfig = {
    kpis: (chantiers: Chantier[]): KpiItem[] => {
        const enCours = chantiers.filter(c => c.statut === "EN_COURS");
        const totalBudget = chantiers.reduce((s, c) => s + c.budgetHT, 0);
        const totalDepenses = chantiers.reduce((s, c) => s + c.depensesHT, 0);
        const totalOuvriers = enCours.reduce((s, c) => s + c.nombreOuvriers, 0);
        const consommation = totalBudget > 0 ? Math.round((totalDepenses / totalBudget) * 100) : 0;
        return [
            { label: "Chantiers actifs", value: `${enCours.length}`, sub: `${chantiers.length} au total` },
            { label: "Budget total HT", value: fmt(totalBudget), sub: "tous chantiers" },
            { label: "Dépenses engagées", value: fmt(totalDepenses), sub: `${consommation}% du budget` },
            { label: "Ouvriers en activité", value: `${totalOuvriers}`, sub: "chantiers en cours" },
        ];
    },
    budgetVsDepenses: (chantiers: Chantier[]): MultiSeriesData => ({
        labels: chantiers.map(c => c.nom.length > 20 ? c.nom.slice(0, 18) + "…" : c.nom),
        series: [
            { label: "Budget HT", data: chantiers.map(c => c.budgetHT), color: "#2a78d6", fill: false },
            { label: "Dépenses HT", data: chantiers.map(c => c.depensesHT), color: "#e34948", fill: false },
        ],
    }),
    avancement: (chantiers: Chantier[]): DataPoint[] =>
        [...chantiers]
            .filter(c => c.statut !== "ANNULE")
            .sort((a, b) => b.avancement - a.avancement)
            .map((c, i) => ({ label: c.nom.length > 28 ? c.nom.slice(0, 26) + "…" : c.nom, value: c.avancement, color: color(i) })),
    statutsChantiers: (chantiers: Chantier[]): StatusPoint[] =>
        (["EN_COURS", "EN_PREPARATION", "EN_PAUSE", "TERMINE", "ANNULE"] as ChantierStatut[])
            .map(s => ({ label: CHANTIER_STATUS_META[s].label, value: chantiers.filter(c => c.statut === s).length, color: CHANTIER_STATUS_META[s].dot, badgeBg: CHANTIER_STATUS_META[s].bg, badgeText: CHANTIER_STATUS_META[s].text }))
            .filter(d => d.value > 0),
    jalonsSummary: (chantiers: Chantier[]): StatusPoint[] => {
        const all = chantiers.flatMap(c => c.jalons ?? []);

        return [
            { label: "Terminé", value: all.filter(j => j.statut === "TERMINE").length, color: "#16a34a", badgeBg: "bg-green-100 dark:bg-green-900/30", badgeText: "text-green-700 dark:text-green-400" },
            { label: "En cours", value: all.filter(j => j.statut === "EN_COURS").length, color: "#2563eb", badgeBg: "bg-blue-100 dark:bg-blue-900/30", badgeText: "text-blue-700 dark:text-blue-400" },
            { label: "À faire", value: all.filter(j => j.statut === "A_FAIRE").length, color: "#6b7280", badgeBg: "bg-gray-100 dark:bg-gray-800", badgeText: "text-gray-600 dark:text-gray-400" },
            { label: "En retard", value: all.filter(j => j.statut === "EN_RETARD").length, color: "#dc2626", badgeBg: "bg-red-100 dark:bg-red-900/30", badgeText: "text-red-700 dark:text-red-400" },
        ].filter(d => d.value > 0);
    },
    depensesParVille: (chantiers: Chantier[]): DataPoint[] => {
        const map = chantiers.reduce<Record<string, number>>((acc, c) => { acc[c.ville] = (acc[c.ville] ?? 0) + c.depensesHT; return acc; }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ⑥ AFFECTATION
// ─────────────────────────────────────────────────────────────────────────────

export interface AffectationHydrated {
    kpis: KpiItem[];
    ressourcesParType: StatusPoint[];       // donut
    affectationsParChantier: DataPoint[];   // horizontal bar — nb ressources par chantier
    chargeParRessource: DataPoint[];        // horizontal bar — durée d'affectation en jours
    typesParChantier: MultiSeriesData;      // stacked bar — types de ressources par chantier
}

const RESSOURCE_TYPE_META: Record<RessourceType, { label: string; bg: string; text: string; dot: string }> = {
    OUVRIER: { label: "Ouvriers", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "#2a78d6" },
    CHEF_EQUIPE: { label: "Chefs d'équipe", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "#eda100" },
    CONDUCTEUR_TRAVAUX: { label: "Conducteurs travaux", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#1baf7a" },
    ENGIN: { label: "Engins", bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-400", dot: "#4a3aa7" },
};

const daysBetween = (d1: string, d2: string) => Math.max(0, Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / 86400000));

export const affectationHydrationConfig = {
    kpis: (affectations: Affectation[]): KpiItem[] => {
        const ressourcesUniques = new Set(affectations.map(a => a.ressourceId)).size;
        const chantiersUniques = new Set(affectations.map(a => a.chantierId)).size;
        const ouvriers = affectations.filter(a => a.ressourceType === "OUVRIER").length;
        const engins = affectations.filter(a => a.ressourceType === "ENGIN").length;
        return [
            { label: "Affectations actives", value: `${affectations.length}`, sub: `${ressourcesUniques} ressources` },
            { label: "Chantiers couverts", value: `${chantiersUniques}`, sub: "sites actifs" },
            { label: "Ouvriers affectés", value: `${ouvriers}`, sub: "affectations" },
            { label: "Engins déployés", value: `${engins}`, sub: "affectations machines" },
        ];
    },
    ressourcesParType: (affectations: Affectation[]): StatusPoint[] =>
        (["OUVRIER", "CHEF_EQUIPE", "CONDUCTEUR_TRAVAUX", "ENGIN"] as RessourceType[]).map(t => ({
            label: RESSOURCE_TYPE_META[t].label,
            value: affectations.filter(a => a.ressourceType === t).length,
            color: RESSOURCE_TYPE_META[t].dot,
            badgeBg: RESSOURCE_TYPE_META[t].bg,
            badgeText: RESSOURCE_TYPE_META[t].text,
        })).filter(d => d.value > 0),
    affectationsParChantier: (affectations: Affectation[]): DataPoint[] => {
        const map = affectations.reduce<Record<string, number>>((acc, a) => { acc[a.chantierNom] = (acc[a.chantierNom] ?? 0) + 1; return acc; }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label: label.length > 28 ? label.slice(0, 26) + "…" : label, value, color: color(i) }));
    },
    chargeParRessource: (affectations: Affectation[]): DataPoint[] =>
        affectations
            .map(a => ({ label: a.ressourceNom.length > 24 ? a.ressourceNom.slice(0, 22) + "…" : a.ressourceNom, value: daysBetween(a.dateDebut, a.dateFin) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8)
            .map((d, i) => ({ ...d, color: color(i) })),
    typesParChantier: (affectations: Affectation[]): MultiSeriesData => {
        const chantiers = [...new Set(affectations.map(a => a.chantierNom))];
        const types: RessourceType[] = ["OUVRIER", "CHEF_EQUIPE", "CONDUCTEUR_TRAVAUX", "ENGIN"];
        return {
            labels: chantiers.map(c => c.length > 18 ? c.slice(0, 16) + "…" : c),
            series: types.map(t => ({
                label: RESSOURCE_TYPE_META[t].label,
                data: chantiers.map(c => affectations.filter(a => a.chantierNom === c && a.ressourceType === t).length),
                color: RESSOURCE_TYPE_META[t].dot,
                fill: false,
            })),
        };
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ⑦ SOUS-TRAITANCE
// ─────────────────────────────────────────────────────────────────────────────


export interface SousTraitanceHydrated {
    kpis: KpiItem[];
    progress: ProgressData;                 // global paiement ST
    montantsParST: DataPoint[];             // horizontal bar — montant TTC par sous-traitant
    payeVsRestant: MultiSeriesData;         // grouped bar — payé vs restant par contrat
    statutsContrats: StatusPoint[];         // donut
    echeancesParStatut: StatusPoint[];      // donut — statuts des paiements
}

const CST_STATUS_META: Record<ContratSTStatut, { label: string; bg: string; text: string; dot: string }> = {
    EN_COURS: { label: "En cours", bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "#2563eb" },
    TERMINE: { label: "Terminé", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#16a34a" },
    RESILIE: { label: "Résilié", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "#dc2626" },
};

export const sousTraitanceHydrationConfig = {
    kpis: (contrats: ContratSousTraitance[]): KpiItem[] => {
        const totalTTC = contrats.reduce((s, c) => s + c.montantTtc, 0);
        const totalPaye = contrats.reduce((s, c) => s + c.montantPaye, 0);
        const restant = totalTTC - totalPaye;
        const enCours = contrats.filter(c => c.statut === "EN_COURS").length;
        const pctPaye = totalTTC > 0 ? Math.round((totalPaye / totalTTC) * 100) : 0;
        return [
            { label: "Contrats ST", value: `${contrats.length}`, sub: `${enCours} en cours` },
            { label: "Engagements TTC", value: fmt(totalTTC), sub: "montant total" },
            { label: "Montant payé", value: fmt(totalPaye), sub: `${pctPaye}% du total` },
            { label: "Reste à payer", value: fmt(restant), sub: "échéances futures" },
        ];
    },
    progress: (contrats: ContratSousTraitance[]): ProgressData => {
        const totalTTC = contrats.reduce((s, c) => s + c.montantTtc, 0);
        const totalPaye = contrats.reduce((s, c) => s + c.montantPaye, 0);
        const paidPct = totalTTC > 0 ? Math.round((totalPaye / totalTTC) * 100) : 0;
        return { paidLabel: `Payé : ${fmt(totalPaye)}`, pendingLabel: `Restant : ${fmt(totalTTC - totalPaye)}`, paidPct, footerLabel: `${paidPct}% des engagements réglés` };
    },
    montantsParST: (contrats: ContratSousTraitance[]): DataPoint[] => {
        const map = contrats.reduce<Record<string, number>>((acc, c) => { acc[c.sousTraitantRaisonSociale] = (acc[c.sousTraitantRaisonSociale] ?? 0) + c.montantTtc; return acc; }, {});
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    payeVsRestant: (contrats: ContratSousTraitance[]): MultiSeriesData => ({
        labels: contrats.map(c => c.reference),
        series: [
            { label: "Payé", data: contrats.map(c => c.montantPaye), color: "#1baf7a", fill: false },
            { label: "Restant", data: contrats.map(c => c.resteAPayer), color: "#e34948", fill: false },
        ],
    }),
    statutsContrats: (contrats: ContratSousTraitance[]): StatusPoint[] =>
        (["EN_COURS", "TERMINE", "RESILIE"] as ContratSTStatut[])
            .map(s => ({ label: CST_STATUS_META[s].label, value: contrats.filter(c => c.statut === s).length, color: CST_STATUS_META[s].dot, badgeBg: CST_STATUS_META[s].bg, badgeText: CST_STATUS_META[s].text }))
            .filter(d => d.value > 0),
    echeancesParStatut: (contrats: ContratSousTraitanceWithPaiements[]): StatusPoint[] => {
        const all = contrats.flatMap(c => c.paiements ?? []);
        return [
            { label: "Payé", value: all.filter(p => p.statut === "PAYE").length, color: "#16a34a", badgeBg: "bg-green-100 dark:bg-green-900/30", badgeText: "text-green-700 dark:text-green-400" },
            { label: "Validé", value: all.filter(p => p.statut === "VALIDE").length, color: "#2563eb", badgeBg: "bg-blue-100 dark:bg-blue-900/30", badgeText: "text-blue-700 dark:text-blue-400" },
            { label: "En attente", value: all.filter(p => p.statut === "EN_ATTENTE").length, color: "#6b7280", badgeBg: "bg-gray-100 dark:bg-gray-800", badgeText: "text-gray-600 dark:text-gray-400" },
        ].filter(d => d.value > 0);
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// ⑧ SALAIRES
// ─────────────────────────────────────────────────────────────────────────────

export interface SalairesHydrated {
    kpis: KpiItem[];
    progress: ProgressData;               // % des fiches payées
    masseSalarialeParDept: DataPoint[];   // pie — masse salariale brute par département
    gainsVsRetenues: MultiSeriesData;     // grouped bar — total gains vs retenues par employé
    statutsFiches: StatusPoint[];         // donut
    topSalaires: DataPoint[];             // horizontal bar — top 6 salaires nets
}

export const salairesHydrationConfig = {

    kpis: (fiches: FichePaie[]): KpiItem[] => {

        const masseBase = fiches.reduce(
            (s, f) => s + f.salaireBase,
            0
        );

        const masseNet = fiches.reduce(
            (s, f) => s + f.netAPayer,
            0
        );

        const payees =
            fiches.filter(
                f => f.statut === "PAYEE"
            ).length;


        const retenues =
            fiches.reduce(
                (s, f) =>
                    s +
                    (f.deductionsCnss ?? 0) +
                    (f.deductionsIr ?? 0),
                0
            );


        return [

            {
                label: "Employés",
                value: `${fiches.length}`,
                sub: `${payees} fiches payées`
            },

            {
                label: "Masse brute",
                value: fmt(masseBase),
                sub: "MAD"
            },

            {
                label: "Masse nette",
                value: fmt(masseNet),
                sub: "à virer"
            },

            {
                label: "Retenues",
                value: fmt(retenues),
                sub: "CNSS + IR"
            }

        ];

    },



    progress: (fiches: FichePaie[]): ProgressData => {

        const total = fiches.length;

        const payees =
            fiches.filter(
                f => f.statut === "PAYEE"
            ).length;


        const pct =
            total
                ? Math.round(payees / total * 100)
                : 0;


        const montantPaye =
            fiches
                .filter(f => f.statut === "PAYEE")
                .reduce(
                    (s, f) => s + f.netAPayer,
                    0
                );


        const montantTotal =
            fiches.reduce(
                (s, f) => s + f.netAPayer,
                0
            );


        return {

            paidLabel:
                `Payé : ${fmt(montantPaye)} MAD`,

            pendingLabel:
                `Restant : ${fmt(montantTotal - montantPaye)} MAD`,

            paidPct: pct,

            footerLabel:
                `${pct}% des fiches payées`

        };

    },



    masseSalarialeParDept:
        (fiches: FichePaie[]): DataPoint[] => {

            const map: Record<string, number> = {};


            fiches.forEach(f => {

                map[f.chantierNom]
                    =
                    (map[f.chantierNom] ?? 0)
                    +
                    f.netAPayer;

            });


            return Object.entries(map)
                .map(
                    ([label, value], i) => ({
                        label,
                        value,
                        color: color(i)
                    })
                );

        },



    gainsVsRetenues:
        (fiches: FichePaie[]): MultiSeriesData => ({

            labels:
                fiches.map(
                    f => f.employeNomComplet
                ),


            series: [

                {
                    label: "Salaire net",
                    data:
                        fiches.map(
                            f => f.netAPayer
                        ),
                    color: "#1baf7a",
                    fill: false
                },


                {
                    label: "Retenues",
                    data:
                        fiches.map(
                            f =>
                                (f.deductionsCnss ?? 0)
                                +
                                (f.deductionsIr ?? 0)
                        ),
                    color: "#e34948",
                    fill: false
                }

            ]

        }),



    statutsFiches:
        (fiches: FichePaie[]): StatusPoint[] => {

            const meta: Record<StatutSalaire, { label: string; color: string; badgeBg: string; badgeText: string }> = {

                BROUILLON: {
                    label: "Brouillon",
                    color: "#6b7280",
                    badgeBg: "bg-gray-100 dark:bg-gray-800",
                    badgeText: "text-gray-600"
                },

                VALIDE: {
                    label: "Validé",
                    color: "#2563eb",
                    badgeBg: "bg-blue-100 dark:bg-blue-900/30",
                    badgeText: "text-blue-700"
                },

                PAYEE: {
                    label: "Payé",
                    color: "#16a34a",
                    badgeBg: "bg-green-100 dark:bg-green-900/30",
                    badgeText: "text-green-700"
                }

            };


            return (Object.keys(meta) as StatutSalaire[])
                .map(
                    (s) => ({

                        label: meta[s].label,

                        value:
                            fiches.filter(
                                f => f.statut === s
                            ).length,

                        color: meta[s].color,

                        badgeBg: meta[s].badgeBg,

                        badgeText: meta[s].badgeText

                    })
                )
                .filter(x => x.value > 0);


        },



    topSalaires:
        (fiches: FichePaie[]): DataPoint[] => {

            return [...fiches]

                .sort(
                    (a, b) => b.netAPayer - a.netAPayer
                )

                .slice(0, 6)

                .map(
                    (f, i) => ({

                        label: f.employeNomComplet,

                        value: f.netAPayer,

                        color: color(i)

                    })
                );


        }

};



// ─────────────────────────────────────────────────────────────────────────────
// ⑨ TRÉSORERIE  (input: Transaction[])
// ─────────────────────────────────────────────────────────────────────────────

export interface TresorerieHydrated {
    kpis: KpiItem[];
    fluxParCaisse: DataPoint[];             // horizontal bar — total par caisse
    encVsDecParJour: MultiSeriesData;       // line — CREDIT vs DEBIT par date
    repartitionFlux: StatusPoint[];         // donut — CREDIT vs DEBIT
    topDecaissements: DataPoint[];          // horizontal bar — top 6 DEBIT
    soldeCaisses: DataPoint[];              // horizontal bar (fed from Caisse[] separately — see note)
}

export const tresorerieHydrationConfig = {
    kpis: (transactions: Transaction[]): KpiItem[] => {
        const credit = transactions.filter(t => t.typeTransaction === "CREDIT").reduce((s, t) => s + t.montant, 0);
        const debit = transactions.filter(t => t.typeTransaction === "DEBIT").reduce((s, t) => s + t.montant, 0);
        const net = credit - debit;
        return [
            { label: "Encaissements", value: fmt(credit), sub: `${transactions.filter(t => t.typeTransaction === "CREDIT").length} opérations` },
            { label: "Décaissements", value: fmt(debit), sub: `${transactions.filter(t => t.typeTransaction === "DEBIT").length} opérations` },
            { label: "Flux net", value: fmt(net), sub: net >= 0 ? "positif" : "négatif" },
            { label: "Transactions", value: `${transactions.length}`, sub: "toutes caisses" },
        ];
    },
    fluxParCaisse: (transactions: Transaction[]): DataPoint[] => {
        const map: Record<string, number> = {};
        transactions.forEach(t => { map[t.caisseLibelle] = (map[t.caisseLibelle] ?? 0) + t.montant; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    encVsDecParJour: (transactions: Transaction[]): MultiSeriesData => {
        const dates = [...new Set(transactions.map(t => t.createdAt.slice(0, 10)))].sort();
        const credit = (d: string) => transactions.filter(t => t.createdAt.slice(0, 10) === d && t.typeTransaction === "CREDIT").reduce((s, t) => s + t.montant, 0);
        const debit = (d: string) => transactions.filter(t => t.createdAt.slice(0, 10) === d && t.typeTransaction === "DEBIT").reduce((s, t) => s + t.montant, 0);
        return {
            labels: dates.map(d => new Date(d).toLocaleDateString("fr-MA", { day: "2-digit", month: "2-digit" })),
            series: [
                { label: "Encaissements", data: dates.map(credit), color: "#1baf7a", fill: true, dashed: false },
                { label: "Décaissements", data: dates.map(debit), color: "#e34948", fill: false, dashed: true },
            ],
        };
    },
    repartitionFlux: (transactions: Transaction[]): StatusPoint[] => {
        const credit = transactions.filter(t => t.typeTransaction === "CREDIT").reduce((s, t) => s + t.montant, 0);
        const debit = transactions.filter(t => t.typeTransaction === "DEBIT").reduce((s, t) => s + t.montant, 0);
        return [
            { label: "Encaissements", value: credit, color: "#1baf7a", badgeBg: "bg-green-100 dark:bg-green-900/30", badgeText: "text-green-700 dark:text-green-400" },
            { label: "Décaissements", value: debit, color: "#e34948", badgeBg: "bg-red-100 dark:bg-red-900/30", badgeText: "text-red-700 dark:text-red-400" },
        ];
    },
    topDecaissements: (transactions: Transaction[]): DataPoint[] =>
        [...transactions].filter(t => t.typeTransaction === "DEBIT").sort((a, b) => b.montant - a.montant).slice(0, 6)
            .map((t, i) => ({ label: t.motif.length > 30 ? t.motif.slice(0, 28) + "…" : t.motif, value: t.montant, color: color(i) })),
    // soldeCaisses is fed with Caisse[] not Transaction[], so expose a separate helper:
    soldeCaisses: (_transactions: Transaction[]): DataPoint[] => [],  // override at call site with caisses
};

/** Separate helper for Caisse[] — call this directly and pass result as `soldeCaisses`. */
export function hydratedSoldeCaisses(caisses: Caisse[]): DataPoint[] {
    return [...caisses].sort((a, b) => b.solde - a.solde).map((c, i) => ({ label: c.libelle.length > 28 ? c.libelle.slice(0, 26) + "…" : c.libelle, value: c.solde, color: c.enAlerte ? "#e34948" : color(i) }));
}
// ─────────────────────────────────────────────────────────────────────────────
// ⑩ PAIEMENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface PaiementsHydrated {
    kpis: KpiItem[];
    progress: ProgressData;
    montantsParType: DataPoint[];         // pie — total par type de paiement
    statutsPaiements: StatusPoint[];      // donut
    payeVsRestantParType: MultiSeriesData; // grouped bar — payé vs restant par type
    echeancesProches: DataPoint[];        // horizontal bar — paiements en attente par tiers
}

const PAIEMENT_STATUS_META: Record<PaiementStatut, { label: string; bg: string; text: string; dot: string }> = {
    PAYE: { label: "Payé", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#16a34a" },
    EN_ATTENTE: { label: "En attente", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "#6b7280" },
    EN_RETARD: { label: "En retard", bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", dot: "#dc2626" },
    VALIDE: {
        label: "Validé",
        bg: "bg-blue-100 dark:bg-blue-900/30",
        text: "text-blue-700 dark:text-blue-400",
        dot: "#2563eb",
    },

    PARTIELLEMENT_PAYE: { label: "Partiellement payé", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "#d97706" },
};

const PAIEMENT_TYPE_LABELS: Record<PaiementType, string> = { FOURNISSEUR: "Fournisseurs", SOUS_TRAITANT: "Sous-traitants", SALAIRE: "Salaires", AUTRE: "Autre" };

export const paiementsHydrationConfig = {
    kpis: (paiements: Paiement[]): KpiItem[] => {
        const total = paiements.reduce((s, p) => s + p.montantTotal, 0);
        const paye = paiements.reduce((s, p) => s + p.montantPaye, 0);
        const restant = paiements.reduce((s, p) => s + p.montantRestant, 0);
        const retard = paiements.filter(p => p.statut === "EN_RETARD").length;
        const pctPaye = total > 0 ? Math.round((paye / total) * 100) : 0;
        return [
            { label: "Total paiements", value: fmt(total), sub: `${paiements.length} opérations` },
            { label: "Montant payé", value: fmt(paye), sub: `${pctPaye}% réglé` },
            { label: "Reste à payer", value: fmt(restant), sub: "toutes catégories" },
            { label: "En retard", value: `${retard}`, sub: "paiements dépassés" },
        ];
    },
    progress: (paiements: Paiement[]): ProgressData => {
        const total = paiements.reduce((s, p) => s + p.montantTotal, 0);
        const paye = paiements.reduce((s, p) => s + p.montantPaye, 0);
        const paidPct = total > 0 ? Math.round((paye / total) * 100) : 0;
        return { paidLabel: `Payé : ${fmt(paye)}`, pendingLabel: `Restant : ${fmt(total - paye)}`, paidPct, footerLabel: `${paidPct}% du total réglé` };
    },
    montantsParType: (paiements: Paiement[]): DataPoint[] => {
        const map: Record<string, number> = {};
        paiements.forEach(p => { const k = PAIEMENT_TYPE_LABELS[p.type]; map[k] = (map[k] ?? 0) + p.montantTotal; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    statutsPaiements: (paiements: Paiement[]): StatusPoint[] =>
        (["PAYE", "EN_ATTENTE", "EN_RETARD", "PARTIELLEMENT_PAYE"] as PaiementStatut[])
            .map(s => ({ label: PAIEMENT_STATUS_META[s].label, value: paiements.filter(p => p.statut === s).length, color: PAIEMENT_STATUS_META[s].dot, badgeBg: PAIEMENT_STATUS_META[s].bg, badgeText: PAIEMENT_STATUS_META[s].text }))
            .filter(d => d.value > 0),
    payeVsRestantParType: (paiements: Paiement[]): MultiSeriesData => {
        const types = ["FOURNISSEUR", "SOUS_TRAITANT", "SALAIRE", "AUTRE"] as PaiementType[];
        return {
            labels: types.map(t => PAIEMENT_TYPE_LABELS[t]),
            series: [
                { label: "Payé", data: types.map(t => paiements.filter(p => p.type === t).reduce((s, p) => s + p.montantPaye, 0)), color: "#1baf7a", fill: false },
                { label: "Restant", data: types.map(t => paiements.filter(p => p.type === t).reduce((s, p) => s + p.montantRestant, 0)), color: "#e34948", fill: false },
            ],
        };
    },
    echeancesProches: (paiements: Paiement[]): DataPoint[] =>
        paiements.filter(p => p.statut !== "PAYE")
            .sort((a, b) => a.dateEcheance.localeCompare(b.dateEcheance)).slice(0, 6)
            .map((p, i) => ({ label: `${p.tiers} (${p.dateEcheance})`, value: p.montantRestant, color: p.statut === "EN_RETARD" ? "#dc2626" : color(i) })),
};

// ─────────────────────────────────────────────────────────────────────────────
// ⑪ COMPTABILITÉ  (input: EcritureComptable[])
// ─────────────────────────────────────────────────────────────────────────────

export interface ComptabiliteHydrated {
    kpis: KpiItem[];
    volumeParJournal: DataPoint[];        // horizontal bar — total mouvements par journal
    debitsVsCredits: MultiSeriesData;     // grouped bar — débits vs crédits par journal
    topComptes: DataPoint[];              // horizontal bar — top comptes par volume débité
    resultatN: DataPoint[];               // pie — produits & charges N (fed from CompteResultat[])
    comparaisonNN1: MultiSeriesData;      // grouped bar — N vs N-1 (fed from CompteResultat[])
}

const JOURNAL_LABELS: Record<JournalCode, string> = { ACH: "Achats", VTE: "Ventes", BNQ: "Banque", CAI: "Caisse", OD: "OD", SAL: "Salaires", STR: "Sous-traitance" };

export const comptabiliteHydrationConfig = {
    kpis: (ecritures: EcritureComptable[]): KpiItem[] => {
        const totalDebit = ecritures.flatMap(e => e.lignes ?? []).reduce((s, l) => s + l.debit, 0);
        const totalCredit = ecritures.flatMap(e => e.lignes ?? []).reduce((s, l) => s + l.credit, 0);
        const journals = new Set(ecritures.map(e => e.journal)).size;
        return [
            { label: "Écritures", value: `${ecritures.length}`, sub: `${journals} journaux` },
            { label: "Total débit", value: fmt(totalDebit), sub: "MAD" },
            { label: "Total crédit", value: fmt(totalCredit), sub: "MAD" },
            { label: "Équilibre", value: totalDebit === totalCredit ? "✓" : "✗", sub: totalDebit === totalCredit ? "équilibré" : "à vérifier" },
        ];
    },
    volumeParJournal: (ecritures: EcritureComptable[]): DataPoint[] => {
        const map: Record<string, number> = {};
        ecritures.forEach(e => { const k = JOURNAL_LABELS[e.journal]; map[k] = (map[k] ?? 0) + e.montant; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    debitsVsCredits: (ecritures: EcritureComptable[]): MultiSeriesData => {
        const journals = [...new Set(ecritures.map(e => e.journal))];
        return {
            labels: journals.map(j => JOURNAL_LABELS[j]),
            series: [
                { label: "Débit", data: journals.map(j => ecritures.filter(e => e.journal === j).flatMap(e => e.lignes ?? []).reduce((s, l) => s + l.debit, 0)), color: "#2a78d6", fill: false },
                { label: "Crédit", data: journals.map(j => ecritures.filter(e => e.journal === j).flatMap(e => e.lignes ?? []).reduce((s, l) => s + l.credit, 0)), color: "#e34948", fill: false },],
        };
    },
    topComptes: (ecritures: EcritureComptable[]): DataPoint[] => {
        const map: Record<string, { libelle: string; debit: number }> = {};
        ecritures.flatMap(e => e.lignes ?? []).forEach(l => {
            if (!map[l.compteNum]) map[l.compteNum] = { libelle: l.compteLibelle, debit: 0 };
            map[l.compteNum].debit += l.debit;
        });
        return Object.entries(map).sort((a, b) => b[1].debit - a[1].debit).slice(0, 6)
            .map(([num, { libelle, debit }], i) => ({ label: `${num} – ${libelle.length > 20 ? libelle.slice(0, 18) + "…" : libelle}`, value: debit, color: color(i) }));
    },
    // Fed from CompteResultat[]
    resultatN: (_: EcritureComptable[]): DataPoint[] => [],
    comparaisonNN1: (_: EcritureComptable[]): MultiSeriesData => ({ labels: [], series: [] }),
};

/** Separate helpers for CompteResultat[] — call directly. */
export function hydratedResultatN(cr: CompteResultat[]): DataPoint[] {
    return cr.map(r => ({ label: r.libelle.length > 26 ? r.libelle.slice(0, 24) + "…" : r.libelle, value: r.montantN, color: r.categorie === "PRODUIT" ? "#1baf7a" : "#e34948" }));
}
export function hydratedComparaisonNN1(cr: CompteResultat[]): MultiSeriesData {
    return {
        labels: cr.map(r => r.libelle.length > 18 ? r.libelle.slice(0, 16) + "…" : r.libelle),
        series: [
            { label: "N", data: cr.map(r => r.montantN), color: "#2a78d6", fill: false },
            { label: "N-1", data: cr.map(r => r.montantN1), color: "#eda100", fill: false, dashed: true },
        ],
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑫ ANNUAIRE
// ─────────────────────────────────────────────────────────────────────────────

export interface AnnuaireHydrated {
    kpis: KpiItem[];
    masseSalarialeParRole: DataPoint[];   // pie
    employsParDept: DataPoint[];          // horizontal bar
    statutsEmployes: StatusPoint[];       // donut
    contratTypes: DataPoint[];            // pie
    anciennete: DataPoint[];              // horizontal bar — années d'ancienneté top 8
}

const EMPLOYE_STATUS_META: Record<EmployeStatut, { label: string; bg: string; text: string; dot: string }> = {
    ACTIF: { label: "Actif", bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#16a34a" },
    CONGE: { label: "En congé", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", dot: "#d97706" },
    INACTIF: { label: "Inactif", bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "#6b7280" },
};

export const annuaireHydrationConfig = {
    kpis: (employes: Employe[]): KpiItem[] => {
        const actifs = employes.filter(e => e.statut === "ACTIF");
        const masseBrute = employes.reduce((s, e) => s + e.salaireBrut, 0);
        const depts = new Set(employes.map(e => e.departement)).size;
        const surChantier = employes.filter(e => e.chantierActuelId).length;
        return [
            { label: "Effectif total", value: `${employes.length}`, sub: `${actifs.length} actifs` },
            { label: "Masse salariale", value: fmt(masseBrute), sub: "brut mensuel" },
            { label: "Départements", value: `${depts}`, sub: "entités" },
            { label: "Sur chantier", value: `${surChantier}`, sub: "affectés actuellement" },
        ];
    },
    masseSalarialeParRole: (employes: Employe[]): DataPoint[] => {
        const map: Record<string, number> = {};
        employes.forEach(e => { map[e.role] = (map[e.role] ?? 0) + e.salaireBrut; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    employsParDept: (employes: Employe[]): DataPoint[] => {
        const map: Record<string, number> = {};
        employes.forEach(e => { map[e.departement] = (map[e.departement] ?? 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    statutsEmployes: (employes: Employe[]): StatusPoint[] =>
        (["ACTIF", "CONGE", "INACTIF"] as EmployeStatut[]).map(s => ({
            label: EMPLOYE_STATUS_META[s].label,
            value: employes.filter(e => e.statut === s).length,
            color: EMPLOYE_STATUS_META[s].dot,
            badgeBg: EMPLOYE_STATUS_META[s].bg,
            badgeText: EMPLOYE_STATUS_META[s].text,
        })).filter(d => d.value > 0),
    contratTypes: (employes: Employe[]): DataPoint[] => {
        const map: Record<string, number> = {};
        employes.forEach(e => { map[e.typeContrat] = (map[e.typeContrat] ?? 0) + 1; });
        return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: color(i) }));
    },
    anciennete: (employes: Employe[]): DataPoint[] => {
        const now = new Date();
        return [...employes]
            .map(e => ({ label: `${e.prenom} ${e.nom}`, years: Math.floor((now.getTime() - new Date(e.dateEmbauche).getTime()) / (365.25 * 86400000)) }))
            .sort((a, b) => b.years - a.years).slice(0, 8)
            .map((d, i) => ({ label: d.label, value: d.years, color: color(i) }));
    },
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT MAP (convenience)
// ─────────────────────────────────────────────────────────────────────────────

export const hydrationConfigs = {
    achats: achatsHydrationConfig,
    fournisseurs: fournisseursHydrationConfig,
    stocks: stocksHydrationConfig,
    catalogue: catalogueHydrationConfig,
    chantiers: chantiersHydrationConfig,
    affectation: affectationHydrationConfig,
    sousTraitance: sousTraitanceHydrationConfig,
    salaires: salairesHydrationConfig,
    tresorerie: tresorerieHydrationConfig,
    paiements: paiementsHydrationConfig,
    comptabilite: comptabiliteHydrationConfig,
    annuaire: annuaireHydrationConfig,
} as const;



