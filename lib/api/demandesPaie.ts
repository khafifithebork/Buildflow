import apiClient, { toArrayPayload, unwrapApiPayload } from "./client";

export type DemandePaieStatut = "SOUMISE" | "VALIDEE" | "PAYEE";
export type ModePaiement = "VIREMENT" | "CAISSE";

export interface DemandePaieDTO {
  id: string;
  reference: string;
  libelle: string;
  periode: string;
  chantierId?: string;
  chantierNom?: string;
  bpuLigneId?: string;
  bpuLigneRef?: string;
  montantNet: number;
  statut: DemandePaieStatut;
  modePaiement?: ModePaiement;
  createdAt: string;
}

export interface CreateDemandePaieDTO {
  libelle: string;
  periode: string;
  chantierId?: string;
  bpuLigneId?: string;
  montantNet: number;
}

export async function fetchDemandesPaie(periode?: string): Promise<DemandePaieDTO[]> {
  const { data } = await apiClient.get<unknown>("/demandes-paie", {
    params: periode ? { periode } : {},
  });
  return toArrayPayload<DemandePaieDTO>(data);
}

export async function createDemandePaie(payload: CreateDemandePaieDTO): Promise<DemandePaieDTO> {
  const { data } = await apiClient.post<unknown>("/demandes-paie", payload);
  return unwrapApiPayload<DemandePaieDTO>(data);
}

export async function validerDemandePaie(id: string): Promise<DemandePaieDTO> {
  const { data } = await apiClient.patch<unknown>(`/demandes-paie/${id}/valider`);
  return unwrapApiPayload<DemandePaieDTO>(data);
}

export async function payerDemandePaie(id: string, modePaiement: ModePaiement): Promise<DemandePaieDTO> {
  const { data } = await apiClient.patch<unknown>(`/demandes-paie/${id}/payer`, { modePaiement });
  return unwrapApiPayload<DemandePaieDTO>(data);
}

export async function deleteDemandePaie(id: string): Promise<void> {
  await apiClient.delete(`/demandes-paie/${id}`);
}
