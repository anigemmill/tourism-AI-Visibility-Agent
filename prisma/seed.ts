/**
 * Seeds one fully-populated demo tourism business so the whole platform —
 * onboarding through daily digest — can be explored locally without any
 * API keys. Every AI monitoring result seeded here comes from the same
 * DemoConnector used at runtime when no key is configured, and is stored
 * with `isDemoData: true`, exactly as it would be in production demo mode.
 */
import { PrismaClient, type Prisma } from "@prisma/client";
import { generateTravellerQueries } from "../src/lib/queries/generate-queries";
import { DemoConnector } from "../src/lib/connectors/demo-connector";
import { analyzeMention } from "../src/lib/monitoring/analyze-mention";
import { computeAndSaveVisibilitySnapshot } from "../src/lib/scoring/visibility-score";
import { generateContentOpportunities, saveContentOpportunities } from "../src/lib/opportunities/generate-opportunities";
import { runFactCheck, saveFactCheckIssues } from "../src/lib/fact-check/fact-checker";
import { generateDailyDigest, saveDailyDigest } from "../src/lib/digest/daily-digest";

const prisma = new PrismaClient();

async function main() {
  console.log("Clearing existing demo data...");
  await prisma.business.deleteMany({ where: { name: "Rotorua Canopy Tours (Demo)" } });

  console.log("Creating demo business...");
  const business = await prisma.business.create({
    data: {
      name: "Rotorua Canopy Tours (Demo)",
      website: "https://example-rotorua-canopy-tours.demo",
      destination: "Rotorua, New Zealand",
      category: "Eco / Adventure Tours",
      bookingUrl: "https://example-rotorua-canopy-tours.demo/book",
      description:
        "Guided zipline and canopy walk tours through native New Zealand forest, focused on conservation and small-group experiences.",
      targetMarkets: ["Australia", "USA", "UK", "Domestic NZ"],
      targetSegments: ["families", "adventurous couples", "eco-conscious travellers"],
      socialProfiles: { instagram: "@rotoruacanopytours_demo", facebook: "facebook.com/rotoruacanopytours-demo" },
      competitorLinks: {
        create: [
          { competitorName: "Skyline Rotorua", competitorWebsite: "https://skyline.co.nz" },
          { competitorName: "Velocity Valley", competitorWebsite: "https://velocityvalley.co.nz" },
          { competitorName: "Redwoods Treewalk", competitorWebsite: "https://theredwoods.co.nz" },
        ],
      },
      products: {
        create: [
          {
            name: "Original Canopy Tour",
            description: "3-hour guided zipline tour through native forest canopy.",
            priceAmount: 159,
            priceCurrency: "NZD",
            priceUnit: "per adult",
            durationMinutes: 180,
            audiences: ["families", "adventurous couples"],
            confidence: 1,
          },
          {
            name: "Ultimate Canopy Tour",
            description: "Extended tour with additional ziplines and swing bridges.",
            priceAmount: 209,
            priceCurrency: "NZD",
            priceUnit: "per adult",
            durationMinutes: 240,
            audiences: ["adventurous couples"],
            confidence: 1,
          },
        ],
      },
      experiences: {
        create: [
          { name: "Native Forest Zipline", description: "Ziplining through 400-year-old native trees.", category: "adventure", audiences: ["families"], confidence: 1 },
          { name: "Conservation Night Tour", description: "Evening tour focused on native wildlife and conservation work.", category: "eco", audiences: ["eco-conscious travellers"], confidence: 1 },
        ],
      },
      locations: {
        create: [
          {
            label: "Rotorua Canopy Tours Base",
            address: "Waikite Valley Road",
            region: "Rotorua",
            country: "New Zealand",
            openingHours: { mon: "8:00-17:00", tue: "8:00-17:00", wed: "8:00-17:00", thu: "8:00-17:00", fri: "8:00-17:00", sat: "8:00-17:00", sun: "8:00-17:00" },
            accessibility: "Not wheelchair accessible due to forest terrain; minimum age 6.",
            confidence: 1,
          },
        ],
      },
      faqs: {
        create: [
          { question: "How much does the canopy tour cost?", answer: "The Original Canopy Tour is $159 NZD per adult; the Ultimate Canopy Tour is $209 NZD per adult.", confidence: 1 },
          { question: "Is this tour good for families?", answer: "Yes, children aged 6 and up can join the Original Canopy Tour with a guardian.", confidence: 1 },
          { question: "What is the cancellation policy?", answer: "Free cancellation up to 48 hours before the tour start time.", confidence: 1 },
          { question: "How do I book?", answer: "Book directly online at the booking link, or by phone.", confidence: 1 },
        ],
      },
      policies: {
        create: [
          { type: "cancellation", summary: "Free cancellation up to 48 hours before the tour start time.", confidence: 1 },
          { type: "accessibility", summary: "Not wheelchair accessible due to forest terrain; minimum age 6.", confidence: 1 },
        ],
      },
      reviews: {
        create: [
          { platform: "Google", rating: 4.9, reviewCount: 3400 },
          { platform: "TripAdvisor", rating: 5.0, reviewCount: 2100 },
        ],
      },
      credentials: {
        create: [
          { type: "award", name: "TripAdvisor Travellers' Choice Award", issuer: "TripAdvisor", year: 2025, confidence: 1 },
          { type: "certification", name: "Qualmark Gold Sustainable Tourism Business Award", issuer: "Qualmark", confidence: 1 },
        ],
      },
      differentiators: {
        create: [
          { statement: "Profits fund an active pest-control and native bird conservation program in the forest the tours operate in.", category: "sustainability", confidence: 1 },
          { statement: "Small group sizes, capped at 10 guests per guide.", category: "exclusivity", confidence: 1 },
        ],
      },
    },
  });

  console.log("Generating traveller queries...");
  const experiences = await prisma.experience.findMany({ where: { businessId: business.id } });
  const generatedQueries = generateTravellerQueries({
    destination: business.destination,
    category: business.category,
    targetSegments: business.targetSegments,
    experienceNames: experiences.map((e) => e.name),
    businessName: business.name,
  });
  await prisma.travellerQuery.createMany({
    data: generatedQueries.map((q) => ({
      businessId: business.id,
      text: q.text,
      intent: q.intent,
      segment: q.segment,
      commercialIntent: q.commercialIntent,
    })),
  });

  console.log("Running demo AI monitoring...");
  const queries = await prisma.travellerQuery.findMany({ where: { businessId: business.id } });
  const competitorNames = ["Skyline Rotorua", "Velocity Valley", "Redwoods Treewalk"];
  const demoContext = {
    businessName: business.name,
    destination: business.destination,
    category: business.category,
    competitorNames,
  };
  const connectors = [
    new DemoConnector("openai", "ChatGPT (OpenAI)"),
    new DemoConnector("anthropic", "Claude (Anthropic)"),
    new DemoConnector("perplexity", "Perplexity"),
    new DemoConnector("google_ai_overview", "Google AI Overview"),
  ];

  for (const query of queries) {
    for (const connector of connectors) {
      const response = await connector.ask(query.text, demoContext);
      const mention = analyzeMention(response.responseText, business.name, competitorNames);
      await prisma.discoveryResult.create({
        data: {
          businessId: business.id,
          queryId: query.id,
          platform: response.platform,
          isDemoData: true,
          businessAppears: mention.businessAppears,
          positionRank: mention.positionRank,
          howDescribed: mention.howDescribed,
          competitorsMentioned: mention.competitorsMentioned as unknown as Prisma.InputJsonValue,
          sources: response.sources as unknown as Prisma.InputJsonValue,
          responseText: response.responseText,
          confidence: mention.confidence,
        },
      });
    }
  }

  console.log("Computing visibility snapshot...");
  await computeAndSaveVisibilitySnapshot(business.id);

  console.log("Generating content opportunities...");
  const opportunityDrafts = await generateContentOpportunities(business.id);
  await saveContentOpportunities(business.id, opportunityDrafts);

  console.log("Running fact-checker...");
  const factCheckDrafts = await runFactCheck(business.id);
  await saveFactCheckIssues(business.id, factCheckDrafts);

  console.log("Generating today's digest...");
  const digestContent = await generateDailyDigest(business.id);
  await saveDailyDigest(business.id, digestContent);

  console.log(`\nDone. Demo business id: ${business.id}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
