"use client";

import { useState, useEffect, useCallback, type FormEvent } from "react";
import { createSalarie, fetchSalaires, type CreateSalarieDTO } from "@/lib/api/salaires";
import {
  fetchDemandesPaie,
  createDemandePaie,
  validerDemandePaie,
  payerDemandePaie,
  deleteDemandePaie,
  type DemandePaieDTO,
  type ModePaiement as DemModePaiement,
} from "@/lib/api/demandesPaie";
import SalairesClient from "./SalairesClient";
import {
  PrimaryActionButton,
  FadeSwap,
  Skeleton,
  KpiGridSkeleton,
  ChartCardSkeleton,
  PaymentProgressSkeleton,
  TableSkeleton,
  Section,
  Card,
} from "@/components/Functions";
import type { SalarieDTO } from "@/lib/api/salaires";
import { fetchEmployes, type EmployeDTO } from "@/lib/api/employes";
import { fetchChantiers, type ChantierDTO } from "@/lib/api/chantier";
import { fetchBpuLignes, type BpuLigneDTO } from "@/lib/api/bpu";

const emptySalarieForm: CreateSalarieDTO = {
  employeId: "",
  chantierId: "",
  periode: new Date().toISOString().slice(0, 7),
  joursTravailles: 22,
  salaireBase: 0,
  heuresSupplementaires: 0,
  montantHeuresSupp: 0,
  primeTransport: 0,
  primePanier: 0,
  autresPrimes: 0,
  avance: 0,
  deductionsCnss: 0,
  deductionsIr: 0,
};

const emptyDemandeForm = {
  libelle: "",
  periode: new Date().toISOString().slice(0, 7),
  chantierId: "",
  bpuLigneId: "",
  montantNet: "",
};

export default function SalairesPage() {
  const [salaireData, setSalaireData] = useState<SalarieDTO[]>([]);
  const [demandes, setDemandes] = useState<DemandePaieDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState<string>("");
  const [showForm, setShowForm] = useState(false);
  const [showDemandeForm, setShowDemandeForm] = useState(false);
  const [form, setForm] = useState<CreateSalarieDTO>(emptySalarieForm);
  const [demandeForm, setDemandeForm] = useState(emptyDemandeForm);
  const [submitting, setSubmitting] = useState(false);
  const [demandeSubmitting, setDemandeSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [demandeFormError, setDemandeFormError] = useState<string | null>(null);
  const [employes, setEmployes] = useState<EmployeDTO[]>([]);
  const [chantiers, setChantiers] = useState<ChantierDTO[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [bpuLignes, setBpuLignes] = useState<BpuLigneDTO[]>([]);
  const [demandeBpuLignes, setDemandeBpuLignes] = useState<BpuLigneDTO[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fichesData, demandesData] = await Promise.all([
        fetchSalaires(periode),
        fetchDemandesPaie(periode || undefined),
      ]);
      setSalaireData(fichesData || []);
      setDemandes(demandesData || []);
    } catch {
      setError("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, [periode]);

  const loadOptions = useCallback(async () => {
    setLoadingOptions(true);
    try {
      const [employesData, chantiersData] = await Promise.all([fetchEmployes(), fetchChantiers()]);
      setEmployes(employesData || []);
      setChantiers(chantiersData || []);
    } catch {
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadOptions(); }, [loadOptions]);

  useEffect(() => {
    if (!form.chantierId) { setBpuLignes([]); return; }
    fetchBpuLignes(form.chantierId).then(setBpuLignes).catch(() => setBpuLignes([]));
  }, [form.chantierId]);

  useEffect(() => {
    if (!demandeForm.chantierId) { setDemandeBpuLignes([]); return; }
    fetchBpuLignes(demandeForm.chantierId).then(setDemandeBpuLignes).catch(() => setDemandeBpuLignes([]));
  }, [demandeForm.chantierId]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      await createSalarie({
        ...form,
        chantierId: form.chantierId || undefined,
        joursTravailles: Number(form.joursTravailles),
        salaireBase: Number(form.salaireBase),
        heuresSupplementaires: Number(form.heuresSupplementaires || 0),
        montantHeuresSupp: Number(form.montantHeuresSupp || 0),
        primeTransport: Number(form.primeTransport || 0),
        primePanier: Number(form.primePanier || 0),
        autresPrimes: Number(form.autresPrimes || 0),
        avance: Number(form.avance || 0),
        deductionsCnss: Number(form.deductionsCnss || 0),
        deductionsIr: Number(form.deductionsIr || 0),
        bpuLigneId: form.bpuLigneId || undefined,
      });
      setShowForm(false);
      setForm(emptySalarieForm);
      await load();
    } catch {
      setFormError("Impossible d'enregistrer la fiche de paie");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemandeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!demandeForm.libelle || !demandeForm.periode || !demandeForm.montantNet) {
      setDemandeFormError("Libellé, période et montant sont obligatoires.");
      return;
    }
    if (Number(demandeForm.montantNet) <= 0) {
      setDemandeFormError("Le montant doit être supérieur à 0.");
      return;
    }
    setDemandeSubmitting(true);
    setDemandeFormError(null);
    try {
      await createDemandePaie({
        libelle: demandeForm.libelle,
        periode: demandeForm.periode,
        chantierId: demandeForm.chantierId || undefined,
        bpuLigneId: demandeForm.bpuLigneId || undefined,
        montantNet: Number(demandeForm.montantNet),
      });
      setShowDemandeForm(false);
      setDemandeForm(emptyDemandeForm);
      await load();
    } catch {
      setDemandeFormError("Erreur lors de la création de la demande.");
    } finally {
      setDemandeSubmitting(false);
    }
  };

  const inputCls = "w-full rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow text-sm";

  if (error && salaireData.length === 0 && demandes.length === 0) {
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
      <FadeSwap show={loading && salaireData.length === 0 && demandes.length === 0} skeleton={<SalairesSkeleton />}>
      <>

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 px-4 sm:px-6 lg:px-8">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">Paie & Suivi Salaires</h2>
          <p className="text-sm text-content-muted dark:text-content-muted-dark mt-1">
            Le RH émet les demandes de paie, le service Finance débloque le paiement (Virement ou Caisse).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PrimaryActionButton onClick={() => { setShowDemandeForm((v) => !v); setShowForm(false); }}>
            {showDemandeForm ? "Fermer" : "+ Émettre une Demande de Paie"}
          </PrimaryActionButton>
          <button
            onClick={() => { setShowForm((v) => !v); setShowDemandeForm(false); }}
            className="px-4 py-2 text-sm rounded-lg border border-edge-subtle dark:border-edge-subtle-dark text-content-secondary dark:text-content-secondary-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors"
          >
            {showForm ? "Fermer" : "+ Fiche détaillée"}
          </button>
        </div>
      </div>

      {/* ── Simple Demande de Paie Form ── */}
      {showDemandeForm && (
        <form onSubmit={handleDemandeSubmit} className="mx-4 sm:mx-6 lg:mx-8 p-5 rounded-xl border border-edge-subtle dark:border-edge-subtle-dark bg-surface-card dark:bg-surface-card-dark space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-content-primary dark:text-content-primary-dark">Émettre une Demande de Paie</h3>
              <p className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5">Saisissez uniquement le montant global net à payer.</p>
            </div>
            <button type="button" onClick={() => setShowDemandeForm(false)} className="text-xs text-content-muted hover:text-content-primary transition-colors">✕ Annuler</button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">LIBELLÉ / PÉRIODE</span>
              <input
                required
                value={demandeForm.libelle}
                onChange={(e) => setDemandeForm((p) => ({ ...p, libelle: e.target.value }))}
                className={inputCls}
                placeholder="Ex: Pointage Semaine 24"
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">PÉRIODE</span>
              <input
                type="month"
                required
                value={demandeForm.periode}
                onChange={(e) => setDemandeForm((p) => ({ ...p, periode: e.target.value }))}
                className={inputCls}
              />
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">AFFECTATION (CHANTIER / SIÈGE)</span>
              <select
                value={demandeForm.chantierId}
                onChange={(e) => setDemandeForm((p) => ({ ...p, chantierId: e.target.value, bpuLigneId: "" }))}
                className={inputCls}
                disabled={loadingOptions}
              >
                <option value="">-- Imputation Globale (Siège) --</option>
                {chantiers.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.nom}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">IMPUTATION BPU (MAIN D&apos;ŒUVRE)</span>
              <select
                value={demandeForm.bpuLigneId}
                onChange={(e) => setDemandeForm((p) => ({ ...p, bpuLigneId: e.target.value }))}
                className={inputCls}
                disabled={!demandeForm.chantierId}
              >
                <option value="">-- Sans Imputation BPU --</option>
                {demandeBpuLignes.map((bl) => (
                  <option key={bl.id} value={bl.id}>{bl.ref} — {bl.designation}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 sm:col-span-2">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">MONTANT GLOBAL SOLLICITÉ (NET)</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={demandeForm.montantNet}
                onChange={(e) => setDemandeForm((p) => ({ ...p, montantNet: e.target.value }))}
                className={inputCls}
                placeholder="Ex: 5000"
              />
            </label>
          </div>

          {demandeFormError && <p className="text-sm text-red-500">{demandeFormError}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={demandeSubmitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 transition-colors"
            >
              {demandeSubmitting ? "Envoi…" : "Soumettre pour Validation Financière"}
            </button>
          </div>
        </form>
      )}

      {/* ── Detailed FichePaie Form (existing, kept for completeness) ── */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 mx-4 sm:mx-6 lg:mx-8 p-5 rounded-xl border border-edge-subtle dark:border-edge-subtle-dark bg-surface-card dark:bg-surface-card-dark space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-content-primary dark:text-content-primary-dark">Nouvelle fiche détaillée</h3>
            <button type="button" onClick={() => setShowForm(false)} className="text-xs text-content-muted dark:text-content-muted-dark hover:text-content-primary dark:hover:text-content-primary-dark transition-colors">✕ Annuler</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Employé</span>
              <select required value={form.employeId} onChange={(event) => setForm((value) => ({ ...value, employeId: event.target.value }))} className={inputCls} disabled={loadingOptions}>
                <option value="">{loadingOptions ? "Chargement…" : "Sélectionner…"}</option>
                {employes.map((e) => (<option key={e.id} value={e.id}>{e.matricule} — {e.nom} {e.prenom}</option>))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Chantier</span>
              <select value={form.chantierId ?? ""} onChange={(event) => setForm((value) => ({ ...value, chantierId: event.target.value || undefined }))} className={inputCls} disabled={loadingOptions}>
                <option value="">Aucun</option>
                {chantiers.map((c) => (<option key={c.id} value={c.id}>{c.code} — {c.nom}</option>))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Ligne BPU</span>
              <select value={form.bpuLigneId ?? ""} onChange={(event) => setForm((value) => ({ ...value, bpuLigneId: event.target.value || undefined }))} className={inputCls} disabled={!form.chantierId}>
                <option value="">Aucune imputation</option>
                {bpuLignes.map((bl) => (<option key={bl.id} value={bl.id}>{bl.ref} — {bl.designation}</option>))}
              </select>
            </label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Période</span><input type="month" required value={form.periode} onChange={(event) => setForm((value) => ({ ...value, periode: event.target.value }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Jours travaillés</span><input type="number" min="0" value={form.joursTravailles ?? 0} onChange={(event) => setForm((value) => ({ ...value, joursTravailles: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Salaire de base</span><input type="number" min="0" step="0.01" required value={form.salaireBase} onChange={(event) => setForm((value) => ({ ...value, salaireBase: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Heures supplémentaires</span><input type="number" min="0" value={form.heuresSupplementaires ?? 0} onChange={(event) => setForm((value) => ({ ...value, heuresSupplementaires: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Montant HS</span><input type="number" min="0" step="0.01" value={form.montantHeuresSupp ?? 0} onChange={(event) => setForm((value) => ({ ...value, montantHeuresSupp: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Prime transport</span><input type="number" min="0" step="0.01" value={form.primeTransport ?? 0} onChange={(event) => setForm((value) => ({ ...value, primeTransport: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Prime panier</span><input type="number" min="0" step="0.01" value={form.primePanier ?? 0} onChange={(event) => setForm((value) => ({ ...value, primePanier: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Autres primes</span><input type="number" min="0" step="0.01" value={form.autresPrimes ?? 0} onChange={(event) => setForm((value) => ({ ...value, autresPrimes: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Avance</span><input type="number" min="0" step="0.01" value={form.avance ?? 0} onChange={(event) => setForm((value) => ({ ...value, avance: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Déductions CNSS</span><input type="number" min="0" step="0.01" value={form.deductionsCnss ?? 0} onChange={(event) => setForm((value) => ({ ...value, deductionsCnss: Number(event.target.value) }))} className={inputCls} /></label>
            <label className="text-sm space-y-1"><span className="text-xs font-semibold text-content-muted dark:text-content-muted-dark">Déductions IR</span><input type="number" min="0" step="0.01" value={form.deductionsIr ?? 0} onChange={(event) => setForm((value) => ({ ...value, deductionsIr: Number(event.target.value) }))} className={inputCls} /></label>
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex justify-end"><button type="submit" disabled={submitting} className="px-6 py-2.5 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 transition-colors">{submitting ? "Enregistrement…" : "Enregistrer"}</button></div>
        </form>
      )}

      <SalairesClient
        fiches={salaireData}
        demandes={demandes}
        onRefresh={load}
        refreshing={loading}
        onValiderDemande={async (id) => { await validerDemandePaie(id); await load(); }}
        onPayerDemande={async (id, mode) => { await payerDemandePaie(id, mode); await load(); }}
        onDeleteDemande={async (id) => { await deleteDemandePaie(id); await load(); }}
      />
      </>
      </FadeSwap>
    </div>
  );
}

function SalairesSkeleton() {
  return (
    <div className="bg-surface-page dark:bg-surface-page-dark min-h-full py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-content-primary dark:text-content-primary-dark">
            Paie & Suivi Salaires
          </h1>
          <Skeleton className="h-4 w-56 mt-2" />
        </div>
        <Skeleton className="h-9 w-52 rounded-lg" />
      </div>

      <Section title="Historique & Paiements de la Main-d'œuvre">
        <Card>
          <div className="px-4 pt-4 pb-3">
            <Skeleton className="h-9 w-full sm:w-80 rounded-lg" />
          </div>
          <TableSkeleton columns={6} rows={4} />
        </Card>
      </Section>

      <Section title="Vue d'ensemble — Fiches de paie">
        <KpiGridSkeleton count={4} />
      </Section>

      <Section title="Avancement des virements">
        <PaymentProgressSkeleton />
      </Section>

      <Section title="Répartition de la masse salariale">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartCardSkeleton title="Masse brute par département" variant="pie" />
          <ChartCardSkeleton title="Gains vs retenues par employé" variant="bar" />
        </div>
      </Section>

      <Section title="Statuts & top salaires">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <ChartCardSkeleton title="Statuts des fiches" className="sm:col-span-1" variant="donut" />
          <ChartCardSkeleton title="Salaires nets" className="sm:col-span-2" variant="hbar" rows={6} />
        </div>
      </Section>

      <Section title="Liste des fiches de paie">
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
