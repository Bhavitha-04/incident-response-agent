import re

SERVICE_PATTERNS = [
    (r"\bpayments?\b", "payments"),
    (r"\bauth\b", "auth"),
    (r"\bcheckout\b", "checkout"),
    (r"\binventory\b", "inventory"),
    (r"\bsearch\b", "search"),
    (r"\bnotifications?\b", "notifications"),
    (r"\bredis\b", "redis"),
    (r"\bdatabase\b|\bpostgres\b|\bdb\b", "database"),
    (r"\bbgp\b", "bgp"),
    (r"\bdns\b", "dns"),
    (r"\btgw\b|\btransit.?gateway\b", "transit_gateway"),
    (r"\bwaf\b", "waf"),
    (r"\bcilium\b", "cilium"),
]

ERROR_PATTERNS = [
    (r"\blatency\b|\btimeout\b|\bslow\b", "latency_spike"),
    (r"\b500\b|\berror.?rate\b|\bserver.?error\b", "server_error"),
    (r"\b503\b|\bunavailable\b|\boutage\b", "service_unavailable"),
    (r"\bbgp\b|\bnetwork\b|\bpacket.?loss\b", "network_fault"),
    (r"\bcrash.?loop\b|\bcrashloopbackoff\b", "crash_loop"),
    (r"\boom\b|\boomkill\b|\bmemory\b", "memory_issue"),
    (r"\bconfig\b|\bconfigmap\b|\benv.?var\b", "config_error"),
]


def extract_signature(text: str) -> dict:
    """Extract service and error type from an incident description using word-boundary matching."""
    sig = {"service": None, "error_type": None}
    text_lower = text.lower()

    for pattern, label in SERVICE_PATTERNS:
        if re.search(pattern, text_lower):
            sig["service"] = label
            break

    for pattern, label in ERROR_PATTERNS:
        if re.search(pattern, text_lower):
            sig["error_type"] = label
            break

    return sig