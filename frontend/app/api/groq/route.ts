import { NextResponse } from 'next/server';

function cleanPdfBinaryText(rawText: string): string {
  if (!rawText) return '';

  // Extract text inside parentheses: (Text String)
  const matches = rawText.match(/\(([^()\\]|\\[\s\S])*\)/g);
  const textPieces: string[] = [];

  if (matches) {
    for (const m of matches) {
      const clean = m
        .slice(1, -1)
        .replace(/\\([()\\])/g, '$1')
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ')
        .replace(/\\t/g, ' ')
        .trim();

      if (
        clean.length >= 2 &&
        /[a-zA-Z0-9]/.test(clean) &&
        !/^(FlateDecode|Font|DeviceRGB|Helvetica|Times|Type1|TrueType|Catalog|Pages|Parent|FontDescriptor|ProcSet|Encoding|Widths|Metadata|Producer|CreationDate|ModDate|HeadlessChrome|AppleWebKit|Win64|Windows|Safari|Mozilla|Skia|PDF|endobj|stream|endstream|xref|trailer|startxref)/i.test(
          clean,
        )
      ) {
        textPieces.push(clean);
      }
    }
  }

  // Filter readable alphanumeric words
  const words = rawText
    .replace(/[^\x20-\x7E]/g, ' ')
    .split(/\s+/)
    .filter(
      (w) =>
        w.length >= 3 &&
        /^[a-zA-Z0-9_.\-@:()/#]{3,}$/.test(w) &&
        !/^(FlateDecode|Catalog|Pages|Parent|FontDescriptor|ProcSet|Encoding|Widths|Metadata|Producer|CreationDate|ModDate|HeadlessChrome|AppleWebKit|Win64|Windows|Safari|Mozilla|Skia|PDF|endobj|stream|endstream|xref|trailer)/i.test(
          w,
        ),
    );

  const combined = Array.from(new Set([...textPieces, ...words])).join(' ');
  return combined.slice(0, 3500);
}

export async function POST(req: Request) {
  try {
    const { prompt, systemPrompt, userQuery, documentText, mode } = await req.json();

    const apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Groq API key not configured.' },
        { status: 500 },
      );
    }

    const cleanDocText = cleanPdfBinaryText(documentText || '');
    const messages = [];

    if (mode === 'summary') {
      messages.push({
        role: 'system',
        content:
          'You are an expert document summarizer for TeamGate. Provide a clear, professional executive summary focusing on key objectives, requirements, and deliverables. Format as clean text. Do NOT output raw PDF binary markers, zlib code tokens, or bracket headers.',
      });
      messages.push({
        role: 'user',
        content: prompt || `Document Information:\n${cleanDocText || documentText}\n\nPlease summarize the key scope, task requirements, and purpose.`,
      });
    } else {
      messages.push({
        role: 'system',
        content:
          systemPrompt ||
          `You are a Document Retrieval Chatbot for TeamGate.
STRICT MANDATORY RULES:
1. You MUST answer the user's question ONLY using facts contained in the uploaded document content provided below.
2. If the user's question can be answered (e.g. asking for the name of the task, requirements, steps, architecture), provide a clear structured answer. If applicable, output a Markdown Table (| Step | Layer | Purpose |) followed by explanatory text.
3. If the requested information is NOT explicitly found or derived from the uploaded document, reply ONLY with the exact sentence:
"No response is found from the document."
4. Do NOT use outside knowledge or raw binary code markers. If missing, output EXACTLY: "No response is found from the document."`,
      });
      messages.push({
        role: 'user',
        content: `Document Content:\n${cleanDocText || documentText}\n\nUser Question: ${userQuery}`,
      });
    }

    const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages,
        temperature: 0.1,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('Groq API error:', resp.status, errText);
      return NextResponse.json(
        { error: `Groq API returned status ${resp.status}` },
        { status: resp.status },
      );
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim() || '';

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API /api/groq error:', error);
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 },
    );
  }
}
