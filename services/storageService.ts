import AsyncStorage from '@react-native-async-storage/async-storage';
import { StylingSuggestion, ClothingDescription } from './openaiService';
import { imageToBase64 } from '../utils/imageUtils';

export interface ClothingItem {
  id: string;
  imageUri: string;
  imageBase64?: string; // Add base64 image data for reliable storage
  suggestions: StylingSuggestion[];
  category: string;
  style: string; // Add style property for filtering
  dateAdded: string;
  name?: string;
  tags?: string[];
  description?: ClothingDescription; // Detailed AI-generated description
}

const STORAGE_KEY = 'dresswell_clothing_items';

export const saveClothingItem = async (clothingItem: ClothingItem): Promise<void> => {
  try {
    // Convert image to base64 for reliable storage
    let itemWithBase64 = { ...clothingItem };
    
    if (clothingItem.imageUri && !clothingItem.imageBase64) {
      try {
        console.log('Converting image to base64 for storage...');
        const base64Data = await imageToBase64(clothingItem.imageUri);
        itemWithBase64.imageBase64 = base64Data;
        console.log('Image converted to base64 successfully');
      } catch (error) {
        console.error('Failed to convert image to base64:', error);
        // Continue without base64 if conversion fails
      }
    }
    
    // Get existing items
    const existingItems = await getClothingItems();
    
    // Add new item
    const updatedItems = [...existingItems, itemWithBase64];
    
    // Save back to storage
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    
    console.log('Clothing item saved successfully with base64 image data');
  } catch (error) {
    console.error('Error saving clothing item:', error);
    throw new Error('Failed to save clothing item');
  }
};

export const getClothingItems = async (): Promise<ClothingItem[]> => {
  try {
    const items = await AsyncStorage.getItem(STORAGE_KEY);
    return items ? JSON.parse(items) : [];
  } catch (error) {
    console.error('Error getting clothing items:', error);
    return [];
  }
};

export const deleteClothingItem = async (itemId: string): Promise<void> => {
  try {
    const existingItems = await getClothingItems();
    const updatedItems = existingItems.filter(item => item.id !== itemId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    
    console.log('Clothing item deleted successfully');
  } catch (error) {
    console.error('Error deleting clothing item:', error);
    throw new Error('Failed to delete clothing item');
  }
};

export const updateClothingItem = async (itemId: string, updates: Partial<ClothingItem>): Promise<void> => {
  try {
    const existingItems = await getClothingItems();
    const updatedItems = existingItems.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedItems));
    
    console.log('Clothing item updated successfully');
  } catch (error) {
    console.error('Error updating clothing item:', error);
    throw new Error('Failed to update clothing item');
  }
};

export const clearAllClothingItems = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('All clothing items cleared successfully');
  } catch (error) {
    console.error('Error clearing clothing items:', error);
    throw new Error('Failed to clear clothing items');
  }
};

export const getClothingItemsByCategory = async (category: string): Promise<ClothingItem[]> => {
  try {
    const allItems = await getClothingItems();
    return allItems.filter(item => item.category === category);
  } catch (error) {
    console.error('Error getting clothing items by category:', error);
    return [];
  }
};

export const searchClothingItems = async (searchTerm: string): Promise<ClothingItem[]> => {
  try {
    const allItems = await getClothingItems();
    const lowerSearchTerm = searchTerm.toLowerCase();
    
    return allItems.filter(item => 
      item.name?.toLowerCase().includes(lowerSearchTerm) ||
      item.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm)) ||
      item.category.toLowerCase().includes(lowerSearchTerm)
    );
  } catch (error) {
    console.error('Error searching clothing items:', error);
    return [];
  }
};
