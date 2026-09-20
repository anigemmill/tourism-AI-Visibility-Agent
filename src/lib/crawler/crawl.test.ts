import { describe, expect, it } from "vitest";
import * as cheerio from "cheerio";
import { extractStructuredFaqs } from "./crawl";

describe("extractStructuredFaqs", () => {
  it("extracts dt/dd definition list pairs", () => {
    const $ = cheerio.load(`
      <dl>
        <dt>How much does the tour cost?</dt>
        <dd>The Original Canopy Tour is $159 NZD per adult.</dd>
        <dt>Is it family-friendly?</dt>
        <dd>Yes, children aged 6 and up can join with a guardian.</dd>
      </dl>
    `);
    const faqs = extractStructuredFaqs($);
    expect(faqs).toHaveLength(2);
    expect(faqs[0].question).toBe("How much does the tour cost?");
    expect(faqs[0].answer).toContain("$159");
  });

  it("extracts details/summary accordion pairs", () => {
    const $ = cheerio.load(`
      <details>
        <summary>What should I bring?</summary>
        <p>Comfortable closed-toe shoes and a light jacket.</p>
      </details>
    `);
    const faqs = extractStructuredFaqs($);
    expect(faqs).toHaveLength(1);
    expect(faqs[0].question).toBe("What should I bring?");
    expect(faqs[0].answer).toContain("closed-toe shoes");
  });

  it("extracts a heading ending in '?' followed by its answer content", () => {
    const $ = cheerio.load(`
      <h3>What is the cancellation policy?</h3>
      <p>Free cancellation up to 48 hours before the tour start time.</p>
      <h3>Not a question</h3>
      <p>This should not be captured as an FAQ.</p>
    `);
    const faqs = extractStructuredFaqs($);
    expect(faqs).toHaveLength(1);
    expect(faqs[0].question).toBe("What is the cancellation policy?");
    expect(faqs[0].answer).toContain("48 hours");
  });

  it("skips questions with no substantial answer", () => {
    const $ = cheerio.load(`<dl><dt>Empty question?</dt><dd>No.</dd></dl>`);
    expect(extractStructuredFaqs($)).toHaveLength(0);
  });

  it("returns an empty array when there is no FAQ-shaped markup", () => {
    const $ = cheerio.load(`<p>Just some regular page content with no questions.</p>`);
    expect(extractStructuredFaqs($)).toHaveLength(0);
  });
});
