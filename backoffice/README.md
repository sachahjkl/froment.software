# Instance réelle du backoffice

Ce répertoire assemble `@sachahjkl/backoffice@0.2.8` depuis npm. Le dépôt `backoffice` fournit seulement l’application générique.

`application.yaml` définit le job `backoffice` dans l’espace Nomad `production`. L’image utilise Node.js 26, Typst et le paquet npm publié. `ENTERPRISE_NAME=Froment Software` configure le nom affiché. Le volume `backoffice-production-data` est distinct de l’ancien volume `froment-software-production-data`.

La tâche `prepare` exige une base existante. Elle produit une sauvegarde SQLite, contrôle son intégrité et ses clés étrangères, puis applique les migrations du paquet. Le serveur démarre après la réussite de cette tâche.

Pour une migration depuis l’ancien job `froment-software`, vérifiez une sauvegarde avec son ancienne image avant de l’arrêter. Déployez d’abord la vitrine indépendante de la base. Attendez l’arrêt de l’ancienne allocation, puis transférez une dernière sauvegarde cohérente dans le nouveau volume. Les secrets métier résident dans `nomad/jobs/backoffice` dans l’espace `production`.

Lancez `.github/workflows/backoffice-production.yml` depuis `master` après le transfert. Ce workflow utilise le déploiement partagé et publie l’image par digest. Vérifiez ensuite `/api/health`, la connexion, les documents et les intégrations sur `backoffice.froment.software`.
