import re

def extract_signature(text: str) -> dict:
    """Extract structured fields from an incident description."""
    sig = {"service": None, "error_type": None}

    services = ["payments", "auth", "checkout", "inventory", "search", 
                "notifications", "redis", "database", "bgp", "dns"]
    for s in services:
        if s in text.lower():
            sig["service"] = s
            break

    if "latency" in text.lower() or "timeout" in text.lower():
        sig["error_type"] = "latency_spike"
    elif "500" in text or "error rate" in text.lower():
        sig["error_type"] = "server_error"
    elif "503" in text or "unavailable" in text.lower():
        sig["error_type"] = "service_unavailable"
    elif "bgp" in text.lower():
        sig["error_type"] = "network_fault"

    return sig