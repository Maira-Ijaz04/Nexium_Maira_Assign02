// app/page.tsx - Enhanced version with better error handling
'use client';

import { useState } from 'react';
import { Input } from '@/components/input';
import { Button } from '@/components/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/card';
import { Badge } from '@/components/badge';
import { Alert, AlertDescription } from '@/components/alert';
import { scrapeBlogText, scrapeWithFallback } from '@/lib/scraper';
import { summarise } from '@/lib/summariser';
import { translateToUrdu } from '@/lib/translator';
import { saveFullText, saveSummary } from '@/lib/mongodb';
import { saveToSupabase } from '@/lib/supabase';




interface BlogOption {
  title: string;
  url: string;
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

const blogOptions: BlogOption[] = [
  {
    title: "Meet the YC Winter 2024 Batch",
    url: "https://www.ycombinator.com/blog/meet-the-yc-winter-2024-batch/",
    description: "Highlights and stats about the YC Winter 2024 companies.",
    category: "Batch News",
    difficulty: "medium"
  },
  {
    title: "A Guide to Demo Day Presentations",
    url: "https://www.ycombinator.com/blog/guide-to-demo-day-pitches/",
    description: "In‑depth guide on creating effective Demo Day pitches.",
    category: "Advice",
    difficulty: "hard"
  },
  {
    title: "The Software Behind YC’s Investor Day",
    url: "https://www.ycombinator.com/blog/investor-day-software/",
    description: "How YC built software to handle investor/startup scheduling.",
    category: "Tech",
    difficulty: "hard"
  },
  {
    title: "How to Design a Better Pitch Deck",
    url: "https://www.ycombinator.com/blog/how-to-design-a-better-pitch-deck/",
    description: "Practical tips for creating clear, memorable pitch decks.",
    category: "Advice",
    difficulty: "medium"
  }
];


interface ProcessingState {
  step: 'idle' | 'scraping' | 'summarizing' | 'translating' | 'saving' | 'complete';
  progress: number;
}

export default function Home() {
  const [url, setUrl] = useState<string>('');
  const [summary, setSummary] = useState<string>('');
  const [translated, setTranslated] = useState<string>('');
  const [fullText, setFullText] = useState<string>('');
  const [metadata, setMetadata] = useState<any>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ step: 'idle', progress: 0 });
  const [error, setError] = useState<string>('');
  const [selectedBlog, setSelectedBlog] = useState<string | null>(null);
  const [useDemo, setUseDemo] = useState<boolean>(false);

  const handleSelectBlog = (blogUrl: string): void => {
    setUrl(blogUrl);
    setSelectedBlog(blogUrl);
    setError('');
    setUseDemo(blogUrl.startsWith('demo://'));
    // Clear previous results when selecting a new blog
    setSummary('');
    setTranslated('');
    setFullText('');
    setMetadata(null);
  };

  const updateProgress = (step: ProcessingState['step'], progress: number) => {
    setProcessing({ step, progress });
  };

  const handleSummarise = async (): Promise<void> => {
  if (!url) {
    setError('Please enter a blog URL or select one from the options above');
    return;
  }

  setError('');
  updateProgress('scraping', 0);

  try {
    // Step 1: Scrape blog content
    const response = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API error: ${response.status} - ${errText}`);
    }

    const scrapingResult = await response.json();

    if (!scrapingResult.success) {
      throw new Error(scrapingResult.error || 'Failed to scrape content');
    }

    const { content, metadata } = scrapingResult;

    if (!content || content.length < 50) {
      throw new Error('Insufficient content was extracted from the webpage');
    }

    setFullText(content);
    setMetadata(metadata);
    updateProgress('scraping', 100);

    // Summary and translation steps
    updateProgress('summarizing', 0);
    const summaryText = summarise(content);
    setSummary(summaryText);
    updateProgress('summarizing', 100);

    updateProgress('translating', 0);
    const urduTranslation = await translateToUrdu(summaryText);
    setTranslated(urduTranslation);
    updateProgress('translating', 100);

    updateProgress('saving', 0);
    await Promise.all([
      saveFullText(url, content),
      saveSummary(url, summaryText, urduTranslation),
      saveToSupabase(url, content, summaryText, urduTranslation),
    ]);
    updateProgress('saving', 100);

    updateProgress('complete', 100);
  } catch (err: any) {
    console.error('Error in handleSummarise:', err);
    setError(err.message || 'Unexpected error occurred while summarizing');
    updateProgress('idle', 0);
  }
};
;

  const getProgressMessage = () => {
    switch (processing.step) {
      case 'scraping':
        return 'Extracting content from webpage...';
      case 'summarizing':
        return 'Generating summary...';
      case 'translating':
        return 'Translating to Urdu...';
      case 'saving':
        return 'Saving to database...';
      case 'complete':
        return 'Processing complete!';
      default:
        return '';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/20 text-green-200 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-200 border-yellow-500/30';
      case 'hard': return 'bg-red-500/20 text-red-200 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-200 border-gray-500/30';
    }
  };

  const isProcessing = processing.step !== 'idle' && processing.step !== 'complete';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 p-6">
      <div className="max-w-4xl mx-auto">
        <Card className="bg-white/10 backdrop-blur-lg border-white/20 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-white mb-2">
              AI Blog Summarizer
            </CardTitle>
            <p className="text-white/80">Choose a blog to summarize or enter your own URL:</p>
          </CardHeader>
          
         <CardContent className="space-y-6 overflow-x-hidden">

            {/* Blog Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {blogOptions.map((blog, index) => (
                <Card 
                  key={index} 
                  className={`cursor-pointer transition-all duration-200 hover:scale-105 ${
                    selectedBlog === blog.url 
                      ? 'ring-2 ring-blue-400 bg-blue-50/20' 
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => handleSelectBlog(blog.url)}
                >
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                     <h3 className="text-sm text-white/70 mb-3">{blog.title}</h3>
                      <Badge variant="outline" className="text-xs bg-white/10 text-white border-white/20">
                        {blog.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-white/70 mb-3">{blog.description}</p>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-blue-300 truncate flex-1 mr-2">
                        {blog.url.startsWith('demo://') ? 'Demo Content' : blog.url}
                      </p>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getDifficultyColor(blog.difficulty)}`}
                      >
                        {blog.difficulty}
                      </Badge>
                    </div>
                    <Button 
                      className="w-full bg-black/50 hover:bg-black/70 text-white"
                      size="sm"
                      disabled={isProcessing}
                    >
                      Select
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* URL Input Section */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
              <p className="text-white/80 mb-3">Selected URL or enter your own:</p>
             <div className="flex flex-col sm:flex-row gap-3">

                <Input
                  placeholder="Enter blog URL (e.g., https://example.com/article)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                  disabled={isProcessing}
                />
                <Button 
                  onClick={handleSummarise}
                  disabled={isProcessing || !url}
                  className="bg-blue-600 hover:bg-blue-700 px-6 min-w-[120px] disabled:opacity-50"
                >
                  {isProcessing ? 'Processing...' : 'Summarize'}
                </Button>
              </div>
              
              {/* Demo Mode Toggle */}
              {!url.startsWith('demo://') && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="demo-mode"
                    checked={useDemo}
                    onChange={(e) => setUseDemo(e.target.checked)}
                    className="rounded"
                    disabled={isProcessing}
                  />
                  <label htmlFor="demo-mode" className="text-sm text-white/70">
                    Use demo content if scraping fails
                  </label>
                </div>
              )}
            </div>

            {/* Progress Display */}
            {isProcessing && (
              <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                  <p className="text-blue-200">{getProgressMessage()}</p>
                </div>
                <div className="mt-2 bg-blue-900/50 rounded-full h-2">
                  <div 
                    className="bg-blue-400 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${processing.progress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert className="bg-red-500/20 border-red-500/50">
                <AlertDescription className="text-red-200">
                  <strong>Error:</strong> {error}
                  <div className="mt-2 text-sm space-y-1">
                    {error.includes('Insufficient content') && (
                      <p>💡 <strong>Tip:</strong> This website might be blocking automated access or using dynamic content loading.</p>
                    )}
                    {error.includes('blocks automated requests') && (
                      <p>💡 <strong>Tip:</strong> Try enabling "Use demo content if scraping fails" option below.</p>
                    )}
                    {error.includes('Network Error') && (
                      <p>💡 <strong>Tip:</strong> Check your internet connection and try again.</p>
                    )}
                    <p>🔄 <strong>Quick fix:</strong> Enable the demo fallback option and try again.</p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Success Message */}
            {processing.step === 'complete' && (
              <Alert className="bg-green-500/20 border-green-500/50">
                <AlertDescription className="text-green-200">
                  ✅ Content successfully processed and summarized!
                </AlertDescription>
              </Alert>
            )}

            {/* Results Section */}
            {fullText && (
              <div className="space-y-4">
                {/* Metadata */}
                {metadata && (
                  <Card className="bg-white/10 backdrop-blur-sm border-white/20">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">Article Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {metadata.title && (
                        <p className="text-white/90 text-sm sm:text-base lg:text-lg break-words">
  <strong>Title:</strong> {metadata.title}</p>
                      )}
                      {metadata.description && (
                        <p className="text-white/90"><strong>Description:</strong> {metadata.description}</p>
                      )}
                      <p className="text-white/70 text-sm"><strong>Source:</strong> {metadata.url}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Original Blog Content */}
<Card className="bg-white/10 backdrop-blur-sm border-white/20">
  <CardHeader className="p-4 sm:p-6">
    <CardTitle className="text-white text-base sm:text-lg flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
      <span>Original Content</span>
      <Badge 
        variant="outline" 
        className="text-xs bg-white/10 text-white border-white/20 w-fit"
      >
        {fullText.length.toLocaleString()} characters
      </Badge>
    </CardTitle>
  </CardHeader>
  <CardContent className="p-4 sm:p-6 pt-0">
    <div className="bg-white/5 rounded-lg p-3 sm:p-4 max-h-48 sm:max-h-60 lg:max-h-72 overflow-y-auto">
     <p className="text-white/80 text-xs sm:text-sm leading-relaxed break-words whitespace-pre-wrap">

        {fullText}
      </p>
    </div>
  </CardContent>
</Card>
                {/* Summary */}
                {summary && (
                  <Card className="bg-green-500/20 border-green-500/50">
                    <CardHeader>
                      <CardTitle className="text-white text-lg">Summary (English)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-white/90 leading-relaxed">{summary}</p>
                    </CardContent>
                  </Card>
                )}

                {/* Urdu Translation */}
                {translated && (
                  <Card className="bg-orange-500/20 border-orange-500/50">
                    <CardHeader>
                      <CardTitle className="text-white text-lg flex items-center gap-2">
                        <span>اردو خلاصہ</span>
                        <span className="text-sm font-normal">(Urdu Summary)</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-white/90 text-right leading-relaxed" dir="rtl">
                        {translated}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}