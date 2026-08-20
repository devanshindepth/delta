import { describe, it } from "node:test";
import assert from "node:assert";
import fc from "fast-check";
import {
  resolveOfficialUrl,
  deriveUrlFromProvider,
  validateExtractionResult,
  OFFICIAL_DOMAINS
} from "./brightdata";

// Feature: brightdata-scraping-architecture

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
    const nonEmptyStringArb = fc.string({ minLength: 1 }).filter(s => s.trim().length > 0);
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
            const d = data as any;
            const hasTitle = typeof d.title === 'string' && d.title.trim().length > 0;
            const hasSummary = typeof d.summary === 'string' && d.summary.trim().length > 0;
            const hasOutcomes = Array.isArray(d.learning_outcomes) && d.learning_outcomes.some((o: any) => typeof o === 'string' && o.trim().length > 0);
            const validConcepts = Array.isArray(d.key_concepts) && d.key_concepts.filter(
              (kc: any) => kc && typeof kc.term === 'string' && kc.term.trim().length > 0 && typeof kc.definition === 'string' && kc.definition.trim().length > 0
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
