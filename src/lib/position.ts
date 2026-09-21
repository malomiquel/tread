import * as Location from "expo-location";
import { useEffect, useState } from "react";

export interface Coordonnees {
  lat: number;
  lng: number;
}

export interface PositionInitiale {
  position: Coordonnees | null;
  /** Null tant que l'autorisation n'a pas ete tranchee. */
  autorisee: boolean | null;
}

/**
 * Position actuelle, pour centrer la carte des l'arrivee sur l'ecran plutot
 * que d'afficher un fond de carte au milieu de nulle part.
 *
 * Le relevé se fait en deux temps. La derniere position connue du systeme
 * revient instantanement, sans allumer le GPS : la carte saute tout de suite
 * au bon quartier. Un vrai releve affine ensuite le centrage une seconde ou
 * deux plus tard, quand la puce a eu le temps d'accrocher les satellites.
 *
 * L'autorisation est demandee ici, a l'ouverture, et non au depart de la
 * course : une carte qui ne sait pas ou tu es n'a aucun interet.
 */
/**
 * Releve ponctuel, pour le bouton de recentrage.
 *
 * Contrairement au hook, l'autorisation n'est redemandee que si elle n'a pas
 * deja ete accordee : appuyer sur le bouton ne doit pas relancer une
 * demande systeme a chaque fois.
 */
export async function relevePosition(): Promise<Coordonnees | null> {
  const dejaAccordee = await Location.getForegroundPermissionsAsync();
  if (dejaAccordee.status !== "granted") {
    const demande = await Location.requestForegroundPermissionsAsync();
    if (demande.status !== "granted") return null;
  }
  const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { lat: p.coords.latitude, lng: p.coords.longitude };
}

export function usePositionInitiale(): PositionInitiale {
  const [position, setPosition] = useState<Coordonnees | null>(null);
  const [autorisee, setAutorisee] = useState<boolean | null>(null);

  useEffect(() => {
    let actif = true;

    const relever = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!actif) return;
      if (status !== "granted") {
        setAutorisee(false);
        return;
      }
      setAutorisee(true);

      const connue = await Location.getLastKnownPositionAsync();
      if (actif && connue) {
        setPosition({ lat: connue.coords.latitude, lng: connue.coords.longitude });
      }

      const precise = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (actif) {
        setPosition({ lat: precise.coords.latitude, lng: precise.coords.longitude });
      }
    };

    // Un echec ici n'est pas bloquant : la carte reste sur son cadrage par
    // defaut et la course reste possible, le depart redemandera l'autorisation.
    relever().catch(() => {
      if (actif) setAutorisee(false);
    });

    return () => {
      actif = false;
    };
  }, []);

  return { position, autorisee };
}
