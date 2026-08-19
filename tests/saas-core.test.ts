import { test, describe } from "node:test";
import assert from "node:assert";
import { getCertifications, getExamVersion, getKnowledgeGraph, getFreshnessAlerts } from "../lib/db/queries";

describe("Delta Certification Prep Core", () => {
  test("seeds multiple certifications including Azure, AWS, GCP, and CKA", () => {
    const certs = getCertifications();
    assert.ok(certs.length >= 3, "Must have at least 3 certifications seeded");

    const codes = certs.map((c: any) => c.code);
    assert.ok(codes.includes("AI-103"), "Must include AI-103");
    assert.ok(codes.includes("SAA-C03"), "Must include SAA-C03");
    assert.ok(codes.includes("ACE"), "Must include ACE");
  });

  test("Azure AI-103 has an active exam version with domains and objectives", () => {
    const certs = getCertifications();
    const ai103 = certs.find((c: any) => c.code === "AI-103");
    assert.ok(ai103, "AI-103 must exist");

    const version = getExamVersion(ai103.id);
    assert.ok(version, "Active exam version must exist for AI-103");
    assert.strictEqual(version.status, "active");

    const graph = getKnowledgeGraph(version.id);
    assert.ok(graph.length >= 3, "Must have at least 3 domains");

    const allObjectives = graph.flatMap((d: any) => d.objectives || []);
    assert.ok(allObjectives.length >= 5, "Must have at least 5 objectives");
  });

  test("freshness alerts are seeded for deprecated services", () => {
    const alerts = getFreshnessAlerts(false);
    assert.ok(alerts.length >= 1, "Must have at least 1 freshness alert seeded");

    const deprecatedAlert = alerts.find((a: any) => a.alert_type === "deprecated");
    assert.ok(deprecatedAlert, "Must have a deprecated service alert");
    assert.ok(
      deprecatedAlert.title.toLowerCase().includes("luis"),
      "Alert must mention LUIS deprecation"
    );
  });
});
