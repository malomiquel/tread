# Running

Application de course à pied avec enregistrement GPS en direct : distance,
durée, allure instantanée et moyenne, trace sur carte, fractionnés au
kilomètre, historique local. Expo SDK 57, React Native, TypeScript.

## Lancer sur ton téléphone

```bash
npm install
npx expo start
```

Scanne le QR code avec Expo Go. Tout fonctionne : GPS, carte, base locale.
Une seule limite, l'écran doit rester allumé pendant la course, l'app s'en
charge. Le GPS s'arrête avec l'écran dans Expo Go, c'est une contrainte du
système, pas de l'app.

## Obtenir le suivi écran verrouillé

Expo Go ne propose pas la localisation en arrière-plan. Il faut un
« development build », une version de l'app qui embarque les modules natifs.
Sans Xcode sur la machine, il se fabrique dans le nuage :

```bash
npm install -g eas-cli
eas login
eas build --profile development --platform ios
```

Installe le résultat sur ton téléphone, puis `npx expo start` comme avant.
L'app détecte d'elle-même que l'arrière-plan est disponible et bascule dessus.
Tout est déjà configuré dans `app.json` : mode d'arrière-plan iOS, textes des
demandes d'autorisation, service de premier plan Android.

## Vérifier sans appareil

```bash
npm test          # calculs GPS, 9 tests
npm run typecheck
npx expo lint
npx expo-doctor
```

## Architecture

```
src/lib/geo.ts        distance, filtrage, allure, fractionnés   pur, testé
src/lib/suivi.ts      le traqueur : GPS, pauses, sauvegarde       magasin observable
src/lib/bd.ts         SQLite local, migrations, reprise après plantage
src/lib/format.ts     durée, allure, distance à la française
src/app/(onglets)/    Courir, Historique
src/app/course/[id]   détail d'une course
src/components/Carte  trace sur Apple Plans ou Google Maps
```

## Décisions qui comptent

**Le GPS ment, on le filtre.** Un point dont l'incertitude dépasse 30 m est
ignoré, typique d'un départ en intérieur. Un point qui impliquerait plus de
43 km/h est un saut GPS, pas un coureur. Un déplacement sous 1,5 m est du
bruit à l'arrêt. Sans ces trois règles, une course de 5 km en affiche 5,8 et
le tracé zigzague dans les immeubles.

**Une pause coupe la trace.** Chaque reprise ouvre un nouveau segment. La
distance ne relie jamais deux segments, sinon les 200 m marchés jusqu'au feu
compteraient. La carte dessine une polyligne par segment, et les fractionnés
travaillent en temps actif : une pause au kilomètre 3 n'allonge pas le
kilomètre 3.

**Les bornes sont interpolées.** Le passage du kilomètre tombe entre deux
points GPS. Arrondir au point le plus proche décale chaque temps de plusieurs
secondes. On interpole à l'intérieur du segment qui franchit la borne.

**L'allure instantanée lit 30 secondes.** Point à point, elle saute de 4'10 à
6'30 à chaque relevé. Sur 30 s, elle reste lisible et réagit quand même à un
changement de rythme en une dizaine de secondes.

**Rien ne se perd.** La course est créée en base au départ, et les points
sont écrits par lots de vingt. Si le système tue l'app au kilomètre 8, les
points sont sur disque : au prochain lancement, la course est reconstituée
et close avec ses vrais totaux.

**Deux couches GPS, un seul flux.** En build, la tâche de fond reçoit les
positions même écran verrouillé. Dans Expo Go, un abonnement de premier plan
prend le relais. Les deux appellent la même fonction, le reste de l'app ne
sait pas laquelle est active.

## Limites connues

- **Expo Go** : suivi écran allumé seulement, voir plus haut.
- **Pas de synchronisation** : les courses restent sur le téléphone. La couche
  base est isolée dans un fichier, prête pour Supabase.
- **Pas de fréquence cardiaque** : il faudrait Apple Santé ou une ceinture.
- **Android hors Expo Go** : Google Maps demande une clé d'API dans `app.json`.

## Suite possible

1. Progression : volume hebdomadaire, records, évolution de l'allure.
2. Import Apple Santé pour les courses faites avec une montre.
3. Synchronisation Supabase et sauvegarde.
4. Détection automatique des pauses aux feux rouges.
