"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The payment mode of a settled document. Shared by Achats, Salaires and
 * Paiements sous-traitants so the choice reads identically everywhere.
 *
 * Only CAISSE moves the chantier's cash balance — the other three settle
 * through the bank.
 */
export type ModePaiement = "VIREMENT" | "CHEQUE" | "EFFET" | "CAISSE";

export const MODE_PAIEMENT_OPTIONS: {
  value: ModePaiement;
  label: string;
  hint: string;
}[] = [
  { value: "VIREMENT", label: "Virement", hint: "Transfert bancaire" },
  { value: "CHEQUE", label: "Chèque", hint: "Règlement par chèque" },
  { value: "EFFET", label: "Effet", hint: "Effet de commerce / lettre de change" },
  { value: "CAISSE", label: "Caisse", hint: "Espèces — débite la caisse du chantier" },
];

export const MODE_PAIEMENT_LABELS: Record<ModePaiement, string> = {
  VIREMENT: "Virement",
  CHEQUE: "Chèque",
  EFFET: "Effet",
  CAISSE: "Caisse",
};

/** Renders a stored mode, including the legacy CAISSE value on old records. */
export function ModePaiementBadge({ mode }: { mode?: ModePaiement | null }) {
  if (!mode) {
    return <span className="text-xs text-content-muted dark:text-content-muted-dark">—</span>;
  }
  const isCaisse = mode === "CAISSE";
  return (
    <span
      title={isCaisse ? "Réglé en espèces via la caisse du chantier" : undefined}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
        isCaisse
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
          : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
      }`}
    >
      {MODE_PAIEMENT_LABELS[mode]}
    </span>
  );
}

/**
 * Modal for choosing a payment mode.
 *
 * Nothing is pre-selected unless `current` is supplied, so "Confirmer" stays
 * disabled until the user makes a deliberate choice — CAISSE is no longer the
 * default that happens by accident.
 */
export function ModePaiementDialog({
  open,
  title = "Choisir le mode de paiement",
  subtitle,
  current,
  resteAPayer,
  submitting = false,
  error,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title?: string;
  subtitle?: string;
  current?: ModePaiement | null;
  /**
   * Ce qu'il reste à régler. Fourni, le dialogue propose un montant modifiable
   * et autorise un règlement partiel ; absent, il se contente du mode.
   */
  resteAPayer?: number;
  submitting?: boolean;
  error?: string | null;
  onConfirm: (mode: ModePaiement, montant?: number) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState<ModePaiement | null>(current ?? null);
  const [montant, setMontant] = useState<string>("");
  const panelRef = useRef<HTMLDivElement>(null);

  // Par défaut on solde : le montant proposé est le reste entier. Le saisir à
  // la baisse est un geste délibéré, pas un oubli.
  useEffect(() => {
    if (open) setMontant(resteAPayer !== undefined ? String(resteAPayer) : "");
  }, [open, resteAPayer]);

  const montantNum = Number(montant);
  const montantInvalide =
    resteAPayer !== undefined &&
    (!montant.trim() || Number.isNaN(montantNum) || montantNum <= 0 || montantNum > resteAPayer);

  // Reset to the document's own mode each time the dialog is opened, so a
  // previous choice never leaks into the next document.
  useEffect(() => {
    if (open) setSelected(current ?? null);
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, submitting, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={() => !submitting && onCancel()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark p-5 shadow-xl focus:outline-none"
      >
        <h2 className="text-base font-bold text-content-primary dark:text-content-primary-dark">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 text-xs text-content-muted dark:text-content-muted-dark">{subtitle}</p>
        )}

        {resteAPayer !== undefined && (
          <div className="mt-4">
            <label
              htmlFor="montant-reglement"
              className="block text-xs font-semibold text-content-primary dark:text-content-primary-dark"
            >
              Montant à régler
            </label>
            <input
              id="montant-reglement"
              type="number"
              step="0.01"
              min="0"
              max={resteAPayer}
              value={montant}
              disabled={submitting}
              onChange={(e) => setMontant(e.target.value)}
              className="mt-1 w-full rounded-lg border border-edge-subtle dark:border-edge-subtle-dark bg-surface-page dark:bg-surface-page-dark px-3 py-2 text-sm text-content-primary dark:text-content-primary-dark focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <p className="mt-1 text-[11px] text-content-muted dark:text-content-muted-dark">
              Reste à payer : {resteAPayer.toLocaleString("fr-MA", { maximumFractionDigits: 2 })} MAD.
              Un montant inférieur laisse la commande en facturé, avec le solde encore dû.
            </p>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {MODE_PAIEMENT_OPTIONS.map((opt) => {
            const isSelected = selected === opt.value;
            return (
              <label
                key={opt.value}
                className={`flex items-start gap-3 cursor-pointer select-none rounded-lg border px-3 py-2.5 transition-colors ${
                  isSelected
                    ? "border-accent bg-accent/5"
                    : "border-edge-subtle dark:border-edge-subtle-dark hover:bg-surface-hover dark:hover:bg-surface-hover-dark"
                }`}
              >
                <input
                  type="radio"
                  name="mode-paiement"
                  value={opt.value}
                  checked={isSelected}
                  disabled={submitting}
                  onChange={() => setSelected(opt.value)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent cursor-pointer"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-content-primary dark:text-content-primary-dark">
                    {opt.label}
                  </span>
                  <span className="block text-[11px] text-content-muted dark:text-content-muted-dark">
                    {opt.hint}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {error && <p className="mt-3 text-xs text-red-500">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-content-muted hover:text-content-primary disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => selected && onConfirm(selected, resteAPayer !== undefined ? montantNum : undefined)}
            disabled={submitting || !selected || montantInvalide}
            className="px-5 py-2 text-sm font-semibold text-white bg-accent hover:bg-accent/90 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Enregistrement…" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
