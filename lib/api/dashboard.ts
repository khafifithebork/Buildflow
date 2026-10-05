import apiClient from "./client";

export interface DashboardKpisDTO {
  month: string | null;

  // Balance KPIs — as of now, not period-scoped.
  dettesFournisseursTtc: number;
  dettesSousTraitantsTtc: number;
  /** Same debts read net of tax — what the margin formulas use. */
  dettesFournisseursHt: number;
  dettesSousTraitantsHt: number;
  paieAPayerNet: number;
  /**
   * What each of the three debts above has already had settled against it,
   * cumulative and every payment mode included. The debt figure is the
   * remainder, so debt + settled is the total ever committed.
   */
  dettesFournisseursPayeTtc: number;
  dettesSousTraitantsPayeTtc: number;
  paieRegleeNet: number;
  attachementsEnCoursTtc: number;
  valeurStocksGlobaleHt: number;
  /** Split of the line above: still in the central dépôt. */
  valeurStocksDepotHt: number;
  /** Split of the line above: allocated to chantiers ("en travaux"). */
  valeurStocksEnTravauxHt: number;
  /**
   * Le même stock découpé par emplacement plutôt que par disponibilité.
   * Purement informatif : n'entre dans aucune formule.
   */
  valeurStocksAuDepotHt: number;
  valeurStocksSurChantiersHt: number;
  /**
   * Stock retenu par le résultat hors fiscalité : égal au stock global.
   * Le prorata par origine des achats a été retiré.
   */
  valeurStocksEffetChantierHt: number;

  // Flow KPIs — scoped to `month` when provided, all-time otherwise.
  decaissementsCaisseTtc: number;
  encaissementsGlobauxTtc: number;
  decaissementsGlobauxTtc: number;
  /** Same outflows net of the recoverable TVA on settled purchases. */
  decaissementsGlobauxHt: number;
  /**
   * Les sorties marquées effet chantier et non effet fiscal — la part filtrable
   * des décaissements réels. Également une colonne de l'export Excel.
   */
  decaissementsEffetChantierHt: number;
  /**
   * Les décaissements réels du calcul 1 : le périmètre effet chantier pour les
   * achats et la caisse, qui portent les drapeaux, plus la sous-traitance et la
   * paie entières, qui n'en portent aucun.
   */
  decaissementsReelsHt: number;

  // Les deux lectures du résultat : elles diffèrent par le périmètre des
  // décaissements — l'une écarte l'effet fiscal, l'autre non — et par celui
  // du stock.
  /** Calcul 2 : la situation globale, effet fiscal compris. */
  margeNetteComptableHt: number;
  /** Calcul 1 : la situation réelle d'exploitation, hors effet fiscal. */
  resultatHorsFiscaliteHt: number;
  margeEnCoursPrevisionnelleHt: number;
}

/** GET /api/v1/dashboard/kpis?month=YYYY-MM (ADMIN/FINANCE/DIRECTEUR only) */
export async function fetchDashboardKpis(month?: string): Promise<DashboardKpisDTO> {
  const { data } = await apiClient.get<DashboardKpisDTO>("/dashboard/kpis", {
    params: month ? { month } : {},
  });
  return data;
}
