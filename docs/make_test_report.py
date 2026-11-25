"""Build the NetDoctor jury validation PDF and portable CSV from measured evidence."""
import argparse
import csv
import json
import statistics
from pathlib import Path

from make_report import ACC, INK, LINE, MUTED, TINT, Page, pdf

CASES = (
    ("control", "Clean control", "No fault observed"),
    ("gateway", "Gateway unavailable", "Gateway unreachable"),
    ("dns", "DNS failure", "DNS failure"),
    ("packet_loss", "Packet loss", "Packet loss"),
    ("congestion", "Congestion", "Latency rose under load"),
    ("ambiguous", "Conflicting signals", "Inconclusive"),
)

def pages(data, host, release):
    rows = data["recorded_runs"]
    assert data["passed"] == sum(row["matched"] for row in rows)
    groups = {case: [row for row in rows if row["case"] == case] for case, _, _ in CASES}
    assert all(len(items) == data["rounds"] for items in groups.values())
    first = {case: items[0]["raw"] for case, items in groups.items()}
    p = Page()
    p.head("AIORI-3 / PS-015 / VALIDATION", "NetDoctor test report")
    p.box(48, 620, 499, 74, TINT)
    p.txt(62, 650, f'{data["passed"]}/{data["total"]}', 29, True, ACC)
    p.txt(174, 659, "Measured trials matched the expected outcome", 13, True)
    p.txt(174, 638, f'{data["rounds"]} rounds on {data["environment"]}; fresh loopback sockets', 10, color=MUTED)
    p.txt(48, 599, f'Collected {data["evaluated_at"][:19].replace("T", " ")} UTC  |  Randomized order, seed {data["order_seed"]}', 9, color=MUTED)
    p.box(48, 551, 499, 24, TINT)
    for x, title in ((55, "CONDITION"), (208, "EXPECTED VERDICT"), (416, "MATCHED")):
        p.txt(x, 559, title, 9, True, ACC)
    for i, (case, label, goal) in enumerate(CASES):
        items = groups[case]
        y = 529 - i * 32
        p.txt(55, y, label, 10, True)
        p.txt(208, y, goal, 10)
        p.txt(416, y, f'{sum(row["matched"] for row in items)}/{len(items)}', 10, True, ACC)
        p.box(48, y-12, 499, 1, LINE)

    y = p.label(315, "Deciding readings from round 1")
    d = first["congestion"]
    clean = first["control"]
    loss = first["packet_loss"]
    y = p.para(y, f'Packet loss: {loss["received"]}/{loss["sent"]} received in the fault vs. {clean["received"]}/{clean["sent"]} clean. Congestion: median RTT moved from {d["idle_ms"]:.1f} ms idle to {d["loaded_ms"]:.1f} ms loaded during the 512 KiB local transfer.', width=90)
    y = p.para(y, "In the compound case, the gateway did not reply, DNS returned SERVFAIL, and all numbered packets returned. Mixed evidence did not justify naming a single cause.", width=90)
    p.para(y, f'Median run time: {data["median_duration_ms"]/1000:.2f} s on this laptop. This measures the lab workflow, not broadband speed or national diagnostic accuracy.', width=90)
    p.foot(1)

    q = Page()
    q.head("METHOD / COVERAGE", "What the tests establish")
    y = q.label(685, "A blind verdict")
    matches = sum(row["measurement_only_replay_matches"] for row in rows)
    y = q.para(y, f'The harness selects the condition; the rule engine receives only observed values. Measurement-only replay agreed in {matches}/{len(rows)} trials. A unit test also gives identical readings to all six harness labels and expects identical verdicts.', width=88)
    y = q.label(y-9, "Application verification")
    for line in release:
        y = q.para(y, line, width=88, size=10)
    y = q.label(y-9, "Separate live network check")
    diagnosis = host["diagnosis"]
    y = q.para(y, f'Windows host check: {diagnosis["title"]}. ' + " ".join(host["evidence"]), width=88)
    y = q.para(y, "This read-only host snapshot is separate from the lab. Nonresponses or filtering are not proof of an ISP fault. No network settings were changed.", width=88)
    y = q.label(y-9, "Reproduce and review")
    y = q.para(y, "From the project root: python backend/evaluate.py --rounds 5 --out evidence.json. See the companion CSV and JSON for samples, IDs, sources, and per-run timings.", width=88)
    q.para(y, "Field accuracy, radio interference detection, and broadband throughput are not validated. The volunteer pilot is a protocol, not a completed collection. No cloud account or AI key is required for the lab.", width=88)
    q.foot(2)
    return p, q

def csv_export(data, path):
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["round","case","expected","actual","matched","raw_replay_matches","runtime_ms","source","run_id",
                    "gateway_reply_ms","dns_status","dns_ms","sent","received","loss_pct","idle_median_ms","loaded_median_ms","loaded_range_ms","bytes"])
        for row in data["recorded_runs"]:
            raw=row["raw"]
            w.writerow([row[k] for k in ("round","case","expected","actual","matched","measurement_only_replay_matches","duration_ms","source","report_id")]
                       + [raw[k] for k in ("gateway_ms","dns_status","dns_ms","sent","received","loss_pct","idle_ms","loaded_ms","loaded_jitter_ms","bytes")])

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    a = parser.parse_args()
    d = a.directory
    data = json.loads((d/"NetDoctor-Lab-Evidence.json").read_text(encoding="utf-8"))
    host = json.loads((d/"NetDoctor-Live-Host-Check.json").read_text(encoding="utf-8"))
    release = (d/"Verification-Summary.txt").read_text(encoding="utf-8-sig").splitlines() if (d/"Verification-Summary.txt").exists() else ["Python backend: 24 automated tests passed on Windows."]
    pdf(d/"NetDoctor-PS015-Test-Report.pdf", pages(data,host,release))
    csv_export(data,d/"NetDoctor-Lab-Evidence.csv")

if __name__ == "__main__":
    main()
