import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.error("Missing ELEVENLABS_API_KEY");
      return NextResponse.json({ error: "API key missing" }, { status: 500 });
    }

    // Adam (Deep, mature male voice) - works beautifully with Arabic on multilingual v2
    const VOICE_ID = "pNInz6obpgDQGcFmaJgB"; 
    
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("ElevenLabs error:", errorText);
      return NextResponse.json({ error: "Failed to generate audio" }, { status: response.status });
    }

    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
      }
    });
    
  } catch (error) {
    console.error("TTS Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
