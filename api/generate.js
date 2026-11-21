export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY is missing" });
  }

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({ error: "Prompt is required" });
  }

  // Try the primary model, then two alternatives if Google is overloaded.
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite"
  ];

  let lastStatus = 503;
  let lastMessage = "Gemini models are temporarily unavailable.";

  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey
          },
          signal: AbortSignal.timeout(18000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        lastStatus = response.status;
        lastMessage = data.error?.message || "Gemini API error";
        console.error("Gemini API error:", model, response.status, data);

        // Try another model only for temporary capacity/rate/server errors.
        if ([429, 500, 502, 503, 504].includes(response.status)) {
          continue;
        }

        return res.status(response.status).json({ error: lastMessage });
      }

      const result = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("");

      if (!result) {
        lastStatus = 502;
        lastMessage = "Gemini returned an empty response";
        continue;
      }

      return res.status(200).json({ result, model });
    } catch (error) {
      lastStatus = 504;
      lastMessage = error.name === "TimeoutError"
        ? "Gemini request timed out"
        : "Gemini connection failed";
      console.error("Gemini request failed:", model, error);
    }
  }

  return res.status(lastStatus).json({
    error: lastMessage + " Tried the available backup models. Please try again shortly."
  });
}
