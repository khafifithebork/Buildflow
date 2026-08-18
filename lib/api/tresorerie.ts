import apiClient, { toArrayPayload, unwrapApiPayload } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Backend DTO shapes — matched exactly to CaisseResponse and
// CaisseTransactionResponse. No fictional fields (no "categorie", "tiers",
// "saisiePar", "devise", "type" on Caisse — the backend doesn't have these).
// ─────────────────────────────────────────────────────────────────────────────

export type TypeTransaction = "CREDIT" | "DEBIT";

export interface Transaction {
  id: string;
  typeTransaction: TypeTransaction;
  montant: number;
  motif: string;
  referenceDocument?: string;
  createdAt: string;
  caisseId: string;
  caisseLibelle: string;
  bpuLigneRef?: string;
  /** "L'achat a-t-il réellement servi au chantier ?" */
  impactAnalytiqueChantier: boolean;
  /** "Y a-t-il une facture officielle à déclarer ?" */
  impactComptableFiscal: boolean;
}

export interface Caisse {
  id: string;
  code: string;
  libelle: string;
  chantierId: string;
  chantierNom: string;
  solde: number;
  seuilMinimum: number;
  enAlerte: boolean;
}

export interface CaisseTransactionDTO {
  id: string;
  typeTransaction: TypeTransaction;
  montant: number;
  motif: string;
  referenceDocument?: string;
  createdAt: string;
  bpuLigneRef?: string;
  /** "L'achat a-t-il réellement servi au chantier ?" */
  impactAnalytiqueChantier: boolean;
  /** "Y a-t-il une facture officielle à déclarer ?" */
  impactComptableFiscal: boolean;
  /** True once cancelled; a reversing entry carries the correction. */
  annule: boolean;
  /** True when this row IS a correction of another. */
  ajustement: boolean;
}

export interface CaisseDTO {
  id: string;
  code: string;
  libelle: string;
  chantierId: string;
  chantierNom: string;
  solde: number;
  seuilMinimum: number;
  enAlerte: boolean;
  dernieresTransactions: CaisseTransactionDTO[];
}

export interface CreateCaisseDTO {
  libelle: string;
  chantierId: string;
  seuilMinimum: number;
}

export interface CreateTransactionDTO {
  typeTransaction: TypeTransaction;
  montant: number;
  motif: string;
  referenceDocument?: string;
  bpuLigneId?: string;
  /** "L'achat a-t-il réellement servi au chantier ?" — defaults to false server-side. */
  impactAnalytiqueChantier?: boolean;
  /** "Y a-t-il une facture officielle à déclarer ?" — defaults to false server-side. */
  impactComptableFiscal?: boolean;
}

/** Partial update: omit a field to leave it untouched. */
export interface UpdateIndicateursDTO {
  impactAnalytiqueChantier?: boolean;
  impactComptableFiscal?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all caisses. Each includes chantier info and its most recent
 * transactions embedded (dernieresTransactions).
 * GET /api/v1/caisses
 */
export async function fetchCaisses(): Promise<CaisseDTO[]> {
  const { data } = await apiClient.get("/caisses");
  return toArrayPayload<CaisseDTO>(data);
}

/**
 * Fetch a single caisse by ID (includes its transactions).
 * GET /api/v1/caisses/{id}
 */
export async function fetchCaisseById(id: string): Promise<CaisseDTO> {
  const { data } = await apiClient.get(`/caisses/${id}`);
  return unwrapApiPayload<CaisseDTO>(data);
}

/**
 * Fetch full transaction history for a caisse (separate from the
 * "dernieresTransactions" preview embedded on the caisse itself).
 * GET /api/v1/caisses/{id}/transactions
 */
export async function fetchTransactions(caisseId: string): Promise<CaisseTransactionDTO[]> {
  const { data } = await apiClient.get(`/caisses/${caisseId}/transactions`);
  return toArrayPayload<CaisseTransactionDTO>(data);
}

/**
 * Create a new caisse.
 * POST /api/v1/caisses
 */
export async function createCaisse(payload: CreateCaisseDTO): Promise<CaisseDTO> {
  const { data } = await apiClient.post("/caisses", payload);
  return unwrapApiPayload<CaisseDTO>(data);
}

/**
 * Create a credit or debit transaction on a caisse.
 * POST /api/v1/caisses/{id}/transactions
 */
export async function createTransaction(
  caisseId: string,
  payload: CreateTransactionDTO
): Promise<CaisseTransactionDTO> {
  const { data } = await apiClient.post(`/caisses/${caisseId}/transactions`, payload);
  return unwrapApiPayload<CaisseTransactionDTO>(data);
}

/**
 * Toggle the operational billing indicators on an existing cash operation.
 * PATCH /api/v1/caisses/{caisseId}/transactions/{transactionId}/indicateurs
 */
export async function updateTransactionIndicateurs(
  caisseId: string,
  transactionId: string,
  payload: UpdateIndicateursDTO
): Promise<CaisseTransactionDTO> {
  const { data } = await apiClient.patch(
    `/caisses/${caisseId}/transactions/${transactionId}/indicateurs`,
    payload
  );
  return unwrapApiPayload<CaisseTransactionDTO>(data);
}

/**
 * Cancels a cash movement that should not have happened — a wrong amount, a
 * duplicate, a payment that never cleared.
 *
 * The balance is put back by a reversing entry; the original row is kept and
 * marked cancelled, so the ledger still shows both.
 * PATCH /api/v1/caisses/{caisseId}/transactions/{transactionId}/annuler
 */
export async function annulerTransaction(
  caisseId: string,
  transactionId: string,
  motif?: string
): Promise<CaisseTransactionDTO> {
  const { data } = await apiClient.patch<unknown>(
    `/caisses/${caisseId}/transactions/${transactionId}/annuler`,
    { motif: motif ?? null }
  );
  return unwrapApiPayload<CaisseTransactionDTO>(data);
}
