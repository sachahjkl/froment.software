{
  description = "Froment Software website";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
    git-hooks = {
      url = "github:cachix/git-hooks.nix";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
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
        system:
        let
          pkgs = import nixpkgs { inherit system; };
          lib = pkgs.lib;
          packageJson = builtins.fromJSON (builtins.readFile ./package.json);
          packageDirectories = builtins.attrNames (
            lib.filterAttrs (_name: type: type == "directory") (builtins.readDir ./packages)
          );
          workspacePackages = map (
            directory: builtins.fromJSON (builtins.readFile (./packages + "/${directory}/package.json"))
          ) packageDirectories;
          deploymentMetadata =
            commit:
            builtins.toJSON {
              inherit commit;
              packages = builtins.sort (left: right: left.name < right.name) (
                map (manifest: {
                  inherit (manifest) name version;
                }) ([ packageJson ] ++ workspacePackages)
              );
            };
          localCommit =
            if self ? rev then
              self.rev
            else if self ? dirtyRev then
              self.dirtyRev
            else
              "unversioned";
          inherit (packageJson) version;
          pname = packageJson.name;
          runtimeNode = pkgs.nodejs-slim_22;
          cousineFonts = pkgs.google-fonts.override { fonts = [ "Cousine" ]; };
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
              ./packages
              ./pnpm-lock.yaml
              ./pnpm-workspace.yaml
              ./tsconfig.base.json
              ./tools
            ];
          };
          pnpmDeps = pkgs.fetchPnpmDeps {
            inherit pname version src;
            pnpm = pkgs.pnpm;
            fetcherVersion = 4;
            hash = "sha256-utK6HsJLppbJZzF6Uuc7yQmjDCOp3oioeo+IUr0M4P4=";
          };

          mkApplication =
            commit:
            pkgs.stdenv.mkDerivation {
              inherit
                pname
                version
                src
                pnpmDeps
                ;
              nativeBuildInputs = [
                pkgs.nodejs_22
                pkgs.pnpm
                pkgs.pnpmConfigHook
                pkgs.makeWrapper
              ];
              buildPhase = ''
                runHook preBuild
                pnpm build
                runHook postBuild
              '';
              installPhase = ''
                runHook preInstall
                mkdir -p $out/bin $out/lib/froment-software/node_modules $out/share/froment-software
                cp packages/api/dist/main.cjs $out/lib/froment-software/server.cjs
                cp packages/api/dist/migrate.cjs $out/lib/froment-software/migrate.cjs
                cp -r packages/api/drizzle $out/share/froment-software/drizzle
                argon2Modules=$(dirname $(readlink -f packages/api/node_modules/argon2))
                mkdir -p $out/lib/froment-software/node_modules/@phc
                cp -rL $argon2Modules/argon2 $out/lib/froment-software/node_modules/
                cp -rL $argon2Modules/@phc/format $out/lib/froment-software/node_modules/@phc/
                cp -rL $argon2Modules/node-gyp-build $out/lib/froment-software/node_modules/
                cp -rL packages/api/node_modules/better-sqlite3 $out/lib/froment-software/node_modules/
                cp -r packages/documents/templates $out/share/froment-software/templates
                cp -r packages/web/dist/froment-software/browser $out/share/froment-software/web
                makeWrapper ${runtimeNode}/bin/node $out/bin/${pname} \
                  --add-flags $out/lib/froment-software/server.cjs \
                  --set BUSINESS_TIME_ZONE Europe/Paris \
                  --set TYPST_PATH ${pkgs.typst}/bin/typst \
                  --set DOCUMENT_TEMPLATES_PATH $out/share/froment-software/templates \
                  --set DOCUMENT_FONTS_PATH ${documentFonts}/share/fonts \
                  --set-default DATABASE_PATH data/froment.sqlite \
                  --set DEPLOYMENT_METADATA ${lib.escapeShellArg (deploymentMetadata commit)} \
                  --set STATIC_ROOT $out/share/froment-software/web \
                  --set-default PORT 3000
                makeWrapper ${runtimeNode}/bin/node $out/bin/${pname}-migrate \
                  --add-flags $out/lib/froment-software/migrate.cjs \
                  --set BUSINESS_TIME_ZONE Europe/Paris \
                  --set-default DATABASE_PATH data/froment.sqlite \
                  --set MIGRATIONS_ROOT $out/share/froment-software/drizzle
                cp tools/deploy.sh $out/bin/${pname}-deploy
                chmod +x $out/bin/${pname}-deploy
                runHook postInstall
              '';
            };

          mkCheck =
            name: command:
            pkgs.stdenv.mkDerivation {
              inherit
                pname
                version
                src
                pnpmDeps
                ;
              name = "${pname}-${name}";
              CI = "true";
              PNPM_CONFIG_REPORTER = "append-only";
              nativeBuildInputs = [
                pkgs.nodejs_22
                pkgs.pnpm
                pkgs.pnpmConfigHook
              ]
              ++ lib.optionals (name == "test") [
                pkgs.chromium
                cousineFonts
                pkgs.liberation_ttf
                pkgs.poppler-utils
                pkgs.typst
              ];
              CHROMIUM_PATH = lib.optionalString (name == "test") "${pkgs.chromium}/bin/chromium";
              TYPST_PATH = lib.optionalString (name == "test") "${pkgs.typst}/bin/typst";
              DOCUMENT_TEMPLATES_PATH = lib.optionalString (name == "test") "${./packages/documents/templates}";
              DOCUMENT_FONTS_PATH = lib.optionalString (name == "test") "${documentFonts}/share/fonts";
              dontBuild = true;
              installPhase = ''
                runHook preInstall
                ${command}
                touch $out
                runHook postInstall
              '';
            };

          application = mkApplication localCommit;
          mkDockerImage =
            imageApplication:
            pkgs.dockerTools.buildLayeredImage {
              name = pname;
              tag = version;
              contents = [
                imageApplication
                pkgs.dockerTools.fakeNss
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
                Cmd = [ "${imageApplication}/bin/${pname}-deploy" ];
                Env = [
                  "DATABASE_PATH=/var/lib/froment-software/froment.sqlite"
                  "HOME=/home/froment"
                  "TMPDIR=/tmp"
                ];
                ExposedPorts."3000/tcp" = { };
                User = "froment";
                Volumes."/var/lib/froment-software" = { };
              };
            };
          dockerImage = mkDockerImage application;
          releaseDockerImage = mkDockerImage (
            mkApplication (
              if self ? rev then self.rev else builtins.throw "Image publication requires a clean Git revision"
            )
          );

          preCommitCheck = git-hooks.lib.${system}.run {
            src = ./.;
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
              nixfmt.enable = true;
              shellcheck = {
                enable = true;
                excludes = [ "^\\.envrc$" ];
              };
              trim-trailing-whitespace = {
                enable = true;
                excludes = [ "^packages/web/public/fonts/OFL\\.txt$" ];
              };
            };
          };
          productionClosure =
            let
              closure = pkgs.closureInfo { rootPaths = [ application ]; };
            in
            pkgs.runCommand "${pname}-production-closure" { } ''
              if grep -E -i '/[^/]*(chromium|playwright)' ${closure}/store-paths; then
                echo "The production closure contains Chromium or Playwright." >&2
                exit 1
              fi
              touch $out
            '';
        in
        {
          packages = {
            default = application;
            inherit dockerImage releaseDockerImage;
            skopeo = pkgs.skopeo;
          };

          apps.default = {
            type = "app";
            program = "${application}/bin/${pname}-deploy";
          };

          checks = {
            inherit dockerImage productionClosure;
            build = application;
            format = mkCheck "format" "pnpm format:check";
            lint = mkCheck "lint" "pnpm lint";
            pre-commit = preCommitCheck;
            test = mkCheck "test" "pnpm test";
          };

          devShells.default = pkgs.mkShell {
            CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";
            TYPST_PATH = "${pkgs.typst}/bin/typst";
            DOCUMENT_TEMPLATES_PATH = "${./packages/documents/templates}";
            DOCUMENT_FONTS_PATH = "${documentFonts}/share/fonts";
            packages = preCommitCheck.enabledPackages ++ [
              pkgs.chromium
              cousineFonts
              pkgs.liberation_ttf
              pkgs.nodejs_22
              pkgs.poppler-utils
              pkgs.pnpm
              pkgs.typst
            ];
            shellHook = preCommitCheck.shellHook;
          };

          formatter = pkgs.nixfmt;
        }
      );
}
