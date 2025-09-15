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
  StatusBar,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ClothingItem, getClothingItems, deleteClothingItem, updateClothingItem } from '../services/storageService';
import { deleteImageFromStorage, getFileUri, verifyImageAccessibility, migrateImageToPermanentStorage, isImageMissing, attemptImageRecovery } from '../utils/imageUtils';
import * as Haptics from 'expo-haptics';

const { width, height } = Dimensions.get('window');

export default function AddClothesScreen() {
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStyle, setSelectedStyle] = useState('All');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<ClothingItem | null>(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showOccasionModal, setShowOccasionModal] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState('');
  const [outfitSuggestions, setOutfitSuggestions] = useState<Array<{ items: ClothingItem[]; styleCategory: string; occasion: string; reasoning: string }>>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const hapticInterval = useRef<NodeJS.Timeout | null>(null);
  const isExpanding = useRef(false);

  const categories = ['All', 'T-Shirts', 'Shirts', 'Jeans', 'Pants', 'Dresses', 'Skirts', 'Jackets', 'Sweaters', 'Shoes', 'Accessories'];
  const styleOptions = ['All', 'Casual', 'Business', 'Evening', 'Sporty', 'Formal'];
  const occasionOptions = ['Work/Office', 'Casual/Weekend', 'Date Night', 'Gym/Workout', 'Party/Event', 'Travel', 'Interview', 'Wedding/Formal'];

  // Start haptic feedback during outfit generation
  const startHapticFeedback = () => {
    console.log('Starting haptic feedback for outfit suggestions...');
    
    // Clear any existing interval
    if (hapticInterval.current) {
      clearInterval(hapticInterval.current);
    }
    
    // Reset expanding state
    isExpanding.current = false;
    
    // Add listener to pulse animation to detect expanding phase
    pulseAnim.addListener(({ value }) => {
      // Trigger haptic only when expanding (value increasing)
      if (value > 1.05 && !isExpanding.current) {
        isExpanding.current = true;
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
        }, 200); // Fast double pulse
      } else if (value <= 1.05) {
        isExpanding.current = false;
      }
    });
  };

  // Stop haptic feedback
  const stopHapticFeedback = () => {
    console.log('Stopping haptic feedback for outfit suggestions...');
    if (hapticInterval.current) {
      clearInterval(hapticInterval.current);
      hapticInterval.current = null;
    }
    // Remove animation listener
    pulseAnim.removeAllListeners();
    isExpanding.current = false;
  };

  // Start pulse animation
  const startPulseAnimation = () => {
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
    pulseAnimation.start();
  };

  // Get all unique tags from clothing items
  const getAllTags = () => {
    const allTags = new Set<string>();
    clothingItems.forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => allTags.add(tag.toLowerCase()));
      }
    });
    return Array.from(allTags).sort();
  };

  const availableTags = getAllTags();

  // Debug function to check image accessibility
  const debugImageAccessibility = async () => {
    console.log('=== DEBUGGING IMAGE ACCESSIBILITY ===');
    for (const item of clothingItems) {
      const originalUri = item.imageUri;
      const normalizedUri = getFileUri(originalUri);
      const isAccessible = await verifyImageAccessibility(originalUri);
      
      console.log(`Item ${item.id}:`);
      console.log(`  Original URI: ${originalUri}`);
      console.log(`  Normalized URI: ${normalizedUri}`);
      console.log(`  Accessible: ${isAccessible}`);
      console.log('---');
    }
  };

  useEffect(() => {
    loadClothingItems();
    // Debug image accessibility after loading
    setTimeout(() => {
      debugImageAccessibility();
    }, 2000);
  }, []);

  // Reload clothing items when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      loadClothingItems();
      checkForSelectedItem();
    }, [])
  );

  const checkForSelectedItem = async () => {
    try {
      const selectedItemData = await AsyncStorage.getItem('selectedItemForDetails');
      if (selectedItemData) {
        const item = JSON.parse(selectedItemData);
        console.log('Found selected item from MatchClothes:', item.name);
        
        // Find the item in the current wardrobe
        const wardrobeItem = clothingItems.find(wardrobeItem => wardrobeItem.id === item.id);
        if (wardrobeItem) {
          setSelectedItem(wardrobeItem);
          setShowItemModal(true);
          console.log('Opening item details modal for:', wardrobeItem.name);
        }
        
        // Clear the selected item from storage
        await AsyncStorage.removeItem('selectedItemForDetails');
      }
    } catch (error) {
      console.error('Error checking for selected item:', error);
    }
  };

  const loadClothingItems = async () => {
    try {
      const items = await getClothingItems();
      console.log(`Loaded ${items.length} items from storage`);
      
      // Count items with base64 data
      const itemsWithBase64 = items.filter(item => item.imageBase64).length;
      console.log(`${itemsWithBase64} items have base64 image data`);
      
      // Check for items missing style property and update them
      const itemsToUpdate = items.filter(item => !item.style);
      if (itemsToUpdate.length > 0) {
        console.log(`Found ${itemsToUpdate.length} items missing style property, updating...`);
        
        for (const item of itemsToUpdate) {
          // Try to infer style from tags
          let inferredStyle = 'casual'; // Default
          if (item.tags) {
            const styleTags = item.tags.map(tag => tag.toLowerCase());
            if (styleTags.includes('sporty') || styleTags.includes('sports')) {
              inferredStyle = 'sporty';
            } else if (styleTags.includes('business') || styleTags.includes('formal')) {
              inferredStyle = 'business';
            } else if (styleTags.includes('casual')) {
              inferredStyle = 'casual';
            } else if (styleTags.includes('evening') || styleTags.includes('party')) {
              inferredStyle = 'evening';
            }
          }
          
          // Update the item with the inferred style
          await updateClothingItem(item.id, { style: inferredStyle });
          console.log(`Updated item ${item.name} with style: ${inferredStyle}`);
        }
        
        // Reload items after updating
        const updatedItems = await getClothingItems();
        setClothingItems(updatedItems);
      } else {
        setClothingItems(items);
      }
    } catch (error) {
      console.error('Error loading clothing items:', error);
    }
  };

  const handleDeleteItem = async (item: ClothingItem) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteImageFromStorage(item.imageUri);
              await deleteClothingItem(item.id);
              await loadClothingItems();
            } catch (error) {
              console.error('Error deleting item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const handleItemPress = (item: ClothingItem) => {
    setSelectedItem(item);
    setShowItemModal(true);
  };

  const closeItemModal = () => {
    setShowItemModal(false);
    setSelectedItem(null);
  };

  const clearAllFilters = () => {
    setSelectedCategory('All');
    setSelectedStyle('All');
    setSelectedTags([]);
  };

  const generateOutfitSuggestions = async (occasion: string) => {
    if (clothingItems.length < 2) {
      Alert.alert('Not Enough Items', 'You need at least 2 items in your wardrobe to generate outfit suggestions.');
      return;
    }

    setIsGeneratingSuggestions(true);
    setOutfitSuggestions([]);
    setSelectedOccasion(occasion);

    // Start pulse animation and haptic feedback
    startPulseAnimation();
    startHapticFeedback();

    try {
      // Create a mock description for the occasion
      const occasionDescription = {
        id: `occasion_${Date.now()}`,
        itemType: 'outfit',
        color: 'various',
        style: occasion.toLowerCase().includes('work') ? 'business' : 
               occasion.toLowerCase().includes('casual') ? 'casual' :
               occasion.toLowerCase().includes('date') ? 'evening' :
               occasion.toLowerCase().includes('gym') ? 'sporty' :
               occasion.toLowerCase().includes('party') ? 'evening' :
               occasion.toLowerCase().includes('travel') ? 'casual' :
               occasion.toLowerCase().includes('interview') ? 'formal' :
               occasion.toLowerCase().includes('wedding') ? 'formal' : 'casual',
        pattern: 'solid',
        fit: 'standard',
        occasion: occasion,
        season: 'all-season',
        detailedDescription: `Looking for outfit suggestions for ${occasion}`,
        category: 'OUTFIT',
        tags: [occasion.toLowerCase().replace('/', '_')]
      };

      // Import the function dynamically to avoid circular dependencies
      const { findBestMatchesWithDescriptions } = await import('../services/openaiService');
      
      const matches = await findBestMatchesWithDescriptions(occasionDescription, clothingItems.map(item => ({
        id: item.id,
        description: item.description!,
        name: item.name || 'Unknown Item',
        imageUri: item.imageUri,
        imageBase64: item.imageBase64 // Add imageBase64 to the mapping
      })));

      // Group matches by style category to create outfit suggestions
      const outfitGroups: { [key: string]: any[] } = {};
      matches.forEach(match => {
        const category = match.styleCategory || 'Casual';
        if (!outfitGroups[category]) {
          outfitGroups[category] = [];
        }
        outfitGroups[category].push(match);
      });

      // Convert to outfit suggestions format - ensure items have proper image data
      const suggestions = Object.entries(outfitGroups).map(([styleCategory, matches]) => ({
        items: matches.map(match => {
          // Find the original clothing item to get complete data
          const originalItem = clothingItems.find(item => item.id === match.item.id);
          return originalItem || match.item;
        }),
        styleCategory,
        occasion,
        reasoning: matches[0]?.reasoning || `Perfect ${styleCategory} outfit for ${occasion}`
      }));

      setOutfitSuggestions(suggestions);
      setShowOccasionModal(true);
    } catch (error) {
      console.error('Error generating outfit suggestions:', error);
      Alert.alert('Error', 'Failed to generate outfit suggestions. Please try again.');
    } finally {
      setIsGeneratingSuggestions(false);
      // Stop pulse animation and haptic feedback
      pulseAnim.stopAnimation();
      stopHapticFeedback();
    }
  };

  const getFilteredItems = () => {
    let filtered = clothingItems;

    // Debug logging
    console.log('=== FILTERING DEBUG ===');
    console.log('Total items:', clothingItems.length);
    console.log('Selected category:', selectedCategory);
    console.log('Selected style:', selectedStyle);
    console.log('Selected tags:', selectedTags);
    
    // Log all items and their properties
    clothingItems.forEach((item, index) => {
      console.log(`Item ${index}:`, {
        name: item.name,
        category: item.category,
        style: item.style,
        tags: item.tags
      });
    });

    if (selectedCategory !== 'All') {
      const beforeCategory = filtered.length;
      filtered = filtered.filter(item => item.category === selectedCategory);
      console.log(`Category filter: ${beforeCategory} -> ${filtered.length} items`);
    }

    if (selectedStyle !== 'All') {
      const beforeStyle = filtered.length;
      filtered = filtered.filter(item => {
        // Check if item has style property, if not, try to infer from tags or use 'casual' as default
        let itemStyle = item.style?.toLowerCase() || '';
        
        // If no style property, try to infer from tags
        if (!itemStyle && item.tags) {
          const styleTags = item.tags.map(tag => tag.toLowerCase());
          if (styleTags.includes('sporty') || styleTags.includes('sports')) {
            itemStyle = 'sporty';
          } else if (styleTags.includes('business') || styleTags.includes('formal')) {
            itemStyle = 'business';
          } else if (styleTags.includes('casual')) {
            itemStyle = 'casual';
          } else if (styleTags.includes('evening') || styleTags.includes('party')) {
            itemStyle = 'evening';
          } else {
            itemStyle = 'casual'; // Default fallback
          }
        }
        
        const selectedStyleLower = selectedStyle.toLowerCase();
        const matches = itemStyle === selectedStyleLower;
        console.log(`Style check: "${itemStyle}" === "${selectedStyleLower}" = ${matches} (original style: "${item.style}")`);
        return matches;
      });
      console.log(`Style filter: ${beforeStyle} -> ${filtered.length} items`);
    }

    if (selectedTags.length > 0) {
      const beforeTags = filtered.length;
      filtered = filtered.filter(item => 
        item.tags && item.tags.some(tag => selectedTags.includes(tag.toLowerCase()))
      );
      console.log(`Tags filter: ${beforeTags} -> ${filtered.length} items`);
    }

    console.log('Final filtered items:', filtered.length);
    console.log('=== END FILTERING DEBUG ===');

    return filtered;
  };

  const renderClothingItem = ({ item }: { item: ClothingItem }) => {
    // Use base64 image data if available, otherwise fall back to file URI
    const imageSource = item.imageBase64 
      ? { uri: `data:image/jpeg;base64,${item.imageBase64}` }
      : { uri: getFileUri(item.imageUri) };
    
    console.log(`Rendering item ${item.id} with ${item.imageBase64 ? 'base64' : 'file URI'} image`);
    
    return (
      <TouchableOpacity 
        style={styles.itemCard}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.itemImageContainer}>
          <Image
            source={imageSource}
            style={styles.itemImage}
            resizeMode="cover"
            onError={(error) => {
              console.error(`Image load error for ${item.id}:`, error.nativeEvent);
              console.error(`Failed source: ${item.imageBase64 ? 'base64' : imageSource.uri}`);
            }}
            onLoad={() => console.log(`Image loaded successfully for ${item.id}`)}
          />
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDeleteItem(item);
            }}
          >
            <Ionicons name="trash" size={16} color="white" />
          </TouchableOpacity>
        </View>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.itemTags}>
            <Text style={styles.categoryTag}>{item.category}</Text>
            {item.style !== item.category && (
              <Text style={styles.styleTag}>{item.style}</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderItemDetails = () => {
    if (!selectedItem) return null;

    return (
      <Modal
        visible={showItemModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeItemModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.modalGradient}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={closeItemModal}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Item Details</Text>
              <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
              {/* Item Image */}
              <View style={styles.modalImageContainer}>
                <Image
                  source={selectedItem.imageBase64 
                    ? { uri: `data:image/jpeg;base64,${selectedItem.imageBase64}` }
                    : { uri: getFileUri(selectedItem.imageUri) }
                  }
                  style={styles.modalImage}
                  resizeMode="cover"
                  onError={(error) => {
                    console.error(`Modal image load error for ${selectedItem.id}:`, error.nativeEvent);
                  }}
                  onLoad={() => console.log(`Modal image loaded successfully for ${selectedItem.id}`)}
                />
              </View>

              {/* Item Basic Info */}
              <View style={styles.modalInfoSection}>
                <Text style={styles.modalItemName}>{selectedItem.name}</Text>
                <View style={styles.modalTags}>
                  <Text style={styles.modalCategoryTag}>Category: {selectedItem.category}</Text>
                  <Text style={styles.modalStyleTag}>Style: {selectedItem.style}</Text>
                </View>
                <Text style={styles.modalDate}>
                  Added: {new Date(selectedItem.dateAdded).toLocaleDateString()}
                </Text>
              </View>

              {/* AI Description */}
              {selectedItem.description && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>AI Analysis</Text>
                  <View style={styles.modalCard}>
                    <Text style={styles.modalDescriptionText}>
                      {selectedItem.description.detailedDescription || 'No detailed description available.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Styling Suggestions */}
              {selectedItem.suggestions && selectedItem.suggestions.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Styling Suggestions</Text>
                  {selectedItem.suggestions.map((suggestion, index) => (
                    <View key={index} style={styles.modalCard}>
                      <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                      <Text style={styles.suggestionText}>{suggestion.description}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Tags */}
              {selectedItem.tags && selectedItem.tags.length > 0 && (
                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionTitle}>Tags</Text>
                  <View style={styles.modalTagsContainer}>
                    {selectedItem.tags.map((tag, index) => (
                      <Text key={index} style={styles.modalTag}>
                        {tag}
                      </Text>
                    ))}
                  </View>
                </View>
              )}

              {/* Delete Button */}
              <View style={styles.modalSection}>
                <TouchableOpacity
                  style={styles.modalDeleteButton}
                  onPress={() => {
                    closeItemModal();
                    handleDeleteItem(selectedItem);
                  }}
                >
                  <Ionicons name="trash" size={20} color="white" />
                  <Text style={styles.modalDeleteButtonText}>Delete Item</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </SafeAreaView>
      </Modal>
    );
  };

  const filteredItems = getFilteredItems();

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.title}>My Clothes</Text>
              <Text style={styles.subtitle}>{clothingItems.length} items</Text>
            </View>
            <TouchableOpacity
              style={styles.occasionButton}
              onPress={() => setShowOccasionModal(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="sparkles" size={20} color="white" />
              <Text style={styles.occasionButtonText}>Get Outfit Ideas</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Category Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Categories</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.filterButton,
                  selectedCategory === category && styles.filterButtonActive
                ]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedCategory === category && styles.filterButtonTextActive
                ]}>
                  {category}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Style Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Styles</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {styleOptions.map((style) => (
              <TouchableOpacity
                key={style}
                style={[
                  styles.filterButton,
                  selectedStyle === style && styles.filterButtonActive
                ]}
                onPress={() => setSelectedStyle(style)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedStyle === style && styles.filterButtonTextActive
                ]}>
                  {style}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Tag Filters */}
        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>Tags</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterContainer}
          >
            {availableTags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.filterButton,
                  selectedTags.includes(tag) && styles.filterButtonActive
                ]}
                onPress={() => {
                  setSelectedTags(prev => {
                    if (prev.includes(tag)) {
                      return prev.filter(t => t !== tag);
                    } else {
                      return [...prev, tag];
                    }
                  });
                }}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedTags.includes(tag) && styles.filterButtonTextActive
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Clear All Filters Button */}
        {(selectedCategory !== 'All' || selectedStyle !== 'All' || selectedTags.length > 0) && (
          <View style={styles.clearFiltersContainer}>
            <TouchableOpacity
              style={styles.clearFiltersButton}
              onPress={clearAllFilters}
            >
              <Ionicons name="refresh" size={16} color="white" />
              <Text style={styles.clearFiltersText}>Clear All Filters</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Items Grid */}
        <View style={styles.itemsContainer}>
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={48} color="rgba(255, 255, 255, 0.6)" />
              <Text style={styles.emptyStateText}>
                {clothingItems.length === 0 
                  ? "Your wardrobe is empty" 
                  : "No items match your filters"
                }
              </Text>
              <Text style={styles.emptyStateSubtext}>
                {clothingItems.length === 0 
                  ? "Add clothes from the Match Clothes tab" 
                  : "Try adjusting your filters"
                }
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredItems}
              renderItem={renderClothingItem}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.itemRow}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.itemsList}
            />
          )}
        </View>

        {/* Item Details Modal */}
        {renderItemDetails()}

        {/* Occasion Suggestion Modal */}
        <Modal
          visible={showOccasionModal}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowOccasionModal(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.modalGradient}
            >
              {/* Modal Header */}
              <View style={styles.modalHeader}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowOccasionModal(false)}
                >
                  <Ionicons name="close" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Get Outfit Ideas</Text>
                <View style={styles.placeholder} />
              </View>

              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                {isGeneratingSuggestions ? (
                  <View style={styles.loadingContainer}>
                    <View style={styles.analyzerContainer}>
                      {/* Outer circle */}
                      <Animated.View 
                        style={[
                          styles.outerCircle,
                          { transform: [{ scale: pulseAnim }] }
                        ]} 
                      />
                      
                      {/* Middle circle */}
                      <Animated.View 
                        style={[
                          styles.middleCircle,
                          { transform: [{ scale: pulseAnim.interpolate({
                            inputRange: [1, 1.1],
                            outputRange: [0.8, 0.9]
                          }) }] }
                        ]} 
                      />
                      
                      {/* Inner circle */}
                      <Animated.View 
                        style={[
                          styles.innerCircle,
                          { transform: [{ scale: pulseAnim.interpolate({
                            inputRange: [1, 1.1],
                            outputRange: [0.6, 0.7]
                          }) }] }
                        ]} 
                      />
                      
                      {/* Center icon - removed */}
                    </View>
                    <Text style={styles.loadingTitle}>Generating Outfit Ideas...</Text>
                    <Text style={styles.loadingSubtitle}>AI is analyzing your wardrobe for {selectedOccasion}</Text>
                  </View>
                ) : outfitSuggestions.length === 0 ? (
                  <View style={styles.occasionSelectionContainer}>
                    <Text style={styles.occasionTitle}>What's the occasion?</Text>
                    <Text style={styles.occasionSubtitle}>Select an occasion to get personalized outfit suggestions from your wardrobe</Text>
                    
                    <View style={styles.occasionGrid}>
                      {occasionOptions.map((occasion) => (
                        <TouchableOpacity
                          key={occasion}
                          style={styles.occasionCard}
                          onPress={() => generateOutfitSuggestions(occasion)}
                          activeOpacity={0.7}
                        >
                          <Ionicons 
                            name={
                              occasion.includes('Work') ? 'briefcase' :
                              occasion.includes('Casual') ? 'shirt' :
                              occasion.includes('Date') ? 'heart' :
                              occasion.includes('Gym') ? 'fitness' :
                              occasion.includes('Party') ? 'wine' :
                              occasion.includes('Travel') ? 'airplane' :
                              occasion.includes('Interview') ? 'school' :
                              'star'
                            } 
                            size={24} 
                            color="white" 
                          />
                          <Text style={styles.occasionCardText}>{occasion}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : (
                  <View style={styles.outfitSuggestionsContainer}>
                    <Text style={styles.outfitSuggestionsTitle}>Outfit Suggestions for {selectedOccasion}</Text>
                    
                    {outfitSuggestions.map((outfit, index) => (
                      <View key={index} style={styles.outfitCard}>
                        <View style={styles.outfitHeader}>
                          <Text style={styles.outfitStyleCategory}>{outfit.styleCategory}</Text>
                          <Text style={styles.outfitOccasion}>{outfit.occasion}</Text>
                        </View>
                        
                        <Text style={styles.outfitReasoning}>{outfit.reasoning}</Text>
                        
                        <View style={styles.outfitItemsContainer}>
                          {outfit.items.slice(0, 4).map((item, itemIndex) => {
                            console.log(`Rendering outfit item ${itemIndex}:`, {
                              id: item.id,
                              name: item.name,
                              hasBase64: !!item.imageBase64,
                              base64Length: item.imageBase64?.length || 0,
                              imageUri: item.imageUri
                            });
                            
                            return (
                              <View key={itemIndex} style={styles.outfitItemCard}>
                                <Image
                                  source={item.imageBase64 
                                    ? { uri: `data:image/jpeg;base64,${item.imageBase64}` }
                                    : { uri: getFileUri(item.imageUri) }
                                  }
                                  style={styles.outfitItemImage}
                                  resizeMode="cover"
                                  onError={(error) => {
                                    console.error(`Outfit item image load error for ${item.id}:`, error.nativeEvent);
                                  }}
                                  onLoad={() => console.log(`Outfit item image loaded successfully for ${item.id}`)}
                                />
                                <Text style={styles.outfitItemName}>{item.name}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ))}
                    
                    <TouchableOpacity
                      style={styles.newSuggestionButton}
                      onPress={() => {
                        setOutfitSuggestions([]);
                        setSelectedOccasion('');
                      }}
                    >
                      <Ionicons name="refresh" size={20} color="white" />
                      <Text style={styles.newSuggestionButtonText}>Get Different Suggestions</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            </LinearGradient>
          </SafeAreaView>
        </Modal>
      </LinearGradient>
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
    alignItems: 'flex-start',
    paddingTop: 60, // Add padding to account for status bar
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  headerLeft: {
    flex: 1,
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
  occasionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  occasionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  filterSection: {
    marginHorizontal: 20,
    marginBottom: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  filterContainer: {
    paddingRight: 10,
  },
  filterButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginRight: 10,
  },
  filterButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  filterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    fontWeight: 'bold',
  },
  itemsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  itemsList: {
    paddingBottom: 100,
  },
  itemRow: {
    justifyContent: 'space-between',
  },
  itemCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '48%',
    position: 'relative',
  },
  itemImageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
  },
  itemImage: {
    width: '100%',
    height: '100%',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    padding: 12,
  },
  itemName: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  itemTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  categoryTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  styleTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyStateText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyStateSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
  },
  closeButton: {
    padding: 10,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
    textAlign: 'center',
  },
  placeholder: {
    width: 40,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  modalImageContainer: {
    width: '100%',
    height: 250,
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 15,
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
  modalInfoSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 15,
  },
  modalItemName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  modalCategoryTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  modalStyleTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  modalDate: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 8,
  },
  modalSection: {
    marginBottom: 15,
  },
  modalSectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  modalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 10,
  },
  modalDescriptionText: {
    color: 'white',
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  suggestionText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  modalTagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  modalDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  modalDeleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  clearFiltersContainer: {
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  clearFiltersText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  mainContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 80, // Account for reduced tab bar height
  },
  occasionSelectionContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  occasionTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  occasionSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  occasionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
    width: '100%',
  },
  occasionCard: {
    width: '45%',
    aspectRatio: 1.2,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  occasionCardText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 10,
  },
  outfitSuggestionsContainer: {
    paddingVertical: 20,
  },
  outfitSuggestionsTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  outfitCard: {
    borderRadius: 15,
    padding: 15,
    marginBottom: 15,
  },
  outfitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  outfitStyleCategory: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  outfitOccasion: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
  },
  outfitReasoning: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  outfitItemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-around',
  },
  outfitItemCard: {
    width: '45%',
    aspectRatio: 1.2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 5,
    padding: 10,
  },
  outfitItemImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  outfitItemName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
  newSuggestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginTop: 20,
  },
  newSuggestionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  analyzerContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  outerCircle: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  middleCircle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  innerCircle: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  centerIcon: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinner: {
    // No specific styling needed, Ionicons handles it
  },
  loadingTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
  },
  loadingSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginTop: 5,
  },
});
