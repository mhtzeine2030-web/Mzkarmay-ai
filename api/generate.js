
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY is missing"
    });
  }

  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== "string") {
    return res.status(400).json({
      error: "Prompt is required"
    });
  }

  const models = [
    "gemini-3.8-flash",
    "gemini-3.5-flash-lite"
  ];

  let lastError = "Gemini service is unavailable";
  let lastStatus = 503;

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
          signal: AbortSignal.timeout(15000),
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ]
          })
        }
      );

      const responseText = await response.text();

      let data;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = {};
      }

      if (response.ok) {
        const result = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("");

        if (result) {
          return res.status(200).json({
            result,
            model
          });
        }

        lastError = "Gemini returned an empty response";
        lastStatus = 502;
        continue;
      }

      lastError =
        data.error?.message || "Gemini API error";
      lastStatus = response.status;

      console.error("Gemini error:", model, lastStatus, lastError);

      if (![429, 500, 503, 504].includes(response.status)) {
        return res.status(response.status).json({
          error: lastError
        });
      }

    } catch (error) {
      lastError = error.name === "TimeoutError"
        ? `${model} timed out`
        : error.message;

      lastStatus = 504;

      console.error("Gemini request failed:", model, lastError);
    }
  }

  return res.status(lastStatus).json({
    error: "Both Gemini models are currently unavailable. Please try again shortly.",
    details: lastError
  });
}
