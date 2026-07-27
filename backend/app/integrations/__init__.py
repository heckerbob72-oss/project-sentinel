"""External read-only integrations (e.g. GitHub) used by the import flow.

Kept separate from agents/engines: agents and engines are pure/deterministic,
while this package performs actual network I/O and translates failures into
explainable SentinelErrors.
"""
