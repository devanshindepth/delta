import { NextRequest, NextResponse } from "next/server";
import { getCertifications, saveCertification, updateCertificationActivity, saveExamVersion, saveDomain, saveObjective } from "@/lib/db/queries";
import { createGroqJsonCompletion } from "@/lib/groq";
import { scrapeWithBrightData } from "@/lib/ingestion/brightdata";
import crypto from "crypto";

export const maxDuration = 300; // allow up to 5 mins

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query) {
      return NextResponse.json({ success: false, error: "query is required" }, { status: 400 });
    }

    // 1. Identify the cert from the layman term
    const certInfoPrompt = `
      You are an expert at IT certifications.
      A user wants to prepare for a certification based on this layman description: "${query}"
      Identify the best matching professional certification (e.g. AWS Certified Solutions Architect - Associate).
      If it's not a standard IT cert, create a logical one.

      Return a JSON object with exactly these keys:
      - "code": short acronym (e.g., "AWS-SAA")
      - "title": full title
      - "provider": vendor name (e.g., "AWS", "Google", "Microsoft")
      - "level": beginner, intermediate, or advanced
      - "official_url": URL to the official exam guide or syllabus webpage.
      - "description": 1-2 sentences describing it.
      - "icon_prefix": A 3-char ASCII bracket prefix like "[~]" or "[A]".
    `;
    const certInfo = await createGroqJsonCompletion(certInfoPrompt);

    // 2. Check if we already have this cert
    const existingCerts = getCertifications();
    const existing = existingCerts.find(
      c => c.code?.toLowerCase() === certInfo.code?.toLowerCase() || 
           c.title?.toLowerCase() === certInfo.title?.toLowerCase()
    );
    
    if (existing) {
      // Update activity and return
      updateCertificationActivity(existing.id);
      return NextResponse.json({ success: true, data: existing, existed: true });
    }

    // 3. Scrape the official exam guide page using Bright Data
    let scrapedText = "";
    let scrapeMethod = "none";
    try {
      console.log(`[generate] Scraping ${certInfo.official_url} via Bright Data...`);
      const result = await scrapeWithBrightData(certInfo.official_url);
      scrapedText = result.rawContent;
      scrapeMethod = "brightdata";
      console.log(`[generate] Scraped ${scrapedText.length} chars from official URL`);
    } catch (err: any) {
      console.warn(`[generate] Bright Data scrape failed: ${err.message}. Falling back to LLM knowledge only.`);
    }

    // 4. Generate syllabus grounded in scraped content
    const hasRealContent = scrapedText.trim().length > 200;
    const syllabusPrompt = `
      Generate a certification syllabus for "${certInfo.title}" (${certInfo.code}).
      ${hasRealContent
        ? `The following is REAL content scraped from the official exam guide page. Use it as your primary source for domain names, objective codes, and topic coverage. Do not fabricate domain percentages or objective codes that are not present in this content.

Official page content:
---
${scrapedText.substring(0, 12000)}
---`
        : `No official page content was available. Generate the syllabus from your training knowledge, being careful to use accurate domain names and objective codes for this certification.`
      }

      Return a JSON object containing a "domains" array.
      Each domain should have:
      - "domain_code": string (e.g. "D1")
      - "title": string (use the real domain title from the scraped content where available)
      - "objectives": array of objects, each with { "objective_code": string (e.g. "1.1"), "title": string, "description": string }
      
      Keep it to 3-6 domains and 2-5 objectives per domain. Accuracy over completeness.
    `;
    const syllabus = await createGroqJsonCompletion(syllabusPrompt);

    // 5. Save everything to DB
    const certId = `cert-${(certInfo.code || 'cert').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${crypto.randomBytes(2).toString('hex')}`;
    
    saveCertification({
      id: certId,
      code: certInfo.code || 'CERT',
      title: certInfo.title || query,
      provider: certInfo.provider || 'General',
      level: certInfo.level || 'intermediate',
      official_url: certInfo.official_url || 'https://delta.dev',
      description: certInfo.description || `Study guide for ${query}`,
      icon_prefix: certInfo.icon_prefix || '[~]'
    });

    const versionId = `ev-${Date.now()}`;
    saveExamVersion({
      id: versionId,
      certification_id: certId,
      version_code: "v1",
      status: "active"
    });

    let domainSort = 1;
    for (const dom of (syllabus.domains || [])) {
      const domainId = `dom-${crypto.randomBytes(4).toString('hex')}`;
      saveDomain({
        id: domainId,
        exam_version_id: versionId,
        domain_code: dom.domain_code || `D${domainSort}`,
        title: dom.title || `Domain ${domainSort}`,
        sort_order: domainSort++
      });

      let objSort = 1;
      for (const obj of (dom.objectives || [])) {
        const objId = `obj-${crypto.randomBytes(4).toString('hex')}`;
        saveObjective({
          id: objId,
          domain_id: domainId,
          objective_code: obj.objective_code || `${domainSort - 1}.${objSort}`,
          title: obj.title || `Objective ${objSort}`,
          description: obj.description || '',
          sort_order: objSort++
        });
      }
    }

    const savedCert = {
      id: certId,
      code: certInfo.code,
      title: certInfo.title,
      provider: certInfo.provider,
      level: certInfo.level,
      description: certInfo.description,
      icon_prefix: certInfo.icon_prefix || "[~]"
    };

    return NextResponse.json({ success: true, data: savedCert, existed: false });
  } catch (error: any) {
    console.error("[generate error]", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
