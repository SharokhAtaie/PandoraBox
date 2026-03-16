// Run this once to generate the tray icon:
//   node electron/icons/make-icon.js
const fs = require('fs')
const path = require('path')

// Minimal 16x16 green dot PNG (base64 encoded)
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAdgAAAHYBTnsmCAAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAABrSURBVDiNY2AYBfQHJP//MwwFYGBg+H+GYRiAlQEDA8N/BmIAKoAGQAUA8X+GAQNQATQAK4CK/zMMGIAKoAFYAVT8n2HAAFRQDQMAAJ5gFBQhS5cAAAAASUVORK5CYII=',
  'base64'
)

const outPath = path.join(__dirname, 'tray.png')
fs.writeFileSync(outPath, png)
console.log('Created tray icon at', outPath)
