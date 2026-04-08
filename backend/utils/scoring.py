def calculate_risk_score(findings: dict) -> int:
    score = 0

    if findings.get("domain_age_days") is not None and findings["domain_age_days"] < 30:
        score += 30

    if findings.get("uses_brand_keyword"):
        score += 25

    if findings.get("virustotal_flagged"):
        score += 40

    if findings.get("urlscan_phishing"):
        score += 50

    if findings.get("in_breach_db"):
        score += 35

    if findings.get("exposed_credentials"):
        score += 45

    if findings.get("has_ssl_cert"):
        score += 5

    if findings.get("similar_logo"):
        score += 20

    if findings.get("active_dns"):
        score += 10

    return min(score, 100)


def severity_from_score(score: int) -> str:
    if score >= 80:
        return "critical"
    elif score >= 60:
        return "high"
    elif score >= 40:
        return "medium"
    elif score >= 20:
        return "low"
    return "info"
