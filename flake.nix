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
            hash = "sha256-p7+GqSv88R29ZZQldGuWFaDk4QK8gmrrwBfWI/6fTaE=";
          };

          site = pkgs.stdenv.mkDerivation {
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
            ];
            buildPhase = ''
              runHook preBuild
              pnpm build
              runHook postBuild
            '';
            installPhase = ''
              runHook preInstall
              cp -r packages/web/dist/froment-software/browser $out
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

          nginxConfig = pkgs.runCommand "${pname}-nginx.conf" { } ''
            substitute ${./nginx.conf} $out \
              --replace-fail "user nginx;" "user nobody nobody;" \
              --replace-fail "error_log /var/log/nginx/error.log notice;" "error_log /dev/stderr notice;" \
              --replace-fail "pid /var/run/nginx.pid;" "pid /tmp/nginx.pid;" \
              --replace-fail "include /etc/nginx/mime.types;" "include ${pkgs.nginx}/conf/mime.types;" \
              --replace-fail "root /usr/share/nginx/html;" "root ${site};"
          '';

          server = pkgs.writeShellApplication {
            name = pname;
            runtimeInputs = [ pkgs.nginx ];
            text = ''
              exec nginx -e /dev/stderr -c ${nginxConfig} -g 'daemon off;'
            '';
          };

          dockerImage = pkgs.dockerTools.buildLayeredImage {
            name = pname;
            tag = version;
            contents = [
              server
              pkgs.dockerTools.fakeNss
            ];
            fakeRootCommands = ''
              mkdir -p ./tmp
              chmod 1777 ./tmp
            '';
            config = {
              Cmd = [ "${server}/bin/${pname}" ];
              ExposedPorts."80/tcp" = { };
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
            default = site;
            inherit dockerImage;
          };

          apps.default = {
            type = "app";
            program = "${server}/bin/${pname}";
          };

          checks = {
            inherit actionlint dockerImage;
            build = site;
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
