 
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
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

    let data;
    let lastStatus = 503;

    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ]
        })
      });

      const responseText = await response.text();

      try {
        data = JSON.parse(responseText);
      } catch {
        data = {
          error: {
            message: responseText || "Invalid response from Gemini"
          }
        };
      }

      if (response.ok) {
        break;
      }

      lastStatus = response.status;

      console.error("Gemini API error:", {
        status: response.status,
        message: data.error?.message || "Unknown error"
      });

      const retryable = [429, 500, 503, 504];

      if (!retryable.includes(response.status) || attempt === 2) {
        return res.status(response.status).json({
          error: data.error?.message || "Gemini API error",
          status: response.status
        });
      }

      await new Promise(resolve =>
        setTimeout(resolve, 1000 * (attempt + 1))
      );
    }

    if (!data || !data.candidates?.[0]?.content?.parts) {
      return res.status(lastStatus).json({
        error: "Gemini returned no valid response"
      });
    }

    const result = data.candidates[0].content.parts
      .map(part => part.text || "")
      .join("");

    return res.status(200).json({
      result: result || "No response"
    });

  } catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
      error: error.message || "Server error"
    });
  }
}
