export type ReviewPlatformId = "google_places" | "tripadvisor";

export interface ReviewFetchInput {
  businessName: string;
  destination: string;
  website: string;
}

export interface ReviewFetchResult {
  platform: ReviewPlatformId;
  isDemoData: boolean;
  rating: number | null;
  reviewCount: number | null;
  sourceUrl: string | null;
  fetchedAt: string;
  error?: string;
}

export interface ReviewConnector {
  readonly id: ReviewPlatformId;
  readonly label: string;
  readonly isConfigured: boolean;
  fetch(input: ReviewFetchInput): Promise<ReviewFetchResult>;
}
