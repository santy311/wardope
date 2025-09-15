import React, { useState, useEffect, useRef } from 'react';
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
  FlatList,
  Modal,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { 
  analyzeClothingImage, 
  StylingSuggestion, 
  createDetailedClothingDescription,
  findBestMatchesWithDescriptions,
  detectClothingInImage,
  analyzeClothingComprehensive,
  ClothingDescription,
  ClothingDetectionResult
} from '../services/openaiService';
import { imageToBase64, saveImageToPermanentStorage, getFileUri } from '../utils/imageUtils';
import { ClothingItem, getClothingItems, deleteClothingItem, updateClothingItem, saveClothingItem } from '../services/storageService';

const { width, height } = Dimensions.get('window');

export default function MatchClothesScreen() {
  const navigation = useNavigation();
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<StylingSuggestion[]>([]);
  const [currentDescription, setCurrentDescription] = useState<ClothingDescription | null>(null);
  const [bestMatches, setBestMatches] = useState<Array<{ item: ClothingItem; score: number; reasoning: string; styleCategory: string; occasion: string }>>([]);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [detectionResult, setDetectionResult] = useState<ClothingDetectionResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showFriendsPopup, setShowFriendsPopup] = useState(false);
  const [showAddToWardrobe, setShowAddToWardrobe] = useState(false);
  const [itemName, setItemName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Casual');
  const [isFriendsMode, setIsFriendsMode] = useState(false);

  // Animation refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const circleScaleAnim = useRef(new Animated.Value(1)).current;
  const hapticInterval = useRef<NodeJS.Timeout | null>(null);
  const isExpanding = useRef(false);
  const hapticCount = useRef(0);

  // Start haptic feedback during analysis
  const startHapticFeedback = () => {
    console.log('Starting haptic feedback...');
    
    // Clear any existing interval
    if (hapticInterval.current) {
      clearInterval(hapticInterval.current);
    }
    
    // Reset haptic count
    hapticCount.current = 0;
    
    // Add listener to pulse animation to detect expanding phase
    pulseAnim.addListener(({ value }) => {
      // Trigger haptic only when expanding (value increasing)
      if (value > 1.05 && !isExpanding.current) {
        isExpanding.current = true;
        hapticCount.current = 0;
        console.log('Starting expansion - triggering first haptic...');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(error => {
          console.error('Haptic feedback error:', error);
        });
        
        // Trigger second haptic in the middle of expansion
        setTimeout(() => {
          if (isExpanding.current) {
            console.log('Middle of expansion - triggering second haptic...');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(error => {
              console.error('Haptic feedback error:', error);
            });
          }
        }, 200); // Reduced from 1000ms to 200ms for faster double pulse
      } else if (value <= 1.05) {
        isExpanding.current = false;
      }
    });
  };

  // Stop haptic feedback
  const stopHapticFeedback = () => {
    console.log('Stopping haptic feedback...');
    if (hapticInterval.current) {
      clearInterval(hapticInterval.current);
      hapticInterval.current = null;
    }
    // Remove animation listener
    pulseAnim.removeAllListeners();
    isExpanding.current = false;
    hapticCount.current = 0;
  };


  useEffect(() => {
    loadClothingItems();
    requestPermissions();
    startAnimations();
  }, []);

  const startAnimations = () => {
    // Pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );

    // Rotation animation
    const rotateAnimation = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    );

    pulseAnimation.start();
    rotateAnimation.start();
  };

  const expandCircle = () => {
    Animated.timing(circleScaleAnim, {
      toValue: 1.2,
      duration: 500,
      useNativeDriver: true,
    }).start();
  };

  const resetCircle = () => {
    Animated.timing(circleScaleAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const requestPermissions = async () => {
    try {
      // Request camera permission
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'This app needs camera access to take photos of your clothing items. Please enable camera access in Settings.',
          [{ text: 'OK' }]
        );
      }

      // Request photo library permission
      const photoPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!photoPermission.granted) {
        Alert.alert(
          'Photo Library Permission Required',
          'This app needs photo library access to select clothing images. Please enable photo library access in Settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  const loadClothingItems = async () => {
    try {
      const items = await getClothingItems();
      console.log(`Loaded ${items.length} items from storage`);
      
      // Count items with base64 data
      const itemsWithBase64 = items.filter(item => item.imageBase64).length;
      console.log(`${itemsWithBase64} items have base64 image data`);
      
      setClothingItems(items);
    } catch (error) {
      console.error('Error loading clothing items:', error);
    }
  };

  const takePhoto = async () => {
    // Test haptic feedback
    console.log('Testing haptic feedback on camera tap...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(error => {
      console.error('Test haptic feedback error:', error);
    });
    
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disabled editing to use entire photo
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await analyzeAndFindMatches(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickFromGallery = async () => {
    // Test haptic feedback
    console.log('Testing haptic feedback on gallery tap...');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(error => {
      console.error('Test haptic feedback error:', error);
    });
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Photo library permission is required to select images.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // Disabled editing to use entire photo
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await analyzeAndFindMatches(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const analyzeAndFindMatches = async (imageUri: string, bypassDetection: boolean = false, isFriends: boolean = false) => {
    setIsAnalyzing(true);
    setCurrentImage(imageUri);
    setShowResults(false);
    setIsFriendsMode(isFriends);
    
    // Start haptic feedback
    startHapticFeedback();
    
    try {
      // Convert image to base64
      const base64 = await imageToBase64(imageUri);
      
      let detectionResult: ClothingDetectionResult;
      let description: ClothingDescription;
      let suggestions: StylingSuggestion[];
      
      if (bypassDetection) {
        // Manual override - skip detection
        detectionResult = { isClothing: true, confidence: 1.0, detectedItem: 'Manual override', reason: 'User chose to analyze anyway' };
        
        // Use individual calls for manual override
        description = await createDetailedClothingDescription(base64);
        suggestions = await analyzeClothingImage(base64);
      } else {
        // Use combined analysis for cost efficiency
        console.log('Using combined analysis for cost optimization...');
        const analysis = await analyzeClothingComprehensive(base64);
        
        detectionResult = analysis.detection;
        description = analysis.description;
        suggestions = analysis.suggestions;
      }
      
      setDetectionResult(detectionResult);
      
      if (!detectionResult.isClothing) {
        setIsAnalyzing(false);
        stopHapticFeedback();
        return;
      }
      
      setCurrentDescription(description);
      setCurrentSuggestions(suggestions);
      
      // Step 4: Find best matches from wardrobe
      const matches = await findBestMatchesWithDescriptions(description, clothingItems.map(item => ({
        id: item.id,
        description: item.description!,
        name: item.name || 'Unknown Item',
        imageUri: item.imageUri,
        imageBase64: item.imageBase64
      })));
      
      setBestMatches(matches);
      setShowResults(true);
      
    } catch (error) {
      console.error('Error during analysis:', error);
      Alert.alert('Analysis Error', 'Failed to analyze the image. Please try again.');
    } finally {
      setIsAnalyzing(false);
      stopHapticFeedback();
    }
  };

  const findSimpleMatches = (suggestions: StylingSuggestion[]): Array<{ item: ClothingItem; score: number; reasoning: string }> => {
    const matches: Array<{ item: ClothingItem; score: number; reasoning: string }> = [];
    const suggestionCategories = suggestions.map(s => s.category.toLowerCase());
    
    clothingItems.forEach(item => {
      let score = 0;
      let reasoning = '';
      
      // Check category match
      const itemCategory = item.category.toLowerCase();
      if (suggestionCategories.includes(itemCategory)) {
        score += 0.4;
        reasoning += 'Category match. ';
      }
      
      // Check tag matches
      item.tags?.forEach(tag => {
        if (suggestionCategories.includes(tag.toLowerCase())) {
          score += 0.2;
          reasoning += 'Tag match. ';
        }
      });
      
      // Add to matches if score > 0
      if (score > 0) {
        matches.push({ 
          item, 
          score: Math.min(score, 1.0),
          reasoning: reasoning || 'Good potential match.'
        });
      }
    });
    
    // Sort by score (highest first) and return top 6
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);
  };


  const addToWardrobe = async () => {
    if (!currentImage || !currentDescription) {
      Alert.alert('Error', 'No image or description to add');
      return;
    }

    if (!itemName.trim()) {
      Alert.alert('Error', 'Please enter a name for the item');
      return;
    }

    try {
      // Save image to permanent storage
      const permanentImageUri = await saveImageToPermanentStorage(currentImage);
      
      const clothingItem: ClothingItem = {
        id: Date.now().toString(),
        imageUri: permanentImageUri,
        name: itemName.trim(),
        category: currentDescription.category || selectedCategory, // Use AI-detected category or fallback
        style: currentDescription.style || 'Casual', // Use AI-detected style or default to 'Casual'
        dateAdded: new Date().toISOString(),
        tags: currentDescription.tags,
        suggestions: currentSuggestions,
        description: currentDescription,
        imageBase64: await imageToBase64(currentImage), // Store base64 for persistence
      };

      await saveClothingItem(clothingItem);
      
      // Update local state
      setClothingItems(prev => [...prev, clothingItem]);
      
      Alert.alert('Success', 'Item added to wardrobe!');
      setShowAddToWardrobe(false);
      setItemName('');
      setSelectedCategory('Casual');
    } catch (error) {
      console.error('Error adding to wardrobe:', error);
      Alert.alert('Error', 'Failed to add item to wardrobe. Please try again.');
    }
  };

  const resetAnalysis = () => {
    setIsAnalyzing(false);
    setCurrentImage(null);
    setCurrentSuggestions([]);
    setCurrentDescription(null);
    setBestMatches([]);
    setShowResults(false);
    setShowAddToWardrobe(false);
    setItemName('');
    setSelectedCategory('Casual');
    setDetectionResult(null);
    setIsFriendsMode(false);
    
    // Stop haptic feedback
    stopHapticFeedback();
    
    // Reset animations
    pulseAnim.setValue(1);
    rotateAnim.setValue(0);
    circleScaleAnim.setValue(1);
  };

  const renderBestMatch = ({ item, index }: { item: { item: ClothingItem; score: number; reasoning: string }; index: number }) => (
    <View style={styles.bestMatchCard}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankText}>#{index + 1}</Text>
        <Text style={styles.scoreText}>{Math.round(item.score * 100)}%</Text>
      </View>
      <Image source={{ uri: getFileUri(item.item.imageUri) }} style={styles.bestMatchImage} />
      <View style={styles.bestMatchInfo}>
        <Text style={styles.bestMatchName}>{item.item.name}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.item.category}</Text>
        </View>
        <Text style={styles.reasoningText} numberOfLines={2}>
          {item.reasoning}
        </Text>
      </View>
    </View>
  );

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleMatchPress = async (item: ClothingItem) => {
    console.log('handleMatchPress called with item:', {
      id: item.id,
      name: item.name,
      category: item.category,
      style: item.style
    });
    
    try {
      // Save the selected item to AsyncStorage so the wardrobe can access it
      await AsyncStorage.setItem('selectedItemForDetails', JSON.stringify(item));
      
      // Navigate to the AddClothes tab (wardrobe)
      navigation.navigate('AddClothes' as never);
      
      console.log('Navigated to AddClothes tab with selected item');
    } catch (error) {
      console.error('Error saving selected item:', error);
    }
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setSelectedItem(null);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        {/* Scan View */}
        {!showResults && (
          <View style={styles.scanView}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>
                {isAnalyzing ? 'Analyzing...' : 'Match Clothes'}
              </Text>
              <Text style={styles.headerSubtitle}>
                {isAnalyzing ? 'AI is processing your item' : 'Take a photo to find matches'}
              </Text>
            </View>

            <View style={styles.scanSection}>
              {/* Animated Circle */}
              <View style={styles.circleContainer}>
                <Animated.View style={[styles.outerRing, { transform: [{ scale: pulseAnim }] }]} />
                <Animated.View style={[styles.middleRing, { transform: [{ scale: pulseAnim }] }]} />
                <Animated.View style={[styles.innerRing, { transform: [{ scale: pulseAnim }] }]} />
                
                <View style={styles.mainCircle}>
                  {currentImage ? (
                    <Image source={{ uri: currentImage }} style={styles.circleImage} />
                  ) : (
                    <TouchableOpacity style={styles.circleButton} onPress={takePhoto}>
                      <Animated.View style={[styles.iconContainer, { transform: [{ rotate: `${rotateAnim}deg` }] }]}>
                        <Ionicons name="camera" size={40} color="white" />
                      </Animated.View>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionButtons}>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.galleryButton}
                    onPress={pickFromGallery}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="images" size={24} color="white" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.friendsButton}
                    onPress={() => setShowFriendsPopup(true)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="people" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Results View */}
        {showResults && (
          <View style={styles.resultsView}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Analysis Complete</Text>
              <Text style={styles.headerSubtitle}>Find your perfect match</Text>
            </View>

            <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
              {/* Analyzed Item Details */}
              {currentDescription && (
                <View style={styles.descriptionSection}>
                  <Text style={styles.descriptionTitle}>{currentDescription.itemType}</Text>
                  <Text style={styles.descriptionText}>{currentDescription.detailedDescription}</Text>
                  <View style={styles.descriptionDetails}>
                    <Text style={styles.detailText}>Color: {currentDescription.color}</Text>
                    <Text style={styles.detailText}>Style: {currentDescription.style}</Text>
                  </View>
                </View>
              )}

              {/* Best Matches */}
              {bestMatches.length > 0 && (
                <View style={styles.matchesSection}>
                  <Text style={styles.matchesTitle}>Best Matches ({bestMatches.length})</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchesScroll}>
                    {bestMatches.slice(0, 3).map((match, index) => {
                      console.log(`Rendering match ${index}:`, {
                        id: match.item.id,
                        name: match.item.name,
                        hasBase64: !!match.item.imageBase64,
                        base64Length: match.item.imageBase64?.length || 0,
                        imageUri: match.item.imageUri
                      });
                      
                      return (
                        <TouchableOpacity 
                          key={match.item.id} 
                          style={styles.matchCard}
                          onPress={() => handleMatchPress(match.item)}
                          activeOpacity={0.7}
                        >
                          <Image 
                            source={match.item.imageBase64 
                              ? { uri: `data:image/jpeg;base64,${match.item.imageBase64}` }
                              : { uri: getFileUri(match.item.imageUri) }
                            } 
                            style={styles.matchImage}
                            onError={(error) => {
                              console.error(`Match image load error for ${match.item.id}:`, error.nativeEvent);
                            }}
                            onLoad={() => console.log(`Match image loaded successfully for ${match.item.id}`)}
                          />
                          <Text style={styles.matchName}>{match.item.name}</Text>
                          <Text style={styles.matchScore}>{Math.round(match.score * 100)}%</Text>
                          {match.styleCategory && (
                            <Text style={styles.matchStyleCategory}>{match.styleCategory}</Text>
                          )}
                          {match.occasion && (
                            <Text style={styles.matchOccasion}>{match.occasion}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.resultsActionButtons}>
                {!isFriendsMode && (
                  <TouchableOpacity
                    style={styles.addToWardrobeButton}
                    onPress={() => {
                      console.log('Add to Wardrobe button pressed, setting showAddToWardrobe to true');
                      setShowAddToWardrobe(true);
                    }}
                  >
                    <Ionicons name="add-circle" size={24} color="white" />
                    <Text style={styles.addToWardrobeButtonText}>Add to Wardrobe</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={resetAnalysis}
                >
                  <Ionicons name="refresh" size={20} color="white" />
                  <Text style={styles.resetButtonText}>Scan Another Item</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </LinearGradient>

      {/* Add to Wardrobe Modal - Outside main container */}
      {showAddToWardrobe && (
        <View style={styles.addToWardrobeModalOverlay}>
          <View style={styles.addToWardrobeModalContent}>
            <Text style={styles.addToWardrobeModalTitle}>Add to Wardrobe</Text>
            
            <View style={styles.addToWardrobeInputContainer}>
              <Text style={styles.addToWardrobeInputLabel}>Item Name</Text>
              <TextInput
                style={styles.addToWardrobeTextInput}
                value={itemName}
                onChangeText={setItemName}
                placeholder="e.g., Blue Jeans, White T-shirt"
                placeholderTextColor="rgba(0, 0, 0, 0.4)"
              />
            </View>

            <View style={styles.addToWardrobeInputContainer}>
              <Text style={styles.addToWardrobeInputLabel}>Category</Text>
              <View style={styles.addToWardrobeCategoryContainer}>
                <View style={styles.addToWardrobeCategoryRow}>
                  {['Casual', 'Business', 'Evening', 'Sporty', 'Formal', 'Other'].map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.addToWardrobeCategoryButton,
                        selectedCategory === category && styles.addToWardrobeSelectedCategoryButton
                      ]}
                      onPress={() => setSelectedCategory(category)}
                    >
                      <Text style={[
                        styles.addToWardrobeCategoryButtonText,
                        selectedCategory === category && styles.addToWardrobeSelectedCategoryButtonText
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.addToWardrobeFormButtons}>
                <TouchableOpacity
                  style={styles.addToWardrobeSaveButton}
                  onPress={addToWardrobe}
                >
                  <Ionicons name="checkmark" size={20} color="white" />
                  <Text style={styles.addToWardrobeSaveButtonText}>Add</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addToWardrobeCancelButton}
                  onPress={() => setShowAddToWardrobe(false)}
                >
                  <Ionicons name="close" size={20} color="white" />
                  <Text style={styles.addToWardrobeCancelButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      )}

      {/* Friends Feature Popup */}
      {showFriendsPopup && (
        <View style={styles.modalOverlay}>
          <View style={styles.friendsPopupContent}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.friendsCloseButton}
              onPress={() => setShowFriendsPopup(false)}
            >
              <Ionicons name="close" size={24} color="#667eea" />
            </TouchableOpacity>
            
            <View style={styles.friendsPopupHeader}>
              <Ionicons name="people" size={32} color="#667eea" />
              <Text style={styles.friendsPopupTitle}>Style Your Friends!</Text>
            </View>
            
            <Text style={styles.friendsPopupDescription}>
              Take a photo or select an image of your friend's outfit and get AI-powered suggestions for similar or better styling options from your wardrobe.
            </Text>
            
            {/* Styling Options */}
            <View style={styles.stylingOptionsContainer}>
              <TouchableOpacity
                style={styles.stylingOption}
                onPress={() => {
                  console.log('Selected: Find Similar Outfit');
                }}
              >
                <Ionicons name="search" size={24} color="#667eea" />
                <Text style={styles.stylingOptionText}>Find Similar Outfit</Text>
                <Text style={styles.stylingOptionDescription}>
                  Find items in your wardrobe that are similar to the outfit
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.stylingOption}
                onPress={() => {
                  console.log('Selected: Make Me Look Better');
                }}
              >
                <Ionicons name="sparkles" size={24} color="#667eea" />
                <Text style={styles.stylingOptionText}>Make Me Look Better</Text>
                <Text style={styles.stylingOptionDescription}>
                  Get suggestions for better styling options from your wardrobe
                </Text>
              </TouchableOpacity>
            </View>
            
            {/* Action Buttons */}
            <View style={styles.friendsActionButtons}>
              <TouchableOpacity
                style={styles.friendsCameraButton}
                onPress={async () => {
                  setShowFriendsPopup(false);
                  try {
                    const { status } = await ImagePicker.requestCameraPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert('Permission needed', 'Camera permission is required to take photos.');
                      return;
                    }

                    const result = await ImagePicker.launchCameraAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: false,
                      quality: 0.8,
                    });

                    if (!result.canceled && result.assets[0]) {
                      // Use the same analysis function for friends' outfits
                      await analyzeAndFindMatches(result.assets[0].uri, false, true);
                    }
                  } catch (error) {
                    console.error('Error taking photo for friends:', error);
                    Alert.alert('Error', 'Failed to take photo. Please try again.');
                  }
                }}
              >
                <Ionicons name="camera" size={24} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.friendsGalleryButton}
                onPress={async () => {
                  setShowFriendsPopup(false);
                  try {
                    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (status !== 'granted') {
                      Alert.alert('Permission needed', 'Photo library permission is required to select images.');
                      return;
                    }

                    const result = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ImagePicker.MediaTypeOptions.Images,
                      allowsEditing: false,
                      quality: 0.8,
                    });

                    if (!result.canceled && result.assets[0]) {
                      // Use the same analysis function for friends' outfits
                      await analyzeAndFindMatches(result.assets[0].uri, false, true);
                    }
                  } catch (error) {
                    console.error('Error picking image for friends:', error);
                    Alert.alert('Error', 'Failed to pick image. Please try again.');
                  }
                }}
              >
                <Ionicons name="images" size={24} color="white" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
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
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 80, // Account for reduced tab bar height
  },
  scanSection: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  circleContainer: {
    width: width * 0.8,
    height: width * 0.8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  outerRing: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: width * 0.4,
    borderWidth: 5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    opacity: 0.7,
  },
  middleRing: {
    position: 'absolute',
    width: '80%',
    height: '80%',
    borderRadius: width * 0.4 * 0.8,
    borderWidth: 5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    opacity: 0.5,
  },
  innerRing: {
    position: 'absolute',
    width: '60%',
    height: '60%',
    borderRadius: width * 0.4 * 0.6,
    borderWidth: 5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    opacity: 0.3,
  },
  mainCircle: {
    width: width * 0.3,
    height: width * 0.3,
    borderRadius: width * 0.15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  iconContainer: {
    width: width * 0.2,
    height: width * 0.2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circleImage: {
    width: '100%',
    height: '100%',
    borderRadius: width * 0.15,
  },
  circleButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButtons: {
    alignItems: 'center',
    marginTop: 30,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 15,
  },
  galleryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 50,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  friendsButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 50,
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  primaryButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  resultsContainer: {
    width: '100%',
  },
  resultsContent: {
    justifyContent: 'flex-start',
    paddingTop: 15,
    paddingBottom: 0, // No padding at bottom
  },
  matchesScroll: {
    marginBottom: 10,
  },
  matchesSection: {
    marginTop: 15,
    marginBottom: 15,
  },
  matchesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
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
  suggestionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
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
  matchesList: {
    paddingVertical: 10,
  },
  bestMatchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    marginRight: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: 140,
    position: 'relative',
  },
  rankBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(255, 193, 7, 0.9)',
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  rankText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scoreText: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  bestMatchImage: {
    width: 140,
    height: 140,
    resizeMode: 'cover',
  },
  bestMatchInfo: {
    padding: 10,
  },
  bestMatchName: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  reasoningText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 5,
  },
  addToWardrobeSection: {
    marginTop: 30,
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  addToWardrobeText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  addToWardrobeButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 0, // Remove border for minimalistic look
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addToWardrobeButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  noMatchesContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noMatchesText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },
  noMatchesSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Add to Wardrobe Form Styles
  addToWardrobeForm: {
    marginTop: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  addToWardrobeFormTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: 'white',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryContainer: {
    flexDirection: 'column',
    marginTop: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  categoryButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 8,
  },
  selectedCategoryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  categoryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  selectedCategoryButtonText: {
    fontWeight: 'bold',
  },
  formButtons: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 0,
    marginRight: 15,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 0,
    minWidth: 140,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  // New styles for detailed description and suggestions
  descriptionSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
    textAlign: 'center',
  },
  descriptionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  descriptionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  descriptionText: {
    color: 'white',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 12,
  },
  descriptionDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailText: {
    color: 'white',
    fontSize: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 6,
    marginBottom: 4,
  },
  suggestionsSection: {
    marginBottom: 30,
  },
  // New styles for no clothing detected
  noClothingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  noClothingText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    textAlign: 'center',
  },
  noClothingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  detectionInfo: {
    marginTop: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '80%',
  },
  detectionLabel: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 5,
  },
  detectionValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 20,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  detectionSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 15,
    alignSelf: 'center',
  },
  detectionSuccessText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  overrideButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    width: '100%',
  },
  overrideButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    width: '45%',
  },
  overrideButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  resultsActionButtons: {
    flexDirection: 'column',
    width: '100%',
    gap: 8,
    marginTop: 0,
    marginBottom: 0,
  },
  matchCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    marginRight: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: 120,
    position: 'relative',
  },
  matchImage: {
    width: 120,
    height: 120,
    resizeMode: 'cover',
  },
  matchName: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 5,
    textAlign: 'center',
  },
  matchScore: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  matchStyleCategory: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  matchOccasion: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 10,
    marginTop: 2,
    textAlign: 'center',
  },
  resetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  resetButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 6,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  scanView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 100,
  },
  resultsView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 100,
  },
  friendsPopupContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  friendsCloseButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  friendsPopupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  friendsPopupTitle: {
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  friendsPopupDescription: {
    color: '#555',
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  friendsPopupFeatures: {
    color: '#333',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 25,
    textAlign: 'left',
  },
  stylingOptionsContainer: {
    marginBottom: 25,
  },
  stylingOption: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(102, 126, 234, 0.3)',
    alignItems: 'center',
  },
  stylingOptionText: {
    color: '#667eea',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  stylingOptionDescription: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
  friendsActionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  friendsCameraButton: {
    backgroundColor: '#667eea',
    borderRadius: 50,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 0,
  },
  friendsGalleryButton: {
    backgroundColor: '#667eea',
    borderRadius: 50,
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 0,
    marginLeft: 8,
  },
  // Add to Wardrobe Modal Styles
  addToWardrobeModalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  addToWardrobeModalContent: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 30,
    width: '85%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  addToWardrobeModalTitle: {
    color: '#333',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  addToWardrobeInputContainer: {
    marginBottom: 20,
  },
  addToWardrobeInputLabel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  addToWardrobeTextInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    width: '100%',
    marginBottom: 20,
  },
  addToWardrobeCategoryContainer: {
    flexDirection: 'column',
    marginTop: 8,
  },
  addToWardrobeCategoryRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  addToWardrobeCategoryButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginRight: 8,
  },
  addToWardrobeSelectedCategoryButton: {
    backgroundColor: 'rgba(102, 126, 234, 0.2)',
    borderColor: 'rgba(102, 126, 234, 0.5)',
  },
  addToWardrobeCategoryButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  addToWardrobeSelectedCategoryButtonText: {
    color: '#667eea',
    fontWeight: 'bold',
  },
  addToWardrobeFormButtons: {
    flexDirection: 'row',
    gap: 15,
    marginTop: 10,
  },
  addToWardrobeSaveButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 0,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addToWardrobeSaveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  addToWardrobeCancelButton: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 12,
    borderWidth: 0,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  addToWardrobeCancelButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});
