from __future__ import annotations

import json
import sys
from pathlib import Path

desktop = Path(__file__).resolve().parent
sys.path.insert(0, str(desktop.parent / 'backend'))
from diagnosis import FIXTURES, SCENARIOS, build_report

fixtures = []
for scenario in FIXTURES:
    title, description = SCENARIOS[scenario]
    if scenario == "dns":
        title, description = "Name resolution trouble", "Synthetic case: fixed IP works, but two DNS lookups fail."
    report = build_report({"mode": "demo", "scenario": scenario, "access": "unknown"}, fixture_only=True)
    assert report["provenance"]["source"] == "fixture"
    report.pop('id', None)
    report.pop('created_at', None)
    fixtures.append(dict(id=scenario, title=title, description=description, report=report))
data = json.dumps(fixtures, ensure_ascii=True, indent=2)
js = """(function(root){'use strict';const fixtures=""" + data + """;if(typeof module==='object')module.exports=fixtures;else root.ND_FIXTURES=fixtures;})(globalThis);
"""
(desktop / 'demo-data.js').write_text(js, encoding='utf-8')

