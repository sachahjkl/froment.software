{
  description = "Froment Software website";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
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
          inherit (packageJson) version;
          pname = packageJson.name;
          runtimeNode = pkgs.nodejs-slim_22;
          projectSource = lib.cleanSource ./.;
          src = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.unions [
              ./.editorconfig
              ./.oxfmtrc.json
              ./package.json
              ./packages
              ./pnpm-lock.yaml
              ./pnpm-workspace.yaml
              ./tsconfig.base.json
            ];
          };
          pnpmDeps = pkgs.fetchPnpmDeps {
            inherit pname version src;
            pnpm = pkgs.pnpm;
            fetcherVersion = 4;
            hash = "sha256-Xu+xFM12lYGatbUnvuwWQe0rdsNqwT/yA5XT2R0qQSM=";
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
              mkdir -p $out/bin $out/lib/froment-software $out/share/froment-software
              cp packages/api/dist/main.cjs $out/lib/froment-software/server.cjs
              cp -r packages/web/dist/froment-software/browser $out/share/froment-software/web
              makeWrapper ${runtimeNode}/bin/node $out/bin/${pname} \
                --add-flags $out/lib/froment-software/server.cjs \
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
            '';
            config = {
              Cmd = [ "${application}/bin/${pname}" ];
              ExposedPorts."3000/tcp" = { };
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
