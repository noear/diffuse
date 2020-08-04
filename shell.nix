let

  sources = import ./nix/sources.nix;
  pkgs = import sources.nixpkgs {};

  # Don't install Stack on Github Actions
  stack =
    if (builtins.getEnv "GITHUB_ACTION" != "") then
      pkgs.curl
    else
      pkgs.haskellPackages.stack
  ;

in

  pkgs.mkShell {
    buildInputs = [

      # Dev Tools
      pkgs.curl
      pkgs.devd
      pkgs.just
      pkgs.watchexec

      # Language Specific
      pkgs.elmPackages.elm
      pkgs.elmPackages.elm-format
      stack
      pkgs.nodejs-14_x
      pkgs.yarn

    ];
  }
