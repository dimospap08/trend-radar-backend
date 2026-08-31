import { fetchLiveTrends } from "../src/lib/trends.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "Method not allowed" });
  }
  const result = await fetchLiveTrends();
  const category = request.query?.category;
  const trends = category ? result.trends.filter((trend) => trend.category === category) : result.trends;
  return response.status(200).json({ ...result, trends });
}
