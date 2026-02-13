// check-dyte-presets.js
const axios = require('axios');
require('dotenv').config();

const DYTE_API_KEY = process.env.DYTE_API_KEY;
const DYTE_ORG_ID = process.env.DYTE_ORG_ID;
const DYTE_API_URL = process.env.DYTE_API_URL || 'https://api.dyte.io/v2';

async function checkDytePresets() {
  console.log('🔍 Checking Dyte Configuration...\n');
  
  if (!DYTE_API_KEY || !DYTE_ORG_ID) {
    console.error('❌ Missing Dyte credentials!');
    process.exit(1);
  }
  
  console.log('✅ Credentials found');
  console.log('   API URL:', DYTE_API_URL);
  console.log('   Org ID:', DYTE_ORG_ID);
  console.log();
  
  const auth = Buffer.from(`${DYTE_ORG_ID}:${DYTE_API_KEY}`).toString('base64');
  const headers = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json'
  };
  
  try {
    console.log('📋 Fetching your Dyte presets...\n');
    
    const response = await axios.get(`${DYTE_API_URL}/presets`, { headers });
    const presets = response.data.data || [];
    
    if (presets.length === 0) {
      console.log('⚠️  No presets found!');
      return;
    }
    
    console.log(`✅ Found ${presets.length} preset(s):\n`);
    
    presets.forEach((preset, index) => {
      console.log(`${index + 1}. Preset: "${preset.name}"`);
      console.log(`   ID: ${preset.id}`);
      console.log();
    });
    
    const hostPreset = presets.find(p => p.name === 'host');
    const participantPreset = presets.find(p => p.name === 'participant');
    
    console.log('📌 Preset Status:');
    console.log(`   "host" preset: ${hostPreset ? '✅ Found' : '❌ Not found'}`);
    console.log(`   "participant" preset: ${participantPreset ? '✅ Found' : '❌ Not found'}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

checkDytePresets();