export class OpenRouterClient {
  public static async completions(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string
  ): Promise<string> {
    const endpoint = 'https://openrouter.ai/api/v1/chat/completions';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/yv3000/gitmind',
          'X-Title': 'GitMind'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1500,
          temperature: 0.3
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        throw new Error('Invalid API key. Run GitMind: Set API Key command');
      } else if (response.status === 429) {
        throw new Error('Rate limit hit. Try again in 30 seconds or switch to a different free model');
      } else if (!response.ok) {
        throw new Error(`OpenRouter API returned error status ${response.status}: ${response.statusText}`);
      }

      const data: any = await response.json();
      if (data && data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content || '';
      } else {
        throw new Error('Invalid response structure from OpenRouter API');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('AI is taking too long. Try a faster model like gemma-3-12b-it:free');
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Cannot reach OpenRouter. Check your internet connection');
      }
      throw error;
    }
  }
}
