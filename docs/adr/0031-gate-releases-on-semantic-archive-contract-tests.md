# Gate releases on semantic archive contract tests

Bluesky releases must pass canonical compatibility tests for legacy mobile v1 import, bidirectional v2 exchange, repeated and mixed-device merges, offline full-video playback, all record categories and direct context, integrity and adversarial failures, version rejection, DID/UUID collisions, and settings differences. Tests compare normalized records, relationships, asset digests, completeness, and source-deletion state rather than byte-identical ZIP or SQLite layouts.
