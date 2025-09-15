# DressWell - AI Fashion Styling Assistant

A mobile iOS app that helps users get personalized styling suggestions by taking photos of their clothing items.

## Features

- 📸 **Camera Integration**: Take photos of your clothing items directly in the app
- 🖼️ **Gallery Selection**: Choose existing photos from your device
- 🤖 **AI Styling Suggestions**: Get personalized outfit recommendations
- 🎨 **Beautiful UI**: Modern gradient design with smooth animations
- 📱 **iOS Optimized**: Designed specifically for iOS devices

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- iOS Simulator or physical iOS device
- Xcode (for iOS development)

### Installation

1. Clone or download the project
2. Navigate to the project directory:
   ```bash
   cd DressWell
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm start
   ```

5. Run on iOS:
   ```bash
   npm run ios
   ```

## How to Use

1. **Launch the App**: Open DressWell on your iOS device
2. **Take a Photo**: Tap "Take Photo" to capture a clothing item, or "Choose from Gallery" to select an existing image
3. **Wait for Analysis**: The app will analyze your clothing item (currently using mock data)
4. **View Suggestions**: Get personalized styling suggestions with confidence scores
5. **Retake**: Use the "Retake" button to try with a different item

## App Structure

```
DressWell/
├── App.tsx              # Main app component
├── app.json             # Expo configuration
├── package.json         # Dependencies
├── assets/              # Images and icons
└── README.md           # This file
```

## Features in Detail

### Camera Functionality
- Full-screen camera interface
- Visual frame guides for better photo composition
- High-quality image capture
- Permission handling for camera access

### Image Analysis
- Automatic clothing item detection
- Style categorization (Casual, Business, Evening)
- Confidence scoring for suggestions
- Multiple styling options per item

### User Interface
- Gradient background design
- Smooth transitions between screens
- Intuitive navigation
- Loading states and feedback

## Technical Stack

- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and tools
- **TypeScript**: Type-safe JavaScript
- **Expo Camera**: Camera functionality
- **Expo Image Picker**: Gallery access
- **Expo Linear Gradient**: Beautiful UI gradients
- **React Native Vector Icons**: Icon library

## Permissions

The app requires the following permissions:
- **Camera**: To take photos of clothing items
- **Photo Library**: To select existing images

## Development Notes

- Currently uses mock data for styling suggestions
- Ready for integration with real AI services
- Optimized for iOS devices
- Supports both portrait and landscape orientations

## Future Enhancements

- Real AI integration for clothing analysis
- User profile and style preferences
- Outfit history and favorites
- Social sharing features
- Seasonal style recommendations
- Brand and price suggestions

## Troubleshooting

### Common Issues

1. **Camera not working**: Ensure camera permissions are granted
2. **App crashes on startup**: Check that all dependencies are installed
3. **Photos not loading**: Verify photo library permissions

### Getting Help

If you encounter any issues:
1. Check the console for error messages
2. Ensure all dependencies are up to date
3. Try clearing the app cache and restarting

## License

This project is created for educational and demonstration purposes.

---

**DressWell** - Your personal AI fashion stylist! 👗✨
