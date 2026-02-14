import type { FastifyRequest } from "fastify";

import type { FeatureLane } from "./featureRoadmap.js";

export interface PlaceholderEnvelope {
  implemented: false;
  feature: string;
  lane: FeatureLane;
  message: string;
  nextAction: string;
  requestEcho: {
    path: string;
    method: string;
    query: unknown;
    body: unknown;
  };
}

export function buildPlaceholderResponse(input: {
  request: FastifyRequest;
  feature: string;
  lane: FeatureLane;
  nextAction: string;
}): PlaceholderEnvelope {
  return {
    implemented: false,
    feature: input.feature,
    lane: input.lane,
    message: "placeholder endpoint ready for implementation",
    nextAction: input.nextAction,
    requestEcho: {
      path: input.request.routeOptions.url ?? input.request.url,
      method: input.request.method,
      query: input.request.query,
      body: input.request.body ?? null
    }
  };
}
