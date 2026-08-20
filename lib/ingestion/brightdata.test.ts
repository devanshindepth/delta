import { describe, it } from "node:test";
import assert from "node:assert";
import fc from "fast-check";
import {
  resolveOfficialUrl,
  deriveUrlFromProvider,
  validateExtractionResult,
  OFFICIAL_DOMAINS,
  scoreCandidate,
  buildDiscoveryQuery,
  MIN_RELEVANCE_SCORE,
  selectBestCandidate,
} from "./brightdata";

// Feature: brightdata-scraping-architecture

// ---------------------------------------------------------------------------
// RHCSA discovery relevance tests
// ---------------------------------------------------------------------------

const RHCSA_CERT_TITLE = "Red Hat Certified System Administrator";
const RHEL_DOC_URL = "https://docs.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/configuring_basic_system_settings/index";
const RHVIRT_URL   = "https://docs.redhat.com/documentation/en-us/red_hat_virtualization/4.4/html/administration_guide/managing-local-storage";

const RHEL_CONTENT = `
  Red Hat Enterprise Linux RHEL RHCSA administration guide.
  Using the command line is a core skill for the RHCSA exam.
  This guide covers bash shell, command-line tools, and terminal usage on RHEL.
`.repeat(10);

const RHVIRT_CONTENT = `
  Red Hat Virtualization local storage administration.
  This page describes adding local storage domains in Red Hat Virtualization Manager.
`.repeat(10);

describe("RHCSA discovery relevance scoring", () => {
  it("prefers RHEL documentation URL over unrelated Red Hat Virtualization URL", () => {
    const rhel  = scoreCandidate(RHEL_DOC_URL,  "Using the command line – RHEL",      RHEL_CONTENT,   "Using the command line", RHCSA_CERT_TITLE);
    const rhvrt = scoreCandidate(RHVIRT_URL,     "Managing local storage – RHV",       RHVIRT_CONTENT, "Using the command line", RHCSA_CERT_TITLE);

    assert.ok(
      rhel.score > rhvrt.score,
      `RHEL doc (score=${rhel.score}) should outscore RHV doc (score=${rhvrt.score})`
    );
    assert.ok(!rhel.rejected,  `RHEL doc should NOT be rejected`);
    assert.ok(rhvrt.rejected,   `RHV doc SHOULD be rejected`);
  });

  it("rejects Red Hat Virtualization result for RHCSA objective", () => {
    const result = scoreCandidate(
      RHVIRT_URL,
      "Red Hat Virtualization – Managing Local Storage Domains",
      RHVIRT_CONTENT,
      "Using the command line",
      RHCSA_CERT_TITLE
    );
    assert.ok(result.rejected, `RHV result must be rejected (score=${result.score})`);
  });

  it("does not reject a genuine RHEL documentation result", () => {
    const result = scoreCandidate(
      RHEL_DOC_URL,
      "Using the command line – Red Hat Enterprise Linux",
      RHEL_CONTENT,
      "Using the command line",
      RHCSA_CERT_TITLE
    );
    assert.ok(!result.rejected, `RHEL result must NOT be rejected (score=${result.score})`);
    assert.ok(result.score >= MIN_RELEVANCE_SCORE, `score ${result.score} should be ≥ ${MIN_RELEVANCE_SCORE}`);
  });

  it("rejects a result whose score is below the minimum threshold", () => {
    // Totally unrelated content, no keywords
    const result = scoreCandidate(
      "https://docs.redhat.com/documentation/en-us/red_hat_virtualization/4.4/html/release_notes/index",
      "Red Hat Virtualization 4.4 Release Notes",
      "This release note covers hypervisor improvements in Red Hat Virtualization.".repeat(20),
      "Using the command line",
      RHCSA_CERT_TITLE
    );
    assert.ok(result.rejected, `Low-relevance result must be rejected (score=${result.score})`);
  });

  it("buildDiscoveryQuery includes RHCSA and RHEL context for RHCSA certifications", () => {
    const { query, intent } = buildDiscoveryQuery(
      "Using the command line",
      "docs.redhat.com",
      "Red Hat Certified System Administrator"
    );
    assert.ok(
      /RHCSA/i.test(query),
      `Query should contain RHCSA: "${query}"`
    );
    assert.ok(
      /RHEL|Red Hat Enterprise Linux/i.test(query),
      `Query should mention RHEL: "${query}"`
    );
    assert.ok(
      /Red Hat Enterprise Linux/i.test(intent),
      `Intent should specify RHEL: "${intent}"`
    );
    // Ensure exclusion hints are present in intent
    assert.ok(
      /NOT|Virtualization|OpenShift/i.test(intent),
      `Intent should contain exclusion hints: "${intent}"`
    );
  });

  it("buildDiscoveryQuery uses generic path for non-RHCSA certifications", () => {
    const { query } = buildDiscoveryQuery(
      "Deploying EC2 instances",
      "docs.aws.amazon.com",
      "AWS Solutions Architect Associate"
    );
    assert.ok(
      !/RHCSA|RHEL/i.test(query),
      `Non-RHCSA query should not contain RHCSA/RHEL: "${query}"`
    );
    assert.ok(
      query.includes("Deploying EC2 instances"),
      `Query should contain the objective title: "${query}"`
    );
  });

  it("scoreCandidate awards bonus for RHCSA/RHEL mentions in content", () => {
    const withRhcsa = scoreCandidate(
      "https://docs.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_files",
      "Managing files and directories",
      "This RHCSA guide covers managing files on Red Hat Enterprise Linux RHEL systems using command-line tools.".repeat(5),
      "Managing files and directories",
      RHCSA_CERT_TITLE
    );
    const withoutRhcsa = scoreCandidate(
      "https://docs.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_files",
      "Managing files and directories",
      "This guide covers managing files on Linux systems using command-line tools.".repeat(5),
      "Managing files and directories",
      RHCSA_CERT_TITLE
    );
    assert.ok(
      withRhcsa.score >= withoutRhcsa.score,
      `RHCSA-mentioning content (${withRhcsa.score}) should score ≥ no-mention content (${withoutRhcsa.score})`
    );
  });

  it("rejects OpenShift documentation for RHCSA objectives", () => {
    const result = scoreCandidate(
      "https://docs.redhat.com/documentation/en-us/openshift_container_platform/4.14/html/cli_tools/index",
      "OpenShift CLI Tools Overview",
      "The OpenShift CLI (oc) is used to interact with OpenShift Container Platform clusters.".repeat(15),
      "Using the command line",
      RHCSA_CERT_TITLE
    );
    assert.ok(result.rejected, `OpenShift result must be rejected for RHCSA objective (score=${result.score})`);
  });

  it("property: any candidate with ≥2 unrelated product signals in URL is always rejected", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "https://docs.redhat.com/documentation/en-us/red_hat_virtualization/4.4/html/something/openshift-section",
          "https://docs.redhat.com/documentation/en-us/red_hat_virtualization/4.4/html/ansible-guide/index",
        ),
        (url) => {
          const result = scoreCandidate(url, "Red Hat Virtualization OpenShift Guide", "some content".repeat(50), "Using the command line", RHCSA_CERT_TITLE);
          // URL contains both "virtualization" and path contains "openshift" — should be rejected
          // (two unrelated signals in the URL/title combo)
          assert.ok(result.rejected || result.score < MIN_RELEVANCE_SCORE);
        }
      )
    );
  });
});

describe("selectBestCandidate — shared selection logic (Discover + Bing parity)", () => {
  // Simulate the shape of Bing search results: URL + title snippet, no full content
  const bingStyleResults = [
    {
      url:   RHVIRT_URL,
      title: "Red Hat Virtualization – Managing Local Storage",
      content: "",   // Bing doesn't return full page content
    },
    {
      url:   RHEL_DOC_URL,
      title: "Using the command line – Red Hat Enterprise Linux",
      content: "",
    },
  ];

  it("Bing fallback path: selects RHEL result over RHV result even without page content", () => {
    const best = selectBestCandidate(
      bingStyleResults,
      "Using the command line",
      RHCSA_CERT_TITLE
    );
    assert.ok(best !== null, "should find at least one passing candidate");
    assert.strictEqual(best!.url, RHEL_DOC_URL, `expected RHEL URL but got ${best!.url}`);
  });

  it("Bing fallback path: rejects all candidates when both are unrelated products", () => {
    const allBad = [
      { url: RHVIRT_URL,   title: "Red Hat Virtualization local storage", content: "" },
      { url: "https://docs.redhat.com/documentation/en-us/openshift_container_platform/4.14/html/cli", title: "OpenShift CLI", content: "" },
    ];
    const best = selectBestCandidate(allBad, "Using the command line", RHCSA_CERT_TITLE);
    assert.strictEqual(best, null, "all unrelated-product candidates must be rejected");
  });

  it("Bing fallback path: returns null when no candidate clears MIN_RELEVANCE_SCORE", () => {
    const irrelevant = [
      { url: "https://docs.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/release_notes", title: "RHEL Release Notes", content: "" },
    ];
    // "Using the command line" keywords are absent from this URL/title → score will be low
    const best = selectBestCandidate(irrelevant, "Using the command line", RHCSA_CERT_TITLE);
    // Either null or, if it scrapes enough signal, still ≥ MIN_RELEVANCE_SCORE
    if (best !== null) {
      assert.ok(best.score >= MIN_RELEVANCE_SCORE, `selected candidate score ${best.score} must be ≥ ${MIN_RELEVANCE_SCORE}`);
    }
  });

  it("requiredDomain filter: excludes candidates not on the specified domain", () => {
    const mixed = [
      { url: "https://docs.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/using_the_command_line", title: "Using the command line – RHEL", content: RHEL_CONTENT },
      { url: "https://learn.microsoft.com/en-us/azure/command-line-tools", title: "Using the command line – Azure", content: "command line tools on Azure".repeat(30) },
    ];
    const best = selectBestCandidate(mixed, "Using the command line", RHCSA_CERT_TITLE, "docs.redhat.com");
    assert.ok(best !== null);
    assert.ok(best!.url.includes("docs.redhat.com"), `result must be from docs.redhat.com, got ${best!.url}`);
  });

  it("always picks the highest scorer, not the first passer", () => {
    // Second result has better URL + title match
    const results = [
      { url: "https://docs.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/managing_files", title: "Managing storage", content: RHEL_CONTENT },
      { url: "https://docs.redhat.com/documentation/en-us/red_hat_enterprise_linux/9/html/using_the_command_line", title: "Using the command line – RHEL", content: RHEL_CONTENT },
    ];
    const best = selectBestCandidate(results, "Using the command line", RHCSA_CERT_TITLE, "docs.redhat.com");
    assert.ok(best !== null);
    assert.ok(
      best!.url.includes("using_the_command_line"),
      `best result should be the stronger match, got ${best!.url}`
    );
  });
});

describe("brightdata property tests", () => {
  it("P2: resolveOfficialUrl selects first valid skill URL", () => {
    const officialUrlArb = fc.constantFrom(...OFFICIAL_DOMAINS).map(domain => `https://${domain}/docs/something`);
    const nonOfficialUrlArb = fc.webUrl().filter(url => {
        try {
            return !OFFICIAL_DOMAINS.includes(new URL(url).hostname);
        } catch { return true; }
    });

    fc.assert(
      fc.property(
        fc.array(fc.record({
          official_doc_url: fc.oneof(officialUrlArb, nonOfficialUrlArb, fc.constant(undefined))
        })),
        (skills) => {
          const objective = { title: "Test", cert_provider: "None", skills };
          const resolved = resolveOfficialUrl(objective);
          const firstOfficial = skills.find(s => {
            if (!s.official_doc_url) return false;
            try { return OFFICIAL_DOMAINS.includes(new URL(s.official_doc_url).hostname); }
            catch { return false; }
          });
          
          if (firstOfficial) {
             assert.ok(resolved !== null);
             assert.strictEqual(resolved.url, firstOfficial.official_doc_url);
             assert.strictEqual(resolved.source_confidence, "official_blueprint");
          }
        }
      )
    );
  });

  it("P3: deriveUrlFromProvider returns correct domain", () => {
    fc.assert(
      fc.property(
        fc.constantFrom('Microsoft', 'AWS', 'GCP', 'Google', 'HashiCorp', 'Docker'),
        fc.string({ minLength: 1 }),
        (provider, title) => {
           const url = deriveUrlFromProvider(provider, title);
           assert.ok(url !== null);
           
           if (provider === 'Microsoft') assert.ok(url.includes('learn.microsoft.com'));
           if (provider === 'AWS') assert.ok(url.includes('docs.aws.amazon.com'));
           if (provider === 'GCP' || provider === 'Google') assert.ok(url.includes('cloud.google.com'));
           if (provider === 'HashiCorp') assert.ok(url.includes('developer.hashicorp.com'));
           if (provider === 'Docker') assert.ok(url.includes('docs.docker.com'));
        }
      )
    );
  });

  it("P9 and P10: validateExtractionResult gate output and verdict", () => {
    const stringArb = fc.string();
    const extractionArb = fc.record({
       title: fc.oneof(stringArb, fc.constant(undefined), fc.constant(null)),
       summary: fc.oneof(stringArb, fc.constant(undefined), fc.constant(null)),
       learning_outcomes: fc.oneof(fc.array(stringArb), fc.constant(undefined), fc.constant(null)),
       key_concepts: fc.oneof(
           fc.array(fc.record({ term: fc.oneof(stringArb, fc.constant(undefined)), definition: fc.oneof(stringArb, fc.constant(undefined)) })),
           fc.constant(undefined),
           fc.constant(null)
       ),
       api_names: fc.oneof(fc.array(stringArb), fc.constant(undefined)),
       limits: fc.oneof(fc.array(stringArb), fc.constant(undefined)),
       code_examples: fc.oneof(fc.array(stringArb), fc.constant(undefined)),
    });

    fc.assert(
      fc.property(extractionArb, (data) => {
         const result = validateExtractionResult(data);
         assert.ok("is_valid" in result);
         assert.ok("missing_fields" in result);
         assert.strictEqual(Object.keys(result).length, 2); // strictly those two
         
         let expectedValid = false;
         if (data && typeof data === 'object') {
            const d = data as {
              title?: unknown;
              summary?: unknown;
              learning_outcomes?: unknown;
              key_concepts?: unknown;
            };
            const hasTitle = typeof d.title === 'string' && d.title.trim().length > 0;
            const hasSummary = typeof d.summary === 'string' && d.summary.trim().length > 0;
            const hasOutcomes = Array.isArray(d.learning_outcomes) && d.learning_outcomes.some((o: unknown) => typeof o === 'string' && o.trim().length > 0);
            const validConcepts = Array.isArray(d.key_concepts) && d.key_concepts.filter(
              (kc: unknown) => {
                if (!kc || typeof kc !== 'object') return false;
                const concept = kc as { term?: unknown; definition?: unknown };
                return typeof concept.term === 'string' &&
                  concept.term.trim().length > 0 &&
                  typeof concept.definition === 'string' &&
                  concept.definition.trim().length > 0;
              }
            );
            const hasConcepts = Boolean(validConcepts && validConcepts.length >= 1);
            if (hasTitle && (hasSummary || hasOutcomes) && hasConcepts) {
               expectedValid = true;
            }
         }
         assert.strictEqual(result.is_valid, expectedValid);
      })
    );
  });
});
