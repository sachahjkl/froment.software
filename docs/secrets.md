# Profils de secrets

SecretSpec déclare les secrets dans `secretspec.toml`. SOPS chiffre leurs valeurs avec la clé age définie dans `.sops.yaml`.

| Profil        | Fichier                                     |
| ------------- | ------------------------------------------- |
| `development` | `secrets/froment-software/development.yaml` |
| `production`  | `secrets/froment-software/production.yaml`  |

## Résolution

Les secrets d’authentification restent propres à chaque profil. Une valeur manquante bloque le lancement du profil.

Chaque profil lit uniquement son fichier SOPS. Aucun repli entre profils n’est configuré.
Renseignez les clés des prestataires dans chaque fichier où elles sont nécessaires.
Les identifiants de prestataires restent facultatifs tant que les adaptateurs ne sont pas activés.
La clé `SUPPLIER_INVOICE_ANALYSIS_API_KEY` initialise l’adaptateur d’analyse quand elle existe.
L’administration peut remplacer cette clé avec `SETTINGS_ENCRYPTION_KEY` configurée.

Lors du passage en service réel, renseignez ensemble les identifiants liés : client OAuth et secret, clé Stripe et secret de webhook.

Seul le fichier chiffré de production est inclus dans l’image. Aucun déchiffrement ne se produit pendant la construction.
L’injection des clés n’active pas les opérations commerciales. Elles restent simulées.
Le parcours [Resend](resend.md) autorise un envoi de test explicite à un destinataire imposé.
Le parcours [Stripe Checkout](stripe.md) accepte uniquement une clé de test et ne crée aucun encaissement local.
Une clé Resend permet des envois réels, même dans le profil de développement.

## Développement

Modifiez les valeurs avec SOPS :

```bash
nix develop -c sops secrets/froment-software/development.yaml
```

Le champ chiffré `BOOTSTRAP_PASSWORD` contient le mot de passe initial du développement. Il n’est pas injecté dans l’application.
Son empreinte `BOOTSTRAP_PASSWORD_SCRYPT` sert à l’initialisation du premier compte.
Les clés d’authentification du développement ont été générées indépendamment de celles de production.

Après compilation et configuration d’une base locale distincte, lancez l’API avec le profil explicite :

```bash
nix develop -c secretspec --reason "Start local API" run --profile development --scope runtime -- pnpm --filter @froment/api start
```

Configurez aussi `DATABASE_PATH` et `PUBLIC_ORIGIN` pour le développement. Ne pointez pas la base locale vers les données de production.
Ne passez pas `--provider` : cette option remplace le fournisseur SOPS configuré.

## Vérification

Le contrôle Nix `secret-contract` valide la déclaration des deux profils, sans lire leurs valeurs.

Pour vérifier les valeurs locales sans les afficher :

```bash
nix develop -c secretspec --reason "Check development secrets" check --profile development --no-prompt
```
