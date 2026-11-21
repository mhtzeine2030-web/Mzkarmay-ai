
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

  let errors = [];

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
          signal: AbortSignal.timeout(10000),
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

        errors.push(`${model}: Empty response`);
        continue;
      }

      const message = data.error?.message || "API error";

      errors.push(`${model}: ${response.status} - ${message}`);

      console.error("Gemini API error:", model, response.status, message);

      if (![429, 500, 502, 503, 504].includes(response.status)) {
        return res.status(response.status).json({
          error: message
        });
      }

    } catch (error) {
      const message =
        error.name === "TimeoutError" ||
        error.name === "AbortError"
          ? "Request timed out"
          : error.message;

      errors.push(`${model}: ${message}`);

      console.error("Gemini request failed:", model, message);
    }
  }

  return res.status(503).json({
    error: "Gemini is temporarily unavailable. Please try again.",
    details: errors
  });
}

