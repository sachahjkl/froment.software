{
  description = "Froment Software public website";

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
    flake-utils.lib.eachSystem ["x86_64-linux" "aarch64-linux"] (system: let
      pkgs = import nixpkgs {inherit system;};
      lib = pkgs.lib;
      packageJson = builtins.fromJSON (builtins.readFile ./package.json);
      deploymentPackages =
        map (file: let
          manifest = builtins.fromJSON (builtins.readFile file);
        in {
          inherit (manifest) name version;
        }) [
          ./package.json
          ./packages/contracts/package.json
          ./packages/l10n/package.json
          ./packages/marketing/package.json
          ./packages/web/package.json
        ];
      commit =
        if self ? rev
        then self.rev
        else if self ? dirtyRev
        then self.dirtyRev
        else "0000000000000000000000000000000000000000";
      deploymentMetadata = builtins.toJSON {
        inherit commit;
        packages = deploymentPackages;
      };
      inherit (packageJson) version;
      pname = packageJson.name;
      node = pkgs.nodejs_26;
      runtimeNode = pkgs.nodejs-slim_26;
      pnpm = pkgs.pnpm.override {nodejs-slim = node;};
      src = lib.fileset.toSource {
        root = ./.;
        fileset = lib.fileset.unions [
          ./.editorconfig
          ./.oxfmtrc.json
          ./.oxlintrc.json
          ./package.json
          ./packages/contracts/package.json
          ./packages/contracts/src
          ./packages/contracts/tsconfig.json
          ./packages/l10n/package.json
          ./packages/l10n/src
          ./packages/l10n/tsconfig.json
          ./packages/marketing/package.json
          ./packages/marketing/src
          ./packages/marketing/tsconfig.json
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
          ./tools/oxlint
        ];
      };
      pnpmDeps = pkgs.fetchPnpmDeps {
        inherit pname version src pnpm;
        fetcherVersion = 4;
        hash = "sha256-Lt19eXCQhHhQvRkt+TTHsfanaCiEglJGT/EEu2aJNKk=";
      };
      common = {
        inherit pname version src pnpmDeps;
        nativeBuildInputs = [node pnpm pkgs.pnpmConfigHook];
      };
      application = pkgs.stdenv.mkDerivation (common
        // {
          nativeBuildInputs = common.nativeBuildInputs ++ [pkgs.makeWrapper];
          buildPhase = ''
            runHook preBuild
            pnpm build
            runHook postBuild
          '';
          installPhase = ''
            runHook preInstall
            mkdir -p "$out/bin" "$out/lib/${pname}" "$out/share/${pname}"
            cp packages/marketing/dist/marketing.cjs "$out/lib/${pname}/marketing.cjs"
            cp -r packages/web/dist/froment-software/browser "$out/share/${pname}/web"
            makeWrapper ${runtimeNode}/bin/node "$out/bin/${pname}-marketing" \
              --add-flags "$out/lib/${pname}/marketing.cjs" \
              --set DEPLOYMENT_METADATA ${lib.escapeShellArg deploymentMetadata} \
              --set STATIC_ROOT "$out/share/${pname}/web" \
              --set-default PORT 3000
            runHook postInstall
          '';
        });
      dockerImage = pkgs.dockerTools.buildLayeredImage {
        name = pname;
        tag = version;
        contents = [application pkgs.dockerTools.fakeNss pkgs.cacert];
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
          chown -R 1000:1000 ./home/froment
        '';
        config = {
          Cmd = ["${application}/bin/${pname}-marketing"];
          Env = [
            "HOME=/home/froment"
            "PATH=${lib.makeBinPath [application]}"
            "TMPDIR=/tmp"
          ];
          ExposedPorts."3000/tcp" = {};
          User = "froment";
        };
      };
      mkCheck = name: command:
        pkgs.stdenv.mkDerivation (common
          // {
            name = "${pname}-${name}";
            CI = "true";
            PNPM_CONFIG_REPORTER = "append-only";
            dontBuild = true;
            installPhase = ''
              runHook preInstall
              ${command}
              touch "$out"
              runHook postInstall
            '';
          });
      preCommitCheck = git-hooks.lib.${system}.run {
        package = pkgs.prek;
        src = lib.cleanSource ./.;
        hooks = {
          actionlint.enable = true;
          check-added-large-files.enable = true;
          check-case-conflicts.enable = true;
          check-json = {
            enable = true;
            excludes = ["^\\.vscode/" "^packages/web/tsconfig.*\\.json$"];
          };
          check-merge-conflicts.enable = true;
          end-of-file-fixer = {
            enable = true;
            excludes = ["^packages/web/public/fonts/OFL\\.txt$"];
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
          if grep --quiet --extended-regexp --ignore-case '/[^/]*(chromium|playwright)' ${closure}/store-paths; then
            echo "The production closure contains Chromium or Playwright." >&2
            exit 1
          fi
          touch "$out"
        '';
    in {
      packages = {
        default = application;
        inherit dockerImage;
      };
      apps.default = {
        type = "app";
        program = "${application}/bin/${pname}-marketing";
      };
      checks = {
        build = application;
        inherit dockerImage productionClosure;
        format = mkCheck "format" "pnpm format:check";
        lint = mkCheck "lint" "pnpm lint";
        test = mkCheck "test" "pnpm test";
        pre-commit = preCommitCheck;
      };
      formatter = pkgs.alejandra;
      devShells.default = pkgs.mkShell {
        packages = preCommitCheck.enabledPackages ++ [node pnpm];
        inherit (preCommitCheck) shellHook;
      };
    });
}
