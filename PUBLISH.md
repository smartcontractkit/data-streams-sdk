# Instructions for publishing a new SDK version

## Go

1. Tag a `main` commit with `go/vX.Y.X`. This is enough for the new version to be considered released.
2. Additionally, we can create a new release directly on GitHub. make sure to choose the correct tag, target, and
   previous version/tag. That allows you to use the `Generate release notes` button to get a good starting point of the
   release notes.

## TypeScript

1. Increment the version in `package.json` to what it should be.
2. Run `npm i` in order to update `package-lock.json`.
3. Trigger the `Manual NPM Publish for TS SDK` GitHub action.

## Rust

1. Increment the version in all `Cargo.toml` files.
2. Run `cargo build` and `cargo publish --dry-run` in order to update `Cargo.lock`.
3. Tag a `main` commit with `rust/chainlink-data-streams-report-vX.Y.Z`. This will trigger a GitHub action which will
   publish the two crates. 
