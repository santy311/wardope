import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { analyzeClothingImage, StylingSuggestion } from '../services/openaiService';
import { imageToBase64 } from '../utils/imageUtils';
import { saveClothingItem, ClothingItem } from '../services/storageService';

const { width, height } = Dimensions.get('window');

export default function ScanClothesScreen() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<StylingSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCapturedImage(result.assets[0].uri);
      analyzeClothing(result.assets[0].uri);
    }
  };

  const analyzeClothing = async (imageUri: string) => {
    setIsAnalyzing(true);
    
    try {
      // Convert image to base64
      const base64Image = await imageToBase64(imageUri);
      
      // Analyze with ChatGPT
      const aiSuggestions = await analyzeClothingImage(base64Image);
      
      setSuggestions(aiSuggestions);
      
      // Save to wardrobe
      const clothingItem: ClothingItem = {
        id: Date.now().toString(),
        imageUri: imageUri,
        suggestions: aiSuggestions,
        category: aiSuggestions[0]?.category || 'Casual',
        dateAdded: new Date().toISOString(),
        name: `Scanned Item ${new Date().toLocaleDateString()}`,
        tags: aiSuggestions.map(s => s.category),
      };
      
      await saveClothingItem(clothingItem);
      
      Alert.alert(
        'Success!',
        'Clothing item has been scanned and added to your wardrobe with AI styling suggestions.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error analyzing clothing:', error);
      Alert.alert(
        'Analysis Error',
        'Failed to analyze the image. Please try again or check your internet connection.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetApp = () => {
    setCapturedImage(null);
    setSuggestions([]);
    setIsAnalyzing(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Scan Clothes</Text>
          <Text style={styles.subtitle}>Scan clothing items for instant styling advice</Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {!capturedImage ? (
            <View style={styles.welcomeSection}>
              <View style={styles.iconContainer}>
                <Ionicons name="scan" size={80} color="white" />
              </View>
              <Text style={styles.welcomeText}>
                Select a photo of your clothing item to get instant AI-powered styling suggestions
              </Text>
              
              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={24} color="white" />
                  <Text style={styles.buttonText}>Choose from Gallery</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => Alert.alert('Coming Soon', 'Camera scanning will be available in the next update!')}
                >
                  <Ionicons name="camera" size={24} color="white" />
                  <Text style={styles.buttonText}>Scan with Camera (Coming Soon)</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={styles.resultSection}>
              <View style={styles.imageContainer}>
                <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={resetApp}
                >
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text style={styles.retakeText}>Scan Another Item</Text>
                </TouchableOpacity>
              </View>

              {isAnalyzing ? (
                <View style={styles.analyzingContainer}>
                  <Ionicons name="analytics" size={50} color="white" />
                  <Text style={styles.analyzingText}>AI is analyzing your style...</Text>
                  <Text style={styles.analyzingSubtext}>This may take a few moments</Text>
                </View>
              ) : suggestions.length > 0 ? (
                <View style={styles.suggestionsContainer}>
                  <Text style={styles.suggestionsTitle}>AI Styling Suggestions</Text>
                  {suggestions.map((suggestion) => (
                    <View key={suggestion.id} style={styles.suggestionCard}>
                      <View style={styles.suggestionHeader}>
                        <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                        <View style={styles.confidenceBadge}>
                          <Text style={styles.confidenceText}>
                            {Math.round(suggestion.confidence * 100)}%
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.suggestionDescription}>
                        {suggestion.description}
                      </Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{suggestion.category}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  welcomeSection: {
    alignItems: 'center',
    paddingTop: 40,
  },
  iconContainer: {
    marginBottom: 30,
  },
  welcomeText: {
    fontSize: 18,
    color: 'white',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  buttonContainer: {
    width: '100%',
    gap: 15,
  },
  primaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  resultSection: {
    flex: 1,
  },
  imageContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  capturedImage: {
    width: width - 40,
    height: (width - 40) * 0.75,
    borderRadius: 15,
    marginBottom: 15,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retakeText: {
    color: 'white',
    marginLeft: 5,
    fontWeight: '600',
  },
  analyzingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  analyzingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 15,
    fontWeight: '600',
  },
  analyzingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 5,
  },
  suggestionsContainer: {
    marginBottom: 30,
  },
  suggestionsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  suggestionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  suggestionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  confidenceBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  confidenceText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  suggestionDescription: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 15,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});
