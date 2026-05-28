{
  description = "Froment Software - Angular project";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
        };

        dockerfile = pkgs.writeText "Dockerfile.generated" ''
          FROM node:22-alpine AS build

          WORKDIR /app

          COPY package.json package-lock.json ./
          RUN npm ci

          COPY . .
          RUN npm run build

          FROM joseluisq/static-web-server:2-alpine

          COPY --from=build /app/dist/froment-software/browser /public

          EXPOSE 80
        '';
      in
      {
        packages.dockerfile = dockerfile;

        apps.dockerfile = {
          type = "app";
          program = toString (pkgs.writeShellScript "print-dockerfile" ''
            printf '%s\n' "${dockerfile}"
          '');
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            git
            docker-client
          ];

          shellHook = ''
            echo "🔨 Froment Software devshell"
            echo "   Node.js : $(node --version)"
            echo "   npm     : $(npm --version)"
            echo "   git     : $(git --version 2>&1 | awk '{print $3}')"
            echo ""
            echo "Run 'npm install' to install dependencies."
            echo "Run 'npm start'  to start the dev server."
          '';
        };
      }
    );
}
