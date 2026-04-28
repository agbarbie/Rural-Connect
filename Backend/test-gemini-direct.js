// Save as: find-models.js
// Run: node find-models.js

const https = require('https');
require('dotenv').config();

console.log('\n🔍 FINDING AVAILABLE GEMINI MODELS\n');
console.log('='.repeat(50));

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error('❌ NO API KEY FOUND!');
  process.exit(1);
}

console.log('✅ API Key:', apiKey.substring(0, 12) + '...');

// First, let's list ALL available models
function listModels() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models?key=${apiKey}`,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    console.log('\n📋 Listing all available models...\n');

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const models = parsed.models || [];
            
            console.log(`✅ Found ${models.length} models:\n`);
            
            const generativeModels = models.filter(m => 
              m.supportedGenerationMethods?.includes('generateContent')
            );
            
            console.log('🎯 MODELS THAT SUPPORT TEXT GENERATION:\n');
            
            generativeModels.forEach((model, idx) => {
              const name = model.name.replace('models/', '');
              console.log(`${idx + 1}. ${name}`);
              console.log(`   Display: ${model.displayName || 'N/A'}`);
              console.log(`   Description: ${model.description || 'N/A'}`);
              console.log('');
            });
            
            if (generativeModels.length > 0) {
              console.log('='.repeat(50));
              console.log('\n✅ ✅ ✅ SOLUTION FOUND! ✅ ✅ ✅\n');
              console.log('🎯 Use this model in your code:\n');
              const firstModel = generativeModels[0].name.replace('models/', '');
              console.log(`   Model: "${firstModel}"\n`);
              console.log('📝 UPDATE gemini.service.ts:\n');
              console.log(`   this.model = this.genAI.getGenerativeModel({ model: '${firstModel}' });\n`);
              console.log('='.repeat(50) + '\n');
              
              resolve(firstModel);
            } else {
              console.log('❌ No generative models available with your API key\n');
              console.log('🔧 SOLUTION:\n');
              console.log('1. Go to: https://aistudio.google.com/app/apikey');
              console.log('2. Delete your current API key');
              console.log('3. Create a NEW API key');
              console.log('4. Make sure to select "Google AI Studio" NOT "Google Cloud Project"');
              console.log('5. Copy the new key to your .env file\n');
              reject(new Error('No models available'));
            }
            
          } catch (e) {
            console.error('❌ Error parsing response:', e.message);
            console.log('Raw response:', data.substring(0, 500));
            reject(e);
          }
        } else {
          console.error(`❌ HTTP ${res.statusCode}: ${res.statusMessage}`);
          console.log('Response:', data.substring(0, 500));
          
          if (res.statusCode === 403) {
            console.log('\n🔧 Your API key is BLOCKED or INVALID\n');
            console.log('Solutions:');
            console.log('1. Create a NEW API key at: https://aistudio.google.com/app/apikey');
            console.log('2. Make sure NOT to share it publicly');
            console.log('3. Update your .env file');
            console.log('4. Wait 5 minutes after creation\n');
          }
          
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Network Error:', error.message);
      reject(error);
    });

    req.setTimeout(10000, () => {
      console.error('❌ Request Timeout');
      req.destroy();
      reject(new Error('Timeout'));
    });

    req.end();
  });
}

async function testModel(modelName) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      contents: [{
        parts: [{
          text: 'Say hello in 3 words'
        }]
      }]
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      port: 443,
      path: `/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };

    console.log(`\n🧪 Testing ${modelName}...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            console.log(`✅ SUCCESS! Response: "${text}"`);
            resolve(true);
          } catch (e) {
            console.log('✅ Got 200 response (working!)');
            resolve(true);
          }
        } else {
          console.log(`❌ HTTP ${res.statusCode}`);
          resolve(false);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Error:', error.message);
      resolve(false);
    });

    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    const workingModel = await listModels();
    
    if (workingModel) {
      console.log('\n🎯 Testing the model to confirm it works...\n');
      const works = await testModel(workingModel);
      
      if (works) {
        console.log('\n🎉🎉🎉 PERFECT! MODEL IS WORKING! 🎉🎉🎉\n');
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

main();