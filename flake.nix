{
  description = "Froment Software website";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.1";
    flake-utils.url = "github:numtide/flake-utils";
    git-hooks = {
      url = "https://flakehub.com/f/cachix/git-hooks.nix/0.1";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
    git-hooks,
    ...
  }:
    flake-utils.lib.eachSystem
    [
      "x86_64-linux"
      "aarch64-linux"
    ]
    (
      system: let
        pkgs = import nixpkgs {
          inherit system;
        };
        secretspec = pkgs.secretspec;
        lib = pkgs.lib;
        packageJson = builtins.fromJSON (builtins.readFile ./package.json);
        packageDirectories =
          lib.filter (
            directory: builtins.pathExists (./packages + "/${directory}/package.json")
          ) (
            builtins.attrNames (
              lib.filterAttrs (_name: type: type == "directory") (builtins.readDir ./packages)
            )
          );
        workspaceManifests =
          map (
            directory: builtins.fromJSON (builtins.readFile (./packages + "/${directory}/package.json"))
          )
          packageDirectories;
        deploymentPackages = builtins.sort (left: right: left.name < right.name) (
          map (manifest: {
            inherit (manifest) name version;
          }) ([packageJson] ++ workspaceManifests)
        );
        deploymentMetadata = commit:
          builtins.toJSON {
            inherit commit;
            packages = deploymentPackages;
          };
        localCommit =
          if self ? rev
          then self.rev
          else if self ? dirtyRev
          then self.dirtyRev
          else "unversioned";
        inherit (packageJson) version;
        pname = packageJson.name;
        buildNode = pkgs.nodejs_26;
        runtimeNode = pkgs.nodejs-slim_26;
        caBundle = "${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt";
        pnpm = pkgs.pnpm.override {nodejs-slim = buildNode;};
        cousineFonts = pkgs.google-fonts.override {fonts = ["Cousine"];};
        documentFonts = pkgs.symlinkJoin {
          name = "froment-document-fonts";
          paths = [
            cousineFonts
            pkgs.liberation_ttf
          ];
        };
        src = lib.fileset.toSource {
          root = ./.;
          fileset = lib.fileset.unions [
            ./.editorconfig
            ./.oxfmtrc.json
            ./.oxlintrc.json
            ./package.json
            ./packages/api/drizzle
            ./packages/api/drizzle.config.ts
            ./packages/api/package.json
            ./packages/api/src
            ./packages/api/tsconfig.json
            ./packages/api/vitest.config.ts
            ./packages/contracts/package.json
            ./packages/contracts/src
            ./packages/contracts/tsconfig.json
            ./packages/documents/package.json
            ./packages/documents/src
            ./packages/documents/templates
            ./packages/documents/test
            ./packages/documents/tsconfig.json
            ./packages/l10n/package.json
            ./packages/l10n/src
            ./packages/l10n/tsconfig.json
            ./packages/web/angular.json
            ./packages/web/package.json
            ./packages/web/public
            ./packages/web/src
            ./packages/web/tools
            ./packages/web/tsconfig.app.json
            ./packages/web/tsconfig.json
            ./packages/web/tsconfig.spec.json
            ./pnpm-lock.yaml
            ./pnpm-workspace.yaml
            ./tsconfig.base.json
            ./tools
          ];
        };
        pnpmDeps = pkgs.fetchPnpmDeps {
          inherit pname version src;
          inherit pnpm;
          fetcherVersion = 4;
          hash = "sha256-za8oke2pBv0n+raZtlRBVVNHMKt4Mag4gCpucKJPqsw=";
        };
        commonPnpmAttrs = {
          inherit pname version src pnpmDeps;
          nativeBuildInputs = [
            buildNode
            pnpm
            pkgs.pnpmConfigHook
          ];
        };

        mkApplication = commit:
          pkgs.stdenv.mkDerivation (commonPnpmAttrs
            // {
              nativeBuildInputs = commonPnpmAttrs.nativeBuildInputs ++ [pkgs.makeWrapper];
              buildPhase = ''
                runHook preBuild
                pnpm build
                runHook postBuild
              '';
              installPhase = ''
                runHook preInstall
                libDir="$out/lib/${pname}"
                shareDir="$out/share/${pname}"
                mkdir -p "$out/bin" "$libDir/node_modules/@phc" "$shareDir"
                cp packages/api/dist/main.cjs "$libDir/server.cjs"
                cp packages/api/dist/migrate.cjs "$libDir/migrate.cjs"
                cp packages/api/dist/backup.cjs "$libDir/backup.cjs"
                cp -r packages/api/drizzle "$shareDir/drizzle"
                argon2Modules=$(dirname $(readlink -f packages/api/node_modules/argon2))
                cp -rL "$argon2Modules/argon2" "$libDir/node_modules/"
                cp -rL "$argon2Modules/@phc/format" "$libDir/node_modules/@phc/"
                cp -rL "$argon2Modules/node-gyp-build" "$libDir/node_modules/"
                cp -rL packages/api/node_modules/better-sqlite3 "$libDir/node_modules/"
                cp -r packages/documents/templates "$shareDir/templates"
                cp -r packages/web/dist/froment-software/browser "$shareDir/web"
                makeWrapper ${runtimeNode}/bin/node $out/bin/${pname} \
                  --add-flags "$libDir/server.cjs" \
                  --set SSL_CERT_FILE ${caBundle} \
                  --set NIX_SSL_CERT_FILE ${caBundle} \
                  --set BUSINESS_TIME_ZONE Europe/Paris \
                  --set TYPST_PATH ${pkgs.typst}/bin/typst \
                  --set DOCUMENT_TEMPLATES_PATH "$shareDir/templates" \
                  --set DOCUMENT_FONTS_PATH ${documentFonts}/share/fonts \
                  --set-default DATABASE_PATH data/froment.sqlite \
                  --set DEPLOYMENT_METADATA ${lib.escapeShellArg (deploymentMetadata commit)} \
                  --set STATIC_ROOT "$shareDir/web" \
                  --set-default PORT 3000
                makeWrapper ${runtimeNode}/bin/node $out/bin/${pname}-migrate \
                  --add-flags "$libDir/migrate.cjs" \
                  --set BUSINESS_TIME_ZONE Europe/Paris \
                  --set-default DATABASE_PATH data/froment.sqlite \
                  --set MIGRATIONS_ROOT "$shareDir/drizzle"
                cp tools/deploy.sh $out/bin/${pname}-deploy
                cp tools/prepare.sh $out/bin/${pname}-prepare
                makeWrapper ${runtimeNode}/bin/node $out/bin/${pname}-backup \
                  --add-flags "$libDir/backup.cjs" \
                  --set-default DATABASE_PATH data/froment.sqlite \
                  --set MIGRATIONS_ROOT "$shareDir/drizzle"
                chmod +x $out/bin/${pname}-deploy $out/bin/${pname}-prepare
                wrapProgram $out/bin/${pname}-prepare \
                  --prefix PATH : $out/bin:${
                  lib.makeBinPath [
                    pkgs.coreutils
                    pkgs.findutils
                    pkgs.sqlite
                  ]
                }
                runHook postInstall
              '';
            });

        mkCheck = {
          name,
          command,
          extraBuildInputs ? [],
          environment ? {},
        }:
          pkgs.stdenv.mkDerivation (commonPnpmAttrs
            // environment
            // {
              name = "${pname}-${name}";
              CI = "true";
              PNPM_CONFIG_REPORTER = "append-only";
              nativeBuildInputs = commonPnpmAttrs.nativeBuildInputs ++ extraBuildInputs;
              dontBuild = true;
              installPhase = ''
                runHook preInstall
                ${command}
                touch "$out"
                runHook postInstall
              '';
            });
        testBuildInputs = [
          cousineFonts
          pkgs.liberation_ttf
          pkgs.poppler-utils
          pkgs.typst
        ];
        testEnvironment = {
          TYPST_PATH = "${pkgs.typst}/bin/typst";
          DOCUMENT_TEMPLATES_PATH = "${./packages/documents/templates}";
          DOCUMENT_FONTS_PATH = "${documentFonts}/share/fonts";
        };

        application = mkApplication localCommit;
        mkDockerImage = imageApplication:
          pkgs.dockerTools.buildLayeredImage {
            name = pname;
            tag = version;
            contents = [
              imageApplication
              pkgs.dockerTools.fakeNss
              pkgs.cacert
            ];
            fakeRootCommands = ''
              cp --remove-destination ./etc/passwd ./etc/passwd.writable
              cp --remove-destination ./etc/group ./etc/group.writable
              mv ./etc/passwd.writable ./etc/passwd
              mv ./etc/group.writable ./etc/group
              chmod u+w ./etc/passwd ./etc/group
              echo 'froment:x:1000:1000:Froment Software:/home/froment:/bin/sh' >> ./etc/passwd
              echo 'froment:x:1000:' >> ./etc/group
              mkdir -p ./home/froment/.cache ./home/froment/.config ./tmp
              chmod 1777 ./tmp
              mkdir -p ./var/lib/froment-software
              chown -R 1000:1000 ./home/froment ./var/lib/froment-software
            '';
            config = {
              Cmd = ["${imageApplication}/bin/${pname}-deploy"];
              Env = [
                "DATABASE_PATH=/var/lib/froment-software/froment.sqlite"
                "SSL_CERT_FILE=${caBundle}"
                "NIX_SSL_CERT_FILE=${caBundle}"
                "HOME=/home/froment"
                "PATH=${lib.makeBinPath [imageApplication]}"
                "TMPDIR=/tmp"
              ];
              ExposedPorts."3000/tcp" = {};
              User = "froment";
              Volumes."/var/lib/froment-software" = {};
            };
          };
        dockerImage = mkDockerImage application;
        releaseDockerImage = mkDockerImage (
          mkApplication (
            if self ? rev
            then self.rev
            else builtins.throw "Image publication requires a clean Git revision"
          )
        );

        preCommitCheck = git-hooks.lib.${system}.run {
          package = pkgs.prek;
          src = lib.cleanSource ./.;
          hooks = {
            actionlint.enable = true;
            check-added-large-files.enable = true;
            check-case-conflicts.enable = true;
            check-json = {
              enable = true;
              excludes = [
                "^\\.vscode/"
                "^packages/web/tsconfig.*\\.json$"
              ];
            };
            check-merge-conflicts.enable = true;
            end-of-file-fixer = {
              enable = true;
              excludes = [
                "^packages/api/drizzle/"
                "^packages/web/public/fonts/OFL\\.txt$"
              ];
            };
            alejandra.enable = true;
            shellcheck = {
              enable = true;
              excludes = ["^\\.envrc$"];
            };
            trim-trailing-whitespace = {
              enable = true;
              excludes = ["^packages/web/public/fonts/OFL\\.txt$"];
            };
          };
        };
        productionClosure = let
          closure = pkgs.closureInfo {rootPaths = [application];};
        in
          pkgs.runCommand "${pname}-production-closure" {} ''
            if grep --quiet --extended-regexp --ignore-case \
              '/[^/]*(chromium|playwright)' \
              ${closure}/store-paths
            then
              echo "The production closure contains Chromium or Playwright." >&2
              exit 1
            fi
            touch "$out"
          '';
        secretContract =
          pkgs.runCommand "${pname}-secret-contract"
          {
            nativeBuildInputs = [secretspec];
          }
          ''
            export HOME="$TMPDIR"
            secretspec --file ${./secretspec.toml} schema --profile production >/dev/null
            secretspec --file ${./secretspec.toml} schema --profile development >/dev/null
            secretspec --file ${./secretspec.toml} schema --profile staging >/dev/null
            touch $out
          '';
      in {
        packages =
          {
            default = application;
            inherit dockerImage secretspec;
            cosign = pkgs.cosign;
            skopeo = pkgs.skopeo;
            syft = pkgs.syft;
          }
          // lib.optionalAttrs (self ? rev) {inherit releaseDockerImage;};

        apps.default = {
          type = "app";
          program = "${application}/bin/${pname}-deploy";
        };

        checks = {
          runtime-tls =
            pkgs.runCommand "runtime-tls-check"
            {
              nativeBuildInputs = [
                runtimeNode
                pkgs.openssl
              ];
              SSL_CERT_FILE = caBundle;
              NIX_SSL_CERT_FILE = caBundle;
            }
            ''
              node --test ${./tools/runtime-tls.spec.ts}
              touch "$out"
            '';
          node-runtime = pkgs.runCommand "node-runtime-check" {nativeBuildInputs = [runtimeNode];} ''
            node --input-type=module -e '
              import assert from "node:assert/strict";
              assert.equal(process.versions.node.split(".")[0], "26");
              assert.equal(Temporal.PlainDate.from("2026-09-06").add({ days: 1 }).toString(), "2026-09-07");
            '
            touch "$out"
          '';
          inherit dockerImage productionClosure;
          build = application;
          format = mkCheck {
            name = "format";
            command = "pnpm format:check";
          };
          lint = mkCheck {
            name = "lint";
            command = "pnpm lint";
          };
          pre-commit = preCommitCheck;
          secret-contract = secretContract;
          test = mkCheck {
            name = "test";
            command = "pnpm test";
            extraBuildInputs = testBuildInputs;
            environment = testEnvironment;
          };
        };

        devShells.default = pkgs.mkShell {
          PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = "${pkgs.chromium}/bin/chromium";
          TYPST_PATH = "${pkgs.typst}/bin/typst";
          DOCUMENT_TEMPLATES_PATH = "${./packages/documents/templates}";
          DOCUMENT_FONTS_PATH = "${documentFonts}/share/fonts";
          packages =
            preCommitCheck.enabledPackages
            ++ [
              cousineFonts
              pkgs.liberation_ttf
              buildNode
              pkgs.poppler-utils
              pnpm
              pkgs.sops
              pkgs.typst
              secretspec
            ];
          shellHook = preCommitCheck.shellHook;
        };

        formatter = pkgs.alejandra;
      }
    );
}
