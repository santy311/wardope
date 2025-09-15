import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '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',
  dangerouslyAllowBrowser: true,
});

export interface StylingSuggestion {
  id: string;
  title: string;
  description: string;
  category: string;
  confidence: number;
}

export interface ClothingDescription {
  id: string;
  itemType: string;
  color: string;
  style: string;
  pattern: string;
  fit: string;
  occasion: string;
  season: string;
  detailedDescription: string;
  category: string;
  tags: string[];
}

export interface ClothingDetectionResult {
  isClothing: boolean;
  confidence: number;
  detectedItem?: string;
  reason?: string;
}

// Combined function to reduce API calls
export const analyzeClothingComprehensive = async (imageBase64: string): Promise<{
  detection: ClothingDetectionResult;
  description: ClothingDescription;
  suggestions: StylingSuggestion[];
}> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a comprehensive clothing analysis expert. Analyze the image and provide:

1. CLOTHING DETECTION: Determine if the image contains clothing items
2. DETAILED DESCRIPTION: Create a structured description of the clothing item
3. STYLING SUGGESTIONS: Provide styling recommendations

Return your response as a JSON object with this exact structure:
{
  "detection": {
    "isClothing": true/false,
    "confidence": 0.0-1.0,
    "detectedItem": "description of what you see",
    "reason": "brief explanation of your decision"
  },
  "description": {
    "id": "unique_timestamp_id",
    "itemType": "specific item type",
    "color": "detailed color description",
    "style": "casual/formal/business/evening/sporty",
    "pattern": "pattern description",
    "fit": "fit description",
    "occasion": "occasion description",
    "season": "season description",
    "detailedDescription": "comprehensive 2-3 sentence description",
    "category": "T-Shirts/Shirts/Jeans/Pants/Dresses/Skirts/Jackets/Sweaters/Shoes/Accessories",
    "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
  },
  "suggestions": [
    {
      "id": "unique_id",
      "title": "Brief title",
      "description": "Detailed styling suggestion",
      "category": "Casual/Business/Evening/Sporty/Formal",
      "confidence": 0.95
    }
  ]
}

If the image doesn't contain clothing, set isClothing to false and provide minimal fallback data.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this image comprehensively for clothing detection, detailed description, and styling suggestions:" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        let cleanedContent = content.trim();
        
        // Remove markdown code blocks if present
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/, '');
        }
        if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/, '');
        }
        if (cleanedContent.endsWith('```')) {
          cleanedContent = cleanedContent.replace(/\s*```$/, '');
        }
        
        const result = JSON.parse(cleanedContent);
        
        return {
          detection: result.detection || createFallbackClothingDetection(),
          description: result.description || createFallbackClothingDescription(),
          suggestions: result.suggestions || createFallbackSuggestions()
        };
      } catch (parseError) {
        console.log('Failed to parse comprehensive analysis, using fallbacks');
        return {
          detection: createFallbackClothingDetection(),
          description: createFallbackClothingDescription(),
          suggestions: createFallbackSuggestions()
        };
      }
    }
    
    return {
      detection: createFallbackClothingDetection(),
      description: createFallbackClothingDescription(),
      suggestions: createFallbackSuggestions()
    };
  } catch (error) {
    console.error('Error in comprehensive analysis:', error);
    return {
      detection: createFallbackClothingDetection(),
      description: createFallbackClothingDescription(),
      suggestions: createFallbackSuggestions()
    };
  }
};

export const detectClothingInImage = async (imageBase64: string): Promise<ClothingDetectionResult> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model for simple detection
      messages: [
        {
          role: "system",
          content: `You are a clothing detection expert. Your task is to determine if the image contains clothing items that can be worn.

CLOTHING ITEMS INCLUDE:
- Shirts, t-shirts, blouses, sweaters, jackets, coats
- Pants, jeans, shorts, skirts, dresses
- Shoes, boots, sneakers, sandals
- Hats, caps, scarves, gloves
- Accessories like belts, bags, jewelry
- Undergarments, swimwear, activewear
- Any fabric or textile item that can be worn
- Clothing items on hangers, folded, or displayed
- Partial clothing items (sleeves, collars, etc.)

NON-CLOTHING ITEMS INCLUDE:
- Furniture, electronics, food, animals
- Buildings, landscapes, vehicles
- Objects, tools, books, plants
- People without visible clothing items
- Abstract images, text, logos

Analyze the image and respond with a JSON object:
{
  "isClothing": true/false,
  "confidence": 0.0-1.0,
  "detectedItem": "description of what you see",
  "reason": "brief explanation of your decision"
}

Be reasonable - if you can see any clothing or fabric items, classify as clothing. If uncertain, lean towards clothing.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Does this image contain clothing items that can be worn?" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      max_tokens: 300,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    console.log('Clothing detection response:', content);
    
    if (content) {
      try {
        // Clean the content to remove markdown code blocks if present
        let cleanedContent = content.trim();
        
        // Remove markdown code blocks if present
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/, '');
        }
        if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/, '');
        }
        if (cleanedContent.endsWith('```')) {
          cleanedContent = cleanedContent.replace(/\s*```$/, '');
        }
        
        console.log('Cleaned content for parsing:', cleanedContent);
        
        const result = JSON.parse(cleanedContent);
        console.log('Parsed detection result:', result);
        
        return {
          isClothing: result.isClothing || false,
          confidence: result.confidence || 0.0,
          detectedItem: result.detectedItem || 'Unknown',
          reason: result.reason || 'No reason provided'
        };
      } catch (parseError) {
        console.log('Failed to parse clothing detection response, using fallback');
        console.log('Parse error:', parseError);
        console.log('Raw content:', content);
        return createFallbackClothingDetection();
      }
    }
    
    console.log('No content received from OpenAI, using fallback');
    return createFallbackClothingDetection();
  } catch (error) {
    console.error('Error detecting clothing:', error);
    return createFallbackClothingDetection();
  }
};

export const analyzeClothingImage = async (imageBase64: string): Promise<StylingSuggestion[]> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use cheaper model for styling suggestions
      messages: [
        {
          role: "system",
          content: `You are a professional fashion stylist and clothing analyzer. Your task is to analyze clothing items and provide detailed styling suggestions.

When analyzing a clothing item, provide:
1. A detailed description of the item (type, color, style, fit)
2. Styling suggestions for how to wear it
3. Appropriate categories and occasions
4. Confidence scores for your analysis

Return your response as a JSON array with the following structure:
[
  {
    "id": "unique_id",
    "title": "Brief title",
    "description": "Detailed styling suggestion",
    "category": "Casual/Business/Evening/Sporty/Formal",
    "confidence": 0.95
  }
]

Be specific about colors and styling recommendations.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyze this clothing item and provide styling suggestions:" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        // Clean the content to remove markdown code blocks if present
        let cleanedContent = content.trim();
        
        // Remove markdown code blocks if present
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/, '');
        }
        if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/, '');
        }
        if (cleanedContent.endsWith('```')) {
          cleanedContent = cleanedContent.replace(/\s*```$/, '');
        }
        
        const suggestions = JSON.parse(cleanedContent);
        return Array.isArray(suggestions) ? suggestions : createFallbackSuggestions();
      } catch (parseError) {
        console.log('Failed to parse OpenAI response as JSON, using fallback');
        return createFallbackSuggestions();
      }
    }
    
    return createFallbackSuggestions();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return createFallbackSuggestions();
  }
};

export const createDetailedClothingDescription = async (imageBase64: string): Promise<ClothingDescription> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional fashion analyst. Create a detailed, structured description of the clothing item in the image.

Analyze the item and provide a comprehensive description including:
- Item type (shirt, pants, dress, etc.)
- Color (be specific about shades)
- Style (casual, formal, vintage, modern, etc.)
- Pattern (solid, striped, floral, etc.)
- Fit (loose, fitted, oversized, etc.)
- Occasion (casual, business, evening, sporty, etc.)
- Season (spring, summer, fall, winter, all-season)
- Detailed description (comprehensive analysis)
- Category (T-Shirts, Shirts, Jeans, Pants, Dresses, Skirts, Jackets, Sweaters, Shoes, Accessories)
- Tags (relevant keywords for matching)

IMPORTANT: 
- Do NOT attempt to identify materials (cotton, silk, denim, etc.) as this cannot be accurately determined from photos alone.
- Use specific clothing categories like "T-Shirts", "Shirts", "Jeans", "Pants", "Dresses", "Skirts", "Jackets", "Sweaters", "Shoes", "Accessories" for the category field.
- Use style descriptions like "casual", "formal", "business", "evening", "sporty" for the style field.

Return your response as a JSON object with this exact structure:
{
  "id": "unique_timestamp_id",
  "itemType": "specific item type",
  "color": "detailed color description",
  "style": "casual/formal/business/evening/sporty",
  "pattern": "pattern description",
  "fit": "fit description",
  "occasion": "occasion description",
  "season": "season description",
  "detailedDescription": "comprehensive 2-3 sentence description",
  "category": "T-Shirts/Shirts/Jeans/Pants/Dresses/Skirts/Jackets/Sweaters/Shoes/Accessories",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
}

Be very specific and detailed in your analysis, but avoid making assumptions about materials that cannot be visually confirmed.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Create a detailed description of this clothing item:" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        // Clean the content to remove markdown code blocks if present
        let cleanedContent = content.trim();
        
        // Remove markdown code blocks if present
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/, '');
        }
        if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/, '');
        }
        if (cleanedContent.endsWith('```')) {
          cleanedContent = cleanedContent.replace(/\s*```$/, '');
        }
        
        const description = JSON.parse(cleanedContent);
        return description;
      } catch (parseError) {
        console.log('Failed to parse clothing description, using fallback');
        return createFallbackClothingDescription();
      }
    }
    
    return createFallbackClothingDescription();
  } catch (error) {
    console.error('Error creating clothing description:', error);
    return createFallbackClothingDescription();
  }
};

export const findBestMatchesWithDescriptions = async (
  newItemDescription: ClothingDescription,
  existingItems: Array<{ id: string; description: ClothingDescription; name: string; imageUri: string }>
): Promise<Array<{ item: any; score: number; reasoning: string; styleCategory: string; occasion: string }>> => {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a professional fashion stylist with years of experience in creating perfect outfits. Your goal is to suggest COMPLEMENTARY clothing items that create cohesive, stylish outfits while considering the user's preferences and occasions.

CRITICAL RULES:
1. NEVER suggest items of the same category as the new item (e.g., if new item is a t-shirt, don't suggest another t-shirt)
2. Focus on creating complete outfits by suggesting different clothing categories
3. Consider what would be worn together in a real outfit
4. Act as a professional stylist - provide expert fashion advice
5. Consider color harmony, style coordination, and occasion appropriateness

STYLIST APPROACH:
- Analyze the new item's style, color, and occasion
- Suggest complementary items that enhance the overall look
- Provide style direction (e.g., "This creates a sporty look" or "This gives a business-casual vibe")
- Consider the occasion and suggest appropriate styling
- If the combination creates a specific style, clearly state it

OUTFIT MATCHING GUIDELINES:
- If new item is a TOP (t-shirt, shirt, blouse, sweater): suggest BOTTOMS (pants, jeans, skirts) and SHOES
- If new item is a BOTTOM (pants, jeans, skirt): suggest TOPS (t-shirts, shirts, blouses) and SHOES  
- If new item is SHOES: suggest TOPS and BOTTOMS
- If new item is a DRESS: suggest SHOES and ACCESSORIES
- If new item is a JACKET/COAT: suggest TOPS and BOTTOMS that work underneath

STYLE CATEGORIES TO IDENTIFY:
- Sporty/Athletic: Active, comfortable, performance-oriented
- Business/Professional: Formal, polished, office-appropriate
- Casual/Everyday: Relaxed, comfortable, daily wear
- Evening/Formal: Elegant, sophisticated, special occasions
- Streetwear/Urban: Trendy, edgy, fashion-forward
- Classic/Timeless: Traditional, refined, always in style
- Bohemian/Artistic: Creative, free-spirited, eclectic
- Minimalist/Simple: Clean, understated, essential pieces

For each comparison, consider:
- Category compatibility (different categories that work together)
- Color coordination and harmony (avoid clashing colors)
- Style coordination (casual with casual, formal with formal)
- Occasion appropriateness (work, casual, evening, etc.)
- Season compatibility
- Overall aesthetic harmony
- The style direction the combination creates

Return your response as a JSON array with this structure:
[
  {
    "itemId": "existing_item_id",
    "score": 0.95,
    "reasoning": "Detailed explanation of why this item complements the new item for a complete outfit",
    "styleCategory": "The style category this combination creates (e.g., 'Sporty', 'Business-Casual', 'Evening')",
    "occasion": "The occasion this combination is perfect for (e.g., 'Work', 'Weekend', 'Date Night', 'Gym')"
  }
]

Score from 0.0 to 1.0, where 1.0 is a perfect complementary match. Only suggest items that would actually be worn together in a real outfit. Provide professional stylist-level advice.`
        },
        {
          role: "user",
          content: `New Item Description:
${JSON.stringify(newItemDescription, null, 2)}

Existing Wardrobe Items:
${JSON.stringify(existingItems.map(item => ({
  id: item.id,
  name: item.name,
  description: item.description
})), null, 2)}

As a professional stylist, find the best COMPLEMENTARY matches that would create complete outfits. For each match, identify the style category it creates and the occasion it's perfect for. Provide expert fashion advice.`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content;
    if (content) {
      try {
        // Clean the content to remove markdown code blocks if present
        let cleanedContent = content.trim();
        
        // Remove markdown code blocks if present
        if (cleanedContent.startsWith('```json')) {
          cleanedContent = cleanedContent.replace(/^```json\s*/, '');
        }
        if (cleanedContent.startsWith('```')) {
          cleanedContent = cleanedContent.replace(/^```\s*/, '');
        }
        if (cleanedContent.endsWith('```')) {
          cleanedContent = cleanedContent.replace(/\s*```$/, '');
        }
        
        const matches = JSON.parse(cleanedContent);
        return matches.map((match: any) => ({
          item: existingItems.find(item => item.id === match.itemId),
          score: match.score,
          reasoning: match.reasoning,
          styleCategory: match.styleCategory || 'Casual',
          occasion: match.occasion || 'Everyday'
        })).filter((match: any) => match.item && match.score > 0.3);
      } catch (parseError) {
        console.log('Failed to parse matching results, using fallback');
        return createFallbackMatches(existingItems, newItemDescription);
      }
    }
    
    return createFallbackMatches(existingItems, newItemDescription);
  } catch (error) {
    console.error('Error finding matches with descriptions:', error);
    return createFallbackMatches(existingItems, newItemDescription);
  }
};

const createFallbackSuggestions = (): StylingSuggestion[] => {
  return [
    {
      id: "fallback_1",
      title: "Versatile Styling",
      description: "This item can be styled in multiple ways for different occasions. Consider pairing it with complementary pieces for a complete look.",
      category: "Casual",
      confidence: 0.8
    },
    {
      id: "fallback_2",
      title: "Color Coordination",
      description: "The color of this item works well with neutral tones and can be accessorized with bold accents for a pop of color.",
      category: "Casual",
      confidence: 0.7
    }
  ];
};

const createFallbackClothingDescription = (): ClothingDescription => {
  return {
    id: `fallback_${Date.now()}`,
    itemType: "clothing item",
    color: "various",
    style: "casual",
    pattern: "solid",
    fit: "standard",
    occasion: "casual",
    season: "all-season",
    detailedDescription: "A versatile clothing item suitable for various occasions and styling options.",
    category: "T-Shirts", // Use proper clothing category instead of style
    tags: ["versatile", "casual", "comfortable"]
  };
};

const createFallbackClothingDetection = (): ClothingDetectionResult => {
  console.log('Using fallback clothing detection - assuming clothing to avoid false negatives');
  return {
    isClothing: true, // Changed from false to true to be more permissive
    confidence: 0.5,  // Medium confidence since we're not sure
    detectedItem: "Clothing item (detection failed)",
    reason: "AI detection failed, allowing clothing analysis to proceed"
  };
};

const createFallbackMatches = (existingItems: any[], newItemDescription: ClothingDescription): Array<{ item: any; score: number; reasoning: string; styleCategory: string; occasion: string }> => {
  // This fallback is now more specific to complementing, not just matching
  const newItemCategory = newItemDescription.category;
  const complementaryItems: Array<{ item: any; score: number; reasoning: string; styleCategory: string; occasion: string }> = [];

  existingItems.forEach(item => {
    const itemCategory = item.description.category;
    const itemColor = item.description.color;
    const itemStyle = item.description.style;

    // Rule 1: Never suggest the same category
    if (itemCategory !== newItemCategory) {
      // Rule 2: Suggest different categories that work together
      if (newItemCategory === 'TOP' && itemCategory === 'BOTTOM') {
        complementaryItems.push({
          item,
          score: 0.9, // Strong score for complementary bottoms
          reasoning: `${item.name} is a great complement to your ${newItemDescription.itemType} for a complete outfit. The ${item.description.color} ${item.description.style} ${item.description.itemType} goes well with the ${newItemDescription.color} ${newItemDescription.style} ${newItemDescription.itemType}.`,
          styleCategory: 'Casual',
          occasion: 'Everyday'
        });
      } else if (newItemCategory === 'BOTTOM' && itemCategory === 'TOP') {
        complementaryItems.push({
          item,
          score: 0.9, // Strong score for complementary tops
          reasoning: `${item.name} is a great complement to your ${newItemDescription.itemType} for a complete outfit. The ${item.description.color} ${item.description.style} ${item.description.itemType} goes well with the ${newItemDescription.color} ${newItemDescription.style} ${newItemDescription.itemType}.`,
          styleCategory: 'Casual',
          occasion: 'Everyday'
        });
      } else if (newItemCategory === 'SHOES' && itemCategory === 'TOP') {
        complementaryItems.push({
          item,
          score: 0.8, // Strong score for complementary shoes
          reasoning: `${item.name} is a great complement to your ${newItemDescription.itemType} for a complete outfit. The ${item.description.color} ${item.description.style} ${item.description.itemType} goes well with the ${newItemDescription.color} ${newItemDescription.style} ${newItemDescription.itemType}.`,
          styleCategory: 'Casual',
          occasion: 'Everyday'
        });
      } else if (newItemCategory === 'SHOES' && itemCategory === 'BOTTOM') {
        complementaryItems.push({
          item,
          score: 0.8, // Strong score for complementary shoes
          reasoning: `${item.name} is a great complement to your ${newItemDescription.itemType} for a complete outfit. The ${item.description.color} ${item.description.style} ${item.description.itemType} goes well with the ${newItemDescription.color} ${newItemDescription.style} ${newItemDescription.itemType}.`,
          styleCategory: 'Casual',
          occasion: 'Everyday'
        });
      } else if (newItemCategory === 'DRESS' && itemCategory === 'SHOES') {
        complementaryItems.push({
          item,
          score: 0.9, // Strong score for complementary shoes
          reasoning: `${item.name} is a great complement to your ${newItemDescription.itemType} for a complete outfit. The ${item.description.color} ${item.description.style} ${item.description.itemType} goes well with the ${newItemDescription.color} ${newItemDescription.style} ${newItemDescription.itemType}.`,
          styleCategory: 'Evening',
          occasion: 'Special Occasions'
        });
      } else if (newItemCategory === 'JACKET/COAT' && itemCategory === 'TOP') {
        complementaryItems.push({
          item,
          score: 0.8, // Strong score for complementary tops
          reasoning: `${item.name} is a great complement to your ${newItemDescription.itemType} for a complete outfit. The ${item.description.color} ${item.description.style} ${item.description.itemType} goes well with the ${newItemDescription.color} ${newItemDescription.style} ${newItemDescription.itemType}.`,
          styleCategory: 'Business',
          occasion: 'Work'
        });
      } else if (newItemCategory === 'JACKET/COAT' && itemCategory === 'BOTTOM') {
        complementaryItems.push({
          item,
          score: 0.8, // Strong score for complementary bottoms
          reasoning: `${item.name} is a great complement to your ${newItemDescription.itemType} for a complete outfit. The ${item.description.color} ${item.description.style} ${item.description.itemType} goes well with the ${newItemDescription.color} ${newItemDescription.style} ${newItemDescription.itemType}.`,
          styleCategory: 'Business',
          occasion: 'Work'
        });
      }
    }
  });

  // Sort by score descending
  return complementaryItems.sort((a, b) => b.score - a.score);
};
