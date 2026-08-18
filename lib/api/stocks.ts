import apiClient, { toArrayPayload, unwrapApiPayload } from "./client";

export type TypeMouvement = "ENTREE" | "SORTIE" | "AJUSTEMENT" | "TRANSFERT";

/** Where a stock line sits. */
export type EmplacementStock = "DEPOT" | "CHANTIER";

export interface CreateMouvementStockDTO {
  articleId: string;
  /** Omit (or null) to target the central dépôt. */
  chantierId?: string | null;
  typeMouvement: TypeMouvement;
  quantite: number;
  documentRef?: string;
  /** TRANSFERT only — destination. Omit (or null) to move into the dépôt. */
  chantierDestinationId?: string | null;
}

export interface StockArticleDTO {
  id: string;
  /** Needed to act on this line (affectation, mouvements). */
  articleId: string;
  articleCode: string;
  designation: string;
  unite: string;
  /** Null when the line sits in the central dépôt. */
  chantierId: string | null;
  /** "Dépôt central" when there is no chantier. */
  chantierNom: string;
  emplacement: EmplacementStock;
  /** Still available at this location — "Stock Dispo". */
  quantiteTheorique: number;
  /** Incorporated into the works — "Stock Travaux (Posé)". */
  quantiteTravaux: number;
  seuilAlerte: number;
  enAlerte: boolean;
}

/**
 * GET /api/v1/stocks/chantiers/{chantierId}
 * Backend only exposes stock levels scoped to a single chantier (paginated).
 */
export async function fetchStocksByChantier(
  chantierId: string,
  page = 0,
  size = 100,
  sort = "article.designation"
): Promise<StockArticleDTO[]> {
  const { data } = await apiClient.get<unknown>(`/stocks/chantiers/${chantierId}`, {
    params: { page, size, sort },
  });
  return toArrayPayload<StockArticleDTO>(data);
}

/**
 * Create a manual stock movement (entrée/sortie/ajustement).
 * POST /api/v1/stocks/mouvements
 */
export async function createMouvementStock(payload: CreateMouvementStockDTO): Promise<StockArticleDTO> {
  const { data } = await apiClient.post<unknown>("/stocks/mouvements", payload);
  return unwrapApiPayload<StockArticleDTO>(data);
}

/**
 * Stock held in the central dépôt — not yet allocated to any chantier.
 * GET /api/v1/stocks/depot
 */
export async function fetchStocksDepot(
  page = 0,
  size = 100,
  sort = "article.designation"
): Promise<StockArticleDTO[]> {
  const { data } = await apiClient.get<unknown>("/stocks/depot", {
    params: { page, size, sort },
  });
  return toArrayPayload<StockArticleDTO>(data);
}

/**
 * Incorporates material into the works — "poser" it.
 *
 * Moves quantity from available to posé at one location. Neither the location
 * nor the total value of stock changes; only the split does.
 * POST /api/v1/stocks/affectation-travaux
 */
export async function affecterAuxTravaux(payload: {
  articleId: string;
  /** Omit (or null) for the central dépôt. */
  chantierId?: string | null;
  quantite: number;
  documentRef?: string;
}): Promise<StockArticleDTO> {
  const { data } = await apiClient.post<unknown>("/stocks/affectation-travaux", payload);
  return unwrapApiPayload<StockArticleDTO>(data);
}
