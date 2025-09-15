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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ClothingItem, getClothingItems, deleteClothingItem } from '../services/storageService';

const { width, height } = Dimensions.get('window');

export default function WardrobeScreen() {
  const [clothingItems, setClothingItems] = useState<ClothingItem[]>([]);
  const [loading, setLoading] = useState(true);

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
              await loadClothingItems(); // Reload the list
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderClothingItem = ({ item }: { item: ClothingItem }) => (
    <View style={styles.clothingCard}>
      <View style={styles.imageContainer}>
        <Image source={{ uri: item.imageUri }} style={styles.clothingImage} />
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteItem(item.id)}
        >
          <Ionicons name="trash" size={20} color="white" />
        </TouchableOpacity>
      </View>
      
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.name || 'Clothing Item'}</Text>
        <Text style={styles.itemDate}>Added: {formatDate(item.dateAdded)}</Text>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{item.category}</Text>
        </View>
      </View>

      <View style={styles.suggestionsContainer}>
        <Text style={styles.suggestionsTitle}>Styling Suggestions:</Text>
        {item.suggestions.slice(0, 2).map((suggestion, index) => (
          <View key={index} style={styles.suggestionItem}>
            <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
            <Text style={styles.suggestionDescription} numberOfLines={2}>
              {suggestion.description}
            </Text>
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceText}>
                {Math.round(suggestion.confidence * 100)}%
              </Text>
            </View>
          </View>
        ))}
        {item.suggestions.length > 2 && (
          <Text style={styles.moreSuggestions}>
            +{item.suggestions.length - 2} more suggestions
          </Text>
        )}
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
        <View style={styles.header}>
          <Text style={styles.title}>My Wardrobe</Text>
          <Text style={styles.subtitle}>
            {clothingItems.length} clothing item{clothingItems.length !== 1 ? 's' : ''}
          </Text>
        </View>

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
            data={clothingItems}
            renderItem={renderClothingItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
          />
        )}
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    marginBottom: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  imageContainer: {
    position: 'relative',
  },
  clothingImage: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  deleteButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  itemName: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  itemDate: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    marginBottom: 10,
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
  suggestionsContainer: {
    padding: 15,
  },
  suggestionsTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  suggestionItem: {
    marginBottom: 10,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
  },
  suggestionTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 5,
  },
  suggestionDescription: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 5,
  },
  confidenceBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.8)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'flex-start',
  },
  confidenceText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  moreSuggestions: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 5,
  },
});
