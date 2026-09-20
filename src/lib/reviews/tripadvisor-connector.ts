import type { ReviewConnector, ReviewFetchInput, ReviewFetchResult } from "./types";

interface TripAdvisorSearchResponse {
  data?: { location_id?: string; name?: string }[];
}
interface TripAdvisorDetailsResponse {
  rating?: string;
  num_reviews?: string;
  web_url?: string;
}

/** TripAdvisor Content API — used for the business's TripAdvisor rating/review count. */
export class TripAdvisorConnector implements ReviewConnector {
  readonly id = "tripadvisor" as const;
  readonly label = "TripAdvisor";
  readonly isConfigured: boolean;

  constructor(private apiKey?: string) {
    this.isConfigured = Boolean(apiKey);
  }

  async fetch(input: ReviewFetchInput): Promise<ReviewFetchResult> {
    const fetchedAt = new Date().toISOString();
    if (!this.apiKey) {
      return {
        platform: this.id,
        isDemoData: false,
        rating: null,
        reviewCount: null,
        sourceUrl: null,
        fetchedAt,
        error: "TripAdvisor connector not configured (missing TRIPADVISOR_API_KEY).",
      };
    }

    try {
      const searchUrl = new URL("https://api.content.tripadvisor.com/api/v1/location/search");
      searchUrl.searchParams.set("key", this.apiKey);
      searchUrl.searchParams.set("searchQuery", `${input.businessName} ${input.destination}`);
      searchUrl.searchParams.set("language", "en");

      const searchRes = await fetch(searchUrl.toString(), { headers: { Accept: "application/json" } });
      const searchData = (await searchRes.json()) as TripAdvisorSearchResponse;
      const locationId = searchData.data?.[0]?.location_id;
      if (!locationId) {
        return {
          platform: this.id,
          isDemoData: false,
          rating: null,
          reviewCount: null,
          sourceUrl: null,
          fetchedAt,
          error: `No TripAdvisor listing found for "${input.businessName} ${input.destination}".`,
        };
      }

      const detailsUrl = new URL(`https://api.content.tripadvisor.com/api/v1/location/${locationId}/details`);
      detailsUrl.searchParams.set("key", this.apiKey);
      detailsUrl.searchParams.set("language", "en");

      const detailsRes = await fetch(detailsUrl.toString(), { headers: { Accept: "application/json" } });
      const details = (await detailsRes.json()) as TripAdvisorDetailsResponse;

      return {
        platform: this.id,
        isDemoData: false,
        rating: details.rating ? Number(details.rating) : null,
        reviewCount: details.num_reviews ? Number(details.num_reviews) : null,
        sourceUrl: details.web_url ?? null,
        fetchedAt,
      };
    } catch (err) {
      return {
        platform: this.id,
        isDemoData: false,
        rating: null,
        reviewCount: null,
        sourceUrl: null,
        fetchedAt,
        error: err instanceof Error ? err.message : "Unknown TripAdvisor error",
      };
    }
  }
}
