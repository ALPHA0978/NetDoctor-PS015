(function(root){'use strict';const fixtures=[
  {
    "id": "healthy",
    "title": "Healthy baseline",
    "description": "Local gateway, name resolution, and both external services respond.",
    "report": {
      "mode": "demo",
      "scenario": "healthy",
      "access": "unknown",
      "diagnosis": {
        "code": "healthy",
        "title": "No issue observed",
        "confidence": "high",
        "summary": "These checks succeeded now. Intermittent faults and speed issues are not ruled out."
      },
      "measurements": [
        {
          "id": "gateway",
          "label": "Local route",
          "value": "Found",
          "unit": "",
          "status": "pass",
          "detail": "Controlled fixture; private IPv4 gateway only."
        },
        {
          "id": "latency",
          "label": "Gateway median latency",
          "value": 5.0,
          "unit": "ms",
          "status": "pass",
          "detail": "Median of successful ICMP replies. Missing replies can mean filtering."
        },
        {
          "id": "loss",
          "label": "Gateway probe loss",
          "value": 0.0,
          "unit": "%",
          "status": "pass",
          "detail": "4/4 replies; four requests at most."
        },
        {
          "id": "spread",
          "label": "Gateway latency range",
          "value": 2,
          "unit": "ms",
          "status": "pass",
          "detail": "Maximum minus minimum of successful gateway samples; not an Internet jitter measurement."
        },
        {
          "id": "dns_1",
          "label": "DNS: www.cloudflare.com",
          "value": 20,
          "unit": "ms",
          "status": "pass",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_1",
          "label": "HTTPS: www.cloudflare.com",
          "value": 74,
          "unit": "ms",
          "status": "pass",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "dns_2",
          "label": "DNS: www.google.com",
          "value": 30,
          "unit": "ms",
          "status": "pass",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_2",
          "label": "HTTPS: www.google.com",
          "value": 88,
          "unit": "ms",
          "status": "pass",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "fixed_ip",
          "label": "Fixed-IP TCP probe",
          "value": "Reachable",
          "unit": "",
          "status": "pass",
          "detail": "One TCP connection to a fixed public endpoint, without DNS."
        }
      ],
      "evidence": [
        "Local gateway: 4 of 4 replies.",
        "DNS lookups: 2 of 2. Secure web probes: 2 of 2.",
        "Fixed external IP accepted a connection."
      ],
      "actions": [
        "Repeat while symptoms are happening.",
        "Save this result as a baseline for comparison."
      ],
      "limitations": [
        "SIMULATED: these values are not measurements from your network.",
        "Confidence labels describe supporting signals, not statistically calibrated probabilities.",
        "IPv6, radio signal strength, ISP segment ownership, and broadband speed are not measured.",
        "A brief sample may miss intermittent faults. A nonresponse can be filtering or an unavailable endpoint."
      ],
      "provenance": {
        "schema_version": "1.0",
        "ruleset": "netdoctor-2026.11",
        "source": "fixture",
        "gateway_sample_ms": [
          4,
          5,
          6,
          5
        ]
      }
    }
  },
  {
    "id": "wifi",
    "title": "Local Wi-Fi instability",
    "description": "The gateway shows intermittent loss even though Internet services respond.",
    "report": {
      "mode": "demo",
      "scenario": "wifi",
      "access": "wifi",
      "diagnosis": {
        "code": "local_wifi",
        "title": "Likely issue on the local link",
        "confidence": "medium",
        "summary": "Replies from the local gateway were inconsistent. That suggests a problem near the device or gateway, but signal or interference was not measured."
      },
      "measurements": [
        {
          "id": "gateway",
          "label": "Local route",
          "value": "Found",
          "unit": "",
          "status": "pass",
          "detail": "Controlled fixture; private IPv4 gateway only."
        },
        {
          "id": "latency",
          "label": "Gateway median latency",
          "value": 178,
          "unit": "ms",
          "status": "warn",
          "detail": "Median of successful ICMP replies. Missing replies can mean filtering."
        },
        {
          "id": "loss",
          "label": "Gateway probe loss",
          "value": 25.0,
          "unit": "%",
          "status": "warn",
          "detail": "3/4 replies; four requests at most."
        },
        {
          "id": "spread",
          "label": "Gateway latency range",
          "value": 175,
          "unit": "ms",
          "status": "warn",
          "detail": "Maximum minus minimum of successful gateway samples; not an Internet jitter measurement."
        },
        {
          "id": "dns_1",
          "label": "DNS: www.cloudflare.com",
          "value": 44,
          "unit": "ms",
          "status": "pass",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_1",
          "label": "HTTPS: www.cloudflare.com",
          "value": 160,
          "unit": "ms",
          "status": "pass",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "dns_2",
          "label": "DNS: www.google.com",
          "value": 60,
          "unit": "ms",
          "status": "pass",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_2",
          "label": "HTTPS: www.google.com",
          "value": 240,
          "unit": "ms",
          "status": "pass",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "fixed_ip",
          "label": "Fixed-IP TCP probe",
          "value": "Reachable",
          "unit": "",
          "status": "pass",
          "detail": "One TCP connection to a fixed public endpoint, without DNS."
        }
      ],
      "evidence": [
        "Local gateway: 3 of 4 replies.",
        "DNS lookups: 2 of 2. Secure web probes: 2 of 2.",
        "Fixed external IP accepted a connection."
      ],
      "actions": [
        "Move closer to the router and repeat the same test.",
        "If possible, compare the same device over Ethernet."
      ],
      "limitations": [
        "SIMULATED: these values are not measurements from your network.",
        "Confidence labels describe supporting signals, not statistically calibrated probabilities.",
        "IPv6, radio signal strength, ISP segment ownership, and broadband speed are not measured.",
        "A brief sample may miss intermittent faults. A nonresponse can be filtering or an unavailable endpoint."
      ],
      "provenance": {
        "schema_version": "1.0",
        "ruleset": "netdoctor-2026.11",
        "source": "fixture",
        "gateway_sample_ms": [
          46,
          null,
          221,
          178
        ]
      }
    }
  },
  {
    "id": "dns",
    "title": "Name resolution trouble",
    "description": "Synthetic case: fixed IP works, but two DNS lookups fail.",
    "report": {
      "mode": "demo",
      "scenario": "dns",
      "access": "unknown",
      "diagnosis": {
        "code": "dns",
        "title": "Likely DNS resolution issue",
        "confidence": "medium",
        "summary": "DNS lookups failed while a fixed external IP accepted a TCP connection. This suggests, but does not prove, a name-resolution problem."
      },
      "measurements": [
        {
          "id": "gateway",
          "label": "Local route",
          "value": "Found",
          "unit": "",
          "status": "pass",
          "detail": "Controlled fixture; private IPv4 gateway only."
        },
        {
          "id": "latency",
          "label": "Gateway median latency",
          "value": 4.5,
          "unit": "ms",
          "status": "pass",
          "detail": "Median of successful ICMP replies. Missing replies can mean filtering."
        },
        {
          "id": "loss",
          "label": "Gateway probe loss",
          "value": 0.0,
          "unit": "%",
          "status": "pass",
          "detail": "4/4 replies; four requests at most."
        },
        {
          "id": "spread",
          "label": "Gateway latency range",
          "value": 2,
          "unit": "ms",
          "status": "pass",
          "detail": "Maximum minus minimum of successful gateway samples; not an Internet jitter measurement."
        },
        {
          "id": "dns_1",
          "label": "DNS: www.cloudflare.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_1",
          "label": "HTTPS: www.cloudflare.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "dns_2",
          "label": "DNS: www.google.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_2",
          "label": "HTTPS: www.google.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "fixed_ip",
          "label": "Fixed-IP TCP probe",
          "value": "Reachable",
          "unit": "",
          "status": "pass",
          "detail": "One TCP connection to a fixed public endpoint, without DNS."
        }
      ],
      "evidence": [
        "Local gateway: 4 of 4 replies.",
        "DNS lookups: 0 of 2. Secure web probes: 0 of 2.",
        "Fixed external IP accepted a connection."
      ],
      "actions": [
        "Reconnect and rerun before changing settings.",
        "Ask your administrator or provider to check your configured DNS."
      ],
      "limitations": [
        "SIMULATED: these values are not measurements from your network.",
        "Confidence labels describe supporting signals, not statistically calibrated probabilities.",
        "IPv6, radio signal strength, ISP segment ownership, and broadband speed are not measured.",
        "A brief sample may miss intermittent faults. A nonresponse can be filtering or an unavailable endpoint."
      ],
      "provenance": {
        "schema_version": "1.0",
        "ruleset": "netdoctor-2026.11",
        "source": "fixture",
        "gateway_sample_ms": [
          4,
          6,
          5,
          4
        ]
      }
    }
  },
  {
    "id": "upstream",
    "title": "Beyond the local gateway",
    "description": "Gateway and DNS respond; two independent external services fail.",
    "report": {
      "mode": "demo",
      "scenario": "upstream",
      "access": "unknown",
      "diagnosis": {
        "code": "upstream",
        "title": "Connection problem beyond gateway suspected",
        "confidence": "medium",
        "summary": "Local replies and DNS worked, but both external HTTPS probes failed. A firewall, VPN, captive portal, or upstream fault could explain it."
      },
      "measurements": [
        {
          "id": "gateway",
          "label": "Local route",
          "value": "Found",
          "unit": "",
          "status": "pass",
          "detail": "Controlled fixture; private IPv4 gateway only."
        },
        {
          "id": "latency",
          "label": "Gateway median latency",
          "value": 4.5,
          "unit": "ms",
          "status": "pass",
          "detail": "Median of successful ICMP replies. Missing replies can mean filtering."
        },
        {
          "id": "loss",
          "label": "Gateway probe loss",
          "value": 0.0,
          "unit": "%",
          "status": "pass",
          "detail": "4/4 replies; four requests at most."
        },
        {
          "id": "spread",
          "label": "Gateway latency range",
          "value": 3,
          "unit": "ms",
          "status": "pass",
          "detail": "Maximum minus minimum of successful gateway samples; not an Internet jitter measurement."
        },
        {
          "id": "dns_1",
          "label": "DNS: www.cloudflare.com",
          "value": 24,
          "unit": "ms",
          "status": "pass",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_1",
          "label": "HTTPS: www.cloudflare.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "dns_2",
          "label": "DNS: www.google.com",
          "value": 31,
          "unit": "ms",
          "status": "pass",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_2",
          "label": "HTTPS: www.google.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "fixed_ip",
          "label": "Fixed-IP TCP probe",
          "value": "Not reached",
          "unit": "",
          "status": "unknown",
          "detail": "One TCP connection to a fixed public endpoint, without DNS."
        }
      ],
      "evidence": [
        "Local gateway: 4 of 4 replies.",
        "DNS lookups: 2 of 2. Secure web probes: 0 of 2.",
        "Fixed external IP reachability was not confirmed."
      ],
      "actions": [
        "If allowed, retry without the VPN or on a second trusted device.",
        "Share the report with support if the pattern repeats."
      ],
      "limitations": [
        "SIMULATED: these values are not measurements from your network.",
        "Confidence labels describe supporting signals, not statistically calibrated probabilities.",
        "IPv6, radio signal strength, ISP segment ownership, and broadband speed are not measured.",
        "A brief sample may miss intermittent faults. A nonresponse can be filtering or an unavailable endpoint."
      ],
      "provenance": {
        "schema_version": "1.0",
        "ruleset": "netdoctor-2026.11",
        "source": "fixture",
        "gateway_sample_ms": [
          3,
          4,
          6,
          5
        ]
      }
    }
  },
  {
    "id": "mixed",
    "title": "Mixed evidence",
    "description": "Gateway probes are filtered and one external service fails.",
    "report": {
      "mode": "demo",
      "scenario": "mixed",
      "access": "unknown",
      "diagnosis": {
        "code": "inconclusive",
        "title": "Not enough evidence to isolate the cause",
        "confidence": "low",
        "summary": "Some checks were missing or disagree. A single failed target or blocked ping is not enough to blame the router or provider."
      },
      "measurements": [
        {
          "id": "gateway",
          "label": "Local route",
          "value": "Found",
          "unit": "",
          "status": "pass",
          "detail": "Controlled fixture; private IPv4 gateway only."
        },
        {
          "id": "latency",
          "label": "Gateway median latency",
          "value": null,
          "unit": "ms",
          "status": "unknown",
          "detail": "Median of successful ICMP replies. Missing replies can mean filtering."
        },
        {
          "id": "loss",
          "label": "Gateway probe loss",
          "value": 100.0,
          "unit": "%",
          "status": "unknown",
          "detail": "0/4 replies; four requests at most."
        },
        {
          "id": "spread",
          "label": "Gateway latency range",
          "value": null,
          "unit": "ms",
          "status": "unknown",
          "detail": "Maximum minus minimum of successful gateway samples; not an Internet jitter measurement."
        },
        {
          "id": "dns_1",
          "label": "DNS: www.cloudflare.com",
          "value": 20,
          "unit": "ms",
          "status": "pass",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_1",
          "label": "HTTPS: www.cloudflare.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "dns_2",
          "label": "DNS: www.google.com",
          "value": 30,
          "unit": "ms",
          "status": "pass",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_2",
          "label": "HTTPS: www.google.com",
          "value": 101,
          "unit": "ms",
          "status": "pass",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "fixed_ip",
          "label": "Fixed-IP TCP probe",
          "value": "Reachable",
          "unit": "",
          "status": "pass",
          "detail": "One TCP connection to a fixed public endpoint, without DNS."
        }
      ],
      "evidence": [
        "Local gateway: 0 of 4 replies.",
        "DNS lookups: 2 of 2. Secure web probes: 1 of 2.",
        "Fixed external IP accepted a connection."
      ],
      "actions": [
        "Retry on a trusted connection during the problem.",
        "If the issue continues, compare a second device or a wired run."
      ],
      "limitations": [
        "SIMULATED: these values are not measurements from your network.",
        "Confidence labels describe supporting signals, not statistically calibrated probabilities.",
        "IPv6, radio signal strength, ISP segment ownership, and broadband speed are not measured.",
        "A brief sample may miss intermittent faults. A nonresponse can be filtering or an unavailable endpoint."
      ],
      "provenance": {
        "schema_version": "1.0",
        "ruleset": "netdoctor-2026.11",
        "source": "fixture",
        "gateway_sample_ms": [
          null,
          null,
          null,
          null
        ]
      }
    }
  },
  {
    "id": "offline",
    "title": "No usable network route",
    "description": "No default route or working external probe is available.",
    "report": {
      "mode": "demo",
      "scenario": "offline",
      "access": "unknown",
      "diagnosis": {
        "code": "offline",
        "title": "No usable route observed",
        "confidence": "medium",
        "summary": "No supported default IPv4 gateway was found and the external checks did not respond. This is not proof that every interface is offline."
      },
      "measurements": [
        {
          "id": "gateway",
          "label": "Local route",
          "value": "Not observed",
          "unit": "",
          "status": "unknown",
          "detail": "Controlled fixture; private IPv4 gateway only."
        },
        {
          "id": "latency",
          "label": "Gateway median latency",
          "value": null,
          "unit": "ms",
          "status": "unknown",
          "detail": "Median of successful ICMP replies. Missing replies can mean filtering."
        },
        {
          "id": "loss",
          "label": "Gateway probe loss",
          "value": null,
          "unit": "%",
          "status": "unknown",
          "detail": "0/0 replies; four requests at most."
        },
        {
          "id": "spread",
          "label": "Gateway latency range",
          "value": null,
          "unit": "ms",
          "status": "unknown",
          "detail": "Maximum minus minimum of successful gateway samples; not an Internet jitter measurement."
        },
        {
          "id": "dns_1",
          "label": "DNS: www.cloudflare.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_1",
          "label": "HTTPS: www.cloudflare.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "dns_2",
          "label": "DNS: www.google.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "System resolver; cached results are possible."
        },
        {
          "id": "https_2",
          "label": "HTTPS: www.google.com",
          "value": null,
          "unit": "ms",
          "status": "fail",
          "detail": "TLS-validated HEAD response. This is reachability, not throughput."
        },
        {
          "id": "fixed_ip",
          "label": "Fixed-IP TCP probe",
          "value": "Not reached",
          "unit": "",
          "status": "unknown",
          "detail": "One TCP connection to a fixed public endpoint, without DNS."
        }
      ],
      "evidence": [
        "No gateway samples.",
        "DNS lookups: 0 of 2. Secure web probes: 0 of 2.",
        "Fixed external IP reachability was not confirmed."
      ],
      "actions": [
        "Confirm Wi-Fi or Ethernet is connected and a sign-in page is not waiting.",
        "Reconnect and retest."
      ],
      "limitations": [
        "SIMULATED: these values are not measurements from your network.",
        "Confidence labels describe supporting signals, not statistically calibrated probabilities.",
        "IPv6, radio signal strength, ISP segment ownership, and broadband speed are not measured.",
        "A brief sample may miss intermittent faults. A nonresponse can be filtering or an unavailable endpoint."
      ],
      "provenance": {
        "schema_version": "1.0",
        "ruleset": "netdoctor-2026.11",
        "source": "fixture",
        "gateway_sample_ms": []
      }
    }
  }
];if(typeof module==='object')module.exports=fixtures;else root.ND_FIXTURES=fixtures;})(globalThis);
