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
              ./angular.json
              ./package-lock.json
              ./package.json
              ./public
              ./src
              ./tsconfig.app.json
              ./tsconfig.json
              ./tsconfig.spec.json
            ];
          };
          npmDeps = pkgs.fetchNpmDeps {
            inherit src;
            hash = "sha256-GizeMMw5zW7Uko21728QazbHTo9gU+62G14qwY7DyuA=";
          };

          site = pkgs.buildNpmPackage {
            inherit
              pname
              version
              src
              npmDeps
              ;
            nodejs = pkgs.nodejs_22;
            npmBuildScript = "build";
            installPhase = ''
              runHook preInstall
              cp -r dist/froment-software/browser $out
              runHook postInstall
            '';
          };

          mkCheck =
            name: command:
            pkgs.buildNpmPackage {
              inherit
                pname
                version
                src
                npmDeps
                ;
              name = "${pname}-${name}";
              nodejs = pkgs.nodejs_22;
              dontNpmBuild = true;
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
            format = mkCheck "format" "npm run format:check";
            lint = mkCheck "lint" "npm run lint";
            test = mkCheck "test" "npm test -- --watch=false";
          };

          devShells.default = pkgs.mkShell {
            packages = [ pkgs.nodejs_22 ];
          };

          formatter = pkgs.nixfmt;
        }
      );
}
