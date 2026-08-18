import apiClient, { toArrayPayload, unwrapApiPayload } from "./client";
import type { Achat } from "@/components/functions2";
import type { ModePaiement } from "@/components/ModePaiementDialog";

export interface CreateLigneAchatDTO {
  articleId: string;
  designation: string;
  quantite: number;
  prixUnitaire: number;
  bpuLigneId?: string;
}

export interface CreateAchatDTO {
  fournisseurId: string;
  chantierId: string;
  dateCommande: string;
  dateLivraisonPrevue: string;
  lignes: CreateLigneAchatDTO[];
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

export async function fetchAchats(): Promise<Achat[]> {
  const { data } = await apiClient.get<unknown>("/achats");
  return toArrayPayload<Achat>(data);
}

export async function createAchat(
  payload: CreateAchatDTO
): Promise<Achat> {
  const { data } = await apiClient.post<unknown>("/achats", payload);
  return unwrapApiPayload<Achat>(data);
}

// ─────────────────────────────────────────────────────────────────────────────
// Lifecycle transitions — strictly sequential:
//   EN_COURS --[BL]--> LIVRE --[facture]--> FACTURE --[paiement]--> PAYE
// Skipping a step returns 422; so does paying with an underfunded caisse.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Confirm delivery. Provisions the chantier's stock (one ENTREE per line,
 * traced on the order ref).
 * PATCH /api/v1/achats/{id}/validate-bl — roles ADMIN, ACHAT, PM
 */
export async function validateBL(id: string, bonLivraisonRef: string): Promise<Achat> {
  const { data } = await apiClient.patch<unknown>(
    `/achats/${id}/validate-bl`,
    null,
    { params: { bonLivraisonRef } }
  );
  return unwrapApiPayload<Achat>(data);
}

/**
 * Record the supplier invoice. No side effect.
 * PATCH /api/v1/achats/{id}/validate-facture — roles ADMIN, FINANCE
 */
export async function validateFacture(id: string, factureRef: string): Promise<Achat> {
  const { data } = await apiClient.patch<unknown>(
    `/achats/${id}/validate-facture`,
    null,
    { params: { factureRef } }
  );
  return unwrapApiPayload<Achat>(data);
}

/**
 * Settle the order with an explicit payment mode. Only CAISSE debits the
 * chantier's caisse (and can fail with 422 "Insufficient funds"); a virement,
 * cheque or effet clears through the bank and leaves the balance untouched.
 * PATCH /api/v1/achats/{id}/validate-paiement — roles ADMIN, FINANCE
 */
export async function validatePaiement(id: string, modePaiement: ModePaiement): Promise<Achat> {
  const { data } = await apiClient.patch<unknown>(
    `/achats/${id}/validate-paiement`,
    null,
    { params: { modePaiement } }
  );
  return unwrapApiPayload<Achat>(data);
}

/**
 * Défait un règlement enregistré à tort : la commande repasse à FACTURE et la
 * caisse récupère ce qui en était sorti. Le serveur refuse de contre-passer
 * l'écriture depuis la caisse, c'est ici que ça se fait.
 *
 * PATCH /api/v1/achats/{id}/annuler-paiement
 */
export async function annulerPaiement(id: string, motif?: string): Promise<Achat> {
  const { data } = await apiClient.patch(`/achats/${id}/annuler-paiement`, { motif });
  return unwrapApiPayload<Achat>(data);
}

/**
 * Toggle the operational billing indicators on an existing achat.
 * PATCH /api/v1/achats/{id}/indicateurs
 */
export async function updateAchatIndicateurs(
  id: string,
  payload: UpdateIndicateursDTO
): Promise<Achat> {
  const { data } = await apiClient.patch<unknown>(`/achats/${id}/indicateurs`, payload);
  return unwrapApiPayload<Achat>(data);
}

/**
 * Change the unit price of one order line. The server recomputes the line
 * total and the order's HT/TVA/TTC and returns the whole updated order.
 *
 * Allowed at any statut; once the order is invoiced or paid the server sends
 * back a `warning` explaining what is now out of step downstream.
 * PATCH /api/v1/achats/{achatId}/lignes/{ligneId}/prix
 */
export async function updateLignePrix(
  achatId: string,
  ligneId: string,
  prixUnitaire: number
): Promise<{ achat: Achat; warning: string | null }> {
  // The response interceptor unwraps `data`, discarding the envelope's
  // `message` — read it off the raw body before that happens.
  const { data } = await apiClient.patch<unknown>(
    `/achats/${achatId}/lignes/${ligneId}/prix`,
    { prixUnitaire },
    { transformResponse: [(raw) => raw] }
  );

  const body = typeof data === "string" ? JSON.parse(data) : data;
  return {
    achat: unwrapApiPayload<Achat>(body),
    warning: (body as { message?: string | null })?.message ?? null,
  };
}

/**
 * Re-price the whole commande to a new total HT — a renegotiated order rather
 * than one renegotiated article. The lines keep the proportions they have.
 *
 * PATCH /api/v1/achats/{achatId}/montant
 */
export async function updateMontantHt(
  achatId: string,
  montantHt: number
): Promise<{ achat: Achat; warning: string | null }> {
  const { data } = await apiClient.patch<unknown>(
    `/achats/${achatId}/montant`,
    { montantHt },
    { transformResponse: [(raw) => raw] }
  );

  const body = typeof data === "string" ? JSON.parse(data) : data;
  return {
    achat: unwrapApiPayload<Achat>(body),
    warning: (body as { message?: string | null })?.message ?? null,
  };
}