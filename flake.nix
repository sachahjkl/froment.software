{
  description = "Froment Software website";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { self, nixpkgs, flake-utils, ... }:
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
          deploymentMetadata = builtins.toJSON {
            commit = if self ? rev then self.rev else builtins.throw "A clean Git revision is required";
            packages = builtins.sort (left: right: left.name < right.name) (
              map (manifest: {
                inherit (manifest) name version;
              }) ([ packageJson ] ++ workspacePackages)
            );
          };
          inherit (packageJson) version;
          pname = packageJson.name;
          runtimeNode = pkgs.nodejs-slim_22;
          projectSource = lib.cleanSource ./.;
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
            hash = "sha256-vq62Mq0PaqLPR4pKPCvioEVAAR8Xpm8+hRIAy9qXXG4=";
          };

          application = pkgs.stdenv.mkDerivation {
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
              cp -r packages/api/drizzle $out/share/froment-software/drizzle
              cp -rL packages/api/node_modules/better-sqlite3 $out/lib/froment-software/node_modules/
              cp -r packages/web/dist/froment-software/browser $out/share/froment-software/web
              makeWrapper ${runtimeNode}/bin/node $out/bin/${pname} \
                --add-flags $out/lib/froment-software/server.cjs \
                --set-default DATABASE_PATH data/froment.sqlite \
                --set DEPLOYMENT_METADATA ${lib.escapeShellArg deploymentMetadata} \
                --set MIGRATIONS_ROOT $out/share/froment-software/drizzle \
                --set PUBLIC_ORIGIN https://froment.software \
                --set STATIC_ROOT $out/share/froment-software/web \
                --set-default PORT 3000
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
              nativeBuildInputs = [
                pkgs.nodejs_22
                pkgs.pnpm
                pkgs.pnpmConfigHook
              ];
              dontBuild = true;
              installPhase = ''
                runHook preInstall
                ${command}
                touch $out
                runHook postInstall
              '';
            };

          dockerImage = pkgs.dockerTools.buildLayeredImage {
            name = pname;
            tag = version;
            contents = [
              application
              pkgs.dockerTools.fakeNss
            ];
            fakeRootCommands = ''
              mkdir -p ./tmp
              chmod 1777 ./tmp
              mkdir -p ./var/lib/froment-software
            '';
            config = {
              Cmd = [ "${application}/bin/${pname}" ];
              Env = [ "DATABASE_PATH=/var/lib/froment-software/froment.sqlite" ];
              ExposedPorts."3000/tcp" = { };
              Volumes."/var/lib/froment-software" = { };
            };
          };

          actionlint =
            pkgs.runCommand "${pname}-actionlint"
              {
                nativeBuildInputs = [ pkgs.actionlint ];
              }
              ''
                actionlint -config-file ${projectSource}/.github/actionlint.yaml ${projectSource}/.github/workflows/*.yml
                touch $out
              '';
        in
        {
          packages = {
            default = application;
            inherit dockerImage;
          };

          apps.default = {
            type = "app";
            program = "${application}/bin/${pname}";
          };

          checks = {
            inherit actionlint dockerImage;
            build = application;
            format = mkCheck "format" "pnpm format:check";
            lint = mkCheck "lint" "pnpm lint";
            test = mkCheck "test" "pnpm test";
          };

          devShells.default = pkgs.mkShell {
            packages = [
              pkgs.nodejs_22
              pkgs.pnpm
            ];
          };

          formatter = pkgs.nixfmt;
        }
      );
}
