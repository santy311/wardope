import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

export const imageToBase64 = async (imageUri: string): Promise<string> => {
  try {
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (error) {
    console.error('Error converting image to base64:', error);
    throw new Error('Failed to convert image to base64');
  }
};

export const saveImageToPermanentStorage = async (imageUri: string): Promise<string> => {
  try {
    console.log('Original image URI:', imageUri);
    
    // First, verify the source image exists
    const sourceFileInfo = await FileSystem.getInfoAsync(imageUri);
    if (!sourceFileInfo.exists) {
      throw new Error(`Source image does not exist: ${imageUri}`);
    }
    console.log('Source image verified, size:', sourceFileInfo.size);
    
    // Create a unique filename
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const filename = `clothing_${timestamp}_${randomId}.jpg`;
    
    // Get the app's document directory
    const documentDir = FileSystem.documentDirectory;
    if (!documentDir) {
      throw new Error('Document directory not available');
    }
    
    console.log('Document directory:', documentDir);
    
    // Create the full path for the new image
    const newImagePath = `${documentDir}${filename}`;
    
    console.log('New image path:', newImagePath);
    
    // Copy the image to permanent storage
    await FileSystem.copyAsync({
      from: imageUri,
      to: newImagePath,
    });
    
    // Verify the file was created and has content
    const fileInfo = await FileSystem.getInfoAsync(newImagePath);
    console.log('File info after copy:', fileInfo);
    
    if (!fileInfo.exists) {
      throw new Error('File was not created successfully');
    }
    
    if (fileInfo.size === 0) {
      throw new Error('File was created but is empty');
    }
    
    console.log('Image saved to permanent storage:', newImagePath);
    console.log('File size:', fileInfo.size, 'bytes');
    
    return newImagePath;
  } catch (error) {
    console.error('Error saving image to permanent storage:', error);
    throw new Error(`Failed to save image to permanent storage: ${error instanceof Error ? error.message : String(error)}`);
  }
};

export const deleteImageFromStorage = async (imageUri: string): Promise<void> => {
  try {
    // Check if the file exists before trying to delete it
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    if (fileInfo.exists) {
      await FileSystem.deleteAsync(imageUri);
      console.log('Image deleted from storage:', imageUri);
    }
  } catch (error) {
    console.error('Error deleting image from storage:', error);
    // Don't throw error here as the main deletion should still succeed
  }
};

export const verifyImageAccessibility = async (imageUri: string): Promise<boolean> => {
  try {
    // Normalize the URI for checking
    const normalizedUri = normalizeImageUri(imageUri);
    const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
    console.log('Image accessibility check for:', imageUri, 'normalized:', normalizedUri, 'exists:', fileInfo.exists);
    return fileInfo.exists;
  } catch (error) {
    console.error('Error checking image accessibility:', error);
    return false;
  }
};

export const getFileUri = (filePath: string): string => {
  return normalizeImageUri(filePath);
};

// Helper function to normalize image URIs for different platforms
const normalizeImageUri = (filePath: string): string => {
  // Remove any existing file:// prefix
  let normalizedPath = filePath.replace(/^file:\/\//, '');
  
  // For iOS, ensure we have the proper file:// prefix
  if (Platform.OS === 'ios') {
    return `file://${normalizedPath}`;
  }
  
  // For Android, return as is (Android handles file paths differently)
  return normalizedPath;
};

// New function to migrate old temporary images to permanent storage
export const migrateImageToPermanentStorage = async (oldImageUri: string): Promise<string | null> => {
  try {
    // Check if this is a temporary cache path
    if (oldImageUri.includes('Library/Caches/ImagePicker/')) {
      console.log('Migrating temporary image to permanent storage:', oldImageUri);
      
      // Check if the original file still exists
      const fileInfo = await FileSystem.getInfoAsync(oldImageUri);
      if (!fileInfo.exists) {
        console.log('Original temporary file no longer exists, cannot migrate');
        return null;
      }
      
      // Save to permanent storage
      const newImageUri = await saveImageToPermanentStorage(oldImageUri);
      console.log('Successfully migrated image to:', newImageUri);
      return newImageUri;
    }
    
    // If it's already a permanent path, just verify it exists
    const fileInfo = await FileSystem.getInfoAsync(oldImageUri);
    if (fileInfo.exists) {
      return oldImageUri; // Already permanent and exists
    }
    
    console.log('Image path is not accessible:', oldImageUri);
    return null;
  } catch (error) {
    console.error('Error migrating image:', error);
    return null;
  }
};

// Function to check if an image is missing and needs to be re-saved
export const isImageMissing = async (imageUri: string): Promise<boolean> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(imageUri);
    return !fileInfo.exists || fileInfo.size === 0;
  } catch (error) {
    console.error('Error checking if image is missing:', error);
    return true; // Assume missing if we can't check
  }
};

// Function to attempt to recover missing images
export const attemptImageRecovery = async (imageUri: string): Promise<string | null> => {
  try {
    console.log('Attempting to recover missing image:', imageUri);
    
    // Check if this is a temporary path that might still exist
    if (imageUri.includes('Library/Caches/ImagePicker/') || imageUri.includes('tmp/')) {
      const fileInfo = await FileSystem.getInfoAsync(imageUri);
      if (fileInfo.exists && fileInfo.size > 0) {
        console.log('Found original temporary file, re-saving to permanent storage');
        return await saveImageToPermanentStorage(imageUri);
      }
    }
    
    // Check if this might be a relative path that needs the document directory
    if (!imageUri.startsWith('file://') && !imageUri.startsWith('/')) {
      const documentDir = FileSystem.documentDirectory;
      if (documentDir) {
        const fullPath = `${documentDir}${imageUri}`;
        const fileInfo = await FileSystem.getInfoAsync(fullPath);
        if (fileInfo.exists && fileInfo.size > 0) {
          console.log('Found image with relative path, returning full path');
          return fullPath;
        }
      }
    }
    
    console.log('Could not recover missing image');
    return null;
  } catch (error) {
    console.error('Error attempting image recovery:', error);
    return null;
  }
};
