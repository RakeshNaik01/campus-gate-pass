import React from 'react';
import { View, Platform, StyleSheet } from 'react-native';

// On web, use qrcode.react (Canvas / SVG), on native use react-native-qrcode-svg
let QRCodeWeb = null;
let QRCodeNative = null;

try {
  QRCodeWeb = require('qrcode.react').QRCodeSVG;
} catch (e) {}

try {
  QRCodeNative = require('react-native-qrcode-svg').default;
} catch (e) {}

export default function QRCodeRenderer({ id, value, size = 180, color = '#000000', backgroundColor = '#FFFFFF' }) {
  if (Platform.OS === 'web' && QRCodeWeb) {
    return (
      <View style={[styles.container, { width: size, height: size, backgroundColor }]}>
        <QRCodeWeb
          id={id}
          value={value || ''}
          size={size}
          fgColor={color}
          bgColor={backgroundColor}
          level="H"
        />
      </View>
    );
  }

  if (QRCodeNative) {
    return (
      <View style={[styles.container, { backgroundColor }]}>
        <QRCodeNative
          value={value || ''}
          size={size}
          color={color}
          backgroundColor={backgroundColor}
        />
      </View>
    );
  }

  // Fallback if neither loaded
  if (QRCodeWeb) {
    return (
      <QRCodeWeb
        value={value || ''}
        size={size}
        fgColor={color}
        bgColor={backgroundColor}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
