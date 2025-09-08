# FreeAgent Time Tracker Icons

This directory contains the application icons in various formats for different platforms.

## Required Icons

### Windows (.ico)
- `icon.ico` - Main application icon (256x256, 128x128, 64x64, 32x32, 16x16)

### macOS (.icns)  
- `icon.icns` - macOS application icon (1024x1024 down to 16x16)

### Linux (.png)
- `icon.png` - Main application icon (512x512 recommended)

### System Tray
- `tray-icon.png` - System tray icon (16x16 or 32x32)
- `tray-icon-active.png` - Active timer indicator (optional)

### Notification Icons
- `timer-active.png` - Timer start notification icon
- `timer-stopped.png` - Timer stop notification icon

## Icon Guidelines

### Design Principles
- **Simple**: Clear at small sizes (16x16)
- **Recognizable**: Consistent with time tracking theme
- **Professional**: Suitable for business environments
- **High Contrast**: Visible on light and dark backgrounds

### Recommended Design
- Clock or timer symbol
- FreeAgent brand colors: #2196F3 (blue)
- Clean, minimal design
- Good contrast for system tray visibility

## Creating Icons

### From SVG Source
1. Create master SVG at high resolution
2. Export PNG versions at required sizes
3. Use tools like `electron-icon-builder` to generate platform formats

### Tools
- **Figma/Sketch**: Design SVG master
- **ImageMagick**: Batch convert sizes
- **electron-icon-builder**: Generate all platform formats
- **IconJar**: Manage icon library

## Installation

To generate all required icon formats from a source PNG:

```bash
npm install --global electron-icon-builder
electron-icon-builder --input=source-icon.png --output=assets/icons/
```

## Usage in App

Icons are referenced in:
- `main.js` - Application window icon
- `package.json` - Build configuration  
- System tray creation
- Notification displays