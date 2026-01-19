// aiService.js - Advanced AI integration with Claude
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// PROMPT PERSONALIZATION
// ============================================================================

async function personalizePrompts(prompts, userProfile, recentResponses) {
  try {
    const context = buildUserContext(userProfile, recentResponses);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are helping create personalized daily prompts for a legacy preservation app.

User Context:
${context}

Available Prompts:
${prompts.map((p, i) => `${i + 1}. ${p.title}: "${p.question}" (Type: ${p.prompt_type})`).join('\n')}

Task: Select the 3-5 most relevant prompts for this user and personalize the questions to reference their specific background, interests, and life events. Make the questions feel personal and engaging.

Return ONLY a JSON array with this exact format:
[
  {
    "id": "original-prompt-id",
    "title": "Personalized Title",
    "question": "Personalized question that mentions specific details about the user",
    "type": "prompt_type",
    "relevanceScore": 0.95
  }
]`
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (jsonMatch) {
      const personalizedPrompts = JSON.parse(jsonMatch[0]);
      return personalizedPrompts.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
    
    return prompts.slice(0, 5);
  } catch (error) {
    console.error('Error personalizing prompts:', error);
    return prompts.slice(0, 5);
  }
}

// ============================================================================
// FOLLOW-UP QUESTION GENERATION
// ============================================================================

async function generateFollowUp(response, prompt, userProfile) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are helping someone preserve their life story for future generations.

Original Question: "${prompt}"
Their Response: "${response}"

Generate ONE thoughtful follow-up question that:
1. Helps them share more specific details
2. Encourages deeper reflection
3. Feels natural and conversational
4. Respects their emotional state

Return ONLY the follow-up question, nothing else.`
      }]
    });

    return message.content[0].text.trim();
  } catch (error) {
    console.error('Error generating follow-up:', error);
    return null;
  }
}

// ============================================================================
// RESPONSE ANALYSIS
// ============================================================================

async function analyzeResponse(responseText, promptText) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analyze this personal memory response for a legacy preservation app.

Prompt: "${promptText}"
Response: "${responseText}"

Extract and return ONLY a JSON object with:
{
  "themes": ["theme1", "theme2"],
  "emotions": ["emotion1", "emotion2"],
  "values": ["value1", "value2"],
  "keyPeople": ["person1", "person2"],
  "timeperiod": "1960s" or "childhood" etc,
  "locations": ["location1"],
  "sentiment": "positive/negative/mixed/reflective",
  "complexity": 1-5,
  "topics": ["topic1", "topic2"]
}`
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {};
  } catch (error) {
    console.error('Error analyzing response:', error);
    return {};
  }
}

// ============================================================================
// PERSONA BUILDING
// ============================================================================

async function generatePersonaResponse(userMessage, userData, conversationHistory = []) {
  try {
    const personaContext = buildPersonaContext(userData);
    
    // Build conversation with context
    const messages = [
      {
        role: 'user',
        content: `${personaContext}\n\nNow respond to this message as this person would: "${userMessage}"`
      }
    ];

    // Add conversation history if available
    if (conversationHistory.length > 0) {
      conversationHistory.forEach(msg => {
        messages.push({
          role: msg.role === 'user' ? 'user' : 'assistant',
          content: msg.content
        });
      });
      messages.push({
        role: 'user',
        content: userMessage
      });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      temperature: 0.8, // Slightly more creative for persona
      messages: messages
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Error generating persona response:', error);
    throw error;
  }
}

// ============================================================================
// MEMORY EXTRACTION FROM FILES
// ============================================================================

async function extractMemoriesFromDocument(documentText, userProfile) {
  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Extract key memories, stories, and insights from this personal document.

User Profile:
Name: ${userProfile.full_name}
Birth Year: ${userProfile.birth_date ? new Date(userProfile.birth_date).getFullYear() : 'Unknown'}

Document Content:
${documentText.slice(0, 10000)} // Limit to avoid token overflow

Extract and return ONLY a JSON object:
{
  "memories": [
    {
      "summary": "Brief summary",
      "fullText": "Detailed memory",
      "timeperiod": "1960s",
      "people": ["name1"],
      "locations": ["place1"],
      "themes": ["theme1"],
      "importance": 1-5
    }
  ],
  "values": ["value1", "value2"],
  "personalityTraits": ["trait1"],
  "lifePhilosophy": "key insights"
}`
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return { memories: [], values: [], personalityTraits: [], lifePhilosophy: '' };
  } catch (error) {
    console.error('Error extracting memories:', error);
    return { memories: [], values: [], personalityTraits: [], lifePhilosophy: '' };
  }
}

// ============================================================================
// EMBEDDINGS GENERATION
// ============================================================================

async function generateEmbedding(text) {
  try {
    // Note: Claude doesn't directly provide embeddings
    // You would typically use a dedicated embedding model like:
    // - OpenAI's text-embedding-ada-002
    // - Cohere's embed-english-v3.0
    // - Voyage AI embeddings
    
    // For now, returning a placeholder
    // In production, integrate with an embedding service:
    
    /*
    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input: text
      })
    });
    
    const data = await response.json();
    return data.data[0].embedding;
    */
    
    // Placeholder - implement actual embedding service
    console.warn('Embedding generation not implemented - using placeholder');
    return new Array(1536).fill(0).map(() => Math.random());
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

// ============================================================================
// SEMANTIC SEARCH
// ============================================================================

async function semanticSearch(query, userEmbeddings, topK = 5) {
  try {
    const queryEmbedding = await generateEmbedding(query);
    
    // Calculate cosine similarity with stored embeddings
    const similarities = userEmbeddings.map(item => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding)
    }));
    
    // Sort by similarity and return top K
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  } catch (error) {
    console.error('Error in semantic search:', error);
    return [];
  }
}

// ============================================================================
// SUMMARY GENERATION
// ============================================================================

async function generateLifeSummary(userData) {
  try {
    const context = buildPersonaContext(userData);
    
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `${context}

Create a beautiful, heartfelt summary of this person's life story based on their memories and experiences. Write it in their voice, capturing their wisdom, values, and unique perspective. This summary will be shared with their loved ones.

Format it as a personal letter or reflection, 500-800 words.`
      }]
    });

    return message.content[0].text;
  } catch (error) {
    console.error('Error generating life summary:', error);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildUserContext(profile, responses) {
  const contextParts = [];
  
  if (profile?.birth_date) {
    const age = new Date().getFullYear() - new Date(profile.birth_date).getFullYear();
    contextParts.push(`Age: ${age} years old`);
  }
  
  if (profile?.birth_location) {
    contextParts.push(`Born in: ${profile.birth_location}`);
  }
  
  if (profile?.life_events?.length > 0) {
    contextParts.push(`Life Events: ${profile.life_events.join(', ')}`);
  }
  
  if (profile?.interests?.length > 0) {
    contextParts.push(`Interests: ${profile.interests.join(', ')}`);
  }
  
  if (responses?.length > 0) {
    contextParts.push(`\nRecent Topics Discussed: ${
      responses.slice(0, 5)
        .map(r => r.prompt_text)
        .join('; ')
    }`);
  }
  
  return contextParts.join('\n');
}

function buildPersonaContext(userData) {
  const { profile, responses } = userData;
  
  let context = `You are an AI representation of a person with the following background:

`;
  
  if (profile?.birth_date) {
    context += `Birth Date: ${profile.birth_date}\n`;
  }
  
  if (profile?.birth_location) {
    context += `Birth Place: ${profile.birth_location}\n`;
  }
  
  if (profile?.life_events?.length > 0) {
    context += `\nMajor Life Events:\n${profile.life_events.map(e => `- ${e}`).join('\n')}\n`;
  }
  
  if (profile?.interests?.length > 0) {
    context += `\nInterests & Passions:\n${profile.interests.map(i => `- ${i}`).join('\n')}\n`;
  }
  
  if (responses?.length > 0) {
    context += `\n=== Their Memories and Thoughts ===\n\n`;
    responses.slice(0, 20).forEach((r, idx) => {
      context += `Memory ${idx + 1}:\nQuestion: ${r.prompt_text}\nResponse: ${r.response_text}\n\n`;
    });
  }
  
  context += `\n=== Instructions ===
Respond as this person would, drawing from their experiences, values, and personality shown in their memories. Be authentic, warm, and reflect their unique voice and perspective. Share wisdom and stories naturally in conversation.`;
  
  return context;
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) {
    throw new Error('Vectors must have the same length');
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (normA * normB);
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  personalizePrompts,
  generateFollowUp,
  analyzeResponse,
  generatePersonaResponse,
  extractMemoriesFromDocument,
  generateEmbedding,
  semanticSearch,
  generateLifeSummary,
};
