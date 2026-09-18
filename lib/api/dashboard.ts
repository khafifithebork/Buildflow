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

  // Flow KPIs — scoped to `month` when provided, all-time otherwise.
  decaissementsCaisseTtc: number;
  encaissementsGlobauxTtc: number;
  decaissementsGlobauxTtc: number;
  /** Same outflows net of the recoverable TVA on settled purchases. */
  decaissementsGlobauxHt: number;
  /**
   * Outflows flagged effet chantier and not effet fiscal.
   *
   * No longer feeds Résultat Hors Fiscalité — that reads the real outflows
   * now. Still served, and still a column of its own in the Excel export.
   */
  decaissementsEffetChantierHt: number;

  // Margin formulas.
  margeNetteComptableHt: number;
  /** The margin read entirely on HT — no TVA on either side. */
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
