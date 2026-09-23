@AGENTS.md
@DESIGN.md

# Design

Toute interface nouvelle ou modifiée suit `DESIGN.md` : les couleurs de
`colors`, l'échelle typographique, la gouttière de 20, et d'abord les
composants existants (`SummaryBanner`, `SectionHeader`, `HeaderButton`,
`EmptyState`, `SettingsGroup`, `SettingRow`…) avant tout style nouveau. Deux
écrans qui se ressemblent sont construits avec les mêmes pièces. Si un besoin
n'est couvert par aucun composant, on crée le composant, puis on le documente
dans `DESIGN.md`.

# Langue

**Le code est en anglais. L'interface est en français et en anglais.**

La frontière passe exactement là : tout ce qu'un utilisateur lit existe dans
les deux langues, tout ce qu'un développeur lit est en anglais.

En anglais, sans exception :

- noms de fichiers et de dossiers
- noms de fonctions, de composants, de types, de constantes
- noms de variables et de paramètres, y compris les variables locales
- commentaires et blocs de documentation
- noms de tests et messages d'assertion
- valeurs stockées ou comparées : identifiants, unions de types (`"fast"`,
  `"threshold"`), clés de réglages — même quand elles finissent affichées

En français **et** en anglais, parce que ça s'affiche :

- libellés, titres, boutons, textes d'aide
- messages d'alerte et d'erreur montrés à l'utilisateur
- annonces vocales, notifications
- noms de séances, d'unités, de mesures visibles

Aucun texte affiché n'est écrit en dur. Il vit dans une table
`defineStrings({ fr, en })` (`src/lib/i18n.ts`), déclarée à côté du code qui
l'affiche, et se lit avec `useStrings(table)` dans un composant ou `table()`
ailleurs. Le français est écrit d'abord, l'anglais le suit clé pour clé — le
typage refuse une table à laquelle il manque une langue. Les nombres passent
par `decimal()`, les dates par `intlLocale()`, jamais par `"fr-FR"` en dur.

Un nom affiché se calcule depuis un identifiant (`sessionName(session)`,
`kindName(kind)`), il ne se lit pas depuis une chaîne stockée : ce qui est en
base doit rester lisible quelle que soit la langue choisie plus tard.

Une variable locale nommée `chemin`, `fichier` ou `suivant` est une erreur,
même si elle ne sort jamais de sa fonction. Un `Alert.alert("Import
impossible", …)` l'est aussi désormais : le titre doit venir d'une table,
`Alert.alert(s.importFailed, …)`.

# Messages de commit

Format **Conventional Commits**, en **anglais**, en **minuscules**.

```
type(portée): sujet
```

- `type` : `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `chore`
- `portée` : le morceau touché, en un mot — `tracker`, `map`, `gpx`, `health`,
  `widget`, `theme`, `icon`. Facultative quand le changement traverse tout.
- `sujet` : à l'impératif, minuscule, sans point final, sous 72 caractères

Le corps du message, s'il y en a un, est en anglais lui aussi, et explique
*pourquoi* plutôt que *quoi* — le diff dit déjà quoi.

```
fix(gpx): read files opened in place without deleting the original
feat(workout): announce interval blocks aloud
refactor(theme): resolve colours per appearance at draw time
```

Jamais de ligne `Co-authored-by`, ni aucune autre signature d'outil. Le
dépôt appartient à une personne, et l'historique doit le refléter.
