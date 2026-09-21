@AGENTS.md

# Langue

**Le code est en anglais. L'interface est en français.**

La frontière passe exactement là : tout ce qu'un utilisateur lit est en
français, tout ce qu'un développeur lit est en anglais.

En anglais, sans exception :

- noms de fichiers et de dossiers
- noms de fonctions, de composants, de types, de constantes
- noms de variables et de paramètres, y compris les variables locales
- commentaires et blocs de documentation
- noms de tests et messages d'assertion

En français, parce que ça s'affiche :

- libellés, titres, boutons, textes d'aide
- messages d'alerte et d'erreur montrés à l'utilisateur
- annonces vocales
- noms de séances, d'unités, de mesures visibles

Une variable locale nommée `chemin`, `fichier` ou `suivant` est une erreur,
même si elle ne sort jamais de sa fonction. Un `Alert.alert("Import
impossible", …)` est correct.

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
