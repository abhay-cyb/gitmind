export class GeminiClient {
  private static async executeRequest(
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

  public static async complete(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    // 1. Resolve exact API model identifiers
    let actualModel = model;
    if (model === 'gemini-2.5-pro') {
      actualModel = 'gemini-2.5-pro-preview-06-05';
    } else if (model === 'gemini-2.5-flash') {
      actualModel = 'gemini-2.5-flash-preview-05-20';
    } else if (model === 'gemini-2.0-flash') {
      actualModel = 'gemini-2.0-flash';
    } else if (model === 'gemini-2.0-flash-lite') {
      actualModel = 'gemini-2.0-flash-lite';
    } else if (model === 'gemini-1.5-flash') {
      actualModel = 'gemini-1.5-flash';
    } else if (model === 'gemini-1.5-pro') {
      actualModel = 'gemini-1.5-pro';
    }

    // 2. Try the primary model
    try {
      return await this.executeRequest(apiKey, actualModel, systemPrompt, userPrompt);
    } catch (error: any) {
      // If error is 503 (temporarily unavailable) or 429 (rate limit / quota exceeded)
      const isRetryable = 
        error.message.includes('unavailable') || 
        error.message.includes('limit') || 
        error.message.includes('status 429') || 
        error.message.includes('status 503') ||
        error.message.includes('quota') ||
        error.message.includes('Quota');
      
      if (isRetryable) {
        // Fallback chain 1: Try gemini-2.0-flash-lite
        if (actualModel !== 'gemini-2.0-flash-lite') {
          try {
            return await this.executeRequest(apiKey, 'gemini-2.0-flash-lite', systemPrompt, userPrompt);
          } catch (e2) {}
        }
        
        // Fallback chain 2: Try gemini-1.5-flash
        if (actualModel !== 'gemini-1.5-flash') {
          try {
            return await this.executeRequest(apiKey, 'gemini-1.5-flash', systemPrompt, userPrompt);
          } catch (e3) {}
        }
      }
      throw error;
    }
  }
}
