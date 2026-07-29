# Bidirectional Cyd archive compatibility

Cyd mobile and desktop will import Cyd archives produced by either application, and existing unversioned mobile Bluesky archives will remain importable as legacy version 1. The first explicitly versioned canonical interchange format is version 2; clients read supported older versions and clearly reject newer unsupported versions so evolving one application does not silently break portability with the other.
