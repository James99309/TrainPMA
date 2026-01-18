// MyMemory Translation API service
// https://mymemory.translated.net/doc/spec.php

interface TranslateResponse {
  responseData: {
    translatedText: string;
    match: number;
  };
  responseStatus: number;
}

// Cache for translations
const translateCache = new Map<string, string>();

export async function translateToChineseSimple(text: string): Promise<string | null> {
  if (!text || text.trim().length === 0) {
    return null;
  }

  // Check cache first
  const cacheKey = text.toLowerCase().trim();
  if (translateCache.has(cacheKey)) {
    return translateCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|zh-CN`
    );

    if (!response.ok) {
      return null;
    }

    const data: TranslateResponse = await response.json();

    if (data.responseStatus === 200 && data.responseData.translatedText) {
      const translation = data.responseData.translatedText;
      translateCache.set(cacheKey, translation);
      return translation;
    }

    return null;
  } catch (error) {
    console.error('Translation failed:', error);
    return null;
  }
}
