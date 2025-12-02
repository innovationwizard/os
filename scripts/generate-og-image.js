const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateOGImage() {
  const svgPath = path.join(__dirname, '../public/message-circle-heart.svg');
  const outputPath = path.join(__dirname, '../public/og-image.png');
  
  // Read SVG
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Create white background
  const whiteBackground = sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  });
  
  // Resize SVG icon to 600x600 (smaller than canvas)
  const iconBuffer = await sharp(svgBuffer)
    .resize(600, 600, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  
  // Composite icon on white background
  await whiteBackground
    .composite([{
      input: iconBuffer,
      gravity: 'center'
    }])
    .png()
    .toFile(outputPath);
  
  console.log('OG image generated successfully at', outputPath);
}

generateOGImage().catch(console.error);
