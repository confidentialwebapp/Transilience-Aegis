"""matplotlib charts for the report (severity dist, risk heatmap, category breakdown)."""
from __future__ import annotations

from collections import Counter
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

from core.evidence import Finding  # noqa: E402
from core.severity import Severity  # noqa: E402


def severity_distribution(findings: list[Finding], out: Path) -> Path:
    counts = Counter(f.severity.value for f in findings)
    order = [s.value for s in Severity]
    values = [counts.get(s, 0) for s in order]
    colors = [Severity(s).color for s in order]

    fig, ax = plt.subplots(figsize=(7, 3.5))
    bars = ax.bar(order, values, color=colors, edgecolor="black", linewidth=0.5)
    ax.set_title("Findings by Severity", fontsize=12, weight="bold")
    ax.set_ylabel("Count")
    for bar, v in zip(bars, values):
        if v:
            ax.text(bar.get_x() + bar.get_width() / 2, v + max(values) * 0.01,
                    str(v), ha="center", fontsize=10, weight="bold")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    fig.savefig(out, dpi=140, bbox_inches="tight")
    plt.close(fig)
    return out


def category_breakdown(findings: list[Finding], out: Path) -> Path:
    counts = Counter(f.category for f in findings)
    if not counts:
        # empty placeholder
        fig, ax = plt.subplots(figsize=(6, 3))
        ax.axis("off")
        ax.text(0.5, 0.5, "No findings", ha="center", va="center")
        fig.savefig(out, dpi=140, bbox_inches="tight")
        plt.close(fig)
        return out
    cats, vals = zip(*sorted(counts.items(), key=lambda x: -x[1]))
    fig, ax = plt.subplots(figsize=(8, max(3, len(cats) * 0.35)))
    ax.barh(cats, vals, color="#2c3e50", edgecolor="black", linewidth=0.4)
    ax.invert_yaxis()
    ax.set_title("Findings by Category", fontsize=12, weight="bold")
    ax.set_xlabel("Count")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    fig.savefig(out, dpi=140, bbox_inches="tight")
    plt.close(fig)
    return out


def risk_heatmap(findings: list[Finding], out: Path) -> Path:
    matrix = np.zeros((5, 5), dtype=int)
    for f in findings:
        i = max(1, min(int(f.impact), 5)) - 1
        l = max(1, min(int(f.likelihood), 5)) - 1
        matrix[i][l] += 1

    # Background risk colour
    risk_colors = np.zeros((5, 5, 3))
    for i in range(5):
        for l in range(5):
            score = (i + 1) * (l + 1)
            if score >= 20: risk_colors[i, l] = (0.49, 0.11, 0.11)
            elif score >= 12: risk_colors[i, l] = (0.75, 0.22, 0.17)
            elif score >= 6: risk_colors[i, l] = (0.90, 0.49, 0.13)
            elif score >= 3: risk_colors[i, l] = (0.95, 0.77, 0.06)
            else: risk_colors[i, l] = (0.20, 0.60, 0.86)

    fig, ax = plt.subplots(figsize=(6, 5))
    ax.imshow(risk_colors, origin="lower")
    for i in range(5):
        for l in range(5):
            v = matrix[i][l]
            ax.text(l, i, str(v), ha="center", va="center",
                    color="white" if (i + 1) * (l + 1) >= 6 else "black", fontsize=11, weight="bold")
    ax.set_xticks(range(5))
    ax.set_yticks(range(5))
    ax.set_xticklabels(["1\nVery Low", "2\nLow", "3\nMed", "4\nHigh", "5\nV.High"])
    ax.set_yticklabels(["1\nVery Low", "2\nLow", "3\nMed", "4\nHigh", "5\nV.High"])
    ax.set_xlabel("Likelihood", weight="bold")
    ax.set_ylabel("Impact", weight="bold")
    ax.set_title("Risk Matrix (count of findings per cell)", fontsize=12, weight="bold")
    fig.tight_layout()
    fig.savefig(out, dpi=140, bbox_inches="tight")
    plt.close(fig)
    return out


def top_assets(findings: list[Finding], out: Path, n: int = 10) -> Path:
    counts = Counter(f.affected_asset for f in findings)
    if not counts:
        fig, ax = plt.subplots(figsize=(6, 3))
        ax.axis("off")
        ax.text(0.5, 0.5, "No findings", ha="center", va="center")
        fig.savefig(out, dpi=140, bbox_inches="tight")
        plt.close(fig)
        return out
    items = counts.most_common(n)
    labels, vals = zip(*items)
    fig, ax = plt.subplots(figsize=(8, max(3, len(labels) * 0.35)))
    ax.barh(labels, vals, color="#34495e", edgecolor="black", linewidth=0.4)
    ax.invert_yaxis()
    ax.set_title(f"Top {n} affected assets", fontsize=12, weight="bold")
    ax.set_xlabel("Findings")
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    fig.tight_layout()
    fig.savefig(out, dpi=140, bbox_inches="tight")
    plt.close(fig)
    return out
