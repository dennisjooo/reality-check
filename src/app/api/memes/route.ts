import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const publicDir = path.join(process.cwd(), "public");
    const imgPosDir = path.join(publicDir, "img", "positive");
    const imgNegDir = path.join(publicDir, "img", "negative");
    const audioPosDir = path.join(publicDir, "audio", "positive");
    const audioNegDir = path.join(publicDir, "audio", "negative");

    const getFiles = (dir: string, regex: RegExp) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter(file => regex.test(file));
    };

    const imageRegex = /\.(png|jpe?g|gif|webp)$/i;
    const audioRegex = /\.(mp3|wav|ogg|m4a)$/i;

    const positiveImages = getFiles(imgPosDir, imageRegex);
    const negativeImages = getFiles(imgNegDir, imageRegex);
    
    const positiveAudio = getFiles(audioPosDir, audioRegex);
    const negativeAudio = getFiles(audioNegDir, audioRegex);

    return NextResponse.json({ 
      positive: positiveImages, 
      negative: negativeImages,
      positiveAudio,
      negativeAudio
    });
  } catch (error) {
    console.error("Failed to read meme directories:", error);
    return NextResponse.json({ 
      positive: [], 
      negative: [],
      positiveAudio: [],
      negativeAudio: []
    }, { status: 500 });
  }
}
