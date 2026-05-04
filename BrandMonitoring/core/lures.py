"""Industry-specific scam-lure keywords.

For each industry, we maintain the top scam vocabulary that bad actors use
when building phishing pages, fake support channels, fake giveaways, etc.
These get appended to brand keywords for phishing/social/SERP queries.
"""
from __future__ import annotations

INDUSTRY_LURES: dict[str, list[str]] = {
    "Financial Services": ["loan", "instant loan", "kyc", "support", "customer care", "recovery agent", "approve", "refund"],
    "Banking":            ["account", "card", "kyc", "neft", "imps", "block", "support", "loan"],
    "NBFC":               ["loan", "instant loan", "approve", "kyc", "recovery", "agent", "support", "personal loan"],
    "Microfinance":       ["loan", "group loan", "weekly", "approve", "instant", "kyc", "agent"],
    "NBFC / Microfinance":["loan", "instant loan", "kyc", "approve", "recovery", "agent", "support"],
    "Insurance":          ["claim", "renewal", "premium", "policy", "refund", "support"],
    "FinTech":            ["upi", "wallet", "kyc", "withdraw", "deposit", "transaction", "support"],
    "E-commerce":         ["delivery", "refund", "support", "customer care", "order", "tracking", "cashback"],
    "Telecom":            ["recharge", "kyc", "plan", "support", "billing", "esim"],
    "Healthcare":         ["claim", "appointment", "prescription", "insurance", "support"],
    "Crypto / Web3":      ["airdrop", "support", "kyc", "wallet", "claim", "withdraw", "swap"],
    "Government":         ["aadhar", "pan", "scheme", "subsidy", "verification", "kyc"],
    "Travel":             ["booking", "refund", "ticket", "cancel", "support"],
    "Education":          ["scholarship", "admission", "fee", "result"],
    "Real Estate":        ["property", "loan", "emi", "rent", "deposit"],
}


def expand_keywords(brand_keywords: list[str], industry: str | None, max_combinations: int = 30) -> list[str]:
    """Combine each brand keyword with industry-specific lures.

    Returns a list of compound search phrases like 'brand loan', 'brand kyc support'.
    """
    if not industry:
        return list(brand_keywords)
    lures = INDUSTRY_LURES.get(industry) or []
    if not lures:
        # Try partial match (e.g. config says "NBFC / Microfinance" matches "NBFC")
        for k, v in INDUSTRY_LURES.items():
            if k.lower() in industry.lower() or industry.lower() in k.lower():
                lures = v
                break
    if not lures:
        return list(brand_keywords)
    out: list[str] = list(brand_keywords)
    for bk in brand_keywords:
        for lure in lures:
            out.append(f"{bk} {lure}")
            if len(out) >= max_combinations:
                return out
    return out
