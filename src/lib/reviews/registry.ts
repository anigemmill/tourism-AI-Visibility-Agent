import type { ReviewConnector, ReviewPlatformId } from "./types";
import { DemoReviewConnector } from "./demo-review-connector";
import { GooglePlacesConnector } from "./google-places-connector";
import { TripAdvisorConnector } from "./tripadvisor-connector";

const LABELS: Record<ReviewPlatformId, string> = {
  google_places: "Google",
  tripadvisor: "TripAdvisor",
};

export function getReviewConnectors(): ReviewConnector[] {
  const google = new GooglePlacesConnector(process.env.GOOGLE_PLACES_API_KEY);
  const tripadvisor = new TripAdvisorConnector(process.env.TRIPADVISOR_API_KEY);

  return [google, tripadvisor].map((connector) =>
    connector.isConfigured ? connector : new DemoReviewConnector(connector.id, LABELS[connector.id])
  );
}
