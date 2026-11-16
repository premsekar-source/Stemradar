import { NextRequest, NextResponse } from 'next/server';
import { getGeminiClient } from '@/lib/gemini';
import { isSafeHttpUrl } from '@/lib/utils';

interface GroundingRequestBody {
  mode?: 'topic' | 'item';
  query?: string;
  title?: string;
  domain?: string;
  source?: string;
  summary?: string;
}

interface GroundedSourceLink {
  title: string;
  uri: string;
}

interface RawGroundingChunk {
  web?: {
    uri?: string;
    title?: string;
  };
}

function extractGroundedSources(chunks: unknown): GroundedSourceLink[] {
  if (!Array.isArray(chunks)) return [];
  const seen = new Set<string>();
  const results: GroundedSourceLink[] = [];

  for (const chunk of chunks as RawGroundingChunk[]) {
    const uri = chunk?.web?.uri?.trim();
    if (!uri || !isSafeHttpUrl(uri) || seen.has(uri)) continue;
    seen.add(uri);

    let fallbackTitle = uri;
    try {
      fallbackTitle = new URL(uri).hostname;
    } catch {
      // keep raw uri as fallback title
    }

    const title = chunk?.web?.title?.trim() || fallbackTitle;
    results.push({ title, uri });
  }

  return results;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as GroundingRequestBody;
    const mode = body.mode === 'item' ? 'item' : 'topic';
    const rawQuery = (body.query ?? '').trim();
    const rawTitle = (body.title ?? '').trim();

    if (mode === 'topic' && rawQuery.length === 0) {
      return NextResponse.json(
        { error: 'Please provide a search topic to query.' },
        { status: 400 }
      );
    }

    if (mode === 'item' && rawTitle.length === 0 && rawQuery.length === 0) {
      return NextResponse.json(
        { error: 'Missing discovery details for live web grounding.' },
        { status: 400 }
      );
    }

    const ai = getGeminiClient();

    const prompt =
      mode === 'item'
        ? [
            `Find the latest verified web updates, context, and primary sources related to this STEM discovery:`,
            `Title: ${rawTitle.slice(0, 240)}`,
            body.domain ? `Domain: ${body.domain.slice(0, 120)}` : '',
            body.source ? `Indexed Source: ${body.source.slice(0, 120)}` : '',
            body.summary
              ? `Indexed Summary: ${body.summary.slice(0, 600)}`
              : '',
            `Summarize what recent credible sources report in 2-3 concise paragraphs with factual dates and figures where available. Stick strictly to verified findings.`,
          ]
            .filter(Boolean)
            .join('\n')
        : [
            `Provide a concise, factual STEM research and news briefing based on current Google Search results for:`,
            `"${rawQuery.slice(0, 240)}"`,
            body.domain && body.domain !== 'all'
              ? `Focus especially on the STEM domain: ${body.domain.slice(0, 120)}.`
              : '',
            `Include key recent developments, dates, and organizations in 2-3 clear paragraphs.`,
          ]
            .filter(Boolean)
            .join('\n');

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction:
          'You are a factual STEM research analyst for STEM Radar. Ground all answers in Google Search results, cite concrete dates/organizations when present, and write concise plain paragraphs without filler.',
        tools: [{ googleSearch: {} }],
      },
    });

    const text = (response.text ?? '').trim();
    const candidate = response.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const sources = extractGroundedSources(groundingMetadata?.groundingChunks);
    const queries = Array.isArray(groundingMetadata?.webSearchQueries)
      ? groundingMetadata.webSearchQueries.filter(
          (q): q is string => typeof q === 'string' && q.trim().length > 0
        )
      : [];

    if (!text && sources.length === 0) {
      return NextResponse.json(
        { error: 'No grounded web results were returned for this query.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      text,
      sources,
      queries,
      verifiedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Failed to retrieve Google Search grounding results.';
    const lower = message.toLowerCase();

    if (lower.includes('api_key_invalid') || lower.includes('permission_denied')) {
      return NextResponse.json(
        {
          error:
            'Gemini API authentication failed. Please check the API key in Settings > Secrets.',
        },
        { status: 403 }
      );
    }
    if (lower.includes('resource_exhausted') || lower.includes('429')) {
      return NextResponse.json(
        {
          error:
            'Rate limit reached for the Gemini API. Please try again shortly.',
        },
        { status: 429 }
      );
    }
    if (lower.includes('gemini_api_key is not configured')) {
      return NextResponse.json({ error: message }, { status: 500 });
    }

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
