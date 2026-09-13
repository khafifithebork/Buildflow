"use client";

import { useState, useMemo } from "react";
import { hydrate } from "@/components/functions2";
import type { FichePaie, SalairesHydrated } from "@/components/functions2";
import { salairesHydrationConfig } from "@/components/functions2";
import { validerSalarie, payerSalarie, type SalarieDTO } from "@/lib/api/salaires";
import { changerModePaiement } from "@/lib/api/modePaiement";
import { extractApiErrorMessage } from "@/lib/api/client";
import {
  ModePaiementDialog,
  ModePaiementBadge,
  type ModePaiement,
} from "@/components/ModePaiementDialog";
import type { DemandePaieDTO, ModePaiement as DemModePaiement } from "@/lib/api/demandesPaie";
import {
  ChartJsLoader, Section, ChartCard, Card,
  KpiGrid,
  PaymentProgress,
  PieChart,
  StackedBarChart,
  HorizontalBarChart,
  DonutChart,
  RefreshButton,
} from "@/components/Functions";

export default function SalairesClient({
  fiches,
  demandes,
  onRefresh,
  refreshing,
  onValiderDemande,
  onPayerDemande,
  onDeleteDemande,
}: {
  fiches: SalarieDTO[];
  demandes: DemandePaieDTO[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onValiderDemande?: (id: string) => Promise<void>;
  onPayerDemande?: (id: string, mode: DemModePaiement) => Promise<void>;
  onDeleteDemande?: (id: string) => Promise<void>;
}) {
  const h = useMemo(
    () => hydrate<FichePaie, SalairesHydrated>(fiches as unknown as FichePaie[], salairesHydrationConfig),
    [fiches]
  );
  const [search, setSearch] = useState("");
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [choosingModeId, setChoosingModeId] = useState<string | null>(null);
  const [changingModeId, setChangingModeId] = useState<string | null>(null);
  const [modeSubmitting, setModeSubmitting] = useState(false);
  const [modeError, setModeError] = useState<string | null>(null);
  const [modeNotice, setModeNotice] = useState<string | null>(null);
  const [demandeActioningId, setDemandeActioningId] = useState<string | null>(null);
  const [choosingDemandeMode, setChoosingDemandeMode] = useState<string | null>(null);

  const filtered = search
    ? fiches.filter(f =>
      f.reference.toLowerCase().includes(search.toLowerCase()) ||
      (f.employe ? `${f.employe.nom} ${f.employe.prenom}`.toLowerCase().includes(search.toLowerCase()) : f.employeId.toLowerCase().includes(search.toLowerCase()))
    )
    : fiches;

  const runAction = async (id: string) => {
    setActioningId(id);
    setActionError(null);
    try {
      await validerSalarie(id);
      onRefresh?.();
    } catch {
      setActionError("Action impossible");
    } finally {
      setActioningId(null);
    }
  };

  const runPayer = async (modePaiement: ModePaiement) => {
    if (!choosingModeId) return;
    setModeSubmitting(true);
    setModeError(null);
    try {
      await payerSalarie(choosingModeId, modePaiement);
      setChoosingModeId(null);
      onRefresh?.();
    } catch (err) {
      setModeError(extractApiErrorMessage(err, "Paiement impossible."));
    } finally {
      setModeSubmitting(false);
    }
  };

  const runChangeMode = async (modePaiement: ModePaiement) => {
    if (!changingModeId) return;
    setModeSubmitting(true);
    setModeError(null);
    try {
      const res = await changerModePaiement("FICHE_PAIE", changingModeId, modePaiement);
      setChangingModeId(null);
      setModeNotice(res.avertissement ?? null);
      onRefresh?.();
    } catch (err) {
      setModeError(extractApiErrorMessage(err, "Modification impossible."));
    } finally {
      setModeSubmitting(false);
    }
  };

  const ficheEnCours = fiches.find(f => f.id === (choosingModeId ?? changingModeId));

  const runValiderDemande = async (id: string) => {
    setDemandeActioningId(id);
    try { await onValiderDemande?.(id); } catch { } finally { setDemandeActioningId(null); }
  };

  const runPayerDemande = async (id: string, mode: DemModePaiement) => {
    setDemandeActioningId(id);
    try { await onPayerDemande?.(id, mode); } catch { } finally { setDemandeActioningId(null); setChoosingDemandeMode(null); }
  };

  const runDeleteDemande = async (id: string) => {
    setDemandeActioningId(id);
    try { await onDeleteDemande?.(id); } catch { } finally { setDemandeActioningId(null); }
  };

  return (
    <ChartJsLoader>
      <div className="bg-surface-page dark:bg-surface-page-dark min-h-full py-6 px-4 sm:px-6 lg:px-8">

        <ModePaiementDialog
          open={choosingModeId !== null}
          subtitle={ficheEnCours ? `Fiche de paie ${ficheEnCours.reference}` : undefined}
          submitting={modeSubmitting}
          error={modeError}
          onConfirm={runPayer}
          onCancel={() => { setChoosingModeId(null); setModeError(null); }}
        />

        <ModePaiementDialog
          open={changingModeId !== null}
          title="Modifier le mode de paiement"
          subtitle={ficheEnCours ? `Fiche de paie ${ficheEnCours.reference}` : undefined}
          current={ficheEnCours?.modePaiement}
          submitting={modeSubmitting}
          error={modeError}
          onConfirm={runChangeMode}
          onCancel={() => { setChangingModeId(null); setModeError(null); }}
        />

        {modeNotice && (
          <div
            role="status"
            className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
          >
            <span>{modeNotice}</span>
            <button onClick={() => setModeNotice(null)} aria-label="Fermer" className="shrink-0 font-semibold opacity-70 hover:opacity-100 transition-opacity">✕</button>
          </div>
        )}

        <div className="flex justify-end mb-6">
          {onRefresh && <RefreshButton onClick={onRefresh} loading={refreshing} />}
        </div>

        {/* ── Demandes de Paie ── */}
        <Section title="Historique & Paiements de la Main-d'œuvre">
          <Card>
            <DemandesPaieTable
              demandes={demandes}
              actioningId={demandeActioningId}
              choosingModeId={choosingDemandeMode}
              onSetChoosingMode={setChoosingDemandeMode}
              onValider={runValiderDemande}
              onPayer={runPayerDemande}
              onDelete={runDeleteDemande}
            />
          </Card>
        </Section>

        {/* ── Charts & Fiches ── */}
        <Section title="Vue d'ensemble — Fiches de paie">
          <KpiGrid kpis={h.kpis} />
        </Section>

        <Section title="Avancement des virements">
          <PaymentProgress data={h.progress} />
        </Section>

        <Section title="Répartition de la masse salariale">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Masse brute par département">
              <PieChart data={h.masseSalarialeParDept} />
            </ChartCard>
            <ChartCard title="Gains vs retenues par employé">
              <StackedBarChart data={h.gainsVsRetenues} />
            </ChartCard>
          </div>
        </Section>

        <Section title="Statuts & top salaires">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ChartCard title="Statuts des fiches" className="sm:col-span-1">
              <DonutChart data={h.statutsFiches} />
            </ChartCard>
            <ChartCard title="Salaires nets" className="sm:col-span-2">
              <HorizontalBarChart data={h.topSalaires} />
            </ChartCard>
          </div>
        </Section>

        <Section title="Liste des fiches de paie">
          <Card>
            <div className="px-4 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <input
                type="text"
                placeholder="Rechercher par référence ou employé…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-80 px-4 py-2 text-sm rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark text-content-primary dark:text-content-primary-dark placeholder:text-content-muted/50 focus:outline-none focus:ring-2 focus:ring-accent/40 transition-shadow"
              />
              {actionError && <p className="text-xs text-red-500">{actionError}</p>}
            </div>
            <FichesTable
              fiches={filtered}
              actioningId={actioningId}
              onAction={runAction}
              onChooseMode={setChoosingModeId}
              onChangeMode={setChangingModeId}
            />
          </Card>
        </Section>

      </div>
    </ChartJsLoader>
  );
}

// ── Demandes de Paie Table ────────────────────────────────────────────────────

const STATUT_STYLE: Record<DemandePaieDTO["statut"], { bg: string; text: string; dot: string; label: string }> = {
  SOUMISE:  { bg: "bg-amber-100 dark:bg-amber-900/30",  text: "text-amber-700 dark:text-amber-400",  dot: "#d97706", label: "Soumise" },
  VALIDEE:  { bg: "bg-blue-100 dark:bg-blue-900/30",    text: "text-blue-700 dark:text-blue-400",    dot: "#2563eb", label: "Validée" },
  PAYEE:    { bg: "bg-green-100 dark:bg-green-900/30",  text: "text-green-700 dark:text-green-400",  dot: "#16a34a", label: "Payée" },
};

function DemandesPaieTable({
  demandes,
  actioningId,
  choosingModeId,
  onSetChoosingMode,
  onValider,
  onPayer,
  onDelete,
}: {
  demandes: DemandePaieDTO[];
  actioningId: string | null;
  choosingModeId: string | null;
  onSetChoosingMode: (id: string | null) => void;
  onValider: (id: string) => void;
  onPayer: (id: string, mode: DemModePaiement) => void;
  onDelete: (id: string) => void;
}) {
  if (demandes.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-content-muted dark:text-content-muted-dark">Aucune demande de paie. Utilisez le bouton «&nbsp;Émettre une Demande de Paie&nbsp;» pour commencer.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[750px]">
        <thead>
          <tr className="border-b-2 border-edge-default dark:border-edge-default-dark">
            {["DATE ÉMISSION", "DÉSIGNATION / PÉRIODE", "AFFECTATION & IMPUTATION BPU", "MONTANT (NET)", "STATUT", "ACTIONS"].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {demandes.map(d => {
            const style = STATUT_STYLE[d.statut];
            const busy = actioningId === d.id;
            return (
              <tr key={d.id} className="border-b border-edge-subtle dark:border-edge-subtle-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors">
                <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark whitespace-nowrap text-xs">
                  {new Date(d.createdAt).toLocaleDateString("fr-MA")}
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-content-primary dark:text-content-primary-dark">{d.libelle}</p>
                  <p className="text-xs text-content-muted dark:text-content-muted-dark mt-0.5">{d.periode}</p>
                </td>
                <td className="px-3 py-3">
                  {d.chantierNom ? (
                    <>
                      <p className="text-content-primary dark:text-content-primary-dark">{d.chantierNom}</p>
                      {d.bpuLigneRef && <p className="text-xs text-accent mt-0.5">BPU: {d.bpuLigneRef}</p>}
                    </>
                  ) : (
                    <p className="text-content-muted dark:text-content-muted-dark text-xs">Siège (global)</p>
                  )}
                </td>
                <td className="px-3 py-3 font-semibold text-content-primary dark:text-content-primary-dark whitespace-nowrap">
                  {d.montantNet.toLocaleString("fr-FR")} MAD
                </td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
                    {style.label}
                  </span>
                  {d.statut === "PAYEE" && d.modePaiement && (
                    <p className="text-[10px] text-content-muted dark:text-content-muted-dark mt-0.5">
                      {d.modePaiement === "CAISSE" ? "✓ Payé (caisse)" : "✓ Payé (virement)"}
                    </p>
                  )}
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {d.statut === "SOUMISE" && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => onValider(d.id)} disabled={busy} className="px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent/90 disabled:opacity-50 rounded-lg transition-colors">
                        {busy ? "…" : "Valider"}
                      </button>
                      <button onClick={() => onDelete(d.id)} disabled={busy} className="px-2.5 py-1.5 text-xs font-semibold text-red-600 border border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 rounded-lg transition-colors">
                        {busy ? "…" : "✕"}
                      </button>
                    </div>
                  )}
                  {d.statut === "VALIDEE" && choosingModeId !== d.id && (
                    <button onClick={() => onSetChoosingMode(d.id)} disabled={busy} className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg transition-colors">
                      {busy ? "…" : "Payer"}
                    </button>
                  )}
                  {d.statut === "VALIDEE" && choosingModeId === d.id && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-content-muted dark:text-content-muted-dark">Via :</span>
                      <button onClick={() => onPayer(d.id, "VIREMENT")} disabled={busy} className="px-2.5 py-1 text-xs font-semibold text-accent border border-accent/30 rounded-lg hover:bg-accent/5 disabled:opacity-50 transition-colors">{busy ? "…" : "Virement"}</button>
                      <button onClick={() => onPayer(d.id, "CAISSE")} disabled={busy} className="px-2.5 py-1 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 transition-colors">{busy ? "…" : "Caisse"}</button>
                      <button onClick={() => onSetChoosingMode(null)} disabled={busy} className="text-xs text-content-muted hover:text-content-primary transition-colors">✕</button>
                    </div>
                  )}
                  {d.statut === "PAYEE" && (
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">✓ Terminé</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Fiches de Paie Table ──────────────────────────────────────────────────────

function FichesTable({
  fiches,
  actioningId,
  onAction,
  onChooseMode,
  onChangeMode,
}: {
  fiches: SalarieDTO[];
  actioningId: string | null;
  onAction: (id: string) => void;
  onChooseMode: (id: string | null) => void;
  onChangeMode: (id: string | null) => void;
}) {
  if (fiches.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-sm text-content-muted dark:text-content-muted-dark">Aucune fiche de paie trouvée.</p>
      </div>
    );
  }

  const statutStyle: Record<SalarieDTO["statut"], { bg: string; text: string; dot: string; label: string }> = {
    BROUILLON: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", dot: "#6b7280", label: "Brouillon" },
    VALIDE: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", dot: "#2563eb", label: "Validée" },
    PAYEE: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-400", dot: "#16a34a", label: "Payée" },
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b-2 border-edge-default dark:border-edge-default-dark">
            {["Référence", "Employé", "Période", "Salaire base", "Net à payer", "Statut", "Actions"].map(h => (
              <th key={h} className="text-left px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-content-muted dark:text-content-muted-dark whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fiches.map(f => {
            const style = statutStyle[f.statut] ?? statutStyle.BROUILLON;
            const isBusy = actioningId === f.id;
            return (
              <tr key={f.id} className="border-b border-edge-subtle dark:border-edge-subtle-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark transition-colors duration-150">
                <td className="px-3 py-3 font-mono text-xs font-semibold text-accent whitespace-nowrap">{f.reference}</td>
                <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark">
                  {f.employe ? `${f.employe.nom} ${f.employe.prenom}` : f.employeId}
                </td>
                <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark whitespace-nowrap">{f.periode}</td>
                <td className="px-3 py-3 text-content-secondary dark:text-content-secondary-dark whitespace-nowrap">{f.salaireBase.toLocaleString("fr-FR")} MAD</td>
                <td className="px-3 py-3 font-medium text-content-primary dark:text-content-primary-dark whitespace-nowrap">{f.netAPayer.toLocaleString("fr-FR")} MAD</td>
                <td className="px-3 py-3">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${style.bg} ${style.text}`}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: style.dot }} />
                    {style.label}
                  </span>
                </td>
                <td className="px-3 py-3 whitespace-nowrap">
                  {f.statut === "BROUILLON" && (
                    <button onClick={() => onAction(f.id)} disabled={isBusy} className="px-3 py-1.5 text-xs font-semibold text-accent border border-accent/30 rounded-lg hover:bg-accent/5 disabled:opacity-50 transition-colors">
                      {isBusy ? "…" : "Valider"}
                    </button>
                  )}
                  {f.statut === "VALIDE" && (
                    <button onClick={() => onChooseMode(f.id)} disabled={isBusy} className="px-3 py-1.5 text-xs font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 transition-colors">
                      {isBusy ? "…" : "Payer"}
                    </button>
                  )}
                  {f.statut === "PAYEE" && (
                    <div className="flex items-center gap-2">
                      <ModePaiementBadge mode={f.modePaiement} />
                      <button onClick={() => onChangeMode(f.id)} disabled={isBusy} className="text-xs text-accent font-semibold hover:underline disabled:opacity-50">
                        Modifier
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
