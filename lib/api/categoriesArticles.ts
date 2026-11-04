import apiClient, { unwrapApiPayload } from "./client";
import { chargerToutesLesPages } from "./paging";

export interface CategorieArticleDTO {
    id: string;
    code: string;
    libelle: string;
    parentId: string | null;
}

export interface CreateCategorieArticleDTO {
    libelle: string;
    parentId: string | null;
}

export interface CategoriesPage {
    content: CategorieArticleDTO[];
    page: number;
    size: number;
    totalElements: number;
    totalPages: number;
}

export async function fetchCategoriesArticles(page = 0, size = 100) {
    const { data } = await apiClient.get(
        `/categories-articles?page=${page}&size=${size}`
    );

    return unwrapApiPayload<CategoriesPage>(data);
}

/**
 * Toutes les catégories, pour les listes qui doivent les présenter en entier.
 *
 * L'appel ci-dessus demandait une page de 100 en dur, donc une arborescence
 * plus large se coupait sans le dire. Voir ./paging.
 */
export async function fetchAllCategoriesArticles(): Promise<CategorieArticleDTO[]> {
    return chargerToutesLesPages<CategorieArticleDTO>(
        (page, size) => fetchCategoriesArticles(page, size)
    );
}

export async function createCategorieArticle(
    payload: CreateCategorieArticleDTO
): Promise<CategorieArticleDTO> {
    const { data } = await apiClient.post(
        "/categories-articles",
        payload
    );

    return unwrapApiPayload<CategorieArticleDTO>(data);
}