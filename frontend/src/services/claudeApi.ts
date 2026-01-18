// Claude API service for word definitions
// Uses Anthropic Claude API for high-quality English definitions and Chinese translations

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

export interface ClaudeWordDefinition {
  word: string;
  english: string;      // English definition (learner-friendly)
  chinese: string;      // Chinese translation
  partOfSpeech: string; // noun, verb, adjective, etc.
  phonetic?: string;    // IPA phonetic (if available)
}

// Cache for definitions
const definitionCache = new Map<string, ClaudeWordDefinition>();

export async function getWordDefinitionWithClaude(
  word: string,
  context?: string
): Promise<ClaudeWordDefinition | null> {
  const cleanWord = word.toLowerCase().trim();
  const cacheKey = `${cleanWord}:${context || ''}`;

  // Check cache first
  if (definitionCache.has(cacheKey)) {
    return definitionCache.get(cacheKey)!;
  }

  if (!ANTHROPIC_API_KEY) {
    console.error('Anthropic API key not configured');
    return null;
  }

  const prompt = context
    ? `Given the word "${word}" in this sentence: "${context}"

Please provide:
1. A concise English definition suitable for English learners (1-2 sentences max)
2. A Chinese translation that is natural and easy to understand
3. The part of speech as used in this context

Respond in JSON format only:
{
  "english": "definition here",
  "chinese": "中文翻译",
  "partOfSpeech": "verb/noun/adjective/etc"
}`
    : `Given the word "${word}"

Please provide:
1. A concise English definition suitable for English learners (1-2 sentences max)
2. A Chinese translation that is natural and easy to understand
3. The most common part of speech

Respond in JSON format only:
{
  "english": "definition here",
  "chinese": "中文翻译",
  "partOfSpeech": "verb/noun/adjective/etc"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Claude API error:', response.status, errorText);
      return null;
    }

    const data = await response.json();
    const content = data.content[0]?.text;

    if (!content) {
      console.error('No content in Claude response');
      return null;
    }

    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Could not parse JSON from Claude response:', content);
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const result: ClaudeWordDefinition = {
      word: cleanWord,
      english: parsed.english || 'No definition available',
      chinese: parsed.chinese || '暂无翻译',
      partOfSpeech: parsed.partOfSpeech || '',
    };

    // Cache the result
    definitionCache.set(cacheKey, result);

    return result;
  } catch (error) {
    console.error('Failed to get definition from Claude:', error);
    return null;
  }
}
