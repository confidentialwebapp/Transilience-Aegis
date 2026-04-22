"""Provider modules for the enrichment fan-out.

Each provider exports an async `query(ioc_type, value, settings) -> dict | None`
function. Returning None / empty dict means "no data" and the result is dropped
from the merged response.

Conventional dict shape:
    {
        "source": "<provider name>",
        "verdict": "malicious" | "suspicious" | "clean" | "unknown",
        "confidence": 0..100,
        "tags": [...],
        "data": <raw provider response, optional>,
    }
"""
