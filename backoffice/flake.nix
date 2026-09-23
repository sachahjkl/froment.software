{
  description = "Froment Software backoffice assembled from the published package";

  inputs = {
    nixpkgs.url = "https://flakehub.com/f/NixOS/nixpkgs/0.2605";
    git-hooks = {
      url = "https://flakehub.com/f/cachix/git-hooks.nix/0.1";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = {
    self,
    nixpkgs,
    git-hooks,
    ...
  }: let
    forSystems = f: nixpkgs.lib.genAttrs ["x86_64-linux" "aarch64-linux"] (system: f (import nixpkgs {inherit system;}));
    preCommit = pkgs:
      git-hooks.lib.${pkgs.stdenv.hostPlatform.system}.run {
        package = pkgs.prek;
        src = ./.;
        hooks = {
          alejandra.enable = true;
          deadnix.enable = true;
          statix.enable = true;
          check-json.enable = true;
          check-merge-conflicts.enable = true;
          end-of-file-fixer.enable = true;
          trim-trailing-whitespace.enable = true;
          yamllint.enable = true;
        };
      };
  in {
    packages = forSystems (pkgs:
      pkgs.lib.optionalAttrs (builtins.pathExists ./package-lock.json) (let
        inherit (pkgs) lib;
        package = builtins.fromJSON (builtins.readFile ./package.json);
        assembly = pkgs.buildNpmPackage {
          pname = package.name;
          inherit (package) version;
          src = lib.fileset.toSource {
            root = ./.;
            fileset = lib.fileset.unions [./package.json ./package-lock.json ./prepare.mjs ./brand/froment.png];
          };
          nodejs = pkgs.nodejs_26;
          nativeBuildInputs = [pkgs.makeWrapper];
          npmDepsHash = "sha256-rk4aBjp6bpIGxYNv4ghsuFrulaqWQizmO8tBnu0Zjwg=";
          dontNpmBuild = true;
          installPhase = ''
            runHook preInstall
            mkdir -p "$out/lib/froment-backoffice" "$out/bin"
            cp -r node_modules package.json prepare.mjs "$out/lib/froment-backoffice/"
            cp brand/froment.png "$out/lib/froment-backoffice/node_modules/@sachahjkl/backoffice/dist/web/brand/froment.png"
            ln -s "$out/lib/froment-backoffice/node_modules/.bin/froment-backoffice" "$out/bin/froment-backoffice"
            makeWrapper ${pkgs.nodejs-slim_26}/bin/node "$out/bin/froment-backoffice-prepare" \
              --add-flags "$out/lib/froment-backoffice/prepare.mjs"
            runHook postInstall
          '';
        };
        image = pkgs.dockerTools.buildLayeredImage {
          name = "backoffice";
          tag = package.version;
          contents = [assembly pkgs.nodejs-slim_26 pkgs.typst pkgs.cacert pkgs.dockerTools.fakeNss];
          fakeRootCommands = ''
            cp --remove-destination ./etc/passwd ./etc/passwd.writable
            cp --remove-destination ./etc/group ./etc/group.writable
            mv ./etc/passwd.writable ./etc/passwd
            mv ./etc/group.writable ./etc/group
            chmod u+w ./etc/passwd ./etc/group
            mkdir -p ./var/lib/froment-software ./tmp
            chmod 1777 ./tmp
            echo 'froment:x:1000:1000:Froment Software:/var/lib/froment-software:/bin/sh' >> ./etc/passwd
            echo 'froment:x:1000:' >> ./etc/group
            chown 1000:1000 ./var/lib/froment-software
          '';
          config = {
            Cmd = ["${assembly}/bin/froment-backoffice"];
            Env = [
              "DATABASE_PATH=/var/lib/froment-software/froment.sqlite"
              "PORT=3000"
              "NODE_ENV=production"
              "PATH=${lib.makeBinPath [assembly pkgs.nodejs-slim_26 pkgs.typst]}"
              "SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
              "HOME=/var/lib/froment-software"
              "ENTERPRISE_NAME=Froment Software"
              "ENTERPRISE_LOGO_URL=/brand/froment.png"
              "TMPDIR=/tmp"
            ];
            User = "froment";
            ExposedPorts."3000/tcp" = {};
            Volumes."/var/lib/froment-software" = {};
          };
        };
      in {
        default = assembly;
        dockerImage = image;
      }));

    checks = forSystems (pkgs:
      {
        pre-commit = preCommit pkgs;
      }
      // pkgs.lib.optionalAttrs (builtins.pathExists ./package-lock.json) {
        build = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
        dockerImage = self.packages.${pkgs.stdenv.hostPlatform.system}.dockerImage;
      });

    devShells = forSystems (pkgs: let
      preCommitCheck = preCommit pkgs;
    in {
      default = pkgs.mkShell {
        packages = preCommitCheck.enabledPackages ++ [pkgs.nodejs_26 pkgs.typst];
        inherit (preCommitCheck) shellHook;
      };
    });

    formatter = forSystems (pkgs: pkgs.alejandra);
  };
}
