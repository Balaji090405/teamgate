import { NextResponse } from 'next/server';
import zlib from 'zlib';

// Polyfill DOMMatrix for Node.js serverless runtime (Vercel / AWS Lambda)
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixMock {
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    constructor(init?: unknown) {
      if (Array.isArray(init) && init.length >= 6) {
        this.a = init[0]; this.b = init[1]; this.c = init[2];
        this.d = init[3]; this.e = init[4]; this.f = init[5];
      }
    }
    multiply() { return this; }
    translate() { return this; }
    scale() { return this; }
    rotate() { return this; }
    inverse() { return this; }
    transformPoint(p: unknown) { return p; }
  }
  (globalThis as unknown as { DOMMatrix: typeof DOMMatrixMock }).DOMMatrix = DOMMatrixMock;
}

interface DocumentPage {
  pageNumber: number;
  text: string;
}

interface DocumentChunk {
  chunkId: string;
  pageNumber: number;
  text: string;
}

// Stop words list for term tokenization
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'into', 'is', 'it',
  'no', 'not', 'of', 'on', 'or', 'such', 'that', 'the', 'their', 'then', 'there', 'these',
  'they', 'this', 'to', 'was', 'will', 'with', 'what', 'where', 'when', 'who', 'how', 'why',
  'which', 'can', 'could', 'would', 'should', 'tell', 'me', 'about', 'explain', 'show', 'list',
  'give', 'find', 'does', 'do', 'did', 'has', 'have', 'had', 'from', 'out', 'up', 'down',
]);

// Pure JS PDF Stream Text Extractor (100% serverless compatible, zero worker file dependencies)
function extractPdfTextPureJs(pdfBuffer: Buffer): DocumentPage[] {
  const pages: DocumentPage[] = [];
  const pdfString = pdfBuffer.toString('binary');
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/gi;
  let match: RegExpExecArray | null;
  let pageNum = 1;

  while ((match = streamRegex.exec(pdfString)) !== null) {
    const rawStream = match[1];
    let decompressed = '';

    try {
      const streamBuf = Buffer.from(rawStream, 'binary');
      decompressed = zlib.inflateSync(streamBuf).toString('binary');
    } catch {
      decompressed = rawStream;
    }

    if (decompressed) {
      const textPieces: string[] = [];

      // Match (text) Tj or (text) TJ text instructions
      const tjMatches = decompressed.match(/\(([^()\\]|\\[\s\S])*\)\s*T[jJ]/g) || [];
      for (const m of tjMatches) {
        const clean = m.replace(/\)\s*T[jJ]$/, '').slice(1).replace(/\\([()\\])/g, '$1').trim();
        if (clean.length >= 1 && !/^(FlateDecode|Font|DeviceRGB|Helvetica|Times|Type1|TrueType|Catalog|Pages)/i.test(clean)) {
          textPieces.push(clean);
        }
      }

      // Match [(text) (text)] TJ array instructions
      const tjArrayMatches = decompressed.match(/\[\s*(\(([^()\\]|\\[\s\S])*\)\s*|-?\d+\s*)+\]\s*TJ/g) || [];
      for (const m of tjArrayMatches) {
        const subPieces = m.match(/\(([^()\\]|\\[\s\S])*\)/g) || [];
        for (const sub of subPieces) {
          const clean = sub.slice(1, -1).replace(/\\([()\\])/g, '$1').trim();
          if (clean.length >= 1 && !/^(FlateDecode|Font|DeviceRGB|Helvetica|Times|Type1|TrueType|Catalog|Pages)/i.test(clean)) {
            textPieces.push(clean);
          }
        }
      }

      // Fallback text string extraction inside decompressed stream
      if (textPieces.length === 0) {
        const generalMatches = decompressed.match(/\(([^()\\]|\\[\s\S])*\)/g) || [];
        for (const m of generalMatches) {
          const clean = m.slice(1, -1).replace(/\\([()\\])/g, '$1').trim();
          if (clean.length >= 2 && /[a-zA-Z0-9]/.test(clean) && !/^(FlateDecode|Font|DeviceRGB|Helvetica|Times|Type1|TrueType|Catalog|Pages)/i.test(clean)) {
            textPieces.push(clean);
          }
        }
      }

      if (textPieces.length > 0) {
        const pageText = textPieces.join(' ').replace(/\s+/g, ' ').trim();
        if (pageText.length > 5) {
          pages.push({ pageNumber: pageNum++, text: pageText });
        }
      }
    }
  }

  return pages;
}

// Extract page-by-page text from PDF buffer or plain text string
async function extractDocumentPages(
  fileData: string | undefined,
  fileName: string | undefined,
  fileType: string | undefined,
  documentText: string | undefined
): Promise<DocumentPage[]> {
  let pages: DocumentPage[] = [];

  let base64String = '';
  if (fileData) {
    if (fileData.includes('base64,')) {
      base64String = fileData.split('base64,')[1];
    } else {
      base64String = fileData;
    }
  }

  const isPdf =
    (fileName && fileName.toLowerCase().endsWith('.pdf')) ||
    (fileType && fileType.toLowerCase().includes('pdf'));

  if (base64String && isPdf) {
    // 1. Try Pure JS stream extraction first (Fast, 100% serverless native Node.js zlib)
    try {
      const buffer = Buffer.from(base64String, 'base64');
      pages = extractPdfTextPureJs(buffer);
    } catch (err) {
      console.error('Pure JS stream extraction error:', err);
    }

    // 2. Try pdf-parse package via dynamic import if pure JS returned 0 pages
    if (pages.length === 0) {
      try {
        const { PDFParse } = await import('pdf-parse');
        const buffer = Buffer.from(base64String, 'base64');
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const res = await parser.getText();
        await parser.destroy();

        if (res && res.pages && res.pages.length > 0) {
          for (const p of res.pages) {
            const cleaned = (p.text || '').replace(/[^\x20-\x7E\x0A\x0D\x09]/g, ' ').replace(/[ \t]+/g, ' ').trim();
            if (cleaned.length > 0) {
              pages.push({ pageNumber: p.num || (pages.length + 1), text: cleaned });
            }
          }
        } else if (res && res.text) {
          const cleaned = res.text.replace(/[^\x20-\x7E\x0A\x0D\x09]/g, ' ').replace(/[ \t]+/g, ' ').trim();
          if (cleaned) {
            pages.push({ pageNumber: 1, text: cleaned });
          }
        }
      } catch (err) {
        console.error('PDFParse class extraction error:', err);
      }
    }

    // 3. Fallback raw string pattern matcher
    if (pages.length === 0) {
      try {
        const buffer = Buffer.from(base64String, 'base64');
        const rawString = buffer.toString('binary');
        const matches = rawString.match(/\(([^()\\]|\\[\s\S])*\)/g);
        const textPieces: string[] = [];
        if (matches) {
          for (const m of matches) {
            const clean = m.slice(1, -1).replace(/\\([()\\])/g, '$1').trim();
            if (clean.length >= 2 && /[a-zA-Z0-9]/.test(clean) && !/^(FlateDecode|Font|DeviceRGB|Helvetica|Times)/i.test(clean)) {
              textPieces.push(clean);
            }
          }
        }
        const fallbackText = textPieces.join(' ').replace(/\s+/g, ' ').trim();
        if (fallbackText) {
          pages.push({ pageNumber: 1, text: fallbackText });
        }
      } catch {
        // Ignore fallback error
      }
    }
  } else if (base64String) {
    try {
      const buffer = Buffer.from(base64String, 'base64');
      const text = buffer.toString('utf-8').replace(/[^\x20-\x7E\x0A\x0D\x09]/g, ' ').replace(/[ \t]+/g, ' ').trim();
      if (text) {
        pages.push({ pageNumber: 1, text });
      }
    } catch {
      // Ignore conversion error
    }
  }

  if (pages.length === 0 && documentText) {
    const cleaned = documentText.replace(/[^\x20-\x7E\x0A\x0D\x09]/g, ' ').replace(/[ \t]+/g, ' ').trim();
    if (cleaned) {
      pages.push({ pageNumber: 1, text: cleaned });
    }
  }

  return pages;
}

// Split pages into chunk items (~300 words with 50 word overlap)
function chunkDocumentPages(pages: DocumentPage[]): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let globalChunkCounter = 1;

  for (const page of pages) {
    const words = page.text.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    const chunkSize = 300;
    const overlap = 50;
    let start = 0;

    while (start < words.length) {
      const end = Math.min(start + chunkSize, words.length);
      const chunkWords = words.slice(start, end);
      const chunkText = chunkWords.join(' ');

      chunks.push({
        chunkId: `chunk_${globalChunkCounter++}`,
        pageNumber: page.pageNumber,
        text: chunkText,
      });

      if (end >= words.length) break;
      start += chunkSize - overlap;
    }
  }

  return chunks;
}

// Tokenize text into lowercased terms
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      prompt,
      systemPrompt,
      userQuery,
      documentText,
      fileData,
      fileName,
      fileType,
      mode,
    } = body;

    const apiKey = process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'GROQ_API_KEY environment variable is not set on the server. Please set GROQ_API_KEY in Vercel project environment variables.' },
        { status: 500 }
      );
    }

    const pages = await extractDocumentPages(fileData, fileName, fileType, documentText);

    if (pages.length === 0) {
      if (mode === 'qa') {
        return NextResponse.json({ reply: 'No response is found from the document.' });
      } else {
        return NextResponse.json({ reply: 'No document text content could be extracted for summarization.' });
      }
    }

    const chunks = chunkDocumentPages(pages);
    const fullDocContent = chunks.map((c) => `[Page ${c.pageNumber}] ${c.text}`).join('\n\n');

    if (mode === 'summary') {
      const messages = [
        {
          role: 'system',
          content:
            'You are an expert document summarizer for TeamGate. Provide a clear, professional executive summary focusing on key objectives, requirements, and deliverables. Format as clean text. Do NOT output raw PDF binary markers, zlib code tokens, or bracket headers. End the summary with a source citation line: [Source: <FileName>].',
        },
        {
          role: 'user',
          content: `Document Name: ${fileName || 'Uploaded Document'}\n\nContent:\n${fullDocContent.slice(0, 8000)}\n\nPlease summarize the key scope, task requirements, and purpose of this document.`,
        },
      ];

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
        console.error('Groq API error (summary):', resp.status, errText);
        return NextResponse.json(
          { error: `Groq API returned status ${resp.status}` },
          { status: resp.status }
        );
      }

      const data = await resp.json();
      let reply = data.choices?.[0]?.message?.content?.trim() || '';
      if (fileName && !reply.includes(`[Source:`)) {
        reply += `\n\n[Source: ${fileName}]`;
      }
      return NextResponse.json({ reply });
    }

    // QA Mode
    const query = userQuery || prompt || '';
    const queryTokens = tokenize(query);

    // Fast local relevance check: if query has keywords but document has zero matching tokens or characters
    const docTextLower = fullDocContent.toLowerCase();
    const hasAnyMatch = queryTokens.some((t) => docTextLower.includes(t));

    // If query contains terms like 'capital', 'recipe', 'football' that are 100% absent from document text
    if (queryTokens.length > 0 && !hasAnyMatch) {
      return NextResponse.json({ reply: 'No response is found from the document.' });
    }

    const defaultSystemPrompt = `You are a Document Retrieval Chatbot for TeamGate.
STRICT MANDATORY RULES:
1. You MUST answer the user's question ONLY using facts, concepts, and information contained in the Document Content provided below.
2. Provide a clear, well-structured answer. If asked for steps, components, tables, or overview, format with markdown tables and bullet points where appropriate.
3. If the user's question relates to concepts, tools, requirements, deliverables, or topics mentioned in the document (such as serverless architecture, AWS Lambda, Amazon S3, DynamoDB, API Gateway, roles, etc.), explain them clearly in the context of the document.
4. At the very end of your answer, append a source citation line in the exact format: [Source: ${fileName || 'Document'}, Page: 1].
5. ONLY if the requested information is completely unrelated to the uploaded document or asks about topics entirely absent from the document, reply strictly with the exact sentence:
"No response is found from the document."`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt || defaultSystemPrompt,
      },
      {
        role: 'user',
        content: `Target File: ${fileName || 'Document'}\n\nDocument Content:\n${fullDocContent.slice(0, 8000)}\n\nUser Question: ${query}`,
      },
    ];

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
      console.error('Groq API error (QA):', resp.status, errText);
      return NextResponse.json(
        { error: `Groq API returned status ${resp.status}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    let reply = data.choices?.[0]?.message?.content?.trim() || '';

    if (
      reply &&
      reply !== 'No response is found from the document.' &&
      !reply.includes('[Source:') &&
      fileName
    ) {
      reply += `\n\n[Source: ${fileName}, Page: 1]`;
    }

    return NextResponse.json({ reply });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('API /api/groq error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}