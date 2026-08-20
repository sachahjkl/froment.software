{
  description = "Froment Software website";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
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
          documentFontConfig = pkgs.makeFontsConf {
            fontDirectories = [
              cousineFonts
              pkgs.liberation_ttf
            ];
          };
          workflowSource = lib.fileset.toSource {
            root = ./.;
            fileset = ./.github;
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
            hash = "sha256-1mSY/iBABvpQhBI11CQ/f7Cwr+2vNL2srUY0NujAErs=";
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
                cp -rL packages/api/node_modules/better-sqlite3 $out/lib/froment-software/node_modules/
                cp -rL packages/api/node_modules/playwright-core $out/lib/froment-software/node_modules/
                cp -r packages/web/dist/froment-software/browser $out/share/froment-software/web
                makeWrapper ${runtimeNode}/bin/node $out/bin/${pname} \
                  --add-flags $out/lib/froment-software/server.cjs \
                  --set BUSINESS_TIME_ZONE Europe/Paris \
                  --set CHROMIUM_PATH ${pkgs.chromium}/bin/chromium \
                  --set FONTCONFIG_FILE ${documentFontConfig} \
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
              ];
              CHROMIUM_PATH = lib.optionalString (name == "test") "${pkgs.chromium}/bin/chromium";
              FONTCONFIG_FILE = lib.optionalString (name == "test") documentFontConfig;
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
                cousineFonts
                pkgs.dockerTools.fakeNss
                pkgs.liberation_ttf
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
                mkdir -p ./etc/fonts
                cp ${documentFontConfig} ./etc/fonts/fonts.conf
                mkdir -p ./var/lib/froment-software
                chown -R 1000:1000 ./home/froment ./var/lib/froment-software
                mkdir -p ./run/wrappers/bin
                cp ${pkgs.chromium.sandbox}/bin/__chromium-suid-sandbox ./run/wrappers/bin/
                chmod 4755 ./run/wrappers/bin/__chromium-suid-sandbox
              '';
              config = {
                Cmd = [ "${imageApplication}/bin/${pname}-deploy" ];
                Env = [
                  "DATABASE_PATH=/var/lib/froment-software/froment.sqlite"
                  "FONTCONFIG_FILE=/etc/fonts/fonts.conf"
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

          actionlint =
            pkgs.runCommand "${pname}-actionlint"
              {
                nativeBuildInputs = [ pkgs.actionlint ];
              }
              ''
                actionlint -config-file ${workflowSource}/.github/actionlint.yaml ${workflowSource}/.github/workflows/*.yml
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
            inherit actionlint dockerImage;
            build = application;
            format = mkCheck "format" "pnpm format:check";
            lint = mkCheck "lint" "pnpm lint";
            test = mkCheck "test" "pnpm test";
          };

          devShells.default = pkgs.mkShell {
            CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";
            FONTCONFIG_FILE = documentFontConfig;
            packages = [
              pkgs.chromium
              cousineFonts
              pkgs.liberation_ttf
              pkgs.nodejs_22
              pkgs.poppler-utils
              pkgs.pnpm
            ];
          };

          formatter = pkgs.nixfmt;
        }
      );
}
