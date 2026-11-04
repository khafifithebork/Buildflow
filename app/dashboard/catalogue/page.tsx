"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import {
  ArticleForm,
  createArticle,
  updateArticle,
  deleteArticle,
  fetchAllArticles,
  type CreateArticleDTO,
} from "@/lib/api/articles";
import CatalogueClient from "./CatalogueClient";
import { useAuth } from "@/lib/authContext";
import {
  PrimaryActionButton,
  FadeSwap,
  Skeleton,
  KpiGridSkeleton,
  ChartCardSkeleton,
  TableSkeleton,
  Section,
  Card,
} from "@/components/Functions";

import type { Article } from "@/components/functions2";
import {
  fetchAllCategoriesArticles,
  createCategorieArticle,
  type CategorieArticleDTO
} from "@/lib/api/categoriesArticles";
import { fetchFournisseurs, type FournisseurDTO } from "@/lib/api/fournisseurs";
import { CodeField } from "@/components/CodeField";


const emptyArticleForm: ArticleForm = {
  code: "",
  designation: "",
  description: "",
  categorie: "",
  unite: "pièce",
  prixAchatRef: 0,
  tvaRate: 20,
  fournisseursPreferentiels: [],
};

export default function CataloguePage() {
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "ACHAT";

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ArticleForm>(emptyArticleForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<CategorieArticleDTO[]>([]);
  const [fournisseurs, setFournisseurs] = useState<FournisseurDTO[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [articlesRes, categoriesRes, fournisseursRes] = await Promise.all([
        // Le catalogue entier, pas une page de 100 : c'est le catalogue.
        fetchAllArticles("designation,asc"),
        fetchAllCategoriesArticles(),
        fetchFournisseurs(),
      ]);

      setCategories(categoriesRes);
      setFournisseurs(fournisseursRes ?? []);

      const items = articlesRes.map((item) => ({
        ...item,
        categorieLibelle: item.categorieLibelle ?? "Autre",
        actif: item.actif ?? true,
        fournisseursPreferentiels: item.fournisseursPreferentiels ?? [],
      })) satisfies Article[];

      setArticles(items);
    } catch {
      const msg =
        "Une erreur est survenue. Veuillez réessayer.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      let categorieId = "";

      const existingCategory = categories.find(
        (c) =>
          c.libelle.trim().toLowerCase() ===
          form.categorie.trim().toLowerCase()
      );

      if (existingCategory) {
        categorieId = existingCategory.id;
      } else {
        const created = await createCategorieArticle({
          libelle: form.categorie,
          parentId: null,
        });

        categorieId = created.id;

        setCategories((prev) => [...prev, created]);
      }

      const payload: CreateArticleDTO = {
        designation: form.designation,
        description: form.description,

        categorieId,

        unite: form.unite,
        prixAchatRef: Number(form.prixAchatRef),
        tvaRate: Number(form.tvaRate),

        fournisseursPreferentiels: form.fournisseursPreferentiels,
      };

      if (editingId) {
        await updateArticle(editingId, payload);
      } else {
        await createArticle(payload);
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyArticleForm);
      await load();
    } catch {
      const msg = editingId ? "Impossible de modifier l’article" : "Impossible d’enregistrer l’article";

      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (a: Article) => {
    setEditingId(a.id);
    setForm({
      code: a.code,
      designation: a.designation,
      description: a.description ?? "",
      categorie: a.categorieLibelle,
      unite: a.unite,
      prixAchatRef: a.prixAchatRef,
      tvaRate: a.tvaRate,
      fournisseursPreferentiels: a.fournisseursPreferentiels ?? [],
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleDelete = async (a: Article) => {
    if (!confirm(`Supprimer l'article "${a.designation}" ?`)) return;
    try {
      await deleteArticle(a.id);
      await load();
    } catch {
      setError("Impossible de supprimer cet article (peut-être référencé par des achats/stocks).");
    }
  };

  if (error && articles.length === 0) {
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
    <div className="space-y-6">
      <FadeSwap show={loading && articles.length === 0} skeleton={<CatalogueSkeleton />}>
      <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">Catalogue</h2>
          <p className="text-sm text-content-muted dark:text-content-muted-dark mt-1">Ajoutez et consultez vos articles .</p>
        </div>
        {canManage && (
          <PrimaryActionButton onClick={() => { setEditingId(null); setForm(emptyArticleForm); setShowForm((value) => !value); }}>
            {showForm ? "Fermer" : "+ Nouvel article"}
          </PrimaryActionButton>
        )}
      </div>

      {showForm && canManage && (
        <form onSubmit={handleSubmit} className="mb-6 mx-4 sm:mx-6 lg:mx-8 p-5 rounded-xl border border-edge-subtle dark:border-edge-subtle-dark bg-surface-card dark:bg-surface-card-dark space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-content-primary dark:text-content-primary-dark">
              {editingId ? "Modifier l'article" : "Nouvel article"}
            </h3>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="text-xs text-content-muted dark:text-content-muted-dark hover:text-content-primary dark:hover:text-content-primary-dark transition-colors">✕ Annuler</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <CodeField value={editingId ? articles.find((a) => a.id === editingId)?.code : undefined} />
            <label className="text-sm space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Désignation</span>
              <input required value={form.designation ?? ""} onChange={(event) => setForm((value) => ({ ...value, designation: event.target.value }))} className="w-full rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow" />
            </label>
            <label className="text-sm space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Description</span>
              <textarea value={form.description ?? ""} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} className="w-full rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow" rows={3} />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Catégorie</span>

              <input
                list="categories"
                value={form.categorie ?? ""}
                onChange={(e) =>
                  setForm((v) => ({
                    ...v,
                    categorie: e.target.value,
                  }))
                }
                className="w-full rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
                placeholder="Choisir ou créer..."
              />

              <datalist id="categories">
                {categories.map((category) => (
                  <option key={category.id} value={category.libelle} />
                ))}
              </datalist>
            </label>
            <label className="text-sm space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Unité</span>
              <input required value={form.unite ?? ""} onChange={(event) => setForm((value) => ({ ...value, unite: event.target.value }))} className="w-full rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow" />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Prix d’achat de référence</span>
              <input type="number" min="0" step="any" required value={form.prixAchatRef ?? 0} onChange={(event) => setForm((value) => ({ ...value, prixAchatRef: Number(event.target.value) }))} className="w-full rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow" />
            </label>
            <label className="text-sm space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">TVA (%)</span>
              <input type="number" min="0" step="0.01" required value={form.tvaRate ?? 0} onChange={(event) => setForm((value) => ({ ...value, tvaRate: Number(event.target.value) }))} className="w-full rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow" />
            </label>
            <div className="text-sm space-y-1 md:col-span-2">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Fournisseurs préférentiels</span>
              {fournisseurs.length === 0 ? (
                <p className="text-xs text-content-muted">Aucun fournisseur enregistré.</p>
              ) : (
                <div className="flex flex-wrap gap-2 mt-1">
                  {fournisseurs.map((f) => {
                    const checked = form.fournisseursPreferentiels.includes(f.raisonSociale);
                    return (
                      <label
                        key={f.id}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs cursor-pointer border transition-colors ${checked ? "bg-accent/10 border-accent text-accent" : "border-edge-subtle text-content-muted"}`}
                      >
                        <input
                          type="checkbox"
                          className="accent-accent"
                          checked={checked}
                          onChange={() =>
                            setForm((value) => ({
                              ...value,
                              fournisseursPreferentiels: checked
                                ? value.fournisseursPreferentiels.filter((name) => name !== f.raisonSociale)
                                : [...value.fournisseursPreferentiels, f.raisonSociale],
                            }))
                          }
                        />
                        {f.raisonSociale}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex justify-end">
            <button type="submit" disabled={submitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 transition-colors">
              {submitting ? "Enregistrement…" : editingId ? "Enregistrer les modifications" : "Enregistrer"}
            </button>
          </div>
        </form>
      )}

      <CatalogueClient
        articles={articles}
        onRefresh={load}
        refreshing={loading}
        canManage={canManage}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
      </>
      </FadeSwap>
    </div>
  );
}

function CatalogueSkeleton() {
  return (
    <div className="bg-surface-page dark:bg-surface-page-dark min-h-full py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">
            Tableau de bord — Catalogue
          </h1>
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>

      <Section title="Vue d'ensemble">
        <KpiGridSkeleton count={4} />
      </Section>

      <Section title="Répartition du catalogue">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCardSkeleton title="Articles par catégorie" variant="pie" />
          <ChartCardSkeleton title="Prix de référence moyen par catégorie (MAD HT)" variant="hbar" rows={5} />
        </div>
      </Section>

      <Section title="Statuts & prix">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ChartCardSkeleton title="Actifs / Inactifs" className="sm:col-span-1" variant="donut" />
          <ChartCardSkeleton title="Top articles par prix de référence" className="sm:col-span-2" variant="hbar" rows={5} />
        </div>
      </Section>

      <Section title="Fournisseurs préférentiels">
        <ChartCardSkeleton title="Nombre d'articles couverts par fournisseur préférentiel" variant="hbar" rows={5} />
      </Section>

      <Section title="Liste des articles">
        <Card>
          <div className="px-4 pt-4 pb-3">
            <Skeleton className="h-9 w-full sm:w-80 rounded-lg" />
          </div>
          <TableSkeleton columns={7} rows={6} />
        </Card>
      </Section>
    </div>
  );
}