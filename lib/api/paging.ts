/**
 * Parcourir un endpoint paginé jusqu'au bout.
 *
 * Les écrans qui ont besoin d'une liste complète — un sélecteur d'article, le
 * catalogue, les stocks — demandaient chacun une page unique d'une taille
 * choisie au hasard : 50 ici, 100 là, 200 ailleurs. Chacun coupait sa liste
 * sans le dire. L'écran s'arrêtait au milieu de l'alphabet, ce qui se lit
 * comme un défilement cassé plutôt que comme des données manquantes.
 *
 * Augmenter le nombre ne fait que déplacer la falaise : Spring borne `size` à
 * `max-page-size` — 2000 sauf configuration — et ne le signale pas, donc le
 * plafond suivant échouerait aussi silencieusement que le précédent.
 *
 * Aller jusqu'à la dernière page n'a pas de falaise.
 */

/**
 * La forme réellement renvoyée par le backend.
 *
 * Ce n'est pas une {@code Page<T>} de Spring : le {@code PageResponse} maison
 * porte `page`, `size`, `totalElements` et `totalPages`, et **ni `last` ni
 * `first`**. Tout code qui lisait `last` recevait donc `undefined`, et un
 * `?? true` le transformait en « c'est la dernière » — une première page sur
 * trois se déclarait complète. `totalPages` est la seule borne qui existe.
 */
export interface BackendPage<T> {
  content?: T[];
  page?: number;
  size?: number;
  totalElements?: number;
  totalPages?: number;
}

/** Combien de lignes par requête. Assez pour que la plupart tiennent en une. */
const TAILLE_DE_PAGE = 200;

/**
 * Combien de requêtes au maximum. C'est une borne sur le nombre d'appels, pas
 * un plafond de lignes : elle protège d'un backend qui renverrait un
 * `totalPages` incohérent, et couvre 10 000 lignes à cette taille de page.
 */
const LIMITE_DE_PAGES = 50;

/**
 * Appelle {@code chargerPage} page après page et concatène tout.
 *
 * S'arrête à la dernière page annoncée par `totalPages`, ou dès qu'une page
 * revient vide. Un endpoint non paginé — qui répond par un tableau nu, donc
 * sans `totalPages` — est servi en un seul appel.
 *
 * @param chargerPage reçoit l'index de page (0-based) et la taille à demander
 */
export async function chargerToutesLesPages<T>(
  chargerPage: (page: number, size: number) => Promise<BackendPage<T>>,
  tailleDePage: number = TAILLE_DE_PAGE,
): Promise<T[]> {
  const tout: T[] = [];

  for (let page = 0; page < LIMITE_DE_PAGES; page += 1) {
    const reponse = await chargerPage(page, tailleDePage);
    const lignes = Array.isArray(reponse?.content) ? reponse.content : [];
    tout.push(...lignes);

    const totalPages = reponse?.totalPages ?? 0;
    // totalPages absent ou nul : réponse non paginée, elle est sa propre
    // dernière page. Une page vide arrête aussi, au cas où le compte annoncé
    // dépasserait les données réelles.
    if (totalPages === 0 || page >= totalPages - 1 || lignes.length === 0) {
      break;
    }
  }

  return tout;
}
