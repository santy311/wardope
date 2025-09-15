import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { analyzeClothingImage, StylingSuggestion } from '../services/openaiService';
import { imageToBase64 } from '../utils/imageUtils';
import { ClothingItem, getClothingItems, deleteClothingItem, saveClothingItem } from '../services/storageService';

const { width, height } = Dimensions.get('window');

// Define clothing categories
const CATEGORIES = [
  { id: 'all', name: 'All Items', icon: 'shirt' },
  { id: 'casual', name: 'Casual', icon: 'shirt-outline' },
  { id: 'business', name: 'Business', icon: 'briefcase' },
  { id: 'evening', name: 'Evening', icon: 'moon' },
  { id: 'sporty', name: 'Sporty', icon: 'fitness' },
  { id: 'formal', name: 'Formal', icon: 'tie' },
];

export default function ClothesScreen() {
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [currentSuggestions, setCurrentSuggestions] = useState<StylingSuggestion[]>([]);

  useEffect(() => {
    loadClothingItems();
  }, []);

  const loadClothingItems = async () => {
    try {
      const items = await getClothingItems();
      setClothingItems(items);
    } catch (error) {
      console.error('Error loading clothing items:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCurrentImage(result.assets[0].uri);
      setShowAddModal(true);
      analyzeClothing(result.assets[0].uri);
    }
  };

  const analyzeClothing = async (imageUri: string) => {
    setIsAnalyzing(true);
    
    try {
      const base64Image = await imageToBase64(imageUri);
      const aiSuggestions = await analyzeClothingImage(base64Image);
      setCurrentSuggestions(aiSuggestions);
      
      // Auto-save to wardrobe
      const clothingItem: ClothingItem = {
        id: Date.now().toString(),
        imageUri: imageUri,
        suggestions: aiSuggestions,
        category: aiSuggestions[0]?.category || 'Casual',
        dateAdded: new Date().toISOString(),
        name: `Clothing Item ${new Date().toLocaleDateString()}`,
        tags: aiSuggestions.map(s => s.category),
      };
      
      await saveClothingItem(clothingItem);
      await loadClothingItems(); // Refresh the list
      
    } catch (error) {
      console.error('Error analyzing clothing:', error);
      Alert.alert(
        'Analysis Error',
        'Failed to analyze the image. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this clothing item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteClothingItem(itemId);
              await loadClothingItems();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const getFilteredItems = () => {
    if (selectedCategory === 'all') {
      return clothingItems;
    }
    return clothingItems.filter(item => 
      item.category.toLowerCase() === selectedCategory.toLowerCase()
    );
  };

  const renderCategoryButton = (category: any) => (
    <TouchableOpacity
      key={category.id}
      style={[
        styles.categoryButton,
        selectedCategory === category.id && styles.categoryButtonActive
      ]}
      onPress={() => setSelectedCategory(category.id)}
    >
      <Ionicons 
        name={category.icon as any} 
        size={20} 
        color={selectedCategory === category.id ? '#667eea' : 'white'} 
      />
      <Text style={[
        styles.categoryButtonText,
        selectedCategory === category.id && styles.categoryButtonTextActive
      ]}>
        {category.name}
      </Text>
    </TouchableOpacity>
  );

  const renderClothingItem = ({ item }: { item: ClothingItem }) => (
    <View style={styles.clothingCard}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.imageUri }} style={styles.clothingImage} />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteItem(item.id)}
        >
          <Ionicons name="trash" size={16} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
          <View style={styles.centerContainer}>
            <Ionicons name="refresh" size={50} color="white" />
            <Text style={styles.loadingText}>Loading your wardrobe...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>My Clothes</Text>
          <Text style={styles.subtitle}>
            {clothingItems.length} item{clothingItems.length !== 1 ? 's' : ''} in your wardrobe
          </Text>
        </View>

        {/* Add Clothes Button */}
        <View style={styles.addButtonContainer}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={pickImage}
          >
            <Ionicons name="add-circle" size={24} color="white" />
            <Text style={styles.addButtonText}>Add New Clothes</Text>
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        <View style={styles.categoryContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryScroll}
          >
            {CATEGORIES.map(renderCategoryButton)}
          </ScrollView>
        </View>

        {/* Clothing Items */}
        {clothingItems.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shirt-outline" size={80} color="white" />
            <Text style={styles.emptyTitle}>Your wardrobe is empty</Text>
            <Text style={styles.emptySubtitle}>
              Add some clothing items to get started with AI styling suggestions
            </Text>
          </View>
        ) : (
          <FlatList
            data={getFilteredItems()}
            renderItem={renderClothingItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Add Clothes Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          presentationStyle="pageSheet"
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
                  onPress={() => setShowAddModal(false)}
                >
                  <Ionicons name="close" size={30} color="white" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>New Clothing Item</Text>
                <View style={styles.placeholder} />
              </View>

              {/* Modal Content */}
              <ScrollView style={styles.modalContent}>
                {currentImage && (
                  <View style={styles.modalImageContainer}>
                    <Image source={{ uri: currentImage }} style={styles.modalImage} />
                  </View>
                )}

                {isAnalyzing ? (
                  <View style={styles.analyzingContainer}>
                    <Ionicons name="analytics" size={50} color="white" />
                    <Text style={styles.analyzingText}>AI is analyzing your style...</Text>
                    <Text style={styles.analyzingSubtext}>This may take a few moments</Text>
                  </View>
                ) : currentSuggestions.length > 0 ? (
                  <View style={styles.suggestionsContainer}>
                    <Text style={styles.suggestionsTitle}>AI Styling Suggestions</Text>
                    {currentSuggestions.map((suggestion) => (
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
              </ScrollView>
            </LinearGradient>
          </SafeAreaView>
        </Modal>
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
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
    marginTop: 15,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
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
  addButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  addButton: {
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
  addButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 10,
  },
  categoryContainer: {
    marginBottom: 20,
  },
  categoryScroll: {
    paddingHorizontal: 20,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryButtonActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  categoryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 5,
  },
  categoryButtonTextActive: {
    color: '#667eea',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
    lineHeight: 24,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  clothingCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    marginBottom: 15,
    marginHorizontal: 5,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  imageContainer: {
    position: 'relative',
  },
  clothingImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    padding: 10,
  },
  itemName: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  categoryBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  categoryText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  // Modal Styles
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
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  closeButton: {
    padding: 10,
  },
  modalTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 50,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  modalImageContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalImage: {
    width: width - 40,
    height: (width - 40) * 0.75,
    borderRadius: 15,
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
});
