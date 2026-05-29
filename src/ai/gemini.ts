export class GeminiClient {
  public static async complete(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          contents: [
            { role: 'user', parts: [{ text: userPrompt }] }
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1500
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const status = response.status;
        if (status === 400) {
          throw new Error('Invalid request sent to Gemini. Try rephrasing your question.');
        } else if (status === 403) {
          throw new Error("Invalid Gemini API key. Run 'GitMind: Set Gemini API Key' to update it.");
        } else if (status === 429) {
          throw new Error('Gemini rate limit hit. Wait 60 seconds and try again.');
        } else if (status === 503) {
          throw new Error('Gemini is temporarily unavailable. Try again in a moment.');
        } else {
          throw new Error(`Gemini API returned error status ${status}: ${response.statusText}`);
        }
      }

      const data: any = await response.json();
      if (
        data &&
        data.candidates &&
        data.candidates[0] &&
        data.candidates[0].content &&
        data.candidates[0].content.parts &&
        data.candidates[0].content.parts[0]
      ) {
        return data.candidates[0].content.parts[0].text || '';
      } else {
        throw new Error('Invalid response structure from Gemini API');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Gemini took too long. Try Gemini 2.0 Flash Lite for faster responses.');
      }
      if (error instanceof TypeError) {
        throw new Error('Cannot reach Gemini API. Check your internet connection.');
      }
      throw error;
    }
  }
}
