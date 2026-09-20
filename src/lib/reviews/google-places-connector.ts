import type { ReviewConnector, ReviewFetchInput, ReviewFetchResult } from "./types";

interface FindPlaceResponse {
  candidates?: { place_id?: string }[];
  status?: string;
}
interface PlaceDetailsResponse {
  result?: { rating?: number; user_ratings_total?: number; url?: string };
  status?: string;
}

/** Google Places API — used for the business's Google review rating/count. */
export class GooglePlacesConnector implements ReviewConnector {
  readonly id = "google_places" as const;
  readonly label = "Google";
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
        error: "Google Places connector not configured (missing GOOGLE_PLACES_API_KEY).",
      };
    }

    try {
      const query = `${input.businessName} ${input.destination}`;
      const findUrl = new URL("https://maps.googleapis.com/maps/api/place/findplacefromtext/json");
      findUrl.searchParams.set("input", query);
      findUrl.searchParams.set("inputtype", "textquery");
      findUrl.searchParams.set("fields", "place_id");
      findUrl.searchParams.set("key", this.apiKey);

      const findRes = await fetch(findUrl.toString());
      const findData = (await findRes.json()) as FindPlaceResponse;
      const placeId = findData.candidates?.[0]?.place_id;
      if (!placeId) {
        return {
          platform: this.id,
          isDemoData: false,
          rating: null,
          reviewCount: null,
          sourceUrl: null,
          fetchedAt,
          error: `No Google Places match found for "${query}" (status: ${findData.status ?? "unknown"}).`,
        };
      }

      const detailsUrl = new URL("https://maps.googleapis.com/maps/api/place/details/json");
      detailsUrl.searchParams.set("place_id", placeId);
      detailsUrl.searchParams.set("fields", "rating,user_ratings_total,url");
      detailsUrl.searchParams.set("key", this.apiKey);

      const detailsRes = await fetch(detailsUrl.toString());
      const detailsData = (await detailsRes.json()) as PlaceDetailsResponse;

      return {
        platform: this.id,
        isDemoData: false,
        rating: detailsData.result?.rating ?? null,
        reviewCount: detailsData.result?.user_ratings_total ?? null,
        sourceUrl: detailsData.result?.url ?? null,
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
        error: err instanceof Error ? err.message : "Unknown Google Places error",
      };
    }
  }
}
