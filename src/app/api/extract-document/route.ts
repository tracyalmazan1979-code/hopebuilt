import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      // If no API key, return empty — user fills in manually
      return NextResponse.json({})
    }

    const client = new Anthropic({ apiKey })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: `Extract the following fields from this CAF (Contract Approval Form) document. Return ONLY a JSON object with these fields (use null for any field you can't find):

{
  "campus_name": "the campus or project name (e.g. IDEA Pharr Ph 3)",
  "state": "TX or FL or OH (default TX if not clear)",
  "document_type_name": "type of document (e.g. Task Order, Construction Contract, Service Agreement, etc.)",
  "amount": 12345.67,
  "description": "description of the services or scope",
  "vendor_name": "the vendor or contractor name",
  "funding_source": "the funding source or account string",
  "requester_name": "the person requesting / submitting"
}

Return ONLY the JSON, no markdown, no explanation.`,
            },
          ],
        },
      ],
    })

    // Parse the response
    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    try {
      // Try to parse JSON from the response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        return NextResponse.json(data)
      }
    } catch {
      // If parsing fails, return empty
    }

    return NextResponse.json({})
  } catch (error) {
    console.error('Document extraction failed:', error)
    return NextResponse.json({})
  }
}
