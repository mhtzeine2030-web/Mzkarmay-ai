
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

  const url =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      });

      const text = await response.text();

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }

      if (response.ok) {
        const result = data.candidates?.[0]?.content?.parts
          ?.map(part => part.text || "")
          .join("");

        if (!result) {
          return res.status(502).json({
            error: "Gemini returned an empty response"
          });
        }

        return res.status(200).json({ result });
      }

      console.error("Gemini error:", response.status, data);

      if (
        [429, 500, 503, 504].includes(response.status) &&
        attempt === 0
      ) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }

      return res.status(response.status).json({
        error: data.error?.message || "Gemini API error",
        status: response.status
      });

    } catch (error) {
      console.error("Gemini request failed:", error);

      if (attempt === 0) {
        await new Promise(resolve => setTimeout(resolve, 1500));
        continue;
      }

      return res.status(504).json({
        error: "Gemini did not respond in time. Please try again."
      });
    }
  }
}
