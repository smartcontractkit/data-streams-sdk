# Instructions for publishing a new SDK version

What this guide covers is how to publish a new SDK package on a package distribution network (where that applies), e.g.
[NPM](https://www.npmjs.com/package/@chainlink/data-streams-sdk) for TypeScript
or [crates.io](https://crates.io/crates/chainlink-data-streams-report) for Rust. As Go doesn't use a package system like
that, the release process is limited to tagging a commit and creating a GitHub release.

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

1. Increment the version in all `Cargo.toml` files:

rust/crates/report/Cargo.toml:

```
[package]
name = "chainlink-data-streams-report"
- version = "1.1.0"
+ version = "1.2.0"
```

rust/crates/sdk/Cargo.toml:

```
[package]
name = "chainlink-data-streams-sdk"
- version = "1.1.0"
+ version = "1.2.0"

...

[dependencies]
- chainlink-data-streams-report = { path = "../report", version = "1.1.0" }
+ chainlink-data-streams-report = { path = "../report", version = "1.2.0" }
```

2. Run `cargo build` and `cargo publish --dry-run` in order to update `Cargo.lock`.
3. Trigger the `Publish Chainlink Data Streams Report Crate` and `Publish Chainlink Data Streams SDK Crate` GitHub
   actions which will publish the respective crates.
