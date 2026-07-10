import fs from 'fs';
import path from 'path';

// --- YOUR CONFIGURATION ---
const MY_EMAIL = 'your-email@example.com'; // Put your email back here!

const EN_PATH = path.resolve('./src/locales/en.json');
const DE_PATH = path.resolve('./src/locales/de.json');

async function translateMissingKeys() {
  console.log('🔍 Checking for missing German translations...');

  const enData = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'));
  let deData = {};
  if (fs.existsSync(DE_PATH)) {
    deData = JSON.parse(fs.readFileSync(DE_PATH, 'utf8'));
  }

  const missingKeys = [];
  for (const key in enData) {
    // Check if it's missing, identical, OR if the German file has an empty string
    if (!deData[key] || deData[key] === enData[key] || deData[key] === "") {
      missingKeys.push(key);
    }
  }

  if (missingKeys.length === 0) {
    console.log('✅ All translations are up to date!');
    return;
  }

  console.log(`🚀 Found ${missingKeys.length} phrases to check...`);

  for (const key of missingKeys) {
    // 🛡️ THE FIX: If the value is empty, use the KEY itself as the English text!
    let textToTranslate = enData[key];
    if (!textToTranslate || textToTranslate.trim() === '') {
      textToTranslate = key; 
    }
    
    // If it's somehow STILL completely empty, safely skip it
    if (!textToTranslate || textToTranslate.trim() === '') {
      continue;
    }

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=en|de&de=${MY_EMAIL}`;

    try {
      const response = await fetch(url);
      const result = await response.json();

      if (result.responseStatus === 200 && result.responseData) {
        deData[key] = result.responseData.translatedText;
        console.log(`✅ Success: "${textToTranslate}" -> "${deData[key]}"`);
      } else {
        console.log(`⚠️ API Rejected "${textToTranslate}". Reason: ${result.responseDetails || 'Unknown Limit Reached'}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));

    } catch (error) {
      console.error(`❌ Crash on "${textToTranslate}":`, error.message);
    }
  }

  fs.writeFileSync(DE_PATH, JSON.stringify(deData, null, 2));
  console.log('🎉 Translation complete!');
}

translateMissingKeys();