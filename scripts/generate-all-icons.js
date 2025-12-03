const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateAllIcons() {
  const svgPath = path.join(__dirname, '../public/message-circle-heart.svg');
  const publicDir = path.join(__dirname, '../public');
  
  // Read SVG
  const svgBuffer = fs.readFileSync(svgPath);
  
  // Define all icon sizes to generate
  const iconSizes = [
    // Favicons
    { name: 'favicon-16x16.png', size: 16 },
    { name: 'favicon-32x32.png', size: 32 },
    { name: 'favicon-48x48.png', size: 48 },
    { name: 'favicon-192x192.png', size: 192 },
    { name: 'favicon-512x512.png', size: 512 },
    // Apple touch icons
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'apple-touch-icon-60x60.png', size: 60 },
    { name: 'apple-touch-icon-76x76.png', size: 76 },
    { name: 'apple-touch-icon-120x120.png', size: 120 },
    { name: 'apple-touch-icon-152x152.png', size: 152 },
    { name: 'apple-touch-icon-167x167.png', size: 167 },
    { name: 'apple-touch-icon-180x180.png', size: 180 },
  ];
  
  console.log('Generating icons with proper color preservation...');
  
  // Generate each icon
  for (const icon of iconSizes) {
    const outputPath = path.join(publicDir, icon.name);
    
    // Create white background first
    const whiteBg = sharp({
      create: {
        width: icon.size,
        height: icon.size,
        channels: 3,
        background: { r: 255, g: 255, b: 255 }
      }
    });
    
    // Resize SVG icon
    const iconResized = await sharp(svgBuffer)
      .resize(icon.size, icon.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent for compositing
      })
      .png()
      .toBuffer();
    
    // Composite icon on white background
    await whiteBg
      .composite([{
        input: iconResized,
        gravity: 'center'
      }])
      .removeAlpha() // Ensure no alpha channel - solid RGB
      .png({
        compressionLevel: 9,
        quality: 100
      })
      .toFile(outputPath);
    
    console.log(`✓ Generated ${icon.name} (${icon.size}x${icon.size})`);
  }
  
  // Generate OG image separately (different dimensions)
  console.log('\nGenerating OG image...');
  const ogImagePath = path.join(publicDir, 'og-image.png');
  
  const whiteBackground = sharp({
    create: {
      width: 1200,
      height: 630,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  });
  
  const iconBuffer = await sharp(svgBuffer)
    .resize(600, 600, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .removeAlpha()
    .png()
    .toBuffer();
  
  await whiteBackground
    .composite([{
      input: iconBuffer,
      gravity: 'center'
    }])
    .removeAlpha() // Ensure no alpha channel - solid RGB
    .png({
      compressionLevel: 9,
      quality: 100
    })
    .toFile(ogImagePath);
  
  console.log('✓ Generated og-image.png (1200x630)');
  console.log('\nAll icons generated successfully!');
}

generateAllIcons().catch(console.error);
