import apiClient, { toArrayPayload, unwrapApiPayload } from "./client";

// ─────────────────────────────────────────────────────────────────────────────
// Backend DTO shape returned by GET /api/v1/articles and GET /api/v1/articles/{id}
// ─────────────────────────────────────────────────────────────────────────────

export interface ArticleDTO {
  id: string;
  code: string;
  designation: string;
  description?: string;
  categorieId: string;
  categorieLibelle?: string;
  unite: string;
  prixAchatRef: number;
  tvaRate: number;
  actif?: boolean;
  fournisseursPreferentiels: string[];
  createdAt?: string;
  updatedAt?: string;
}
export interface ArticleForm {
  code: string;
  designation: string;
  description?: string;

  // The user types the category name
  categorie: string;

  unite: string;
  prixAchatRef: number;
  tvaRate: number;
  fournisseursPreferentiels: string[];
}
/** Shape sent when creating / updating an article (POST /api/v1/articles). */
export interface CreateArticleDTO {
  designation: string;
  description?: string;
  categorieId: string;
  unite: string;
  prixAchatRef: number;
  tvaRate: number;
  fournisseursPreferentiels: string[];
}

/** Paginated wrapper returned by GET /api/v1/articles (Spring Boot Page<T>). */
export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;   // current page (0-based)
  size: number;
  first: boolean;
  last: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// API calls
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a paginated list of articles.
 * GET /api/v1/articles?page=0&size=20&sort=designation,asc
 */
export async function fetchArticles(
  page = 0,
  size = 50,
  sort = "designation,asc"
): Promise<PagedResponse<ArticleDTO>> {
  const { data } = await apiClient.get<unknown>("/articles", {
    params: { page, size, sort },
  });
  const payload = unwrapApiPayload<PagedResponse<ArticleDTO> | { content?: ArticleDTO[] }>(data);
  const maybePage = payload as (Partial<PagedResponse<ArticleDTO>> & { page?: number }) | null;

  // Le backend ne renvoie pas une Page<T> de Spring : son PageResponse porte
  // `page`, `size`, `totalElements` et `totalPages`, et ni `last` ni `first`.
  // Ces deux-la retombaient donc sur `?? true` a chaque appel, ce qui disait
  // d'une premiere page sur trois qu'elle etait la derniere. On les derive de
  // `totalPages`, seule source qui existe reellement.
  const totalPages = maybePage?.totalPages ?? 0;
  const number = maybePage?.number ?? maybePage?.page ?? 0;

  return {
    content: Array.isArray(maybePage?.content) ? maybePage.content : toArrayPayload<ArticleDTO>(payload),
    totalElements: maybePage?.totalElements ?? 0,
    totalPages,
    number,
    size: maybePage?.size ?? 0,
    first: number <= 0,
    // Une reponse sans pagination (tableau nu) donne totalPages = 0 : elle est
    // sa propre derniere page, et une boucle s'arrete apres un seul appel.
    last: totalPages === 0 ? true : number >= totalPages - 1,
  };
}

/**
 * Fetch EVERY article, page by page.
 *
 * For the pickers that need a complete list — choosing an article on a new
 * purchase order, for one. Those each picked their own page size (50 here,
 * 100 there, 200 elsewhere) and every one of them cut the list off with no
 * message: the form simply stopped offering articles partway through the
 * alphabet, which reads as a broken scrollbar rather than as missing data.
 *
 * A bigger number only moves the cliff. Spring clamps `size` to
 * `max-page-size` — 2000 unless configured — and says nothing when it does,
 * so the next cap would fail exactly as quietly as this one.
 *
 * Walking to `last` has no cliff. PAGE_LIMIT bounds how many requests this
 * will ever make, for a backend that never sets `last`; it is not a row cap,
 * and at this page size it covers 10 000 articles.
 */
export async function fetchAllArticles(
  sort = "designation,asc"
): Promise<ArticleDTO[]> {
  const PAGE_SIZE = 200;
  const PAGE_LIMIT = 50;

  const all: ArticleDTO[] = [];
  for (let page = 0; page < PAGE_LIMIT; page += 1) {
    const res = await fetchArticles(page, PAGE_SIZE, sort);
    all.push(...res.content);
    // `last` se deduit de totalPages, le backend ne l'envoyant pas. Le test
    // sur le contenu vide couvre en plus une reponse sans pagination.
    if (res.last || res.content.length === 0) break;
  }
  return all;
}

/**
 * Fetch a single article by ID.
 * GET /api/v1/articles/{id}
 */
export async function fetchArticleById(id: string): Promise<ArticleDTO> {
  const { data } = await apiClient.get<unknown>(`/articles/${id}`);
  return unwrapApiPayload<ArticleDTO>(data);
}

/**
 * Create a new article.
 * POST /api/v1/articles
 */
export async function createArticle(
  payload: CreateArticleDTO
): Promise<ArticleDTO> {
  const { data } = await apiClient.post<unknown>("/articles", payload);
  return unwrapApiPayload<ArticleDTO>(data);
}

/**
 * Update an existing article.
 * PUT /api/v1/articles/{id}
 */
export async function updateArticle(
  id: string,
  payload: CreateArticleDTO
): Promise<ArticleDTO> {
  const { data } = await apiClient.put<unknown>(`/articles/${id}`, payload);
  return unwrapApiPayload<ArticleDTO>(data);
}

/**
 * Delete an article.
 * DELETE /api/v1/articles/{id}
 */
export async function deleteArticle(id: string): Promise<void> {
  await apiClient.delete(`/articles/${id}`);
}
