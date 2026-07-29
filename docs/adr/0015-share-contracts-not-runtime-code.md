# Share contracts rather than a runtime package

The first desktop Bluesky implementation does not introduce a runtime package shared with Cyd Mobile. Desktop ports platform-neutral behavior behind desktop-native interfaces, while the applications share the normative archive specification, canonical fixtures, and behavioral contract tests; this preserves semantic parity without coupling their runtimes and release cadence.
