// lib/summariser.ts
const keywords = ['important', 'key', 'main', 'conclusion', 'summary', 'takeaway', 'result', 'finding', 'analysis', 'research'];

export const summarise = (text: string): string => {
  if (!text || text.trim().length === 0) {
    return '';
  }

  // Clean and split text into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 10); // Filter out very short sentences

  // Score sentences based on keyword presence
  const scoredSentences = sentences.map(sentence => {
    const score = keywords.reduce((acc, keyword) => {
      return acc + (sentence.toLowerCase().includes(keyword) ? 1 : 0);
    }, 0);
    return { sentence, score };
  });

  // Sort by score and take top sentences
  const topSentences = scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.sentence);

  if (topSentences.length > 0) {
    return topSentences.join('. ') + '.';
  }

  // Fallback to first 2 sentences if no keywords found
  return sentences.slice(0, 2).join('. ') + '.';
};
