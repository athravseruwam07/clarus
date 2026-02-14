import type { FastifyPluginAsync } from "fastify";

import { featureContracts } from "../lib/featureRoadmap.js";

const roadmapRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/roadmap/features", async () => {
    return {
      features: featureContracts
    };
  });
};

export default roadmapRoute;
