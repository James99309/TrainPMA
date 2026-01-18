// Free Dictionary API service
// https://dictionaryapi.dev/

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  phonetics: {
    text?: string;
    audio?: string;
  }[];
  meanings: {
    partOfSpeech: string;
    definitions: {
      definition: string;
      example?: string;
      synonyms: string[];
      antonyms: string[];
    }[];
    synonyms: string[];
    antonyms: string[];
  }[];
}

export interface WordDefinition {
  word: string;
  phonetic: string;
  audio: string | null;
  partOfSpeech: string;
  definition: string;
  chineseDefinition?: string;
  example: string | null;
  synonyms: string[];
}

export async function fetchWordDefinition(word: string): Promise<WordDefinition | null> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`
    );

    if (!response.ok) {
      return null;
    }

    const data: DictionaryEntry[] = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    const entry = data[0];
    const meaning = entry.meanings[0];
    const definition = meaning?.definitions[0];

    // Find audio URL (prefer US pronunciation)
    const audioUrl = entry.phonetics.find((p) => p.audio && p.audio.includes('-us'))?.audio
      || entry.phonetics.find((p) => p.audio)?.audio
      || null;

    // Get phonetic text
    const phoneticText = entry.phonetic
      || entry.phonetics.find((p) => p.text)?.text
      || '';

    return {
      word: entry.word,
      phonetic: phoneticText,
      audio: audioUrl,
      partOfSpeech: meaning?.partOfSpeech || '',
      definition: definition?.definition || 'No definition available',
      example: definition?.example || null,
      synonyms: meaning?.synonyms?.slice(0, 5) || [],
    };
  } catch (error) {
    console.error('Failed to fetch word definition:', error);
    return null;
  }
}

// Cache for word definitions
const wordCache = new Map<string, WordDefinition>();

export async function getWordDefinition(word: string): Promise<WordDefinition | null> {
  const cleanWord = word.toLowerCase().replace(/[.,!?;:'"]/g, '');

  // Check cache first
  if (wordCache.has(cleanWord)) {
    return wordCache.get(cleanWord)!;
  }

  // Fetch from API
  const definition = await fetchWordDefinition(cleanWord);

  if (definition) {
    wordCache.set(cleanWord, definition);
  }

  return definition;
}
